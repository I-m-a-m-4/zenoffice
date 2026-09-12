'use client';

/**
 * The bridge from a per-user notification document to an operating-system notification.
 *
 * Mounted in the root layout rather than the app layout on purpose: an owner sitting
 * on `/admin-imamshaffy` is outside `(app)` and still needs their phone to buzz.
 *
 * This is one of exactly two bridges. This one covers `users/{uid}/notifications`; the
 * global announcement collection is bridged in `src/app/(app)/layout.tsx`, off the
 * listener that page already pays for. Both hand off to
 * {@link triggerNativeNotification}, which de-duplicates — so overlapping coverage
 * costs nothing, and the four-popups-per-support-reply behaviour is gone.
 *
 * Note this deliberately follows the **authenticated** user rather than
 * `currentUserProfile`: while a platform admin is impersonating a tenant, the
 * notifications worth showing are still the admin's own.
 */

import * as React from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
  initNativeNotificationPermissions,
  setNativeNotificationRouter,
  triggerNativeNotification,
} from '@/lib/native-notifications';
import { resolveNotificationLink } from '@/lib/notification-links';
import { safeToDate } from '@/lib/utils';
import { playNotificationSound } from '@/lib/sound';

/**
 * How recent a document has to be to raise a popup.
 *
 * Skipping the first snapshot stops history replaying on a cold start, but it does
 * not help a listener that re-attaches after the app has been closed or offline for
 * an hour — every document then arrives as `added` and the tray fills with a backlog
 * of alerts about things that already happened. The age check is the real guard.
 */
const FRESHNESS_WINDOW_MS = 10 * 60 * 1000;

export function NativeNotificationListener() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const initializedRef = React.useRef(false);

  // Lets the dispatcher route a tapped notification without a full webview reload.
  React.useEffect(() => {
    setNativeNotificationRouter((path: string) => router.push(path));
  }, [router]);

  React.useEffect(() => {
    if (user?.uid) initNativeNotificationPermissions();
  }, [user?.uid]);

  React.useEffect(() => {
    if (!user?.uid || !db) return;

    let unsubscribe: (() => void) | null = null;
    let isCurrent = true;
    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeoutId: any = null;

    const startListener = () => {
      if (!isCurrent) return;

      // Reset when the account changes, or the first snapshot of the new account is
      // treated as history belonging to the previous one.
      initializedRef.current = false;

      const notifRef = collection(db, 'users', user.uid, 'notifications');
      const q = query(notifRef, orderBy('createdAt', 'desc'), limit(5));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          retryCount = 0; // Reset retries on a successful connection
          // Skip the initial load so a fresh start does not pop historical items.
          if (!initializedRef.current) {
            initializedRef.current = true;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type !== 'added') return;

            const data = change.doc.data() as any;
            if (!data?.title) return;

            // A locally-written document arrives once with `createdAt: null` (the
            // server timestamp has not resolved yet) and again once it has. Showing
            // the first pass would use a null date; skipping it entirely would lose
            // notifications this device wrote for itself, so treat a missing
            // timestamp as "now" and let the dispatcher's de-dupe absorb the second.
            const createdAt = data.createdAt ? safeToDate(data.createdAt).getTime() : Date.now();
            if (Number.isFinite(createdAt) && Date.now() - createdAt > FRESHNESS_WINDOW_MS) return;

            playNotificationSound();
            void triggerNativeNotification({
              key: change.doc.id,
              title: data.title,
              body: data.body || '',
              url: resolveNotificationLink({ id: change.doc.id, ...data, isGlobal: false }),
            });
          });
        },
        (err: any) => {
          if (!isCurrent) return;
          console.warn('NativeNotificationListener error:', err);

          // If we encounter a permission-denied error, it might be transient during auth stabilization.
          // Re-establish the listener after a progressive delay.
          if (err.code === 'permission-denied' && retryCount < maxRetries) {
            retryCount++;
            const delay = 2000 * retryCount;
            console.log(`[NativeNotificationListener] Retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
            retryTimeoutId = setTimeout(startListener, delay);
          }
        },
      );
    };

    startListener();

    return () => {
      isCurrent = false;
      if (unsubscribe) unsubscribe();
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [user?.uid, db]);

  return null;
}
