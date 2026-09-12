/**
 * Segment + derivation helpers shared by the admin users directory and the
 * per-user detail page. Pure functions over already-loaded docs — nothing here
 * touches Firestore, so both screens can classify without extra reads.
 */

import { differenceInDays } from 'date-fns';
import type { UserProfile, BusinessInstance } from '@/types';
import { toDate } from './user-primitives';

export type UserSegment = 'power' | 'active' | 'at_risk' | 'dormant' | 'never';

export const SEGMENT_LABELS: Record<UserSegment, string> = {
    power: 'Power',
    active: 'Active',
    at_risk: 'At risk',
    dormant: 'Dormant',
    never: 'Never signed in',
};

/**
 * Muted-ink badge classes per segment. Deliberately not the chart series
 * colours — these sit next to text, and status here is state, not identity.
 */
export const SEGMENT_BADGE_CLASS: Record<UserSegment, string> = {
    power: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    active: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
    at_risk: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dormant: 'border-muted-foreground/25 bg-muted text-muted-foreground',
    never: 'border-muted-foreground/25 bg-muted text-muted-foreground',
};

/** Days since last activity, or null when the user has never been seen. */
export function daysSinceSeen(user: Pick<UserProfile, 'lastSeen'>, now = new Date()): number | null {
    const seen = toDate((user as any).lastSeen);
    if (!seen) return null;
    return differenceInDays(now, seen);
}

/**
 * Classify a user by recency and depth of use.
 *
 * Thresholds are deliberately coarse — this drives a filter chip, not a
 * billing decision. 'power' needs both recent use and real hours, so a trial
 * account that opened the app once today reads 'active', not 'power'.
 */
export function segmentOf(user: UserProfile, now = new Date()): UserSegment {
    const days = daysSinceSeen(user, now);
    if (days === null) return 'never';

    const hours = (user.totalUsageSeconds ?? 0) / 3600;

    if (days <= 7 && hours >= 5) return 'power';
    if (days <= 7) return 'active';
    if (days <= 30) return 'at_risk';
    return 'dormant';
}

/** Roll a user list into per-segment counts, for the summary strip. */
export function segmentCounts(users: UserProfile[], now = new Date()): Record<UserSegment, number> {
    const counts: Record<UserSegment, number> = {
        power: 0, active: 0, at_risk: 0, dormant: 0, never: 0,
    };
    for (const u of users) counts[segmentOf(u, now)]++;
    return counts;
}

/**
 * The business a user belongs to. Built as a Map once per render rather than
 * a `.find()` per row — the directory renders every user on the platform.
 */
export function businessIndex(businesses: BusinessInstance[] | null | undefined) {
    const index = new Map<string, BusinessInstance>();
    for (const b of businesses ?? []) index.set(b.id, b);
    return index;
}

/**
 * Plan for a user, read through their business. Entitlement lives on the
 * business doc, never the user doc, so a user with no resolvable business
 * shows 'Unknown' rather than a wrong 'Starter'.
 */
export function planOf(
    user: UserProfile,
    index: Map<string, BusinessInstance>,
): string {
    const business = user.businessId ? index.get(user.businessId) : undefined;
    if (!business) return 'Unknown';
    if ((business as any).accessLevel === 'lifetime') return 'Lifetime';
    return (business as any).plan || 'Starter';
}
