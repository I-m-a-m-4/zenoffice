/**
 * Cohort handoff: Product Intelligence → the email campaign console.
 *
 * An insight is only actionable if the people it is about can be mailed, so the
 * board hands its cohort to `/admin-imamshaffy/outreach`. The ids travel through
 * `sessionStorage` with the insight id as the key, and only that key goes in the
 * URL.
 *
 * Not the query string, because a cohort is routinely hundreds of user ids —
 * browsers and servers both cap URL length well below that, and the failure mode
 * is a silently truncated list, which here means quietly emailing the wrong
 * people. Not `localStorage` either: a stale cohort from last week resurfacing in
 * a new session is the same hazard.
 */

const PREFIX = 'zeneva_insight_cohort_';

export type StoredCohort = {
  insightId: string;
  label?: string;
  userIds: string[];
  storedAt: number;
};

/** Stash a cohort under its insight id. Safe to call when storage is unavailable. */
export function storeInsightCohort(
  insightId: string,
  userIds: string[],
  label?: string,
): void {
  if (typeof window === 'undefined' || !insightId || userIds.length === 0) return;
  try {
    const payload: StoredCohort = { insightId, label, userIds, storedAt: Date.now() };
    sessionStorage.setItem(PREFIX + insightId, JSON.stringify(payload));
  } catch {
    // Private mode or a full quota. The campaign page falls back to an empty
    // selection, which is visibly nothing rather than a wrong list.
  }
}

/**
 * Read a cohort back and remove it.
 *
 * Single-use on purpose: leaving it in place means a later visit to the campaign
 * console — or a refresh after a send — silently re-selects a cohort the operator
 * has already dealt with.
 */
export function takeInsightCohort(insightId: string | null | undefined): StoredCohort | null {
  if (typeof window === 'undefined' || !insightId) return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + insightId);
    if (!raw) return null;
    sessionStorage.removeItem(PREFIX + insightId);
    const parsed = JSON.parse(raw) as StoredCohort;
    if (!parsed || !Array.isArray(parsed.userIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}
