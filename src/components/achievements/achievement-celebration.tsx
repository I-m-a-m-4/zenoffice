'use client';

/**
 * Mount point for the milestone celebration. One instance, app-wide, in
 * `src/app/(app)/layout.tsx` beside `<UpdateRequiredModal />`.
 *
 * Mounted in the layout rather than on `/achievements` for two reasons. The moment
 * worth celebrating is the sale that crosses the line — which happens at the till,
 * not on the achievements page — and the rating's confetti already taught the other
 * half of the lesson: a celebration fired from a hook that two components consume
 * goes off twice. One mount, one card.
 *
 * Every guard lives in {@link useAchievements} (owner only, never while
 * impersonating, per-business history, silent first-run seed). This component only
 * decides how it looks and when the confetti goes off.
 */

import * as React from 'react';
import { format, isValid } from 'date-fns';
import { usePOS } from '@/context/pos-context';
import { useAchievements } from '@/hooks/use-achievements';
import AchievementUnlockedModal from '@/components/achievements/achievement-unlocked-modal';

export default function AchievementCelebration() {
  const { business, currencySymbol, triggerConfetti } = usePOS();
  const { unlock, acknowledgeUnlock } = useAchievements();

  // Confetti once per milestone, not once per render — and keyed by id so a second
  // card in the same queue still gets its own burst.
  const firedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!unlock) return;
    if (firedFor.current === unlock.achievement.id) return;
    firedFor.current = unlock.achievement.id;
    triggerConfetti?.();
  }, [triggerConfetti, unlock]);

  const formatFigure = React.useCallback(
    (value: number, isMoney: boolean) =>
      isMoney
        ? `${currencySymbol || '₦'}${Math.max(0, value).toLocaleString()}`
        : Math.max(0, value).toLocaleString(),
    [currencySymbol],
  );

  const formatDate = React.useCallback((date: Date | null) => {
    // `safeToDate` returns the epoch for a missing timestamp, so an epoch date here
    // means "no date", not 1 January 1970.
    if (!date || !isValid(date) || date.getTime() <= 0) return null;
    return format(date, 'd MMMM yyyy');
  }, []);

  if (!unlock) return null;

  return (
    <AchievementUnlockedModal
      key={unlock.achievement.id}
      unlock={unlock}
      businessName={business?.name || 'Your business'}
      formatFigure={formatFigure}
      formatDate={formatDate}
      onDismiss={acknowledgeUnlock}
    />
  );
}
