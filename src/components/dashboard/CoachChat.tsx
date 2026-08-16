import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useCoach } from '@/hooks/useLifeData';
import { PROVIDER_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'coach';
  text: string;
  provider?: string;
}

const STARTERS = [
  'Why is my focus dropping?',
  'How do I stop procrastinating?',
  'Am I sleeping enough?',
  'What should I fix first?',
];

/**
 * The coach answers from the user's real numbers - the server hands the
 * provider a compact snapshot of the last 7 days and nothing else. With no key
 * configured the built-in engine answers from the same snapshot, so the feature
 * is never a dead button.
 */
export function CoachChat({ compact }: { compact?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const coach = useCoach();
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messages, reduceMotion]);

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || coach.isPending) return;
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    try {
      const res = await coach.mutateAsync(question);
      setMessages((m) => [...m, { role: 'coach', text: res.reply, provider: res.provider }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'coach', text: err instanceof Error ? err.message : 'Something went wrong.' },
      ]);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className={cn('flex-1 pr-3', compact ? 'max-h-64' : 'max-h-96')}>
        {messages.length === 0 ? (
          <div className="py-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Ask about your own numbers - focus, sleep, planning, habits, exam prep.
            </div>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm bg-muted',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.provider && (
                      <Badge variant="outline" className="mt-2 text-[0.6rem]">
                        {PROVIDER_LABELS[m.provider] || m.provider}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {coach.isPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="mt-3 flex gap-2 border-t border-border pt-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your coach..."
          disabled={coach.isPending}
        />
        <Button type="submit" size="icon" disabled={coach.isPending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
