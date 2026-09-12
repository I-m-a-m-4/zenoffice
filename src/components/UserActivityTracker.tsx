'use client';

import { useEffect, useRef } from 'react';
import { getCountryFromIP } from '@/lib/utils';
import { useAuth, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot, writeBatch, increment, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { usePathname } from 'next/navigation';
import { AppConfig } from '@/lib/config';
import { useI18n } from '@/context/i18n-context';
import {
    drainTelemetry,
    recordDwell,
    recordRoutePerf,
} from '@/lib/product-telemetry';

/**
 * Routes are keyed on the user doc's `pageViews` map, so the key has to survive
 * Firestore field-path rules: no slashes, no dots, no empty segments. Dynamic
 * ids are collapsed so `/customers/abc123` and `/customers/def456` aggregate
 * into one `customers_:id` bucket instead of thousands of one-hit keys.
 */
function routeKey(pathname: string): string {
    const cleaned = pathname.split('?')[0].split('#')[0];
    const segments = cleaned.split('/').filter(Boolean);
    if (!segments.length) return 'root';

    const normalised = segments.map(seg => {
        const looksLikeId =
            seg.length >= 16 ||
            /^\d+$/.test(seg) ||
            /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg);
        return looksLikeId ? ':id' : seg;
    });

    return normalised.join('_').replace(/[.$#[\]/]/g, '-').slice(0, 120);
}

/**
 * True only for a user's very first session on this device. Uses localStorage
 * (not sessionStorage) so opening a second tab doesn't look like a second
 * first-session. A reinstall or a new device re-flags it, which is acceptable:
 * the admin panel pairs this with the user's `createdAt` to spot real signups.
 *
 * Latched per session by the caller — this marks the device on first call, so
 * calling it again would report false and downgrade the flag mid-session.
 */
function claimFirstSession(uid: string): boolean {
    try {
        const key = `zeneva_seen_before_${uid}`;
        if (localStorage.getItem(key)) return false;
        localStorage.setItem(key, '1');
        return true;
    } catch {
        return false;
    }
}

export function UserActivityTracker() {
    const auth = useAuth();
    const firestore = useFirestore();
    const pathname = usePathname();
    const { locale } = useI18n();

    // Held in a ref rather than read from the closure so switching language does
    // not re-run the heartbeat effect and re-register its listeners. The next
    // scheduled flush picks up the new value at no extra cost.
    const localeRef = useRef(locale);
    localeRef.current = locale;

    // Buffers the routes seen since the last Firestore flush. Navigation is far
    // more frequent than the 5-minute heartbeat, so we batch rather than write
    // a document per click.
    const pendingRef = useRef<{ key: string; path: string; at: number }[]>([]);
    // The ordered route log for the whole session, written to the journey doc.
    // Kept separate from `pendingRef` because that one is drained on each flush.
    const sessionLogRef = useRef<{ path: string; at: number }[]>([]);
    const lastRouteRef = useRef<string | null>(null);
    // Latched by the first flush that sees a signed-in user; see claimFirstSession.
    const firstSessionRef = useRef<boolean>(false);
    const firstSessionClaimedRef = useRef<string | null>(null);

    // Fed by the revocation listener below. `null` means it has not reported
    // yet, which is why the flush distinguishes "known absent" from "unknown"
    // before deciding whether to stamp createdAt.
    const sessionDocExistsRef = useRef<boolean | null>(null);
    const sessionRevokedRef = useRef<boolean>(false);
    // Resolves on the listener's first report. The flush awaits it so a brand
    // new session still gets its createdAt stamped — the listener is already
    // attached by then, so this costs the same wait the old getDoc did.
    const sessionReadyRef = useRef<Promise<void> | null>(null);

    // ——— Dwell + route render timing ———
    // Dwell is accumulated in pieces rather than measured as (leave - enter),
    // because a tab left open in the background is not attention. The visibility
    // effect below stops and restarts the clock, so what lands in Firestore is
    // time the page was actually on screen.
    const routeDwellMsRef = useRef(0);
    const routeVisibleSinceRef = useRef<number | null>(null);
    const prevRouteKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const onVisibility = () => {
            const now = Date.now();
            if (document.visibilityState === 'visible') {
                routeVisibleSinceRef.current = now;
            } else if (routeVisibleSinceRef.current !== null) {
                routeDwellMsRef.current += now - routeVisibleSinceRef.current;
                routeVisibleSinceRef.current = null;
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    // Record every navigation immediately; the flush below drains this buffer.
    useEffect(() => {
        if (!pathname) return;
        // Skip repeat renders of the same route (Next re-runs effects on
        // query-string changes too).
        if (pathname === lastRouteRef.current) return;
        lastRouteRef.current = pathname;
        const at = Date.now();
        const key = routeKey(pathname);

        // Captured before the ref is overwritten: only a real route-to-route move
        // is a transition worth timing.
        const isTransition = prevRouteKeyRef.current !== null;

        // Close out the page being left.
        if (prevRouteKeyRef.current) {
            if (routeVisibleSinceRef.current !== null) {
                routeDwellMsRef.current += at - routeVisibleSinceRef.current;
            }
            recordDwell(prevRouteKeyRef.current, routeDwellMsRef.current);
        }
        routeDwellMsRef.current = 0;
        routeVisibleSinceRef.current = document.visibilityState === 'visible' ? at : null;
        prevRouteKeyRef.current = key;

        pendingRef.current.push({ key, path: pathname, at });
        // Cap the log so a very long session can't grow the journey doc past
        // Firestore's 1 MB limit.
        if (sessionLogRef.current.length < 400) {
            sessionLogRef.current.push({ path: pathname, at });
        }

        if (!isTransition) return;

        /*
         * How long this route took to become visible.
         *
         * Two nested frames on purpose: the first rAF callback still runs *before*
         * the browser paints, so it would report a time the user never experienced.
         * The second runs after that paint, which is the moment the page is
         * actually on screen.
         *
         * Deliberately only client-side transitions, never the initial hard load
         * from Navigation Timing. Mixing a cold boot into the same average would
         * make whichever page people happen to land on look catastrophically slow
         * and every other page look fast, which is the opposite of the comparison
         * this measurement exists to support.
         */
        const startedAt = performance.now();
        let innerFrame = 0;
        const outerFrame = requestAnimationFrame(() => {
            innerFrame = requestAnimationFrame(() => {
                recordRoutePerf(key, performance.now() - startedAt);
            });
        });
        return () => {
            cancelAnimationFrame(outerFrame);
            if (innerFrame) cancelAnimationFrame(innerFrame);
        };
    }, [pathname]);

    /**
     * Session revocation watch.
     *
     * This was a `getDoc(sessionRef)` inside the heartbeat flush, which polled
     * the document every 5 minutes for as long as a user stayed signed in. A
     * listener bills one read when it attaches and then only when the document
     * actually changes, and "sign out this device" from Settings now takes
     * effect the moment it is toggled rather than on the next poll.
     *
     * Deliberately its own effect keyed on [auth, firestore]: the flush effect
     * below also depends on `pathname`, so attaching here would tear the
     * listener down and re-attach it — re-billing the read — on every
     * navigation.
     */
    useEffect(() => {
        if (!auth || !firestore) return;

        let unsubscribeDoc: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            unsubscribeDoc?.();
            unsubscribeDoc = null;
            sessionDocExistsRef.current = null;
            sessionRevokedRef.current = false;

            if (!user) return;

            const sessionIdKey = `zeneva_session_id_${user.uid}`;
            let sessionId = sessionStorage.getItem(sessionIdKey);
            if (!sessionId) {
                sessionId = crypto.randomUUID();
                sessionStorage.setItem(sessionIdKey, sessionId);
            }

            let markReady = () => {};
            sessionReadyRef.current = new Promise<void>((resolve) => { markReady = resolve; });

            unsubscribeDoc = onSnapshot(
                doc(firestore, 'users', user.uid, 'sessions', sessionId),
                (snap) => {
                    sessionDocExistsRef.current = snap.exists();
                    sessionRevokedRef.current = !!snap.data()?.revoked;
                    markReady();
                    if (sessionRevokedRef.current) {
                        sessionStorage.removeItem(sessionIdKey);
                        signOut(auth).catch(() => {});
                    }
                },
                () => {
                    // Permission errors are expected here: sign-out clears auth
                    // before the listener is torn down. Release the flush either
                    // way so a listener that never reports cannot stall it.
                    markReady();
                }
            );
        });

        return () => {
            unsubscribeAuth();
            unsubscribeDoc?.();
        };
    }, [auth, firestore]);

    useEffect(() => {
        if (!auth || !firestore) return;

        const checkAndUpdateActivity = async (user: any) => {
            if (!user) return;

            // Claim the first-session flag once per uid, before any flush reads it.
            if (firstSessionClaimedRef.current !== user.uid) {
                firstSessionClaimedRef.current = user.uid;
                firstSessionRef.current = claimFirstSession(user.uid);
            }

            const userRef = doc(firestore, 'users', user.uid);
            const sessionIdKey = `zeneva_session_id_${user.uid}`;
            let sessionId = sessionStorage.getItem(sessionIdKey);

            if (!sessionId) {
                sessionId = crypto.randomUUID();
                sessionStorage.setItem(sessionIdKey, sessionId);
            }

            const sessionRef = doc(firestore, 'users', user.uid, 'sessions', sessionId);

            try {
                const lastUpdate = sessionStorage.getItem('last_user_activity_update');
                const now = Date.now();
                
                // Update if:
                // - Never updated this session
                // - It's been > 5 minutes
                if (!lastUpdate || now - parseInt(lastUpdate) > 5 * 60 * 1000) {
                    // Give the listener a moment to report before deciding
                    // anything from its refs; capped so an offline client still
                    // flushes its page views instead of hanging here.
                    if (sessionReadyRef.current) {
                        await Promise.race([
                            sessionReadyRef.current,
                            new Promise<void>((resolve) => setTimeout(resolve, 4000)),
                        ]);
                    }

                    // Revocation state comes from the listener rather than a read
                    // per flush. It signs out on its own, so this is just a guard
                    // against writing on the way down.
                    if (sessionRevokedRef.current) return;

                    // `null` means the listener still has not reported. Treating
                    // unknown as "does not exist" would stamp a fresh createdAt
                    // over the real one, so let the merge keep the stored value
                    // and only set it when the doc is known to be absent.
                    const sessionKnownMissing = sessionDocExistsRef.current === false;
                    const batch = writeBatch(firestore);
                    
                    const isTauriEnv = typeof window !== 'undefined' && (
                        !!(window as any).__TAURI__ || 
                        !!(window as any).__TAURI_INTERNALS__ || 
                        !!(window as any).__TAURI_METADATA__ || 
                        typeof (window as any).rpc !== 'undefined'
                    );
                    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
                    const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
                    
                    let deviceType = 'Web';
                    let platformTag = 'Web';
                    if (isTauriEnv) {
                        if (isMobile) {
                            deviceType = 'Mobile App';
                            platformTag = 'Mobile App';
                        } else {
                            deviceType = 'Desktop App';
                            platformTag = 'Microsoft App';
                        }
                    } else {
                        deviceType = isMobile ? 'Mobile' : 'Web';
                        platformTag = isMobile ? 'Mobile Web' : 'Web';
                    }

                    // Detect country from IP once per session
                    let country = sessionStorage.getItem('zeneva_session_country') || '';
                    if (country === 'Unknown') country = '';
                    if (!country) {
                        country = await getCountryFromIP();
                        if (country && country !== 'Unknown') {
                            sessionStorage.setItem('zeneva_session_country', country);
                        }
                    }

                    // ——— Page-visit behavior tracking ———
                    // Drains the routes accumulated since the last flush. These
                    // fields ride along on the heartbeat's own set() below: as a
                    // separate batch.set(userRef, …) they were billed as a second
                    // write despite touching the same document.
                    //
                    // Written as a **nested map**, not as `pageViews.${key}` field
                    // paths. That is not a style preference: `set()` — unlike
                    // `update()` — does not parse dots as paths, so the old form
                    // created literal top-level fields named "pageViews.dashboard"
                    // and `user.pageViews` was undefined on every document in the
                    // database. Every per-route feature silently read an empty map:
                    // the admin "Where They Spend Their Time" panel never rendered,
                    // and behaviour segmentation saw zero views in every area. With
                    // merge:true a nested map merges key by key, so two devices
                    // flushing at once both land.
                    const pageViewFields: Record<string, any> = {};
                    const pending = pendingRef.current;
                    if (pending.length > 0) {
                        const totals = new Map<string, number>();
                        pending.forEach(p => totals.set(p.key, (totals.get(p.key) || 0) + 1));
                        pendingRef.current = [];

                        const perRoute: Record<string, any> = {};
                        totals.forEach((count, key) => { perRoute[key] = increment(count); });
                        pageViewFields.pageViews = perRoute;
                        pageViewFields.pagesVisited = increment([...totals.values()].reduce((a, b) => a + b, 0));
                    }

                    batch.set(userRef, {
                        lastSeen: serverTimestamp(),
                        status: 'active',
                        deviceType,
                        platformsUsed: arrayUnion(deviceType, platformTag),
                        userAgent: navigator.userAgent,
                        country: country || 'Unknown',
                        appVersion: AppConfig.version || 'unknown',
                        // One extra field on a write that already happens, so the
                        // admin language breakdown costs nothing beyond the
                        // existing heartbeat.
                        language: localeRef.current,
                        lastPage: pathname || '/',
                        ...pageViewFields,
                        // Feature counters, dwell time and route render timings.
                        // Nothing here costs a write of its own — the whole product
                        // intelligence layer is a few more fields on a write that
                        // was already happening. See src/lib/product-telemetry.ts.
                        ...drainTelemetry(),
                    }, { merge: true });

                    batch.set(sessionRef, {
                        sessionId,
                        userAgent: navigator.userAgent,
                        lastSeen: serverTimestamp(),
                        // merge:true keeps whatever is already stored, so these
                        // two only need writing when the document is new.
                        // Preserving createdAt is what the removed read was for,
                        // and re-asserting revoked:false on every heartbeat could
                        // undo a revocation that landed mid-flush.
                        ...(sessionKnownMissing ? { createdAt: serverTimestamp(), revoked: false } : {}),
                        deviceInfo: {
                            platform: navigator?.platform || 'Unknown',
                            vendor: navigator?.vendor || 'Unknown',
                            language: navigator?.language || 'Unknown'
                        }
                    }, { merge: true });

                    // The journey doc keeps the ordered route log for the whole
                    // session (first-session onboarding, top pages, funnels).
                    // Per-route counters are not written here — they ride on the
                    // heartbeat's own set() above, as `pageViewFields`.
                    const routeLog = sessionLogRef.current.slice(-400);
                    if (routeLog.length > 0) {
                        const journeyRef = doc(firestore, 'users', user.uid, 'journey', sessionId);
                        // Latched once so the flag stays true for the whole session
                        // even though this block runs on every heartbeat flush.
                        const firstSession = firstSessionRef.current;
                        batch.set(journeyRef, {
                            uid: user.uid,
                            sessionId,
                            startedAt: routeLog[0] ? new Date(routeLog[0].at) : new Date(),
                            routes: routeLog,
                            endedAt: serverTimestamp(),
                            deviceType,
                            // Flags the very first session after signup — that is the
                            // run the admin onboarding panel reads to see where a brand
                            // new user actually went first.
                            isFirstSession: firstSession,
                        }, { merge: true });
                    }

                    await batch.commit();
                    sessionStorage.setItem('last_user_activity_update', now.toString());
                    console.log("User session updated successfully");
                }
            } catch (error: any) {
                if (error?.message?.includes('Missing or insufficient permissions') || error?.code === 'permission-denied') {
                    // Silently ignore during logout as auth state is cleared before the request finishes
                    return;
                }
                console.error("Error updating user activity/session:", error);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                checkAndUpdateActivity(user);
            }
        });

        // Trigger on navigation
        if (auth.currentUser) {
            checkAndUpdateActivity(auth.currentUser);
        }

        // Trigger continuously while tab is active
        const intervalId = setInterval(() => {
            if (document.visibilityState === 'visible' && auth.currentUser) {
                checkAndUpdateActivity(auth.currentUser);
            }
        }, 60 * 1000);

        // Fire-and-forget flush on unload. The 5-minute heartbeat gate would
        // otherwise drop a brand-new user's whole first session if they closed
        // the app before the next tick — which is exactly the run the admin
        // onboarding view cares about most.
        const flushOnUnload = () => {
            const uid = auth.currentUser?.uid;
            if (!uid || !firestore) return;

            const pageViewUpdate: Record<string, any> = {};
            const pending = pendingRef.current;
            if (pending.length > 0) {
                const totals = new Map<string, number>();
                pending.forEach(p => totals.set(p.key, (totals.get(p.key) || 0) + 1));
                // Nested map, not dotted paths — same reason as the heartbeat above.
                const perRoute: Record<string, any> = {};
                totals.forEach((count, key) => { perRoute[key] = increment(count); });
                pageViewUpdate.pageViews = perRoute;
                pageViewUpdate.pagesVisited = increment([...totals.values()].reduce((a, b) => a + b, 0));
                pendingRef.current = [];
            }

            // Close out the page they are leaving from, then take whatever
            // telemetry has built up since the last heartbeat. Without this, the
            // dwell on the final page of every session is simply lost — and for a
            // short session that is most of the session.
            if (prevRouteKeyRef.current) {
                if (routeVisibleSinceRef.current !== null) {
                    routeDwellMsRef.current += Date.now() - routeVisibleSinceRef.current;
                    routeVisibleSinceRef.current = null;
                }
                recordDwell(prevRouteKeyRef.current, routeDwellMsRef.current);
                routeDwellMsRef.current = 0;
            }
            Object.assign(pageViewUpdate, drainTelemetry());

            const routeLog = sessionLogRef.current.slice(-400);
            if (routeLog.length > 0) {
                const sid = sessionStorage.getItem(`zeneva_session_id_${uid}`);
                if (sid) {
                    setDoc(doc(firestore, 'users', uid, 'journey', sid), {
                        uid,
                        sessionId: sid,
                        routes: routeLog,
                        endedAt: new Date(),
                        isFirstSession: firstSessionRef.current,
                    }, { merge: true }).catch(() => {});
                }
            }

            if (Object.keys(pageViewUpdate).length > 0) {
                setDoc(doc(firestore, 'users', uid), pageViewUpdate, { merge: true }).catch(() => {});
            }
        };
        window.addEventListener('beforeunload', flushOnUnload);

        return () => {
            unsubscribe();
            clearInterval(intervalId);
            window.removeEventListener('beforeunload', flushOnUnload);
        };
    }, [auth, firestore, pathname]);

    return null;
}
