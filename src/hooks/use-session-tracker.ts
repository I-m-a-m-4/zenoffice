'use client';

import { useEffect, useRef } from 'react';
import {
  getFirestore,
  doc,
  collection,
  addDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';

/**
 * useSessionTracker
 *
 * Silently tracks each user's active session time and persists it to Firestore.
 *
 * Firestore writes:
 *   • `users/{userId}` — increments `totalUsageSeconds`, updates `lastSeen`
 *   • `users/{userId}/sessions/{autoId}` — one document per session with duration
 *
 * The hook handles:
 *   - Tab visibility changes (pauses when hidden, resumes on focus)
 *   - Page unloads (`beforeunload`) to flush the final partial session
 *   - Heartbeat every 2 minutes while the tab is visible (keeps `lastSeen` fresh)
 *
 * Write cadence: a 30-second heartbeat meant ~2,880 `updateDoc` calls per user
 * per 8-hour day, and this is the app's highest-frequency write path.
 * `totalUsageSeconds` is an `increment` of elapsed time, not a tick counter, so
 * the interval only decides how stale `lastSeen` can get — accumulated time
 * stays exact at any cadence because `pauseSession` and the `beforeunload`
 * handler both flush.
 *
 * The ceiling is the presence indicator: `user-primitives.tsx` calls a user
 * online when `lastSeen` is under 5 minutes old, so a 5-minute heartbeat would
 * sit exactly on that boundary and blink active users offline. 2 minutes stays
 * comfortably inside the window and still cuts the write rate 4x.
 */
export function useSessionTracker(userId: string | null | undefined) {
  const sessionStartRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accumulatedSecondsRef = useRef<number>(0); // seconds elapsed this session

  useEffect(() => {
    if (!userId) return;

    const db = getFirestore();
    const userDocRef = doc(db, 'users', userId);
    const sessionsColRef = collection(db, 'users', userId, 'sessions');

    // ---------- helpers ----------

    const nowMs = () => Date.now();

    /** Flush accumulated time to Firestore and return seconds flushed */
    const flush = async (reason: 'heartbeat' | 'pause' | 'end'): Promise<number> => {
      if (!sessionStartRef.current || !isVisibleRef.current) return 0;

      const elapsed = Math.round((nowMs() - sessionStartRef.current) / 1000);
      if (elapsed < 1) return 0;

      accumulatedSecondsRef.current += elapsed;
      sessionStartRef.current = nowMs(); // reset for next interval

      try {
        await updateDoc(userDocRef, {
          totalUsageSeconds: increment(elapsed),
          lastSeen: serverTimestamp(),
        });
      } catch {
        // Silently ignore — network may be offline
      }

      return elapsed;
    };

    /** Save full session record when session ends */
    const saveSession = async (totalSeconds: number) => {
      if (totalSeconds < 2) return; // ignore trivial sessions
      try {
        await addDoc(sessionsColRef, {
          startedAt: new Date(nowMs() - totalSeconds * 1000),
          endedAt: new Date(),
          durationSeconds: totalSeconds,
          date: format(new Date(), 'yyyy-MM-dd'),
        });
      } catch {
        // Silently ignore
      }
    };

    // ---------- lifecycle ----------

    const startSession = () => {
      sessionStartRef.current = nowMs();
      isVisibleRef.current = true;
    };

    const pauseSession = async () => {
      if (!isVisibleRef.current) return;
      isVisibleRef.current = false;
      await flush('pause');
    };

    const endSession = async () => {
      stopHeartbeat();
      await flush('end');
      await saveSession(accumulatedSecondsRef.current);
      accumulatedSecondsRef.current = 0;
      sessionStartRef.current = null;
    };

    // ---------- heartbeat ----------

    const startHeartbeat = () => {
      heartbeatRef.current = setInterval(() => {
        flush('heartbeat');
      }, 2 * 60_000); // every 2 minutes — see the cadence note in the file header
    };

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    // ---------- visibility change ----------

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startSession();
        startHeartbeat();
      } else {
        stopHeartbeat();
        pauseSession();
      }
    };

    // ---------- beforeunload ----------

    const handleBeforeUnload = () => {
      // sendBeacon is fire-and-forget; we do our best to flush
      if (sessionStartRef.current && isVisibleRef.current) {
        const elapsed = Math.round((nowMs() - sessionStartRef.current) / 1000);
        accumulatedSecondsRef.current += elapsed;
        // We can't await here, so fire-and-forget via updateDoc
        updateDoc(userDocRef, {
          totalUsageSeconds: increment(elapsed),
          lastSeen: serverTimestamp(),
        }).catch(() => {});
      }
    };

    // ---------- boot ----------

    const initTracker = async () => {
      startSession();
      startHeartbeat();
      try {
        await updateDoc(userDocRef, {
          lastSeen: serverTimestamp(),
        });
      } catch (err) {
        console.warn("Failed to mark user online on boot:", err);
      }
    };

    initTracker();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession();
    };
  }, [userId]);
}
