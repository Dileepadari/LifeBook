/**
 * Reflection, gratitude, wins and improvements for today, and the entries
 * behind it. Whatever is written here is quoted on tonight's LifePage.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Loader2, PenLine, Sparkles, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { useJournal, useSaveJournal, useJournalList } from '@/hooks/useLifeData';
import { todayStr, longDate, relativeDay } from '@/lib/format';

// Rotating prompts so the page is never a blank box. Deterministic per date -
// the same day always shows the same prompt, so returning to it feels stable.
const PROMPTS = [
  'What actually took your attention today - not what you planned to do?',
  'What went better than you expected?',
  'What did you avoid, and what was underneath the avoiding?',
  'Which decision today would you make differently tomorrow?',
  'What did you learn that you did not know this morning?',
  'Who or what made today easier?',
  'What is the smallest thing you could change tomorrow?',
];

export default function Journal() {
  const date = todayStr();
  const { data: entry, isLoading } = useJournal(date);
  const { data: history = [] } = useJournalList();
  const save = useSaveJournal();

  const [gratitude, setGratitude] = useState<string[]>([]);
  const [wins, setWins] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [reflection, setReflection] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setGratitude(entry.gratitude || []);
    setWins(entry.wins || []);
    setImprovements(entry.improvements || []);
    setReflection(entry.reflection || '');
  }, [entry]);

  const prompt = PROMPTS[[...date].reduce((a, c) => a + c.charCodeAt(0), 0) % PROMPTS.length];

  const commit = async () => {
    await save.mutateAsync({ date, payload: { gratitude, wins, improvements, reflection } });
    setDirty(false);
    toast.success('Journal saved', { description: "It feeds tonight's page." });
  };

  if (isLoading) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={2} height="h-56" /></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Personal Journal</h1>
          <p className="mt-1 text-muted-foreground">{longDate(date)}</p>
        </div>
        {dirty && (
          <Button onClick={commit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="page-surface">
            <CardHeader className="pb-3">
              <CardTitle className="font-display flex items-center gap-2">
                <PenLine className="h-4 w-4" /> Today's reflection
              </CardTitle>
              <CardDescription className="text-paper-foreground/60">{prompt}</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={reflection}
                onChange={(e) => { setReflection(e.target.value); setDirty(true); }}
                rows={9}
                placeholder="Write it as it was, not as it should have been."
                className="resize-none border-paper-edge bg-transparent font-display text-base leading-relaxed placeholder:text-paper-foreground/40"
              />
              <p className="mt-2 text-xs text-paper-foreground/50">
                {reflection.trim().split(/\s+/).filter(Boolean).length} words. Whatever you write here is
                quoted on tonight's LifePage.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <ListCard
              title="Wins"
              description="However small."
              items={wins}
              onChange={(v) => { setWins(v); setDirty(true); }}
              placeholder="Started without checking my phone"
            />
            <ListCard
              title="To improve"
              description="Actionable tomorrow, not aspirational."
              items={improvements}
              onChange={(v) => { setImprovements(v); setDirty(true); }}
              placeholder="Phone in the other room"
            />
          </div>
        </div>

        <div className="space-y-4">
          <ListCard
            title="Grateful for"
            description="Gratitude journalling is one of the few interventions with unambiguous evidence behind it."
            items={gratitude}
            onChange={(v) => { setGratitude(v); setDirty(true); }}
            placeholder="Quiet library at 6am"
            accent
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Earlier entries</CardTitle>
            </CardHeader>
            <CardContent>
              {history.filter((h) => h.date !== date).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {history.filter((h) => h.date !== date).slice(0, 8).map((h) => (
                    <li key={h.id}>
                      <Link to={`/lifebook/${h.date}`} className="flex items-center gap-2 py-2.5 hover:opacity-70">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{relativeDay(h.date)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {h.reflection || h.gratitude?.join(', ') || 'No reflection'}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ListCard({
  title, description, items, onChange, placeholder, accent,
}: {
  title: string; description: string; items: string[];
  onChange: (items: string[]) => void; placeholder: string; accent?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onChange([...items, text]);
    setDraft('');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {accent && <Sparkles className="h-4 w-4 text-primary" />}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={add} className="flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
          <Button type="submit" size="icon" variant="outline" disabled={!draft.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <ul className="mt-3 space-y-1.5">
          <AnimatePresence initial={false}>
            {items.map((item, i) => (
              <motion.li
                key={`${item}-${i}`}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="group flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm"
              >
                <span className="flex-1">{item}</span>
                <button
                  type="button"
                  aria-label={`Remove "${item}"`}
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {items.length === 0 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">Nothing listed yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

