'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { backdropCss, fadeMaskCss, FADE } from '@/lib/marketing/backdrop';

/**
 * The cinematic backdrop, as a page section.
 *
 * The same ground and the same dissolve the recorder paints in
 * `scripts/record/scene.js`, reading the same tokens from
 * `src/lib/marketing/backdrop.ts` — so a recorded take and the live site are the
 * same design rather than two things that resemble each other.
 *
 * ## What it does
 *
 * Paints a warm radial-over-linear ground, and optionally masks its children so
 * their bottom edge *dissolves* into that ground instead of ending on a line.
 * The dissolve is the whole trick: a hard edge splits a section into "picture"
 * and "caption bar" and immediately reads as a template, where a dissolve makes
 * the two one continuous space.
 *
 * ## Why the drift is CSS and not `requestAnimationFrame`
 *
 * In the recorder the drift is load-bearing — it forces a new paint every frame
 * so the capture does not repeat frames. On a live page there is nothing to
 * capture, so it is only atmosphere, and paying a JS callback per frame for
 * atmosphere is the wrong trade. A keyframe animation on `transform` alone stays
 * on the compositor and costs the main thread nothing.
 *
 * That is also why `prefers-reduced-motion` is honoured in CSS here rather than
 * in JS. The JS check that `ZenMark` uses exists because SMIL ignores the media
 * query; a CSS animation does not, so the plain media query is correct and one
 * less thing to keep in sync.
 */
export function MotionBackdrop({
  children,
  className,
  fade = true,
  drift = true,
  contentClassName,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Dissolve the bottom edge of `children` into the ground. */
  fade?: boolean;
  /** Slow ambient movement of the ground. Ignored under reduced motion. */
  drift?: boolean;
  contentClassName?: string;
}) {
  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <style>{DRIFT_CSS}</style>

      {/*
        The ground. `aria-hidden` and behind everything: it carries no meaning,
        and a screen reader announcing a gradient is noise.

        Scaled slightly past the box so the drift never exposes an edge — a
        translated gradient with no headroom shows a hairline of page background
        at the extreme of its travel, which is the kind of bug that only appears
        eight seconds into an animation.
      */}
      <div
        aria-hidden
        className={cn('absolute -inset-[3%] -z-10', drift && 'zn-backdrop-drift')}
        style={{ background: backdropCss() }}
      />

      <div
        className={contentClassName}
        style={fade ? {
          WebkitMaskImage: fadeMaskCss(),
          maskImage: fadeMaskCss(),
          // Without this the mask is sized to the padding box and the stops land
          // in the wrong place the moment the section has padding.
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Two sines at incommensurable periods, so the path does not visibly loop.
 *
 * Amplitudes are deliberately below the threshold where anyone can name the
 * movement — the effect wanted is "this surface is alive", not "something is
 * sliding". Anything larger reads as a layout bug.
 */
const DRIFT_CSS = `
@keyframes zn-backdrop-drift {
  0%   { transform: scale(1.000) translate3d(0,        0,       0); }
  25%  { transform: scale(1.010) translate3d(0.55%,   -0.40%,   0); }
  50%  { transform: scale(1.004) translate3d(-0.30%,   0.55%,   0); }
  75%  { transform: scale(1.012) translate3d(-0.50%,  -0.25%,   0); }
  100% { transform: scale(1.000) translate3d(0,        0,       0); }
}
.zn-backdrop-drift {
  animation: zn-backdrop-drift 29s ease-in-out infinite;
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .zn-backdrop-drift { animation: none; }
}
`;

/**
 * Where the dissolve finishes, as a percentage string.
 *
 * Exported so a caller can line a caption up with the ground rather than
 * guessing — put text below this and it sits on flat colour, above it and it
 * sits over the dissolve.
 */
export const FADE_ENDS_AT = `${(FADE.clear * 100).toFixed(1)}%`;
