import { adminFirestore } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Recording for phone pushes.
 *
 * Before this, a push was fire-and-forget: `sendEachForMulticast` returned a
 * success count that was rendered into a toast and then discarded. Nothing knew
 * how many notifications the platform had ever sent, who received them, or
 * whether a single person opened one.
 *
 * The shape is deliberately two-level:
 *
 * - `push_campaigns/{id}` — one doc per send, carrying the totals. This is what
 *   the admin board lists, so listing 50 campaigns costs 50 reads, not 50×N.
 * - `push_campaigns/{id}/recipients/{userId}` — one row per person, with their
 *   name and email copied in at send time. Only read when the owner opens a
 *   campaign, so the per-person cost is paid on demand rather than on page load.
 *
 * The campaign id is minted *before* the send, because it has to travel in the
 * FCM `data` payload for the service worker to attribute a click back to it.
 */

export type PushSource = 'broadcast' | 'alert' | 'test' | 'system';

/** A token paired with the user it belongs to, so a per-device FCM result can be
 *  attributed to a person. */
export type PushTarget = { token: string; userId: string };

export type PushCampaignSeed = {
  title: string;
  body: string;
  link: string;
  source: PushSource;
  audience: 'all' | 'user';
  audienceLabel?: string | null;
  sentBy?: string | null;
  sentByEmail?: string | null;
};

/**
 * Collapse raw token docs into one target per token.
 *
 * The same token can legitimately appear under two users — reinstall, shared
 * device, an account switch on one phone — and sending to it twice would double
 * the delivery count for a notification the person sees once. First writer wins,
 * matching the `Set`-based dedupe this replaces.
 */
export function dedupeTargets(raw: PushTarget[]): PushTarget[] {
  const seen = new Map<string, PushTarget>();
  for (const target of raw) {
    if (!target.token || !target.userId) continue;
    if (!seen.has(target.token)) seen.set(target.token, target);
  }
  return Array.from(seen.values());
}

/**
 * Create the campaign doc and return its id.
 *
 * Written before the send so the id can be embedded in the payload. Counts start
 * at zero and are filled in by `finalizePushCampaign` — a campaign that shows
 * `deviceCount: 0` after the fact means the send threw between the two calls,
 * which is worth seeing in the board rather than hiding.
 */
export async function createPushCampaign(seed: PushCampaignSeed): Promise<string | null> {
  if (!adminFirestore) return null;
  try {
    const ref = await adminFirestore.collection('push_campaigns').add({
      title: seed.title,
      body: seed.body,
      link: seed.link || '/',
      source: seed.source,
      audience: seed.audience,
      audienceLabel: seed.audienceLabel ?? null,
      sentBy: seed.sentBy ?? null,
      sentByEmail: seed.sentByEmail ?? null,
      sentAt: FieldValue.serverTimestamp(),
      deviceCount: 0,
      successCount: 0,
      failureCount: 0,
      recipientCount: 0,
      clickCount: 0,
      lastClickAt: null,
    });
    return ref.id;
  } catch (error) {
    // Logging must never be the reason a notification fails to go out.
    console.error('[push-log] Failed to create campaign record:', error);
    return null;
  }
}

/** Per-user delivery tally, keyed by uid. */
type UserTally = { deviceCount: number; successCount: number; failureCount: number };

/**
 * Look up display names for the uids in a send.
 *
 * `getAll` is a single round trip per chunk rather than one read per uid in
 * sequence, but it is still one *billed* read per user — the reason the names are
 * denormalised into the recipient rows here instead of being joined on every
 * board render. Paid once per campaign, at send time.
 */
async function resolveProfiles(userIds: string[]): Promise<Map<string, { name: string | null; email: string | null }>> {
  const profiles = new Map<string, { name: string | null; email: string | null }>();
  if (!adminFirestore || userIds.length === 0) return profiles;

  const CHUNK = 200;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    try {
      const refs = chunk.map((uid) => adminFirestore.collection('users').doc(uid));
      const snaps = await adminFirestore.getAll(...refs);
      for (const snap of snaps) {
        const data = snap.exists ? (snap.data() as any) : null;
        profiles.set(snap.id, {
          name: data?.name || data?.displayName || data?.fullName || null,
          email: data?.email || null,
        });
      }
    } catch (error) {
      // A failed name lookup degrades the board to uids; it must not lose the
      // delivery rows, which are the part that cannot be reconstructed later.
      console.error('[push-log] Failed to resolve recipient profiles:', error);
    }
  }
  return profiles;
}

