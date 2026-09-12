/**
 * One rating, two surfaces.
 *
 * The top-bar banner (`src/components/dashboard/business-health-indicator.tsx`)
 * and the Reports → Business Rating tab used to read different things and
 * disagree: the banner read the AI report's frozen score, the tab read four
 * pillar fields nothing ever wrote. Both now call this hook, so the number in
 * the chrome is the number on the page, always.
 *
 * On top of the pure scorer in `src/lib/business-rating.ts` this adds the four
 * things that need a memory of yesterday:
 *
 * - **delta and movers** — the movement since the last day the shop was open in
 *   the app, and which pillars produced it. This is the whole reason to come back
 *   and look, and `business-rating.ts` rule 2 promises it: *"why did I drop four
 *   points" must have an answer.* A bare delta is not that answer, so each
 *   snapshot stores the four pillar scores alongside the total.
 * - **best** — the score to beat. The tab ranks the owner against their own
 *   record rather than against invented competitors.
 * - **streak** — consecutive days with at least one sale, plus whether today has
 *   yet to put a sale on the board (`streakAtRisk`).
 * - **leveledUpTo** — set once when the shop crosses into a tier it has never
 *   held, against a stored high-water mark.
 *
 * History lives in `localStorage` via `secureStorage`, capped at 30 entries.
 * Deliberately not Firestore: it is one small array per device, the owner pays per
 * read, and a rating history is not worth a document write a day. The cost of that
 * choice is that the trend is per-device and starts the first time the tab is
 * opened — which is why the sparkline draws only the days it actually has.
 *
 * ── Who fires the confetti ─────────────────────────────────────────────────
 *
 * Not this hook. Two components consume it and the top bar is mounted on every
 * page, so celebrating in here fires twice and fires on whatever page the owner
 * happened to be on. The hook only *reports* `leveledUpTo` and hands back
 * `acknowledgeLevelUp()`; the Reports panel is the single caller that celebrates
 * and then acknowledges. Until it does, the level-up stays pending — so it
 * survives a reload and is still there when the owner next opens the tab.
 */
'use client';

import * as React from 'react';
import { usePOS } from '@/context/pos-context';
import { secureStorage } from '@/lib/secure-storage';
import { safeToDate } from '@/lib/utils';
import {
  computeBusinessRating,
  type BusinessRating,
  type PillarKey,
  type RatingTier,
} from '@/lib/business-rating';

/**
 * `{ d: day key, s: score, p: pillar scores }` — short keys because this is a
 * stored payload that is rewritten every day.
 *
 * `p` is optional: entries written before per-pillar attribution existed have no
 * pillar scores, and those days must read as "no attribution available" rather
 * than as four zeros, which would render as a catastrophic drop that never
 * happened.
 */
export interface RatingSnapshot {
  d: string;
  s: number;
  p?: Partial<Record<PillarKey, number>>;
}

/** One pillar's movement between two recorded days. */
export interface RatingMover {
  key: PillarKey;
  label: string;
  delta: number;
}

const HISTORY_LIMIT = 30;

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

/**
 * The longest run of consecutive selling days in the receipts we hold.
 *
 * Derived from the rows rather than remembered in storage, which matters for a
 * badge: a high-water mark kept per device would read as zero the first time the
 * owner opens the app on their phone, so a badge they had earned would appear
 * unearned. The trade is that this can only see as far back as the 200-receipt
 * listener — it understates a long history rather than inventing one.
 *
 * Runs are walked forward from their first day only (a day whose predecessor is
 * absent), so each run is counted once. Day keys are re-parsed at local midday so
 * a daylight-saving shift cannot make two adjacent days look non-adjacent.
 */
function longestRun(days: Set<string>): number {
  let longest = 0;
  for (const day of days) {
    const start = new Date(`${day}T12:00:00`);
    if (Number.isNaN(start.getTime())) continue;
    if (days.has(dayKey(shiftDays(start, -1)))) continue;
    let n = 0;
    let cursor = start;
    while (days.has(dayKey(cursor)) && n < 400) {
      n++;
      cursor = shiftDays(cursor, 1);
    }
    if (n > longest) longest = n;
  }
  return longest;
}

