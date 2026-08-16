-- LifeBook schema.
--
-- Every user-owned table carries user_id and every route filters on the JWT's
-- subject - there is no row-level security in SQLite, so ownership is enforced
-- in the route layer and nowhere else. Dates are stored as 'YYYY-MM-DD' text in
-- the user's local day, not UTC timestamps: a LifePage is a *day* in someone's
-- life, and a UTC boundary would split an evening study session across two
-- pages for anyone east of London.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- identity --

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  bio           TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Onboarding answers. One row per user, created when onboarding completes.
-- persona is one of the three the research produced (exam_strategist,
-- organized_learner, growth_explorer) and seeds a different starter habit set.
CREATE TABLE IF NOT EXISTS profiles (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  persona            TEXT,
  academic_goal      TEXT,
  personal_goal      TEXT,
  chronotype         TEXT,              -- early_bird | night_owl
  target_deep_work   REAL DEFAULT 4,    -- hours/day
  target_sleep       REAL DEFAULT 7.5,  -- hours/night
  target_screen_time REAL DEFAULT 2,    -- hours/day
  exam_date          TEXT,
  institution        TEXT,
  onboarded_at       TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme              TEXT DEFAULT 'light',
  palette            TEXT DEFAULT 'violet',
  ai_provider        TEXT DEFAULT 'auto',   -- auto | anthropic | gemini | builtin
  ai_key             TEXT,                  -- stored server-side; never returned to the browser
  ai_model           TEXT,
  notify_daily_page  INTEGER DEFAULT 1,
  notify_streaks     INTEGER DEFAULT 1,
  notify_challenges  INTEGER DEFAULT 1
);

-- ------------------------------------------------------------ plan your day --

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'todo',   -- todo | ongoing | blocked | done
  priority    TEXT NOT NULL DEFAULT 'normal', -- low | normal | important | urgent
  category    TEXT,                           -- academic | ECA | personal | wellness
  link_url    TEXT,
  due_date    TEXT,
  sort_order  REAL NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date);

-- ---------------------------------------------------------------- study now --

-- One row per focus block. planned_minutes vs actual_minutes is what makes
-- "you planned 4h of deep work and did 1h20" computable rather than vibes.
CREATE TABLE IF NOT EXISTS study_sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            TEXT NOT NULL,
  subject         TEXT,
  technique       TEXT NOT NULL DEFAULT 'pomodoro', -- pomodoro | deep_work | active_recall | spaced_repetition | practice_test
  planned_minutes INTEGER NOT NULL DEFAULT 25,
  actual_minutes  INTEGER NOT NULL DEFAULT 0,
  focus_rating    INTEGER,                          -- 1-5, self-reported after the block
  distractions    INTEGER DEFAULT 0,
  notes           TEXT,
  started_at      TEXT,
  ended_at        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON study_sessions(user_id, date);

