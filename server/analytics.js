import { db, parseJSON, daysAgo, dateRange, today } from './db.js';

// The single source of truth for "what actually happened". Both the
// deterministic engine and the LLM providers are handed the output of these
// two functions and nothing else, which is what keeps a Claude-written page and
// a built-in page describing the same day rather than two different ones.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function targetsFor(userId) {
  const p = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) || {};
  return {
    deepWorkMinutes: Math.round((p.target_deep_work ?? 4) * 60),
    sleepHours: p.target_sleep ?? 7.5,
    screenTimeHours: p.target_screen_time ?? 2,
  };
}

/** Everything that happened on one date, shaped for page generation. */
export function daySnapshot(userId, date) {
  const sessions = db
    .prepare('SELECT * FROM study_sessions WHERE user_id = ? AND date = ?')
    .all(userId, date);

  const totalMinutes = sessions.reduce((a, s) => a + (s.actual_minutes || 0), 0);
  const rated = sessions.filter((s) => s.focus_rating != null);
  const byTechnique = {};
  for (const s of sessions) byTechnique[s.technique] = (byTechnique[s.technique] || 0) + (s.actual_minutes || 0);

  const tasksDue = db
    .prepare("SELECT * FROM tasks WHERE user_id = ? AND (due_date = ? OR (due_date IS NULL AND date(created_at) = ?))")
    .all(userId, date, date);
  const completedToday = db
    .prepare("SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND date(completed_at) = ?")
    .get(userId, date).n;
  const overdue = db
    .prepare("SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND status != 'done' AND due_date IS NOT NULL AND due_date < ?")
    .get(userId, date).n;

  const wellness = db.prepare('SELECT * FROM wellness_logs WHERE user_id = ? AND date = ?').get(userId, date) || null;
  const moodRow = db
    .prepare('SELECT * FROM moods WHERE user_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1')
    .get(userId, date) || null;

  const journalRow = db.prepare('SELECT * FROM journal_entries WHERE user_id = ? AND date = ?').get(userId, date);
  const journal = journalRow
    ? {
        reflection: journalRow.reflection || null,
        gratitude: parseJSON(journalRow.gratitude, []),
        wins: parseJSON(journalRow.wins, []),
        improvements: parseJSON(journalRow.improvements, []),
      }
    : null;

  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ? AND archived = 0').all(userId);
  const doneToday = db
    .prepare('SELECT COUNT(*) n FROM habit_logs WHERE user_id = ? AND date = ? AND done = 1')
    .get(userId, date).n;

  const checkedIn = db
    .prepare(
      `SELECT COUNT(*) n FROM challenge_progress cp
       JOIN challenge_enrollments ce ON ce.id = cp.enrollment_id
       WHERE cp.user_id = ? AND cp.date = ? AND cp.done = 1`,
    )
    .get(userId, date).n;

  return {
    date,
    weekday: WEEKDAYS[new Date(`${date}T00:00:00`).getDay()],
    study: {
      totalMinutes,
      sessionCount: sessions.length,
      byTechnique,
      subjects: [...new Set(sessions.map((s) => s.subject).filter(Boolean))],
      avgFocus: rated.length ? rated.reduce((a, s) => a + s.focus_rating, 0) / rated.length : null,
      distractions: sessions.reduce((a, s) => a + (s.distractions || 0), 0),
    },
    tasks: {
      planned: tasksDue.length,
      completed: completedToday,
      overdue,
      titles: tasksDue.slice(0, 8).map((t) => ({ title: t.title, status: t.status, priority: t.priority })),
    },
    wellness,
    mood: moodRow ? { score: moodRow.score, note: moodRow.note, triggers: parseJSON(moodRow.triggers, []) } : null,
    journal,
    habits: {
      total: habits.length,
      doneToday,
      bestStreak: habits.reduce((best, h) => Math.max(best, habitStreak(userId, h.id, date)), 0),
    },
    challenges: { checkedIn },
    targets: targetsFor(userId),
  };
}

