import { Skeleton } from '@/components/ui/skeleton';
import {
  SkeletonPage,
  SkeletonPageHeader,
  SkeletonStatCards,
  SkeletonChartCard,
} from '@/components/shared/page-skeletons';

/**
 * Reports: `PageTitle` with the export menu, a four-tab list that is a *column*
 * on mobile and a fixed `md:w-[650px]` grid above it, the seven-across stat strip
 * (`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7` — the widest grid
 * in the app), then rows of paired analysis panels.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader titleWidth="w-36" actions={2} />

      {/* `TabsList` here is `h-auto gap-1`, stacked on mobile and 4-up from md. */}
      <div className="flex flex-col md:grid md:grid-cols-4 w-full md:w-[650px] gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))}
      </div>

      <SkeletonStatCards
        count={7}
        cols="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChartCard height="h-[280px]" />
        <SkeletonChartCard height="h-[280px]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChartCard height="h-[280px]" legend={false} />
        <SkeletonChartCard height="h-[280px]" legend={false} />
      </div>
    </SkeletonPage>
  );
}
