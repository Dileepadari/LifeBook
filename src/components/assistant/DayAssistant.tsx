import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Send, Loader2, Undo2, X, Check, CircleAlert, ListTodo, HeartPulse,
  BookOpenCheck, Smile, Sparkles, PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDayAssistant } from '@/hooks/useLifeData';
import { PROVIDER_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DayProposal, UndoToken } from '@/lib/api';
import logoMark from '@/assets/logo-mark.png';

/**
 * The day assistant: describe your day in plain language, and it becomes rows.
 *
 * The point of the feature is that nobody wants to fill in six forms at 1am.
 * You type "slept 5 hours, finished the problem set, still haven't done the ML
 * assignment" and the tasks board, the wellness log, the study timer and the
 * mood check-in all end up correct.
 *
 * Two things make that safe enough to do automatically. The server splits
 * parsing from writing, so what gets written is always shown; and every apply
 * returns the ids it touched, so Undo is a real reversal rather than a second
 * guess. Auto-apply is therefore the default but not the only mode - a user who
 * would rather read first can turn it off and the same card grows an Apply
 * button instead.
 */

interface Turn {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  proposal?: DayProposal;
  provider?: string;
  degradedFrom?: string;
  /** Present once written; consumed by Undo, then cleared. */
  undo?: UndoToken;
  applied?: string[];
  undone?: boolean;
}

const STARTERS = [
  'Slept 6 hours, finished the lab report, still owe my mum a call.',
  'Studied maths for 90 minutes but got distracted a lot.',
  'Skipped the gym again. Need to book the exam slot tomorrow.',
];

const WELLNESS_LABELS: Record<string, (v: number) => string> = {
  sleep_hours: (v) => `${v}h sleep`,
  exercise_minutes: (v) => `${v} min exercise`,
  screen_time_hours: (v) => `${v}h screen time`,
  water_glasses: (v) => `${v} glasses of water`,
  meditation_minutes: (v) => `${v} min meditation`,
  had_breakfast: (v) => (v ? 'had breakfast' : 'skipped breakfast'),
};