/** Consecutive days ending at `endDate` where the habit was checked in. */
export function habitStreak(userId, habitId, endDate = today()) {
  const rows = db
    .prepare('SELECT date FROM habit_logs WHERE user_id = ? AND habit_id = ? AND done = 1 AND date <= ? ORDER BY date DESC')
    .all(userId, habitId, endDate);
  const set = new Set(rows.map((r) => r.date));
  let streak = 0;
  const cursor = new Date(`${endDate}T00:00:00`);
  // A habit not yet checked in *today* shouldn't read as a broken streak until
  // the day is over, so start counting from yesterday if today is missing.
  if (!set.has(endDate)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    const local = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (!set.has(local) && !set.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function pearson(pairs) {
  const n = pairs.length;
  if (n < 4) return null;
  const mx = pairs.reduce((a, [x]) => a + x, 0) / n;
  const my = pairs.reduce((a, [, y]) => a + y, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** Aggregates over a window, used by Analytics and the insight engine. */
export function rangeAnalytics(userId, days = 30) {
  const end = today();
  const start = daysAgo(days - 1);
  const prevStart = daysAgo(days * 2 - 1);
  const prevEnd = daysAgo(days);

  const sessions = db
    .prepare('SELECT * FROM study_sessions WHERE user_id = ? AND date BETWEEN ? AND ?')
    .all(userId, start, end);
  const prevMinutes = db
    .prepare('SELECT COALESCE(SUM(actual_minutes),0) m FROM study_sessions WHERE user_id = ? AND date BETWEEN ? AND ?')
    .get(userId, prevStart, prevEnd).m;

  const totalMinutes = sessions.reduce((a, s) => a + (s.actual_minutes || 0), 0);

  // Minutes per weekday, averaged over how many of that weekday fall in range.
  const perWeekday = Array.from({ length: 7 }, () => ({ minutes: 0, count: 0 }));
  for (const d of dateRange(start, end)) perWeekday[new Date(`${d}T00:00:00`).getDay()].count += 1;
  for (const s of sessions) perWeekday[new Date(`${s.date}T00:00:00`).getDay()].minutes += s.actual_minutes || 0;
  const weekdayAvgs = perWeekday.map((w, i) => ({ name: WEEKDAYS[i], minutes: w.count ? w.minutes / w.count : 0 }));
  const sortedWeekdays = [...weekdayAvgs].sort((a, b) => b.minutes - a.minutes);

  const wellnessRows = db
    .prepare('SELECT * FROM wellness_logs WHERE user_id = ? AND date BETWEEN ? AND ?')
    .all(userId, start, end);
  const sleeps = wellnessRows.map((w) => w.sleep_hours).filter((v) => v != null);

  const taskRows = db
    .prepare('SELECT * FROM tasks WHERE user_id = ? AND date(created_at) BETWEEN ? AND ?')
    .all(userId, start, end);
  const doneCount = taskRows.filter((t) => t.status === 'done').length;

  const habitRows = db.prepare('SELECT * FROM habits WHERE user_id = ? AND archived = 0').all(userId);
  const habitStats = habitRows.map((h) => {
    const logged = db
      .prepare('SELECT COUNT(*) n FROM habit_logs WHERE habit_id = ? AND done = 1 AND date BETWEEN ? AND ?')
      .get(h.id, start, end).n;
    return { name: h.name, streak: habitStreak(userId, h.id), adherence: logged / days };
  });
  const sortedHabits = [...habitStats].sort((a, b) => b.adherence - a.adherence);

  const moodRows = db
    .prepare('SELECT * FROM moods WHERE user_id = ? AND date BETWEEN ? AND ?')
    .all(userId, start, end);

  // Correlations use the *previous* night's sleep against the day's focus -
  // sleeping badly tonight cannot affect this morning's session.
  const focusByDate = new Map();
  for (const s of sessions) {
    if (s.focus_rating == null) continue;
    const arr = focusByDate.get(s.date) || [];
    arr.push(s.focus_rating);
    focusByDate.set(s.date, arr);
  }
  const sleepFocusPairs = [];
  const screenFocusPairs = [];
  for (const [date, ratings] of focusByDate) {
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const prevNight = wellnessRows.find((w) => w.date === daysAgo(1, new Date(`${date}T00:00:00`)));
    if (prevNight?.sleep_hours != null) sleepFocusPairs.push([prevNight.sleep_hours, avg]);
    const sameDay = wellnessRows.find((w) => w.date === date);
    if (sameDay?.screen_time_hours != null) screenFocusPairs.push([sameDay.screen_time_hours, avg]);
  }

  return {
    range: { start, end, days },
    study: {
      totalMinutes,
      sessionCount: sessions.length,
      deltaPct: prevMinutes > 0 ? Math.round(((totalMinutes - prevMinutes) / prevMinutes) * 100) : null,
      bestDay: sortedWeekdays[0]?.minutes > 0 ? sortedWeekdays[0] : null,
      worstDay: sortedWeekdays[0]?.minutes > 0 ? sortedWeekdays[sortedWeekdays.length - 1] : null,
      byWeekday: weekdayAvgs,
      bySubject: Object.entries(
        sessions.reduce((acc, s) => {
          if (s.subject) acc[s.subject] = (acc[s.subject] || 0) + (s.actual_minutes || 0);
          return acc;
        }, {}),
      ).map(([subject, minutes]) => ({ subject, minutes })),
    },
    wellness: {
      avgSleep: sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
      avgExercise: wellnessRows.length
        ? wellnessRows.reduce((a, w) => a + (w.exercise_minutes || 0), 0) / wellnessRows.length
        : null,
      avgScreenTime: wellnessRows.filter((w) => w.screen_time_hours != null).length
        ? wellnessRows.reduce((a, w) => a + (w.screen_time_hours || 0), 0) /
          wellnessRows.filter((w) => w.screen_time_hours != null).length
        : null,
      daysLogged: wellnessRows.length,
    },
    tasks: {
      created: taskRows.length,
      completed: doneCount,
      completionRate: taskRows.length ? doneCount / taskRows.length : null,
    },
    habits: { best: sortedHabits[0] || null, weakest: sortedHabits[sortedHabits.length - 1] || null, all: habitStats },
    mood: {
      average: moodRows.length ? moodRows.reduce((a, m) => a + m.score, 0) / moodRows.length : null,
      count: moodRows.length,
      lowDays: moodRows.filter((m) => m.score <= 2).length,
    },
    correlations: {
      sleepFocus: pearson(sleepFocusPairs),
      screenFocus: pearson(screenFocusPairs),
    },
    targets: targetsFor(userId),
  };
}

/** Compact numbers for the coach chat context. */
export function coachContext(userId) {
  const week = rangeAnalytics(userId, 7);
  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ? AND archived = 0').all(userId);
  return {
    study: {
      weekMinutes: week.study.totalMinutes,
      avgFocus: week.study.sessionCount
        ? db
            .prepare(
              'SELECT AVG(focus_rating) a FROM study_sessions WHERE user_id = ? AND date BETWEEN ? AND ? AND focus_rating IS NOT NULL',
            )
            .get(userId, week.range.start, week.range.end).a
        : null,
    },
    tasks: { completionRate: week.tasks.completionRate, completedWeek: week.tasks.completed },
    wellness: { avgSleep: week.wellness.avgSleep },
    habits: { total: habits.length },
    streak: habits.reduce((best, h) => Math.max(best, habitStreak(userId, h.id)), 0),
  };
}

/** 0-100 composite used by the "Health Points" tile, derived from the day's
 *  wellness log against the user's own targets - not an arbitrary score. */
export function healthPoints(userId, date = today()) {
  const w = db.prepare('SELECT * FROM wellness_logs WHERE user_id = ? AND date = ?').get(userId, date);
  if (!w) return 0;
  const t = targetsFor(userId);
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const parts = [
    { weight: 30, value: w.sleep_hours != null ? clamp(w.sleep_hours / t.sleepHours) : 0 },
    { weight: 20, value: clamp((w.exercise_minutes || 0) / 30) },
    { weight: 15, value: clamp((w.water_glasses || 0) / 8) },
    { weight: 15, value: w.screen_time_hours != null ? clamp(2 - w.screen_time_hours / t.screenTimeHours) : 0.5 },
    { weight: 10, value: clamp((w.meditation_minutes || 0) / 10) },
    { weight: 10, value: w.had_breakfast ? 1 : 0 },
  ];
  return Math.round(parts.reduce((a, p) => a + p.weight * p.value, 0));
}
