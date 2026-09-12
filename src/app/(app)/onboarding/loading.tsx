import { Skeleton } from '@/components/ui/skeleton';

/**
 * Onboarding is the one route that is not a page inside the shell — it is a
 * `fixed inset-0 z-50` overlay with its own centring and its own padding, so it
 * ignores `<main>`'s gutters entirely. The skeleton has to be the same overlay
 * or it flashes as a narrow strip at the top of the screen before the real card
 * covers everything.
 *
 * No `SkeletonPage` wrapper here for the same reason: its `space-y-6` and the
 * shell's rhythm are both irrelevant inside a fixed overlay.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="fixed inset-0 z-50 w-full flex flex-col items-center justify-center min-h-screen py-8 px-4 lg:px-8 bg-background/40 overflow-y-auto backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl space-y-5 sm:space-y-6 bg-card/95 dark:bg-card/80 backdrop-blur-xl border border-border/60 p-6 sm:p-8 rounded-xl my-auto shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
        <div className="text-center mb-6 flex flex-col items-center">
          <Skeleton className="h-8 sm:h-9 w-full max-w-md" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-2 w-16 rounded-full" />
          ))}
        </div>

        {/* Step body — the form fields sit in `grid-cols-1 sm:grid-cols-2` */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}
