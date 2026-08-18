/**
 * Demo data: one account with a few weeks of life already in it.
 *
 * `npm run dev` on a fresh clone gives you an empty book, which is correct but
 * shows nothing - the reader, the analytics and the correlations all only mean
 * something once there is a run of days behind them. This writes that run.
 *
 * The numbers are not random noise. They carry the pattern the original
 * research found and the product exists to surface: short sleep and heavy
 * screen time drag the next day's focus down, and the days that go well are
 * the ones that were planned the evening before. Seeding pure randomness would
 * produce an insights page that says nothing, which would misrepresent the
 * feature it is meant to demonstrate.
 *
 *   npm run seed:demo            (user: demo / lifebook123)
 *   npm run seed:demo -- --reset (wipe that account first)
 */
import { db, uid, daysAgo } from './db.js';
import { createUser } from './auth.js';
import { evaluateBadges } from './badges.js';
import { daySnapshot, healthPoints } from './analytics.js';
import { generateLifePage } from './ai/index.js';

const USERNAME = 'demo';
const EMAIL = 'demo@lifebook.local';
const PASSWORD = 'lifebook123';
const DAYS = 24;

const SUBJECTS = ['Algorithms', 'Thermodynamics', 'Linear Algebra', 'Operating Systems', 'Statistics'];

const TASKS = [
  ['Finish problem set 4', 'academic', 'important'],
  ['Read chapter 7 before the lecture', 'academic', 'normal'],
  ['Revise last week\'s notes', 'academic', 'normal'],
  ['Gym', 'wellness', 'normal'],
  ['Call home', 'personal', 'normal'],
  ['Draft the group project outline', 'academic', 'urgent'],
  ['Sort out the reading list', 'academic', 'low'],
  ['Practice mock paper', 'academic', 'important'],
  ['Club meeting', 'ECA', 'normal'],
  ['Laundry', 'personal', 'low'],
];

const GRATITUDE = [
  'Roommate made chai without being asked',
  'The library had a free window seat',
  'Got through the whole problem set without opening Instagram',
  'Weather was good enough to walk back',
  'A friend explained recursion properly at last',
  'Slept without the alarm waking me first',
];

const REFLECTIONS = [
  'Started late again because I checked my phone in bed. The morning is gone by the time I sit down.',
  'Two clean deep blocks. Putting the phone in the other room is the only thing that has ever worked.',
  'Felt behind all day, but looking at what I actually finished it was not a bad day at all.',
  'Kept switching subjects every twenty minutes and finished none of them properly.',
  'Planned tomorrow before bed for once. Curious whether it helps.',
  'Tired. Did the minimum and stopped rather than pretending to study with a screen open.',
];

/** Deterministic pseudo-random, so a reseed produces the same demo book. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const round1 = (n) => Math.round(n * 10) / 10;

function wipe(userId) {
  const tables = [
    'tasks', 'study_sessions', 'resources', 'decks', 'flashcards', 'mind_maps',
    'quizzes', 'quiz_attempts', 'habits', 'habit_logs', 'challenge_enrollments',
    'challenge_progress', 'wellness_logs', 'moods', 'journal_entries', 'lifepages',
    'print_orders', 'saved_posts', 'saved_motivation', 'goal_visions', 'user_badges',
    'sos_contacts', 'notifications', 'profiles', 'settings',
  ];
  for (const t of tables) {
    try { db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId); } catch { /* table may not carry user_id */ }
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

