import { Router } from 'express';
import { db, uid, today, parseJSON } from '../db.js';
import { requireAuth } from '../auth.js';
import { evaluateBadges } from '../badges.js';
import { healthPoints } from '../analytics.js';
import * as ai from '../ai/index.js';

export const assistantRoutes = Router();
assistantRoutes.use(requireAuth);

/**
 * The day assistant: talk about your day, and it becomes rows.
 *
 * Split into parse and apply on purpose. Parsing is the part that can be
 * wrong - an LLM reading "I felt behind on the assignment" as a task rather
 * than a mood is a plausible mistake, and writing that straight into someone's
 * board with no trace is worse than asking. So `/parse` returns a proposal, the
 * client applies it (immediately, by default) and `/apply` reports exactly what
 * it wrote so the UI can offer an undo.
 */

function alreadyLoggedToday(userId, date) {
  const tasks = db
    .prepare('SELECT title, status FROM tasks WHERE user_id = ? AND (due_date = ? OR date(created_at) = ?)')
    .all(userId, date, date);
  const wellness = db.prepare('SELECT * FROM wellness_logs WHERE user_id = ? AND date = ?').get(userId, date);
  const sessions = db
    .prepare('SELECT subject, actual_minutes FROM study_sessions WHERE user_id = ? AND date = ?')
    .all(userId, date);
  const journal = db.prepare('SELECT reflection FROM journal_entries WHERE user_id = ? AND date = ?').get(userId, date);
  const mood = db.prepare('SELECT score FROM moods WHERE user_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1').get(userId, date);

  return {
    tasks: tasks.map((t) => `${t.title} (${t.status})`),
    wellness: wellness
      ? {
          sleep_hours: wellness.sleep_hours,
          exercise_minutes: wellness.exercise_minutes,
          screen_time_hours: wellness.screen_time_hours,
        }
      : null,
    study_sessions: sessions,
    has_journal: Boolean(journal?.reflection),
    mood: mood?.score ?? null,
  };
}

assistantRoutes.post('/parse', async (req, res, next) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (message.length < 4) return res.status(400).json({ error: 'Tell me a bit more about your day.' });

    const date = req.body?.date || today();
    const context = { date, alreadyLogged: alreadyLoggedToday(req.user.id, date) };

    const { result, provider, degradedFrom, error } = await ai.parseDayBrief(req.user.id, message, context);

    // Normalise whatever the provider returned into the exact shape the client
    // renders and /apply accepts, so a model that omits an optional key or
    // returns null instead of [] cannot break the UI.
    const proposal = {
      reply: result?.reply || 'Here is what I picked up.',
      tasks: (result?.tasks || []).filter((t) => t?.title).map((t) => ({
        title: String(t.title).slice(0, 200),
        priority: ['low', 'normal', 'important', 'urgent'].includes(t.priority) ? t.priority : 'normal',
        category: ['academic', 'ECA', 'personal', 'wellness'].includes(t.category) ? t.category : 'academic',
      })),
      completed: (result?.completed || []).filter(Boolean).map((s) => String(s).slice(0, 200)),
      missed: (result?.missed || []).filter(Boolean).map((s) => String(s).slice(0, 200)),
      wellness: cleanNumbers(result?.wellness),
      mood: result?.mood?.score ? { score: clampInt(result.mood.score, 1, 5), note: result.mood.note || null } : null,
      study: result?.study?.minutes ? { subject: result.study.subject || null, minutes: Math.round(result.study.minutes), focus_rating: result.study.focus_rating ? clampInt(result.study.focus_rating, 1, 5) : null } : null,
      journal: result?.journal || null,
      gratitude: (result?.gratitude || []).filter(Boolean).map((s) => String(s).slice(0, 200)),
    };

    res.json({ proposal, provider, degradedFrom, providerError: error });
  } catch (err) { next(err); }
});

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(v) || min)));
}

/** Drops nulls and anything non-numeric, so an absent field never overwrites a
 *  real logged value with 0. */
function cleanNumbers(w) {
  if (!w || typeof w !== 'object') return {};
  const out = {};
  for (const key of ['sleep_hours', 'exercise_minutes', 'screen_time_hours', 'water_glasses', 'meditation_minutes']) {
    const value = Number(w[key]);
    if (Number.isFinite(value) && value >= 0) out[key] = value;
  }
  if (typeof w.had_breakfast === 'boolean') out.had_breakfast = w.had_breakfast ? 1 : 0;
  return out;
}

/**
 * Writes an (optionally edited) proposal. Returns an `undo` token listing every
 * row id it created or changed, so the client can offer a real undo rather than
 * asking the user to hunt the writes down by hand.
 */
