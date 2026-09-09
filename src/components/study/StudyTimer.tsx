/**
 * Focus timer for pomodoro, deep work and long blocks. It logs what was
 * actually sat through, not what was planned.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, Pause, Square, RotateCcw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useLogSession } from '@/hooks/useLifeData';
import { clock, duration, TECHNIQUE_LABELS } from '@/lib/format';
import { preventAccidentalDialogClose, cn } from '@/lib/utils';
import type { Technique } from '@/lib/api';

const PRESETS: { minutes: number; technique: Technique; label: string }[] = [
  { minutes: 25, technique: 'pomodoro', label: 'Pomodoro' },
  { minutes: 50, technique: 'deep_work', label: 'Deep work' },
  { minutes: 90, technique: 'deep_work', label: 'Long block' },
];

/**
 * A real timer that writes a real row. The session is only logged when the
 * block ends, and the rating dialog is mandatory - focus_rating and
 * distractions are the two fields the whole insight engine leans on, and a
 * session without them is a number with no meaning attached.
 */
export function StudyTimer() {
  const reduceMotion = useReducedMotion();
  const log = useLogSession();

  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const [technique, setTechnique] = useState<Technique>('pomodoro');
  const [subject, setSubject] = useState('');
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distractions, setDistractions] = useState(0);
  const [rating, setRating] = useState(4);
  const [reviewOpen, setReviewOpen] = useState(false);
  const startedAt = useRef<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          setReviewOpen(true);
          // The browser tab is very likely in the background when a block ends.
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Block finished', { body: 'Rate the session so it counts properly.' });
          }
          return 0;
        }
        return r - 1;
      });
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const reset = (minutes = plannedMinutes) => {
    setRunning(false);
    setRemaining(minutes * 60);
    setElapsed(0);
    setDistractions(0);
    startedAt.current = null;
  };

  const start = () => {
    if (!startedAt.current) startedAt.current = new Date().toISOString();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    setRunning(true);
  };

  const stopEarly = () => {
    setRunning(false);
    if (elapsed < 60) {
      toast.info('Too short to log', { description: 'Blocks under a minute are not recorded.' });
      reset();
      return;
    }
    setReviewOpen(true);
  };

  const save = async () => {
    await log.mutateAsync({
      subject: subject.trim() || null,
      technique,
      planned_minutes: plannedMinutes,
      actual_minutes: Math.round(elapsed / 60),
      focus_rating: rating,
      distractions,
      started_at: startedAt.current,
      ended_at: new Date().toISOString(),
    });
    toast.success(`${duration(Math.round(elapsed / 60))} logged`, {
      description: 'It is on today\'s page now.',
    });
    setReviewOpen(false);
    reset();
  };

  const total = plannedMinutes * 60;
  const progress = total ? 1 - remaining / total : 0;
  const circumference = 2 * Math.PI * 68;

  return (
    <div className="flex flex-col items-center">
      {/* The ring is the timer - the digits are a label on it, not the other
          way round. */}
      <div className="relative h-48 w-48">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r="68" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <motion.circle
            cx="80" cy="80" r="68" fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: circumference * (1 - progress) }}
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-semibold tabular-nums">{clock(remaining)}</span>
          <span className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {TECHNIQUE_LABELS[technique]}
          </span>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        {!running ? (
          <Button size="lg" onClick={start} className="gap-2">
            <Play className="h-4 w-4" /> {elapsed > 0 ? 'Resume' : 'Start'}
          </Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={() => setRunning(false)} className="gap-2">
            <Pause className="h-4 w-4" /> Pause
          </Button>
        )}
        <Button size="lg" variant="outline" onClick={stopEarly} disabled={elapsed === 0} className="gap-2">
          <Square className="h-4 w-4" /> Finish
        </Button>
        <Button size="icon" variant="ghost" onClick={() => reset()} aria-label="Reset timer">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {running && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDistractions((d) => d + 1)}
          className="mt-3 gap-2 text-muted-foreground"
        >
          <Zap className="h-3.5 w-3.5" />
          I got distracted ({distractions})
        </Button>
      )}

      <div className="mt-6 w-full max-w-sm space-y-4">
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={running}
              onClick={() => { setPlannedMinutes(p.minutes); setTechnique(p.technique); reset(p.minutes); }}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50',
                plannedMinutes === p.minutes && technique === p.technique
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {p.label}
              <span className="mt-0.5 block text-[0.65rem] font-normal opacity-70">{p.minutes} min</span>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Thermodynamics"
            disabled={running}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Technique</Label>
          <Select value={technique} onValueChange={(v) => setTechnique(v as Technique)} disabled={running}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TECHNIQUE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent {...preventAccidentalDialogClose}>
          <DialogHeader><DialogTitle>How did that go?</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {duration(Math.round(elapsed / 60))} of {duration(plannedMinutes)} planned
              {distractions > 0 && `, ${distractions} ${distractions === 1 ? 'interruption' : 'interruptions'}`}.
            </p>

            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <Label>Focus</Label>
                <span className="text-sm font-semibold text-primary">{rating} / 5</span>
              </div>
              <Slider value={[rating]} onValueChange={([v]) => setRating(v)} min={1} max={5} step={1} />
              <p className="mt-2 text-xs text-muted-foreground">
                Be honest - this is the number every insight about your focus is built on.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="distractions">Interruptions</Label>
              <Input
                id="distractions"
                type="number"
                min={0}
                value={distractions}
                onChange={(e) => setDistractions(Math.max(0, Number(e.target.value)))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReviewOpen(false); reset(); }}>Discard</Button>
            <Button onClick={save} disabled={log.isPending}>Log session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
