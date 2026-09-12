import { Skeleton } from '@/components/ui/skeleton';

/**
 * POS step 2: `grid md:grid-cols-3 gap-8` — the customer search and list in
 * `md:col-span-2`, the selected-customer card beside it. The list rows are
 * `h-16`, matching the page's own three-row loading state.
 *
 * No padding: `sales/pos/layout.tsx` provides it along with the step indicator.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="grid md:grid-cols-3 gap-8 animate-in fade-in duration-150">
      <div className="md:col-span-2 rounded-lg border bg-card shadow-sm">
        <div className="p-6 space-y-1.5">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32 shrink-0" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 space-y-1.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-52 max-w-full" />
        </div>
        <div className="px-6 pb-6 space-y-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
