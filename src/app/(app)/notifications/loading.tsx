import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonPage } from '@/components/shared/page-skeletons';

/**
 * Notifications is a `text-3xl font-black` heading with an icon and a
 * mark-all-read action (`mb-8`, not the usual `mb-6`), over a
 * `flex flex-col gap-4` list of cards whose bodies are `p-6 h-24`.
 *
 * Those measurements come from the page's own loading state, which already draws
 * exactly this — so the two match by construction.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <Skeleton className="h-9 w-52" />
          </div>
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border-none bg-muted/50 shadow-sm">
            <div className="p-6 h-24" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
