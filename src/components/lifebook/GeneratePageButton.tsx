import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGeneratePage, useLifePage } from '@/hooks/useLifeData';
import { todayStr } from '@/lib/format';
import { PROVIDER_LABELS } from '@/lib/format';

/**
 * The one recurring action in the product: close today into a page.
 * Present on every screen because the moment a student decides the day is over
 * is not predictable from which route they happen to be on.
 */
export function GeneratePageButton() {
  const date = todayStr();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { data: page } = useLifePage(date);
  const generate = useGeneratePage();

  const exists = Boolean(page);

  const onClick = async () => {
    if (exists) {
      navigate(`/lifebook/${date}`);
      return;
    }
    try {
      const res = await generate.mutateAsync({ date });
      toast.success("Today's page is written", {
        description: `${PROVIDER_LABELS[res.provider] || res.provider} - open it to read and seal.`,
        action: { label: 'Open', onClick: () => navigate(`/lifebook/${date}`) },
      });
      navigate(`/lifebook/${date}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not write the page.');
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          >
            <Button
              size="lg"
              onClick={onClick}
              disabled={generate.isPending}
              className="h-14 gap-2 rounded-full px-5 shadow-lg shadow-primary/25"
            >
              {generate.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : exists ? (
                <Check className="h-5 w-5" />
              ) : (
                <BookOpen className="h-5 w-5" />
              )}
              <span className="hidden sm:inline">
                {generate.isPending ? 'Writing...' : exists ? "Today's page" : 'Close the day'}
              </span>
            </Button>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="left">
          {exists ? "Read today's LifePage" : 'Turn today into a page of your LifeBook'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
