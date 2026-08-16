import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, Layers, ListChecks, Network } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useGenerate, useResources, useAIStatus } from '@/hooks/useLifeData';
import { PROVIDER_LABELS, plural } from '@/lib/format';
import type { MindMapData } from '@/components/study/MindMapView';
import { MindMapView } from '@/components/study/MindMapView';

/**
 * Turns a resource (or pasted text) into flashcards, a practice test or a mind
 * map. Works with no AI key: the built-in engine extracts definitions and
 * cloze-deletes prose, which is weaker than an LLM but genuinely functional.
 * The provider that actually did the work is always shown.
 */
export function GenerateStudio() {
  const navigate = useNavigate();
  const { data: resources = [] } = useResources();
  const { data: aiStatus } = useAIStatus();

  const [source, setSource] = useState<'resource' | 'text'>('resource');
  const [resourceId, setResourceId] = useState<string>('');
  const [text, setText] = useState('');
  const [count, setCount] = useState(10);
  const [mindMap, setMindMap] = useState<MindMapData | null>(null);

  const cards = useGenerate('flashcards');
  const quiz = useGenerate('quiz');
  const map = useGenerate('mindmap');

  const usable = resources.filter((r) => r.text_content);
  const body = () => (source === 'text' ? { text } : { resource_id: resourceId });
  const ready = source === 'text' ? text.trim().length > 120 : Boolean(resourceId);

  const run = async (kind: 'cards' | 'quiz' | 'map') => {
    try {
      if (kind === 'cards') {
        const res = await cards.mutateAsync({ ...body(), count });
        toast.success(`${plural(res.cards.length, 'card')} created`, {
          description: `${PROVIDER_LABELS[res.provider]} - they are in your review queue now.`,
        });
      } else if (kind === 'quiz') {
        const res = await quiz.mutateAsync({ ...body(), count: Math.min(count, 15) });
        toast.success(`${res.count}-question test ready`, { description: PROVIDER_LABELS[res.provider] });
        navigate(`/study/quiz/${res.quiz.id}`);
      } else {
        const res = await map.mutateAsync(body());
        setMindMap(JSON.parse(res.mind_map.data));
        toast.success('Mind map built', { description: PROVIDER_LABELS[res.provider] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed.');
    }
  };

  const pending = cards.isPending || quiz.isPending || map.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1.5">
          <Sparkles className="h-3 w-3" />
          {aiStatus ? PROVIDER_LABELS[aiStatus.provider] || aiStatus.provider : 'checking...'}
        </Badge>
        {aiStatus?.provider === 'builtin' && (
          <span className="text-xs text-muted-foreground">
            Works without a key. Add one in Settings for better prose.
          </span>
        )}
      </div>

      <Tabs value={source} onValueChange={(v) => setSource(v as 'resource' | 'text')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="resource">From a resource</TabsTrigger>
          <TabsTrigger value="text">Paste text</TabsTrigger>
        </TabsList>

        <TabsContent value="resource" className="pt-4">
          {usable.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No readable resources yet. Upload a .txt or .md file on the Resources page - binary
              formats like PDF are stored but their text is not extracted, so paste the text instead.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label>Resource</Label>
              <Select value={resourceId} onValueChange={setResourceId}>
                <SelectTrigger><SelectValue placeholder="Pick study material" /></SelectTrigger>
                <SelectContent>
                  {usable.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </TabsContent>

        <TabsContent value="text" className="pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="paste">Your notes</Label>
            <Textarea
              id="paste"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste a chapter, a set of notes, a lecture transcript..."
            />
            <p className="text-xs text-muted-foreground">
              {text.trim().length} characters - at least 120 needed.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-1.5">
        <Label htmlFor="count">How many</Label>
        <Input
          id="count"
          type="number"
          min={3}
          max={30}
          value={count}
          onChange={(e) => setCount(Math.max(3, Math.min(30, Number(e.target.value))))}
          className="w-28"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button onClick={() => run('cards')} disabled={!ready || pending} className="gap-2">
          {cards.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
          Flashcards
        </Button>
        <Button onClick={() => run('quiz')} disabled={!ready || pending} variant="secondary" className="gap-2">
          {quiz.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
          Practice test
        </Button>
        <Button onClick={() => run('map')} disabled={!ready || pending} variant="outline" className="gap-2">
          {map.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
          Mind map
        </Button>
      </div>

      {mindMap && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <MindMapView data={mindMap} />
        </motion.div>
      )}
    </div>
  );
}
