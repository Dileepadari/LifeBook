/**
 * The review surface for cards due today. Grades feed straight back into the
 * SM-2 scheduler on the server.
 */
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { RotateCw, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDueCards, useReviewCard } from '@/hooks/useLifeData';
import { Skeleton } from '@/components/ui/skeleton';

// SM-2 grades. "Again" resets the interval; the other three widen it by the
// card's own ease factor, so a card you find easy stops appearing quickly.
const GRADES = [
  { grade: 0, label: 'Again', hint: 'No idea', variant: 'destructive' as const },
  { grade: 3, label: 'Hard', hint: 'Struggled', variant: 'outline' as const },
  { grade: 4, label: 'Good', hint: 'Got it', variant: 'secondary' as const },
  { grade: 5, label: 'Easy', hint: 'Instant', variant: 'default' as const },
];

export function FlashcardReview() {
  const { data: cards = [], isLoading } = useDueCards();
  const review = useReviewCard();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const reduceMotion = useReducedMotion();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (!cards.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
        <CheckCheck className="mb-3 h-8 w-8 text-success" />
        <p className="font-medium">
          {done > 0 ? `${done} ${done === 1 ? 'card' : 'cards'} cleared` : 'Nothing due'}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {done > 0
            ? 'Queue empty. The scheduler will bring these back exactly when you are about to forget them.'
            : 'Generate a deck from a resource below, and the scheduler will start feeding you cards.'}
        </p>
      </div>
    );
  }

  const card = cards[Math.min(index, cards.length - 1)];

  const grade = async (g: number) => {
    await review.mutateAsync({ id: card.id, grade: g });
    setDone((d) => d + 1);
    setFlipped(false);
    // The query refetches and drops the card; index stays put so the next card
    // slides into the same position.
    setIndex(0);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="tabular-nums">{cards.length}</span> due
          {done > 0 && <span className="ml-2 text-success">{done} done</span>}
        </p>
        {card.deck_name && <Badge variant="secondary">{card.deck_name}</Badge>}
      </div>

      <div className="[perspective:1400px]">
        <AnimatePresence mode="wait">
          <motion.button
            key={card.id + String(flipped)}
            type="button"
            onClick={() => setFlipped((f) => !f)}
            initial={reduceMotion ? false : { rotateY: flipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="page-surface flex min-h-52 w-full flex-col items-center justify-center rounded-xl p-8 text-center"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <span className="mb-3 text-[0.65rem] uppercase tracking-widest text-paper-foreground/50">
              {flipped ? 'Answer' : 'Question'}
            </span>
            <p className="font-display text-lg leading-relaxed">{flipped ? card.back : card.front}</p>
            {!flipped && (
              <span className="mt-6 flex items-center gap-1.5 text-xs text-paper-foreground/50">
                <RotateCw className="h-3 w-3" /> Tap to reveal
              </span>
            )}
          </motion.button>
        </AnimatePresence>
      </div>

      {flipped && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 grid grid-cols-4 gap-2"
        >
          {GRADES.map((g) => (
            <Button
              key={g.grade}
              variant={g.variant}
              onClick={() => grade(g.grade)}
              disabled={review.isPending}
              className="h-auto flex-col gap-0.5 py-2"
            >
              <span className="text-sm">{g.label}</span>
              <span className="text-[0.65rem] font-normal opacity-70">{g.hint}</span>
            </Button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
