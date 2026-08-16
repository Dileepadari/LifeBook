import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useLifeData';
import { insights } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { relativeDay } from '@/lib/format';

export function NotificationsBell() {
  const { data: items = [] } = useNotifications();
  const qc = useQueryClient();
  const unread = items.filter((n: { read_at: string | null }) => !n.read_at).length;

  const markRead = async () => {
    if (!unread) return;
    await insights.readNotifications();
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <Popover onOpenChange={(open) => open && markRead()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-semibold text-destructive-foreground"
              >
                {unread > 9 ? '9+' : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n: { id: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null }) => (
                <li key={n.id} className="px-4 py-3">
                  <Link to={n.link || '#'} className="block">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[0.65rem] text-muted-foreground/70">
                      {relativeDay(n.created_at.slice(0, 10))}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
