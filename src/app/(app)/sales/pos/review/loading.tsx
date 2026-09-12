import { Skeleton } from '@/components/ui/skeleton';

/**
 * POS step 4: `grid md:grid-cols-3 gap-8` — a `text-2xl` heading over the receipt
 * preview in `md:col-span-2`, and the "ready to complete" panel
 * (`p-4 rounded-lg bg-card border space-y-4`) beside it.
 *
 * No padding: `sales/pos/layout.tsx` provides it along with the step indicator.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="grid md:grid-cols-3 gap-8 animate-in fade-in duration-150">
      <div className="md:col-span-2">
        <Skeleton className="h-8 w-56 mb-4" />
        {/* Receipt preview */}
        <div className="rounded-lg border bg-card shadow-sm p-6 space-y-4">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-px w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
          <Skeleton className="h-px w-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
      </div>

      <div>
        <div className="p-4 rounded-lg bg-card border space-y-4">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
