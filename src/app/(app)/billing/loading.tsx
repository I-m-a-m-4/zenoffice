import { BillingBodySkeleton } from './skeleton';

/**
 * Shown while the route chunk loads. The shape lives in `./skeleton.tsx`, shared
 * with the `!business` branch in `page.tsx` so the two cannot drift.
 */
export default function Loading() {
  return <BillingBodySkeleton />;
}
