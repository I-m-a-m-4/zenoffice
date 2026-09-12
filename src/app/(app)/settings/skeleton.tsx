/**
 * Settings' loading shape, in one place.
 *
 * Two callers need it and they must not drift apart: `loading.tsx` (route chunk)
 * and the `!mounted || isPosLoading` branch in `page.tsx`.
 *
 * The old in-page version drew one card and no tab bar, so the pills — the most
 * prominent thing on the page and the only way to reach the other three sections
 * — appeared out of nowhere when the data landed.
 *
 * What the General tab actually is: `PageTitle`, four bordered pill triggers on a
 * `border-b pb-4` row (this `TabsList` is `bg-transparent p-0`, *not* the usual
 * muted bar), then the profile card whose body is `grid-cols-1 md:grid-cols-3` —
 * name, address textarea and a `sm:grid-cols-2` phone/email pair in the wide
 * column, an `aspect-square` logo dropzone in the narrow one — followed by two
 * compact cards (store review, appearance).
 *
 * No `'use client'` and no hooks: `loading.tsx` renders this on the server.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SkeletonPageHeader } from '@/components/shared/page-skeletons';

/** One of the two short cards under the profile card: header, then one control. */
function CompactCardSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-border/15 dark:border-border/25 bg-card">
      <div className="p-6 space-y-1.5">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="px-6 pb-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SettingsBodySkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('space-y-6 animate-in fade-in duration-150', className)}
    >
      <SkeletonPageHeader titleWidth="w-32" />

      {/* Four pills, `px-4 py-2` → a 36px box, so `h-9`. */}
      <div className="w-full flex flex-wrap justify-start gap-2 mb-4 border-b pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>

      {/* Business profile */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 space-y-1.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
            {/* Address is a `Textarea`, not an `Input`. */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            {/* The dropzone is `aspect-square`, so it grows with the column. */}
            <Skeleton className="aspect-square w-full rounded-md" />
          </div>
        </div>
      </div>

      <CompactCardSkeleton />
      <CompactCardSkeleton rows={2} />
    </div>
  );
}
