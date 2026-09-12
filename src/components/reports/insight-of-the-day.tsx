'use client';

/**
 * Insight of the day.
 *
 * The rating answers *what* (61, ₦480,000 on the table). This card answers *why a
 * shop like yours leaves it there*, which is the part an owner repeats to somebody
 * else. One a day, drawn from `src/lib/rating-insights.ts`.
 *
 * ── What is a claim and what is their data ─────────────────────────────────
 *
 * The card is laid out so the reader can always tell the two apart, because the
 * whole feature rests on that distinction:
 *
 * - The **headline** is the retail mechanism. Same sentence for every shop, no
 *   figures in it — a general claim, presented as one.
 * - The **figure block** is their own arithmetic, labelled, sitting next to the
 *   median shop's where a cohort exists. Every number on this card came out of
 *   their receipts or out of a real median. Nothing is a projection dressed as a
 *   fact, and nothing is a statistic nobody measured.
 *
 * ── Movement, and when it stops ────────────────────────────────────────────
 *
 * A light sweeps the card once on reveal, the money figure counts up, and the
 * comparison bars grow from zero. All of it is once-only: nothing on this card
 * loops, because a card that keeps moving stops being read. Every animation is
 * gated on `useReducedMotion`, which leaves the card fully legible and completely
 * still.
 */

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';
import { useCountUp } from '@/hooks/use-count-up';
import type { RatingInsight } from '@/lib/rating-insights';

/** Compact currency, matching every other rating surface. */
function money(symbol: string, value: number): string {
  const v = Math.round(value);
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (v >= 1_000_000) return `${symbol}${trim((v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1))}M`;
  if (v >= 10_000) return `${symbol}${trim((v / 1_000).toFixed(0))}k`;
  return `${symbol}${v.toLocaleString()}`;
}

/**
 * Accent per severity. Warm for money already leaving, amber for a gap worth
 * closing, emerald for an advantage worth defending — and the icon and wording
 * carry the same message, so the colour is never doing the work by itself.
 */
function accent(severity: RatingInsight['severity']) {
  switch (severity) {
    case 'critical':
      return {
        ring: 'border-destructive/40',
        wash: 'from-destructive/12 via-destructive/5',
        chip: 'bg-destructive/10 text-destructive',
        dot: 'bg-destructive',
        figure: 'text-destructive',
      };
    case 'warning':
      return {
        ring: 'border-amber-500/40',
        wash: 'from-amber-500/12 via-amber-500/5',
        chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        dot: 'bg-amber-500',
        figure: 'text-amber-600 dark:text-amber-400',
      };
    default:
      return {
        ring: 'border-emerald-500/40',
        wash: 'from-emerald-500/12 via-emerald-500/5',
        chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        figure: 'text-emerald-600 dark:text-emerald-400',
      };
  }
}

/**
 * Their pillar score against the median shop's.
 *
 * Two bars rather than a bar with a tick, because on this card the comparison *is*
 * the point. Both sides are scores out of 100 and both bars are drawn against 100 —
 * not against each other. Scaling to the larger of the two would turn 37 against 42
 * into a bar of 88% beside a bar of 100%, which reads as a rout over a five-point
 * gap. The delta chip carries the precision that the true scale gives up.
 *
 * The insight's own headline figure stays above this: that is the business number
 * (a share of single-item sales, a margin), and it is a different quantity from a
 * pillar score, so it never shares an axis with one.
 */
function Compare({
  peer,
  animate,
}: {
  peer: NonNullable<RatingInsight['peer']>;
  animate: boolean;
}) {
  const { t } = useI18n();
  const diff = peer.mine - peer.median;
  const rows = [
    { name: t('reports.iotdYou'), value: peer.mine, mine: true },
    { name: t('reports.iotdMedianShop'), value: peer.median, mine: false },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{peer.label}</p>
        <span
          className={cn(
            'text-[11px] font-bold tabular-nums',
            diff > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : diff < 0
                ? 'text-destructive'
                : 'text-muted-foreground',
          )}
        >
          {diff > 0 ? `+${diff}` : diff} {t('reports.iotdVsMedian')}
        </span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span
            className={cn(
              'w-24 shrink-0 text-[11px] font-semibold',
              row.mine ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {row.name}
          </span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <motion.div
              className={cn('absolute inset-y-0 left-0 rounded-full', row.mine ? 'bg-primary' : 'bg-foreground/35')}
              initial={{ width: animate ? 0 : `${row.value}%` }}
              animate={{ width: `${row.value}%` }}
              transition={{ duration: animate ? 0.8 : 0, delay: animate ? 0.25 + i * 0.12 : 0, ease: 'easeOut' }}
            />
          </div>
          <span
            className={cn(
              'w-14 shrink-0 text-right text-xs font-bold tabular-nums',
              row.mine ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function InsightOfTheDay({
  insight,
  total,
  currencySymbol,
}: {
  insight: RatingInsight;
  /** How many insights the shop's figures currently support, for the counter. */
  total: number;
  currencySymbol: string;
}) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const animate = !reduce;
  const a = accent(insight.severity);
  const counted = useCountUp(insight.money ?? 0, animate && insight.money !== undefined);

  const PeerIcon = insight.peer?.better ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Card className={cn('relative overflow-hidden border', a.ring)}>
        {/* Wash + one-off sheen. `pointer-events-none` throughout: none of this is
            interactive and it sits over the whole card. */}
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent', a.wash)} />
        {animate && (
          <div
            aria-hidden
            className="animate-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/10"
          />
        )}

        <div className="relative p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5', a.chip)}>
              <Lightbulb className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t('reports.iotdTitle')}</span>
            </span>
            {total > 1 && (
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                {t('reports.iotdRotation', { total })}
              </span>
            )}
          </div>

          {/* The claim. Deliberately the largest thing on the card — it is the part
              worth remembering, and the figures below are the evidence for it. */}
          <p className="max-w-2xl text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl">
            {insight.principle}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{insight.because}</p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:items-center">
            {/* Their evidence: their own figure, then the like-for-like pair */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {insight.yours.label}
              </p>
              <p className={cn('mt-0.5 text-3xl font-bold tabular-nums', a.figure)}>{insight.yours.value}</p>

              {insight.peer && (
                <div className="mt-4 border-t border-border/40 pt-3">
                  <Compare peer={insight.peer} animate={animate} />
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <PeerIcon
                      className={cn('h-3.5 w-3.5', insight.peer.better ? 'text-emerald-500' : 'text-destructive')}
                    />
                    {insight.peer.better ? 'Ahead of the median Zeneva shop' : 'Behind the median Zeneva shop'}
                  </p>
                </div>
              )}
            </div>

            {/* The stake and the move */}
            <div className="flex flex-col items-start gap-3 sm:items-end">
              {insight.money !== undefined && insight.money > 0 && (
                <div className="sm:text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t('reports.iotdAtStake')}
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {money(currencySymbol, counted)}
                  </p>
                </div>
              )}
              <Link
                href={insight.href}
                className="group inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:shadow-md"
              >
                {insight.move}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
