import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Lock, LockOpen, RefreshCw, Loader2, BookOpen, Sparkles, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LifePage } from '@/components/lifebook/LifePage';
import { CardListSkeleton } from '@/components/skeletons/pages';
import { useLifePage, useLifePages, useGeneratePage, useSealPage, useDaySnapshot } from '@/hooks/useLifeData';
import { lifebook } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { todayStr, longDate, duration, PROVIDER_LABELS } from '@/lib/format';

export default function LifePageView() {
  const { date = todayStr() } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: page, isLoading } = useLifePage(date);
  const { data: allPages = [] } = useLifePages();
  const { data: snapshot } = useDaySnapshot(date);
  const generate = useGeneratePage();
  const seal = useSealPage();
  const [direction, setDirection] = useState(0);

  // Neighbours come from the pages that actually exist, so paging never lands
  // on an empty day in the middle of the book.
  const dates = allPages.map((p) => p.date).sort();
  const index = dates.indexOf(date);
  const prevDate = index > 0 ? dates[index - 1] : null;
  const nextDate = index >= 0 && index < dates.length - 1 ? dates[index + 1] : null;

  const goTo = (target: string, dir: number) => {
    setDirection(dir);
    navigate(`/lifebook/${target}`);
  };

  const write = async (force = false) => {
    try {
      const res = await generate.mutateAsync({ date, force });
      toast.success('Page written', { description: PROVIDER_LABELS[res.provider] || res.provider });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not write the page.');
    }
  };

  const unseal = async () => {
    await lifebook.unseal(date);
    qc.invalidateQueries({ queryKey: ['lifepage', date] });
    qc.invalidateQueries({ queryKey: ['lifebook-stats'] });
    toast.info('Page unsealed', { description: 'You can rewrite it now.' });
  };

  if (isLoading) return <CardListSkeleton count={1} height="h-96" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" className="gap-2">
          <Link to="/lifebook"><ArrowLeft className="h-4 w-4" /> The whole book</Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => prevDate && goTo(prevDate, -1)}
            disabled={!prevDate}
            className="gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Previous
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => nextDate && goTo(nextDate, 1)}
            disabled={!nextDate}
            className="gap-1.5"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          {page && !page.sealed_at && (
            <>
              <Button variant="outline" size="sm" onClick={() => write(false)} disabled={generate.isPending} className="gap-1.5">
                {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Rewrite
              </Button>
              <Button size="sm" onClick={() => seal.mutate(date)} disabled={seal.isPending} className="gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Seal
              </Button>
            </>
          )}

          {page?.sealed_at && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <LockOpen className="h-3.5 w-3.5" /> Unseal
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unseal this page?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sealed pages are the ones bound into a printed book. Unsealing lets you rewrite
                    the day, which means the version you already read will be gone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it sealed</AlertDialogCancel>
                  <AlertDialogAction onClick={unseal}>Unseal</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={date}
          custom={direction}
          initial={{ opacity: 0, rotateY: direction >= 0 ? 12 : -12, x: direction >= 0 ? 40 : -40 }}
          animate={{ opacity: 1, rotateY: 0, x: 0 }}
          exit={{ opacity: 0, x: direction >= 0 ? -40 : 40 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ perspective: 1600 }}
        >
          {page ? (
            <LifePage page={page} />
          ) : (
            <EmptyDay date={date} snapshot={snapshot} onWrite={() => write(false)} pending={generate.isPending} />
          )}
        </motion.div>
      </AnimatePresence>

      {page && (
        <div className="flex justify-center">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Link to="/lifebook/print"><Printer className="h-3.5 w-3.5" /> Print the whole book</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/** Shown when a date has no page yet. Rather than an empty state, it shows what
 *  the day actually contains - so the choice to write it is informed. */
function EmptyDay({
  date, snapshot, onWrite, pending,
}: {
  date: string;
  snapshot?: {
    study: { totalMinutes: number; sessionCount: number };
    tasks: { completed: number; planned: number };
    wellness: { sleep_hours: number | null } | null;
    journal: unknown;
    habits: { doneToday: number; total: number };
  };
  onWrite: () => void;
  pending: boolean;
}) {
  const hasAnything =
    snapshot &&
    (snapshot.study.totalMinutes > 0 ||
      snapshot.tasks.completed > 0 ||
      snapshot.wellness ||
      snapshot.journal ||
      snapshot.habits.doneToday > 0);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="flex flex-col items-center py-14 text-center">
        <BookOpen className="mb-4 h-9 w-9 text-muted-foreground" />
        <p className="font-display text-xl font-semibold">No page for {longDate(date)}</p>

        {hasAnything ? (
          <>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              There is enough here to write one:
              {snapshot.study.totalMinutes > 0 && ` ${duration(snapshot.study.totalMinutes)} focused,`}
              {snapshot.tasks.planned > 0 && ` ${snapshot.tasks.completed}/${snapshot.tasks.planned} tasks,`}
              {snapshot.wellness?.sleep_hours != null && ` ${snapshot.wellness.sleep_hours}h sleep,`}
              {snapshot.habits.total > 0 && ` ${snapshot.habits.doneToday}/${snapshot.habits.total} habits`}
              .
            </p>
            <Button onClick={onWrite} disabled={pending} className="mt-6 gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Write this page
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Nothing was logged that day, so there is nothing to write about. A page needs a day
              behind it.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/dashboard">Back to today</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
