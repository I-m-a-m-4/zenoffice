'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Scroll-reveal and visibility helpers for the use-cases page.
 *
 * Both are `IntersectionObserver`, and both fall back to "visible" when the API is
 * missing. That direction matters: a browser too old for `IntersectionObserver`
 * should get a plain, fully-rendered page, never one stuck at `opacity: 0`. A
 * reveal animation that fails closed hides the content it was decorating.
 */

/** Fires once and stays fired — a reveal must not replay on scroll-back. */
export function useRevealed<E extends HTMLElement>(threshold = 0.12) {
  const ref = React.useRef<E | null>(null);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        // `top < 0` catches the case the plain intersecting check misses: the
        // element is already *above* the viewport when the observer attaches, so
        // it will never enter view and would stay at opacity 0 for good. That is
        // reachable — a deep link to #flow, a restored scroll position, or the
        // back button all land mid-page.
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, revealed };
}

/**
 * Live visibility, kept current in both directions.
 *
 * The flow canvas gates its dwell timer on this so it is not cycling — and not
 * paying for the packets' compositor work — while parked offscreen.
 */
export function useInView<E extends HTMLElement>(threshold = 0.15) {
  const ref = React.useRef<E | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/**
 * Wraps a block so its `.uc-rise` descendants animate in when it scrolls into
 * view. Children carry their own `--i` stagger index; see `CANVAS_CSS`.
 *
 * `Tag` is widened to `ElementType` before use. Left as the literal union, TS
 * resolves the `ref` prop to the *intersection* of the three elements' ref types —
 * a ref that is simultaneously a div, a ul and an HTMLElement, which nothing can
 * satisfy. Widening moves the check to the call site, where `as` is a single known
 * value anyway.
 */
export function Reveal({
  children,
  className,
  as = 'div',
  threshold,
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'ul';
  threshold?: number;
}) {
  const { ref, revealed } = useRevealed<HTMLElement>(threshold);
  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={cn(className, revealed && 'uc-shown')}>
      {children}
    </Tag>
  );
}

/** Per-child stagger index, as a style object. */
export function stagger(i: number): React.CSSProperties {
  return { '--i': i } as React.CSSProperties;
}