CREATE TABLE IF NOT EXISTS resources (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT DEFAULT 'Notes',
  subject     TEXT,
  file_path   TEXT,
  mime_type   TEXT,
  size_bytes  INTEGER DEFAULT 0,
  text_content TEXT,   -- extracted/pasted text, used as the source for AI generation
  starred     INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resources_user ON resources(user_id);

CREATE TABLE IF NOT EXISTS decks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subject     TEXT,
  resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
  source      TEXT DEFAULT 'manual',  -- manual | ai
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SM-2 spaced repetition. The research called out active recall and spaced
-- repetition by name (Smith & Liu 2021) as the techniques students know about
-- but don't run, so the scheduler is real rather than a flat card list.
CREATE TABLE IF NOT EXISTS flashcards (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id       TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front         TEXT NOT NULL,
  back          TEXT NOT NULL,
  ease          REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions   INTEGER NOT NULL DEFAULT 0,
  due_date      TEXT NOT NULL DEFAULT (date('now')),
  last_reviewed TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cards_due ON flashcards(user_id, due_date);

CREATE TABLE IF NOT EXISTS mind_maps (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
  data        TEXT NOT NULL,          -- JSON { root, children: [{ label, children: [] }] }
  generated_by TEXT DEFAULT 'builtin',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quizzes (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  subject      TEXT,
  resource_id  TEXT REFERENCES resources(id) ON DELETE SET NULL,
  time_limit_minutes INTEGER DEFAULT 10,
  generated_by TEXT DEFAULT 'manual',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id            TEXT PRIMARY KEY,
  quiz_id       TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  prompt        TEXT NOT NULL,
  options       TEXT NOT NULL,   -- JSON array of strings
  answer_index  INTEGER NOT NULL,
  explanation   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  score        INTEGER NOT NULL,
  total        INTEGER NOT NULL,
  seconds_taken INTEGER,
  responses    TEXT,             -- JSON array of chosen indices
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------- habits & challenges --

CREATE TABLE IF NOT EXISTS habits (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT DEFAULT 'Check',
  target_days INTEGER NOT NULL DEFAULT 30,
  archived    INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id       TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 1,
  UNIQUE(habit_id, date)
);

-- Shared catalog (user_id NULL) seeded from the report's ideation list, plus
-- any challenge a user creates for themselves.
CREATE TABLE IF NOT EXISTS challenges (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  tagline     TEXT,
  description TEXT,
  category    TEXT,               -- study | wellness | mindset | social
  duration_days INTEGER NOT NULL DEFAULT 30,
  difficulty  TEXT DEFAULT 'medium',
  accent      TEXT DEFAULT 'violet',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS challenge_enrollments (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  started_on   TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(user_id, challenge_id)
);

CREATE TABLE IF NOT EXISTS challenge_progress (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id TEXT NOT NULL REFERENCES challenge_enrollments(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  done          INTEGER NOT NULL DEFAULT 1,
  note          TEXT,
  UNIQUE(enrollment_id, date)
);

-- ------------------------------------------------------------- health & mood --

CREATE TABLE IF NOT EXISTS wellness_logs (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date             TEXT NOT NULL,
  sleep_hours      REAL,
  water_glasses    INTEGER DEFAULT 0,
  exercise_minutes INTEGER DEFAULT 0,
  meditation_minutes INTEGER DEFAULT 0,
  screen_time_hours REAL,
  meals            INTEGER DEFAULT 0,
  had_breakfast    INTEGER DEFAULT 0,
  sunlight_minutes INTEGER DEFAULT 0,
  notes            TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS moods (
  id       TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  score    INTEGER NOT NULL,     -- 1 (very low) .. 5 (great)
  triggers TEXT,                 -- JSON array of tag strings
  note     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_moods_user_date ON moods(user_id, date);

CREATE TABLE IF NOT EXISTS journal_entries (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  gratitude    TEXT,   -- JSON array of strings
  reflection   TEXT,
  wins         TEXT,   -- JSON array
  improvements TEXT,   -- JSON array
  photo_url    TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS sos_contacts (
  id       TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  phone    TEXT,
  relation TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Shared, non-user-owned reference list (helplines, campus counselling).
CREATE TABLE IF NOT EXISTS support_resources (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  phone       TEXT,
  url         TEXT,
  region      TEXT DEFAULT 'IN',
  sort_order  INTEGER DEFAULT 0
);

-- ------------------------------------------------------- the LifeBook itself --

-- One page per user per day. A page is sealed once the day closes; sealed
-- pages are what get bound into the printed book, so regeneration after
-- sealing is refused rather than silently rewriting history.
CREATE TABLE IF NOT EXISTS lifepages (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  title         TEXT,
  summary       TEXT,
  achievements  TEXT,   -- JSON array of strings
  improvements  TEXT,   -- JSON array of strings
  journal_excerpt TEXT,
  suggestion    TEXT,
  metrics       TEXT,   -- JSON snapshot of the day's numbers at generation time
  photo_url     TEXT,
  generated_by  TEXT NOT NULL DEFAULT 'builtin',  -- builtin | anthropic | gemini
  sealed_at     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_lifepages_user_date ON lifepages(user_id, date);

CREATE TABLE IF NOT EXISTS print_orders (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_date   TEXT NOT NULL,
  to_date     TEXT NOT NULL,
  page_count  INTEGER NOT NULL,
  format      TEXT NOT NULL DEFAULT 'hardcover',  -- hardcover | paperback | pdf
  cover_title TEXT,
  recipient   TEXT,
  address     TEXT,
  status      TEXT NOT NULL DEFAULT 'requested',  -- requested | preparing | shipped
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------------------------------- feed, motivation, badges --

CREATE TABLE IF NOT EXISTS feed_posts (
  id          TEXT PRIMARY KEY,
  author_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT,
  kind        TEXT NOT NULL DEFAULT 'blog',  -- blog | announcement | highlight
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  tags        TEXT,
  source      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_posts (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS motivation_items (
  id      TEXT PRIMARY KEY,
  kind    TEXT NOT NULL DEFAULT 'quote',  -- quote | story | affirmation
  text    TEXT NOT NULL,
  author  TEXT,
  detail  TEXT
);

CREATE TABLE IF NOT EXISTS saved_motivation (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES motivation_items(id) ON DELETE CASCADE,
  UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS goal_visions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  target_date TEXT,
  achieved   INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Shared catalog. rule/threshold are read by server/badges.js, so adding a
-- badge is a seed row rather than a code change.
CREATE TABLE IF NOT EXISTS badges (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT DEFAULT 'Award',
  tier        TEXT DEFAULT 'bronze',
  rule        TEXT NOT NULL,     -- study_minutes_total | pages_sealed | habit_streak | ...
  threshold   REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id  TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind    TEXT NOT NULL DEFAULT 'info',
  title   TEXT NOT NULL,
  body    TEXT,
  link    TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
