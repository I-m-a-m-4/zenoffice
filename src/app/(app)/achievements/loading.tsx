import { Skeleton } from '@/components/ui/skeleton';
import {
  SkeletonPage,
  SkeletonPageHeader,
  SkeletonCardGrid,
} from '@/components/shared/page-skeletons';

/**
 * Achievements: `PageTitle`, the milestone-timeline card, then the badge grid.
 * Badges are square-ish tiles, so `h-36` rather than the default `h-32`.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader titleWidth="w-56" />

      {/* Milestone timeline card */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 space-y-1.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="px-6 pb-6">
          <SkeletonCardGrid count={4} cols="grid-cols-2 md:grid-cols-4" height="h-40" />
        </div>
      </div>

      {/* Goals card */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 space-y-1.5">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="px-6 pb-6 space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
