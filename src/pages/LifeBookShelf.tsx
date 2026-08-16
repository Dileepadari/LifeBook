import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { BookOpen, Printer, Package, Lock, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { LifePage } from '@/components/lifebook/LifePage';
import { useLifePages, useLifeBookStats } from '@/hooks/useLifeData';
import { longDate, shortDate, relativeDay, PROVIDER_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function LifeBookShelf() {
  const { data: pages = [], isLoading } = useLifePages();
  const { data: stats } = useLifeBookStats();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const reduceMotion = useReducedMotion();

  if (isLoading) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={2} height="h-64" /></div>;
  }

  // Newest first from the API; reading a book goes oldest to newest.
  const ordered = [...pages].reverse();

  if (!ordered.length) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-semibold">Your LifeBook</h1>
        </header>
        <Card className="book-wash">
          <CardContent className="flex flex-col items-center py-20 text-center">
            <BookOpen className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="font-display text-xl font-semibold">The book is empty</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Log a day - a study block, how you slept, a line in your journal - then close it with
              the button in the corner. That writes page one.
            </p>
            <Button asChild className="mt-6"><Link to="/dashboard">Start today</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const page = ordered[Math.min(index, ordered.length - 1)];
  const go = (delta: number) => {
    setDirection(delta);
    setIndex((i) => Math.max(0, Math.min(ordered.length - 1, i + delta)));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Your LifeBook</h1>
          <p className="mt-1 text-muted-foreground">
            {stats
              ? `${stats.total_pages} ${stats.total_pages === 1 ? 'page' : 'pages'}, ${stats.sealed_pages} sealed${
                  stats.first_page ? ` - ${shortDate(stats.first_page)} to ${shortDate(stats.last_page)}` : ''
                }`
              : 'Loading...'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/lifebook/print"><Printer className="h-4 w-4" /> Print view</Link>
          </Button>
          <Button asChild className="gap-2">
            <Link to="/lifebook/order"><Package className="h-4 w-4" /> Order a copy</Link>
          </Button>
        </div>
      </header>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Pages" value={stats.total_pages} />
          <Stat label="Sealed" value={stats.sealed_pages} />
          <Stat label="Volumes" value={stats.volumes} hint="30 pages each" />
          <Stat
            label="Written by"
            value={stats.by_provider?.length
              ? stats.by_provider.map((p: { generated_by: string; n: number }) => `${PROVIDER_LABELS[p.generated_by] || p.generated_by} ${p.n}`).join(', ')
              : '-'}
            small
          />
        </div>
      )}

      {/* The reader. One page at a time with a turn animation, because the
          product's whole claim is that this is a book rather than a feed. */}
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={index === 0} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" /> Earlier
          </Button>
          <p className="text-sm text-muted-foreground">
            Page <span className="tabular-nums">{index + 1}</span> of{' '}
            <span className="tabular-nums">{ordered.length}</span>
          </p>
          <Button
            variant="outline" size="sm"
            onClick={() => go(1)}
            disabled={index >= ordered.length - 1}
            className="gap-1.5"
          >
            Later <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div style={{ perspective: 1800 }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={page.date}
              initial={reduceMotion ? false : { opacity: 0, rotateY: direction >= 0 ? 18 : -18, x: direction >= 0 ? 60 : -60 }}
              animate={{ opacity: 1, rotateY: 0, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, rotateY: direction >= 0 ? -18 : 18, x: direction >= 0 ? -60 : 60 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <LifePage page={page} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex justify-center">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to={`/lifebook/${page.date}`}>
              Open this page on its own <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Every page</CardTitle>
          <CardDescription>Jump to any day.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setDirection(0); setIndex(ordered.findIndex((o) => o.date === p.date)); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); }}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors hover:bg-muted',
                  p.date === page.date ? 'border-primary bg-primary/5' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title || relativeDay(p.date)}</p>
                    <p className="text-xs text-muted-foreground">{longDate(p.date)}</p>
                  </div>
                  {p.sealed_at ? (
                    <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                </div>
                {p.summary && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{p.summary}</p>}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, small }: { label: string; value: number | string; hint?: string; small?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn('font-display mt-1 font-semibold', small ? 'text-sm' : 'text-2xl tabular-nums')}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
