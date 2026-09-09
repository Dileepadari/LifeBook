/**
 * Mood logging and the three interventions with evidence behind them, with
 * helplines one tap away. Deliberately the least gamified screen in the app.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Phone, ExternalLink, Plus, Trash2, Wind, Loader2, LifeBuoy, MessageCircleHeart, Footprints,
  Frown, Annoyed, Meh, Smile, Laugh,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLogMood, useMoods, useSupport, useSOSContactAction } from '@/hooks/useLifeData';
import { useChartTheme, chartChrome } from '@/lib/chartTheme';
import { MOOD_LABELS, shortDate, clock } from '@/lib/format';
import { cn } from '@/lib/utils';

// Icons rather than emoji: the set renders identically on every platform, and
// it inherits the theme colour instead of carrying its own.
const MOOD_FACES = [Frown, Annoyed, Meh, Smile, Laugh];

const TRIGGERS = [
  'tired', 'behind', 'exam pressure', 'lonely', 'family', 'money',
  'comparison', 'health', 'overwhelmed', 'no reason',
];

// Small, immediately-doable actions. Deliberately not "cheer up" advice - each
// is a physical or social act with evidence behind it.
const COPING = [
  { icon: Wind, title: 'Breathe for two minutes', body: 'Four in, seven hold, eight out. It moves your nervous system, not your mood directly - that is the point.' },
  { icon: Footprints, title: 'Walk outside, ten minutes', body: 'Daylight and movement together. The research review put both upstream of mood and focus.' },
  { icon: MessageCircleHeart, title: 'Message one person', body: 'Not about how you feel, necessarily. The contact is the intervention.' },
];

export default function FeelingLow() {
  const [score, setScore] = useState(3);
  const [note, setNote] = useState('');
  const [triggers, setTriggers] = useState<string[]>([]);
  const [breathing, setBreathing] = useState(false);

  const logMood = useLogMood();
  const { data: moods = [] } = useMoods();
  const { data: support } = useSupport();
  const t = useChartTheme();
  const chrome = chartChrome(t);
  const reduceMotion = useReducedMotion();

  const submit = async () => {
    await logMood.mutateAsync({ score, note: note.trim() || undefined, triggers });
    toast.success('Logged', {
      description: score <= 2 ? 'Noted honestly. That is the useful thing.' : "It's on today's page.",
    });
    setNote('');
    setTriggers([]);
  };

  const recentLow = moods.filter((m) => m.score <= 2).length;
  const chartData = moods.map((m) => ({ label: shortDate(m.date), score: m.score }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Feeling low?</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          A bad day is data, not a failure. Log it honestly - the pattern over weeks is what
          actually tells you something.
        </p>
      </header>

      {/* Crisis help sits above everything else on this page. Someone who needs
          it should not have to scroll past a mood chart to find it. */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-start gap-3">
            <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold">Need someone right now?</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Free, confidential, 24 hours a day. You do not have to be in crisis to call.
              </p>
            </div>
          </div>
          <SOSDialog contacts={support?.contacts || []} resources={support?.resources || []} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>How are you, honestly?</CardTitle>
            <CardDescription>Nobody else sees this.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="flex justify-between gap-2">
              {MOOD_FACES.map((Face, i) => (
                <motion.button
                  key={i}
                  type="button"
                  onClick={() => setScore(i + 1)}
                  whileHover={reduceMotion ? undefined : { scale: 1.08 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors',
                    score === i + 1 ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted',
                  )}
                  aria-pressed={score === i + 1}
                >
                  <Face className="h-6 w-6" aria-hidden />
                  <span className="text-[0.65rem] text-muted-foreground">{MOOD_LABELS[i]}</span>
                </motion.button>
              ))}
            </div>

            <div>
              <Label className="mb-2 block">What is behind it?</Label>
              <div className="flex flex-wrap gap-2">
                {TRIGGERS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTriggers((s) => (s.includes(tag) ? s.filter((x) => x !== tag) : [...s, tag]))}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition-colors',
                      triggers.includes(tag)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">Anything you want to say</Label>
              <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <Button onClick={submit} disabled={logMood.isPending} className="w-full">
              {logMood.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log how I feel
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Three things that help</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {COPING.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-3 rounded-lg border border-border p-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full gap-2" onClick={() => setBreathing(true)}>
                <Wind className="h-4 w-4" /> Start breathing
              </Button>
            </CardContent>
          </Card>

          {recentLow >= 3 && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="py-4">
                <p className="text-sm font-medium">
                  {recentLow} low days in the last month.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A pattern rather than a bad day. 37.7% of Indian university students report moderate
                  depression and most never mention it to anyone. Talking to a counsellor is a normal
                  thing to do, not an escalation.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {moods.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Mood over the last 30 days</CardTitle>
            <CardDescription>1 is very low, 5 is great.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={200}>
              {/* The left margin only trims the gap the axis leaves; pulling it
                  further than the axis is wide clips the tick labels away. */}
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid {...chrome.grid} />
                <XAxis dataKey="label" {...chrome.axis} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...chrome.axis} width={34} />
                <RTooltip
                  {...chrome.tooltip}
                  formatter={(v: number) => [MOOD_LABELS[v - 1] || v, 'Mood']}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: t.surface }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Where to get real help</CardTitle>
          <CardDescription>Verified helplines. Free and confidential.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(support?.resources || []).map((r: { id: string; name: string; description: string; phone: string | null; url: string | null }) => (
            <div key={r.id} className="rounded-lg border border-border p-4">
              <p className="font-medium">{r.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.phone && (
                  <Button asChild size="sm" variant="secondary" className="gap-1.5">
                    <a href={`tel:${r.phone.replace(/[^+\d]/g, '')}`}>
                      <Phone className="h-3.5 w-3.5" /> {r.phone}
                    </a>
                  </Button>
                )}
                {r.url && (
                  <Button asChild size="sm" variant="ghost" className="gap-1.5">
                    <a href={r.url} target="_blank" rel="noreferrer">
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <BreathingOverlay open={breathing} onClose={() => setBreathing(false)} />
    </div>
  );
}

function SOSDialog({
  contacts, resources,
}: {
  contacts: { id: string; name: string; phone: string | null; relation: string | null }[];
  resources: { id: string; name: string; phone: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const action = useSOSContactAction();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await action.mutateAsync({ action: 'create', payload: { name: name.trim(), phone: phone.trim(), relation: relation.trim() } });
    setName(''); setPhone(''); setRelation('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="lg" className="gap-2">
          <LifeBuoy className="h-4 w-4" /> SOS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Reach someone now</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Your people</p>
            {contacts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                No contacts saved. Add one now, while you are calm - that is the whole point of doing it in advance.
              </p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      {c.relation && <p className="text-xs text-muted-foreground">{c.relation}</p>}
                    </div>
                    {c.phone && (
                      <Button asChild size="sm" className="gap-1.5">
                        <a href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}><Phone className="h-3.5 w-3.5" /> Call</a>
                      </Button>
                    )}
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => action.mutate({ action: 'remove', id: c.id })}
                      aria-label={`Remove ${c.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={add} className="space-y-2 rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium">Add a contact</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input placeholder="Relation" value={relation} onChange={(e) => setRelation(e.target.value)} />
            </div>
            <Button type="submit" size="sm" variant="outline" className="gap-1.5" disabled={!name.trim()}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </form>

          <div>
            <p className="mb-2 text-sm font-medium">Helplines</p>
            <ul className="space-y-2">
              {resources.filter((r) => r.phone).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                  <span className="text-sm">{r.name}</span>
                  <Button asChild size="sm" variant="secondary" className="gap-1.5">
                    <a href={`tel:${r.phone!.replace(/[^+\d]/g, '')}`}>
                      <Phone className="h-3.5 w-3.5" /> {r.phone}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/**
 * Full-screen 4-7-8 breathing guide. One interval, owned by this component, so
 * it starts when the overlay opens and is cleared when it closes.
 */
function BreathingOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  // 4 in, 7 hold, 8 out = a 19-second cycle.
  const phase = seconds % 19;
  const stage = phase < 4 ? 'Breathe in' : phase < 11 ? 'Hold' : 'Breathe out';
  const scale = phase < 4 ? 1.4 : phase < 11 ? 1.4 : 1;
  const stageDuration = phase < 4 ? 4 : phase < 11 ? 0.2 : 8;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-label="Breathing exercise"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur"
        >
          <motion.div
            animate={{ scale: reduceMotion ? 1 : scale }}
            transition={{ duration: reduceMotion ? 0 : stageDuration, ease: 'easeInOut' }}
            className="flex h-44 w-44 items-center justify-center rounded-full bg-primary/20"
          >
            <span className="font-display text-xl">{stage}</span>
          </motion.div>

          <p className="mt-8 text-sm tabular-nums text-muted-foreground">{clock(seconds)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Tap anywhere to stop</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
