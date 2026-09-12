'use client';

import * as React from 'react';
import { doc, runTransaction, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';

/**
 * Counts a tapped push notification against its campaign.
 *
 * The service worker cannot do this itself — it has no Firebase Auth session, so
 * it cannot satisfy the rule that only lets a signed-in user mark their own
 * recipient row. `public/firebase-messaging-sw.js` therefore only carries the
 * campaign id across, two ways:
 *
 * - **New window** (app was closed): the id arrives as `?zpc=<id>` on the URL.
 * - **Existing tab** (app already open): the id arrives as a `postMessage`,
 *   because focusing a tab does not change its URL.
 *
 * Both land here. The param is stripped straight away so a refresh — or the back
 * button — cannot record the same tap twice, and a `Set` of ids already handled
 * guards against React's development double-effect doing the same.
 *
 * A tap that happens before Firebase Auth has resolved is held in a ref and
 * flushed once the user appears, rather than dropped: cold-starting the app from a
 * notification is the single most common case, and it is exactly the one where
 * auth is not ready on the first render.
 */
export function PushClickTracker() {
    const firestore = useFirestore();
    const { user } = useUser();

    /** Campaign ids seen this session, recorded or not — never count one twice. */
    const handledRef = React.useRef<Set<string>>(new Set());
    /** Taps that arrived before sign-in resolved. */
    const pendingRef = React.useRef<string[]>([]);

    const record = React.useCallback(
        async (campaignId: string) => {
            if (!firestore || !campaignId) return;

            const recipientRef = doc(firestore, 'push_campaigns', campaignId, 'recipients', user!.uid);
            try {
                // A transaction because `clickedAt` is first-open-only and Firestore
                // has no conditional field write. The read it costs is the same read
                // a get-then-set would cost, without the race.
                await runTransaction(firestore, async (tx) => {
                    const snap = await tx.get(recipientRef);
                    const existing = snap.exists() ? (snap.data() as any) : null;
                    tx.set(
                        recipientRef,
                        {
                            userId: user!.uid,
                            clickCount: (existing?.clickCount || 0) + 1,
                            clickedAt: existing?.clickedAt || serverTimestamp(),
                            lastClickedAt: serverTimestamp(),
                        },
                        { merge: true },
                    );
                });

                // Denormalised so the campaign list can show opens without reading
                // every recipient row. Rules cap this to a +1 on `clickCount`; it is
                // still a client-reported number, which is true of click tracking
                // everywhere. The trustworthy figure is the unique-opener count the
                // board derives from the recipient rows themselves.
                await updateDoc(doc(firestore, 'push_campaigns', campaignId), {
                    clickCount: increment(1),
                    lastClickAt: serverTimestamp(),
                });
            } catch (error) {
                // Never surface this. The person tapped a notification to read
                // something; a failed analytics write is not their problem.
                console.warn('[push] Could not record notification open:', error);
            }
        },
        [firestore, user],
    );

    // Pull `zpc` off the URL and strip it immediately, before anything can reload.
    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const campaignId = params.get('zpc');
        if (!campaignId) return;

        params.delete('zpc');
        const query = params.toString();
        window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname + (query ? `?${query}` : '') + window.location.hash,
        );

        if (handledRef.current.has(campaignId)) return;
        handledRef.current.add(campaignId);
        pendingRef.current.push(campaignId);
    }, []);

    // The already-open-tab path.
    React.useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

        const onMessage = (event: MessageEvent) => {
            const data = event.data;
            if (!data || data.type !== 'zeneva-push-click') return;
            const campaignId = String(data.campaignId || '');
            if (!campaignId || handledRef.current.has(campaignId)) return;
            handledRef.current.add(campaignId);
            pendingRef.current.push(campaignId);
            // Flush inline: unlike the URL path, this can arrive long after mount,
            // when the user is already signed in and no effect is due to re-run.
            if (user?.uid && firestore) {
                const queued = pendingRef.current.splice(0);
                queued.forEach((id) => void record(id));
            }
        };

        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [user, firestore, record]);

    // Flush whatever was waiting on sign-in.
    React.useEffect(() => {
        if (!user?.uid || !firestore) return;
        if (pendingRef.current.length === 0) return;
        const queued = pendingRef.current.splice(0);
        queued.forEach((id) => void record(id));
    }, [user, firestore, record]);

    return null;
}
