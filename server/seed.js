import { db } from './db.js';

// Shared, non-user-owned reference content. Everything here is drawn from the
// 2024 Design Thinking report - the challenge list is the "Activity Challenges"
// row of the high-fidelity wireframe, the feed posts summarise the literature
// review, and the support resources are the mental-health section's response to
// the NCRB / depression findings. Seeding is idempotent: rows carry stable ids
// and are inserted with OR IGNORE, so a restart never duplicates them.

const CHALLENGES = [
  {
    id: 'ch-deep-study',
    name: 'Deep Study Challenge',
    tagline: 'Four uninterrupted hours a day, for a month.',
    description:
      'The interviews found most students do shallow work: fragmented attention, phone within reach, no single unbroken block. This challenge asks for one genuinely deep session a day - phone in another room, one subject, no tab-switching - and counts the day only when you log at least 4 focused hours.',
    category: 'study',
    duration_days: 30,
    difficulty: 'hard',
    accent: 'violet',
  },
  {
    id: 'ch-5am',
    name: '5 AM Challenge',
    tagline: 'Wake at five. Own the first two hours.',
    description:
      '18 of 22 interviewees identified as night owls, and the same group reported the worst sleep consistency and lowest alertness scores. Shifting the wake time is the lever that moves both. Check in each morning you are up and working before 6.',
    category: 'wellness',
    duration_days: 21,
    difficulty: 'hard',
    accent: 'sunset',
  },
  {
    id: 'ch-digital-detox',
    name: 'Digital Detox Challenge',
    tagline: 'Under two hours of social media a day.',
    description:
      'Instant gratification came up repeatedly as the root of procrastination - the dopamine loop that makes starting hard and stopping harder. Keep recreational screen time under two hours and log it honestly; the point is the measurement as much as the limit.',
    category: 'mindset',
    duration_days: 30,
    difficulty: 'medium',
    accent: 'ocean',
  },
  {
    id: 'ch-meditation',
    name: 'Meditation Challenge',
    tagline: 'Ten minutes of stillness, every day.',
    description:
      'Kumar & Green (2023) found mindfulness practice reduces anxiety and improves focus, yet almost none of the students interviewed practised it. Ten minutes, guided or silent, before you open a book.',
    category: 'wellness',
    duration_days: 30,
    difficulty: 'easy',
    accent: 'emerald',
  },
  {
    id: 'ch-social',
    name: 'Social Challenge',
    tagline: 'One real conversation a day.',
    description:
      'Graduates active in extracurriculars are 25% more likely to be employed within six months (NACE 2020), but the survey found most students had cut their activities to one or two for lack of time. One deliberate, non-transactional social interaction a day - a club, a call, a meal with someone new.',
    category: 'social',
    duration_days: 21,
    difficulty: 'easy',
    accent: 'rose',
  },
  {
    id: 'ch-breakfast',
    name: 'Eat Well Challenge',
    tagline: 'Breakfast, every single morning.',
    description:
      'The interview matrix asked directly about breakfast and brain foods. Students who skipped it clustered with the lowest physical-health self-ratings. Start with the easiest possible habit and let it anchor the rest.',
    category: 'wellness',
    duration_days: 30,
    difficulty: 'easy',
    accent: 'sunset',
  },
  {
    id: 'ch-workout',
    name: 'Workout Challenge',
    tagline: 'Move for thirty minutes a day.',
    description:
      'Endorphins, cortisol regulation, sleep quality - the review section listed all three. Most participants reported no exercise at all. Thirty minutes, any kind, counts.',
    category: 'wellness',
    duration_days: 30,
    difficulty: 'medium',
    accent: 'emerald',
  },
  {
    id: 'ch-revise',
    name: 'Revise Right Challenge',
    tagline: 'Clear your spaced-repetition queue daily.',
    description:
      'Active recall and spaced repetition improve retention (Smith & Liu 2021) but only if the review actually happens. Finish every card due in Study Now before you close the day.',
    category: 'study',
    duration_days: 30,
    difficulty: 'medium',
    accent: 'violet',
  },
];

