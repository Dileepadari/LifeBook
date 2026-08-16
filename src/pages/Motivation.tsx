import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Plus, Trash2, Sparkles, Quote, Target, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { useMotivation, useSaveMotivation, useGoalVisions, useGoalVisionAction, useProfile } from '@/hooks/useLifeData';
import { shortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MotivationItem } from '@/lib/api';

export default function Motivation() {
  const { data, isLoading } = useMotivation();
  const { data: visions = [] } = useGoalVisions();
  const { data: profile } = useProfile();
  const saveItem = useSaveMotivation();
  const visionAction = useGoalVisionAction();

  const [visionText, setVisionText] = useState('');
  const [visionDate, setVisionDate] = useState('');

  if (isLoading || !data) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={3} height="h-32" /></div>;
  }

  const items: MotivationItem[] = data.data;
  const quote = data.quote_of_the_day;
  const byKind = (kind: string) => items.filter((i) => i.kind === kind);

  const addVision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visionText.trim()) return;
    visionAction.mutate({ action: 'create', payload: { text: visionText.trim(), target_date: visionDate || null } });
    setVisionText('');
    setVisionDate('');
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Motivation Hub</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          The interviews found motivation was temporary and all-or-none. This page is not here to
          hype you up - it is here for the days the hype has already gone.
        </p>
      </header>

      {quote && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="page-surface">
            <CardContent className="py-10 text-center">
              <Quote className="mx-auto mb-4 h-5 w-5 text-paper-foreground/35" />
              <p className="font-display mx-auto max-w-2xl text-xl leading-relaxed sm:text-2xl">
                {quote.text}
              </p>
              {quote.author && (
                <p className="mt-4 text-sm text-paper-foreground/60">- {quote.author}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" /> What you are working toward</CardTitle>
          <CardDescription>
            {profile?.academic_goal || 'Set a goal in your profile.'}
            {profile?.personal_goal && ` - and ${profile.personal_goal.toLowerCase()}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addVision} className="flex flex-wrap gap-2">
            <Input
              value={visionText}
              onChange={(e) => setVisionText(e.target.value)}
              placeholder="Something specific you want to be true"
              className="min-w-56 flex-1"
            />
            <Input
              type="date"
              value={visionDate}
              onChange={(e) => setVisionDate(e.target.value)}
              className="w-40"
              aria-label="Target date"
            />
            <Button type="submit" disabled={!visionText.trim()} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </form>

          <ul className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {visions.map((v: { id: string; text: string; target_date: string | null; achieved: number }) => (
                <motion.li
                  key={v.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="group flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <button
                    type="button"
                    aria-label={v.achieved ? 'Mark not achieved' : 'Mark achieved'}
                    onClick={() => visionAction.mutate({ action: 'update', id: v.id, payload: { achieved: v.achieved ? 0 : 1 } })}
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                      v.achieved ? 'border-success bg-success text-success-foreground' : 'border-muted-foreground/40 hover:border-primary',
                    )}
                  >
                    {v.achieved ? <Check className="h-3 w-3" /> : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', v.achieved && 'text-muted-foreground line-through')}>{v.text}</p>
                    {v.target_date && (
                      <p className="text-xs text-muted-foreground">by {shortDate(v.target_date)}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => visionAction.mutate({ action: 'remove', id: v.id })}
                    className="text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {visions.length === 0 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Nothing listed. Visualisation was one of the habits almost nobody in the research had.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="affirmation">
        <TabsList>
          <TabsTrigger value="affirmation">Affirmations</TabsTrigger>
          <TabsTrigger value="story">Stories</TabsTrigger>
          <TabsTrigger value="quote">Quotes</TabsTrigger>
        </TabsList>

        {(['affirmation', 'story', 'quote'] as const).map((kind) => (
          <TabsContent key={kind} value={kind} className="pt-4">
            <div className={cn('grid gap-3', kind === 'story' ? 'lg:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
              {byKind(kind).map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="hover-lift flex h-full flex-col">
                    <CardContent className="flex flex-1 flex-col p-5">
                      <p className={cn('flex-1', kind === 'affirmation' ? 'font-display text-lg leading-relaxed' : 'font-medium')}>
                        {item.text}
                      </p>
                      {item.detail && (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                      )}
                      <div className="mt-4 flex items-center justify-between gap-2">
                        {item.author ? (
                          <span className="truncate text-xs text-muted-foreground">- {item.author}</span>
                        ) : <span />}
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                          onClick={() => saveItem.mutate(item.id)}
                          aria-label={item.saved ? 'Unsave' : 'Save'}
                        >
                          <Bookmark className={cn('h-3.5 w-3.5', item.saved && 'fill-primary text-primary')} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {items.some((i) => i.saved) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Saved</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {items.filter((i) => i.saved).map((i) => (
              <Badge key={i.id} variant="secondary" className="max-w-full">
                <span className="truncate">{i.text}</span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
