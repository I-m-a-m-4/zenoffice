import { Skeleton } from '@/components/ui/skeleton';

/**
 * A child of `/ai-insights`, so it inherits the full-bleed treatment and must
 * pad itself. A `text-2xl` heading over grouped capability cards, whose inner
 * lists are `grid sm:grid-cols-2 gap-1.5`.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="h-full w-full overflow-y-auto p-4 sm:p-6 animate-in fade-in duration-150"
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>

        {Array.from({ length: 4 }).map((_, g) => (
          <div key={g} className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded shrink-0" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
