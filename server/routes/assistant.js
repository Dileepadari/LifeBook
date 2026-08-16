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

// --------------------------------------------------- matching existing rows --

const STOPWORDS = new Set([
  'the', 'a', 'an', 'my', 'to', 'for', 'of', 'and', 'on', 'in', 'at', 'it', 'i',
  'get', 'got', 'do', 'did', 'go', 'went', 'have', 'had', 'is', 'was', 'be',
  'again', 'today', 'tomorrow', 'still', 'about', 'up', 'around', 'never',
  'finish', 'finished', 'complete', 'completed', 'need', 'should', 'must',
]);

/**
 * Crude suffix stripping, on purpose. People do not repeat a task's exact
 * wording back at it: the board says "Revise thermodynamics" and they say
 * "finished revising thermodynamics". Without this the two share one word and
 * never match. A real stemmer would be overkill for matching two short titles.
 */
function stem(word) {
  return word
    .replace(/(ing|ed|es|s)$/, '')
    .replace(/e$/, '');
}

function keywords(text) {
  return new Set(
    String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(stem)
      .filter((w) => w.length > 2),
  );
}

/**
 * Finds the task a phrase is talking about.
 *
 * The whole point of saying "finished the ML assignment" is that the task is
 * already on the board - creating a second one marked done would be exactly
 * the wrong reading. Matching is on meaningful words only, so "get to the ML
 * assignment again" and "ML assignment" recognise each other while two
 * unrelated tasks that share "the" and "my" do not.
 *
 * Deliberately deterministic and applied after the provider returns, so the
 * built-in engine and both LLMs get identical behaviour here.
 */
function matchTask(phrase, candidates) {
  const want = keywords(phrase);
  if (want.size === 0) return null;

  let best = null;
  for (const task of candidates) {
    const have = keywords(task.title);
    if (have.size === 0) continue;
    let shared = 0;
    for (const w of want) if (have.has(w)) shared += 1;
    // Score against the smaller set: a short task title should still match a
    // long rambling phrase that contains it.
    const score = shared / Math.min(want.size, have.size);
    if (shared >= 2 && score >= 0.5 && (!best || score > best.score)) best = { task, score };
  }
  return best?.task || null;
}

/** Numbers close enough that calling it a conflict would just be noise. */
function materiallyDifferent(a, b) {
  if (a === null || a === undefined) return false;
  return Math.abs(Number(a) - Number(b)) > 0.01;
}

const WELLNESS_LABELS = {
  sleep_hours: 'sleep',
  exercise_minutes: 'exercise',
  screen_time_hours: 'screen time',
  water_glasses: 'water',
  meditation_minutes: 'meditation',
  had_breakfast: 'breakfast',
};

const WELLNESS_UNITS = {
  sleep_hours: (v) => `${v}h`,
  exercise_minutes: (v) => `${v} min`,
  screen_time_hours: (v) => `${v}h`,
  water_glasses: (v) => `${v} glasses`,
  meditation_minutes: (v) => `${v} min`,
  had_breakfast: (v) => (v ? 'had it' : 'skipped'),
};

assistantRoutes.post('/parse', async (req, res, next) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (message.length < 4) return res.status(400).json({ error: 'Tell me a bit more about your day.' });

    const date = req.body?.date || today();
    // The last few turns, so "the second one" and "no, I meant chemistry"
    // resolve against what was actually said rather than being read cold.
    const history = (Array.isArray(req.body?.history) ? req.body.history : [])
      .slice(-8)
      .filter((t) => t && typeof t.text === 'string')
      .map((t) => ({ role: t.role === 'assistant' ? 'assistant' : 'user', text: String(t.text).slice(0, 1500) }));

    const context = { date, alreadyLogged: alreadyLoggedToday(req.user.id, date), history };

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
      wellness: cleanNumbers(result?.wellness, message),
      mood: result?.mood?.score ? { score: clampInt(result.mood.score, 1, 5), note: result.mood.note || null } : null,
      study: result?.study?.minutes ? {
        subject: groundedSubject(result.study.subject, message),
        minutes: Math.round(result.study.minutes),
        focus_rating: result.study.focus_rating ? clampInt(result.study.focus_rating, 1, 5) : null,
      } : null,
      journal: result?.journal || null,
      gratitude: (result?.gratitude || []).filter(Boolean).map((s) => String(s).slice(0, 200)),
      // Filled in by reconcile(): existing rows to change, and the questions
      // that have to be answered before anything is overwritten.
      resolve: [],
      conflicts: [],
    };

    reconcile(proposal, req.user.id, date);

    res.json({ proposal, provider, degradedFrom, providerError: error });
  } catch (err) { next(err); }
});

