'use client';

import * as React from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { HEX } from './canvas-theme';
import { useInView } from './reveal';
import { ZenMark } from '@/components/ai-insights/zen-mark';

/**
 * The trade-flow canvas: a trade on the left, Zen AI in the middle, and the
 * capabilities that answer that trade's bottleneck on the right, with data
 * visibly moving through it.
 *
 * ## Why the geometry is measured rather than declared
 *
 * The edges are SVG beziers and the nodes are HTML. HTML because the labels are
 * real prose of varying length that has to wrap, clamp and stay selectable — SVG
 * `<text>` does none of that — and because a node is a `<button>` here, not a
 * decoration.
 *
 * That split means the two coordinate systems have to agree. A fixed `viewBox`
 * plus percentage-positioned nodes agrees at exactly one aspect ratio: the moment
 * the container is shorter or wider than the `viewBox`, `preserveAspectRatio`
 * letterboxes the SVG and every edge detaches from the node it was drawn to. So
 * the panel is measured with a `ResizeObserver` and the layout is computed in
 * **real pixels** for that exact width — the `viewBox` is `0 0 w h` with no
 * scaling at all, and a node whose centre sits at `left: 320px` is met by an edge
 * that genuinely ends at x=320.
 *
 * Two layouts come out of that: `wide` (source left, hub centre, nodes in a
 * right-hand column) and `stacked` (source top, hub under it, nodes as full-width
 * rows fed by a fan of curves). They are different node *positions*, not
 * different components.
 *
 * ## Why the motion is CSS keyframes and SMIL
 *
 * Nothing here animates a React value per frame. Edge draw-in, the wake rings,
 * the hub's rim and halo and the dwell bar are CSS keyframes on `transform`,
 * `opacity` and `stroke-dashoffset`; the travelling packets are SMIL
 * `<animateMotion>` following the exact path string the edge is stroked with, so
 * a packet cannot drift off its wire even mid-resize.
 *
 * The trade-off is that SMIL ignores `prefers-reduced-motion`, so the packets are
 * gated in JS while everything CSS-driven is switched off by the media query in
 * `CANVAS_CSS`.
 */

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

export type FlowNodeSpec = {
  id: string;
  /** Short enough to sit in a node box — two lines at most. */
  label: string;
  /** The prose revealed in the panel footer when this node is picked. */
  detail: string;
  /**
   * What sits in the node's badge. An `icon` when the node has a real one;
   * otherwise `badge` — a mono index like "01".
   *
   * The capability nodes deliberately use indices rather than icons: the page's
   * data has no icon per capability, and inventing one per row would assign each
   * capability a meaning the copy never claimed. A node index is honest, and it is
   * what a workflow canvas would show anyway.
   */
  badge?: string;
  icon?: IconType;
  /** `offline` nodes read as a different kind of guarantee, so they are tinted. */
  tone?: 'capability' | 'offline';
};

export type FlowSource = {
  label: string;
  /** Sector, trade group — whatever the small line above the name should say. */
  meta: string;
  icon: IconType;
};

/* Node box sizes. The edges anchor to these, so they are measurements, not styling. */
const SRC_W = 208;
const SRC_H = 72;
const HUB = 108;
const NODE_W = 240;
const NODE_H = 64;
/** Gutter the stacked layout leaves either side of a full-width row. */
const GUTTER = 16;
/** Below this panel width the canvas switches from `wide` to `stacked`. */
const WIDE_MIN = 780;

type Pt = { x: number; y: number };

