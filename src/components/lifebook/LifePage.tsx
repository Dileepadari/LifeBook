/**
 * One printed page: the narrated summary, the day's metrics, achievements,
 * improvements and the journal excerpt. Shared by the reader, the day view and
 * the print sheet, so all three stay identical.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, TrendingUp, AlertCircle, Quote, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { longDate, duration, PROVIDER_LABELS, MOOD_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LifePage as LifePageType } from '@/lib/api';

/**
 * One page of the book. Shared by the single-page view, the reader and the
 * print view, so what you read on screen is exactly what gets bound - neither
 * `printMode` nor `variant` ever removes content, only chrome and width.
 *
 * `variant="book"` is the half-width leaf inside the open spread: the same
 * page set in a narrower measure, with the columns stacked and the entry
 * animation dropped, because in the reader the page turn is the animation.
 */
export function LifePage({
  page, printMode, variant = 'full',
}: {
  page: LifePageType;
  printMode?: boolean;
  variant?: 'full' | 'book';
}) {
  const reduceMotion = useReducedMotion();
  const book = variant === 'book';
  const still = reduceMotion || printMode || book;
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
      initial={still ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'page-surface mx-auto w-full max-w-3xl rounded-xl p-8 sm:p-12',
        // Inside the reader the leaf itself is the paper, so the page drops
        // its own border, shadow and rounding rather than drawing a card on
        // top of a card.
        book && 'max-w-none rounded-none border-0 bg-transparent p-7 shadow-none sm:p-9',
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
          <h2 className={cn(
            'font-display mt-2 font-semibold leading-tight',
            book ? 'text-2xl' : 'text-3xl sm:text-4xl',
          )}>
            {page.title}
          </h2>
        )}
      </header>

      {page.summary && (
        <p className={cn(
          'font-display mt-6 leading-relaxed text-paper-foreground/90',
          book ? 'text-base' : 'text-lg',
        )}>
          {page.summary}
        </p>
      )}

      {metrics.length > 0 && (
        <dl className={cn(
          'mt-8 grid grid-cols-2 gap-x-6 gap-y-4',
          book ? 'sm:grid-cols-2' : 'sm:grid-cols-4',
        )}>
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={still ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.04 }}
            >
              <dt className="text-[0.65rem] uppercase tracking-wider text-paper-foreground/50">
                {metric.label}
              </dt>
              <dd className={cn(
                'font-display mt-0.5 font-semibold tabular-nums',
                book ? 'text-lg' : 'text-xl',
              )}>{metric.value}</dd>
            </motion.div>
          ))}
        </dl>
      )}

      {page.photo_url && (
        <img
          src={page.photo_url}
          alt=""
          className={cn(
            'mt-8 w-full rounded-lg border border-paper-edge object-cover',
            book ? 'max-h-56' : 'max-h-80',
          )}
        />
      )}

      <div className={cn('mt-8 grid gap-8', !book && 'sm:grid-cols-2')}>
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
