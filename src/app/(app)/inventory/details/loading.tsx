import { EditProductBodySkeleton } from './skeleton';

/**
 * Shown while the route chunk loads. The shape lives in `./skeleton.tsx`, shared
 * with the two fallbacks inside `page.tsx` so they cannot drift apart.
 *
 * This route is the **edit form**, not a read-only product view — worth stating,
 * because the name reads like the latter and a skeleton drawn for the wrong one
 * is the exact defect this whole pass exists to remove.
 */
export default function Loading() {
  return <EditProductBodySkeleton />;
}
