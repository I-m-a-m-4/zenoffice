import { SettingsBodySkeleton } from './skeleton';

/**
 * Shown while the route chunk loads. The shape lives in `./skeleton.tsx`, shared
 * with the `!mounted` branch in `page.tsx` so the two cannot drift.
 */
export default function Loading() {
  return <SettingsBodySkeleton />;
}
