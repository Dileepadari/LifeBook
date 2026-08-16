import { Router } from 'express';
import { db, uid, today, daysAgo, parseJSON, dateRange } from '../db.js';
import { requireAuth } from '../auth.js';
import { rangeAnalytics, coachContext, healthPoints, habitStreak } from '../analytics.js';
import { badgeProgress } from '../badges.js';
import * as ai from '../ai/index.js';

export const insightRoutes = Router();
insightRoutes.use(requireAuth);

// -------------------------------------------------------------- dashboard --

/** Everything the Dashboard needs, in one round trip. The four stat tiles all
 *  carry a real previous-period comparison rather than a decorative delta. */
insightRoutes.get('/dashboard', (req, res) => {
  const userId = req.user.id;
  const end = today();
  const start = daysAgo(29);
  const prevStart = daysAgo(59);
  const prevEnd = daysAgo(30);

  const count = (sql, ...args) => db.prepare(sql).get(userId, ...args).n;

  const tasksDone = count("SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND status = 'done' AND date(completed_at) BETWEEN ? AND ?", start, end);
  const tasksTotal = count('SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND date(created_at) BETWEEN ? AND ?', start, end);
  const tasksPrev = count("SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND status = 'done' AND date(completed_at) BETWEEN ? AND ?", prevStart, prevEnd);

  const challengeDays = count('SELECT COUNT(*) n FROM challenge_progress WHERE user_id = ? AND done = 1 AND date BETWEEN ? AND ?', start, end);
  const challengeTarget = db
    .prepare(
      `SELECT COALESCE(SUM(c.duration_days),0) n FROM challenge_enrollments ce
       JOIN challenges c ON c.id = ce.challenge_id WHERE ce.user_id = ?`,
    )
    .get(userId).n;
  const challengePrev = count('SELECT COUNT(*) n FROM challenge_progress WHERE user_id = ? AND done = 1 AND date BETWEEN ? AND ?', prevStart, prevEnd);

  const resourcesTotal = count('SELECT COUNT(*) n FROM resources WHERE user_id = ?');
  const resourcesPrev = count('SELECT COUNT(*) n FROM resources WHERE user_id = ? AND date(created_at) < ?', start);

  const hp = healthPoints(userId, end);
  const hpPrev = healthPoints(userId, daysAgo(1));

  const delta = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

  // Last 7 days of focus minutes, for the progress chart.
  const week = dateRange(daysAgo(6), end).map((date) => ({
    date,
    minutes: db.prepare('SELECT COALESCE(SUM(actual_minutes),0) n FROM study_sessions WHERE user_id = ? AND date = ?').get(userId, date).n,
    tasks: db.prepare("SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND date(completed_at) = ?").get(userId, date).n,
    health: healthPoints(userId, date),
  }));

  const todaysTasks = db
    .prepare(
      `SELECT * FROM tasks WHERE user_id = ? AND status != 'done'
         AND (due_date IS NULL OR due_date <= ?)
       ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                sort_order ASC LIMIT 8`,
    )
    .all(userId, end);

  const previousPage = db
    .prepare('SELECT * FROM lifepages WHERE user_id = ? AND date < ? ORDER BY date DESC LIMIT 1')
    .get(userId, end);

  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ? AND archived = 0').all(userId);

  res.json({
    tiles: {
      health_points: { value: hp, max: 100, delta: delta(hp, hpPrev), label: 'Health Points' },
      tasks: { value: tasksDone, max: tasksTotal, delta: delta(tasksDone, tasksPrev), label: 'Tasks Completed' },
      challenges: { value: challengeDays, max: challengeTarget, delta: delta(challengeDays, challengePrev), label: 'Challenge Days' },
      resources: { value: resourcesTotal, max: null, delta: delta(resourcesTotal, resourcesPrev), label: 'Resources' },
    },
    week,
    todays_tasks: todaysTasks,
    previous_page: previousPage
      ? { ...previousPage, achievements: parseJSON(previousPage.achievements, []), improvements: parseJSON(previousPage.improvements, []), metrics: parseJSON(previousPage.metrics, {}) }
      : null,
    today_page_exists: !!db.prepare('SELECT 1 FROM lifepages WHERE user_id = ? AND date = ?').get(userId, end),
    habits: habits.map((h) => ({
      ...h,
      streak: habitStreak(userId, h.id),
      done_today: !!db.prepare('SELECT 1 FROM habit_logs WHERE habit_id = ? AND date = ? AND done = 1').get(h.id, end),
      history: dateRange(daysAgo(29), end).map((d) => ({
        date: d,
        done: !!db.prepare('SELECT 1 FROM habit_logs WHERE habit_id = ? AND date = ? AND done = 1').get(h.id, d),
      })),
    })),
    due_cards: db.prepare('SELECT COUNT(*) n FROM flashcards WHERE user_id = ? AND due_date <= ?').get(userId, end).n,
  });
});

