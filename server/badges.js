/**
 * Badge evaluation. Rules live in the `badges` table; this file knows how to
 * measure each one and awards whatever has crossed its threshold.
 */
import { db, uid } from './db.js';
import { habitStreak } from './analytics.js';

// Badge rules are data, not code: each row in `badges` names a rule and a
// threshold, and this file knows how to measure each rule. Adding a badge is a
// seed row. Evaluation is cheap (a handful of COUNT queries) and runs after any
// write that could plausibly cross a threshold.

const MEASURES = {
  pages_sealed: (userId) =>
    db.prepare('SELECT COUNT(*) n FROM lifepages WHERE user_id = ? AND sealed_at IS NOT NULL').get(userId).n,

  study_minutes_total: (userId) =>
    db.prepare('SELECT COALESCE(SUM(actual_minutes),0) n FROM study_sessions WHERE user_id = ?').get(userId).n,

  habit_streak: (userId) => {
    const habits = db.prepare('SELECT id FROM habits WHERE user_id = ? AND archived = 0').all(userId);
    return habits.reduce((best, h) => Math.max(best, habitStreak(userId, h.id)), 0);
  },

  journal_entries: (userId) =>
    db.prepare('SELECT COUNT(*) n FROM journal_entries WHERE user_id = ?').get(userId).n,

  mood_logs: (userId) => db.prepare('SELECT COUNT(*) n FROM moods WHERE user_id = ?').get(userId).n,

  sleep_target_days: (userId) => {
    const target = db.prepare('SELECT target_sleep FROM profiles WHERE user_id = ?').get(userId)?.target_sleep ?? 7.5;
    return db
      .prepare('SELECT COUNT(*) n FROM wellness_logs WHERE user_id = ? AND sleep_hours >= ?')
      .get(userId, target).n;
  },

  challenges_completed: (userId) =>
    db.prepare('SELECT COUNT(*) n FROM challenge_enrollments WHERE user_id = ? AND completed_at IS NOT NULL').get(userId).n,

  resources_count: (userId) => db.prepare('SELECT COUNT(*) n FROM resources WHERE user_id = ?').get(userId).n,

  quiz_attempts: (userId) => db.prepare('SELECT COUNT(*) n FROM quiz_attempts WHERE user_id = ?').get(userId).n,
};

/**
 * Awards any badge whose threshold the user has newly crossed.
 * Returns the badge rows that were awarded on this call, so the caller can
 * surface them as a toast rather than making the user find the Badges page.
 */
export function evaluateBadges(userId) {
  const all = db.prepare('SELECT * FROM badges').all();
  const owned = new Set(db.prepare('SELECT badge_id FROM user_badges WHERE user_id = ?').all(userId).map((r) => r.badge_id));
  const cache = new Map();
  const awarded = [];

  const insert = db.prepare('INSERT OR IGNORE INTO user_badges (id, user_id, badge_id) VALUES (?, ?, ?)');
  const notify = db.prepare(
    "INSERT INTO notifications (id, user_id, kind, title, body, link) VALUES (?, ?, 'badge', ?, ?, '/badges')",
  );

  for (const badge of all) {
    if (owned.has(badge.id)) continue;
    const measure = MEASURES[badge.rule];
    if (!measure) continue;
    if (!cache.has(badge.rule)) cache.set(badge.rule, measure(userId));
    if (cache.get(badge.rule) >= badge.threshold) {
      insert.run(uid(), userId, badge.id);
      notify.run(uid(), userId, `Badge earned: ${badge.name}`, badge.description);
      awarded.push(badge);
    }
  }
  return awarded;
}

/** Progress toward every badge, for the Badges page. */
export function badgeProgress(userId) {
  const all = db.prepare('SELECT * FROM badges').all();
  const owned = new Map(
    db.prepare('SELECT badge_id, earned_at FROM user_badges WHERE user_id = ?').all(userId).map((r) => [r.badge_id, r.earned_at]),
  );
  const cache = new Map();

  return all.map((badge) => {
    const measure = MEASURES[badge.rule];
    if (!cache.has(badge.rule)) cache.set(badge.rule, measure ? measure(userId) : 0);
    const current = cache.get(badge.rule);
    return {
      ...badge,
      earned_at: owned.get(badge.id) || null,
      current,
      progress: Math.min(1, current / badge.threshold),
    };
  });
}
