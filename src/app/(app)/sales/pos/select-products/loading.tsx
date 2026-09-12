import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonProductGrid } from '@/components/shared/page-skeletons';

/**
 * The POS product picker: `grid md:grid-cols-3 md:gap-8` with the catalogue in
 * `md:col-span-2` under a sticky search bar (`h-11` input, `h-11 w-11` buttons),
 * and the cart in the third column.
 *
 * No `SkeletonPage` and no padding: `sales/pos/layout.tsx` already supplies both
 * `p-4 sm:p-6` and the step indicator, and it stays mounted while this renders.
 *
 * This is the page whose empty grid started all of this, so the product tiles
 * here are the *same* shape as the in-page `ProductCardSkeleton` — which now
 * stays up until the catalogue actually arrives instead of flipping to
 * "No products found" the moment a sync fails.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="grid md:grid-cols-3 md:gap-8 animate-in fade-in duration-150">
      <div className="md:col-span-2">
        <div className="flex flex-col mb-4 gap-2 sticky top-0 bg-background py-2 z-10 border-b">
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 w-11 shrink-0" />
            <Skeleton className="h-11 w-11 shrink-0 md:hidden" />
            <Skeleton className="h-11 w-24 shrink-0" />
          </div>
        </div>
        <SkeletonProductGrid count={9} />
      </div>

      {/* Cart column */}
      <div className="hidden md:block">
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6 space-y-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="px-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
