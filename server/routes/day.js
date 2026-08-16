import { Router } from 'express';
import { db, uid, today, daysAgo, dateRange, parseJSON } from '../db.js';
import { requireAuth } from '../auth.js';
import { evaluateBadges } from '../badges.js';
import { habitStreak, healthPoints } from '../analytics.js';

export const dayRoutes = Router();
dayRoutes.use(requireAuth);

// ------------------------------------------------------------- wellness --

// Upsert rather than insert: there is exactly one wellness log per day, and the
// Health Booster page saves continuously as fields change.
dayRoutes.put('/wellness/:date', (req, res) => {
  const date = req.params.date;
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM wellness_logs WHERE user_id = ? AND date = ?').get(req.user.id, date);

  const row = {
    sleep_hours: b.sleep_hours ?? existing?.sleep_hours ?? null,
    water_glasses: b.water_glasses ?? existing?.water_glasses ?? 0,
    exercise_minutes: b.exercise_minutes ?? existing?.exercise_minutes ?? 0,
    meditation_minutes: b.meditation_minutes ?? existing?.meditation_minutes ?? 0,
    screen_time_hours: b.screen_time_hours ?? existing?.screen_time_hours ?? null,
    meals: b.meals ?? existing?.meals ?? 0,
    had_breakfast: (b.had_breakfast ?? existing?.had_breakfast ?? 0) ? 1 : 0,
    sunlight_minutes: b.sunlight_minutes ?? existing?.sunlight_minutes ?? 0,
    notes: b.notes ?? existing?.notes ?? null,
  };

  if (existing) {
    db.prepare(
      `UPDATE wellness_logs SET sleep_hours=@sleep_hours, water_glasses=@water_glasses,
         exercise_minutes=@exercise_minutes, meditation_minutes=@meditation_minutes,
         screen_time_hours=@screen_time_hours, meals=@meals, had_breakfast=@had_breakfast,
         sunlight_minutes=@sunlight_minutes, notes=@notes, updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...row, id: existing.id });
  } else {
    db.prepare(
      `INSERT INTO wellness_logs (id, user_id, date, sleep_hours, water_glasses, exercise_minutes,
         meditation_minutes, screen_time_hours, meals, had_breakfast, sunlight_minutes, notes)
       VALUES (@id, @user_id, @date, @sleep_hours, @water_glasses, @exercise_minutes,
         @meditation_minutes, @screen_time_hours, @meals, @had_breakfast, @sunlight_minutes, @notes)`,
    ).run({ ...row, id: uid(), user_id: req.user.id, date });
  }

  const awarded = evaluateBadges(req.user.id);
  res.json({
    log: db.prepare('SELECT * FROM wellness_logs WHERE user_id = ? AND date = ?').get(req.user.id, date),
    health_points: healthPoints(req.user.id, date),
    awarded,
  });
});

dayRoutes.get('/wellness', (req, res) => {
  const from = req.query.from || daysAgo(29);
  const to = req.query.to || today();
  res.json({
    data: db.prepare('SELECT * FROM wellness_logs WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date').all(req.user.id, from, to),
  });
});

// -------------------------------------------------------------- journal --

dayRoutes.put('/journal/:date', (req, res) => {
  const date = req.params.date;
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM journal_entries WHERE user_id = ? AND date = ?').get(req.user.id, date);

  const row = {
    gratitude: JSON.stringify(b.gratitude ?? parseJSON(existing?.gratitude, [])),
    reflection: b.reflection ?? existing?.reflection ?? null,
    wins: JSON.stringify(b.wins ?? parseJSON(existing?.wins, [])),
    improvements: JSON.stringify(b.improvements ?? parseJSON(existing?.improvements, [])),
    photo_url: b.photo_url ?? existing?.photo_url ?? null,
  };

  if (existing) {
    db.prepare(
      `UPDATE journal_entries SET gratitude=@gratitude, reflection=@reflection, wins=@wins,
         improvements=@improvements, photo_url=@photo_url, updated_at=datetime('now') WHERE id=@id`,
    ).run({ ...row, id: existing.id });
  } else {
    db.prepare(
      `INSERT INTO journal_entries (id, user_id, date, gratitude, reflection, wins, improvements, photo_url)
       VALUES (@id, @user_id, @date, @gratitude, @reflection, @wins, @improvements, @photo_url)`,
    ).run({ ...row, id: uid(), user_id: req.user.id, date });
  }

  const awarded = evaluateBadges(req.user.id);
  res.json({ entry: hydrateJournal(db.prepare('SELECT * FROM journal_entries WHERE user_id = ? AND date = ?').get(req.user.id, date)), awarded });
});

dayRoutes.get('/journal/:date', (req, res) => {
  const row = db.prepare('SELECT * FROM journal_entries WHERE user_id = ? AND date = ?').get(req.user.id, req.params.date);
  res.json({ entry: row ? hydrateJournal(row) : null });
});

dayRoutes.get('/journal', (req, res) => {
  const rows = db.prepare('SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC LIMIT 90').all(req.user.id);
  res.json({ data: rows.map(hydrateJournal) });
});

function hydrateJournal(row) {
  if (!row) return null;
  return {
    ...row,
    gratitude: parseJSON(row.gratitude, []),
    wins: parseJSON(row.wins, []),
    improvements: parseJSON(row.improvements, []),
  };
}

// --------------------------------------------------------------- habits --

dayRoutes.get('/habits', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ? AND archived = 0 ORDER BY created_at').all(req.user.id);
  const start = daysAgo(29);
  const end = today();
  const dates = dateRange(start, end);

  res.json({
    data: habits.map((h) => {
      const logs = db
        .prepare('SELECT date, done FROM habit_logs WHERE habit_id = ? AND date BETWEEN ? AND ?')
        .all(h.id, start, end);
      const map = new Map(logs.map((l) => [l.date, !!l.done]));
      return {
        ...h,
        streak: habitStreak(req.user.id, h.id),
        done_today: map.get(end) === true,
        adherence: logs.filter((l) => l.done).length / dates.length,
        // The 30-cell grid the dashboard renders, oldest first.
        history: dates.map((d) => ({ date: d, done: map.get(d) === true })),
      };
    }),
  });
});

dayRoutes.post('/habits/:id/toggle', (req, res) => {
  const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!habit) return res.status(404).json({ error: 'Habit not found.' });

  const date = req.body?.date || today();
  const existing = db.prepare('SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?').get(habit.id, date);

  if (existing) {
    db.prepare('UPDATE habit_logs SET done = ? WHERE id = ?').run(existing.done ? 0 : 1, existing.id);
  } else {
    db.prepare('INSERT INTO habit_logs (id, user_id, habit_id, date, done) VALUES (?, ?, ?, ?, 1)')
      .run(uid(), req.user.id, habit.id, date);
  }

  const awarded = evaluateBadges(req.user.id);
  res.json({ streak: habitStreak(req.user.id, habit.id), done: !existing?.done, awarded });
});

// ----------------------------------------------------------- challenges --

dayRoutes.get('/challenges', (req, res) => {
  // Catalog rows have user_id NULL; a user also sees their own custom ones.
  const rows = db
    .prepare('SELECT * FROM challenges WHERE user_id IS NULL OR user_id = ? ORDER BY category, name')
    .all(req.user.id);

  const enrollments = db.prepare('SELECT * FROM challenge_enrollments WHERE user_id = ?').all(req.user.id);
  const byChallenge = new Map(enrollments.map((e) => [e.challenge_id, e]));

  res.json({
    data: rows.map((c) => {
      const e = byChallenge.get(c.id);
      if (!e) return { ...c, enrolled: false };
      const progress = db.prepare('SELECT COUNT(*) n FROM challenge_progress WHERE enrollment_id = ? AND done = 1').get(e.id).n;
      const checkedInToday = !!db.prepare('SELECT 1 FROM challenge_progress WHERE enrollment_id = ? AND date = ? AND done = 1').get(e.id, today());
      return {
        ...c,
        enrolled: true,
        enrollment_id: e.id,
        started_on: e.started_on,
        completed_at: e.completed_at,
        days_done: progress,
        checked_in_today: checkedInToday,
        progress: Math.min(1, progress / c.duration_days),
      };
    }),
  });
});

dayRoutes.post('/challenges/:id/enroll', (req, res) => {
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ? AND (user_id IS NULL OR user_id = ?)').get(req.params.id, req.user.id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found.' });

  const id = uid();
  db.prepare('INSERT OR IGNORE INTO challenge_enrollments (id, user_id, challenge_id, started_on) VALUES (?, ?, ?, ?)')
    .run(id, req.user.id, challenge.id, today());
  res.json({ enrollment: db.prepare('SELECT * FROM challenge_enrollments WHERE user_id = ? AND challenge_id = ?').get(req.user.id, challenge.id) });
});

dayRoutes.delete('/challenges/:id/enroll', (req, res) => {
  db.prepare('DELETE FROM challenge_enrollments WHERE user_id = ? AND challenge_id = ?').run(req.user.id, req.params.id);
  res.json({ ok: true });
});

dayRoutes.post('/challenges/:id/checkin', (req, res) => {
  const e = db.prepare('SELECT * FROM challenge_enrollments WHERE user_id = ? AND challenge_id = ?').get(req.user.id, req.params.id);
  if (!e) return res.status(400).json({ error: 'Enroll in this challenge first.' });

  const date = req.body?.date || today();
  const existing = db.prepare('SELECT * FROM challenge_progress WHERE enrollment_id = ? AND date = ?').get(e.id, date);
  if (existing) {
    db.prepare('UPDATE challenge_progress SET done = ?, note = ? WHERE id = ?').run(existing.done ? 0 : 1, req.body?.note ?? existing.note, existing.id);
  } else {
    db.prepare('INSERT INTO challenge_progress (id, user_id, enrollment_id, date, done, note) VALUES (?, ?, ?, ?, 1, ?)')
      .run(uid(), req.user.id, e.id, date, req.body?.note || null);
  }

  // Completing the full duration closes the enrollment and unlocks the badge.
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  const done = db.prepare('SELECT COUNT(*) n FROM challenge_progress WHERE enrollment_id = ? AND done = 1').get(e.id).n;
  if (done >= challenge.duration_days && !e.completed_at) {
    db.prepare("UPDATE challenge_enrollments SET completed_at = datetime('now') WHERE id = ?").run(e.id);
    db.prepare("INSERT INTO notifications (id, user_id, kind, title, body, link) VALUES (?, ?, 'challenge', ?, ?, '/challenges')")
      .run(uid(), req.user.id, `Challenge complete: ${challenge.name}`, `You finished all ${challenge.duration_days} days.`);
  }

  const awarded = evaluateBadges(req.user.id);
  res.json({ days_done: done, awarded });
});

/** Cross-account leaderboard: total completed challenge days, this instance. */
dayRoutes.get('/challenges/leaderboard', (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              COUNT(cp.id) AS days,
              (SELECT COUNT(*) FROM challenge_enrollments ce2 WHERE ce2.user_id = u.id AND ce2.completed_at IS NOT NULL) AS completed
       FROM users u
       LEFT JOIN challenge_progress cp ON cp.user_id = u.id AND cp.done = 1
       GROUP BY u.id
       ORDER BY days DESC, completed DESC
       LIMIT 20`,
    )
    .all();
  res.json({ data: rows.map((r, i) => ({ ...r, rank: i + 1, is_you: r.id === req.user.id })) });
});

// ----------------------------------------------------------------- mood --

dayRoutes.post('/moods', (req, res) => {
  const { score, note, triggers, date } = req.body || {};
  if (!Number.isFinite(Number(score))) return res.status(400).json({ error: 'A mood score is required.' });
  const id = uid();
  db.prepare('INSERT INTO moods (id, user_id, date, score, triggers, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, date || today(), Number(score), JSON.stringify(triggers || []), note || null);

  const awarded = evaluateBadges(req.user.id);
  const row = db.prepare('SELECT * FROM moods WHERE id = ?').get(id);
  res.json({ mood: { ...row, triggers: parseJSON(row.triggers, []) }, awarded });
});

dayRoutes.get('/moods', (req, res) => {
  const from = req.query.from || daysAgo(29);
  const to = req.query.to || today();
  const rows = db.prepare('SELECT * FROM moods WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date').all(req.user.id, from, to);
  res.json({ data: rows.map((r) => ({ ...r, triggers: parseJSON(r.triggers, []) })) });
});
