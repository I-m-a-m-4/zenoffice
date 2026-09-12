import { DashboardBodySkeleton } from './skeleton';

/**
 * Shown while the route chunk loads. A server component, so it cannot read the
 * signed-in user's permissions — it takes the owner-shaped defaults, and
 * `page.tsx` renders the permission-aware version once the context is up.
 *
 * The real page root is `flex flex-col gap-6 … p-1`, on top of `<main>`'s
 * `p-4 sm:p-6`. That `p-1` is reproduced here so nothing shifts on arrival.
 */
export default function Loading() {
  return <DashboardBodySkeleton className="p-1" />;
}
