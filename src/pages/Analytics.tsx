/**
 * The answer to "students cannot see their own progress": focus over time, by
 * weekday and by subject, sleep against focus rating, and the same numbers as a
 * table for anyone who would rather read them.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import { Sparkles, Loader2, TableIcon, LineChart as LineChartIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { CoachChat } from '@/components/dashboard/CoachChat';
import { useAnalytics, useGenerateInsights } from '@/hooks/useLifeData';
import { useChartTheme, chartChrome } from '@/lib/chartTheme';
import { duration, shortDate, percent, plural, PROVIDER_LABELS, MOOD_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';

const RANGES = [7, 30, 90];

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAnalytics(days);
  const generate = useGenerateInsights();
  const t = useChartTheme();
  const chrome = chartChrome(t);

  if (isLoading || !data) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={3} height="h-64" /></div>;
  }

  const { analytics: a, daily } = data;

  const dailyRows = daily.map((d: { date: string; minutes: number; focus: number | null; sleep: number | null; mood: number | null; tasks: number }) => ({
    ...d,
    label: shortDate(d.date),
  }));

  const weekdayRows = a.study.byWeekday.map((w: { name: string; minutes: number }) => ({
    name: w.name.slice(0, 3),
    minutes: Math.round(w.minutes),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Analytics</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            "They dont measure their life hence cant see their improvements/backlogs." This page is
            the answer to that line.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                days === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Total focus"
          value={duration(a.study.totalMinutes)}
          delta={a.study.deltaPct}
          // duration(), not hours() - "0h a day average" reads as though
          // nothing was logged when the real figure is a few minutes.
          hint={`${duration(a.study.totalMinutes / days)} a day average`}
        />
        <Kpi
          label="Plan accuracy"
          value={percent(a.tasks.completionRate)}
          hint={`${a.tasks.completed} of ${plural(a.tasks.created, 'task')}`}
        />
        <Kpi
          label="Average sleep"
          value={a.wellness.avgSleep != null ? `${a.wellness.avgSleep.toFixed(1)}h` : '-'}
          hint={a.wellness.daysLogged ? `${plural(a.wellness.daysLogged, 'day')} logged` : 'nothing logged'}
        />
        <Kpi
          label="Average mood"
          value={a.mood.average != null ? `${a.mood.average.toFixed(1)}/5` : '-'}
          hint={a.mood.count ? `${plural(a.mood.lowDays, 'low day')}` : 'no check-ins'}
        />
      </section>

      <Tabs defaultValue="chart">
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="chart" className="gap-1.5"><LineChartIcon className="h-3.5 w-3.5" /> Charts</TabsTrigger>
            {/* The table view is the relief for the light-mode contrast warning
                on two chart slots - identity is never colour-alone. */}
            <TabsTrigger value="table" className="gap-1.5"><TableIcon className="h-3.5 w-3.5" /> Table</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chart" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Daily focus</CardTitle>
              <CardDescription>Minutes of logged, focused study</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dailyRows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="anFocus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...chrome.grid} />
                  <XAxis dataKey="label" {...chrome.axis} interval="preserveStartEnd" />
                  <YAxis {...chrome.axis} width={44} />
                  <RTooltip {...chrome.tooltip} formatter={(v: number) => [duration(v), 'Focused']} />
                  <Area type="monotone" dataKey="minutes" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#anFocus)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Focus by weekday</CardTitle>
                <CardDescription>
                  {a.study.bestDay
                    ? `${a.study.bestDay.name} is your strongest day. Put the hard subjects where the capacity already is.`
                    : 'Not enough data yet.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weekdayRows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...chrome.grid} />
                    <XAxis dataKey="name" {...chrome.axis} />
                    <YAxis {...chrome.axis} width={40} />
                    <RTooltip {...chrome.tooltip} cursor={{ fill: t.grid, fillOpacity: 0.3 }} formatter={(v: number) => [duration(v), 'Average']} />
                    <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Two series - legend present, both named in the tooltip. */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Sleep and focus rating</CardTitle>
                <CardDescription>
                  {a.correlations.sleepFocus != null
                    ? `Correlation in your own logs: r = ${a.correlations.sleepFocus.toFixed(2)}`
                    : 'Log both for a few more days and the correlation appears here.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dailyRows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...chrome.grid} />
                    <XAxis dataKey="label" {...chrome.axis} interval="preserveStartEnd" />
                    <YAxis {...chrome.axis} width={36} domain={[0, 10]} />
                    <RTooltip {...chrome.tooltip} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: t.textSecondary, paddingTop: 8 }}
                      formatter={(v) => (v === 'sleep' ? 'Sleep (hours)' : 'Focus rating (1-5)')}
                    />
                    {/* Dots need an explicit fill: the recharts default is white,
                        which on a light card paints the line out from under itself. */}
                    <Line type="monotone" dataKey="sleep" stroke={t.series[0]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: t.series[0] }} connectNulls />
                    <Line type="monotone" dataKey="focus" stroke={t.series[1]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: t.series[1] }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {a.study.bySubject.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Time by subject</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={Math.max(160, a.study.bySubject.length * 42)}>
                  <BarChart
                    data={a.study.bySubject.sort((x: { minutes: number }, y: { minutes: number }) => y.minutes - x.minutes)}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid {...chrome.grid} horizontal={false} vertical />
                    <XAxis type="number" {...chrome.axis} />
                    <YAxis type="category" dataKey="subject" {...chrome.axis} width={120} />
                    <RTooltip {...chrome.tooltip} cursor={{ fill: t.grid, fillOpacity: 0.3 }} formatter={(v: number) => [duration(v), 'Focused']} />
                    <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="table" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Focused</TableHead>
                      <TableHead className="text-right">Focus rating</TableHead>
                      <TableHead className="text-right">Sleep</TableHead>
                      <TableHead className="text-right">Mood</TableHead>
                      <TableHead className="text-right">Tasks done</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...dailyRows].reverse().map((d) => (
                      <TableRow key={d.date}>
                        <TableCell className="font-medium">{d.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.minutes ? duration(d.minutes) : '-'}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.focus != null ? d.focus.toFixed(1) : '-'}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.sleep != null ? `${d.sleep}h` : '-'}</TableCell>
                        <TableCell className="text-right">{d.mood != null ? MOOD_LABELS[Math.round(d.mood) - 1] : '-'}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.tasks || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Insights</CardTitle>
              <CardDescription>Every claim traced to a number above.</CardDescription>
            </div>
            <Button size="sm" onClick={() => generate.mutate(days)} disabled={generate.isPending}>
              {generate.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {generate.data ? 'Refresh' : 'Analyse'}
            </Button>
          </CardHeader>
          <CardContent>
            {!generate.data ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Run an analysis of the last {days} days.
              </p>
            ) : (
              <div className="space-y-3">
                {generate.data.insights.map((ins: { title: string; body: string; tone: string }, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={cn(
                      'rounded-lg border-l-2 bg-muted/40 p-3',
                      ins.tone === 'warning' ? 'border-l-warning' : ins.tone === 'positive' ? 'border-l-success' : 'border-l-border',
                    )}
                  >
                    <p className="text-sm font-medium">{ins.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{ins.body}</p>
                  </motion.div>
                ))}
                {generate.data.suggestions?.length > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="text-sm font-medium">What to do about it</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {generate.data.suggestions.map((s: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Badge variant="outline" className="text-[0.65rem]">
                  {PROVIDER_LABELS[generate.data.provider] || generate.data.provider}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Ask about it</CardTitle>
            <CardDescription>The coach reads the same numbers.</CardDescription>
          </CardHeader>
          <CardContent>
            <CoachChat />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, hint }: { label: string; value: string; delta?: number | null; hint?: string }) {
  const Icon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-display mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {delta != null ? (
          <p className={cn('mt-1 flex items-center gap-1 text-xs', delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground')}>
            <Icon className="h-3 w-3" />
            <span className="tabular-nums">{Math.abs(delta)}%</span>
            <span className="text-muted-foreground">vs previous period</span>
          </p>
        ) : hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
