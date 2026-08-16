// Formatting helpers. Kept hand-rolled with Intl rather than pulling in a date
// library - the app needs about eight of these and none of them need parsing.

/** Today in the browser's local timezone as YYYY-MM-DD. Must match the
 *  server's `today()`, which is likewise local rather than UTC. */
export function todayStr(): string {
  return toDateStr(new Date());
}

export function toDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** "Sunday, 16 August 2026" */
export function longDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "16 Aug" */
export function shortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "Today", "Yesterday", or the short date. */
export function relativeDay(date: string): string {
  if (date === todayStr()) return 'Today';
  if (date === addDays(todayStr(), -1)) return 'Yesterday';
  return shortDate(date);
}

/** 95 -> "1h 35m", 45 -> "45m", 0 -> "0m" */
export function duration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (!h) return `${rem}m`;
  if (!rem) return `${h}h`;
  return `${h}h ${rem}m`;
}

/** 95 -> "1.6" (hours, for prose) */
export function hours(minutes: number): string {
  return (Math.max(0, minutes || 0) / 60).toFixed(1).replace(/\.0$/, '');
}

/** Seconds -> "24:59", for the study timer. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function bytes(n: number): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function percent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) return '-';
  return `${Math.round(fraction * 100)}%`;
}

export const TECHNIQUE_LABELS: Record<string, string> = {
  pomodoro: 'Pomodoro',
  deep_work: 'Deep work',
  active_recall: 'Active recall',
  spaced_repetition: 'Spaced repetition',
  practice_test: 'Practice test',
};

export const PERSONA_LABELS: Record<string, string> = {
  exam_strategist: 'The Exam Strategist',
  organized_learner: 'The Organized Learner',
  growth_explorer: 'The Growth Explorer',
};

export const PROVIDER_LABELS: Record<string, string> = {
  builtin: 'Built-in engine',
  anthropic: 'Claude',
  gemini: 'Gemini',
};

export const MOOD_LABELS = ['Very low', 'Low', 'Okay', 'Good', 'Great'];
