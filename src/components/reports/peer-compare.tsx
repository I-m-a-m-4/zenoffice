'use client';

/**
 * Reports → Business Rating → How you compare.
 *
 * The reference point. Until this existed the tab could only rank a shop against
 * its own yesterday, which answers "am I improving" but never "am I any good".
 *
 * ── Why a diverging chart and not four more meters ─────────────────────────
 *
 * The pillar list above already draws each score against 100. Repeating that with a
 * second bar beside it would be the same picture twice, and at these values almost
 * unreadable: 61 and 58 against a hundred-point scale are two bars of nearly
 * identical length saying nothing. So this draws the *difference* — bars leaving a
 * centre line, right for ahead and left for behind, scaled to the largest gap on
 * the card. The question is "where do I stand", and a gap is the answer to it.
 *
 * ── Every number here is real or absent ────────────────────────────────────
 *
 * The medians come from `src/lib/rating-benchmark.ts`: actual scores of actual
 * Zeneva shops that traded, suppressed below a five-business cohort and suppressed
 * per pillar too. The tab this replaced showed 400 invented competitors and
 * percentiles computed as `score * 0.8`, which is the failure this is the
 * correction for — so when there is no cohort this says so plainly rather than
 * estimating one. A pillar the shop cannot measure is left out entirely; there is
 * no gap to draw between an unknown and a median.
 *
 * The caption carries the cohort size and the date the platform last computed it,
 * because the recompute is opportunistic and the figures are as of then, not live.
 */

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';
import type { RatingPillar } from '@/lib/business-rating';
import type { RatingBenchmark } from '@/lib/rating-benchmark';

interface Row {
  label: string;
  mine: number;
  median: number;
  diff: number;
}

export default function PeerCompare({
  score,
  pillars,
  benchmark,
}: {
  score: number | null;
  pillars: RatingPillar[];
  benchmark: RatingBenchmark | null;
}) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const animate = !reduce;

  const rows = React.useMemo<Row[]>(() => {
    if (!benchmark) return [];
    const out: Row[] = [];
    for (const p of pillars) {
      const median = benchmark.medians?.[p.key];
      // Both sides have to exist. An unmeasured pillar has no position to compare,
      // and a pillar with too small a cohort has no median to compare against.
      if (!p.measured || median === null || median === undefined) continue;
      out.push({ label: p.label, mine: p.score, median, diff: p.score - median });
    }
    return out;
  }, [pillars, benchmark]);

  const overallMedian = benchmark?.medians?.overall ?? null;
  const overallDiff = score !== null && overallMedian !== null ? score - overallMedian : null;

  const benchmarkDate = React.useMemo(() => {
    if (!benchmark?.updatedAt) return null;
    const d = new Date(benchmark.updatedAt);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }, [benchmark?.updatedAt]);

  // No cohort. Said out loud rather than left as an empty space, because a missing
  // panel reads as something broken — and rather than estimated, because estimating
  // it is the exact thing this replaced.
  if (!benchmark || rows.length === 0) {
    return (
      <Card className="flex items-center gap-3 border-dashed p-5">
        <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t('reports.pcEmptyTitle')}</p>
          <p className="text-xs text-muted-foreground">
            {t('reports.pcEmptyBody')}
          </p>
        </div>
      </Card>
    );
  }

  // Scaled to the biggest gap on the card, floored at 10 points so a shop sitting
  // within a point or two of the median does not get a dramatic full-width bar for
  // a difference that does not matter.
  const scale = Math.max(10, ...rows.map((r) => Math.abs(r.diff)), Math.abs(overallDiff ?? 0));

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {t('reports.pcTitle')}
        </span>
        {overallDiff !== null && (
          <span className="flex items-baseline gap-1.5">
            <span
              className={cn(
                'text-2xl font-bold tabular-nums',
                overallDiff > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : overallDiff < 0
                    ? 'text-destructive'
                    : 'text-muted-foreground',
              )}
            >
              {overallDiff > 0 ? `+${overallDiff}` : overallDiff}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{t('reports.pcVsMedianShop')}</span>
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {rows.map((row, i) => {
          const width = (Math.abs(row.diff) / scale) * 50; // 50% = half the track
          const ahead = row.diff > 0;
          return (
            <div key={row.label} className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-sm font-semibold text-foreground">{row.label}</span>

              <div className="relative h-5 flex-1">
                {/* Centre line — the median's position, and the axis the bars leave from */}
                <span aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/40" />
                {row.diff !== 0 && (
                  <motion.span
                    className={cn(
                      'absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm',
                      ahead ? 'left-1/2 bg-emerald-500' : 'right-1/2 bg-destructive',
                    )}
                    initial={{ width: animate ? 0 : `${width}%` }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: animate ? 0.7 : 0, delay: animate ? 0.1 + i * 0.09 : 0, ease: 'easeOut' }}
                  />
                )}
              </div>

              <span
                className={cn(
                  'w-10 shrink-0 text-right text-xs font-bold tabular-nums',
                  ahead
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : row.diff < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                )}
              >
                {row.diff > 0 ? `+${row.diff}` : row.diff}
              </span>
              {/* The absolute pair, so the gap is never the only thing on offer —
                  "+7" means little without knowing it is 61 against 54. */}
              <span className="hidden w-20 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground sm:block">
                {row.mine} v {row.median}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-border/40 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        {benchmarkDate
          ? t('reports.pcFootnoteAsOf', {
              shops: benchmark.cohort,
              sales: benchmark.minSales,
              days: benchmark.windowDays,
              asOf: benchmarkDate,
            })
          : t('reports.pcFootnote', {
              shops: benchmark.cohort,
              sales: benchmark.minSales,
              days: benchmark.windowDays,
            })}
      </p>
    </Card>
  );
}
