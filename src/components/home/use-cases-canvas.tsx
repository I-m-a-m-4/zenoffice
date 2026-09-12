'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BarChart2,
  BookOpen,
  Coffee,
  Gem,
  Globe,
  Monitor,
  Package,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { T } from '@/components/i18n/t';
import { ZenMark } from '@/components/ai-insights/zen-mark';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

/**
 * The use-cases section of the landing page, as a workflow canvas.
 *
 * ## What it is
 *
 * The old version of this section was eight static image tiles under a heading.
 * It said "we support your trade" but showed nothing about *how*. This replaces
 * it with the thing the product actually is: a trade on the left, the five
 * surfaces on the right, and Zen AI in the middle with data moving through it.
 * Picking a trade re-routes the flow, so the diagram answers "what does Zeneva
 * do for a pharmacy" by drawing it.
 *
 * ## Why the geometry is measured rather than declared
 *
 * The edges are SVG beziers and the nodes are HTML — HTML because the labels are
 * translated (eleven catalogs, one of them RTL) and SVG `<text>` handles neither
 * bidi nor font fallback the way a `<div>` does.
 *
 * That split means the two coordinate systems have to agree. A fixed `viewBox`
 * plus percentage-positioned nodes agrees only at one aspect ratio: the moment
 * the container is shorter or wider than the `viewBox`, `preserveAspectRatio`
 * letterboxes the SVG and every edge detaches from its node. So the panel is
 * measured with a `ResizeObserver` and the layout is computed in **real pixels**
 * for that exact width — the SVG's `viewBox` is `0 0 w h` with no scaling at all,
 * and a node at `left: 320px` is met by an edge that genuinely ends at x=320.
 *
 * Two layouts come out of that: `wide` (source left, hub centre, surfaces in a
 * right-hand column) and `stacked` (source top, hub under it, surfaces as
 * full-width rows fed by a fan of curves). They are different node *positions*,
 * not different components.
 *
 * ## Why the motion is CSS keyframes and SMIL, and not a render loop
 *
 * Nothing here animates a React value per frame. Edge draw-in, the node wake
 * rings, the hub halo and the dwell bar are CSS keyframes on `transform`,
 * `opacity` and `stroke-dashoffset`; the travelling packets are SMIL
 * `<animateMotion>` following the same path string the edge is drawn with. Both
 * run off the main thread, and a section this far down the page must not cost a
 * frame callback while the visitor is reading something else.
 *
 * The trade-off is that SMIL ignores `prefers-reduced-motion` — same problem
 * `ZenMark` has with its sheen — so the packets are gated in JS on
 * `useReducedMotion()` while everything CSS-driven is switched off by the media
 * query at the bottom of `CANVAS_CSS`.
 *
 * ## i18n
 *
 * Every string here is an existing key. The trade names and blurbs are the
 * `landing.biz*` keys the old tiles used, the surface labels are the
 * `landing.node*` keys the "how it works" diagram uses, and the eyebrow is
 * `footer.linkUseCases`. Adding a key means editing eleven catalogs, so the
 * section was designed around the copy that is already translated.
 */

/**
 * n8n's palette, scoped to this section so none of it leaks into the light page.
 *
 * The HTML side reads these through `var()`. The SVG side does **not** — `var()`
 * in an SVG presentation attribute (`fill="var(--x)"`, `stroke="var(--x)"`) is
 * not resolved consistently across engines, and a wire that silently paints black
 * on one browser is not worth the DRY. `HEX` below repeats the four values the
 * canvas needs as literals; change both or neither.
 */
const TOKENS = {
  '--uc-canvas': '#0e0918',
  '--uc-paper': '#1a1624',
  '--uc-cloud': '#1f192a',
  '--uc-hairline': '#48556a',
  '--uc-ink': '#fefefe',
  '--uc-ink-soft': '#9d9797',
  '--uc-primary': '#ee4f27',
  '--uc-primary-bright': '#ff492c',
  '--uc-primary-deep': '#d94420',
  '--uc-glow': '#ea4b71',
} as React.CSSProperties;

/** Literal counterparts of the tokens the SVG paints with. See `TOKENS`. */
const HEX = {
  primary: '#ee4f27',
  primaryBright: '#ff492c',
  primaryDeep: '#d94420',
  hairline: '#48556a',
  /** Packet core: the primary, blown out towards white so it reads as hot. */
  packet: '#ffd9c9',
} as const;

/**
 * Unique-id source for the beam gradient.
 *
 * Same reason `ZenMark` keeps a module counter rather than calling `useId`: the
 * value is interpolated into `url(#...)`, and it has to be a plain NCName. It also
 * hydrates cleanly — the server and the client mount instances in the same order,
 * so the same instance gets the same number on both sides.
 */
let uidCounter = 0;

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

/**
 * The five product surfaces, in the order they appear in the right-hand column.
 * Same labels as the "how it works" diagram above, on purpose — a visitor who
 * scrolled past that one should recognise these as the same five things.
 */