// -------------------------------------------------------------- analytics --

insightRoutes.get('/analytics', (req, res) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const analytics = rangeAnalytics(req.user.id, days);

  const daily = dateRange(analytics.range.start, analytics.range.end).map((date) => ({
    date,
    minutes: db.prepare('SELECT COALESCE(SUM(actual_minutes),0) n FROM study_sessions WHERE user_id = ? AND date = ?').get(req.user.id, date).n,
    focus: db.prepare('SELECT AVG(focus_rating) a FROM study_sessions WHERE user_id = ? AND date = ? AND focus_rating IS NOT NULL').get(req.user.id, date).a,
    sleep: db.prepare('SELECT sleep_hours s FROM wellness_logs WHERE user_id = ? AND date = ?').get(req.user.id, date)?.s ?? null,
    mood: db.prepare('SELECT AVG(score) a FROM moods WHERE user_id = ? AND date = ?').get(req.user.id, date).a,
    tasks: db.prepare("SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND date(completed_at) = ?").get(req.user.id, date).n,
  }));

  res.json({ analytics, daily });
});

insightRoutes.post('/insights', async (req, res, next) => {
  try {
    const days = Math.min(365, Math.max(7, Number(req.body?.days) || 30));
    const analytics = rangeAnalytics(req.user.id, days);
    const { result, provider, degradedFrom, error } = await ai.generateInsights(req.user.id, analytics);
    res.json({ ...result, provider, degradedFrom, providerError: error });
  } catch (err) { next(err); }
});

insightRoutes.post('/coach', async (req, res, next) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Ask me something.' });
    const context = coachContext(req.user.id);
    const { result, provider, degradedFrom, error } = await ai.coachChat(req.user.id, message, context);
    res.json({ reply: result, provider, degradedFrom, providerError: error });
  } catch (err) { next(err); }
});

insightRoutes.post('/ai/test', async (req, res) => {
  try {
    res.json(await ai.testConnection(req.user.id, req.body));
  } catch (err) {
    // A failed connection test is a normal answer, not a server error - the
    // whole point is to show the user what went wrong with their key.
    res.json({ ok: false, detail: humanizeProviderError(err) });
  }
});

insightRoutes.post('/ai/models', async (req, res) => {
  try {
    res.json(await ai.listModels(req.user.id, req.body));
  } catch (err) {
    // Same reasoning as /ai/test: not being able to list is an answer.
    res.json({ models: [], error: humanizeProviderError(err) });
  }
});

/**
 * Provider SDKs put the whole JSON error body in `message`, which is accurate
 * and unreadable. Map the handful of cases a user can actually act on to plain
 * sentences, and fall back to the raw text for anything unrecognised rather
 * than swallowing information.
 */
function humanizeProviderError(err) {
  const raw = String(err?.message || 'Something went wrong.');
  const status = err?.status ?? Number(raw.match(/^(\d{3})\b/)?.[1]);

  if (status === 401 || /authentication_error|API key (is )?not valid|API key is invalid|API_KEY_INVALID/i.test(raw)) {
    return 'That key was rejected. Check you copied it in full, and that it is for the provider you selected.';
  }
  if (status === 403 || /permission|PERMISSION_DENIED/i.test(raw)) {
    return 'That key is valid but not allowed to use this model. Check the model name and the key\'s permissions.';
  }
  if (status === 404 || /not_found|NOT_FOUND|model.*not found/i.test(raw)) {
    return 'That model name was not found. Clear the Model field to use the provider default.';
  }
  if (status === 429 || /rate_limit|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return 'Rate limited or out of quota on that account. The built-in engine keeps working in the meantime.';
  }
  if (status >= 500 || /overloaded|UNAVAILABLE/i.test(raw)) {
    return 'The provider is having problems right now. The built-in engine keeps working in the meantime.';
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(raw)) {
    return 'Could not reach the provider - check the server\'s internet connection.';
  }
  return raw.length > 200 ? `${raw.slice(0, 197)}...` : raw;
}

