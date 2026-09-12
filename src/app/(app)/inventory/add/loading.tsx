import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonPage } from '@/components/shared/page-skeletons';

/**
 * The add-product form: a back button, a `text-xl` heading and the
 * Discard/Save pair (hidden below `md`), over
 * `grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8` — the field cards
 * in `lg:col-span-2` with the image and status cards in the narrow rail.
 */
export default function Loading() {
  return (
    <SkeletonPage className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
        <Skeleton className="h-7 flex-1 max-w-xs" />
        <div className="hidden md:flex items-center gap-2 ml-auto">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
        <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
          {/* Details card, then the pricing/stock card at `sm:grid-cols-2` */}
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="p-6 space-y-1.5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <div className="px-6 pb-6 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card shadow-sm">
            <div className="p-6 space-y-1.5">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="px-6 pb-6 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Image + status rail */}
        <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
          <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
