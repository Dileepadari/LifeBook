import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Counts from 0 to `value` on mount. Purely decorative - the final number is
 *  in the DOM either way, and reduced-motion jumps straight to it. */
function useCountUp(value: number, duration = 700) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [value, duration, reduceMotion]);

  return display;
}

export function StatTile({
  label, value, max, delta, icon: Icon, accentClass, suffix, index = 0,
}: {
  label: string;
  value: number;
  max?: number | null;
  delta?: number | null;
  icon: LucideIcon;
  accentClass: string;
  suffix?: string;
  index?: number;
}) {
  const reduceMotion = useReducedMotion();
  const shown = useCountUp(value);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
    >
      <Card className="hover-lift h-full">
        <CardContent className="flex items-start gap-4 p-5">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', accentClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 flex items-baseline gap-1 font-semibold">
              <span className="text-2xl tabular-nums">{shown}</span>
              {max ? <span className="text-sm text-muted-foreground tabular-nums">/ {max}</span> : null}
              {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
            </p>
            <DeltaLine delta={delta} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** The comparison is against the previous 30 days. Where there is no previous
 *  period to compare against we say so rather than printing a fake 0%. */
function DeltaLine({ delta }: { delta?: number | null }) {
  if (delta === null || delta === undefined) {
    return <p className="mt-1 text-xs text-muted-foreground">No earlier period to compare</p>;
  }
  const up = delta > 0;
  const flat = delta === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={cn(
        'mt-1 flex items-center gap-1 text-xs',
        flat ? 'text-muted-foreground' : up ? 'text-success' : 'text-destructive',
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="tabular-nums">{Math.abs(delta)}%</span>
      <span className="text-muted-foreground">vs previous 30 days</span>
    </p>
  );
}
