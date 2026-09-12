/**
 * The peer benchmark, read once and kept.
 *
 * `platform_stats/rating_benchmark` is a single small document written by the
 * six-hourly platform scan (`src/lib/server/analytics-cache.ts`) and readable by any
 * signed-in user under the existing `platform_stats/{docId}` rule — so this needed
 * no rules change to ship.
 *
 * ── Why it is cached in localStorage ───────────────────────────────────────
 *
 * The owner pays for every Firestore read, and this document changes at most four
 * times a day. Reading it on every visit to the Reports tab would bill a read for a
 * figure that has not moved. It is cached for `CACHE_TTL_HOURS` and served from
 * storage in between, which also means the comparison still renders offline.
 *
 * ── Failure is silent on purpose ───────────────────────────────────────────
 *
 * `null` is the normal state, not an error: the document does not exist until enough
 * businesses qualify for a cohort, and it stays absent on a small or new deployment.
 * Every caller must treat `null` as "no comparison available" and render nothing —
 * a benchmark row with an em-dash in it invites the reader to wonder what broke.
 */
'use client';

import * as React from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { usePOS } from '@/context/pos-context';
import { secureStorage } from '@/lib/secure-storage';
import {
  BENCHMARK_COLLECTION,
  BENCHMARK_DOC_ID,
  type RatingBenchmark,
} from '@/lib/rating-benchmark';

const CACHE_KEY = 'zeneva_rating_benchmark';
const CACHE_TTL_HOURS = 12;

interface CachedBenchmark {
  /** When this device fetched it, not when the platform computed it. */
  fetchedAt: number;
  /** Null is cached too, so an absent document does not re-read every visit. */
  value: RatingBenchmark | null;
}

/**
 * Fetch the peer benchmark.
 *
 * @param enabled Whether the caller will actually use it. Pass the owner's rating
 *   opt-in state. A hook cannot be called conditionally, so a shop that has not
 *   opted in still mounts this one when it opens Reports — and without this
 *   parameter it would pay a Firestore read every 12 hours for a comparison it
 *   never sees. Defaults to true so a caller that has no notion of the opt-in
 *   behaves as before.
 */
export function useRatingBenchmark(enabled: boolean = true): RatingBenchmark | null {
  const { firestore, business } = usePOS();
  const [benchmark, setBenchmark] = React.useState<RatingBenchmark | null>(null);

  React.useEffect(() => {
    // Gated on a business rather than on `firestore` alone: the read needs an
    // authenticated user to satisfy the rule, and the context has one by the time a
    // business is resolved.
    if (!enabled || !firestore || !business?.id) return;

    const cached = secureStorage.getItem<CachedBenchmark>(CACHE_KEY);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_HOURS * 3600_000) {
      setBenchmark(cached.value);
      return;
    }

    let alive = true;
    getDoc(doc(firestore, BENCHMARK_COLLECTION, BENCHMARK_DOC_ID))
      .then((snap) => {
        if (!alive) return;
        const value = snap.exists() ? (snap.data() as RatingBenchmark) : null;
        setBenchmark(value);
        secureStorage.setItem(CACHE_KEY, { fetchedAt: Date.now(), value } satisfies CachedBenchmark);
      })
      .catch(() => {
        // Absent, offline or unreadable all mean the same thing to the caller. Fall
        // back to whatever was last cached rather than dropping the comparison.
        if (alive && cached) setBenchmark(cached.value);
      });

    return () => {
      alive = false;
    };
  }, [enabled, firestore, business?.id]);

  return benchmark;
}