const BADGES = [
  { id: 'bd-first-page', name: 'First Page', description: 'Sealed your first LifePage.', icon: 'BookOpen', tier: 'bronze', rule: 'pages_sealed', threshold: 1 },
  { id: 'bd-first-chapter', name: 'First Chapter', description: 'Sealed seven LifePages.', icon: 'BookMarked', tier: 'silver', rule: 'pages_sealed', threshold: 7 },
  { id: 'bd-volume-one', name: 'Volume One', description: 'Sealed thirty LifePages - a printable book.', icon: 'Library', tier: 'gold', rule: 'pages_sealed', threshold: 30 },
  { id: 'bd-deep-diver', name: 'Deep Diver', description: 'Logged 10 hours of focused study.', icon: 'Timer', tier: 'bronze', rule: 'study_minutes_total', threshold: 600 },
  { id: 'bd-centurion', name: 'Centurion', description: 'Logged 100 hours of focused study.', icon: 'Trophy', tier: 'gold', rule: 'study_minutes_total', threshold: 6000 },
  { id: 'bd-streak-7', name: 'Consistent', description: 'Kept a habit alive for 7 days straight.', icon: 'Flame', tier: 'bronze', rule: 'habit_streak', threshold: 7 },
  { id: 'bd-streak-30', name: 'Unbroken', description: 'Kept a habit alive for 30 days straight.', icon: 'Flame', tier: 'gold', rule: 'habit_streak', threshold: 30 },
  { id: 'bd-reflector', name: 'Reflector', description: 'Wrote 10 journal entries.', icon: 'PenLine', tier: 'bronze', rule: 'journal_entries', threshold: 10 },
  { id: 'bd-self-aware', name: 'Self-Aware', description: 'Logged your mood 30 times.', icon: 'HeartPulse', tier: 'silver', rule: 'mood_logs', threshold: 30 },
  { id: 'bd-well-rested', name: 'Well Rested', description: 'Hit your sleep target 14 times.', icon: 'Moon', tier: 'silver', rule: 'sleep_target_days', threshold: 14 },
  { id: 'bd-challenger', name: 'Challenger', description: 'Completed a full challenge.', icon: 'Target', tier: 'gold', rule: 'challenges_completed', threshold: 1 },
  { id: 'bd-librarian', name: 'Librarian', description: 'Organised 25 study resources.', icon: 'FolderOpen', tier: 'bronze', rule: 'resources_count', threshold: 25 },
  { id: 'bd-quizzer', name: 'Quizzer', description: 'Completed 10 practice tests.', icon: 'ListChecks', tier: 'silver', rule: 'quiz_attempts', threshold: 10 },
];

const MOTIVATION = [
  { id: 'mo-1', kind: 'quote', text: 'Success is about disciplined preparation and maximizing every moment of study time.', author: 'Gautam, The Exam Strategist', detail: 'Persona quote from the LifeBook research' },
  { id: 'mo-2', kind: 'quote', text: 'An organized approach reduces stress and keeps me prepared for anything.', author: 'Sai, The Organized Learner', detail: 'Persona quote from the LifeBook research' },
  { id: 'mo-3', kind: 'quote', text: "College is about more than academics - it's a chance to grow, learn, and make an impact.", author: 'Ayushi, The Growth Explorer', detail: 'Persona quote from the LifeBook research' },
  { id: 'mo-4', kind: 'quote', text: 'Your life is a book, and every day is one page.', author: 'LifeBook', detail: null },
  { id: 'mo-5', kind: 'affirmation', text: 'I do not need to feel motivated to begin. I need to begin.', author: null, detail: 'Counters the all-or-none mentality the interviews surfaced.' },
  { id: 'mo-6', kind: 'affirmation', text: 'A page half-written still beats a page never opened.', author: null, detail: null },
  { id: 'mo-7', kind: 'affirmation', text: 'I can do hard things slowly.', author: null, detail: null },
  { id: 'mo-8', kind: 'affirmation', text: 'Rest is preparation, not surrender.', author: null, detail: 'From the RestFirst ideation thread.' },
  {
    id: 'mo-9',
    kind: 'story',
    text: 'The student who stopped counting hours',
    author: null,
    detail:
      'One interviewee logged five to six hours a day and still felt behind, because the hours were fragmented across a dozen restarts. Switching from "how long did I sit" to "how long was I actually focused" dropped the number to three - and the grades went up. Measure the thing that matters, not the thing that is easy to count.',
  },
  {
    id: 'mo-10',
    kind: 'story',
    text: 'Two clubs, better marks',
    author: null,
    detail:
      'The survey expected extracurriculars to cost academic performance. They did not: students reported ECAs were not hurting their grades, only that they had no time left for them. The constraint was scheduling, not capacity. Afalla (2020) found the same across 190 students.',
  },
  {
    id: 'mo-11',
    kind: 'story',
    text: 'The gurukul had it right about routine',
    author: null,
    detail:
      'The ancient Indian education review in the research kept returning to one theme: structured lifestyles instilled discipline, self-control and time management before they taught anything else. The syllabus changed; the sequencing did not.',
  },
];

