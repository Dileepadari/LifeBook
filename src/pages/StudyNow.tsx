/** Focus timer, the cards due today, and the generator for new study material. */
import { Link } from 'react-router-dom';
import { Music, Timer, Layers, Sparkles, History, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StudyTimer } from '@/components/study/StudyTimer';
import { FlashcardReview } from '@/components/study/FlashcardReview';
import { GenerateStudio } from '@/components/study/GenerateStudio';
import { useSessions, useQuizAttempts } from '@/hooks/useLifeData';
import { duration, relativeDay, TECHNIQUE_LABELS } from '@/lib/format';
import type { StudySession } from '@/lib/api';

// Focus playlists. These are links out, not an embedded player - LifeBook has
// no business proxying someone else's audio, and an iframe player would need
// third-party cookies for something the OS already does well.
const PLAYLISTS = [
  { name: 'Lo-fi beats', url: 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn' },
  { name: 'Deep focus', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ' },
  { name: 'Brown noise', url: 'https://www.youtube.com/results?search_query=brown+noise+study' },
  { name: 'Classical study', url: 'https://open.spotify.com/playlist/37i9dQZF1DWWEJlAGA9gs0' },
];

export default function StudyNow() {
  const { data: sessions = [] } = useSessions();
  const { data: attempts = [] } = useQuizAttempts();

  const todaySessions = sessions.filter((s) => s.date === new Date().toISOString().slice(0, 10));
  const todayMinutes = todaySessions.reduce((a, s) => a + s.actual_minutes, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Study Now</h1>
        <p className="mt-1 text-muted-foreground">
          {todayMinutes > 0
            ? `${duration(todayMinutes)} focused today across ${todaySessions.length} ${todaySessions.length === 1 ? 'block' : 'blocks'}.`
            : 'Nothing logged today. One block is enough to start the record.'}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Timer className="h-4 w-4" /> Focus block</CardTitle>
            <CardDescription>Deep work is measured, not estimated.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <StudyTimer />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Layers className="h-4 w-4" /> Review queue</CardTitle>
            <CardDescription>
              Spaced repetition, SM-2. Cards come back the day before you would forget them.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <FlashcardReview />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Make study material</CardTitle>
          <CardDescription>
            Turn what you already have into cards, a practice test or a map of the topic.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <GenerateStudio />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Recent blocks</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No sessions logged yet.</p>
            ) : (
              <Tabs defaultValue="sessions">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sessions">Focus blocks</TabsTrigger>
                  <TabsTrigger value="tests">Practice tests</TabsTrigger>
                </TabsList>

                <TabsContent value="sessions" className="pt-3">
                  <ul className="divide-y divide-border">
                    {sessions.slice(0, 12).map((s: StudySession) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.subject || 'Untitled block'}</p>
                          <p className="text-xs text-muted-foreground">
                            {relativeDay(s.date)} - {TECHNIQUE_LABELS[s.technique] || s.technique}
                            {s.distractions > 0 && ` - ${s.distractions} interruptions`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {s.focus_rating && (
                            <Badge variant="secondary" className="tabular-nums">{s.focus_rating}/5</Badge>
                          )}
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {duration(s.actual_minutes)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </TabsContent>

                <TabsContent value="tests" className="pt-3">
                  {attempts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No practice tests taken yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {attempts.map((a: { id: string; title: string; date: string; score: number; total: number }) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{a.title}</p>
                            <p className="text-xs text-muted-foreground">{relativeDay(a.date)}</p>
                          </div>
                          <Badge
                            variant={a.score / a.total >= 0.7 ? 'default' : 'secondary'}
                            className="shrink-0 tabular-nums"
                          >
                            {a.score}/{a.total}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Music className="h-4 w-4" /> Focus sound</CardTitle>
            <CardDescription>Opens in your own player.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {PLAYLISTS.map((p) => (
              <Button key={p.name} asChild variant="outline" className="w-full justify-between">
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.name} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              Lyrics compete with reading. Instrumental or noise holds up better for verbal material.
            </p>
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link to="/resources">Manage your resources</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