/**
 * Turns "what the brief said" into "what should change", by looking at what is
 * already on the board.
 *
 * Two jobs, both about not being destructive:
 *
 *  - **Duplicates become updates.** A phrase that matches an existing task
 *    stops being an insert. "Finished the ML assignment" closes the open ML
 *    assignment task; a to-do you already have is dropped rather than added
 *    twice; a missed item you already have is left alone unless its priority
 *    needs raising.
 *  - **Overwrites become questions.** If a value is already logged for the day
 *    and the brief disagrees, that is not something to silently resolve. It
 *    goes to `conflicts` with both numbers, `/apply` refuses to touch it, and
 *    the user picks.
 */
function reconcile(proposal, userId, date) {
  const open = db
    .prepare("SELECT id, title, status, priority FROM tasks WHERE user_id = ? AND status != 'done' ORDER BY created_at DESC LIMIT 80")
    .all(userId);
  const doneRecently = db
    .prepare("SELECT id, title, status, priority FROM tasks WHERE user_id = ? AND status = 'done' ORDER BY completed_at DESC LIMIT 40")
    .all(userId);

  const claimed = new Set();
  const take = (phrase, pool) => {
    const hit = matchTask(phrase, pool.filter((t) => !claimed.has(t.id)));
    if (hit) claimed.add(hit.id);
    return hit;
  };

  // Completed: close the real task if we have it, otherwise record it as new.
  proposal.completed = proposal.completed.filter((phrase) => {
    const hit = take(phrase, open);
    if (!hit) return true;
    proposal.resolve.push({ task_id: hit.id, title: hit.title, action: 'done', was: hit.status });
    return false;
  });

  // New to-dos: skip the ones already on the board, open or recently closed.
  proposal.tasks = proposal.tasks.filter((t) => {
    const hit = take(t.title, open);
    if (hit) return false;
    const reopened = take(t.title, doneRecently);
    if (reopened) {
      proposal.resolve.push({ task_id: reopened.id, title: reopened.title, action: 'reopen', was: 'done' });
      return false;
    }
    return true;
  });

  // Missed: already-open ones only need flagging, not duplicating.
  proposal.missed = proposal.missed.filter((phrase) => {
    const hit = take(phrase, open);
    if (!hit) return true;
    if (hit.priority !== 'important' && hit.priority !== 'urgent') {
      proposal.resolve.push({ task_id: hit.id, title: hit.title, action: 'flag', was: hit.priority });
    }
    return false;
  });

  // --- overwrites ---
  const logged = db.prepare('SELECT * FROM wellness_logs WHERE user_id = ? AND date = ?').get(userId, date);
  if (logged) {
    for (const [field, value] of Object.entries(proposal.wellness)) {
      if (!materiallyDifferent(logged[field], value)) continue;
      const unit = WELLNESS_UNITS[field];
      proposal.conflicts.push({
        key: `wellness.${field}`,
        label: WELLNESS_LABELS[field] || field,
        existing: unit(logged[field]),
        proposed: unit(value),
        decision: null,
      });
    }
  }

  const session = proposal.study
    ? db.prepare('SELECT subject, actual_minutes FROM study_sessions WHERE user_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1').get(userId, date)
    : null;
  if (session) {
    proposal.conflicts.push({
      key: 'study',
      label: 'study time',
      existing: `${session.actual_minutes} min${session.subject ? ` of ${session.subject}` : ''} already logged`,
      proposed: `${proposal.study.minutes} min${proposal.study.subject ? ` of ${proposal.study.subject}` : ''}`,
      // Sessions are additive by nature - two study blocks in a day is normal -
      // so the honest question is "another one, or did you mean the same one?"
      additive: true,
      decision: null,
    });
  }
}

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(v) || min)));
}

/**
 * Which words in the brief license which wellness field.
 *
 * This exists because models fill schemas. Asked for a wellness object with
 * five numeric fields, Gemini 2.5 Flash cheerfully answers 0 for the four the
 * user never mentioned - and 0 is not a null here, it is a measurement, so
 * `/apply` would happily overwrite a real logged 8 glasses of water with it.
 * Dropping every 0 is not the answer either: "didn't drink any water today" is
 * a legitimate 0. So the rule is that a field is only accepted if the user
 * actually raised the subject.
 */
