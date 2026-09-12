'use client';

/**
 * Rating badges on /achievements.
 *
 * The Reports panel has always carried a "Badges" link to this page, and this page
 * has never had anything to do with the rating — the link was a dead end. This card
 * is the other half of it.
 *
 * ── Every badge is a fact, and no badge can be taken back ──────────────────
 *
 * The milestone timeline above this card stamps some of its entries with
 * `new Date()` plus an offset, because a "500 products added" milestone has no
 * event behind it to date. Nothing here does that. A badge is earned or it is not,
 * and the figure that earns it is stated on the badge:
 *
 * - **Tiers** come from the best score ever recorded on this device
 *   (`best`), not from today's. A shop that reached Scaler and slipped back to
 *   Grower has still been a Scaler, and a badge that un-earns itself on a slow
 *   week is worse than no badge.
 * - **Streaks** come from `longestStreak`, which is derived from the receipts
 *   themselves rather than remembered — so it survives a new device, and it can
 *   only understate a long history, never invent one.
 *
 * Unearned badges are drawn greyed rather than hidden, with the number that would
 * earn them, because the point of the grid is the next rung.
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Award, Flame, Lock, Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useBusinessRating } from '@/hooks/use-business-rating';
import { TIERS, tierFor } from '@/lib/business-rating';

interface Badge {
  id: string;
  name: string;
  /** What earned it, or what would. Always a number the owner can check. */
  note: string;
  earned: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const STREAK_BADGES = [
  { days: 7, name: 'One week' },
  { days: 30, name: 'One month' },
  { days: 100, name: 'Hundred days' },
];

function BadgeTile({ badge }: { badge: Badge }) {
  const Icon = badge.earned ? badge.icon : Lock;
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors',
        badge.earned
          ? 'border-primary/30 bg-primary/5'
          : 'border-dashed border-border/60 bg-transparent opacity-60',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full',
          badge.earned ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className={cn('text-xs font-bold leading-tight', badge.earned ? 'text-foreground' : 'text-muted-foreground')}>
        {badge.name}
      </p>
      <p className="text-[10px] leading-tight text-muted-foreground">{badge.note}</p>
    </div>
  );
}

export default function RatingBadges() {
  const { score, best, longestStreak, tier, enabled } = useBusinessRating();

  const badges = React.useMemo<Badge[]>(() => {
    // The highest tier the best-ever score reached. Null best means the shop has
    // never had a score at all, in which case nothing above Starter is earned.
    const reached = best !== null ? tierFor(best).index : 0;

    const tierBadges: Badge[] = TIERS.map((t, i) => ({
      id: `tier-${t.name}`,
      name: t.name,
      note: reached >= i + 1 ? `Reached ${t.floor}+` : `Needs ${t.floor}`,
      earned: reached >= i + 1,
      icon: Trophy,
    }));

    const streakBadges: Badge[] = STREAK_BADGES.map((s) => ({
      id: `streak-${s.days}`,
      name: s.name,
      note:
        longestStreak >= s.days
          ? `${s.days} days selling in a row`
          : `${longestStreak}/${s.days} days in a row`,
      earned: longestStreak >= s.days,
      icon: Flame,
    }));

    const ninety: Badge = {
      id: 'ninety-club',
      name: '90+ club',
      note: best !== null && best >= 90 ? `Best score ${best}` : `Best score ${best ?? '--'}`,
      earned: best !== null && best >= 90,
      icon: Award,
    };

    return [...tierBadges, ...streakBadges, ninety];
  }, [best, longestStreak]);

  const earnedCount = badges.filter((b) => b.earned).length;

  // Placed after the memo rather than at the top of the component so the hook
  // order stays fixed — an early return above a `useMemo` is the classic way to
  // break the rules of hooks when a flag flips at runtime, which this one does the
  // moment the owner opts in.
  //
  // Every badge here is a tier or a streak derived from the score, and the header
  // states the score outright, so there is no partial version of this card worth
  // showing to someone who has not opted in.
  if (!enabled) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-primary">
          <div className="flex items-center gap-2">
            <Trophy />
            Rating Badges
          </div>
          <Link
            href="/reports?tab=business-rating"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {score === null ? 'Business Rating' : `Rating ${score} · ${tier.name}`}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </CardTitle>
        <CardDescription>
          {earnedCount} of {badges.length} earned. Tiers are held on your best score ever, so a slow week never
          takes one back.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {badges.map((badge) => (
            <BadgeTile key={badge.id} badge={badge} />
          ))}
        </div>
        {score === null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Record your first sale to start earning these.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
