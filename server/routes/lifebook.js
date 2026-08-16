import { Router } from 'express';
import { db, uid, today, parseJSON, daysAgo } from '../db.js';
import { requireAuth } from '../auth.js';
import { daySnapshot, healthPoints } from '../analytics.js';
import { evaluateBadges } from '../badges.js';
import * as ai from '../ai/index.js';

export const lifebookRoutes = Router();
lifebookRoutes.use(requireAuth);

function hydrate(row) {
  if (!row) return null;
  return {
    ...row,
    achievements: parseJSON(row.achievements, []),
    improvements: parseJSON(row.improvements, []),
    metrics: parseJSON(row.metrics, {}),
  };
}

lifebookRoutes.get('/pages', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM lifepages WHERE user_id = ? ORDER BY date DESC LIMIT ?')
    .all(req.user.id, Number(req.query.limit) || 400);
  res.json({ data: rows.map(hydrate) });
});

lifebookRoutes.get('/pages/:date', (req, res) => {
  const row = db.prepare('SELECT * FROM lifepages WHERE user_id = ? AND date = ?').get(req.user.id, req.params.date);
  res.json({ page: hydrate(row) });
});

/** The raw day, so the UI can show what a page *would* be built from before
 *  spending an API call on generating it. */
lifebookRoutes.get('/snapshot/:date', (req, res) => {
  res.json({ snapshot: daySnapshot(req.user.id, req.params.date) });
});

/**
 * Writes (or rewrites) the page for a date. Not on the /data gateway: it reads
 * a dozen tables, calls a provider, and is the one operation whose output is
 * meant to be permanent.
 *
 * A sealed page is refused rather than overwritten - the book is a record, and
 * silently rewriting a day someone already read is worse than an error.
 */
lifebookRoutes.post('/pages/:date/generate', async (req, res, next) => {
  try {
    const date = req.params.date;
    const existing = db.prepare('SELECT * FROM lifepages WHERE user_id = ? AND date = ?').get(req.user.id, date);

    if (existing?.sealed_at && !req.body?.force) {
      return res.status(409).json({
        error: 'This page is sealed. Sealed pages are part of the printed book and are not rewritten.',
        page: hydrate(existing),
      });
    }

    const snapshot = daySnapshot(req.user.id, date);
    const { result, provider, degradedFrom, error } = await ai.generateLifePage(req.user.id, snapshot);

    const metrics = {
      study_minutes: snapshot.study.totalMinutes,
      sessions: snapshot.study.sessionCount,
      focus: snapshot.study.avgFocus,
      tasks_completed: snapshot.tasks.completed,
      tasks_planned: snapshot.tasks.planned,
      sleep_hours: snapshot.wellness?.sleep_hours ?? null,
      exercise_minutes: snapshot.wellness?.exercise_minutes ?? 0,
      habits_done: snapshot.habits.doneToday,
      habits_total: snapshot.habits.total,
      mood: snapshot.mood?.score ?? null,
      health_points: healthPoints(req.user.id, date),
    };

    const row = {
      title: result.title || null,
      summary: result.summary || null,
      achievements: JSON.stringify(result.achievements || []),
      improvements: JSON.stringify(result.improvements || []),
      journal_excerpt: result.journal_excerpt || null,
      suggestion: result.suggestion || null,
      metrics: JSON.stringify(metrics),
      photo_url: req.body?.photo_url ?? existing?.photo_url ?? snapshot.journal?.photo_url ?? null,
      generated_by: provider,
    };

    if (existing) {
      db.prepare(
        `UPDATE lifepages SET title=@title, summary=@summary, achievements=@achievements,
           improvements=@improvements, journal_excerpt=@journal_excerpt, suggestion=@suggestion,
           metrics=@metrics, photo_url=@photo_url, generated_by=@generated_by
         WHERE id=@id`,
      ).run({ ...row, id: existing.id });
    } else {
      db.prepare(
        `INSERT INTO lifepages (id, user_id, date, title, summary, achievements, improvements,
           journal_excerpt, suggestion, metrics, photo_url, generated_by)
         VALUES (@id, @user_id, @date, @title, @summary, @achievements, @improvements,
           @journal_excerpt, @suggestion, @metrics, @photo_url, @generated_by)`,
      ).run({ ...row, id: uid(), user_id: req.user.id, date });
    }

    const page = db.prepare('SELECT * FROM lifepages WHERE user_id = ? AND date = ?').get(req.user.id, date);
    res.json({ page: hydrate(page), provider, degradedFrom, providerError: error });
  } catch (err) { next(err); }
});