export interface BusinessRatingView extends BusinessRating {
  /**
   * Whether the owner has opted in. **Every surface must check this first.**
   *
   * Not the same thing as `score === null`, which means "not enough data to score
   * yet" — that state still belongs on screen, because it tells a new shop what it
   * needs to record. `enabled: false` means the owner does not want to be graded,
   * and the honest response to that is silence, not an empty gauge.
   *
   * The scorer itself stays unaware of this: `computeBusinessRating` keeps running,
   * so the flag is a display gate and nothing else. It costs nothing to run — the
   * inputs are already in memory — and it means opting back in is instant rather
   * than starting from no data.
   */
  enabled: boolean;
  /**
   * True only while the owner has never answered either way, which is the one state
   * that may pitch the feature to them. Once they have declined, `enabled` is false
   * and this is false too, and the rating must stay out of their way — re-offering it
   * on every visit to Reports is the exact thing the opt-in exists to prevent.
   *
   * False while the business doc is still loading, because an absent field and an
   * unloaded document both read as `undefined` and only one of them means "never
   * asked".
   */
  neverAsked: boolean;
  /** Points gained or lost since the previous recorded day. Null on day one. */
  delta: number | null;
  /**
   * Which pillars produced `delta`, largest absolute movement first. Empty when
   * the previous snapshot predates per-pillar history — the movement is real but
   * unattributable, and inventing an attribution is worse than omitting one.
   */
  movers: RatingMover[];
  /** Highest score ever recorded on this device, today included. */
  best: number | null;
  /** True when today's score matches that record and beats every prior day. */
  isPersonalBest: boolean;
  /** Consecutive days with at least one sale, counting back from today. */
  streak: number;
  /** A live streak that yesterday earned and today has not yet renewed. */
  streakAtRisk: boolean;
  /**
   * The best run of consecutive selling days visible in the held receipts. Unlike
   * `streak` this cannot go down, which is what makes it safe to hang a badge on.
   */
  longestStreak: number;
  /** Oldest first, today last — whatever days this device has seen. */
  history: RatingSnapshot[];
  /** The largest money opportunity, for the top bar's tooltip. */
  topOpportunity: BusinessRating['opportunities'][number] | null;
  /** A tier crossed for the first time, pending celebration. Null when nothing is due. */
  leveledUpTo: RatingTier | null;
  /** Marks the pending level-up as celebrated. Only the Reports panel should call this. */
  acknowledgeLevelUp: () => void;
  /**
   * The day this reading is for, rolled over at local midnight.
   *
   * Exposed so anything else that needs "today" — the daily insight, for one —
   * shares this clock instead of freezing a second `new Date()` of its own, which
   * would drift out of step overnight on a till that is never closed.
   */
  today: Date;
}

