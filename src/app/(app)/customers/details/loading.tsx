import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonPage } from '@/components/shared/page-skeletons';

/**
 * Copied from the skeleton the page itself renders while the customer loads
 * (`customers/details/page.tsx`): a back/title bar, then
 * `grid md:grid-cols-3 gap-6` with a short profile card beside a tall panel, then
 * the purchase-history table. Keeping the two identical means the route
 * transition and the data fetch look like one continuous wait rather than two.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <Skeleton className="h-10 w-48" />
      <div className="grid md:grid-cols-3 gap-6">
        <Skeleton className="h-48 md:col-span-1 rounded-lg" />
        <Skeleton className="h-96 md:col-span-2 rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </SkeletonPage>
  );
}
