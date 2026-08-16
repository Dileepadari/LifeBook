import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, X, Loader2, Clock, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { study } from '@/lib/api';
import { clock } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CardListSkeleton } from '@/components/skeletons/pages';

interface Question { id: string; prompt: string; options: string[] }
interface ReviewRow {
  prompt: string; options: string[]; answer_index: number;
  chosen: number | null; correct: boolean; explanation: string | null;
}

export default function QuizRunner() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({ queryKey: ['quiz', id], queryFn: () => study.quiz(id) });
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<(number | null)[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState<{ score: number; total: number; rows: ReviewRow[] } | null>(null);

  const questions: Question[] = data?.questions || [];
  const limitSeconds = (data?.quiz?.time_limit_minutes || 10) * 60;

  useEffect(() => {
    if (review || !questions.length) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [review, questions.length]);

  // Time is a real constraint on an exam, so running out submits what you have
  // rather than freezing the page.
  useEffect(() => {
    if (!review && questions.length && elapsed >= limitSeconds) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, limitSeconds, review, questions.length]);

  if (isLoading) return <CardListSkeleton count={3} height="h-32" />;
  if (!data?.quiz) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">That practice test does not exist.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/study">Back to Study Now</Link></Button>
      </div>
    );
  }

  const choose = (optionIndex: number) => {
    setResponses((r) => {
      const next = [...r];
      next[index] = optionIndex;
      return next;
    });
  };

  async function submit() {
    setSubmitting(true);
    try {
      const filled = questions.map((_, i) => responses[i] ?? null);
      const res = await study.attemptQuiz(id, filled, elapsed);
      setReview({ score: res.attempt.score, total: res.attempt.total, rows: res.review });
    } finally {
      setSubmitting(false);
    }
  }

  if (review) {
    const pct = Math.round((review.score / review.total) * 100);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card>
            <CardContent className="flex flex-col items-center py-10 text-center">
              <p className="font-display text-5xl font-semibold tabular-nums">
                {review.score}<span className="text-2xl text-muted-foreground">/{review.total}</span>
              </p>
              <p className="mt-2 text-muted-foreground">
                {pct}% in {clock(elapsed)}
              </p>
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                {pct >= 80
                  ? 'Strong. Practice tests are themselves a retention technique, so this counted twice.'
                  : pct >= 50
                    ? 'Worth a second pass. The questions you missed are the ones worth turning into flashcards.'
                    : 'This material is not in memory yet. Make cards from it and let spaced repetition do the work.'}
              </p>
              <div className="mt-6 flex gap-2">
                <Button variant="outline" onClick={() => { setReview(null); setIndex(0); setResponses([]); setElapsed(0); }} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Retake
                </Button>
                <Button onClick={() => navigate('/study')}>Back to Study Now</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="space-y-3">
          {review.rows.map((row, i) => (
            <Card key={i} className={cn(row.correct ? 'border-success/40' : 'border-destructive/40')}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  {row.correct
                    ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    : <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                  <CardTitle className="text-base font-medium leading-snug">{row.prompt}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {row.options.map((opt, j) => (
                  <div
                    key={j}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                      j === row.answer_index && 'bg-success/10 text-success',
                      j === row.chosen && j !== row.answer_index && 'bg-destructive/10 text-destructive',
                    )}
                  >
                    {j === row.answer_index && <Check className="h-3.5 w-3.5 shrink-0" />}
                    {j === row.chosen && j !== row.answer_index && <X className="h-3.5 w-3.5 shrink-0" />}
                    <span>{opt}</span>
                  </div>
                ))}
                {row.explanation && (
                  <p className="pt-2 text-sm text-muted-foreground">{row.explanation}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const q = questions[index];
  const answered = responses.filter((r) => r !== null && r !== undefined).length;
  const timeLeft = Math.max(0, limitSeconds - elapsed);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-semibold">{data.quiz.title}</h1>
          <CardDescription>Question {index + 1} of {questions.length}</CardDescription>
        </div>
        <Badge variant={timeLeft < 60 ? 'destructive' : 'secondary'} className="shrink-0 gap-1.5 tabular-nums">
          <Clock className="h-3 w-3" /> {clock(timeLeft)}
        </Badge>
      </header>

      <Progress value={((index + 1) / questions.length) * 100} className="h-1.5" />

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.22 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium leading-relaxed">{q.prompt}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {q.options.map((opt, j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => choose(j)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3.5 text-left text-sm transition-colors',
                    responses[index] === j
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                      responses[index] === j ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {String.fromCharCode(65 + j)}
                  </span>
                  {opt}
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        <span className="text-xs text-muted-foreground">{answered} of {questions.length} answered</span>
        {index < questions.length - 1 ? (
          <Button onClick={() => setIndex((i) => i + 1)}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit
          </Button>
        )}
      </div>
    </div>
  );
}
