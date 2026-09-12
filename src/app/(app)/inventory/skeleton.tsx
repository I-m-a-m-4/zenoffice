/**
 * Inventory's loading shape, in one place.
 *
 * Two callers need it and they must not drift apart:
 *
 * - `loading.tsx`, shown while the route chunk arrives;
 * - the `React.Suspense` fallback in `page.tsx`, shown while `useSearchParams`
 *   suspends — which is the one users on a cold desktop launch actually watch.
 *
 * Before this existed the in-page one drew a title row, one full-width bar and
 * three `h-16` blocks inside `p-4 sm:p-6`. Inventory has **no page title at
 * all**, its search bar is a sticky `border-b` header, it has a two-tab list,
 * and its body is a card holding a table — so every part of that picture was
 * wrong, and the `p-4 sm:p-6` sat on top of `<main>`'s own gutters so the whole
 * page slid left the moment it resolved.
 *
 * No `'use client'` and no hooks: `loading.tsx` renders this on the server.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SkeletonTableCard } from '@/components/shared/page-skeletons';

export function InventoryBodySkeleton({ className }: { className?: string }) {
  return (
    /* Mirrors the real root: `flex flex-col flex-1 w-full pb-16 md:pb-0`. */
    <div
      role="status"
      aria-busy="true"
      className={cn(
        'flex flex-col flex-1 w-full pb-16 md:pb-0 animate-in fade-in duration-150',
        className
      )}
    >
      {/*
        The sticky search header: `py-3.5 gap-4 border-b mb-4`, an `h-10` search
        input beside an `h-10 w-10` search button, and the `sm`-height (`h-9`)
        filter / export / add buttons that only appear from `md` up.
      */}
      <div className="flex items-center py-3.5 gap-4 border-b mb-4">
        <div className="flex flex-1 items-center gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-10 shrink-0" />
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* All products / Health — `TabsList` is `grid w-full grid-cols-2` inside
          a `w-full md:max-w-md` wrapper, so it is half-width on a desktop. */}
      <div className="w-full mb-4">
        <div className="grid w-full md:max-w-md grid-cols-2 gap-1 h-10 items-center rounded-md bg-muted p-1">
          <Skeleton className="h-8 w-full rounded-sm bg-background" />
          <Skeleton className="h-8 w-full rounded-sm" />
        </div>
      </div>

      {/*
        The product card: a real `CardHeader` with title and description, no
        toolbar of its own (search lives in the sticky bar above), then the
        table. Seven columns for an owner — checkbox, image, name, status,
        price, stock, actions.
      */}
      <SkeletonTableCard
        rows={9}
        cols={7}
        toolbar={false}
        className="flex-1 min-h-0 w-full overflow-hidden mb-2"
      />
    </div>
  );
}
