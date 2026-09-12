'use client';

/**
 * The streak flame.
 *
 * A streak is the one number on the rating that the owner can lose by doing
 * nothing, and that is exactly why it deserves to be the liveliest thing on the
 * page. It has three states and they are meant to be readable across a room:
 *
 * - **Alive** — full colour, ignites once on mount, then flickers with embers
 *   rising off it.
 * - **At risk** — yesterday earned the run, today has not renewed it. Cool,
 *   desaturated, and the embers stop. Deliberately not red: nothing is broken
 *   yet, and crying wolf at 9am on a shop that will sell at 10 teaches the owner
 *   to ignore the flame.
 * - **Out** — no streak. Rendered as a grey outline so the space does not jump
 *   when a run starts.
 *
 * ── The rules it follows ───────────────────────────────────────────────────
 *
 * **Colour never carries the meaning alone.** The day count sits beside the flame
 * and the at-risk state says so in words, because the whole app holds to that and
 * because a cool flame and a warm one are the same flame to a colourblind reader.
 *
 * **Reduced motion is honoured in full.** The flicker, the embers and the
 * ignition all stop — `useReducedMotion` is the same hook `ZenMark` and the
 * marketing pages use. What remains is a static flame that still reads correctly,
 * so nothing is lost but the movement.
 *
 * **The gradient ids are per-instance** (`React.useId`). Two flames on one page
 * with a shared id means whichever mounted last wins and the other renders
 * unfilled — the same trap documented on `ZenMark`.
 */

import * as React from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type StreakState = 'alive' | 'at-risk' | 'out';

/** Embers are placed by hand rather than randomly: a fixed spread reads as fire,
 *  and a random one occasionally clumps into something that looks like a bug. */
const EMBERS = [
  { left: '28%', delay: '0s', size: 3 },
  { left: '54%', delay: '0.6s', size: 2 },
  { left: '40%', delay: '1.2s', size: 2.5 },
  { left: '66%', delay: '1.7s', size: 2 },
];

export function StreakFlame({
  state,
  size = 40,
  className,
}: {
  state: StreakState;
  /** Rendered width in px. The embers scale with it. */
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const id = React.useId();
  const bodyId = `flame-body-${id}`;
  const coreId = `flame-core-${id}`;

  const alive = state === 'alive';
  const atRisk = state === 'at-risk';

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-end justify-center', className)}
      style={{ width: size, height: size * 1.15 }}
    >
      {/* Glow behind the flame. Blurred and out of phase with the body's flicker so
          the two never pulse together. */}
      {alive && (
        <span
          aria-hidden
          className={cn(
            'absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-orange-500/40 blur-xl',
            !reduce && 'animate-ember-glow',
          )}
          style={{ width: size * 0.9, height: size * 0.9 }}
        />
      )}

      {/* Embers. Absent when at risk or out — a dying fire does not throw sparks. */}
      {alive &&
        !reduce &&
        EMBERS.map((e, i) => (
          <span
            key={i}
            aria-hidden
            className="animate-ember absolute rounded-full bg-amber-300"
            style={{
              left: e.left,
              bottom: size * 0.55,
              width: e.size,
              height: e.size,
              animationDelay: e.delay,
            }}
          />
        ))}

      <svg
        viewBox="0 0 24 28"
        className={cn(
          'relative h-full w-full origin-bottom',
          alive && !reduce && 'animate-flicker',
          // Ignition plays once. Layered on top of the flicker via the wrapper
          // above rather than on the same element, since two animations on one
          // element would fight over `transform`.
          atRisk && 'opacity-70 saturate-[0.35]',
          state === 'out' && 'opacity-40 saturate-0',
        )}
      >
        <defs>
          <linearGradient id={bodyId} x1="12" y1="28" x2="12" y2="1" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="45%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id={coreId} x1="12" y1="27" x2="12" y2="9" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#fffbeb" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Outer body */}
        <path
          d="M12 1c3.4 4.6 3 6.9 1.6 8.6-1 1.2-2.4 1.6-2.4 3.4 0 1.4 1 2.3 1 2.3-2.6-.4-4-2.3-4-4.6 0-1.2.4-2.2.4-2.2C6.2 10.4 4 13.4 4 17.2 4 22.6 8 27 12 27s8-4.2 8-9.6c0-6-4.8-9.8-8-16.4Z"
          fill={`url(#${bodyId})`}
        />
        {/* Inner core — the part that makes it read as fire rather than a leaf */}
        <path
          d="M12 12.4c2 2.8 3 4.6 3 6.6 0 2.4-1.4 4.2-3 4.2s-3-1.8-3-4.2c0-2.2 1.4-3.6 3-6.6Z"
          fill={`url(#${coreId})`}
        />
      </svg>
    </span>
  );
}

/**
 * The flame with its day count, as the hero uses it.
 *
 * Kept beside the flame rather than inside it: a number over a flickering shape is
 * unreadable at any size that fits in a card.
 */
export function StreakBadge({
  streak,
  atRisk,
  size = 34,
}: {
  streak: number;
  atRisk: boolean;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const state: StreakState = streak === 0 ? 'out' : atRisk ? 'at-risk' : 'alive';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        state === 'alive'
          ? 'border-orange-500/40 bg-orange-500/10'
          : 'border-border bg-muted/40',
        // The whole badge ignites once when the run is live, which is what sells
        // the moment the flame comes back after a quiet day.
        state === 'alive' && !reduce && 'animate-ignite',
      )}
      title={
        state === 'alive'
          ? `${streak} days in a row with a sale.`
          : state === 'at-risk'
            ? 'No sale recorded today yet — one keeps the run alive.'
            : 'No run going. One sale today starts it.'
      }
    >
      <StreakFlame state={state} size={size} />
      <span className="leading-none">
        <span
          className={cn(
            'block text-lg font-bold tabular-nums',
            state === 'alive' ? 'text-orange-500' : 'text-muted-foreground',
          )}
        >
          {streak}
        </span>
        <span className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          {state === 'at-risk' ? 'at risk' : streak === 1 ? 'day' : 'days'}
        </span>
      </span>
    </span>
  );
}
