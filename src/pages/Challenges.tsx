import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, Flame, Trophy, Users, Target, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { useChallenges, useChallengeAction, useLeaderboard } from '@/hooks/useLifeData';
import { percent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Challenge } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  study: 'Study', wellness: 'Wellness', mindset: 'Mindset', social: 'Social',
};

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'bg-success/15 text-success',
  medium: 'bg-warning/20 text-warning',
  hard: 'bg-destructive/15 text-destructive',
};

export default function Challenges() {
  const { data: challenges = [], isLoading } = useChallenges();
  const { data: leaderboard = [] } = useLeaderboard();
  const action = useChallengeAction();
  const [filter, setFilter] = useState('all');

  if (isLoading) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={3} height="h-40" /></div>;
  }

  const enrolled = challenges.filter((c) => c.enrolled && !c.completed_at);
  const completed = challenges.filter((c) => c.completed_at);
  const available = challenges.filter((c) => !c.enrolled);
  const shown = filter === 'all' ? available : available.filter((c) => c.category === filter);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Challenge Hub</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Each of these targets a specific finding from the research - not a generic streak game.
          Check in daily; the chain is the point.
        </p>
      </header>

      {enrolled.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Active
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {enrolled.map((c) => (
              <ActiveChallenge
                key={c.id}
                challenge={c}
                onCheckIn={() => action.mutate({ id: c.id, action: 'checkin' })}
                onLeave={() => {
                  action.mutate({ id: c.id, action: 'unenroll' });
                  toast.info(`Left ${c.name}`);
                }}
                pending={action.isPending}
              />
            ))}
          </div>
        </section>
      )}

      <Tabs defaultValue="available">
        <TabsList>
          <TabsTrigger value="available">Available ({available.length})</TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Leaderboard
          </TabsTrigger>
          {completed.length > 0 && <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="available" className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            {['all', ...Object.keys(CATEGORY_LABELS)].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === cat ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {shown.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="hover-lift flex h-full flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{c.name}</CardTitle>
                        {c.tagline && <CardDescription className="mt-1">{c.tagline}</CardDescription>}
                      </div>
                      <Badge variant="secondary" className={cn('shrink-0 text-[0.6rem]', DIFFICULTY_STYLES[c.difficulty])}>
                        {c.difficulty}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-[0.6rem]">{CATEGORY_LABELS[c.category]}</Badge>
                        <Badge variant="outline" className="text-[0.6rem]">{c.duration_days} days</Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => action.mutate({ id: c.id, action: 'enroll' })}
                        disabled={action.isPending}
                      >
                        Start
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {shown.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {available.length === 0 ? 'You are enrolled in everything. Impressive.' : 'Nothing in that category.'}
            </p>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Everyone on this instance</CardTitle>
              <CardDescription>Ranked by total challenge days checked in.</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nobody has checked in yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {leaderboard.map((row: { id: string; rank: number; display_name: string; username: string; days: number; completed: number; is_you: boolean }) => (
                    <li
                      key={row.id}
                      className={cn('flex items-center gap-3 py-3', row.is_you && 'rounded-lg bg-primary/5 px-3')}
                    >
                      <span className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                        row.rank === 1 ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground',
                      )}>
                        {row.rank}
                      </span>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{row.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {row.display_name}
                          {row.is_you && <span className="ml-1.5 text-xs text-primary">you</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">@{row.username}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">{row.days}</p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          {row.completed} completed
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {completed.length > 0 && (
          <TabsContent value="completed" className="pt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {completed.map((c) => (
                <Card key={c.id} className="border-success/30">
                  <CardContent className="flex items-center gap-3 py-4">
                    <Trophy className="h-5 w-5 shrink-0 text-success" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        All {c.duration_days} days completed
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ActiveChallenge({
  challenge: c, onCheckIn, onLeave, pending,
}: {
  challenge: Challenge; onCheckIn: () => void; onLeave: () => void; pending: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const done = c.days_done ?? 0;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{c.name}</CardTitle>
            <CardDescription className="mt-0.5">
              Day {done} of {c.duration_days}
            </CardDescription>
          </div>
          <Button
            size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onLeave}
            aria-label={`Leave ${c.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={(c.progress ?? 0) * 100} className="h-2" />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" /> {percent(c.progress)}
          </span>
          <span>{c.duration_days - done} to go</span>
        </div>

        <Button
          className="mt-4 w-full gap-2"
          variant={c.checked_in_today ? 'secondary' : 'default'}
          onClick={onCheckIn}
          disabled={pending}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={String(c.checked_in_today)}
              initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : c.checked_in_today ? <Check className="h-4 w-4" /> : <Flame className="h-4 w-4" />}
              {c.checked_in_today ? 'Done today' : 'Check in for today'}
            </motion.span>
          </AnimatePresence>
        </Button>
      </CardContent>
    </Card>
  );
}
