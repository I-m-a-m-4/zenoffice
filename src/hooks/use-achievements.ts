'use client';

/**
 * The achievement ladders, plus the one thing worth interrupting the owner for.
 *
 * Both consumers read this hook — the page at `/achievements` and the celebration
 * modal mounted app-wide in `(app)/layout.tsx` — so the badge on the page and the
 * card that announces it can never disagree.
 *
 * ── Four guards, each of which has a real failure behind it ────────────────────
 *
 * 1. **Per-business storage key.** The page this replaces kept its celebration
 *    history in a bare `seenMilestones` key with no businessId in it, exactly like
 *    the `pos_synced_*` blobs described in CLAUDE.md. Impersonate a tenant and you
 *    inherited your own shop's celebration history, so their ₦1m never fired; sign
 *    a second business into the same device and the same. `zeneva_ach_seen_<id>`.
 *
 * 2. **A silent first-run seed.** With no seed, the first time an existing shop
 *    loads this it has eight earned milestones and none of them recorded, and it
 *    gets walked through the lot. The seed writes the current earned set and
 *    celebrates nothing — the identical one-shot as the rating's tier high-water
 *    mark, and it carries the identical risk: if it runs against half-hydrated data
 *    it seeds an empty set and the real figures then arrive as eight fresh unlocks.
 *    Hence `isLoading` and a present business doc are both required before it runs.
 *
 * 3. **Owner only.** `isViewerOwner` is computed exactly as the notification trigger
 *    pass in `(app)/layout.tsx` computes it — owner id when the business doc has
 *    one, `role === 'admin'` otherwise. A cashier is not the person who wants to be
 *    told the shop crossed ₦1 million, and the existing milestone notification is
 *    already `target: 'owner'` for the same reason.
 *
 * 4. **Never while impersonating.** The whole trigger runner is skipped while
 *    impersonating and so is this. Celebrating a tenant's milestone at a support
 *    admin, and writing it into the seen set so the real owner never sees it, would
 *    be the worst of both.
 *
 * Acknowledgement retires the whole batch of ids, not just the rung shown — see
 * {@link newlyUnlocked} for why retiring only the top one makes ₦500k announce
 * itself after ₦1m.
 */

import * as React from 'react';
import { usePOS } from '@/context/pos-context';
import { secureStorage } from '@/lib/secure-storage';
import { safeToDate } from '@/lib/utils';
import {
  allEarnedIds,
  computeAchievements,
  newlyUnlocked,
  type AchievementReceipt,
  type AchievementSet,
  type AchievementUnlock,
} from '@/lib/achievements';

const SEEN_KEY_PREFIX = 'zeneva_ach_seen_';

/**
 * The old global key. Deliberately not migrated: it holds display labels rather
 * than ids, and there is no way to know which business they belonged to. Seeding
 * from the live earned set produces the same "don't spam an existing shop" outcome
 * without importing another tenant's history, so the legacy key is dropped once the
 * per-business one exists.
 */
const LEGACY_SEEN_KEY = 'seenMilestones';

export interface UseAchievements {
  set: AchievementSet;
  /** The card to show right now, or null. Already guarded on all four rules above. */
  unlock: AchievementUnlock | null;
  /** Retire the current unlock's whole batch and advance to the next, if any. */
  acknowledgeUnlock: () => void;
  isViewerOwner: boolean;
  /** False until the seen set is known; nothing may be celebrated before it is. */
  ready: boolean;
}