function Chip({ icon: Icon, children, tone }: {
  icon: typeof ListTodo;
  children: React.ReactNode;
  tone: 'todo' | 'done' | 'missed' | 'neutral';
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs leading-snug',
        tone === 'todo' && 'border-primary/30 bg-primary/5',
        tone === 'done' && 'border-emerald-500/30 bg-emerald-500/5',
        tone === 'missed' && 'border-amber-500/40 bg-amber-500/5',
        tone === 'neutral' && 'border-border bg-muted/40',
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

/** Everything the server said it understood, grouped the way the user said it. */
function ProposalCard({ p }: { p: DayProposal }) {
  const wellness = Object.entries(p.wellness || {});
  const nothing =
    !p.tasks.length && !p.completed.length && !p.missed.length && !wellness.length &&
    !p.mood && !p.study && !p.journal && !p.gratitude.length;

  if (nothing) return null;

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {p.completed.map((t) => <Chip key={`c-${t}`} icon={Check} tone="done">{t}</Chip>)}
      {p.tasks.map((t) => (
        <Chip key={`t-${t.title}`} icon={ListTodo} tone="todo">
          {t.title}
          {t.priority !== 'normal' && <span className="opacity-60"> - {t.priority}</span>}
        </Chip>
      ))}
      {p.missed.map((t) => <Chip key={`m-${t}`} icon={CircleAlert} tone="missed">{t}</Chip>)}
      {Boolean(wellness.length) && (
        <Chip icon={HeartPulse} tone="neutral">
          {wellness.map(([k, v]) => WELLNESS_LABELS[k]?.(v as number) ?? `${k}: ${v}`).join(' · ')}
        </Chip>
      )}
      {p.study && (
        <Chip icon={BookOpenCheck} tone="neutral">
          {p.study.minutes} min{p.study.subject ? ` of ${p.study.subject}` : ''}
          {p.study.focus_rating ? ` · focus ${p.study.focus_rating}/5` : ''}
        </Chip>
      )}
      {p.mood && <Chip icon={Smile} tone="neutral">Mood {p.mood.score}/5{p.mood.note ? ` · ${p.mood.note}` : ''}</Chip>}
      {p.gratitude.map((g) => <Chip key={`g-${g}`} icon={Sparkles} tone="neutral">Grateful: {g}</Chip>)}
      {p.journal && <Chip icon={PenLine} tone="neutral">Added to your journal</Chip>}
    </div>
  );
}

export function DayAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [auto, setAuto] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const { parse, apply, undo } = useDayAssistant();
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [turns, reduceMotion]);

  const busy = parse.isPending || apply.isPending;

  const patch = (id: number, changes: Partial<Turn>) =>
    setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...changes } : t)));

  const applyProposal = async (turnId: number, proposal: DayProposal) => {
    const res = await apply.mutateAsync({ proposal });
    patch(turnId, { undo: res.undo, applied: res.applied, undone: false });
  };

  const send = async (raw: string) => {
    const message = raw.trim();
    if (message.length < 4 || busy) return;
    setInput('');
    setTurns((ts) => [...ts, { id: nextId.current++, role: 'user', text: message }]);

    try {
      const res = await parse.mutateAsync({ message });
      const turnId = nextId.current++;
      setTurns((ts) => [...ts, {
        id: turnId,
        role: 'assistant',
        text: res.proposal.reply,
        proposal: res.proposal,
        provider: res.provider,
        degradedFrom: res.degradedFrom,
      }]);
      if (auto) await applyProposal(turnId, res.proposal);
    } catch (err) {
      setTurns((ts) => [...ts, {
        id: nextId.current++,
        role: 'assistant',
        text: err instanceof Error ? err.message : 'That did not go through.',
      }]);
    }
  };

  return (
    <>
      {/* The orb. Deliberately the app's own mark rather than a generic chat
          bubble - it is the LifeBook writing itself, not a support widget. */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close the day assistant' : 'Tell the day assistant about your day'}
        aria-expanded={open}
        whileHover={reduceMotion ? undefined : { scale: 1.06 }}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      >
        {!reduceMotion && !open && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-primary"
            animate={{ opacity: [0.4, 0, 0.4], scale: [1, 1.35, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.img
              key="orb"
              src={logoMark}
              alt=""
              className="relative h-7 w-7 object-contain logo-mono"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
            />
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.aside
            key="panel"
            role="dialog"
            aria-label="Day assistant"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ transformOrigin: 'bottom right' }}
            className="fixed bottom-24 right-4 z-50 flex h-[min(34rem,calc(100vh-8rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:right-6"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Tell me about your day</p>
                <p className="truncate text-xs text-muted-foreground">It files the tasks, wellness and mood for you.</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Switch id="auto-apply" checked={auto} onCheckedChange={setAuto} aria-label="Apply automatically" />
                <Label htmlFor="auto-apply" className="cursor-pointer text-xs text-muted-foreground">Auto</Label>
              </div>
            </header>

            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-3 p-4">
                {!turns.length && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Say it however it comes out - what you did, what you missed, what is still owed.
                    </p>
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {turns.map((turn) => (
                  <motion.div
                    key={turn.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex flex-col', turn.role === 'user' && 'items-end')}
                  >
                    <div
                      className={cn(
                        'max-w-[92%] rounded-2xl px-3 py-2 text-sm',
                        turn.role === 'user'
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : 'rounded-bl-sm bg-muted',
                      )}
                    >
                      {turn.text}
                    </div>

                    {turn.proposal && (
                      <div className="w-full max-w-[92%]">
                        <ProposalCard p={turn.proposal} />

                        {/* Applied: report exactly what was written, and offer
                            the reversal while it is still fresh. */}
                        {turn.applied && !turn.undone && (
                          <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-emerald-500/10 px-2 py-1.5">
                            <span className="text-xs text-emerald-700 dark:text-emerald-400">
                              Saved {turn.applied.join(', ')}.
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 shrink-0 px-2 text-xs"
                              disabled={undo.isPending}
                              onClick={async () => {
                                await undo.mutateAsync(turn.undo!);
                                patch(turn.id, { undone: true });
                              }}
                            >
                              <Undo2 className="mr-1 h-3 w-3" /> Undo
                            </Button>
                          </div>
                        )}

                        {turn.undone && (
                          <p className="mt-2 text-xs text-muted-foreground">Undone - nothing was kept.</p>
                        )}

                        {!turn.applied && !turn.undone && (
                          <Button
                            size="sm"
                            className="mt-2 h-7 text-xs"
                            disabled={apply.isPending}
                            onClick={() => applyProposal(turn.id, turn.proposal!)}
                          >
                            {apply.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                            Save this
                          </Button>
                        )}
                      </div>
                    )}

                    {turn.role === 'assistant' && turn.provider && (
                      <p className="mt-1 text-[0.65rem] text-muted-foreground">
                        {turn.degradedFrom
                          ? `${PROVIDER_LABELS[turn.degradedFrom]} was unavailable - read by the built-in engine`
                          : `Read by ${PROVIDER_LABELS[turn.provider] ?? turn.provider}`}
                      </p>
                    )}
                  </motion.div>
                ))}

                {busy && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {apply.isPending ? 'Filing it away...' : 'Reading your day...'}
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends; Shift+Enter is a newline. Day briefs are
                    // usually one breathless paragraph, so sending is the
                    // common case.
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Rough day. Slept 5 hours, finished the problem set..."
                  rows={2}
                  className="max-h-32 min-h-[2.75rem] resize-none text-sm"
                />
                <Button size="icon" className="h-10 w-10 shrink-0" disabled={busy || input.trim().length < 4} onClick={() => send(input)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