const SURFACES = [
  { id: 'pos', labelKey: 'landing.nodePos', icon: Monitor },
  { id: 'inventory', labelKey: 'landing.nodeInventory', icon: Package },
  { id: 'storefront', labelKey: 'landing.nodeStorefront', icon: Globe },
  { id: 'crm', labelKey: 'landing.nodeCrm', icon: Users },
  { id: 'analytics', labelKey: 'landing.nodeAnalytics', icon: BarChart2 },
] as const;

type SurfaceId = (typeof SURFACES)[number]['id'];

type Trade = {
  /** English, for the image `alt` — the static export is crawled in English. */
  name: string;
  nameKey: string;
  descKey: string;
  imageId: string;
  icon: IconType;
  /**
   * The three surfaces the flow lights up for this trade. Every trade reaches
   * all five — the unlit two stay connected on their dim track. This is emphasis,
   * not a capability list.
   */
  lit: SurfaceId[];
};

const TRADES: Trade[] = [
  {
    name: 'Fashion & Clothing',
    nameKey: 'landing.biz1t',
    descKey: 'landing.biz1d',
    imageId: 'boutique-store',
    icon: Shirt,
    lit: ['inventory', 'pos', 'storefront'],
  },
  {
    name: 'Jewellery Store',
    nameKey: 'landing.biz2t',
    descKey: 'landing.biz2d',
    imageId: 'jewelry-store',
    icon: Gem,
    lit: ['inventory', 'crm', 'analytics'],
  },
  {
    name: 'Furniture Store',
    nameKey: 'landing.biz3t',
    descKey: 'landing.biz3d',
    imageId: 'furniture-store',
    icon: Sofa,
    lit: ['inventory', 'crm', 'pos'],
  },
  {
    name: 'Electronic Shop',
    nameKey: 'landing.biz4t',
    descKey: 'landing.biz4d',
    imageId: 'electronics-store',
    icon: Smartphone,
    lit: ['inventory', 'pos', 'analytics'],
  },
  {
    name: 'Cafe Shop',
    nameKey: 'landing.biz5t',
    descKey: 'landing.biz5d',
    imageId: 'cafe-shop',
    icon: Coffee,
    lit: ['pos', 'crm', 'analytics'],
  },
  {
    name: 'Book Store',
    nameKey: 'landing.biz6t',
    descKey: 'landing.biz6d',
    imageId: 'book-store',
    icon: BookOpen,
    lit: ['inventory', 'storefront', 'pos'],
  },
  {
    name: 'Skin Care',
    nameKey: 'landing.biz7t',
    descKey: 'landing.biz7d',
    imageId: 'skin-care',
    icon: Sparkles,
    lit: ['inventory', 'storefront', 'crm'],
  },
  {
    name: 'Restaurant',
    nameKey: 'landing.biz8t',
    descKey: 'landing.biz8d',
    imageId: 'restaurant',
    icon: UtensilsCrossed,
    lit: ['pos', 'inventory', 'analytics'],
  },
];

/** How long a trade holds the canvas before the flow moves on, in ms. */
const DWELL = 5200;

/** Below this panel width the canvas switches from `wide` to `stacked`. */
const WIDE_MIN = 760;

/* Node box sizes. The edges anchor to these, so they are measurements, not styling. */
const SRC_W = 180;
const SRC_H = 66;
const HUB = 108;
const NODE_W = 178;
const NODE_H = 54;
/** Gutter the stacked layout leaves either side of a full-width surface row. */
const STACK_GUTTER = 18;

type Pt = { x: number; y: number };

