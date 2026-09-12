import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonPage, SkeletonPageHeader } from '@/components/shared/page-skeletons';

/**
 * Storefront is a two-column editor:
 * `grid-cols-1 lg:grid-cols-[1fr_2fr] xl:grid-cols-[450px_1fr] gap-8 items-start`
 * — a sticky stack of settings cards on the left, the live store preview on the
 * right. A stat grid here would have been completely wrong.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader titleWidth="w-60" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] xl:grid-cols-[450px_1fr] gap-8 items-start">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card shadow-sm">
              <div className="p-6 space-y-1.5">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              <div className="px-6 pb-6 space-y-4">
                {Array.from({ length: 2 }).map((_, f) => (
                  <div key={f} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Preview: hero banner, two buttons, then the product grid */}
        <div className="w-full border rounded-lg overflow-hidden">
          <Skeleton className="h-48 w-full rounded-none" />
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
