/**
 * Thirty-day habit grid, one row per habit. A gap in a row is a broken chain,
 * which is the whole point of showing it as a grid rather than a count.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { Flame, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { shortDate, percent } from '@/lib/format';
import type { Habit } from '@/lib/api';

/**
 * The 30-day adherence grid. This is the "measure your life" instrument the
 * research asked for: a month of a habit at a glance, so a broken chain is
 * visible rather than remembered.
 */
export function HabitGrid({
  habits, onToggle, pending,
}: {
  habits: Habit[];
  onToggle: (id: string) => void;
  pending?: string | null;
}) {
  const reduceMotion = useReducedMotion();

  if (!habits.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No habits yet. Add one from Plan your day - keep it small enough to survive a bad week.
      </p>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="space-y-5">
        {habits.map((habit, hi) => (
          <div key={habit.id}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-medium">{habit.name}</p>
                {habit.streak > 0 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                    <Flame className="h-3 w-3" />
                    <span className="tabular-nums">{habit.streak}</span>
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {habit.adherence !== undefined && (
                  <span className="text-xs tabular-nums text-muted-foreground">{percent(habit.adherence)}</span>
                )}
                <Button
                  size="sm"
                  variant={habit.done_today ? 'default' : 'outline'}
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => onToggle(habit.id)}
                  disabled={pending === habit.id}
                >
                  <Check className="h-3 w-3" />
                  {habit.done_today ? 'Done' : 'Check in'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {habit.history.map((cell, i) => (
                <Tooltip key={cell.date}>
                  <TooltipTrigger asChild>
                    <motion.span
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: hi * 0.04 + i * 0.006, duration: 0.2 }}
                      className={cn(
                        'h-4 w-4 rounded-[3px] transition-colors',
                        cell.done ? 'bg-primary' : 'bg-muted',
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {shortDate(cell.date)} - {cell.done ? 'done' : 'missed'}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