type Layout = {
  mode: 'wide' | 'stacked';
  w: number;
  h: number;
  source: Pt;
  hub: Pt;
  surfaces: Pt[];
  /** source -> hub */
  spine: string;
  /** hub -> surface, index-aligned with `surfaces` and `SURFACES` */
  edges: string[];
  /** Where each edge meets its node, for the port dots. */
  ports: Pt[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** n8n's link shape: a cubic whose control points leave each end horizontally. */
function hCurve(a: Pt, b: Pt): string {
  const dx = Math.max(44, Math.abs(b.x - a.x) * 0.55);
  return `M ${r1(a.x)} ${r1(a.y)} C ${r1(a.x + dx)} ${r1(a.y)}, ${r1(b.x - dx)} ${r1(b.y)}, ${r1(b.x)} ${r1(b.y)}`;
}

/** Leaves vertically, arrives horizontally — the stacked layout's fan. */
function fanCurve(a: Pt, b: Pt): string {
  const dy = Math.max(38, Math.abs(b.y - a.y) * 0.48);
  return `M ${r1(a.x)} ${r1(a.y)} C ${r1(a.x)} ${r1(a.y + dy)}, ${r1(b.x)} ${r1(b.y - dy)}, ${r1(b.x)} ${r1(b.y)}`;
}

function computeLayout(w: number): Layout {
  const count = SURFACES.length;

  if (w >= WIDE_MIN) {
    const h = 452;
    const source: Pt = { x: 12 + SRC_W / 2, y: h / 2 };
    const hub: Pt = { x: Math.round(w * 0.45), y: h / 2 };
    const colX = w - 12 - NODE_W / 2;
    const first = 44;
    const step = (h - first * 2) / (count - 1);
    const surfaces = SURFACES.map((_, i) => ({ x: colX, y: Math.round(first + step * i) }));
    const ports = surfaces.map((p) => ({ x: p.x - NODE_W / 2, y: p.y }));
    return {
      mode: 'wide',
      w,
      h,
      source,
      hub,
      surfaces,
      ports,
      spine: hCurve({ x: source.x + SRC_W / 2, y: source.y }, { x: hub.x - HUB / 2, y: hub.y }),
      edges: ports.map((p) => hCurve({ x: hub.x + HUB / 2, y: hub.y }, p)),
    };
  }

  const rowTop = 272;
  const rowStep = 52;
  const h = rowTop + rowStep * (count - 1) + NODE_H;
  const cx = Math.round(w / 2);
  const source: Pt = { x: cx, y: 14 + SRC_H / 2 };
  const hub: Pt = { x: cx, y: 168 };
  const surfaces = SURFACES.map((_, i) => ({ x: cx, y: rowTop + rowStep * i }));
  const ports = surfaces.map((p) => ({ x: STACK_GUTTER, y: p.y }));
  return {
    mode: 'stacked',
    w,
    h,
    source,
    hub,
    surfaces,
    ports,
    spine: fanCurve({ x: source.x, y: source.y + SRC_H / 2 }, { x: hub.x, y: hub.y - HUB / 2 }),
    edges: ports.map((p) => fanCurve({ x: hub.x, y: hub.y + HUB / 2 }, p)),
  };
}

/**
 * Tracks the panel's own width, not the viewport's.
 *
 * The viewport is the wrong thing to measure: this panel sits in a grid whose
 * left column is a 260px rail on desktop and gone on mobile, so the same
 * viewport width gives two different panel widths. `null` until the first
 * measurement, which is what suppresses the SVG on the server render.
 */
function useMeasuredWidth<E extends HTMLElement>() {
  const ref = React.useRef<E | null>(null);
  const [width, setWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Rounded: the layout is remounted when the width changes (SMIL restarts on
    // mount, not on attribute change), and a fractional bounding box would churn
    // the packets on every subpixel reflow.
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
    read();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

/**
 * True once the element has been on screen, and kept current afterwards.
 *
 * The dwell timer is gated on this so the flow is not cycling — and burning
 * compositor work on the packets — while the section is parked offscreen.
 * Without `IntersectionObserver` it reports `true`, because a browser that old
 * should get a working carousel rather than a frozen one.
 */
function useInView<E extends HTMLElement>(threshold = 0.2) {
  const ref = React.useRef<E | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/** Fires once, and stays fired — the card grid's reveal must not re-run on scroll-back. */
function useRevealed<E extends HTMLElement>() {
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
        if (entry.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, revealed };
}

/**
 * One lit dot travelling an edge, plus the bloom that sells it as light.
 *
 * `animateMotion` takes the same `d` the visible edge is stroked with, so the
 * packet cannot drift off the wire even mid-resize. Opacity is animated
 * separately so it arrives and leaves rather than popping at the ports.
 *
 * The two element descriptions are declared once and rendered into both circles.
 * React elements are immutable descriptions, not DOM nodes, so reusing one in two
 * places produces two independent animations — no `cloneElement` needed.
 */
function Packet({ d, dur, begin }: { d: string; dur: number; begin: number }) {
  const motion = (
    <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={d} />
  );
  const fade = (
    <animate
      attributeName="opacity"
      values="0;1;1;0"
      keyTimes="0;0.12;0.85;1"
      dur={`${dur}s`}
      begin={`${begin}s`}
      repeatCount="indefinite"
    />
  );

  return (
    <>
      <circle r={8} fill={HEX.primary} opacity={0} style={{ filter: 'blur(5px)' }}>
        {motion}
        {fade}
      </circle>
      <circle r={3} fill={HEX.packet} opacity={0}>
        {motion}
        {fade}
      </circle>
    </>
  );
}

export function UseCasesCanvas() {
  const reduce = useReducedMotion() ?? false;

  const [active, setActive] = React.useState(0);
  /** An explicit pick ends the auto-cycle for good; hover only pauses it. */
  const [pinned, setPinned] = React.useState(false);
  const [paused, setPaused] = React.useState(false);

  const section = useInView<HTMLElement>(0.15);
  const panel = useMeasuredWidth<HTMLDivElement>();
  const grid = useRevealed<HTMLDivElement>();

  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const uid = React.useMemo(() => `uc${++uidCounter}`, []);

  const trade = TRADES[active];
  const layout = React.useMemo(
    () => (panel.width ? computeLayout(panel.width) : null),
    [panel.width],
  );

  // Auto-advance. One timeout per step rather than an interval, so a pause that
  // lands mid-dwell restarts the full dwell instead of firing immediately.
  React.useEffect(() => {
    if (reduce || pinned || paused || !section.inView) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % TRADES.length), DWELL);
    return () => window.clearTimeout(t);
  }, [active, reduce, pinned, paused, section.inView]);

  const select = React.useCallback((index: number, focus = false) => {
    const next = (index + TRADES.length) % TRADES.length;
    setActive(next);
    setPinned(true);
    if (focus) tabRefs.current[next]?.focus();
  }, []);

  /**
   * Hover pauses the cycle — but only a real pointer.
   *
   * A touch tap fires `pointerenter` and frequently never fires the matching
   * `pointerleave`, which would leave the carousel paused for the rest of the
   * visit with no way to resume it. Touch visitors keep the cycle and drive it by
   * tapping the rail instead.
   */
  const onHoverStart = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse') setPaused(true);
  };
  const onHoverEnd = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse') setPaused(false);
  };

  const onRailKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    // The rail is vertical on desktop and a horizontal scroller on mobile, so
    // both axes are bound rather than guessing which one the visitor sees.
    if (key === 'ArrowDown' || key === 'ArrowRight') {
      event.preventDefault();
      select(active + 1, true);
    } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
      event.preventDefault();
      select(active - 1, true);
    } else if (key === 'Home') {
      event.preventDefault();
      select(0, true);
    } else if (key === 'End') {
      event.preventDefault();
      select(TRADES.length - 1, true);
    }
  };

  /**
   * Remount key for everything that has to restart when the flow re-routes.
   * SMIL restarts on mount, not on attribute change, so switching trade has to
   * replace the packet nodes; the beam draw-in is keyed with them so the wire
   * and the thing travelling it begin together.
   */
  const flowKey = layout ? `${layout.mode}-${layout.w}-${active}` : 'idle';

  const litIndexes = React.useMemo(
    () => SURFACES.map((s, i) => (trade.lit.includes(s.id) ? i : -1)).filter((i) => i >= 0),
    [trade],
  );

  return (
    <section
      id="business-types"
      ref={section.ref}
      style={TOKENS}
      className="uc-root relative isolate overflow-hidden bg-[var(--uc-canvas)] px-6 py-24"
    >
      <style>{CANVAS_CSS}</style>

      {/* Ground: engineering grid, two drifting blooms, and a lit top edge so the
          section reads as deliberate rather than as a colour accident between two
          light ones. All decorative, all behind everything. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(72,85,106,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(72,85,106,0.35) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, #000 30%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 90% 70% at 50% 40%, #000 30%, transparent 100%)',
          }}
        />
        <div
          className="uc-drift-a absolute -top-40 left-[8%] h-[520px] w-[520px] rounded-full opacity-40 blur-[130px]"
          style={{ background: 'radial-gradient(circle, var(--uc-primary), transparent 68%)' }}
        />
        <div
          className="uc-drift-b absolute -bottom-48 right-[4%] h-[560px] w-[560px] rounded-full opacity-30 blur-[140px]"
          style={{ background: 'radial-gradient(circle, var(--uc-glow), transparent 70%)' }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--uc-primary)]/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--uc-hairline)]/60 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--uc-hairline)] bg-[var(--uc-cloud)] px-3 py-1 text-xs text-[var(--uc-ink-soft)]">
            <span className="uc-blink h-1.5 w-1.5 rounded-full bg-[var(--uc-primary)]" />
            <T k="footer.linkUseCases" />
          </span>
          <h2 className="mt-6 font-bricolage text-4xl font-semibold leading-[1.12] tracking-tight text-[var(--uc-ink)] md:text-5xl">
            <T k="landing.bizHeading" />
          </h2>
          <p className="mx-auto mt-5 max-w-2xl font-dm-sans text-base leading-[1.7] text-[var(--uc-ink-soft)] md:text-lg">
            <T k="landing.bizSub" />
          </p>
        </div>

        {/* Rail + canvas */}
        <div
          className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8"
          onPointerEnter={onHoverStart}
          onPointerLeave={onHoverEnd}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          {/* Trade rail. A tablist: the panel beside it is the tab's content, and
              roving tabindex means one Tab stop for eight trades. */}
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="Business types"
            onKeyDown={onRailKeyDown}
            className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {TRADES.map((t, i) => {
              const isActive = i === active;
              return (
                <button
                  key={t.nameKey}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${i}`}
                  aria-selected={isActive}
                  aria-controls={`${uid}-panel`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => select(i)}
                  className={cn(
                    'group relative flex shrink-0 snap-start cursor-pointer items-center gap-3 overflow-hidden rounded-lg border px-4 text-start transition-colors duration-300 lg:w-full lg:shrink',
                    'min-h-[52px] py-3',
                    isActive
                      ? 'border-[var(--uc-primary)]/55 bg-[var(--uc-cloud)] text-[var(--uc-ink)]'
                      : 'border-[var(--uc-hairline)]/70 bg-[var(--uc-paper)] text-[var(--uc-ink-soft)] hover:bg-[var(--uc-cloud)] hover:text-[var(--uc-ink)]',
                  )}
                >
                  <t.icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-colors duration-300',
                      isActive ? 'text-[var(--uc-primary)]' : 'text-[var(--uc-ink-soft)]',
                    )}
                    strokeWidth={1.75}
                  />
                  <span className="whitespace-nowrap font-bricolage text-sm font-semibold lg:whitespace-normal">
                    <T k={t.nameKey} />
                  </span>

                  {/* Dwell bar — also the only affordance that says the thing is
                      moving on its own. Keyed on `active` so it restarts, and
                      frozen rather than hidden while paused. */}
                  {isActive && !reduce && !pinned && (
                    <span
                      key={active}
                      className="uc-progress absolute bottom-0 left-0 h-[2px] w-full origin-left bg-[var(--uc-primary)]"
                      style={{
                        animationDuration: `${DWELL}ms`,
                        animationPlayState: paused || !section.inView ? 'paused' : 'running',
                      }}
                    />
                  )}
                  {isActive && (reduce || pinned) && (
                    <span className="absolute bottom-0 left-0 h-[2px] w-full bg-[var(--uc-primary)]/70" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Flow panel */}
          <div
            id={`${uid}-panel`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-${active}`}
            className="overflow-hidden rounded-2xl border border-[var(--uc-hairline)] bg-[var(--uc-paper)] shadow-[inset_0_4px_12px_rgba(255,255,255,0.05),0_4px_16px_-8px_rgba(0,0,0,0.23)]"
          >
            {/* Chrome. The mono path is the label that makes the panel read as a
                canvas rather than a picture of one. */}
            <div className="flex items-center gap-3 border-b border-[var(--uc-hairline)]/70 bg-[var(--uc-cloud)] px-4 py-3">
              <span className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--uc-hairline)]" />
                <span className="h-2 w-2 rounded-full bg-[var(--uc-hairline)]" />
                <span className="h-2 w-2 rounded-full bg-[var(--uc-primary)]/80" />
              </span>
              <span className="truncate font-code text-[11px] tracking-tight text-[var(--uc-ink-soft)]">
                zeneva.flow / <span className="text-[var(--uc-ink)]"><T k={trade.nameKey} /></span>
              </span>
              <span className="ms-auto hidden items-center gap-1.5 font-code text-[10px] uppercase tracking-[0.08em] text-[var(--uc-ink-soft)] sm:flex">
                <span className="uc-blink h-1.5 w-1.5 rounded-full bg-[var(--uc-primary)]" />
                live
              </span>
            </div>

            {/* The canvas itself. `height` comes from the computed layout, so the
                box and the SVG are the same size by construction. */}
            <div
              ref={panel.ref}
              className="relative w-full"
              style={{ height: layout ? layout.h : 452 }}
            >
              {layout && (
                <>
                  <svg
                    aria-hidden
                    className="absolute inset-0"
                    width={layout.w}
                    height={layout.h}
                    viewBox={`0 0 ${layout.w} ${layout.h}`}
                    fill="none"
                  >
                    <defs>
                      <linearGradient
                        id={`${uid}-beam`}
                        gradientUnits="userSpaceOnUse"
                        x1={0}
                        y1={0}
                        x2={layout.w}
                        y2={layout.h}
                      >
                        <stop offset="0%" stopColor={HEX.primaryDeep} />
                        <stop offset="55%" stopColor={HEX.primary} />
                        <stop offset="100%" stopColor={HEX.primaryBright} />
                      </linearGradient>
                    </defs>

                    {/* Tracks. Every wire, always, dim — the unlit surfaces are
                        still wired up and the diagram should not imply otherwise.
                        Negative delays desynchronise the marching dots so the
                        bundle does not pulse as one. */}
                    <g stroke={HEX.hairline} strokeWidth={1.25} strokeLinecap="round">
                      <path d={layout.spine} className="uc-track" strokeDasharray="2 8" />
                      {layout.edges.map((d, i) => (
                        <path
                          key={`track-${i}`}
                          d={d}
                          className="uc-track"
                          strokeDasharray="2 8"
                          style={{ animationDelay: `${(i * -0.9).toFixed(1)}s` }}
                        />
                      ))}
                    </g>

                    {/* Beams. Drawn with `pathLength=1` so one dash length works
                        for every curve regardless of its real arc length. */}
                    <g key={`beam-${flowKey}`} className="uc-beams">
                      <path
                        d={layout.spine}
                        className="uc-beam"
                        pathLength={1}
                        stroke={`url(#${uid}-beam)`}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                      {litIndexes.map((edgeIndex, order) => (
                        <path
                          key={`beam-${edgeIndex}`}
                          d={layout.edges[edgeIndex]}
                          className="uc-beam"
                          pathLength={1}
                          stroke={`url(#${uid}-beam)`}
                          strokeWidth={2}
                          strokeLinecap="round"
                          style={{ animationDelay: `${180 + order * 130}ms` }}
                        />
                      ))}
                    </g>

                    {/* Ports */}
                    <g>
                      {layout.ports.map((p, i) => (
                        <circle
                          key={`port-${i}`}
                          cx={p.x}
                          cy={p.y}
                          r={3.5}
                          className="transition-[fill] duration-300"
                          fill={litIndexes.includes(i) ? HEX.primary : HEX.hairline}
                        />
                      ))}
                    </g>

                    {!reduce && (
                      <g key={`packets-${flowKey}`}>
                        <Packet d={layout.spine} dur={2.4} begin={0} />
                        <Packet d={layout.spine} dur={2.4} begin={1.2} />
                        {litIndexes.map((edgeIndex, order) => (
                          <Packet
                            key={`packet-${edgeIndex}`}
                            d={layout.edges[edgeIndex]}
                            dur={2.6}
                            begin={0.5 + order * 0.42}
                          />
                        ))}
                      </g>
                    )}
                  </svg>

                  {/* Source node */}
                  <FlowNode
                    x={layout.source.x}
                    y={layout.source.y}
                    width={SRC_W}
                    height={SRC_H}
                    className="border-[var(--uc-primary)]/55 bg-[var(--uc-cloud)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--uc-primary)]/12 text-[var(--uc-primary)]">
                      <trade.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-code text-[9px] uppercase tracking-[0.1em] text-[var(--uc-ink-soft)]">
                        <T k="footer.linkUseCases" />
                      </span>
                      <span className="block truncate font-bricolage text-[13px] font-semibold text-[var(--uc-ink)]">
                        <T k={trade.nameKey} />
                      </span>
                    </span>
                    <WakeRing key={`wake-src-${active}`} reduce={reduce} />
                  </FlowNode>

                  {/* Hub */}
                  <div
                    className="absolute"
                    style={{
                      left: layout.hub.x,
                      top: layout.hub.y,
                      width: HUB,
                      height: HUB,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="uc-halo absolute -inset-3 rounded-[32px] opacity-60 blur-xl" />
                    <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-3xl border border-[var(--uc-primary)]/60 bg-[var(--uc-cloud)] shadow-[0_0_40px_-12px_rgba(238,79,39,0.55)]">
                      <span className="uc-spin absolute inset-[-1px] rounded-3xl opacity-70" />
                      <span className="relative h-9 w-9">
                        <ZenMark className="h-full w-full" animated={!reduce} />
                      </span>
                      <span className="relative font-bricolage text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--uc-ink)]">
                        Zen AI
                      </span>
                      <WakeRing key={`wake-hub-${active}`} reduce={reduce} rounded="rounded-3xl" />
                    </div>
                  </div>

                  {/* Surfaces */}
                  {SURFACES.map((surface, i) => {
                    const lit = litIndexes.includes(i);
                    const p = layout.surfaces[i];
                    const order = litIndexes.indexOf(i);
                    return (
                      <FlowNode
                        key={surface.id}
                        x={p.x}
                        y={p.y}
                        width={layout.mode === 'wide' ? NODE_W : layout.w - STACK_GUTTER * 2}
                        height={NODE_H}
                        className={cn(
                          'transition-colors duration-500',
                          lit
                            ? 'border-[var(--uc-primary)]/50 bg-[var(--uc-cloud)]'
                            : 'border-[var(--uc-hairline)]/60 bg-[var(--uc-paper)]',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-500',
                            lit
                              ? 'bg-[var(--uc-primary)]/12 text-[var(--uc-primary)]'
                              : 'bg-[var(--uc-hairline)]/15 text-[var(--uc-ink-soft)]',
                          )}
                        >
                          <surface.icon className="h-4 w-4" strokeWidth={1.9} />
                        </span>
                        <span
                          className={cn(
                            'truncate font-bricolage text-[13px] font-semibold transition-colors duration-500',
                            lit ? 'text-[var(--uc-ink)]' : 'text-[var(--uc-ink-soft)]',
                          )}
                        >
                          <T k={surface.labelKey} />
                        </span>

                        {/* Readout. The analytics node gets the equaliser because
                            it is the one whose job is a moving number; the rest
                            get a state dot. No figures — a fabricated metric on a
                            marketing page is a claim, and this is a diagram. */}
                        <span className="ms-auto flex shrink-0 items-center">
                          {surface.id === 'analytics' ? (
                            <Equaliser lit={lit} reduce={reduce} />
                          ) : (
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full transition-colors duration-500',
                                lit ? 'uc-blink bg-[var(--uc-primary)]' : 'bg-[var(--uc-hairline)]',
                              )}
                            />
                          )}
                        </span>

                        {lit && (
                          <WakeRing
                            key={`wake-${surface.id}-${active}`}
                            reduce={reduce}
                            delay={200 + order * 130}
                          />
                        )}
                      </FlowNode>
                    );
                  })}
                </>
              )}
            </div>

            {/* Panel footer: the trade's own blurb, plus what the hub contributes. */}
            <div className="border-t border-[var(--uc-hairline)]/70 bg-[var(--uc-cloud)]/60 px-5 py-5">
              <p
                key={`desc-${active}`}
                className="uc-swap font-dm-sans text-sm leading-[1.7] text-[var(--uc-ink-soft)]"
              >
                <T k={trade.descKey} />
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['landing.chipForecasting', 'landing.chipInsights', 'landing.chipUnifiedData'].map(
                  (k) => (
                    <span
                      key={k}
                      className="rounded-full border border-[var(--uc-hairline)] bg-[var(--uc-cloud)] px-3 py-1 font-dm-sans text-xs text-[var(--uc-ink-soft)]"
                    >
                      <T k={k} />
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card grid. Hovering a card drives the canvas above it, so the two halves
            of the section are one control rather than two lists of the same eight
            trades. */}
        <div
          ref={grid.ref}
          className={cn(
            'mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4',
            grid.revealed && 'uc-in',
          )}
        >
          {TRADES.map((t, i) => {
            const image = PlaceHolderImages.find((p) => p.id === t.imageId);
            if (!image) return null;
            const isActive = i === active;
            return (
              <Link
                key={t.name}
                href="/use-cases"
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'mouse') return;
                  setActive(i);
                  setPaused(true);
                }}
                onPointerLeave={onHoverEnd}
                onFocus={() => {
                  setActive(i);
                  setPaused(true);
                }}
                onBlur={() => setPaused(false)}
                style={{ '--i': i } as React.CSSProperties}
                className={cn(
                  'uc-card group relative block aspect-[4/5] cursor-pointer overflow-hidden rounded-2xl border bg-[var(--uc-paper)] transition-colors duration-300',
                  isActive
                    ? 'border-[var(--uc-primary)]/60'
                    : 'border-[var(--uc-hairline)]/70 hover:border-[var(--uc-primary)]/50',
                )}
              >
                <Image
                  src={image.imageUrl}
                  alt={t.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className={cn(
                    'object-cover transition-all duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-[1.07]',
                    isActive ? 'opacity-90 saturate-100' : 'opacity-60 saturate-[0.7]',
                    'group-hover:opacity-95 group-hover:saturate-100',
                  )}
                  data-ai-hint={image.imageHint}
                />

                {/* Ground the type sits on. Two layers: a wash that keeps the
                    canvas colour in the image, and a bottom ramp for contrast. */}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[var(--uc-canvas)]/45 mix-blend-multiply"
                />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-[var(--uc-canvas)] via-[var(--uc-canvas)]/70 to-transparent"
                />

                {/* Scan sweep — the one flourish that only exists on hover. */}
                <span
                  aria-hidden
                  className="uc-scanline absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-[var(--uc-primary)]/25 to-transparent"
                />

                {/* Corner brackets, drawn on the hairline and lit on hover. */}
                <span
                  aria-hidden
                  className="absolute start-3 top-3 h-4 w-4 border-s-2 border-t-2 border-[var(--uc-hairline)] transition-colors duration-300 group-hover:border-[var(--uc-primary)]"
                />
                <span
                  aria-hidden
                  className="absolute bottom-3 end-3 h-4 w-4 border-b-2 border-e-2 border-[var(--uc-hairline)] transition-colors duration-300 group-hover:border-[var(--uc-primary)]"
                />

                <span className="absolute inset-x-0 bottom-0 p-5">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--uc-hairline)] bg-[var(--uc-cloud)]/80 text-[var(--uc-primary)] backdrop-blur-sm">
                    <t.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  <span className="block font-bricolage text-lg font-semibold leading-tight text-[var(--uc-ink)]">
                    <T k={t.nameKey} />
                  </span>
                  <span className="mt-1 block font-dm-sans text-[13px] leading-[1.6] text-[var(--uc-ink-soft)]">
                    <T k={t.descKey} />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-14 flex justify-center">
          <Link
            href="/use-cases"
            className="group inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-[var(--uc-primary)] px-8 py-[15px] font-bricolage text-sm font-bold uppercase tracking-[0.4px] text-white transition-colors duration-300 hover:bg-[var(--uc-primary-bright)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_0_0_rgba(255,142,93,0.3)]"
          >
            <T k="landing.exploreUseCases" />
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * A node box, positioned by its centre so the SVG can aim at the same point.
 *
 * `left`/`top` are physical rather than logical on purpose: the diagram's
 * geometry is computed in one coordinate system and must not mirror under RTL,
 * or the edges would arrive at the far side of every node. The text inside is
 * ordinary flow content and still lays out RTL correctly.
 */
function FlowNode({
  x,
  y,
  width,
  height,
  className,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'absolute flex items-center gap-3 rounded-xl border px-3 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.6)]',
        className,
      )}
      style={{ left: x, top: y, width, height, transform: 'translate(-50%, -50%)' }}
    >
      {children}
    </div>
  );
}

/** The expanding ring a node throws when the flow reaches it. */
function WakeRing({
  reduce,
  delay = 0,
  rounded = 'rounded-xl',
}: {
  reduce: boolean;
  delay?: number;
  rounded?: string;
}) {
  if (reduce) return null;
  return (
    <span
      aria-hidden
      className={cn('uc-ring pointer-events-none absolute inset-0 border border-[var(--uc-primary)]', rounded)}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

/** Five bars at unrelated periods, so the readout never visibly loops. */
const EQ_BARS = [0.92, 1.31, 1.07, 1.49, 1.19];

function Equaliser({ lit, reduce }: { lit: boolean; reduce: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[2px]">
      {EQ_BARS.map((dur, i) => (
        <span
          key={i}
          className={cn(
            'w-[2px] origin-bottom rounded-sm transition-colors duration-500',
            lit ? 'bg-[var(--uc-primary)]' : 'bg-[var(--uc-hairline)]',
            lit && !reduce && 'uc-eq',
          )}
          style={{
            height: `${8 + i * 2}px`,
            animationDuration: `${dur}s`,
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Every keyframe in the section.
 *
 * Kept in one string next to the component rather than in `globals.css` because
 * nothing else uses any of it, and a keyframe in the global sheet outlives the
 * component that needed it. Reduced motion is handled at the bottom, once:
 * animations that *reveal* something are switched off by pinning the property to
 * its end state, not by `animation: none` — a beam with `animation: none` keeps
 * `stroke-dashoffset: 1` and is simply invisible.
 */
const CANVAS_CSS = `
@keyframes uc-beam-draw {
  from { stroke-dashoffset: 1; opacity: 0.2; }
  to   { stroke-dashoffset: 0; opacity: 1; }
}
@keyframes uc-track-march { to { stroke-dashoffset: -40; } }
@keyframes uc-ring-out {
  0%   { transform: scale(0.86); opacity: 0.7; }
  70%  { opacity: 0; }
  100% { transform: scale(1.16); opacity: 0; }
}
@keyframes uc-halo-breathe {
  0%, 100% { opacity: 0.35; transform: scale(0.97); }
  50%      { opacity: 0.7;  transform: scale(1.04); }
}
@keyframes uc-eq-bounce {
  0%, 100% { transform: scaleY(0.3); }
  50%      { transform: scaleY(1); }
}
@keyframes uc-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes uc-blink-dot { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
@keyframes uc-scan-sweep {
  0%   { transform: translateY(-100%); opacity: 0; }
  25%  { opacity: 1; }
  100% { transform: translateY(560%); opacity: 0; }
}
@keyframes uc-swap-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}
/* Declared here rather than leaning on Tailwind's own "spin": that keyframe is
   only emitted when an animate-spin utility is generated somewhere in the
   project, which makes it an invisible dependency on unrelated code. */
@keyframes uc-rim-spin { to { transform: rotate(360deg); } }
/* Two sines at unrelated periods — the bloom should read as "alive", never as
   "sliding". Same reasoning as the recorder backdrop's drift. */
@keyframes uc-bloom-a {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  33%      { transform: translate3d(6%, 4%, 0) scale(1.08); }
  66%      { transform: translate3d(-4%, 7%, 0) scale(0.96); }
}
@keyframes uc-bloom-b {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  40%      { transform: translate3d(-7%, -5%, 0) scale(1.06); }
  75%      { transform: translate3d(5%, -3%, 0) scale(0.94); }
}

.uc-root .uc-track {
  stroke-dasharray: 2 8;
  animation: uc-track-march 3.2s linear infinite;
}
.uc-root .uc-beam {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: uc-beam-draw 900ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
.uc-root .uc-beams { filter: drop-shadow(0 0 6px rgba(238, 79, 39, 0.5)); }
.uc-root .uc-ring { animation: uc-ring-out 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
.uc-root .uc-halo {
  background: radial-gradient(circle, rgba(238, 79, 39, 0.55), transparent 70%);
  animation: uc-halo-breathe 5.5s ease-in-out infinite;
}
/* The hub's rotating rim. A conic gradient masked to a 1px inset ring, so what
   travels is a highlight around the border and not a spinning square. */
.uc-root .uc-spin {
  background: conic-gradient(from 0deg, transparent 0deg, rgba(238, 79, 39, 0.85) 40deg, transparent 110deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  padding: 1px;
  animation: uc-rim-spin 6s linear infinite;
}
.uc-root .uc-eq { animation: uc-eq-bounce 1.2s ease-in-out infinite; }
.uc-root .uc-progress { animation: uc-fill linear forwards; }
.uc-root .uc-blink { animation: uc-blink-dot 2s ease-in-out infinite; }
.uc-root .uc-swap { animation: uc-swap-in 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
.uc-root .uc-drift-a { animation: uc-bloom-a 31s ease-in-out infinite; will-change: transform; }
.uc-root .uc-drift-b { animation: uc-bloom-b 43s ease-in-out infinite; will-change: transform; }

.uc-root .uc-scanline { opacity: 0; }
.uc-root .group:hover .uc-scanline { animation: uc-scan-sweep 1.5s cubic-bezier(0.4, 0, 0.2, 1); }

/* Card reveal. A transition rather than a keyframe so the delay only applies on
   the way in and a card cannot be caught mid-animation by a re-render. */
.uc-root .uc-card {
  opacity: 0;
  transform: translateY(26px) scale(0.985);
  transition: opacity 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
              transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
              border-color 300ms cubic-bezier(0.4, 0, 0.2, 1);
  transition-delay: calc(var(--i, 0) * 70ms), calc(var(--i, 0) * 70ms), 0ms;
}
.uc-root .uc-in .uc-card { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .uc-root .uc-track,
  .uc-root .uc-halo,
  .uc-root .uc-spin,
  .uc-root .uc-eq,
  .uc-root .uc-blink,
  .uc-root .uc-drift-a,
  .uc-root .uc-drift-b { animation: none; }
  .uc-root .uc-beam { animation: none; stroke-dashoffset: 0; }
  .uc-root .uc-progress { animation: none; transform: scaleX(1); }
  .uc-root .uc-swap { animation: none; }
  .uc-root .uc-scanline,
  .uc-root .group:hover .uc-scanline { animation: none; opacity: 0; }
  .uc-root .uc-card { opacity: 1; transform: none; transition: none; }
  .uc-root .uc-blink { opacity: 1; }
}
`;