async function main() {
  const reset = process.argv.includes('--reset');
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(USERNAME);

  if (existing && !reset) {
    console.log(`User "${USERNAME}" already exists. Re-run with --reset to rebuild it.`);
    process.exit(0);
  }
  if (existing) wipe(existing.id);

  const user = createUser({
    email: EMAIL, username: USERNAME, password: PASSWORD, display_name: 'Demo Student',
  });
  const userId = user.id;
  const r = rng(20241204); // the date the original project was submitted

  db.prepare(
    `UPDATE profiles SET persona=?, academic_goal=?, personal_goal=?, chronotype=?,
       target_deep_work=?, target_sleep=?, target_screen_time=?, institution=?,
       onboarded_at=? WHERE user_id=?`,
  ).run(
    'exam_strategist',
    'Clear the semester with a 9+ GPA without living in the library',
    'Sleep before 1am and move every day',
    'early_bird',
    4, 7.5, 2,
    'IIIT Delhi',
    `${daysAgo(DAYS - 1)}T09:00:00`,
    userId,
  );
  db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(
    'Third year. Rebuilding my study habits one page at a time.', userId,
  );

  // ---- habits ----------------------------------------------------------
  const habits = [
    ['Deep work before noon', 'Sunrise'],
    ['Phone out of the room while studying', 'PhoneOff'],
    ['Move for 20 minutes', 'Activity'],
    ['Plan tomorrow before bed', 'CalendarCheck'],
  ].map(([name, icon]) => {
    const id = uid();
    db.prepare('INSERT INTO habits (id, user_id, name, icon, target_days) VALUES (?,?,?,?,30)')
      .run(id, userId, name, icon);
    return { id, name };
  });

  // ---- a challenge from the seeded catalog -----------------------------
  const challenge = db.prepare('SELECT * FROM challenges WHERE user_id IS NULL ORDER BY name LIMIT 1').get();
  let enrollmentId = null;
  if (challenge) {
    enrollmentId = uid();
    db.prepare('INSERT INTO challenge_enrollments (id, user_id, challenge_id, started_on) VALUES (?,?,?,?)')
      .run(enrollmentId, userId, challenge.id, daysAgo(DAYS - 1));
  }

  // ---- the run of days -------------------------------------------------
  // `momentum` carries yesterday into today: it rises after a good day and
  // decays after a bad one, which is what turns a list of days into a story
  // with streaks and slumps rather than uniform noise.
  let momentum = 0.45;

  for (let d = DAYS - 1; d >= 0; d--) {
    const date = daysAgo(d);
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const weekend = weekday === 0 || weekday === 6;

    // A slump in the middle of the run, and an exam push at the end. Both are
    // there so the analytics page has something true to report.
    const phase = d > 16 ? 'settling' : d > 9 ? 'slump' : 'push';
    const base = phase === 'slump' ? 0.32 : phase === 'push' ? 0.78 : 0.55;
    const quality = Math.max(0.1, Math.min(1, base * 0.6 + momentum * 0.4 + (r() - 0.5) * 0.25));

    // Sleep and screen time are the levers; focus follows them the next day.
    const sleep = round1(5.4 + quality * 3.0 + (weekend ? 0.6 : 0));
    const screen = round1(7.5 - quality * 4.2 + (weekend ? 1.4 : 0));

    db.prepare(
      `INSERT INTO wellness_logs
         (id,user_id,date,sleep_hours,water_glasses,exercise_minutes,meditation_minutes,
          screen_time_hours,meals,had_breakfast,sunlight_minutes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      uid(), userId, date, sleep,
      Math.round(3 + quality * 6),
      quality > 0.5 ? Math.round(15 + quality * 40) : (r() > 0.7 ? 15 : 0),
      quality > 0.65 ? 10 : 0,
      screen,
      Math.round(2 + quality * 1.4),
      quality > 0.45 ? 1 : 0,
      Math.round(quality * 45),
    );

    // Study blocks. Focus rating is derived from sleep and screen time rather
    // than drawn independently, so the correlation the insight engine reports
    // is actually present in the data instead of being asserted.
    const blocks = quality > 0.7 ? 3 : quality > 0.4 ? 2 : r() > 0.5 ? 1 : 0;
    for (let b = 0; b < blocks; b++) {
      const deep = quality > 0.6 && b === 0;
      const planned = deep ? 50 : 25;
      const actual = Math.round(planned * (0.6 + quality * 0.4));
      const focus = Math.max(1, Math.min(5, Math.round(1.4 + (sleep / 8) * 2.1 + (1 - screen / 10) * 1.6)));
      const hour = 9 + b * 3;
      db.prepare(
        `INSERT INTO study_sessions
           (id,user_id,date,subject,technique,planned_minutes,actual_minutes,focus_rating,
            distractions,started_at,ended_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        uid(), userId, date, pick(r, SUBJECTS),
        deep ? 'deep_work' : pick(r, ['pomodoro', 'active_recall', 'spaced_repetition']),
        planned, actual, focus,
        Math.round((1 - quality) * 6),
        `${date}T${String(hour).padStart(2, '0')}:00:00`,
        `${date}T${String(hour).padStart(2, '0')}:${String(Math.min(59, actual)).padStart(2, '0')}:00`,
      );
    }

    // Tasks: planned in the morning, some of them closed by evening.
    const planned = weekend ? 2 : 3 + Math.round(r() * 2);
    for (let i = 0; i < planned; i++) {
      const [title, category, priority] = pick(r, TASKS);
      const done = r() < quality;
      db.prepare(
        `INSERT INTO tasks (id,user_id,title,status,priority,category,due_date,sort_order,completed_at,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        uid(), userId, title,
        done ? 'done' : d === 0 ? 'todo' : r() > 0.6 ? 'ongoing' : 'todo',
        priority, category, date, i,
        done ? `${date}T20:00:00` : null,
        `${date}T08:00:00`,
      );
    }

    for (const h of habits) {
      if (r() < quality * 0.95) {
        db.prepare('INSERT OR IGNORE INTO habit_logs (id,user_id,habit_id,date,done) VALUES (?,?,?,?,1)')
          .run(uid(), userId, h.id, date);
      }
    }

    if (enrollmentId && r() < quality) {
      db.prepare('INSERT OR IGNORE INTO challenge_progress (id,user_id,enrollment_id,date,done) VALUES (?,?,?,?,1)')
        .run(uid(), userId, enrollmentId, date);
    }

    db.prepare('INSERT INTO moods (id,user_id,date,score,triggers,note) VALUES (?,?,?,?,?,?)').run(
      uid(), userId, date,
      Math.max(1, Math.min(5, Math.round(1.6 + quality * 3.2))),
      JSON.stringify(quality > 0.6 ? ['progress'] : quality > 0.35 ? ['workload'] : ['sleep', 'workload']),
      null,
    );

    // Not every day gets a journal entry - pretending otherwise would make the
    // "you have journalled 24 days running" badge a lie.
    if (r() < 0.75) {
      db.prepare(
        `INSERT INTO journal_entries (id,user_id,date,gratitude,reflection,wins,improvements)
         VALUES (?,?,?,?,?,?,?)`,
      ).run(
        uid(), userId, date,
        JSON.stringify([pick(r, GRATITUDE)]),
        pick(r, REFLECTIONS),
        JSON.stringify(quality > 0.5 ? ['Started on time', 'Closed the loop on the problem set'] : ['Showed up']),
        JSON.stringify(quality < 0.5 ? ['Phone before bed', 'No plan for the morning'] : ['Take a real break between blocks']),
      );
    }

    momentum = momentum * 0.55 + quality * 0.45;
  }

  // ---- a resource, so the study screen is not empty --------------------
  db.prepare(
    `INSERT INTO resources (id,user_id,name,category,subject,text_content,starred)
     VALUES (?,?,?,?,?,?,1)`,
  ).run(
    uid(), userId, 'Spaced repetition - lecture notes', 'Notes', 'Algorithms',
    'Spaced repetition schedules reviews at increasing intervals. The SM-2 algorithm ' +
    'adjusts an ease factor per card based on how well it was recalled, so cards you ' +
    'find hard come back sooner and cards you know drift further apart. Reviewing at ' +
    'the edge of forgetting is what produces durable recall; rereading does not.',
  );

  // ---- the book --------------------------------------------------------
  // Generated through the same path the app uses, so the demo pages are real
  // output of the engine rather than prose written here. Everything but today
  // is sealed, matching what happens once a day is closed.
  let pageCount = 0;
  for (let d = DAYS - 1; d >= 0; d--) {
    const date = daysAgo(d);
    const snapshot = daySnapshot(userId, date);
    const { result, provider } = await generateLifePage(userId, snapshot);
    db.prepare(
      `INSERT INTO lifepages
         (id,user_id,date,title,summary,achievements,improvements,journal_excerpt,
          suggestion,metrics,generated_by,sealed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      uid(), userId, date, result.title || null, result.summary || null,
      JSON.stringify(result.achievements || []),
      JSON.stringify(result.improvements || []),
      result.journal_excerpt || null,
      result.suggestion || null,
      JSON.stringify({
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
        health_points: healthPoints(userId, date),
      }),
      provider,
      d === 0 ? null : `${date}T23:30:00`,
    );
    pageCount++;
  }

  const awarded = evaluateBadges(userId);

  console.log(`Seeded "${USERNAME}" (password: ${PASSWORD})`);
  console.log(`  ${DAYS} days, ${pageCount} LifePages, ${awarded.length} badges awarded`);
  console.log('  Sign in at http://localhost:8082/auth');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
