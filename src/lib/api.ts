/**
 * Typed fetch client for the API, plus the row types shared across pages.
 * Attaches the bearer token and unwraps errors into thrown Error messages.
 */
import { getToken, clearToken } from './authToken';

// The only place in the app that calls fetch().
//
// In dev, VITE_API_URL is unset and everything goes to /api, which
// vite.config.ts proxies to the Express server - one origin, no CORS. In a
// split deployment, set VITE_API_URL to the API's base URL.
const BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function call(path: string, init: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error('Your session has expired. Please log in again.');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function jsonCall(path: string, method: string, body?: unknown) {
  return call(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// --- Types ---

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export type Persona = 'exam_strategist' | 'organized_learner' | 'growth_explorer';

export interface Profile {
  user_id: string;
  persona: Persona | null;
  academic_goal: string | null;
  personal_goal: string | null;
  chronotype: 'early_bird' | 'night_owl' | null;
  target_deep_work: number;
  target_sleep: number;
  target_screen_time: number;
  exam_date: string | null;
  institution: string | null;
  onboarded_at: string | null;
}

export interface Settings {
  user_id: string;
  theme: string;
  palette: string;
  ai_provider: 'auto' | 'anthropic' | 'gemini' | 'builtin';
  ai_model: string | null;
  notify_daily_page: number;
  notify_streaks: number;
  notify_challenges: number;
  has_ai_key: boolean;
  ai_key_hint: string | null;
}

export type TaskStatus = 'todo' | 'ongoing' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'normal' | 'important' | 'urgent';

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: string | null;
  link_url: string | null;
  due_date: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
}

export type Technique = 'pomodoro' | 'deep_work' | 'active_recall' | 'spaced_repetition' | 'practice_test';

export interface StudySession {
  id: string;
  date: string;
  subject: string | null;
  technique: Technique;
  planned_minutes: number;
  actual_minutes: number;
  focus_rating: number | null;
  distractions: number;
  notes: string | null;
}

export interface Resource {
  id: string;
  name: string;
  category: string;
  subject: string | null;
  file_path: string | null;
  mime_type: string | null;
  size_bytes: number;
  text_content: string | null;
  starred: number;
  created_at: string;
}

export interface Deck { id: string; name: string; subject: string | null; source: string; created_at: string }

export interface Flashcard {
  id: string;
  deck_id: string;
  deck_name?: string;
  front: string;
  back: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
  last_reviewed: string | null;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  target_days: number;
  streak: number;
  done_today: boolean;
  adherence?: number;
  history: { date: string; done: boolean }[];
}

export interface Challenge {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string;
  duration_days: number;
  difficulty: string;
  accent: string;
  enrolled: boolean;
  enrollment_id?: string;
  days_done?: number;
  checked_in_today?: boolean;
  completed_at?: string | null;
  progress?: number;
}

export interface WellnessLog {
  id: string;
  date: string;
  sleep_hours: number | null;
  water_glasses: number;
  exercise_minutes: number;
  meditation_minutes: number;
  screen_time_hours: number | null;
  meals: number;
  had_breakfast: number;
  sunlight_minutes: number;
  notes: string | null;
}

export interface Mood { id: string; date: string; score: number; triggers: string[]; note: string | null }

export interface JournalEntry {
  id: string;
  date: string;
  gratitude: string[];
  reflection: string | null;
  wins: string[];
  improvements: string[];
  photo_url: string | null;
}

export interface LifePage {
  id: string;
  date: string;
  title: string | null;
  summary: string | null;
  achievements: string[];
  improvements: string[];
  journal_excerpt: string | null;
  suggestion: string | null;
  metrics: Record<string, number | null>;
  photo_url: string | null;
  generated_by: 'builtin' | 'anthropic' | 'gemini';
  sealed_at: string | null;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold';
  rule: string;
  threshold: number;
  current: number;
  progress: number;
  earned_at: string | null;
}

export interface FeedPost {
  id: string;
  kind: 'blog' | 'announcement' | 'highlight';
  title: string;
  body: string;
  author_name: string | null;
  tags: string | null;
  source: string | null;
  created_at: string;
  saved: boolean;
}

export interface MotivationItem {
  id: string;
  kind: 'quote' | 'story' | 'affirmation';
  text: string;
  author: string | null;
  detail: string | null;
  saved: boolean;
}

/** Every AI-backed response carries which provider actually produced it, so
 *  the UI can be honest about degradation instead of silently pretending the
 *  key worked. */
export interface AIMeta {
  provider: 'builtin' | 'anthropic' | 'gemini';
  degradedFrom?: 'anthropic' | 'gemini';
  providerError?: string;
}

// --- auth ---

export const auth = {
  signup: (email: string, username: string, password: string, display_name?: string): Promise<{ token: string; user: User }> =>
    jsonCall('/auth/signup', 'POST', { email, username, password, display_name }),
  login: (username: string, password: string): Promise<{ token: string; user: User }> =>
    jsonCall('/auth/login', 'POST', { username, password }),
  me: async (): Promise<User> => (await call('/auth/me')).user,
  updateMe: async (patch: Partial<User>): Promise<User> => (await jsonCall('/auth/me', 'PATCH', patch)).user,
  changePassword: (current: string, next: string) => jsonCall('/auth/password', 'POST', { current, next }),
  deleteAccount: (password: string) => jsonCall('/auth/me', 'DELETE', { password }),
  exportUrl: () => `${BASE}/auth/export`,
};

export const profile = {
  get: async (): Promise<Profile> => (await call('/auth/profile')).profile,
  save: async (patch: Partial<Profile> & { complete?: boolean }): Promise<Profile> =>
    (await jsonCall('/auth/profile', 'PUT', patch)).profile,
};

export const settings = {
  get: async (): Promise<Settings> => (await call('/auth/settings')).settings,
  save: async (patch: Record<string, unknown>): Promise<Settings> =>
    (await jsonCall('/auth/settings', 'PATCH', patch)).settings,
};

// --- generic /data gateway ---

type DataTable =
  | 'tasks' | 'resources' | 'decks' | 'habits' | 'moods' | 'goal_visions'
  | 'sos_contacts' | 'notifications' | 'quizzes' | 'mind_maps' | 'print_orders';

interface SelectOpts {
  filters?: { column: string; op?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like'; value: unknown }[];
  order?: string;
  limit?: number;
}

async function dataSelect<T>(table: DataTable, opts: SelectOpts = {}): Promise<T[]> {
  return (await jsonCall('/data', 'POST', { table, operation: 'select', ...opts })).data;
}
async function dataInsert<T>(table: DataTable, payload: Record<string, unknown>): Promise<T> {
  return (await jsonCall('/data', 'POST', { table, operation: 'insert', payload })).data;
}
async function dataUpdate<T>(table: DataTable, id: string, payload: Record<string, unknown>): Promise<T> {
  return (await jsonCall('/data', 'POST', { table, operation: 'update', id, payload })).data;
}
async function dataDelete(table: DataTable, id: string): Promise<void> {
  await jsonCall('/data', 'POST', { table, operation: 'delete', id });
}

export const tasks = {
  list: () => dataSelect<Task>('tasks'),
  create: (payload: Partial<Task>) => dataInsert<Task>('tasks', payload),
  update: (id: string, payload: Partial<Task>) => dataUpdate<Task>('tasks', id, payload),
  remove: (id: string) => dataDelete('tasks', id),
};

export const resources = {
  list: () => dataSelect<Resource>('resources'),
  update: (id: string, payload: Partial<Resource>) => dataUpdate<Resource>('resources', id, payload),
  // Upload and delete are named routes: one writes to disk, the other has to
  // remove the file as well as the row.
  upload: async (file: File, meta: { name?: string; category?: string; subject?: string } = {}) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(meta).forEach(([k, v]) => v && form.append(k, v));
    return (await call('/study/resources/upload', { method: 'POST', body: form })).resource as Resource;
  },
  remove: (id: string) => jsonCall(`/study/resources/${id}`, 'DELETE'),
};

export const decks = {
  list: () => dataSelect<Deck>('decks'),
  create: (payload: Partial<Deck>) => dataInsert<Deck>('decks', payload),
  remove: (id: string) => dataDelete('decks', id),
};

export const goalVisions = {
  list: () => dataSelect<{ id: string; text: string; target_date: string | null; achieved: number }>('goal_visions'),
  create: (payload: { text: string; target_date?: string | null }) => dataInsert('goal_visions', payload),
  update: (id: string, payload: Record<string, unknown>) => dataUpdate('goal_visions', id, payload),
  remove: (id: string) => dataDelete('goal_visions', id),
};

export const sosContacts = {
  list: () => dataSelect<{ id: string; name: string; phone: string | null; relation: string | null }>('sos_contacts'),
  create: (payload: { name: string; phone?: string; relation?: string }) => dataInsert('sos_contacts', payload),
  remove: (id: string) => dataDelete('sos_contacts', id),
};

export const habitsApi = {
  list: async (): Promise<Habit[]> => (await call('/day/habits')).data,
  create: (payload: { name: string; icon?: string; target_days?: number }) => dataInsert<Habit>('habits', payload),
  remove: (id: string) => dataDelete('habits', id),
  // Toggle is a named route: it computes the streak server-side and may award
  // a badge, neither of which the generic gateway can do.
  toggle: (id: string, date?: string) => jsonCall(`/day/habits/${id}/toggle`, 'POST', { date }),
};

// --- study ---

export const study = {
  logSession: (payload: Partial<StudySession>) => jsonCall('/study/sessions', 'POST', payload),
  sessions: async (from?: string, to?: string): Promise<StudySession[]> =>
    (await call(`/study/sessions${from && to ? `?from=${from}&to=${to}` : ''}`)).data,
  removeSession: (id: string) => jsonCall(`/study/sessions/${id}`, 'DELETE'),

  dueCards: async (): Promise<Flashcard[]> => (await call('/study/cards/due')).data,
  deckCards: async (deckId: string): Promise<Flashcard[]> => (await call(`/study/decks/${deckId}/cards`)).data,
  createCard: (deck_id: string, front: string, back: string) => jsonCall('/study/cards', 'POST', { deck_id, front, back }),
  removeCard: (id: string) => jsonCall(`/study/cards/${id}`, 'DELETE'),
  // Named route: the next due date comes from SM-2 over the card's current
  // state, so the client sends a grade and never an interval.
  reviewCard: (id: string, grade: number) => jsonCall(`/study/cards/${id}/review`, 'POST', { grade }),

  quiz: (id: string) => call(`/study/quizzes/${id}`),
  attemptQuiz: (id: string, responses: (number | null)[], seconds_taken?: number) =>
    jsonCall(`/study/quizzes/${id}/attempt`, 'POST', { responses, seconds_taken }),
  attempts: async () => (await call('/study/quiz-attempts')).data,

  generateFlashcards: (body: { resource_id?: string; text?: string; count?: number; deck_name?: string; subject?: string }) =>
    jsonCall('/study/generate/flashcards', 'POST', body),
  generateQuiz: (body: { resource_id?: string; text?: string; count?: number; quiz_title?: string }) =>
    jsonCall('/study/generate/quiz', 'POST', body),
  generateMindMap: (body: { resource_id?: string; text?: string; title?: string }) =>
    jsonCall('/study/generate/mindmap', 'POST', body),
};

// --- day ---

export const day = {
  wellness: async (from?: string, to?: string): Promise<WellnessLog[]> =>
    (await call(`/day/wellness${from ? `?from=${from}&to=${to}` : ''}`)).data,
  saveWellness: (date: string, payload: Partial<WellnessLog>) => jsonCall(`/day/wellness/${date}`, 'PUT', payload),

  journal: async (date: string): Promise<JournalEntry | null> => (await call(`/day/journal/${date}`)).entry,
  journalList: async (): Promise<JournalEntry[]> => (await call('/day/journal')).data,
  saveJournal: (date: string, payload: Partial<JournalEntry>) => jsonCall(`/day/journal/${date}`, 'PUT', payload),

  moods: async (from?: string, to?: string): Promise<Mood[]> =>
    (await call(`/day/moods${from ? `?from=${from}&to=${to}` : ''}`)).data,
  logMood: (payload: { score: number; note?: string; triggers?: string[]; date?: string }) =>
    jsonCall('/day/moods', 'POST', payload),

  challenges: async (): Promise<Challenge[]> => (await call('/day/challenges')).data,
  enroll: (id: string) => jsonCall(`/day/challenges/${id}/enroll`, 'POST', {}),
  unenroll: (id: string) => jsonCall(`/day/challenges/${id}/enroll`, 'DELETE'),
  checkin: (id: string, note?: string) => jsonCall(`/day/challenges/${id}/checkin`, 'POST', { note }),
  leaderboard: async () => (await call('/day/challenges/leaderboard')).data,
};

// --- lifebook ---

export const lifebook = {
  pages: async (): Promise<LifePage[]> => (await call('/lifebook/pages')).data,
  page: async (date: string): Promise<LifePage | null> => (await call(`/lifebook/pages/${date}`)).page,
  snapshot: async (date: string) => (await call(`/lifebook/snapshot/${date}`)).snapshot,
  stats: () => call('/lifebook/stats'),
  // Named routes: generation reads a dozen tables and calls a provider;
  // sealing is the one write meant to be permanent.
  generate: (date: string, force = false): Promise<{ page: LifePage } & AIMeta> =>
    jsonCall(`/lifebook/pages/${date}/generate`, 'POST', { force }),
  seal: (date: string) => jsonCall(`/lifebook/pages/${date}/seal`, 'POST', {}),
  unseal: (date: string) => jsonCall(`/lifebook/pages/${date}/unseal`, 'POST', {}),
  orders: async () => (await call('/lifebook/orders')).data,
  order: (payload: Record<string, unknown>) => jsonCall('/lifebook/orders', 'POST', payload),
};

// --- day assistant ---

/** An existing task the brief refers to, and what should happen to it. */
export interface DayResolve {
  task_id: string;
  title: string;
  action: 'done' | 'reopen' | 'flag';
  was: string;
}

/** A value already logged that the brief disagrees with. Nothing is written
 *  until `decision` is set, so this is a real question rather than a warning. */
export interface DayConflict {
  key: string;
  label: string;
  existing: string;
  proposed: string;
  additive?: boolean;
  decision: 'overwrite' | 'keep' | null;
}

export interface DayProposal {
  reply: string;
  tasks: { title: string; priority: TaskPriority; category: string }[];
  completed: string[];
  missed: string[];
  resolve: DayResolve[];
  conflicts: DayConflict[];
  wellness: Partial<Record<'sleep_hours' | 'exercise_minutes' | 'screen_time_hours' | 'water_glasses' | 'meditation_minutes' | 'had_breakfast', number>>;
  mood: { score: number; note: string | null } | null;
  study: { subject: string | null; minutes: number; focus_rating: number | null } | null;
  journal: string | null;
  gratitude: string[];
}

/** Opaque to the client - it is handed straight back to /undo. */
export type UndoToken = Record<string, unknown>;

export interface ApplyResult {
  applied: string[];
  undo: UndoToken;
  health_points: number;
  awarded?: { name: string; description: string }[];
}

export const assistant = {
  parse: (
    message: string,
    history?: { role: 'user' | 'assistant'; text: string }[],
    date?: string,
  ): Promise<{ proposal: DayProposal } & AIMeta> =>
    jsonCall('/assistant/parse', 'POST', { message, history, date }),
  apply: (proposal: DayProposal, date?: string): Promise<ApplyResult> =>
    jsonCall('/assistant/apply', 'POST', { proposal, date }),
  undo: (undo: UndoToken) => jsonCall('/assistant/undo', 'POST', { undo }),
};

// --- insights ---

export const insights = {
  dashboard: () => call('/dashboard'),
  analytics: (days = 30) => call(`/analytics?days=${days}`),
  generate: (days = 30) => jsonCall('/insights', 'POST', { days }),
  coach: (message: string): Promise<{ reply: string } & AIMeta> => jsonCall('/coach', 'POST', { message }),
  badges: async (): Promise<Badge[]> => (await call('/badges')).data,
  feed: async (): Promise<FeedPost[]> => (await call('/feed')).data,
  savePost: (id: string) => jsonCall(`/feed/${id}/save`, 'POST', {}),
  createPost: (payload: { title: string; body: string; kind?: string; tags?: string }) => jsonCall('/feed', 'POST', payload),
  motivation: () => call('/motivation'),
  saveMotivation: (id: string) => jsonCall(`/motivation/${id}/save`, 'POST', {}),
  support: () => call('/support'),
  notifications: async () => (await call('/notifications')).data,
  readNotifications: () => jsonCall('/notifications/read', 'POST', {}),
  aiStatus: () => call('/ai/status'),
  testAI: (body?: { provider?: string; apiKey?: string; model?: string }) => jsonCall('/ai/test', 'POST', body || {}),
  aiModels: (body?: { provider?: string; apiKey?: string }): Promise<{ provider?: string; models: string[]; error?: string }> =>
    jsonCall('/ai/models', 'POST', body || {}),
};
