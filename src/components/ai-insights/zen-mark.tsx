'use client';

import * as React from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * The Zeneva glyph — the ring and the crescent beneath it, lifted from the
 * `logoIconUrl` data-URI in `src/lib/config.ts` so it can be animated.
 *
 * A data-URI <img> cannot be animated per-path, which is the whole point here:
 * while Zen AI is working the mark gets a silver sheen sweeping across it.
 *
 * The two `d` values are copied verbatim from the logo. If the brand mark ever
 * changes, re-decode `AppConfig.logoIconUrl` and copy them again rather than
 * redrawing by hand — they must stay identical to the logo used elsewhere.
 */

const RING_D =
  'M 100 55 A 35 35 0 1 0 100 125 A 35 35 0 1 0 100 55 Z M 100 63 A 27 27 0 1 1 100 117 A 27 27 0 1 1 100 63 Z';
const CRESCENT_D = 'M 60 127 Q 100 154 140 127 Q 100 142 60 127 Z';

/**
 * The logo's own viewBox is `0 0 200 200`, but the glyph only occupies
 * x 60–140, y 55–154 inside it. At avatar size that padding shrinks the mark
 * to about a third of the space, so crop to a square around the glyph's
 * centroid (100, 104.5) instead. The paths are untouched.
 */
const VIEW_BOX = '42 47 116 116';

let uidCounter = 0;

export function ZenMark({
  className = 'w-full h-full',
  animated = false,
}: {
  className?: string;
  /** Sweep a silver sheen across the mark — use while a reply is streaming. */
  animated?: boolean;
}) {
  // Gradient/mask ids must be unique per instance or multiple marks on the
  // page collide and only the first one renders correctly.
  const uid = React.useMemo(() => `zen-mark-${++uidCounter}`, []);
  const orange = `${uid}-orange`;
  const sheen = `${uid}-sheen`;

  // SMIL (<animateTransform>) ignores the CSS reduced-motion query, so the
  // sheen has to be dropped in JS rather than disabled in globals.css.
  const reduceMotion = useReducedMotion();
  const sweep = animated && !reduceMotion;

  return (
    <svg
      viewBox={VIEW_BOX}
      className={className}
      role="img"
      aria-label="Zen AI"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={orange} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ff9933" />
          <stop offset="100%" stopColor="#cc5200" />
        </linearGradient>

        {/*
         * The sheen is a narrow white band on a horizontal gradient, translated
         * across the glyph. It is painted *over* the orange fill and clipped to
         * the glyph itself, so it reads as light travelling through the mark
         * rather than a rectangle sliding past it.
         */}
        {sweep && (
          <linearGradient id={sheen} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="65%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-1 0"
              to="1 0"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </linearGradient>
        )}
      </defs>

      <g className={sweep ? 'zen-mark-pulse' : undefined}>
        {/* stroke matches the logo's own hairline so the mark reads identically */}
        <path d={RING_D} fill={`url(#${orange})`} stroke="#cc5200" strokeWidth={0.5} />
        <path d={CRESCENT_D} fill={`url(#${orange})`} stroke="#cc5200" strokeWidth={0.5} />

        {sweep && (
          <>
            <path d={RING_D} fill={`url(#${sheen})`} />
            <path d={CRESCENT_D} fill={`url(#${sheen})`} />
          </>
        )}
      </g>
    </svg>
  );
}
