'use server';

import { adminFirestore, adminMessaging } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSuperAdmin } from './admin-guard';

/**
 * Uninstall tracking for the Play Store and Microsoft Store builds.
 *
 * Neither store gives us a per-user uninstall webhook, so the signal we use is
 * FCM's own: when an app is removed, its registration token stops being
 * deliverable and FCM answers `messaging/registration-token-not-registered`.
 * A **dry-run** send validates every token without pushing a notification to
 * anyone, which is what makes this safe to run on demand.
 *
 * What that signal really means — worth knowing before trusting the number:
 *
 * - It only covers devices that ever enabled notifications. A user who never
 *   granted permission has no token and is invisible here.
 * - "Not registered" also fires when the user clears app data or revokes
 *   notification permission, so it is an upper bound on uninstalls.
 * - The store is attributed from the `channel` recorded when the token was
 *   saved. Windows cannot tell a Store install from a sideloaded MSI in the
 *   webview (see `updateChannel`), so `microsoft` means "Windows desktop".
 * - Tokens saved before this feature shipped have no channel and land in
 *   `unknown`.
 */

/** FCM's verdict that the app is gone from the device. */
const GONE = 'messaging/registration-token-not-registered';

/** FCM caps a multicast at 500 tokens per call. */
const CHUNK = 500;

export type UninstallChannelStat = {
  channel: string;
  active: number;
  uninstalled: number;
};

export type UninstallScanResult = {
  ok: boolean;
  error?: string;
  scanned: number;
  newlyUninstalled: number;
  stillActive: number;
  malformed: number;
  byChannel: UninstallChannelStat[];
  scannedAt: string;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Validate every stored FCM token and record which installs are gone.
 *
 * Marks dead tokens `status: 'uninstalled'` rather than deleting them, so the
 * count survives and a reinstall can flip the same doc back to active.
 */
export async function scanForUninstalls(idToken?: string): Promise<UninstallScanResult> {
  const scannedAt = new Date().toISOString();
  const empty: UninstallScanResult = {
    ok: false, scanned: 0, newlyUninstalled: 0, stillActive: 0,
    malformed: 0, byChannel: [], scannedAt,
  };

  // Reads every tenant's FCM tokens and writes to them, so this is owner-only.
  try {
    await requireSuperAdmin(idToken);
  } catch (err: any) {
    return { ...empty, error: err.message };
  }

  if (!adminFirestore || !adminMessaging) {
    return { ...empty, error: 'Firebase Admin is not configured on the server.' };
  }

  try {
    const snap = await adminFirestore.collectionGroup('fcmTokens').get();

    type Row = { token: string; channel: string; ref: any; wasUninstalled: boolean };
    const rows: Row[] = [];

    snap.forEach((doc: any) => {
      const data = doc.data() || {};
      const token = typeof data.token === 'string' && data.token ? data.token : doc.id;
      if (!token || typeof token !== 'string') return;
      rows.push({
        token,
        channel: typeof data.channel === 'string' && data.channel ? data.channel : 'unknown',
        ref: doc.ref,
        wasUninstalled: data.status === 'uninstalled',
      });
    });

    const tally = new Map<string, UninstallChannelStat>();
    const bump = (channel: string, key: 'active' | 'uninstalled') => {
      const row = tally.get(channel) || { channel, active: 0, uninstalled: 0 };
      row[key] += 1;
      tally.set(channel, row);
    };

    let newlyUninstalled = 0;
    let stillActive = 0;
    let malformed = 0;

    for (const group of chunk(rows, CHUNK)) {
      // dryRun: true — validates delivery without sending anything.
      const res = await adminMessaging.sendEachForMulticast(
        { tokens: group.map((r) => r.token) },
        true,
      );

      const batch = adminFirestore.batch();
      let writes = 0;

      res.responses.forEach((r: any, i: number) => {
        const row = group[i];
        const code = r.error?.code;

        if (r.success) {
          stillActive += 1;
          bump(row.channel, 'active');
          if (row.wasUninstalled) {
            // Reinstalled, or permission granted again.
            batch.set(row.ref, { status: 'active', uninstalledAt: null }, { merge: true });
            writes += 1;
          }
          return;
        }

        if (code === GONE) {
          bump(row.channel, 'uninstalled');
          if (!row.wasUninstalled) {
            newlyUninstalled += 1;
            batch.set(row.ref, {
              status: 'uninstalled',
              uninstalledAt: FieldValue.serverTimestamp(),
              uninstallReason: code,
            }, { merge: true });
            writes += 1;
          }
          return;
        }

        // Anything else (malformed token, transient FCM error) is not evidence
        // of an uninstall, so it is counted separately and left untouched.
        malformed += 1;
        bump(row.channel, 'active');
      });

      if (writes > 0) await batch.commit();
    }

    const byChannel = Array.from(tally.values()).sort((a, b) => b.uninstalled - a.uninstalled);

    const result: UninstallScanResult = {
      ok: true,
      scanned: rows.length,
      newlyUninstalled,
      stillActive,
      malformed,
      byChannel,
      scannedAt,
    };

    await adminFirestore.doc('system_config/uninstall_stats').set(
      { ...result, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return result;
  } catch (error: any) {
    console.error('scanForUninstalls failed:', error);
    return { ...empty, error: error?.message || 'Scan failed.' };
  }
}

/** Last scan result, for rendering the card without re-scanning. Owner-only. */
export async function getUninstallStats(idToken?: string): Promise<UninstallScanResult | null> {
  try {
    await requireSuperAdmin(idToken);
  } catch {
    return null;
  }
  if (!adminFirestore) return null;
  try {
    const doc = await adminFirestore.doc('system_config/uninstall_stats').get();
    if (!doc.exists) return null;
    const data = doc.data() || {};
    return {
      ok: true,
      scanned: data.scanned ?? 0,
      newlyUninstalled: data.newlyUninstalled ?? 0,
      stillActive: data.stillActive ?? 0,
      malformed: data.malformed ?? 0,
      byChannel: Array.isArray(data.byChannel) ? data.byChannel : [],
      scannedAt: data.scannedAt ?? '',
    };
  } catch (error) {
    console.error('getUninstallStats failed:', error);
    return null;
  }
}
