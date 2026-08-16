import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import { Moon, Droplets, Activity, Smartphone, Sun, Utensils, Brain, Loader2, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { useWellness, useSaveWellness, useProfile } from '@/hooks/useLifeData';
import { useChartTheme, chartChrome } from '@/lib/chartTheme';
import { todayStr, shortDate, clock, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { WellnessLog } from '@/lib/api';

export default function Wellness() {
  const date = todayStr();
  const { data: logs = [], isLoading } = useWellness();
  const { data: profile } = useProfile();
  const save = useSaveWellness();
  const t = useChartTheme();
  const chrome = chartChrome(t);

  const todayLog = logs.find((l) => l.date === date);

  const [form, setForm] = useState<Partial<WellnessLog>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (todayLog) setForm(todayLog);
  }, [todayLog]);

  const value = <K extends keyof WellnessLog>(key: K, fallback: WellnessLog[K]) =>
    (form[key] ?? todayLog?.[key] ?? fallback) as WellnessLog[K];

  const set = (patch: Partial<WellnessLog>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  const commit = async () => {
    await save.mutateAsync({ date, payload: form });
    setDirty(false);
    toast.success('Logged', { description: "It's on today's page." });
  };

  if (isLoading) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={3} height="h-48" /></div>;
  }

  const points = save.data?.health_points ?? computeLocalPoints(form, todayLog, profile);

  const chartData = logs.map((l) => ({
    label: shortDate(l.date),
    sleep: l.sleep_hours,
    exercise: l.exercise_minutes,
    screen: l.screen_time_hours,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Health Booster</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Sleep, movement and screen time are upstream of every academic number you care about.
            Log them and the correlation becomes visible instead of theoretical.
          </p>
        </div>
        {dirty && (
          <Button onClick={commit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save today
          </Button>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Today</CardTitle>
            <CardDescription>Changes save when you press the button - nothing is lost on a refresh.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-7 pt-4">
            <MetricSlider
              icon={Moon} label="Sleep" unit="hours"
              value={value('sleep_hours', 7) ?? 7}
              onChange={(v) => set({ sleep_hours: v })}
              min={0} max={12} step={0.5}
              target={profile?.target_sleep}
            />
            <MetricSlider
              icon={Activity} label="Exercise" unit="minutes"
              value={value('exercise_minutes', 0)}
              onChange={(v) => set({ exercise_minutes: v })}
              min={0} max={180} step={5}
              target={30}
            />
            <MetricSlider
              icon={Smartphone} label="Recreational screen time" unit="hours"
              value={value('screen_time_hours', 2) ?? 2}
              onChange={(v) => set({ screen_time_hours: v })}
              min={0} max={12} step={0.5}
              target={profile?.target_screen_time}
              lowerIsBetter
            />
            <MetricSlider
              icon={Droplets} label="Water" unit="glasses"
              value={value('water_glasses', 0)}
              onChange={(v) => set({ water_glasses: v })}
              min={0} max={15} step={1}
              target={8}
            />
            <MetricSlider
              icon={Brain} label="Mindfulness" unit="minutes"
              value={value('meditation_minutes', 0)}
              onChange={(v) => set({ meditation_minutes: v })}
              min={0} max={90} step={5}
              target={10}
            />
            <MetricSlider
              icon={Sun} label="Daylight" unit="minutes"
              value={value('sunlight_minutes', 0)}
              onChange={(v) => set({ sunlight_minutes: v })}
              min={0} max={240} step={10}
              target={20}
            />

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Utensils className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Breakfast</p>
                  <p className="text-xs text-muted-foreground">
                    The interviews asked about this directly - skippers clustered at the bottom on physical health.
                  </p>
                </div>
              </div>
              <Switch
                checked={Boolean(value('had_breakfast', 0))}
                onCheckedChange={(v) => set({ had_breakfast: v ? 1 : 0 })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Anything else</Label>
              <Textarea
                id="notes"
                rows={2}
                value={value('notes', '') || ''}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Skipped lunch, headache from 4pm..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Health Points</CardTitle>
              <CardDescription>Weighted against your own targets, not a generic ideal.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="font-display text-5xl font-semibold tabular-nums">{points}</span>
                <span className="pb-2 text-muted-foreground">/ 100</span>
              </div>
              <Progress value={points} className="mt-3 h-2" />
              <p className="mt-3 text-xs text-muted-foreground">
                Sleep 30, exercise 20, water 15, screen time 15, mindfulness 10, breakfast 10.
              </p>
            </CardContent>
          </Card>

          <MeditationTimer onComplete={(mins) => set({ meditation_minutes: (value('meditation_minutes', 0) || 0) + mins })} />
        </div>
      </div>

      {logs.length >= 2 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Single series each - the card title names it, so no legend needed. */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Sleep, last 30 days</CardTitle>
              <CardDescription>Target {profile?.target_sleep ?? 7.5} hours</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={t.series[0]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={t.series[0]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...chrome.grid} />
                  <XAxis dataKey="label" {...chrome.axis} />
                  <YAxis {...chrome.axis} width={40} />
                  <RTooltip {...chrome.tooltip} formatter={(v: number) => [plural(v, 'hour'), 'Sleep']} />
                  <Area type="monotone" dataKey="sleep" stroke={t.series[0]} strokeWidth={2} fill="url(#sleepFill)" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Two series: legend present, tooltip names both - identity is never
              colour-alone (see the light-mode contrast relief rule). */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Movement and screen time</CardTitle>
              <CardDescription>Minutes moved against hours on a screen</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={2}>
                  <CartesianGrid {...chrome.grid} />
                  <XAxis dataKey="label" {...chrome.axis} />
                  <YAxis {...chrome.axis} width={40} />
                  <RTooltip {...chrome.tooltip} cursor={{ fill: t.grid, fillOpacity: 0.3 }} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: t.textSecondary, paddingTop: 8 }}
                    formatter={(v) => (v === 'exercise' ? 'Exercise (min)' : 'Screen time (h)')}
                  />
                  <Bar dataKey="exercise" fill={t.series[2]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="screen" fill={t.series[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function MetricSlider({
  icon: Icon, label, unit, value, onChange, min, max, step, target, lowerIsBetter,
}: {
  icon: typeof Moon; label: string; unit: string; value: number;
  onChange: (v: number) => void; min: number; max: number; step: number;
  target?: number | null; lowerIsBetter?: boolean;
}) {
  const meetsTarget = target == null ? null : lowerIsBetter ? value <= target : value >= target;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </Label>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tabular-nums">{value} {unit}</span>
          {meetsTarget !== null && (
            <span className={cn('text-xs', meetsTarget ? 'text-success' : 'text-muted-foreground')}>
              target {target}
            </span>
          )}
        </div>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}

/** A working guided-breathing timer. 4-7-8, because it needs no equipment and
 *  the interviews found nobody was doing anything at all. */
function MeditationTimer({ onComplete }: { onComplete: (minutes: number) => void }) {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const phase = seconds % 19;
  const stage = phase < 4 ? 'Breathe in' : phase < 11 ? 'Hold' : 'Breathe out';
  const scale = phase < 4 ? 1 + (phase / 4) * 0.35 : phase < 11 ? 1.35 : 1.35 - ((phase - 11) / 8) * 0.35;

  const finish = () => {
    setRunning(false);
    const mins = Math.round(seconds / 60);
    if (mins > 0) {
      onComplete(mins);
      toast.success(`${plural(mins, 'minute')} of mindfulness added`);
    }
    setSeconds(0);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Guided breathing</CardTitle>
        <CardDescription>4-7-8. Ten minutes is the whole intervention.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center pt-2">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <motion.div
            animate={{ scale: running ? scale : 1 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full bg-primary/15"
          />
          <div className="relative text-center">
            <p className="text-sm font-medium">{running ? stage : 'Ready'}</p>
            <p className="text-xs tabular-nums text-muted-foreground">{clock(seconds)}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant={running ? 'secondary' : 'default'} onClick={() => setRunning((r) => !r)} className="gap-1.5">
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {running ? 'Pause' : 'Start'}
          </Button>
          <Button size="sm" variant="outline" onClick={finish} disabled={seconds < 60}>
            Log it
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Mirrors server/analytics.js healthPoints so the number does not sit at 0
 *  until the first save round-trips. */
function computeLocalPoints(
  form: Partial<WellnessLog>,
  saved: WellnessLog | undefined,
  profile: { target_sleep?: number; target_screen_time?: number } | undefined,
) {
  const w = { ...saved, ...form };
  if (!w || Object.keys(w).length === 0) return 0;
  const targetSleep = profile?.target_sleep ?? 7.5;
  const targetScreen = profile?.target_screen_time ?? 2;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const parts = [
    { weight: 30, value: w.sleep_hours != null ? clamp(w.sleep_hours / targetSleep) : 0 },
    { weight: 20, value: clamp((w.exercise_minutes || 0) / 30) },
    { weight: 15, value: clamp((w.water_glasses || 0) / 8) },
    { weight: 15, value: w.screen_time_hours != null ? clamp(2 - w.screen_time_hours / targetScreen) : 0.5 },
    { weight: 10, value: clamp((w.meditation_minutes || 0) / 10) },
    { weight: 10, value: w.had_breakfast ? 1 : 0 },
  ];
  return Math.round(parts.reduce((a, p) => a + p.weight * p.value, 0));
}