lifebookRoutes.post('/pages/:date/seal', (req, res) => {
  const page = db.prepare('SELECT * FROM lifepages WHERE user_id = ? AND date = ?').get(req.user.id, req.params.date);
  if (!page) return res.status(404).json({ error: 'Generate the page before sealing it.' });
  if (page.sealed_at) return res.json({ page: hydrate(page) });

  db.prepare("UPDATE lifepages SET sealed_at = datetime('now') WHERE id = ?").run(page.id);
  const awarded = evaluateBadges(req.user.id);
  res.json({ page: hydrate(db.prepare('SELECT * FROM lifepages WHERE id = ?').get(page.id)), awarded });
});

lifebookRoutes.post('/pages/:date/unseal', (req, res) => {
  const page = db.prepare('SELECT * FROM lifepages WHERE user_id = ? AND date = ?').get(req.user.id, req.params.date);
  if (!page) return res.status(404).json({ error: 'No page for that date.' });
  db.prepare('UPDATE lifepages SET sealed_at = NULL WHERE id = ?').run(page.id);
  res.json({ page: hydrate(db.prepare('SELECT * FROM lifepages WHERE id = ?').get(page.id)) });
});

/** Book-level stats for the LifeBook shelf view. */
lifebookRoutes.get('/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) n FROM lifepages WHERE user_id = ?').get(req.user.id).n;
  const sealed = db.prepare('SELECT COUNT(*) n FROM lifepages WHERE user_id = ? AND sealed_at IS NOT NULL').get(req.user.id).n;
  const first = db.prepare('SELECT MIN(date) d FROM lifepages WHERE user_id = ?').get(req.user.id).d;
  const last = db.prepare('SELECT MAX(date) d FROM lifepages WHERE user_id = ?').get(req.user.id).d;
  const byProvider = db
    .prepare('SELECT generated_by, COUNT(*) n FROM lifepages WHERE user_id = ? GROUP BY generated_by')
    .all(req.user.id);

  // A "volume" is 30 pages - the unit the print order defaults to.
  res.json({
    total_pages: total,
    sealed_pages: sealed,
    first_page: first,
    last_page: last,
    volumes: Math.max(1, Math.ceil(total / 30)),
    by_provider: byProvider,
  });
});

// ---------------------------------------------------------- print order --

lifebookRoutes.post('/orders', (req, res) => {
  const { from_date, to_date, format = 'hardcover', cover_title, recipient, address } = req.body || {};
  const from = from_date || daysAgo(29);
  const to = to_date || today();

  const pages = db
    .prepare('SELECT COUNT(*) n FROM lifepages WHERE user_id = ? AND date BETWEEN ? AND ?')
    .get(req.user.id, from, to).n;
  if (pages === 0) return res.status(400).json({ error: 'There are no pages in that date range to bind.' });

  const id = uid();
  db.prepare(
    `INSERT INTO print_orders (id, user_id, from_date, to_date, page_count, format, cover_title, recipient, address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.user.id, from, to, pages, format, cover_title || null, recipient || null, address || null);

  db.prepare("INSERT INTO notifications (id, user_id, kind, title, body, link) VALUES (?, ?, 'order', ?, ?, '/lifebook/order')")
    .run(uid(), req.user.id, 'Print order recorded', `${pages} pages, ${format}. Export the PDF any time from the print view.`);

  res.json({ order: db.prepare('SELECT * FROM print_orders WHERE id = ?').get(id) });
});

lifebookRoutes.get('/orders', (req, res) => {
  res.json({ data: db.prepare('SELECT * FROM print_orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id) });
});
