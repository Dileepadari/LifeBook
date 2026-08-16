import { motion, useReducedMotion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { useBadges } from '@/hooks/useLifeData';
import { relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Badge as BadgeType } from '@/lib/api';

const TIER_STYLES: Record<string, { ring: string; fill: string; label: string }> = {
  bronze: { ring: 'ring-[#b87333]/40', fill: 'bg-[#b87333]/15 text-[#b87333]', label: 'Bronze' },
  silver: { ring: 'ring-muted-foreground/40', fill: 'bg-muted-foreground/15 text-muted-foreground', label: 'Silver' },
  gold: { ring: 'ring-warning/50', fill: 'bg-warning/15 text-warning', label: 'Gold' },
};

export default function Badges() {
  const { data: badges = [], isLoading } = useBadges();
  const reduceMotion = useReducedMotion();

  if (isLoading) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={2} height="h-40" /></div>;
  }

  const earned = badges.filter((b) => b.earned_at);
  const locked = badges.filter((b) => !b.earned_at).sort((a, b) => b.progress - a.progress);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Your Badges</h1>
        <p className="mt-1 text-muted-foreground">
          <span className="tabular-nums">{earned.length}</span> of{' '}
          <span className="tabular-nums">{badges.length}</span> earned. Every one is measured from
          real rows - none of them can be clicked into existence.
        </p>
      </header>

      {earned.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Earned</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {earned.map((badge, i) => (
              <BadgeCard key={badge.id} badge={badge} index={i} reduceMotion={reduceMotion} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {earned.length ? 'Still to earn' : 'Available'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locked.map((badge, i) => (
            <BadgeCard key={badge.id} badge={badge} index={i} reduceMotion={reduceMotion} />
          ))}
        </div>
      </section>
    </div>
  );
}

function BadgeCard({ badge, index, reduceMotion }: { badge: BadgeType; index: number; reduceMotion: boolean | null }) {
  // Badge icons are stored as lucide names in the seed data, so a new badge is
  // a seed row rather than a code change here.
  const Icon = (Icons[badge.icon as keyof typeof Icons] || Icons.Award) as Icons.LucideIcon;
  const tier = TIER_STYLES[badge.tier] || TIER_STYLES.bronze;
  const done = Boolean(badge.earned_at);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
    >
      <Card className={cn('h-full transition-opacity', !done && 'opacity-75')}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                done ? `${tier.fill} ring-2 ${tier.ring}` : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">{badge.name}</CardTitle>
              <CardDescription className="mt-0.5">{badge.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary" className={tier.fill}>{tier.label}</Badge>
              <span className="text-xs text-muted-foreground">
                {relativeDay(badge.earned_at!.slice(0, 10))}
              </span>
            </div>
          ) : (
            <>
              <Progress value={badge.progress * 100} className="h-1.5" />
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                {formatMeasure(badge)} of {formatThreshold(badge)}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// study_minutes_total is stored in minutes but reads better as hours.
function formatMeasure(badge: BadgeType) {
  if (badge.rule === 'study_minutes_total') return `${Math.round(badge.current / 60)}h`;
  return String(Math.round(badge.current));
}

function formatThreshold(badge: BadgeType) {
  if (badge.rule === 'study_minutes_total') return `${Math.round(badge.threshold / 60)}h`;
  return String(badge.threshold);
}
