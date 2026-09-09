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
  ['Rewrite the lab report conclusion', 'academic', 'important'],
  ['Evening run, easy pace', 'wellness', 'normal'],
  ['Reply to the internship email', 'personal', 'urgent'],
  ['Solve two past-paper questions', 'academic', 'normal'],
  ['Volunteer session at the coding club', 'ECA', 'normal'],
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

  const openTitles = new Set();
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
    // Sampled without replacement so a single day never lists the same task twice.
    // Titles still open from an earlier day are skipped too, so the backlog
    // reads as distinct work rather than one line repeated down the list.
    const available = TASKS.filter(([t]) => !openTitles.has(t)).sort(() => r() - 0.5);
    const dayTasks = available.slice(0, planned);
    for (let i = 0; i < dayTasks.length; i++) {
      const [title, category, priority] = dayTasks[i];
      // Older days close out almost everything: a real backlog is the last few
      // days of loose ends, not a month of them.
      const done = d > 4 ? r() < 0.93 : r() < quality;
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
      if (done) openTitles.delete(title); else openTitles.add(title);
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

  // ---- the study library ------------------------------------------------
  // Enough material for every study surface to have something real in it: a
  // shelf of resources, two decks whose cards sit at different points in the
  // SM-2 schedule, a quiz with a couple of attempts behind it, and one mind map.
  const RESOURCES = [
    ['Spaced repetition - lecture notes', 'Notes', 'Algorithms', 1,
      'Spaced repetition schedules reviews at increasing intervals. The SM-2 algorithm ' +
      'adjusts an ease factor per card based on how well it was recalled, so cards you ' +
      'find hard come back sooner and cards you know drift further apart. Reviewing at ' +
      'the edge of forgetting is what produces durable recall; rereading does not.'],
    ['Dynamic programming - worked examples', 'Notes', 'Algorithms', 0,
      'A problem is a candidate for dynamic programming when it has optimal substructure ' +
      'and overlapping subproblems. Memoisation solves it top down and caches results; ' +
      'tabulation fills the table bottom up. Knapsack, edit distance and longest common ' +
      'subsequence are the three shapes most exam questions reduce to.'],
    ['Thermodynamics - first and second law', 'Slides', 'Thermodynamics', 1,
      'The first law is conservation of energy for a closed system: the change in internal ' +
      'energy equals heat added minus work done. The second law says entropy of an isolated ' +
      'system never decreases, which is what makes a process irreversible and puts a ceiling ' +
      'on the efficiency of any heat engine.'],
    ['Linear algebra - eigenvalues cheat sheet', 'Reference', 'Linear Algebra', 0,
      'An eigenvector of a matrix is a direction the matrix only stretches, and its eigenvalue ' +
      'is the stretch factor. Solve det(A - lambda I) = 0 for the eigenvalues, then the null ' +
      'space of (A - lambda I) for each eigenvector. A symmetric matrix always has real ' +
      'eigenvalues and an orthogonal eigenbasis.'],
    ['Operating systems - scheduling past paper', 'Past paper', 'Operating Systems', 0,
      'Round robin bounds response time but not turnaround. Shortest job first is optimal for ' +
      'average waiting time and impossible to run exactly, because it needs the burst length ' +
      'in advance. Multilevel feedback queues approximate it by demoting whatever keeps using ' +
      'its whole slice.'],
  ];
  const resourceIds = RESOURCES.map(([name, category, subject, starred, text], i) => {
    const id = uid();
    const added = `${daysAgo(DAYS - 2 - i * 3)}T18:00:00`;
    db.prepare(
      `INSERT INTO resources (id,user_id,name,category,subject,text_content,starred,size_bytes,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(id, userId, name, category, subject, text, starred, Buffer.byteLength(text), added, added);
    return id;
  });

  const DECKS = [
    ['Algorithms - recurrences and DP', 'Algorithms', 1, [
      ['What does the master theorem solve?', 'Recurrences of the form T(n) = aT(n/b) + f(n), by comparing f(n) against n^(log_b a).'],
      ['When is a problem suited to dynamic programming?', 'When it has optimal substructure and overlapping subproblems.'],
      ['Memoisation vs tabulation', 'Memoisation is top down and recursive with a cache; tabulation is bottom up and iterative over the table.'],
      ['Time complexity of 0/1 knapsack, DP table', 'O(nW): one row per item, one column per capacity unit.'],
      ['Why is greedy wrong for 0/1 knapsack?', 'Taking the best ratio first can block a combination that fills the capacity better; there is no exchange argument.'],
      ['Edit distance base cases', 'Transforming an empty string costs the length of the other string, so row 0 and column 0 count up from zero.'],
      ['What makes binary search O(log n)?', 'Each comparison discards half the remaining interval, so the size falls geometrically.'],
      ['Amortised cost of dynamic array push', 'O(1): the doubling copies total less than 2n work across n pushes.'],
    ]],
    ['Thermodynamics - laws and cycles', 'Thermodynamics', 3, [
      ['State the first law of thermodynamics', 'dU = Q - W: the internal energy change equals heat added to the system minus work done by it.'],
      ['State the second law in one line', 'The entropy of an isolated system never decreases.'],
      ['What is an isentropic process?', 'Adiabatic and reversible: no heat crosses the boundary and entropy stays constant.'],
      ['Carnot efficiency', '1 - Tc/Th, with both temperatures absolute. No heat engine between the same reservoirs beats it.'],
      ['Difference between heat and work', 'Both are energy in transit; heat crosses a boundary because of a temperature difference, work because of a force through a distance.'],
      ['Why is a real engine below Carnot efficiency?', 'Friction, finite temperature differences and unrestrained expansion all generate entropy, and every bit of it costs work.'],
      ['What does enthalpy measure?', 'H = U + pV, the energy accounted for at constant pressure, which is why it is the natural variable for flow processes.'],
      ['Meaning of a positive Gibbs free energy change', 'The process does not run spontaneously at that temperature and pressure.'],
    ]],
  ];
  for (const [deckName, subject, resourceIndex, cards] of DECKS) {
    const deckId = uid();
    db.prepare(
      'INSERT INTO decks (id,user_id,name,subject,resource_id,source,created_at) VALUES (?,?,?,?,?,?,?)',
    ).run(deckId, userId, deckName, subject, resourceIds[resourceIndex], 'ai', `${daysAgo(DAYS - 2)}T19:00:00`);

    cards.forEach(([front, back], i) => {
      // A third of every deck falls due today; the rest are spread across the
      // schedule the way a deck in use actually looks.
      const seen = i % 3 !== 0;
      const reps = seen ? 1 + Math.floor(r() * 4) : 0;
      const interval = seen ? [1, 3, 6, 12, 21][Math.min(reps, 4)] : 0;
      const dueIn = i % 3 === 0 ? 0 : Math.max(1, Math.round(interval * (0.4 + r() * 0.8)));
      db.prepare(
        `INSERT INTO flashcards
           (id,user_id,deck_id,front,back,ease,interval_days,repetitions,due_date,last_reviewed,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        uid(), userId, deckId, front, back,
        Number((2.2 + r() * 0.5).toFixed(2)), interval, reps,
        dueIn === 0 ? daysAgo(0) : daysAgo(-dueIn),
        seen ? daysAgo(Math.min(DAYS - 1, interval)) : null,
        `${daysAgo(DAYS - 2)}T19:00:00`,
      );
    });
  }

  const quizId = uid();
  db.prepare(
    `INSERT INTO quizzes (id,user_id,title,subject,resource_id,time_limit_minutes,generated_by,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    quizId, userId, 'Dynamic programming - quick check', 'Algorithms',
    resourceIds[1], 10, 'builtin', `${daysAgo(6)}T18:00:00`,
  );
  const QUESTIONS = [
    ['Which pair of properties makes a problem suitable for dynamic programming?',
      ['Optimal substructure and overlapping subproblems', 'Greedy choice and a sorted input',
       'Divide and conquer and a balanced tree', 'Linearity and a fixed alphabet'], 0,
      'Without overlapping subproblems there is nothing to cache, and without optimal substructure the cached answers cannot be combined.'],
    ['What is the time complexity of the standard 0/1 knapsack table?',
      ['O(n log W)', 'O(nW)', 'O(n^2)', 'O(2^n)'], 1,
      'One row per item and one column per unit of capacity, filled in constant time each.'],
    ['Memoisation differs from tabulation in that it is',
      ['bottom up and iterative', 'top down and recursive', 'always faster', 'only valid for trees'], 1,
      'Memoisation keeps the recursion and caches its results; tabulation replaces the recursion with a loop over the table.'],
    ['The base case row of an edit distance table holds',
      ['zeros', 'the counting numbers 0, 1, 2, ...', 'the input string', 'the alphabet size'], 1,
      'Turning a prefix into an empty string costs one deletion per character.'],
    ['Longest common subsequence between strings of length m and n costs',
      ['O(m + n)', 'O(mn)', 'O(mn log n)', 'O(m^2 n^2)'], 1,
      'Every cell of the m by n table is filled once from three neighbours.'],
    ['Greedy fails on 0/1 knapsack because',
      ['the weights are not integers', 'sorting is too slow',
       'the best ratio item can block a better combination', 'the capacity is unbounded'], 2,
      'The exchange argument that justifies a greedy choice does not hold once an item cannot be split.'],
  ];
  QUESTIONS.forEach(([prompt, options, answerIndex, explanation], i) => {
    db.prepare(
      'INSERT INTO quiz_questions (id,quiz_id,prompt,options,answer_index,explanation,sort_order) VALUES (?,?,?,?,?,?,?)',
    ).run(uid(), quizId, prompt, JSON.stringify(options), answerIndex, explanation, i);
  });
  for (const [ago, score] of [[6, 4], [2, 5]]) {
    db.prepare(
      'INSERT INTO quiz_attempts (id,user_id,quiz_id,date,score,total,seconds_taken,responses,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    ).run(
      uid(), userId, quizId, daysAgo(ago), score, QUESTIONS.length,
      240 + Math.round(r() * 180),
      JSON.stringify(QUESTIONS.map((q, i) => (i < score ? q[2] : (q[2] + 1) % 4))),
      `${daysAgo(ago)}T18:30:00`,
    );
  }

  db.prepare(
    'INSERT INTO mind_maps (id,user_id,title,resource_id,data,generated_by,created_at) VALUES (?,?,?,?,?,?,?)',
  ).run(
    uid(), userId, 'Thermodynamics - the two laws', resourceIds[2],
    JSON.stringify({
      root: 'Thermodynamics',
      children: [
        { label: 'First law', children: [
          { label: 'dU = Q - W', children: [] },
          { label: 'Energy is conserved', children: [] },
          { label: 'Enthalpy H = U + pV', children: [] },
        ] },
        { label: 'Second law', children: [
          { label: 'Entropy never decreases', children: [] },
          { label: 'Irreversibility', children: [] },
          { label: 'Carnot ceiling 1 - Tc/Th', children: [] },
        ] },
        { label: 'Processes', children: [
          { label: 'Isothermal', children: [] },
          { label: 'Adiabatic', children: [] },
          { label: 'Isentropic', children: [] },
        ] },
      ],
    }),
    'builtin', `${daysAgo(5)}T20:00:00`,
  );

  // ---- the smaller surfaces --------------------------------------------
  // Goals, saved motivation, saved posts and emergency contacts: each is one
  // screen in the app that reads as broken when it is empty.
  for (const [text, targetDays, achieved] of [
    ['Finish the semester without a single all-nighter', 45, 0],
    ['Hold a four-hour deep work day, twice a week', 30, 0],
    ['Read one paper a week outside the syllabus', 60, 0],
    ['Get the sleep average above seven hours', -3, 1],
  ]) {
    db.prepare(
      'INSERT INTO goal_visions (id,user_id,text,target_date,achieved,created_at) VALUES (?,?,?,?,?,?)',
    ).run(uid(), userId, text, daysAgo(-targetDays), achieved, `${daysAgo(DAYS - 3)}T21:00:00`);
  }

  const motivationIds = db.prepare('SELECT id FROM motivation_items ORDER BY id LIMIT 3').all();
  for (const row of motivationIds) {
    db.prepare('INSERT OR IGNORE INTO saved_motivation (id,user_id,item_id) VALUES (?,?,?)')
      .run(uid(), userId, row.id);
  }

  const postIds = db.prepare('SELECT id FROM feed_posts ORDER BY id LIMIT 2').all();
  for (const row of postIds) {
    db.prepare('INSERT OR IGNORE INTO saved_posts (id,user_id,post_id) VALUES (?,?,?)')
      .run(uid(), userId, row.id);
  }

  for (const [name, phone, relation, order] of [
    ['Amma', '+91 90000 00001', 'Family', 0],
    ['Ravi (roommate)', '+91 90000 00002', 'Friend', 1],
    ['Campus counsellor', '+91 90000 00003', 'Counsellor', 2],
  ]) {
    db.prepare('INSERT INTO sos_contacts (id,user_id,name,phone,relation,sort_order) VALUES (?,?,?,?,?,?)')
      .run(uid(), userId, name, phone, relation, order);
  }

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
