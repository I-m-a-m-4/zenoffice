import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonPage, SkeletonPageHeader } from '@/components/shared/page-skeletons';

/**
 * Support is `space-y-8 pb-10`: `PageTitle`, then
 * `grid-cols-1 lg:grid-cols-3 gap-8` with the CEO chat panel taking
 * `lg:col-span-2` at a fixed `h-[70vh]` and the help column beside it.
 *
 * The chat panel's height is viewport-relative in the real page, so it is
 * reproduced as `h-[70vh]` here — a fixed pixel height would collapse on a phone
 * and overshoot on a desktop till.
 */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-8 pb-10">
      <SkeletonPageHeader titleWidth="w-44" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-[70vh] flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-9 w-9" />
          </div>
          <Skeleton className="flex-1 w-full rounded-lg" />
          <div className="flex items-center gap-2 mt-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-10 shrink-0" />
          </div>
        </div>

        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card shadow-sm p-6 space-y-3">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-10 w-32" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