assistantRoutes.post('/apply', (req, res) => {
  const p = req.body?.proposal;
  if (!p) return res.status(400).json({ error: 'Nothing to apply.' });

  const userId = req.user.id;
  const date = req.body?.date || today();
  const created = { tasks: [], study_sessions: [], moods: [] };
  const updated = { wellness: null, journal: null };
  const summary = [];

  const insertTask = db.prepare(
    `INSERT INTO tasks (id, user_id, title, status, priority, category, due_date, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    for (const t of p.tasks || []) {
      const id = uid();
      insertTask.run(id, userId, t.title, 'todo', t.priority || 'normal', t.category || 'academic', date, null);
      created.tasks.push(id);
    }
    // Completed things become tasks already closed, so they count toward the
    // "tasks completed" tile and appear on the page as achievements.
    for (const title of p.completed || []) {
      const id = uid();
      insertTask.run(id, userId, title, 'done', 'normal', 'academic', date, new Date().toISOString());
      created.tasks.push(id);
    }
    // Missed things are recorded as still-open tasks rather than silently lost -
    // "didn't get to X" is exactly a backlog item, which is the whole point.
    for (const title of p.missed || []) {
      const id = uid();
      insertTask.run(id, userId, title, 'todo', 'important', 'academic', date, null);
      created.tasks.push(id);
    }
    if (p.tasks?.length || p.completed?.length || p.missed?.length) {
      const n = (p.tasks?.length || 0) + (p.completed?.length || 0) + (p.missed?.length || 0);
      summary.push(`${n} ${n === 1 ? 'task' : 'tasks'}`);
    }

    // --- wellness (upsert; only the fields actually mentioned) ---
    const w = p.wellness || {};
    if (Object.keys(w).length) {
      const existing = db.prepare('SELECT * FROM wellness_logs WHERE user_id = ? AND date = ?').get(userId, date);
      updated.wellness = existing ? { id: existing.id, before: { ...existing } } : { id: null };
      if (existing) {
        const cols = Object.keys(w);
        db.prepare(`UPDATE wellness_logs SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
          .run(...cols.map((c) => w[c]), existing.id);
      } else {
        const cols = Object.keys(w);
        db.prepare(
          `INSERT INTO wellness_logs (id, user_id, date${cols.length ? `, ${cols.join(', ')}` : ''})
           VALUES (?, ?, ?${cols.map(() => ', ?').join('')})`,
        ).run(uid(), userId, date, ...cols.map((c) => w[c]));
      }
      summary.push('wellness');
    }

    // --- study session ---
    if (p.study?.minutes > 0) {
      const id = uid();
      db.prepare(
        `INSERT INTO study_sessions (id, user_id, date, subject, technique, planned_minutes, actual_minutes, focus_rating, notes)
         VALUES (?, ?, ?, ?, 'deep_work', ?, ?, ?, 'Logged from the day assistant')`,
      ).run(id, userId, date, p.study.subject || null, p.study.minutes, p.study.minutes, p.study.focus_rating ?? null);
      created.study_sessions.push(id);
      summary.push('a study block');
    }

    // --- mood ---
    if (p.mood?.score) {
      const id = uid();
      db.prepare('INSERT INTO moods (id, user_id, date, score, triggers, note) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, userId, date, p.mood.score, JSON.stringify([]), p.mood.note || null);
      created.moods.push(id);
      summary.push('a mood check-in');
    }

    // --- journal (append rather than replace; the user may have written already) ---
    if (p.journal || p.gratitude?.length) {
      const existing = db.prepare('SELECT * FROM journal_entries WHERE user_id = ? AND date = ?').get(userId, date);
      updated.journal = existing ? { id: existing.id, before: { ...existing } } : { id: null };

      const priorGratitude = parseJSON(existing?.gratitude, []);
      const gratitude = [...new Set([...priorGratitude, ...(p.gratitude || [])])];
      const reflection = existing?.reflection
        ? (p.journal && !existing.reflection.includes(p.journal) ? `${existing.reflection}\n\n${p.journal}` : existing.reflection)
        : p.journal || null;

      if (existing) {
        db.prepare("UPDATE journal_entries SET reflection = ?, gratitude = ?, updated_at = datetime('now') WHERE id = ?")
          .run(reflection, JSON.stringify(gratitude), existing.id);
      } else {
        db.prepare(
          `INSERT INTO journal_entries (id, user_id, date, reflection, gratitude, wins, improvements)
           VALUES (?, ?, ?, ?, ?, '[]', '[]')`,
        ).run(uid(), userId, date, reflection, JSON.stringify(gratitude));
      }
      summary.push('your journal');
    }
  })();

  const awarded = evaluateBadges(userId);

  res.json({
    applied: summary,
    undo: { created, updated, date },
    health_points: healthPoints(userId, date),
    awarded,
  });
});

/** Reverses exactly what /apply wrote. */
assistantRoutes.post('/undo', (req, res) => {
  const { created = {}, updated = {} } = req.body?.undo || {};
  const userId = req.user.id;

  db.transaction(() => {
    for (const id of created.tasks || []) db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
    for (const id of created.study_sessions || []) db.prepare('DELETE FROM study_sessions WHERE id = ? AND user_id = ?').run(id, userId);
    for (const id of created.moods || []) db.prepare('DELETE FROM moods WHERE id = ? AND user_id = ?').run(id, userId);

    // Rows we updated are restored to their previous values; rows we created
    // outright are removed.
    for (const key of ['wellness', 'journal']) {
      const record = updated[key];
      if (!record) continue;
      const table = key === 'wellness' ? 'wellness_logs' : 'journal_entries';
      if (!record.id) {
        db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND date = ?`).run(userId, req.body.undo.date);
        continue;
      }
      const before = record.before || {};
      const cols = Object.keys(before).filter((c) => !['id', 'user_id', 'date'].includes(c));
      if (!cols.length) continue;
      db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND user_id = ?`)
        .run(...cols.map((c) => before[c]), record.id, userId);
    }
  })();

  res.json({ ok: true });
});
