import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonPage, SkeletonHeading } from '@/components/shared/page-skeletons';

/**
 * Branch management: a `text-3xl` heading with the add-branch action, then a
 * `flex flex-col gap-4 w-full` stack of branch cards — a full-width list, not the
 * grid the universal skeleton drew.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeading titleWidth="w-64" actions={1} />

      <div className="flex flex-col gap-4 w-full">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card shadow-sm">
            <div className="p-6 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded shrink-0" />
                  <Skeleton className="h-6 w-40" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </div>
              <Skeleton className="mt-2 h-3 w-72 max-w-full" />
            </div>
            <div className="px-6 pb-4 grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, s) => (
                <div key={s} className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