export function useBusinessRating(): BusinessRatingView {
  const { business, products, receipts, customers, isLoading } = usePOS();
  const businessId = business?.id;

  // ── The opt-in ────────────────────────────────────────────────────────────
  // Three states, and the middle one is the reason this is not a plain boolean:
  // `undefined` (never asked), `false` (asked, declined), `true` (opted in). Only
  // the first may show the invitation. Read straight off the business doc, which
  // `usePOS()` already holds — no extra Firestore read.
  //
  // `neverAsked` additionally requires the doc to have arrived: an absent field and
  // an unloaded document are the same `undefined`, so without that clause a shop
  // that opted in months ago gets the invitation flashed at it on every cold open
  // of Reports — the one state this feature exists to keep out of their way.
  const preference = business?.settings?.ratingEnabled;
  const enabled = preference === true;
  const neverAsked = !!business && preference === undefined;

  // A date, not a timestamp: the rating only needs day resolution, and a fresh
  // `new Date()` on every render would recompute the memo forever.
  const [today, setToday] = React.useState(() => new Date());

  // …but it must still roll over. This is a desktop till that stays open for days
  // at a time, and a `today` frozen at mount freezes the score, the streak and the
  // day key written to history with it — the shop would come back on Thursday to
  // Monday's number. One timer aimed at the next local midnight rather than a
  // polling loop, re-armed each time it fires.
  React.useEffect(() => {
    const nextMidnight = new Date(today);
    nextMidnight.setHours(24, 0, 0, 0);
    // +1s of slack so the timer cannot land a hair before midnight and re-arm
    // against the same day in a tight loop.
    const wait = Math.max(1000, nextMidnight.getTime() - Date.now() + 1000);
    const timer = setTimeout(() => setToday(new Date()), wait);
    return () => clearTimeout(timer);
  }, [today]);

  const rating = React.useMemo(
    () => computeBusinessRating({ products, receipts, customers, now: today }),
    [products, receipts, customers, today],
  );

  const { streak, streakAtRisk, longestStreak } = React.useMemo(() => {
    if (!receipts || receipts.length === 0) return { streak: 0, streakAtRisk: false, longestStreak: 0 };
    const days = new Set(receipts.map((r) => dayKey(safeToDate(r.createdAt))));

    // Start at today, but fall back to yesterday when nothing has sold yet
    // today — otherwise a twelve-day streak reads as zero every morning until
    // the first customer walks in.
    const soldToday = days.has(dayKey(today));
    let cursor = today;
    if (!soldToday) {
      cursor = shiftDays(today, -1);
      if (!days.has(dayKey(cursor))) return { streak: 0, streakAtRisk: false, longestStreak: longestRun(days) };
    }

    // The bound is a runaway guard, not a cap on the streak: the receipt
    // listener holds the 200 most recent sales, so a longer run than this is not
    // observable from here in any case.
    let count = 0;
    while (days.has(dayKey(cursor)) && count < 400) {
      count++;
      cursor = shiftDays(cursor, -1);
    }
    // At risk, not broken: yesterday earned the run and today can still keep it.
    return { streak: count, streakAtRisk: !soldToday, longestStreak: Math.max(count, longestRun(days)) };
  }, [receipts, today]);

  const storageKey = businessId ? `zeneva_rating_history_${businessId}` : null;
  const tierKey = businessId ? `zeneva_rating_tier_${businessId}` : null;
  const [history, setHistory] = React.useState<RatingSnapshot[]>([]);

  React.useEffect(() => {
    if (!storageKey) return;
    setHistory(secureStorage.getItem<RatingSnapshot[]>(storageKey) ?? []);
  }, [storageKey]);

  /** The four pillar scores, keyed, for the snapshot. Unmeasured pillars are absent. */
  const pillarScores = React.useMemo(() => {
    const out: Partial<Record<PillarKey, number>> = {};
    for (const p of rating.pillars) {
      if (p.measured) out[p.key] = p.score;
    }
    return out;
  }, [rating.pillars]);

  // Record today's score once it is real. Guarded on `isLoading` because the
  // context reports empty arrays before the cache hydrates, and a score of 12
  // written during that window would show up as a crash in the trend line.
  //
  // Also guarded on `enabled`: gating the components alone would leave an
  // opted-out shop quietly accumulating a 30-day trail of scores it never asked
  // for and cannot see.
  React.useEffect(() => {
    if (!enabled || !storageKey || isLoading || rating.score === null) return;
    const key = dayKey(today);
    const stored = secureStorage.getItem<RatingSnapshot[]>(storageKey) ?? [];
    const existing = stored.find((s) => s.d === key);
    const entry: RatingSnapshot = { d: key, s: rating.score, p: pillarScores };
    // Rewrite today's entry when either the total or any pillar has moved, so a
    // score that holds steady while its pillars trade places still records the
    // attribution that explains tomorrow's delta.
    const unchanged =
      existing &&
      existing.s === rating.score &&
      JSON.stringify(existing.p ?? {}) === JSON.stringify(pillarScores);
    if (unchanged) {
      if (stored.length !== history.length) setHistory(stored);
      return;
    }
    const next = [...stored.filter((s) => s.d !== key), entry]
      .sort((a, b) => (a.d < b.d ? -1 : 1))
      .slice(-HISTORY_LIMIT);
    secureStorage.setItem(storageKey, next);
    setHistory(next);
    // `history` is intentionally absent: this effect writes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, storageKey, isLoading, rating.score, pillarScores, today]);

  const priorDays = history.filter((s) => s.d !== dayKey(today));
  const previous = priorDays.length > 0 ? priorDays[priorDays.length - 1] : null;
  const delta = rating.score !== null && previous ? rating.score - previous.s : null;

  const movers = React.useMemo<RatingMover[]>(() => {
    if (!previous?.p) return [];
    const out: RatingMover[] = [];
    for (const pillar of rating.pillars) {
      const was = previous.p[pillar.key];
      // A pillar that was unmeasured then, or is unmeasured now, has no movement
      // to report — it appeared or disappeared, which is not a rise or a fall.
      if (was === undefined || !pillar.measured) continue;
      const change = pillar.score - was;
      if (change !== 0) out.push({ key: pillar.key, label: pillar.label, delta: change });
    }
    return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [previous, rating.pillars]);

  const best =
    history.length > 0 || rating.score !== null
      ? Math.max(rating.score ?? 0, ...history.map((s) => s.s))
      : null;
  // Ties do not count: matching last week's record is holding, not beating.
  const isPersonalBest =
    rating.score !== null &&
    priorDays.length > 0 &&
    rating.score > Math.max(...priorDays.map((s) => s.s));

  // ── Level-up ──────────────────────────────────────────────────────────────
  // The high-water mark is stored, so a tier is celebrated once and a shop that
  // slips back to Grower and climbs again is not congratulated twice for the same
  // ground. `pending` survives reloads until the panel acknowledges it.
  const [highWater, setHighWater] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!tierKey) return;
    setHighWater(secureStorage.getItem<number>(tierKey) ?? 0);
  }, [tierKey]);

  // A shop that has been trading for months before this shipped must not be
  // walked up through five tiers of confetti on first open, so the first reading
  // on a device seeds the mark silently and celebrates nothing.
  //
  // `enabled` gates this for a reason that is easy to miss: seeding is a one-shot,
  // guarded on the key being absent. If it ran while the rating was switched off,
  // the single silent seed would be spent on a reading nobody ever saw — so the
  // day the owner opts in, their first real level-up is already marked as claimed.
  // Opting in should behave exactly like a fresh install, and this is what makes it.
  React.useEffect(() => {
    if (!enabled || !tierKey || isLoading || rating.score === null) return;
    if (secureStorage.getItem<number>(tierKey) !== null) return;
    secureStorage.setItem(tierKey, rating.tier.index);
    setHighWater(rating.tier.index);
  }, [enabled, tierKey, isLoading, rating.score, rating.tier.index]);

  const leveledUpTo =
    enabled && rating.score !== null && highWater !== null && highWater > 0 && rating.tier.index > highWater
      ? rating.tier
      : null;

  const acknowledgeLevelUp = React.useCallback(() => {
    if (!tierKey || !leveledUpTo) return;
    secureStorage.setItem(tierKey, leveledUpTo.index);
    setHighWater(leveledUpTo.index);
  }, [tierKey, leveledUpTo]);

  return {
    ...rating,
    enabled,
    neverAsked,
    delta,
    movers,
    best,
    isPersonalBest,
    streak,
    streakAtRisk,
    longestStreak,
    history,
    topOpportunity: rating.opportunities[0] ?? null,
    leveledUpTo,
    acknowledgeLevelUp,
    today,
  };
}
