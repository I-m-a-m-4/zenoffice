import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonPage } from '@/components/shared/page-skeletons';

/**
 * The inventory health check: `grid gap-6` of cards, the first summarising the
 * scan and the rest a grid of issue tiles (missing price, low stock, short
 * description, missing category) that are `flex flex-col` with a footer action.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 space-y-1.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="px-6 pb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card shadow-sm flex flex-col">
              <div className="p-6 pb-4 flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded shrink-0" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="px-6 flex-grow">
                <Skeleton className="h-8 w-12" />
              </div>
              <div className="p-6 pt-4">
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The AI recommendation card beneath */}
      <div className="rounded-lg border bg-card shadow-sm p-6 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-40" />
      </div>
    </SkeletonPage>
  );
}