const WELLNESS_EVIDENCE = {
  sleep_hours: /\b(sleep|slept|sleeping|nap|napp?ed|bed|woke|awake|insomnia|rest(ed)?)\b/i,
  exercise_minutes: /\b(gym|workout|worked out|exercis\w*|ran|running|jog\w*|walk\w*|steps|yoga|swim\w*|cycl\w*|sport|training|lift\w*)\b/i,
  screen_time_hours: /\b(screen|phone|scroll\w*|instagram|insta|tiktok|youtube|reels|twitter|social media|netflix)\b/i,
  water_glasses: /\b(water|hydrat\w*|glass(es)?|drank|drink\w*)\b/i,
  meditation_minutes: /\b(meditat\w*|mindful\w*|breathwork|breathing)\b/i,
  had_breakfast: /\b(breakfast|ate|eat|eating|meal|food|lunch|dinner|skipped)\b/i,
};

/**
 * A study subject the brief actually names, or nothing.
 *
 * Given "I studied for two hours today" and a context listing the user's recent
 * sessions, Gemini will happily answer `subject: "Machine Learning"` - a fair
 * guess from their history, and still an invented fact about today. An unnamed
 * subject is a real and common state; a wrong one quietly corrupts every
 * time-by-subject chart in Analytics.
 */
function groundedSubject(subject, message) {
  if (!subject) return null;
  const said = message.toLowerCase();
  const words = String(subject).toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return null;
  return words.every((w) => said.includes(w)) ? String(subject).slice(0, 80) : null;
}

/** Keeps only numeric fields the brief gives grounds for. */
function cleanNumbers(w, message = '') {
  if (!w || typeof w !== 'object') return {};
  const out = {};
  for (const key of ['sleep_hours', 'exercise_minutes', 'screen_time_hours', 'water_glasses', 'meditation_minutes']) {
    const value = Number(w[key]);
    if (!Number.isFinite(value) || value < 0) continue;
    if (!WELLNESS_EVIDENCE[key].test(message)) continue;
    out[key] = value;
  }
  if (typeof w.had_breakfast === 'boolean' && WELLNESS_EVIDENCE.had_breakfast.test(message)) {
    out.had_breakfast = w.had_breakfast ? 1 : 0;
  }
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

  // An undecided conflict is a question the user has not answered yet. Writing
  // anyway would make asking pointless, so refuse the whole apply and say which
  // one is outstanding - a partial write here is the worst of both worlds.
  const undecided = (p.conflicts || []).find((c) => c.decision !== 'overwrite' && c.decision !== 'keep');
  if (undecided) {
    return res.status(409).json({ error: `Tell me what to do about ${undecided.label} first.`, conflict: undecided.key });
  }
  const kept = new Set((p.conflicts || []).filter((c) => c.decision === 'keep').map((c) => c.key));

  const created = { tasks: [], study_sessions: [], moods: [] };
  const updated = { wellness: null, journal: null, tasks: [] };
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
      summary.push(`${n} new ${n === 1 ? 'task' : 'tasks'}`);
    }

    // Existing rows. Each one records its previous state so undo restores it
    // rather than guessing what "before" looked like.
    for (const r of p.resolve || []) {
      const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(r.task_id, userId);
      if (!row) continue;
      updated.tasks.push({ id: row.id, before: { status: row.status, priority: row.priority, completed_at: row.completed_at } });

      if (r.action === 'done') {
        db.prepare("UPDATE tasks SET status = 'done', completed_at = ? WHERE id = ?")
          .run(new Date().toISOString(), row.id);
      } else if (r.action === 'reopen') {
        db.prepare("UPDATE tasks SET status = 'todo', completed_at = NULL WHERE id = ?").run(row.id);
      } else if (r.action === 'flag') {
        db.prepare("UPDATE tasks SET priority = 'important' WHERE id = ?").run(row.id);
      }
    }
    if (updated.tasks.length) {
      const closed = (p.resolve || []).filter((r) => r.action === 'done').length;
      const other = updated.tasks.length - closed;
      if (closed) summary.push(`closed ${closed} ${closed === 1 ? 'task' : 'tasks'}`);
      if (other) summary.push(`updated ${other} ${other === 1 ? 'task' : 'tasks'}`);
    }

    // --- wellness (upsert; only the fields actually mentioned, minus any the
    //     user chose to keep as they were) ---
    const w = Object.fromEntries(Object.entries(p.wellness || {}).filter(([f]) => !kept.has(`wellness.${f}`)));
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
    if (p.study?.minutes > 0 && !kept.has('study')) {
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

    // Tasks that already existed are put back exactly as they were - status,
    // priority and completion time - rather than being deleted with the rest.
    for (const t of updated.tasks || []) {
      if (!t?.id || !t.before) continue;
      db.prepare("UPDATE tasks SET status = ?, priority = ?, completed_at = ? WHERE id = ? AND user_id = ?")
        .run(t.before.status, t.before.priority, t.before.completed_at ?? null, t.id, userId);
    }

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
