/**
 * Billing's loading shape, in one place.
 *
 * Two callers need it and they must not drift apart: `loading.tsx` (route chunk)
 * and the `!business` branch in `page.tsx`, which is the longer wait.
 *
 * The page is `PageTitle` → subscription card (status block + a two-up plan rail)
 * → payment history, and this has to be that and nothing else. It has been wrong
 * in both directions already: it once predated the AI credits rail and drew a
 * single `h-40` bar where a whole card belonged, and then outlived that rail and
 * drew three pack cards for a section the page no longer mounts. Either way the
 * page resizes the moment data arrives, which is how a skeleton quietly becomes a
 * different page.
 *
 * No `'use client'` and no hooks: `loading.tsx` renders this on the server.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  SkeletonPageHeader,
  SkeletonTableCard,
} from '@/components/shared/page-skeletons';

export function BillingBodySkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('flex flex-col gap-6 animate-in fade-in duration-150', className)}
    >
      <SkeletonPageHeader titleWidth="w-56" actions={1} />

      {/* Subscription & Billing */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 space-y-1.5">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="px-6 pb-6 space-y-6">
          {/* Current status — `p-4 border rounded-lg bg-muted/50` */}
          <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-64 max-w-full" />
          </div>
          {/*
            The plan rail. Heights copied from `page.tsx`'s own `dynamic()`
            fallback for `SubscriptionSection`, which uses `Card className="h-96"`
            — the two pictures are shown one after the other, so a different
            number here would make the page resize between them.
          */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-96 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      <SkeletonTableCard rows={4} cols={4} toolbar={false} />
    </div>
  );
}
