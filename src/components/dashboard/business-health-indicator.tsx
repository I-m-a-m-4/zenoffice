'use client';

/**
 * The rating in the top bar.
 *
 * Reads the same live score as Reports → Business Rating via `useBusinessRating`,
 * so the two can no longer disagree. It used to read
 * `business.settings.businessAnalysis.businessHealth.score`, which is only written
 * when somebody runs an AI report — the banner sat on one number for weeks while
 * the shop changed underneath it. The AI's one-line summary is still shown in the
 * tooltip when there is one; the *number* is arithmetic over the shop's sales.
 *
 * The tooltip's job is to make the badge worth clicking, so it carries the largest
 * money figure the rating found rather than a restatement of the score.
 *
 * Colour never carries meaning alone here: the grade letter sits beside the score,
 * and the tooltip names the tier.
 *
 * ── What this deliberately does not do ─────────────────────────────────────
 *
 * **It never fires the confetti.** This badge is mounted on every page, and a tier
 * crossing celebrated from here would go off over the till, the stock count or
 * whatever else the owner was in the middle of. A level-up shows as a quiet dot
 * that survives until the Reports panel celebrates it properly and acknowledges
 * it — see `src/components/reports/business-rating-panel.tsx`.
 *
 * **It renders nothing at all until the owner opts in.** Being scored out of 100 in
 * the chrome of every page is not something to do to someone who has not asked for
 * it, and this is the surface that would follow them furthest. The opt-in lives in
 * Reports → Business Rating and in Settings → General.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Flame, Gauge, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePOS } from '@/context/pos-context';
import { useBusinessRating } from '@/hooks/use-business-rating';
import { Progress } from '../ui/progress';
import { Skeleton } from '../ui/skeleton';

export default function BusinessHealthIndicator() {
  const { business, currencySymbol, isLoading } = usePOS();
  const { score, grade, tier, delta, movers, streak, streakAtRisk, topOpportunity, leveledUpTo, enabled } =
    useBusinessRating();

  if (isLoading) {
    return <Skeleton className="h-10 w-48 rounded-lg" />;
  }

  // Opted out, or never opted in. This badge is mounted on every authenticated
  // page, so it is the one surface where a missed gate means the score follows the
  // owner everywhere they go — including the AI summary tooltip below, which is a
  // second, older score and equally unwelcome to someone who declined.
  if (!enabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/reports?tab=business-rating" className="relative flex items-center gap-1.5 sm:gap-2.5 border border-muted/20 bg-muted/5 rounded-lg h-9 px-2 hover:bg-muted cursor-pointer transition-all duration-300 w-auto sm:w-44 shrink-0 shadow-sm hover:shadow">
              <div className="text-xs sm:text-sm font-black rounded bg-muted/50 border border-border/50 flex items-center justify-center w-7 h-6 shrink-0 text-muted-foreground">
                --
              </div>
              <div className="w-full hidden sm:block text-left leading-none">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground truncate">Business Rating</span>
                  <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-muted border border-border/40 text-muted-foreground">
                    OFF
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground font-semibold">Click to turn on</span>
                </div>
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-xs p-3 space-y-1.5">
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              Business Rating
            </p>
            <p className="text-xs text-muted-foreground">
              Business rating tracks your sales and scores key pillars of store performance.
            </p>
            <p className="text-xs font-semibold text-orange-500">
              Click to open Reports and turn it on.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const aiSummary = business?.settings?.businessAnalysis?.businessHealth?.summary;

  /** Compact currency, matching the Reports panel's badges. */
  const money = (value: number) => {
    const v = Math.round(value);
    const trim = (s: string) => s.replace(/\.0$/, '');
    if (v >= 1_000_000) return `${currencySymbol}${trim((v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1))}M`;
    if (v >= 10_000) return `${currencySymbol}${(v / 1_000).toFixed(0)}k`;
    return `${currencySymbol}${v.toLocaleString()}`;
  };

  const statusColor =
    score === null
      ? 'text-muted-foreground'
      : score >= 80
        ? 'text-emerald-500'
        : score >= 60
          ? 'text-amber-500'
          : 'text-destructive';

  const progressColor =
    score === null
      ? 'bg-muted'
      : score >= 80
        ? 'bg-emerald-500'
        : score >= 60
          ? 'bg-amber-500'
          : 'bg-destructive';

  const DeltaIcon = delta !== null && delta !== 0 ? (delta > 0 ? TrendingUp : TrendingDown) : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/reports?tab=business-rating" className="relative flex items-center gap-1.5 sm:gap-2.5 border border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-transparent rounded-lg h-9 px-2 hover:bg-muted cursor-pointer transition-all duration-300 w-auto sm:w-44 shrink-0 shadow-sm hover:shadow">
            {/* A tier the shop has never held is waiting to be celebrated on the
                Reports tab. A dot, not confetti — see the header note. */}
            {leveledUpTo && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse"
              />
            )}
            <div className={cn("text-xs sm:text-sm font-black rounded bg-muted/50 border border-border/50 flex items-center justify-center w-7 h-6 shrink-0", statusColor)}>
              {score ?? '--'}
            </div>
            <div className="w-full hidden sm:block text-left leading-none">
              <div className="flex items-center gap-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-foreground truncate">Business Rating</span>
                <span className={cn("text-[9px] font-extrabold uppercase px-1 rounded bg-muted border border-border/40", statusColor)}>
                  {grade}
                </span>
                {DeltaIcon && (
                  <DeltaIcon
                    className={cn('h-2.5 w-2.5 shrink-0', delta! > 0 ? 'text-emerald-500' : 'text-destructive')}
                  />
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                <Progress value={score ?? 0} className="h-0.5 flex-1" indicatorClassName={progressColor} />
                {streak > 0 && (
                  <span
                    className={cn(
                      'flex items-center gap-0.5 text-[9px] font-bold',
                      streakAtRisk ? 'text-muted-foreground' : 'text-orange-500',
                    )}
                  >
                    <Flame className={cn('h-2.5 w-2.5', streakAtRisk && 'opacity-50')} />
                    {streak}
                  </span>
                )}
              </div>
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs p-3 space-y-1.5">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-primary" />
            {score === null ? 'Not rated yet' : `${tier.name} · ${grade} (${score}/100)`}
          </p>
          {score === null ? (
            <p className="text-xs text-muted-foreground">Record your first sale to get a rating.</p>
          ) : (
            <>
              {leveledUpTo && (
                <p className="text-xs font-semibold text-primary">
                  New level reached — {leveledUpTo.name}. Open Reports to see it.
                </p>
              )}
              {delta !== null && delta !== 0 && (
                <p className={cn('text-xs font-semibold', delta > 0 ? 'text-emerald-600' : 'text-destructive')}>
                  {delta > 0 ? `Up ${delta}` : `Down ${Math.abs(delta)}`} since your last visit
                  {/* Names the cause rather than leaving the owner to guess — the
                      same attribution the Reports panel shows. */}
                  {movers.length > 0 && (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      ({movers
                        .slice(0, 2)
                        .map((m) => `${m.label} ${m.delta > 0 ? `+${m.delta}` : m.delta}`)
                        .join(', ')})
                    </span>
                  )}
                </p>
              )}
              {streakAtRisk && streak > 0 && (
                <p className="text-xs text-muted-foreground">
                  {streak}-day streak — no sale recorded today yet.
                </p>
              )}
              {topOpportunity && (
                <p className="text-xs text-muted-foreground">
                  {topOpportunity.label}{' '}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {money(topOpportunity.money)}
                  </span>
                </p>
              )}
              {aiSummary && <p className="text-xs text-muted-foreground leading-relaxed">{aiSummary}</p>}
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
