import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import {
  HeartPulse, ListChecks, Target, FolderOpen, ArrowRight, BookOpen, Layers, MessageCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatTile } from '@/components/dashboard/StatTile';
import { HabitGrid } from '@/components/dashboard/HabitGrid';
import { CoachChat } from '@/components/dashboard/CoachChat';
import { DashboardSkeleton } from '@/components/skeletons/pages';
import { useDashboard, useToggleHabit, useUpdateTask } from '@/hooks/useLifeData';
import { useAuth } from '@/contexts/AuthContext';
import { useChartTheme, chartChrome } from '@/lib/chartTheme';
import { duration, shortDate, relativeDay, todayStr } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/api';

const STATUS_STYLES: Record<string, string> = {
  todo: 'bg-muted text-muted-foreground',
  ongoing: 'bg-primary/15 text-primary',
  blocked: 'bg-destructive/15 text-destructive',
  done: 'bg-success/15 text-success',
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-destructive/15 text-destructive',
  important: 'bg-warning/20 text-warning',
  normal: 'bg-muted text-muted-foreground',
  low: 'bg-muted text-muted-foreground',
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboard();
  const toggleHabit = useToggleHabit();
  const updateTask = useUpdateTask();
  const t = useChartTheme();
  const chrome = chartChrome(t);

  if (isLoading || !data) return <DashboardSkeleton />;

  const {
    tiles, week, todays_tasks: todaysTasks, previous_page: prev,
    habits, due_cards: dueCards, today_page_exists: todayPageExists,
  } = data;
  const firstName = (user?.display_name || user?.username || '').split(' ')[0];

  const chartData = week.map((d: { date: string; minutes: number; tasks: number; health: number }) => ({
    ...d,
    label: shortDate(d.date),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {relativeDay(todayStr())} - here is what the book has on you so far.
          </p>
        </div>
        <div className="flex gap-2">
          {dueCards > 0 && (
            <Button asChild variant="outline" className="gap-2">
              <Link to="/study">
                <Layers className="h-4 w-4" />
                {dueCards} {dueCards === 1 ? 'card' : 'cards'} due
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="gap-2">
            <Link to="/plan">
              Plan the day <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* The four tiles from the prototype, every number computed from real rows. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile index={0} label={tiles.health_points.label} value={tiles.health_points.value} max={tiles.health_points.max} delta={tiles.health_points.delta} icon={HeartPulse} accentClass="bg-primary/10 text-primary" />
        <StatTile index={1} label={tiles.tasks.label} value={tiles.tasks.value} max={tiles.tasks.max} delta={tiles.tasks.delta} icon={ListChecks} accentClass="bg-warning/15 text-warning" />
        <StatTile index={2} label={tiles.challenges.label} value={tiles.challenges.value} max={tiles.challenges.max} delta={tiles.challenges.delta} icon={Target} accentClass="bg-accent/15 text-accent" />
        <StatTile index={3} label={tiles.resources.label} value={tiles.resources.value} max={tiles.resources.max} delta={tiles.resources.delta} icon={FolderOpen} accentClass="bg-success/15 text-success" />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Single series, so it follows the accent and needs no legend - the
            card title names it. */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Focused minutes, last 7 days</CardTitle>
            <CardDescription>
              {duration(week.reduce((a: number, d: { minutes: number }) => a + d.minutes, 0))} in total
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...chrome.grid} />
                <XAxis dataKey="label" {...chrome.axis} />
                <YAxis {...chrome.axis} width={44} />
                <RTooltip
                  {...chrome.tooltip}
                  formatter={(value: number) => [duration(value), 'Focused']}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#focusFill)"
                  dot={{ r: 3, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: t.surface }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Today's tasks</CardTitle>
              <CardDescription>{todaysTasks.length} open</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/plan">All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todaysTasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing open. Plan tomorrow before the day ends - it is the habit with the best
                evidence behind it.
              </p>
            ) : (
              <ul className="space-y-2">
                {todaysTasks.map((task: Task, i: number) => (
                  <motion.li
                    key={task.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-2 rounded-lg border border-border p-2.5"
                  >
                    <button
                      type="button"
                      aria-label={`Mark "${task.title}" done`}
                      onClick={() =>
                        updateTask.mutate({ id: task.id, payload: { status: 'done', completed_at: new Date().toISOString() } })
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border border-muted-foreground/40 transition-colors hover:border-primary hover:bg-primary/10"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{task.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="secondary" className={cn('text-[0.6rem]', STATUS_STYLES[task.status])}>
                          {task.status}
                        </Badge>
                        {task.priority !== 'normal' && (
                          <Badge variant="secondary" className={cn('text-[0.6rem]', PRIORITY_STYLES[task.priority])}>
                            {task.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Challenges &amp; habits</CardTitle>
            <CardDescription>Thirty days per row. A gap is a broken chain.</CardDescription>
          </CardHeader>
          <CardContent>
            <HabitGrid
              habits={habits}
              onToggle={(id) => toggleHabit.mutate(id)}
              pending={toggleHabit.isPending ? toggleHabit.variables : null}
            />
          </CardContent>
        </Card>

        {/* "Previous Page of Your Life" from the prototype. */}
        <Card className="page-surface border-paper-edge">
          <CardHeader className="pb-2">
            <CardTitle className="font-display flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Previous page of your life
            </CardTitle>
            {prev && <CardDescription className="text-paper-foreground/60">{shortDate(prev.date)}</CardDescription>}
          </CardHeader>
          <CardContent>
            {!prev ? (
              // This card is deliberately the *previous* day, so today's page
              // never appears here - saying "no pages yet" when one was written
              // an hour ago is just wrong.
              todayPageExists ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-paper-foreground/60">
                    Today's page is written, but there is nothing before it yet. Come back tomorrow
                    and this is where yesterday lives.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-4 gap-2">
                    <Link to={`/lifebook/${todayStr()}`}>
                      Read today's page <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-paper-foreground/60">
                  No pages yet. Close today with the button in the corner and this fills in.
                </p>
              )
            ) : (
              <>
                {prev.title && <p className="font-display text-lg font-semibold">{prev.title}</p>}
                <p className="mt-2 line-clamp-5 text-sm leading-relaxed text-paper-foreground/80">
                  {prev.summary}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4 w-full gap-2">
                  <Link to={`/lifebook/${prev.date}`}>
                    Open full page <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Your coach
          </CardTitle>
          <CardDescription>Answers come from your own logs, not general advice.</CardDescription>
        </CardHeader>
        <CardContent>
          <CoachChat compact />
        </CardContent>
      </Card>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
