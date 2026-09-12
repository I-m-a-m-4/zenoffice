/**
 * The dashboard's loading shape, in one place.
 *
 * Two callers need it and they must not drift apart:
 *
 * - `loading.tsx`, shown while the route chunk arrives (a server component, so
 *   it cannot know the signed-in user's role and takes the defaults);
 * - `page.tsx`, shown while the POS context is still assembling the figures —
 *   which is the longer wait and the one users actually watch.
 *
 * Before this existed the two were different pictures *and* the in-page one was
 * wrong: four cards in a `lg:grid-cols-4` row over two `h-[350px]` blocks and
 * three `h-[300px]` blocks, when the real page renders up to nine cards at
 * `lg:grid-cols-3`, then a 2/3 + 1/3 chart split, then a 2 + 1 panel row. It also
 * wrapped itself in `p-4 sm:p-6` while the real page root uses `p-1` on top of
 * `<main>`'s gutters, so everything slid left the moment the data landed.
 *
 * No `'use client'` and no hooks: `loading.tsx` renders this on the server.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  SkeletonPageHeader,
  SkeletonStatCards,
  SkeletonChartCard,
  SkeletonListCard,
} from '@/components/shared/page-skeletons';

export function DashboardBodySkeleton({
  /**
   * Summary cards. An owner sees eight (revenue, product revenue, service
   * revenue, units, new customers, POS sales, online sales, low stock) plus a
   * ninth when there are recorded debts. A member of staff without
   * `view_reports` sees only the three that quote no money.
   */
  cards = 8,
  /** The chart row is behind the same `view_reports` permission as the money cards. */
  charts = true,
  className,
}: {
  cards?: number;
  charts?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('flex flex-col gap-6 animate-in fade-in duration-150', className)}
    >
      <SkeletonPageHeader titleWidth="w-40" actions={2} />

      {/* Today's Focus — one line of advice from the business rating. */}
      {charts && <Skeleton className="h-28 w-full rounded-xl" />}

      <SkeletonStatCards count={cards} cols="md:grid-cols-2 lg:grid-cols-3" />

      {charts && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonChartCard className="lg:col-span-2" height="h-[300px]" legend={false} />
          <SkeletonChartCard height="h-[240px]" />
        </div>
      )}

      {/* Sales activity spans two columns when the charts are visible, all three
          when they are not — exactly as the real card's `md:col-span-*` does. */}
      <div className="grid gap-6 md:grid-cols-3">
        <SkeletonListCard
          rows={4}
          avatar={false}
          className={charts ? 'md:col-span-2' : 'md:col-span-3'}
        />
        {charts && <SkeletonListCard rows={4} />}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SkeletonListCard rows={4} avatar={false} />
        <SkeletonListCard rows={4} avatar={false} />
      </div>
    </div>
  );
}