export function useAchievements(): UseAchievements {
  const {
    business,
    products,
    receipts,
    customers,
    stats,
    currentUserProfile,
    isLoading,
    isImpersonating,
  } = usePOS();

  const businessId = business?.id || null;

  const [seen, setSeen] = React.useState<Set<string> | null>(null);
  const [queue, setQueue] = React.useState<AchievementUnlock[]>([]);
  // Which business the loaded seen set belongs to, so switching business (or
  // starting an impersonation) reloads it rather than reusing the wrong one.
  const loadedFor = React.useRef<string | null>(null);

  const isViewerOwner = React.useMemo(() => {
    if (!currentUserProfile) return false;
    const ownerId = business?.ownerId;
    return ownerId ? currentUserProfile.id === ownerId : currentUserProfile.role === 'admin';
  }, [business?.ownerId, currentUserProfile]);

  const achievementSet = React.useMemo<AchievementSet>(() => {
    const mapped: AchievementReceipt[] | null = receipts
      ? receipts
          .filter((r) => r && r.createdAt)
          .map((r) => ({ total: Number(r.total) || 0, at: safeToDate(r.createdAt) }))
      : null;

    return computeAchievements({
      // `stats.totalRevenue` is the lifetime counter and the only authoritative
      // total on a device whose receipt cache is capped at 200. Null when the
      // document has not arrived, which marks the figure a floor rather than
      // silently understating it.
      lifetimeRevenue: typeof stats?.totalRevenue === 'number' ? stats.totalRevenue : null,
      receipts: mapped,
      // Products are capped at `IMPERSONATION_PRODUCT_CAP` (500) while impersonating,
      // and the catalogue ladder tops out at 1,000 — so a support admin looking at a
      // 12,000-product shop would be shown "500 Products Added" as the ceiling and
      // the 1,000 rung as unearned. `null` says "not measured here" instead, which is
      // what the count actually is.
      productCount: products && !isImpersonating ? products.length : null,
      customerCount: customers ? customers.length : null,
    });
  }, [customers, isImpersonating, products, receipts, stats?.totalRevenue]);

  // Load or seed the seen set. Guarded on hydration having settled and the business
  // doc being present — see rule 2 in the header.
  React.useEffect(() => {
    if (!businessId) {
      // Signed out or between businesses: forget everything rather than let the next
      // shop consult this one's history.
      if (loadedFor.current !== null) {
        loadedFor.current = null;
        setSeen(null);
        setQueue([]);
      }
      return;
    }
    if (isLoading || loadedFor.current === businessId) return;

    // A different business than the one loaded — drop its pending cards before the
    // new set arrives, or an impersonation would inherit the admin's queue.
    if (loadedFor.current !== null) setQueue([]);

    const key = `${SEEN_KEY_PREFIX}${businessId}`;
    const stored = secureStorage.getItem<string[]>(key);

    if (Array.isArray(stored)) {
      loadedFor.current = businessId;
      setSeen(new Set(stored));
      return;
    }

    // First run for this business: record what is already earned, celebrate none of
    // it. A brand-new shop seeds an empty array, which is correct — its first real
    // milestone is then a real unlock.
    const earned = allEarnedIds(achievementSet);
    secureStorage.setItem(key, earned);
    secureStorage.removeItem(LEGACY_SEEN_KEY);
    loadedFor.current = businessId;
    setSeen(new Set(earned));
  }, [achievementSet, businessId, isLoading]);

  const ready = seen !== null && !!businessId && !isLoading;
  const mayCelebrate = ready && isViewerOwner && !isImpersonating;

  // Fill the queue from whatever is unseen. Runs on every recompute, so a sale that
  // crosses a line while the owner is on the till raises the card there and then.
  React.useEffect(() => {
    if (!mayCelebrate || !seen) return;
    const fresh = newlyUnlocked(achievementSet, seen);
    if (fresh.length === 0) return;
    setQueue((prev) => {
      const held = new Set(prev.map((u) => u.achievement.id));
      const additions = fresh.filter((u) => !held.has(u.achievement.id));
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, [achievementSet, mayCelebrate, seen]);

  const acknowledgeUnlock = React.useCallback(() => {
    const head = queue[0];
    if (!head) return;
    if (businessId) {
      const next = new Set(seen || []);
      head.ids.forEach((id) => next.add(id));
      secureStorage.setItem(`${SEEN_KEY_PREFIX}${businessId}`, Array.from(next));
      setSeen(next);
    }
    setQueue((prev) => prev.slice(1));
  }, [businessId, queue, seen]);

  return {
    set: achievementSet,
    unlock: mayCelebrate ? queue[0] ?? null : null,
    acknowledgeUnlock,
    isViewerOwner,
    ready,
  };
}
