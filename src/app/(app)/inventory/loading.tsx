import { InventoryBodySkeleton } from './skeleton';

/**
 * Shown while the route chunk loads. The shape lives in `./skeleton.tsx` so this
 * and the `Suspense` fallback inside `page.tsx` cannot drift apart.
 */
export default function Loading() {
  return <InventoryBodySkeleton />;
}
