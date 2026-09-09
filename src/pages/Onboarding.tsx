/** First-run setup: name, targets and the starter habits. */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Check, Target, ListChecks, Sprout } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useProfile, useSaveProfile } from '@/hooks/useLifeData';
import { AuthSkeleton } from '@/components/skeletons/pages';
import type { Persona } from '@/lib/api';

// The three personas are verbatim from the research. Picking one seeds a
// different starter habit set server-side, so this is a real branch rather
// than a personality quiz.
const PERSONAS: { id: Persona; name: string; title: string; icon: typeof Target; blurb: string; quote: string }[] = [
  {
    id: 'exam_strategist',
    name: 'Gautam',
    title: 'The Exam Strategist',
    icon: Target,
    blurb: 'Preparing for something high-stakes. Vast syllabus, real time pressure, and a tendency to sacrifice sleep and everything social for it.',
    quote: 'Success is about disciplined preparation and maximizing every moment of study time.',
  },
  {
    id: 'organized_learner',
    name: 'Sai',
    title: 'The Organized Learner',
    icon: ListChecks,
    blurb: 'Good grades already, but the day leaks. Distraction, restarts, plans abandoned by Wednesday, and anxiety when deadlines stack.',
    quote: 'An organized approach reduces stress and keeps me prepared for anything.',
  },
  {
    id: 'growth_explorer',
    name: 'Ayushi',
    title: 'The Growth Explorer',
    icon: Sprout,
    blurb: 'Clubs, side projects, skills outside the syllabus. Overcommitted more often than underused, and struggling to keep it all coherent.',
    quote: "College is about more than academics - it's a chance to grow, learn, and make an impact.",
  },
];

const STEPS = ['Who are you closest to?', 'What are you working toward?', 'What does a good day look like?'];

export default function Onboarding() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const save = useSaveProfile();

  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [academicGoal, setAcademicGoal] = useState('');
  const [personalGoal, setPersonalGoal] = useState('');
  const [institution, setInstitution] = useState('');
  const [examDate, setExamDate] = useState('');
  const [chronotype, setChronotype] = useState<'early_bird' | 'night_owl'>('night_owl');
  const [deepWork, setDeepWork] = useState(4);
  const [sleep, setSleep] = useState(7.5);
  const [screenTime, setScreenTime] = useState(2);

  if (isLoading) return <AuthSkeleton />;
  if (profile?.onboarded_at) return <Navigate to="/dashboard" replace />;

  const canAdvance = step === 0 ? Boolean(persona) : step === 1 ? academicGoal.trim().length > 2 : true;

  const finish = async () => {
    try {
      await save.mutateAsync({
        persona,
        academic_goal: academicGoal.trim(),
        personal_goal: personalGoal.trim(),
        institution: institution.trim() || null,
        exam_date: examDate || null,
        chronotype,
        target_deep_work: deepWork,
        target_sleep: sleep,
        target_screen_time: screenTime,
        complete: true,
      });
      toast.success('Your book is open', { description: 'Starter habits have been set up for you.' });
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your setup.');
    }
  };

  return (
    <div className="book-wash min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8">
          <p className="mb-2 text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
          <h1 className="mt-6 font-display text-3xl font-semibold">{STEPS[step]}</h1>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28 }}
          >
            {step === 0 && (
              <div className="space-y-3">
                <p className="mb-4 text-sm text-muted-foreground">
                  These three came out of 22 student interviews. Pick whichever is closest - it sets
                  the habits LifeBook starts you with, and you can change all of them later.
                </p>
                {PERSONAS.map(({ id, name, title, icon: Icon, blurb, quote }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPersona(id)}
                    className={cn(
                      'w-full rounded-xl border p-5 text-left transition-all hover-lift',
                      persona === id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card',
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', persona === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {title} <span className="font-normal text-muted-foreground">- {name}</span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
                        <p className="mt-2 text-sm italic text-foreground/70">"{quote}"</p>
                      </div>
                      {persona === id && <Check className="ml-auto h-5 w-5 shrink-0 text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <Card>
                <CardContent className="space-y-5 pt-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="academic">Your academic goal</Label>
                    <Input
                      id="academic"
                      value={academicGoal}
                      onChange={(e) => setAcademicGoal(e.target.value)}
                      placeholder="Clear GATE 2027 with a top-500 rank"
                    />
                    <p className="text-xs text-muted-foreground">Specific beats aspirational - it shows up on every page.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="personal">A personal goal</Label>
                    <Input
                      id="personal"
                      value={personalGoal}
                      onChange={(e) => setPersonalGoal(e.target.value)}
                      placeholder="Sleep before midnight and actually exercise"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="institution">Institution <span className="text-muted-foreground">(optional)</span></Label>
                      <Input id="institution" value={institution} onChange={(e) => setInstitution(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="examDate">Target date <span className="text-muted-foreground">(optional)</span></Label>
                      <Input id="examDate" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardContent className="space-y-8 pt-6">
                  <div>
                    <Label className="mb-3 block">When do you actually work best?</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['early_bird', 'night_owl'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setChronotype(c)}
                          className={cn(
                            'rounded-lg border p-4 text-sm font-medium transition-colors',
                            chronotype === c ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border',
                          )}
                        >
                          {c === 'early_bird' ? 'Early bird' : 'Night owl'}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      18 of 22 students interviewed were night owls, and reported the worst sleep consistency. No judgement - it just changes the advice.
                    </p>
                  </div>

                  <TargetSlider
                    label="Deep work target"
                    value={deepWork}
                    onChange={setDeepWork}
                    min={1} max={10} step={0.5}
                    format={(v) => `${plural(v, 'hour')} a day`}
                    hint="Focused, uninterrupted study - not time at the desk."
                  />
                  <TargetSlider
                    label="Sleep target"
                    value={sleep}
                    onChange={setSleep}
                    min={5} max={10} step={0.5}
                    format={(v) => `${plural(v, 'hour')} a night`}
                    hint="Everything else on your page moves with this one."
                  />
                  <TargetSlider
                    label="Screen time limit"
                    value={screenTime}
                    onChange={setScreenTime}
                    min={0.5} max={8} step={0.5}
                    format={(v) => `${plural(v, 'hour')} a day`}
                    hint="Recreational only - study on a screen doesn't count."
                  />
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Open my LifeBook
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TargetSlider({
  label, value, onChange, min, max, step, format, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format: (v: number) => string; hint: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-semibold tabular-nums text-primary">{format(value)}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
