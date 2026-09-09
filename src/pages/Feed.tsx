/** Research digests behind LifeBook, plus anything written on this instance. */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Plus, Loader2, Megaphone, BookOpen, Star, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { useFeed, useSavePost } from '@/hooks/useLifeData';
import { insights } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { relativeDay } from '@/lib/format';
import { preventAccidentalDialogClose, cn } from '@/lib/utils';
import type { FeedPost } from '@/lib/api';

const KIND_META: Record<string, { icon: typeof BookOpen; label: string; className: string }> = {
  blog: { icon: BookOpen, label: 'Article', className: 'bg-primary/10 text-primary' },
  announcement: { icon: Megaphone, label: 'Announcement', className: 'bg-accent/15 text-accent' },
  highlight: { icon: Star, label: 'Highlight', className: 'bg-warning/20 text-warning' },
};

export default function Feed() {
  const { data: posts = [], isLoading } = useFeed();
  const savePost = useSavePost();
  const [filter, setFilter] = useState<'all' | 'saved'>('all');

  if (isLoading) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={3} height="h-40" /></div>;
  }

  const shown = filter === 'saved' ? posts.filter((p) => p.saved) : posts;

  const share = async (post: FeedPost) => {
    const text = `${post.title}\n\n${post.body.slice(0, 400)}${post.body.length > 400 ? '...' : ''}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text });
        return;
      } catch { /* user cancelled - fall through to clipboard */ }
    }
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Your Feed</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Research digests from the study behind LifeBook, plus anything anyone on this instance
            writes.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 rounded-lg border border-border p-1">
            {(['all', 'saved'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                  filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <WriteDialog />
        </div>
      </header>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {filter === 'saved' ? 'Nothing saved yet.' : 'Nothing here yet.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {shown.map((post, i) => {
            const meta = KIND_META[post.kind] || KIND_META.blog;
            const Icon = meta.icon;
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
              >
                <Card className={cn(post.kind === 'highlight' && 'page-surface')}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className={cn('gap-1 text-[0.6rem]', meta.className)}>
                            <Icon className="h-2.5 w-2.5" /> {meta.label}
                          </Badge>
                          {post.tags?.split(',').filter(Boolean).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[0.6rem]">{tag.trim()}</Badge>
                          ))}
                        </div>
                        <CardTitle className={cn(post.kind === 'highlight' && 'font-display')}>
                          {post.title}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {post.author_name || 'LifeBook'} - {relativeDay(post.created_at.slice(0, 10))}
                        </CardDescription>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => share(post)}
                          aria-label="Share"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => savePost.mutate(post.id)}
                          aria-label={post.saved ? 'Unsave' : 'Save'}
                        >
                          <Bookmark className={cn('h-3.5 w-3.5', post.saved && 'fill-primary text-primary')} />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {post.body.split('\n\n').map((para, j) => (
                      <p
                        key={j}
                        className={cn(
                          'text-sm leading-relaxed',
                          j > 0 && 'mt-3',
                          post.kind === 'highlight' ? 'font-display text-base' : 'text-muted-foreground',
                        )}
                      >
                        {para}
                      </p>
                    ))}
                    {post.source && (
                      <p className="mt-4 border-t border-border pt-3 text-xs italic text-muted-foreground">
                        {post.source}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WriteDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await insights.createPost({ title: title.trim(), body: body.trim(), tags: tags.trim() || undefined });
      qc.invalidateQueries({ queryKey: ['feed'] });
      toast.success('Posted');
      setTitle(''); setBody(''); setTags('');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not post.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Write</Button>
      </DialogTrigger>
      <DialogContent {...preventAccidentalDialogClose}>
        <DialogHeader><DialogTitle>Write something</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ptitle">Title</Label>
            <Input id="ptitle" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pbody">Body</Label>
            <Textarea
              id="pbody" rows={8} value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="What you worked out, what went wrong, what helped..."
              required
            />
            <p className="text-xs text-muted-foreground">Blank lines become paragraphs.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ptags">Tags</Label>
            <Input id="ptags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="study, focus" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Post
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
