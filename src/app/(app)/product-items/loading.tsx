import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonPage } from '@/components/shared/page-skeletons';

/**
 * Product Items is a placeholder page: a `text-xl` heading over one card whose
 * body is a centred empty state. Nothing loads, so this only ever flashes while
 * the chunk arrives — but a four-up stat grid here was pure fiction.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <Skeleton className="h-7 w-44" />
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="px-6 pb-12 pt-6 flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
      </div>
    </SkeletonPage>
  );
}
