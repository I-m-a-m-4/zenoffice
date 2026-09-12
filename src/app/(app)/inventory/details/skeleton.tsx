/**
 * The edit-product form's loading shape, in one place.
 *
 * Three callers need it and they must not drift apart: `loading.tsx` (route
 * chunk), the `Suspense` fallback in `page.tsx` (`useSearchParams`), and the
 * in-page `isLoading` branch (the product document arriving).
 *
 * It mirrors the real form: a back button and `text-xl` heading over
 * Discard / Delete / Save at `size="lg"` (`h-11`), then
 * `grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3` — two field cards in
 * `lg:col-span-2` and the status + image rail beside them. The root repeats the
 * form's own `px-1.5 sm:px-0`, which exists to stop the inputs clipping on a
 * narrow phone.
 *
 * No `'use client'` and no hooks: `loading.tsx` renders this on the server.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function EditProductBodySkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        'grid flex-1 auto-rows-max gap-4 w-full max-w-full px-1.5 sm:px-0 animate-in fade-in duration-150',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
        <Skeleton className="h-7 flex-1 min-w-0 max-w-sm" />
        <div className="hidden items-center gap-2 md:ml-auto md:flex">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-32" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
        <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
          {/* Details — name over description. */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-2 h-4 w-64 max-w-full" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock and pricing — three across from `sm`. */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-2 h-4 w-56 max-w-full" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="mt-2 h-4 w-48 max-w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="aspect-square w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
