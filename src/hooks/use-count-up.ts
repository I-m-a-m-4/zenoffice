'use client';

/**
 * Count a number up to its value once, on mount.
 *
 * Used by the rating hero and the insight card. Shared rather than duplicated so
 * the score and the money figure beside it settle on the same curve — two
 * count-ups at different speeds on one screen read as a glitch.
 *
 * Held to ~900ms by default and eased out (`easeOutCubic`): long enough to be seen,
 * short enough that it never reads as a loading state. `enabled: false` skips
 * straight to the value, which is how callers honour `useReducedMotion`.
 *
 * Re-targets rather than restarting: if the value changes mid-flight (the rating
 * recomputes when a sale lands) it counts on from where it is, so the figure never
 * snaps back to zero in front of the owner.
 */

import * as React from 'react';

export function useCountUp(value: number, enabled: boolean, duration = 900): number {
  const [shown, setShown] = React.useState(enabled ? 0 : value);
  // The value it was showing when this run began, so a mid-flight change counts on
  // from there instead of from zero.
  const fromRef = React.useRef(0);

  React.useEffect(() => {
    if (!enabled) {
      setShown(value);
      return;
    }
    const from = fromRef.current;
    if (from === value) return;

    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (value - from) * eased;
      fromRef.current = next;
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, enabled, duration]);

  return shown;
}