insightRoutes.get('/ai/status', (req, res) => {
  const provider = ai.resolveProvider(req.user.id);
  res.json({
    provider: provider.name,
    reason: provider.reason || null,
    model: provider.model || ai.DEFAULT_MODELS[provider.name] || null,
    defaults: ai.DEFAULT_MODELS,
    env_keys: { anthropic: !!process.env.ANTHROPIC_API_KEY, gemini: !!process.env.GEMINI_API_KEY },
  });
});

// ------------------------------------------------------------- badges --

insightRoutes.get('/badges', (req, res) => {
  res.json({ data: badgeProgress(req.user.id) });
});

// --------------------------------------------------- feed & motivation --

insightRoutes.get('/feed', (req, res) => {
  const saved = new Set(db.prepare('SELECT post_id FROM saved_posts WHERE user_id = ?').all(req.user.id).map((r) => r.post_id));
  const rows = db.prepare('SELECT * FROM feed_posts ORDER BY created_at DESC LIMIT 100').all();
  res.json({ data: rows.map((p) => ({ ...p, saved: saved.has(p.id) })) });
});

insightRoutes.post('/feed/:id/save', (req, res) => {
  const existing = db.prepare('SELECT * FROM saved_posts WHERE user_id = ? AND post_id = ?').get(req.user.id, req.params.id);
  if (existing) {
    db.prepare('DELETE FROM saved_posts WHERE id = ?').run(existing.id);
    return res.json({ saved: false });
  }
  db.prepare('INSERT INTO saved_posts (id, user_id, post_id) VALUES (?, ?, ?)').run(uid(), req.user.id, req.params.id);
  res.json({ saved: true });
});

insightRoutes.post('/feed', (req, res) => {
  const { title, body, kind = 'blog', tags } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'A title and body are required.' });
  const id = uid();
  db.prepare('INSERT INTO feed_posts (id, author_id, author_name, kind, title, body, tags) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, req.user.display_name, kind, title, body, tags || null);
  res.json({ post: db.prepare('SELECT * FROM feed_posts WHERE id = ?').get(id) });
});

insightRoutes.get('/motivation', (req, res) => {
  const saved = new Set(db.prepare('SELECT item_id FROM saved_motivation WHERE user_id = ?').all(req.user.id).map((r) => r.item_id));
  const items = db.prepare('SELECT * FROM motivation_items').all();

  // Quote of the day is deterministic per date, so it does not reshuffle on
  // every render but does change at midnight.
  const quotes = items.filter((i) => i.kind === 'quote');
  const seed = [...today()].reduce((a, c) => a + c.charCodeAt(0), 0);

  res.json({
    quote_of_the_day: quotes.length ? quotes[seed % quotes.length] : null,
    data: items.map((i) => ({ ...i, saved: saved.has(i.id) })),
    visions: db.prepare('SELECT * FROM goal_visions WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id),
  });
});

insightRoutes.post('/motivation/:id/save', (req, res) => {
  const existing = db.prepare('SELECT * FROM saved_motivation WHERE user_id = ? AND item_id = ?').get(req.user.id, req.params.id);
  if (existing) {
    db.prepare('DELETE FROM saved_motivation WHERE id = ?').run(existing.id);
    return res.json({ saved: false });
  }
  db.prepare('INSERT INTO saved_motivation (id, user_id, item_id) VALUES (?, ?, ?)').run(uid(), req.user.id, req.params.id);
  res.json({ saved: true });
});

// ------------------------------------------------- support & notifications --

insightRoutes.get('/support', (req, res) => {
  res.json({
    resources: db.prepare('SELECT * FROM support_resources ORDER BY sort_order').all(),
    contacts: db.prepare('SELECT * FROM sos_contacts WHERE user_id = ? ORDER BY sort_order').all(req.user.id),
  });
});

insightRoutes.get('/notifications', (req, res) => {
  res.json({ data: db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id) });
});

insightRoutes.post('/notifications/read', (req, res) => {
  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(req.user.id);
  res.json({ ok: true });
});
