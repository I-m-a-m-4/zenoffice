import { Skeleton } from '@/components/ui/skeleton';

/**
 * POS step 3: `grid md:grid-cols-3 gap-8`. In `md:col-span-2`, the payment-method
 * radio grid (`sm:grid-cols-2 lg:grid-cols-4`) and the discount/tax card
 * (`sm:grid-cols-2`); the order summary sits in the third column.
 *
 * No padding: `sales/pos/layout.tsx` provides it along with the step indicator.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="grid md:grid-cols-3 gap-8 animate-in fade-in duration-150">
      <div className="md:col-span-2 space-y-8">
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6 space-y-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <div className="px-6 pb-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card shadow-sm">
          <div className="p-6 space-y-1.5">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
          <div className="px-6 pb-6 grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 space-y-1.5">
          <Skeleton className="h-6 w-36" />
        </div>
        <div className="px-6 pb-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
          <Skeleton className="h-px w-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
