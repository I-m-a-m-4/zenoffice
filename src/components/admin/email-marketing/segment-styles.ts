/**
 * Badge classes per segment tone.
 *
 * Keyed off `BEHAVIOR_SEGMENT_META[…].tone` rather than off the segment name, so
 * adding a segment to the engine cannot leave a hole here. Deliberately muted:
 * these sit next to dense table text, where a saturated fill fights the content.
 *
 * Mirrors the approach in `user-detail/user-segments.ts` and the `TONE_CLASSES`
 * map in `follow-up-center.tsx` — same visual language across the admin surface.
 */

import type { SegmentTone } from '@/lib/behavior-segments';

export const TONE_CLASSES: Record<SegmentTone, string> = {
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  neutral: 'border-muted-foreground/25 bg-muted text-muted-foreground',
};
