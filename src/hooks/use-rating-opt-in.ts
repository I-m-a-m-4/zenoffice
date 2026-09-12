'use client';

/**
 * Turning the business rating on and off.
 *
 * The flag itself is `settings.ratingEnabled` on `businessInstances/{id}` — three
 * states, documented on the field in `src/types.ts`. This hook exists because the
 * invitation card in Reports turns the rating on with **one click and no Save
 * button**, and it still has to take the same dual write path every other settings
 * write takes.
 *
 * Settings → General has its own switch and does *not* use this hook: that page
 * writes through its local `handleSettingsSubmit`, which owns the per-form saving
 * state and the batch-then-Save shape the whole page follows. Two call sites, two
 * genuinely different interactions — but the write underneath is the same
 * `settings.ratingEnabled` dotted path, so keep them in step.
 *
 * ── Why the dual path ──────────────────────────────────────────────────────
 *
 * On the desktop and mobile shells the write goes through `addToQueue`, which is
 * the only client write path that survives being offline, updates the SQLite mirror
 * and replays in order. On the web it is a direct `updateDoc`. Both then merge the
 * change into the in-memory business doc through `mutateBusiness` so the surfaces
 * react immediately instead of waiting for a round trip — which matters more here
 * than for most settings, because the visible effect of this flag is four
 * components appearing or disappearing.
 *
 * **Dotted keys are field paths.** `'settings.ratingEnabled'` merges into the
 * existing `settings` map; a nested object would replace the whole map and take
 * every other preference with it. This works because the path below ends in
 * `updateDoc`, which parses dots — `set()` does not, and that trap has bitten this
 * codebase more than once.
 *
 * ── No Firestore rules change ──────────────────────────────────────────────
 *
 * `settings` is already writable by the owner and by an admin member of the
 * business: the update rule on `businessInstances` is a deny-list
 * (`entitlementFieldsLocked()`), and `settings` is not on it. Nothing to deploy.
 */

import * as React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { usePOS } from '@/context/pos-context';
import { useToast } from '@/hooks/use-toast';

/**
 * True inside the Tauri shells.
 *
 * `isTauriEnv()` in `src/lib/native-notifications.ts` is the same two lines, but
 * importing it here would pull the whole notification dispatcher into the Reports
 * bundle for a `window` property check. The context itself makes this same inline
 * check in several places.
 */
function isTauriShell(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

export interface RatingOptIn {
  /** Write the flag. `false` is a real, recorded decision — not a reset to "never asked". */
  setRatingEnabled: (value: boolean) => Promise<void>;
  /** True while a write is in flight, for disabling the buttons that triggered it. */
  isSaving: boolean;
}

export function useRatingOptIn(): RatingOptIn {
  const { business, firestore, addToQueue, mutateBusiness, triggerRefresh } = usePOS();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const setRatingEnabled = React.useCallback(
    async (value: boolean) => {
      if (!business?.id) return;
      setIsSaving(true);

      const payload = { 'settings.ratingEnabled': value };

      // Merge locally first either way. The surfaces read this flag out of the
      // business doc the context holds, so this is what makes the change feel
      // instant rather than arriving a second later with the snapshot.
      const applyLocally = () => {
        mutateBusiness?.((prev: any) => {
          if (!prev) return null;
          return { ...prev, settings: { ...(prev.settings ?? {}), ratingEnabled: value } };
        });
      };

      try {
        if (isTauriShell()) {
          addToQueue(
            { type: 'update-settings', payload },
            value ? 'Enable business rating' : 'Disable business rating',
          );
          applyLocally();
        } else {
          await updateDoc(doc(firestore, 'businessInstances', business.id), payload);
          applyLocally();
          triggerRefresh();
        }
      } catch {
        toast({
          variant: 'destructive',
          title: 'Could not save that',
          description: 'Your preference was not stored. Please try again.',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [business?.id, firestore, addToQueue, mutateBusiness, triggerRefresh, toast],
  );

  return { setRatingEnabled, isSaving };
}