const FEED_POSTS = [
  {
    id: 'fp-1',
    kind: 'announcement',
    title: 'Welcome to LifeBook',
    author_name: 'The LifeBook team',
    tags: 'welcome',
    source: null,
    body:
      'LifeBook came out of a Design Thinking study on how students balance academics, extracurriculars and their own wellbeing. Twenty-two interviews and a survey pointed at one thing again and again: students do not measure their lives, so they cannot see their own progress or their backlogs.\n\nEverything you log here - a study block, a night of sleep, a habit check-in, a line in your journal - becomes a page. One page a day. Enough pages and you have a book worth printing.',
  },
  {
    id: 'fp-2',
    kind: 'blog',
    title: 'Why active recall beats re-reading',
    author_name: 'Research digest',
    tags: 'study,technique',
    source: 'Smith, R. & Liu, X. (2021). Journal of Educational Psychology 113(4), 605-618.',
    body:
      'Re-reading feels productive because the material gets easier to read. That fluency is the illusion - it measures familiarity, not retrieval.\n\nActive recall, spaced repetition and practice testing all improve retention and comprehension, and the effect compounds when they are integrated daily rather than saved for the week before an exam. The flashcard scheduler in Study Now runs SM-2 for exactly this reason: it shows you a card at the moment you are about to forget it, which is the moment recall does the most work.',
  },
  {
    id: 'fp-3',
    kind: 'blog',
    title: 'Time management is a skill, not a personality trait',
    author_name: 'Research digest',
    tags: 'time,stress',
    source: 'Misra, R. & McKean, M. (2000); undergraduate engineering time-management study.',
    body:
      'There is a consistent positive correlation between time-management behaviour and academic performance, and a consistent negative one between time management and anxiety. Neither is about being a naturally organised person.\n\nWhat the research describes is a set of learnable behaviours: planning the next day before the current one ends, protecting a block rather than a to-do list, and reviewing what actually happened. Plan Your Day and the LifePage summary cover the first and the last.',
  },
  {
    id: 'fp-4',
    kind: 'blog',
    title: 'Extracurriculars are not the thing costing you marks',
    author_name: 'Research digest',
    tags: 'balance,eca',
    source: 'Afalla, B. T. (2020); NACE Job Outlook 2020; Sa, M. J. (2023).',
    body:
      'A survey of 190 students found no significant correlation between extracurricular involvement and GPA. What ECA involvement does correlate with is personal development, career readiness and social skills - and graduates who were active in them are 25% more likely to be employed within six months of finishing.\n\nThe LifeBook survey found students had cut their activities down to one or two, not because they hurt their grades, but because nothing in their week was structured enough to leave room. That is a scheduling problem, and scheduling problems are fixable.',
  },
  {
    id: 'fp-5',
    kind: 'blog',
    title: 'Mindfulness, and the case for doing nothing on purpose',
    author_name: 'Research digest',
    tags: 'wellness,focus',
    source: 'Kumar, A. & Green, L. (2023). Journal of Student Wellness 12(2), 45-58.',
    body:
      'Mindfulness practice reduces anxiety, improves focus and supports academic resilience. In the LifeBook interviews, almost nobody was doing it - the single most common answer to "do you practise any mindfulness exercises" was no.\n\nTen minutes is the whole intervention. The Meditation Challenge exists because a habit with a low floor is the one that survives a bad week.',
  },
  {
    id: 'fp-6',
    kind: 'highlight',
    title: 'The insight this whole app is built on',
    author_name: 'From the research',
    tags: 'insight',
    source: 'LifeBook interview insights, 2024',
    body:
      '"They dont measure their life hence cant see their improvements/backlogs."\n\nThat line, verbatim from the interview analysis, is why LifePages exist. Not as a diary - as an instrument.',
  },
];

