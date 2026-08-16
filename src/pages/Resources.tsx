import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Trash2, Star, Download, FileText, Search, Loader2, FolderOpen, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { useResources, useUploadResource, useDeleteResource, useUpdateResource } from '@/hooks/useLifeData';
import { bytes, relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Notes', 'Textbook', 'Slides', 'Past paper', 'Summary', 'Reference'];

export default function Resources() {
  const { data: resources = [], isLoading } = useResources();
  const upload = useUploadResource();
  const remove = useDeleteResource();
  const update = useUpdateResource();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = resources.filter((r) => {
    const matchesQuery = !query || r.name.toLowerCase().includes(query.toLowerCase()) || r.subject?.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'all' || r.category === category;
    return matchesQuery && matchesCategory;
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync({ file, meta: { category: 'Notes' } });
        toast.success(`${file.name} uploaded`);
      } catch (err) {
        toast.error(`${file.name} failed`, { description: err instanceof Error ? err.message : undefined });
      }
    }
  };

  if (isLoading) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={2} height="h-48" /></div>;
  }

  const readable = resources.filter((r) => r.text_content).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Your Resources</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Scattered materials were one of the loudest findings in the research. One place, tagged,
          searchable - and the text ones become flashcards and practice tests.
        </p>
      </header>

      {/* Drop zone. Kept as a real target rather than a button-only affordance,
          because dragging a folder of notes in is the actual use case. */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          'rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        {upload.isPending ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        ) : (
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        )}
        <p className="mt-3 font-medium">Drop files here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Up to 25 MB each. Text and markdown files also get their contents indexed, so they can
          generate study material.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
          Choose files
        </Button>
      </div>

      {resources.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or subject"
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="h-3 w-3" /> {readable} usable for AI
            </Badge>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence initial={false}>
                      {filtered.map((r) => (
                        <motion.tr
                          key={r.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b border-border transition-colors hover:bg-muted/40"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="font-medium">{r.name}</span>
                              {r.text_content && (
                                <Badge variant="outline" className="text-[0.6rem]">indexed</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={r.category} onValueChange={(v) => update.mutate({ id: r.id, payload: { category: v } })}>
                              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.subject || '-'}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{bytes(r.size_bytes)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{relativeDay(r.created_at.slice(0, 10))}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-0.5">
                              <Button
                                size="icon" variant="ghost" className="h-8 w-8"
                                onClick={() => update.mutate({ id: r.id, payload: { starred: r.starred ? 0 : 1 } })}
                                aria-label={r.starred ? 'Unstar' : 'Star'}
                              >
                                <Star className={cn('h-3.5 w-3.5', r.starred && 'fill-warning text-warning')} />
                              </Button>
                              {r.file_path && (
                                <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                                  <a href={r.file_path} download={r.name} aria-label={`Download ${r.name}`}>
                                    <Download className="h-3.5 w-3.5" />
                                  </a>
                                </Button>
                              )}
                              <Button
                                size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive"
                                onClick={() => remove.mutate(r.id)}
                                aria-label={`Delete ${r.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>

              {filtered.length === 0 && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nothing matches that filter.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {resources.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No resources yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Upload your notes and they stop being scattered. Text files can then be turned into
              flashcards and practice tests from Study Now.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
