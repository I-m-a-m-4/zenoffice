import { Skeleton } from '@/components/ui/skeleton';

/**
 * Zen AI is the **only** full-bleed route — `(app)/layout.tsx` gives it
 * `overflow-hidden` and no padding so the chat can own its own scrolling. So
 * this is the one skeleton that must supply its own gutters, and the only one
 * that fills the viewport rather than stacking down the page.
 *
 * It mirrors the welcome screen: the wordmark, the `text-2xl sm:text-3xl`
 * "What would you like to know?" heading, the four suggested-prompt cards at
 * `grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5`, then the composer.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex h-full w-full flex-col items-center justify-center animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl px-4 flex flex-col items-center justify-center -mt-10 sm:-mt-16">
        <Skeleton className="h-10 sm:h-12 w-40 mb-4 sm:mb-6" />
        <Skeleton className="h-8 sm:h-9 w-72 max-w-full mb-6 sm:mb-8" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 mb-6 w-full">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card/60 flex items-center gap-2.5 px-3 py-2.5 sm:p-3.5"
            >
              <Skeleton className="h-5 w-5 rounded shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  );
}
