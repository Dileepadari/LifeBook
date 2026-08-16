import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, TrendingUp, AlertCircle, Quote, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { longDate, duration, PROVIDER_LABELS, MOOD_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LifePage as LifePageType } from '@/lib/api';

/**
 * One page of the book. Shared by the single-page view and the print view, so
 * what you read on screen is exactly what gets bound - `printMode` only strips
 * the interactive chrome, never the content.
 */
export function LifePage({ page, printMode }: { page: LifePageType; printMode?: boolean }) {
  const reduceMotion = useReducedMotion();
  const m = page.metrics || {};

  const metrics = [
    { label: 'Focused', value: m.study_minutes ? duration(m.study_minutes) : null },
    { label: 'Tasks', value: m.tasks_planned ? `${m.tasks_completed ?? 0}/${m.tasks_planned}` : null },
    { label: 'Sleep', value: m.sleep_hours != null ? `${m.sleep_hours}h` : null },
    { label: 'Moved', value: m.exercise_minutes ? `${m.exercise_minutes}m` : null },
    { label: 'Habits', value: m.habits_total ? `${m.habits_done ?? 0}/${m.habits_total}` : null },
    { label: 'Health', value: m.health_points != null ? `${m.health_points}/100` : null },
    { label: 'Mood', value: m.mood ? MOOD_LABELS[(m.mood as number) - 1] : null },
    { label: 'Focus', value: m.focus != null ? `${Number(m.focus).toFixed(1)}/5` : null },
  ].filter((x) => x.value !== null);

  return (
    <motion.article
      initial={reduceMotion || printMode ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'page-surface mx-auto w-full max-w-3xl rounded-xl p-8 sm:p-12',
        printMode && 'print-page max-w-none rounded-none p-0',
      )}
    >
      <header className="page-rule pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-paper-foreground/50">
            {longDate(page.date)}
          </p>
          {!printMode && (
            <div className="flex items-center gap-1.5">
              {page.sealed_at && (
                <Badge variant="outline" className="gap-1 border-paper-edge text-[0.6rem] text-paper-foreground/60">
                  <Lock className="h-2.5 w-2.5" /> Sealed
                </Badge>
              )}
              <Badge variant="outline" className="gap-1 border-paper-edge text-[0.6rem] text-paper-foreground/60">
                <Sparkles className="h-2.5 w-2.5" />
                {PROVIDER_LABELS[page.generated_by] || page.generated_by}
              </Badge>
            </div>
          )}
        </div>
        {page.title && (
          <h2 className="font-display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
            {page.title}
          </h2>
        )}
      </header>

      {page.summary && (
        <p className="font-display mt-6 text-lg leading-relaxed text-paper-foreground/90">
          {page.summary}
        </p>
      )}

      {metrics.length > 0 && (
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={reduceMotion || printMode ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.04 }}
            >
              <dt className="text-[0.65rem] uppercase tracking-wider text-paper-foreground/50">
                {metric.label}
              </dt>
              <dd className="font-display mt-0.5 text-xl font-semibold tabular-nums">{metric.value}</dd>
            </motion.div>
          ))}
        </dl>
      )}

      {page.photo_url && (
        <img
          src={page.photo_url}
          alt=""
          className="mt-8 max-h-80 w-full rounded-lg border border-paper-edge object-cover"
        />
      )}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {page.achievements?.length > 0 && (
          <Section icon={TrendingUp} title="Achievements of the day" items={page.achievements} />
        )}
        {page.improvements?.length > 0 && (
          <Section icon={AlertCircle} title="Improvements needed" items={page.improvements} />
        )}
      </div>

      {page.journal_excerpt && (
        <blockquote className="page-rule mt-8 border-l-2 border-paper-edge py-1 pl-5">
          <Quote className="mb-2 h-4 w-4 text-paper-foreground/35" />
          <p className="font-display text-base italic leading-relaxed text-paper-foreground/80">
            {page.journal_excerpt}
          </p>
          <footer className="mt-2 text-xs text-paper-foreground/50">Your journal, this day</footer>
        </blockquote>
      )}

      {page.suggestion && (
        <div className="mt-8 rounded-lg border border-paper-edge bg-paper-foreground/[0.035] p-5">
          <p className="text-[0.65rem] uppercase tracking-wider text-paper-foreground/50">
            One thing for tomorrow
          </p>
          <p className="font-display mt-1.5 text-base leading-relaxed">{page.suggestion}</p>
        </div>
      )}
    </motion.article>
  );
}

function Section({ icon: Icon, title, items }: { icon: typeof TrendingUp; title: string; items: string[] }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-paper-foreground/60">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-paper-foreground/85">
            <span className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-paper-foreground/40" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
