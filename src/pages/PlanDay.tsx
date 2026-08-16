import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCorners,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, GripVertical, Link2, CalendarDays, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useCreateHabit, useHabits } from '@/hooks/useLifeData';
import { preventAccidentalDialogClose, cn } from '@/lib/utils';
import { todayStr, relativeDay } from '@/lib/format';
import type { Task, TaskStatus, TaskPriority } from '@/lib/api';

const COLUMNS: { id: TaskStatus; label: string; hint: string }[] = [
  { id: 'todo', label: 'To do', hint: 'Planned, not started' },
  { id: 'ongoing', label: 'Ongoing', hint: 'In progress right now' },
  { id: 'blocked', label: 'Blocked', hint: 'Waiting on something' },
  { id: 'done', label: 'Done', hint: 'Closed today' },
];

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'important', 'urgent'];
const CATEGORIES = ['academic', 'ECA', 'personal', 'wellness'];

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  urgent: 'bg-destructive/15 text-destructive border-destructive/20',
  important: 'bg-warning/20 text-warning border-warning/20',
  normal: 'bg-muted text-muted-foreground border-transparent',
  low: 'bg-muted text-muted-foreground border-transparent',
};

export default function PlanDay() {
  const { data: tasks = [], isLoading } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [dragging, setDragging] = useState<Task | null>(null);

  const sensors = useSensors(
    // A small activation distance keeps a click-to-check from being swallowed
    // by the drag sensor.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], ongoing: [], blocked: [], done: [] };
    for (const task of tasks) map[task.status]?.push(task);
    for (const key of Object.keys(map) as TaskStatus[]) {
      map[key].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [tasks]);

  const onDragStart = (e: DragStartEvent) => {
    setDragging(tasks.find((t) => t.id === e.active.id) || null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    // over.id is either a column id (dropped on empty space) or another task id.
    const overTask = tasks.find((t) => t.id === over.id);
    const targetStatus = (COLUMNS.find((c) => c.id === over.id)?.id || overTask?.status) as TaskStatus | undefined;
    if (!targetStatus) return;

    const siblings = byColumn[targetStatus].filter((t) => t.id !== task.id);
    const index = overTask ? siblings.findIndex((t) => t.id === overTask.id) : siblings.length;
    const before = siblings[index - 1]?.sort_order ?? (siblings[0]?.sort_order ?? 0) - 1;
    const after = siblings[index]?.sort_order ?? before + 2;

    if (targetStatus === task.status && overTask?.id === task.id) return;

    updateTask.mutate({
      id: task.id,
      payload: {
        status: targetStatus,
        sort_order: (before + after) / 2,
        // Moving into Done is what stamps completion - the dashboard's
        // "tasks completed" tile counts completed_at, not status.
        completed_at: targetStatus === 'done' ? new Date().toISOString() : null,
      },
    });
  };

  if (isLoading) {
    return (
      <div>
        <PageHeaderSkeleton />
        <CardListSkeleton count={4} height="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Plan your day</h1>
          <p className="mt-1 text-muted-foreground">
            Cap the list at what you actually finished yesterday. A plan you beat is worth more than
            one you abandon.
          </p>
        </div>
        <div className="flex gap-2">
          <AddHabitDialog />
          <AddTaskDialog onCreate={(payload) => createTask.mutate(payload)} pending={createTask.isPending} />
        </div>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              column={col}
              tasks={byColumn[col.id]}
              onDelete={(id) => deleteTask.mutate(id)}
            />
          ))}
        </div>

        <DragOverlay>
          {dragging ? <TaskCard task={dragging} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ column, tasks, onDelete }: { column: typeof COLUMNS[number]; tasks: Task[]; onDelete: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-64 flex-col rounded-xl border border-border bg-muted/30 p-3 transition-colors',
        isOver && 'border-primary/50 bg-primary/5',
      )}
    >
      <div className="mb-3 flex items-baseline justify-between px-1">
        <div>
          <p className="text-sm font-semibold">{column.label}</p>
          <p className="text-xs text-muted-foreground">{column.hint}</p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{tasks.length}</span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <SortableTask key={task.id} task={task} onDelete={onDelete} />
            ))}
          </AnimatePresence>
          {tasks.length === 0 && (
            <p className="flex flex-1 items-center justify-center px-2 text-center text-xs text-muted-foreground">
              Drop a task here
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTask({ task, onDelete }: { task: Task; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TaskCard task={task} onDelete={onDelete} dragHandle={{ ...attributes, ...listeners }} />
    </motion.div>
  );
}

function TaskCard({
  task, onDelete, dragHandle, overlay,
}: {
  task: Task;
  onDelete?: (id: string) => void;
  dragHandle?: Record<string, unknown>;
  overlay?: boolean;
}) {
  return (
    <Card className={cn('group', overlay && 'rotate-2 shadow-xl')}>
      <CardContent className="flex gap-2 p-3">
        <button
          type="button"
          {...dragHandle}
          aria-label="Reorder task"
          className="mt-0.5 cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', task.status === 'done' && 'text-muted-foreground line-through')}>
            {task.title}
          </p>
          {task.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.notes}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {task.priority !== 'normal' && (
              <Badge variant="outline" className={cn('text-[0.6rem]', PRIORITY_STYLES[task.priority])}>
                {task.priority}
              </Badge>
            )}
            {task.category && <Badge variant="secondary" className="text-[0.6rem]">{task.category}</Badge>}
            {task.due_date && (
              <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {relativeDay(task.due_date)}
              </span>
            )}
            {task.link_url && (
              <a
                href={task.link_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[0.65rem] text-primary hover:underline"
              >
                <Link2 className="h-3 w-3" /> link
              </a>
            )}
          </div>
        </div>
        {onDelete && (
          <button
            type="button"
            aria-label={`Delete "${task.title}"`}
            onClick={() => onDelete(task.id)}
            className="h-6 w-6 shrink-0 rounded text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function AddTaskDialog({ onCreate, pending }: { onCreate: (p: Partial<Task>) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [category, setCategory] = useState('academic');
  const [dueDate, setDueDate] = useState(todayStr());
  const [linkUrl, setLinkUrl] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({ title: title.trim(), notes: notes.trim() || null, priority, category, due_date: dueDate || null, link_url: linkUrl.trim() || null });
    setTitle(''); setNotes(''); setLinkUrl(''); setPriority('normal');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add task</Button>
      </DialogTrigger>
      <DialogContent {...preventAccidentalDialogClose}>
        <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Task</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">Due</Label>
              <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link">Link</Label>
              <Input id="link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddHabitDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetDays, setTargetDays] = useState(30);
  const createHabit = useCreateHabit();
  const { data: habits = [] } = useHabits();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createHabit.mutateAsync({ name: name.trim(), target_days: targetDays });
    toast.success('Habit added', { description: 'It appears on your dashboard grid from today.' });
    setName('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Add habit</Button>
      </DialogTrigger>
      <DialogContent {...preventAccidentalDialogClose}>
        <DialogHeader><DialogTitle>New habit</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="habit">Habit</Label>
            <Input
              id="habit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Phone out of the room while studying"
              autoFocus
              required
            />
            <p className="text-xs text-muted-foreground">
              Make it small enough that a bad day cannot break it. You have {habits.length} running.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target">Target days</Label>
            <Input id="target" type="number" min={1} max={365} value={targetDays} onChange={(e) => setTargetDays(Number(e.target.value))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createHabit.isPending}>
              {createHabit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
