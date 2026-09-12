'use client';

/**
 * Dashboard → Today's focus.
 *
 * The rating lives behind a Reports tab, and the top-bar badge is a number in the
 * chrome. Neither puts a *next action* on the page owners actually land on, which
 * is the one place it changes behaviour.
 *
 * ── One card, one action ───────────────────────────────────────────────────
 *
 * The largest money opportunity the rating found, priced in currency and summed
 * from the shop's own receipts — never a projection dressed as a fact, and never
 * restated in points (see the note in `src/lib/business-rating.ts`).
 *
 * A live streak that today has not yet renewed takes the headline instead. That is
 * not a gimmick: a shop about to break a twelve-day run has something more urgent
 * in front of it than a margin fix, and unlike the money figures it expires at
 * midnight. It only pre-empts the opportunity from three days up, so a one-day run
 * does not manufacture urgency out of nothing.
 *
 * Renders nothing at all when there is no rating yet or nothing on the table —
 * an empty "focus" card is worse than no card. Hidden entirely from staff without
 * report permission, matching the revenue cards beside it.
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Flame, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { usePOS } from '@/context/pos-context';
import { useBusinessRating } from '@/hooks/use-business-rating';

/** Compact currency, matching the Reports panel and the top-bar tooltip. */
function money(symbol: string, value: number): string {
  const v = Math.round(value);
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (v >= 1_000_000) return `${symbol}${trim((v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1))}M`;
  if (v >= 10_000) return `${symbol}${trim((v / 1_000).toFixed(0))}k`;
  return `${symbol}${v.toLocaleString()}`;
}

/** Streaks shorter than this are not urgent enough to pre-empt real money. */
const STREAK_URGENCY_FLOOR = 3;

export default function TodaysFocus() {
  const { currencySymbol } = usePOS();
  const { score, topOpportunity, streak, streakAtRisk, enabled } = useBusinessRating();

  const streakUrgent = streakAtRisk && streak >= STREAK_URGENCY_FLOOR;

  // Not opted in to the rating. This card is built entirely out of rating output —
  // the top opportunity and the streak — so there is nothing here to show that does
  // not come from the score. Checked before `score === null`, which is a different
  // state: that one means "no sales to score yet" and is not a reason to hide.
  if (!enabled) return null;
  if (score === null) return null;
  if (!streakUrgent && !topOpportunity) return null;

  const body = streakUrgent
    ? {
        icon: Flame,
        label: `Keep your ${streak}-day streak alive`,
        detail: 'No sale recorded today yet',
        badge: `${streak} days`,
        href: '/sales/pos',
        urgent: true,
      }
    : {
        icon: Target,
        label: topOpportunity!.label,
        detail: topOpportunity!.detail,
        badge: money(currencySymbol, topOpportunity!.money),
        href: topOpportunity!.href,
        urgent: false,
      };

  const Icon = body.icon;

  return (
    <Link href={body.href} className="group block">
      <Card
        className={cn(
          'flex items-center gap-3 p-4 transition-colors sm:gap-4',
          body.urgent
            ? 'border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-transparent hover:border-orange-500/60'
            : 'border-primary/25 bg-gradient-to-r from-primary/5 to-transparent hover:border-primary/50',
        )}
      >
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            body.urgent ? 'bg-orange-500/15 text-orange-500' : 'bg-primary/15 text-primary',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Today's focus</p>
          <p className="truncate text-sm font-semibold text-foreground">{body.label}</p>
          <p className="truncate text-xs text-muted-foreground">{body.detail}</p>
        </div>

        <span
          className={cn(
            'shrink-0 rounded px-2 py-1 text-sm font-bold tabular-nums',
            body.urgent
              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          )}
        >
          {body.badge}
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Card>
    </Link>
  );
}