type Layout = {
  mode: 'wide' | 'stacked';
  w: number;
  h: number;
  nodeW: number;
  nodeH: number;
  source: Pt;
  hub: Pt;
  nodes: Pt[];
  /** Where each edge meets its node — the port dots. */
  ports: Pt[];
  /** source -> hub */
  spine: string;
  /** hub -> node, index-aligned with `nodes` */
  edges: string[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** n8n's link shape: a cubic whose control points leave each end horizontally. */
function hCurve(a: Pt, b: Pt): string {
  const dx = Math.max(44, Math.abs(b.x - a.x) * 0.55);
  return `M ${r1(a.x)} ${r1(a.y)} C ${r1(a.x + dx)} ${r1(a.y)}, ${r1(b.x - dx)} ${r1(b.y)}, ${r1(b.x)} ${r1(b.y)}`;
}

/** Leaves vertically, arrives horizontally — the source-to-hub drop when stacked. */
function fanCurve(a: Pt, b: Pt): string {
  const dy = Math.max(36, Math.abs(b.y - a.y) * 0.48);
  return `M ${r1(a.x)} ${r1(a.y)} C ${r1(a.x)} ${r1(a.y + dy)}, ${r1(b.x)} ${r1(b.y - dy)}, ${r1(b.x)} ${r1(b.y)}`;
}

/**
 * The stacked layout's hub-to-node edge: down out of the hub, into a private
 * vertical channel to the left of the cards, then a turn right into the port.
 *
 * A single cubic straight from hub to port — which is what this was — draws a
 * diagonal across every card between the two. The SVG sits *under* the HTML nodes,
 * so the wire is hidden wherever a card covers it and all the reader gets is a
 * disconnected diagonal stub in each gap between rows. Routing round the outside
 * keeps each wire visible end to end.
 *
 * `busX` is assigned right-to-left as the node index grows, and that is what makes
 * the diagram cross-free rather than merely tidy: a channel stops at its own row,
 * so a horizontal tap only ever passes channels belonging to *lower* nodes — and
 * those sit further left, behind the tap rather than across it.
 */
function busPath(a: Pt, busX: number, cornerY: number, b: Pt): string {
  const c = Math.min(cornerY, b.y - 20); // never corner below the port
  const turn = Math.min(16, Math.max(6, (b.x - busX) / 2));
  const ease = (c - a.y) * 0.55;
  return [
    `M ${r1(a.x)} ${r1(a.y)}`,
    `C ${r1(a.x)} ${r1(a.y + ease)}, ${r1(busX)} ${r1(c - ease)}, ${r1(busX)} ${r1(c)}`,
    `L ${r1(busX)} ${r1(b.y - turn)}`,
    `C ${r1(busX)} ${r1(b.y)}, ${r1(busX + turn)} ${r1(b.y)}, ${r1(b.x)} ${r1(b.y)}`,
  ].join(' ');
}

function computeLayout(w: number, count: number): Layout {
  if (w >= WIDE_MIN) {
    // Height follows the node count so four capabilities and three both breathe.
    const h = Math.max(360, 92 + (count - 1) * 96 + NODE_H);
    const source: Pt = { x: 12 + SRC_W / 2, y: h / 2 };
    const hub: Pt = { x: Math.round(w * 0.44), y: h / 2 };
    const colX = w - 12 - NODE_W / 2;
    const first = 40 + NODE_H / 2;
    const step = count > 1 ? (h - first * 2) / (count - 1) : 0;
    const nodes = Array.from({ length: count }, (_, i) => ({
      x: colX,
      y: Math.round(first + step * i),
    }));
    const ports = nodes.map((p) => ({ x: p.x - NODE_W / 2, y: p.y }));
    return {
      mode: 'wide',
      w,
      h,
      nodeW: NODE_W,
      nodeH: NODE_H,
      source,
      hub,
      nodes,
      ports,
      spine: hCurve({ x: source.x + SRC_W / 2, y: source.y }, { x: hub.x - HUB / 2, y: hub.y }),
      edges: ports.map((p) => hCurve({ x: hub.x + HUB / 2, y: hub.y }, p)),
    };
  }

  /* Stacked. The cards are inset from the left to leave room for the wiring
     channels; see `busPath` for why the wires go round rather than across. */
  const portX = 48;
  const nodeW = Math.max(160, w - GUTTER - portX);
  const rowTop = 276;
  const rowStep = NODE_H + 18;
  const h = rowTop + rowStep * (count - 1) + NODE_H / 2 + 12;
  const cx = Math.round(w / 2);
  const source: Pt = { x: cx, y: 12 + SRC_H / 2 };
  const hub: Pt = { x: cx, y: 164 };
  const nodes = Array.from({ length: count }, (_, i) => ({
    x: portX + nodeW / 2,
    y: rowTop + rowStep * i,
  }));
  const ports = nodes.map((p) => ({ x: portX, y: p.y }));
  const hubOut: Pt = { x: hub.x, y: hub.y + HUB / 2 };
  return {
    mode: 'stacked',
    w,
    h,
    nodeW,
    nodeH: NODE_H,
    source,
    hub,
    nodes,
    ports,
    spine: fanCurve({ x: source.x, y: source.y + SRC_H / 2 }, { x: hub.x, y: hub.y - HUB / 2 }),
    /* Channel x falls and the corner deepens as the index grows, so the four
       swings out of the hub nest inside one another instead of crossing. */
    edges: ports.map((p, i) =>
      busPath(hubOut, Math.max(8, 28 - i * 6), hubOut.y + 24 + i * 9, p),
    ),
  };
}

/**
 * Tracks the panel's own width, not the viewport's.
 *
 * The viewport is the wrong thing to measure: the panel sits in a grid whose left
 * column is a rail on desktop and gone on mobile, so one viewport width gives two
 * panel widths. `null` until measured, which is what suppresses the SVG during the
 * server render — there is no box to measure there, and guessing produces a
 * diagram that visibly jumps on hydration.
 */
function useMeasuredWidth<E extends HTMLElement>() {
  const ref = React.useRef<E | null>(null);
  const [width, setWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Rounded: the packets are remounted when the width changes (SMIL restarts on
    // mount, not on attribute change), so a fractional bounding box would restart
    // them on every subpixel reflow.
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
 * One lit dot travelling an edge, plus the bloom that sells it as light.
 *
 * The two element descriptions are declared once and rendered into both circles.
 * React elements are immutable descriptions rather than DOM nodes, so reusing one
 * in two places produces two independent animations — no `cloneElement` needed.
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
      className={cn(
        'uc-ring pointer-events-none absolute inset-0 border border-[var(--uc-primary)]',
        rounded,
      )}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

/** Five bars at unrelated periods, so the readout never visibly loops. */
const EQ_BARS = [0.92, 1.31, 1.07, 1.49, 1.19];

function Equaliser({ reduce }: { reduce: boolean }) {
  return (
    <span aria-hidden className="flex h-4 items-end gap-[2px]">
      {EQ_BARS.map((dur, i) => (
        <span
          key={i}
          className={cn(
            'w-[2px] origin-bottom rounded-sm bg-[var(--uc-primary)]',
            !reduce && 'uc-eq',
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

export function TradeFlow({
  seed,
  source,
  nodes,
  summary,
  className,
}: {
  /** Changes when the flow re-routes. Restarts the beams and the packets. */
  seed: string;
  source: FlowSource;
  nodes: FlowNodeSpec[];
  /** Shown in the footer until a node is picked — the bottleneck, in prose. */
  summary: string;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const panel = useMeasuredWidth<HTMLDivElement>();
  const view = useInView<HTMLDivElement>(0.1);
  const [picked, setPicked] = React.useState<string | null>(null);

  const layout = React.useMemo(
    () => (panel.width ? computeLayout(panel.width, nodes.length) : null),
    [panel.width, nodes.length],
  );

  // A new trade means new nodes, so a stale pick would show the previous trade's
  // prose under the new trade's name.
  React.useEffect(() => setPicked(null), [seed]);

  const pickedNode = nodes.find((n) => n.id === picked) ?? null;
  const SourceIcon = source.icon;

  /**
   * Remount key for everything that has to restart when the flow re-routes.
   * SMIL restarts on mount, not on attribute change, so switching trade has to
   * replace the packet elements; the beams are keyed with them so the wire and
   * the thing travelling it begin together.
   */
  const flowKey = layout ? `${seed}-${layout.mode}-${layout.w}` : seed;

  return (
    <div ref={view.ref} className={className}>
      {/* Chrome. The mono path is what makes the panel read as a canvas rather
          than a picture of one. */}
      <div className="flex items-center gap-3 border-b border-[var(--uc-hairline)]/70 bg-[var(--uc-cloud)] px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-[var(--uc-hairline)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--uc-hairline)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--uc-primary)]/80" />
        </span>
        <span className="truncate font-code text-[11px] tracking-tight text-[var(--uc-ink-soft)]">
          zeneva.flow / <span className="text-[var(--uc-ink)]">{seed}</span>
        </span>
        <span className="ms-auto hidden items-center gap-1.5 font-code text-[10px] uppercase tracking-[0.08em] text-[var(--uc-ink-soft)] sm:flex">
          <span className={cn('h-1.5 w-1.5 rounded-full bg-[var(--uc-primary)]', !reduce && 'uc-blink')} />
          routing
        </span>
      </div>

      {/* The canvas. `height` comes from the computed layout, so the box and the
          SVG are the same size by construction. */}
      <div
        ref={panel.ref}
        className="relative w-full"
        style={{ height: layout ? layout.h : 420 }}
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
                  id={`beam-${seed}`}
                  gradientUnits="userSpaceOnUse"
                  x1={0}
                  y1={0}
                  x2={layout.w}
                  y2={layout.h}
                >
                  <stop offset="0%" stopColor={HEX.primaryDeep} />
                  <stop offset="55%" stopColor={HEX.primary} />
                  <stop offset="100%" stopColor={HEX.glow} />
                </linearGradient>
              </defs>

              {/* Tracks: the dim wire under every beam. Negative delays
                  desynchronise the marching dots so the bundle does not pulse as
                  one thing. */}
              <g stroke={HEX.hairline} strokeWidth={1.25} strokeLinecap="round">
                <path d={layout.spine} className="uc-track" />
                {layout.edges.map((d, i) => (
                  <path
                    key={`track-${i}`}
                    d={d}
                    className="uc-track"
                    style={{ animationDelay: `${(i * -0.9).toFixed(1)}s` }}
                  />
                ))}
              </g>

              {/* Beams, drawn with `pathLength=1` so a single dash length works
                  for every curve regardless of its real arc length. */}
              <g key={`beams-${flowKey}`} className="uc-beams">
                <path
                  d={layout.spine}
                  className="uc-beam"
                  pathLength={1}
                  stroke={`url(#beam-${seed})`}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                {layout.edges.map((d, i) => (
                  <path
                    key={`beam-${i}`}
                    d={d}
                    className="uc-beam"
                    pathLength={1}
                    stroke={`url(#beam-${seed})`}
                    strokeWidth={2}
                    strokeLinecap="round"
                    style={{ animationDelay: `${180 + i * 120}ms` }}
                  />
                ))}
              </g>

              <g>
                {layout.ports.map((p, i) => (
                  <circle key={`port-${i}`} cx={p.x} cy={p.y} r={3.5} fill={HEX.primary} />
                ))}
              </g>

              {!reduce && view.inView && (
                <g key={`packets-${flowKey}`}>
                  <Packet d={layout.spine} dur={2.4} begin={0} />
                  <Packet d={layout.spine} dur={2.4} begin={1.2} />
                  {layout.edges.map((d, i) => (
                    <Packet key={`packet-${i}`} d={d} dur={2.6} begin={0.5 + i * 0.4} />
                  ))}
                </g>
              )}
            </svg>

            {/* Source */}
            <div
              className="absolute flex items-center gap-3 rounded-xl border border-[var(--uc-primary)]/55 bg-[var(--uc-cloud)] px-3 shadow-[0_6px_20px_-12px_rgba(74,40,24,0.35)]"
              style={{
                left: layout.source.x,
                top: layout.source.y,
                width: SRC_W,
                height: SRC_H,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--uc-primary)]/12 text-[var(--uc-primary)]">
                <SourceIcon className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-code text-[9px] uppercase tracking-[0.1em] text-[var(--uc-ink-soft)]">
                  {source.meta}
                </span>
                <span className="block font-bricolage text-[13px] font-semibold leading-tight text-[var(--uc-ink)] line-clamp-2">
                  {source.label}
                </span>
              </span>
              <WakeRing key={`wake-src-${seed}`} reduce={reduce} />
            </div>

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
              <div className="uc-halo absolute -inset-3 rounded-[32px] blur-xl" aria-hidden />
              <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-3xl border border-[var(--uc-primary)]/60 bg-[var(--uc-paper)] shadow-[0_10px_36px_-16px_rgba(238,79,39,0.5)]">
                <span className="uc-rim absolute inset-[-1px] rounded-3xl" aria-hidden />
                <span className="relative h-9 w-9">
                  <ZenMark className="h-full w-full" animated={!reduce} />
                </span>
                <span className="relative font-bricolage text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--uc-ink)]">
                  Zen AI
                </span>
                <WakeRing key={`wake-hub-${seed}`} reduce={reduce} rounded="rounded-3xl" />
              </div>
            </div>

            {/* Capability nodes. Real buttons: picking one swaps the footer prose,
                which is the only place the full detail sentence fits. */}
            {nodes.map((node, i) => {
              const p = layout.nodes[i];
              const isPicked = node.id === picked;
              const offline = node.tone === 'offline';
              const NodeIcon = node.icon;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setPicked(isPicked ? null : node.id)}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setPicked(node.id);
                  }}
                  onFocus={() => setPicked(node.id)}
                  aria-pressed={isPicked}
                  className={cn(
                    'absolute flex cursor-pointer items-center gap-3 rounded-xl border px-3 text-start shadow-[0_6px_20px_-12px_rgba(74,40,24,0.35)] transition-colors duration-300',
                    isPicked
                      ? 'border-[var(--uc-primary)] bg-[var(--uc-cloud)]'
                      : 'border-[var(--uc-primary)]/40 bg-[var(--uc-paper)] hover:border-[var(--uc-primary)]/70 hover:bg-[var(--uc-cloud)]',
                  )}
                  style={{
                    left: p.x,
                    top: p.y,
                    width: layout.nodeW,
                    height: layout.nodeH,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-300',
                      offline
                        ? 'bg-[var(--uc-hairline)]/60 text-[var(--uc-ink)]'
                        : 'bg-[var(--uc-primary)]/12 text-[var(--uc-primary-ink)]',
                    )}
                  >
                    {NodeIcon ? (
                      <NodeIcon className="h-4 w-4" strokeWidth={1.9} />
                    ) : (
                      <span className="font-code text-[11px] font-bold leading-none">
                        {node.badge}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bricolage text-[13px] font-semibold leading-[1.25] text-[var(--uc-ink)] line-clamp-2">
                      {node.label}
                    </span>
                  </span>
                  {/* The offline node gets the equaliser: it is the one whose
                      claim is about something continuing to run. */}
                  {offline ? (
                    <Equaliser reduce={reduce} />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--uc-primary)]',
                        !reduce && 'uc-blink',
                      )}
                    />
                  )}
                  <WakeRing
                    key={`wake-${node.id}-${seed}`}
                    reduce={reduce}
                    delay={200 + i * 120}
                  />
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Footer. Defaults to the bottleneck and swaps to a capability's detail
          when one is picked, so the panel always says something specific. */}
      <div className="border-t border-[var(--uc-hairline)]/70 bg-[var(--uc-cloud)]/60 px-5 py-5">
        <p
          key={pickedNode ? `${seed}-${pickedNode.id}` : `${seed}-summary`}
          className="uc-swap font-dm-sans text-sm leading-[1.7] text-[var(--uc-ink-soft)]"
        >
          {pickedNode ? (
            <>
              <span className="font-code text-[10px] uppercase tracking-[0.1em] text-[var(--uc-primary-ink)]">
                {pickedNode.label}
              </span>
              <span className="mt-1.5 block">{pickedNode.detail}</span>
            </>
          ) : (
            <>
              <span className="font-code text-[10px] uppercase tracking-[0.1em] text-[var(--uc-primary-ink)]">
                The bottleneck
              </span>
              <span className="mt-1.5 block">{summary}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