/**
 * Write the totals onto the campaign and one row per recipient.
 *
 * `results` is the flat per-device outcome in the same order the targets were
 * sent, which is how `sendEachForMulticast` reports back — index i of the
 * response array is index i of the token array.
 */
export async function finalizePushCampaign(
  campaignId: string | null,
  targets: PushTarget[],
  results: boolean[],
): Promise<void> {
  if (!adminFirestore || !campaignId) return;

  try {
    const tallies = new Map<string, UserTally>();
    let successCount = 0;
    let failureCount = 0;

    targets.forEach((target, index) => {
      // A missing result means the send aborted before reaching this token.
      // Counting it as a failure keeps deviceCount = success + failure.
      const ok = results[index] === true;
      if (ok) successCount++;
      else failureCount++;

      const tally = tallies.get(target.userId) || { deviceCount: 0, successCount: 0, failureCount: 0 };
      tally.deviceCount++;
      if (ok) tally.successCount++;
      else tally.failureCount++;
      tallies.set(target.userId, tally);
    });

    const userIds = Array.from(tallies.keys());
    const profiles = await resolveProfiles(userIds);

    const campaignRef = adminFirestore.collection('push_campaigns').doc(campaignId);
    await campaignRef.update({
      deviceCount: targets.length,
      successCount,
      failureCount,
      recipientCount: userIds.length,
    });

    // 500 writes per batch is the Firestore limit; a platform-wide broadcast can
    // exceed it, so chunk rather than assuming the recipient list is small.
    const BATCH = 450;
    for (let i = 0; i < userIds.length; i += BATCH) {
      const batch = adminFirestore.batch();
      for (const uid of userIds.slice(i, i + BATCH)) {
        const tally = tallies.get(uid)!;
        const profile = profiles.get(uid);
        batch.set(campaignRef.collection('recipients').doc(uid), {
          userId: uid,
          userName: profile?.name ?? null,
          userEmail: profile?.email ?? null,
          deviceCount: tally.deviceCount,
          successCount: tally.successCount,
          failureCount: tally.failureCount,
          sentAt: FieldValue.serverTimestamp(),
          clickCount: 0,
          clickedAt: null,
          lastClickedAt: null,
        });
      }
      await batch.commit();
    }
  } catch (error) {
    console.error('[push-log] Failed to finalize campaign record:', error);
  }
}

/**
 * Roll a campaign's numbers into `admin_analytics/push_usage_global`, so the board
 * can show lifetime totals without reading every campaign doc.
 *
 * Deliberately **not** under `platform_stats`. That collection's rule is
 * `read: if isUserAuthenticated()` so tenants can read their own meter, and a
 * more specific `match` does not narrow a broader one in Firestore — rules are
 * OR'd, not overridden. Putting platform-wide device totals there would hand
 * every tenant a read on Zeneva's scale. `admin_analytics` is already owner-only.
 *
 * Uses nested maps rather than dotted field paths: `set()` does not parse a dot
 * as a path separator, and the same mistake in the AI-usage rollup produced a
 * field literally named `daily.2026-08-11`.
 */
export async function rollUpPushStats(
  day: string,
  counts: { devices: number; success: number; failure: number; recipients: number },
): Promise<void> {
  if (!adminFirestore) return;
  try {
    await adminFirestore
      .collection('admin_analytics')
      .doc('push_usage_global')
      .set(
        {
          totalCampaigns: FieldValue.increment(1),
          totalDevices: FieldValue.increment(counts.devices),
          totalDelivered: FieldValue.increment(counts.success),
          totalFailed: FieldValue.increment(counts.failure),
          updatedAt: FieldValue.serverTimestamp(),
          daily: {
            [day]: {
              campaigns: FieldValue.increment(1),
              devices: FieldValue.increment(counts.devices),
              delivered: FieldValue.increment(counts.success),
              failed: FieldValue.increment(counts.failure),
              recipients: FieldValue.increment(counts.recipients),
            },
          },
        },
        { merge: true },
      );
  } catch (error) {
    console.error('[push-log] Failed to roll up push stats:', error);
  }
}

/** `YYYY-MM-DD` in UTC, matching the key format the AI-usage rollup uses. */
export function pushStatsDay(): string {
  return new Date().toISOString().slice(0, 10);
}