const SUPPORT_RESOURCES = [
  { id: 'sr-1', name: 'Tele-MANAS', description: 'Government of India 24x7 mental health helpline, available in multiple languages.', phone: '14416', url: 'https://telemanas.mohfw.gov.in/', region: 'IN', sort_order: 1 },
  { id: 'sr-2', name: 'KIRAN Mental Health Helpline', description: '24x7 toll-free helpline from the Ministry of Social Justice and Empowerment.', phone: '1800-599-0019', url: null, region: 'IN', sort_order: 2 },
  { id: 'sr-3', name: 'AASRA', description: 'Round-the-clock crisis support and suicide prevention.', phone: '+91-9820466726', url: 'http://www.aasra.info/', region: 'IN', sort_order: 3 },
  { id: 'sr-4', name: 'Vandrevala Foundation', description: 'Free counselling and crisis intervention, 24 hours a day.', phone: '+91-9999666555', url: 'https://www.vandrevalafoundation.com/', region: 'IN', sort_order: 4 },
  { id: 'sr-5', name: 'Your campus counsellor', description: 'Most institutions have a counselling cell. Add the number in Settings so it is one tap away when you need it.', phone: null, url: null, region: 'IN', sort_order: 5 },
];

export function seed() {
  const insertChallenge = db.prepare(
    `INSERT OR IGNORE INTO challenges (id, user_id, name, tagline, description, category, duration_days, difficulty, accent)
     VALUES (@id, NULL, @name, @tagline, @description, @category, @duration_days, @difficulty, @accent)`,
  );
  const insertBadge = db.prepare(
    `INSERT OR IGNORE INTO badges (id, name, description, icon, tier, rule, threshold)
     VALUES (@id, @name, @description, @icon, @tier, @rule, @threshold)`,
  );
  const insertMotivation = db.prepare(
    'INSERT OR IGNORE INTO motivation_items (id, kind, text, author, detail) VALUES (@id, @kind, @text, @author, @detail)',
  );
  const insertPost = db.prepare(
    `INSERT OR IGNORE INTO feed_posts (id, author_id, author_name, kind, title, body, tags, source)
     VALUES (@id, NULL, @author_name, @kind, @title, @body, @tags, @source)`,
  );
  const insertSupport = db.prepare(
    `INSERT OR IGNORE INTO support_resources (id, name, description, phone, url, region, sort_order)
     VALUES (@id, @name, @description, @phone, @url, @region, @sort_order)`,
  );

  db.transaction(() => {
    CHALLENGES.forEach((c) => insertChallenge.run(c));
    BADGES.forEach((b) => insertBadge.run(b));
    MOTIVATION.forEach((m) => insertMotivation.run({ author: null, detail: null, ...m }));
    FEED_POSTS.forEach((p) => insertPost.run(p));
    SUPPORT_RESOURCES.forEach((s) => insertSupport.run(s));
  })();
}

/** Starter habits, chosen per persona. Called once when onboarding completes. */
export const STARTER_HABITS = {
  exam_strategist: [
    { name: 'Clear the spaced-repetition queue', icon: 'Layers', target_days: 30 },
    { name: '4 hours of deep work', icon: 'Timer', target_days: 30 },
    { name: 'Sleep before midnight', icon: 'Moon', target_days: 30 },
  ],
  organized_learner: [
    { name: 'Plan tomorrow before bed', icon: 'CalendarCheck', target_days: 30 },
    { name: 'Screen time under 2 hours', icon: 'Smartphone', target_days: 30 },
    { name: 'One focused block, no tab-switching', icon: 'Focus', target_days: 30 },
  ],
  growth_explorer: [
    { name: '10 minutes of mindfulness', icon: 'Sparkles', target_days: 30 },
    { name: 'Write one journal entry', icon: 'PenLine', target_days: 30 },
    { name: 'Move for 30 minutes', icon: 'Activity', target_days: 30 },
  ],
};
