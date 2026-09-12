/**
 * The n8n design language, as tokens plus one stylesheet, scoped to `/use-cases`.
 *
 * ## Why this is a light canvas when n8n's own is dark
 *
 * n8n ships a dark-native palette. Zeneva's marketing surface is light, and this
 * page sits between a light header and the footer — dropping a near-black band in
 * the middle of it made `/use-cases` read as a different site rather than a
 * different register of the same one. So what is borrowed is the *structure* of
 * the language — flow canvas, node boxes, hairline edges, one hot accent, mono
 * chrome, geometric display over humanist body — inverted onto a light ground.
 *
 * The ground is warm on purpose. `src/lib/marketing/backdrop.ts` documents the
 * house rule: an orange accent needs its ground's red channel pinned high
 * (250-253) and the movement put in G/B, because a cool white turns the orange
 * muddy. `--uc-canvas` is R=251 and `--uc-cloud` R=253, so both sit inside that
 * band and the accent stays clean.
 *
 * ## Why the palette is literal hex and not the app's own theme tokens
 *
 * The rest of the site runs on `hsl(var(--primary))`, which is Zeneva's orange —
 * `22 90% 55%`, brighter and yellower than n8n's `#ee4f27`. Keeping n8n's own
 * accent is the point of the exercise, so the palette is declared here, applied as
 * custom properties on the page root, and read back through `var()`. Nothing
 * leaks: no global selector is touched, and every rule below is prefixed with
 * `.uc-root`.
 *
 * ## Two oranges, because one cannot do both jobs
 *
 * `#ee4f27` on white is 3.6:1 — fine for graphics and large display text, short of
 * AA for anything small. Every label under ~18px uses `--uc-primary-ink`
 * (`#c33c15`, 5.3:1) instead. Same hue family, one is just load-bearing for text.
 *
 * ## Why `HEX` duplicates `TOKENS`
 *
 * `var()` inside an SVG *presentation attribute* (`fill="var(--x)"`,
 * `stroke="var(--x)"`) is not resolved consistently across engines — a wire that
 * paints black on one browser is not worth the DRY. The HTML side uses `var()`;
 * the SVG side uses `HEX`. Change both or neither.
 *
 * ## Typography
 *
 * n8n pairs `geomanist` with `Open Sans`. Neither is loaded here and adding two
 * webfonts to a marketing route to imitate a brand is the wrong trade, so the
 * roles map onto the fonts this project already ships: `font-bricolage`
 * (Bricolage Grotesque) carries the geometric display role, `font-dm-sans` the
 * reading role, and `font-code` (Source Code Pro) the technical chrome. The
 * hierarchy — geometric display against a humanist body — is preserved even
 * though the faces differ.
 */

import type * as React from 'react';

export const TOKENS = {
  /** Page ground. Warm near-white; see the pinned-channel note in the header. */
  '--uc-canvas': '#fbf6f1',
  /** Cards and node boxes — the surface that sits *above* the ground. */
  '--uc-paper': '#ffffff',
  /** Tinted surface: chrome bars, badges, the picked state. */
  '--uc-cloud': '#fdf1ea',
  '--uc-hairline': '#e4d2c6',
  '--uc-hairline-strong': '#c9b2a4',
  '--uc-ink': '#1c1117',
  '--uc-ink-soft': '#6b5a52',
  '--uc-primary': '#ee4f27',
  '--uc-primary-bright': '#ff492c',
  '--uc-primary-deep': '#d94420',
  /** The accent, darkened until small text on white passes AA. */
  '--uc-primary-ink': '#c33c15',
  /** n8n's magenta. Used as the far end of the wire gradient, nowhere else. */
  '--uc-glow': '#ea4b71',
} as React.CSSProperties;

/** Literal counterparts of the tokens the SVG paints with. See the file header. */
export const HEX = {
  primary: '#ee4f27',
  primaryDeep: '#d94420',
  /** Wire gradient's far end. Orange into magenta is n8n's own brand ramp. */
  glow: '#ea4b71',
  /** Inert wire under every beam: visible against the ground at 1.8:1, recessive. */
  hairline: '#cdb6a8',
  /**
   * Packet core.
   *
   * Inverted from the dark original, which blew the primary out towards white so
   * it read as hot. On a light ground a near-white dot is invisible — what reads
   * as a dense travelling packet here is *ink*, so the core is the accent driven
   * down to 7:1 against paper, and the bloom behind it carries the warmth.
   */
  packet: '#a62c0c',
} as const;

/** n8n's card: paper surface, hairline edge, top sheen over a soft warm drop. */
export const CARD =
  'rounded-2xl border border-[var(--uc-hairline)] bg-[var(--uc-paper)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_10px_30px_-18px_rgba(74,40,24,0.35)]';

/** n8n's primary button, including the inset glow it picks up on hover. */
export const BTN_PRIMARY =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--uc-primary)] px-8 py-[15px] font-bricolage text-sm font-bold uppercase tracking-[0.4px] text-white transition-colors duration-300 hover:bg-[var(--uc-primary-bright)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_0_0_rgba(255,142,93,0.3)]';

/** n8n's secondary button: transparent, hairline-bounded, tint on hover. */
export const BTN_SECONDARY =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--uc-hairline-strong)] bg-transparent px-8 py-[14px] font-bricolage text-sm font-bold uppercase tracking-[0.4px] text-[var(--uc-ink)] transition-colors duration-300 hover:bg-[var(--uc-cloud)]';

/** n8n's badge: cloud pill, soft ink, hairline edge. */
export const BADGE =
  'inline-flex items-center gap-2 rounded-full border border-[var(--uc-hairline)] bg-[var(--uc-cloud)] px-3 py-1 font-dm-sans text-xs text-[var(--uc-ink-soft)]';

/**
 * Every keyframe and motion utility the page uses.
 *
 * Injected once from the page root rather than added to `globals.css`, because
 * nothing else uses any of it and a keyframe in the global sheet outlives the
 * component that needed it.
 *
 * Two rules held throughout:
 *
 * 1. **Only `transform` and `opacity` animate** (plus `stroke-dashoffset` and
 *    `background-position`, which are also compositor-friendly). Nothing here
 *    animates a layout property, and nothing here runs a per-frame JS callback —
 *    this page is mostly read, not interacted with, and atmosphere must not cost
 *    the main thread.
 *
 * 2. **Reduced motion is handled once, at the bottom.** Animations that *reveal*
 *    something are switched off by pinning the property to its end state, not by
 *    `animation: none` — a beam with `animation: none` keeps `stroke-dashoffset: 1`
 *    and is simply invisible, which is a worse outcome than the animation.
 *
 * SMIL is the exception to (2): `<animateMotion>` ignores the media query
 * entirely, so the travelling packets are gated in JS instead. Same problem
 * `ZenMark` has with its sheen.
 *
 * Light-ground note: the dark version leaned on glows — a light source against
 * darkness. Nothing glows on paper. Every one of those became either a tight warm
 * drop shadow or a low-alpha wash, which is what "lit" looks like on white.
 */
export const CANVAS_CSS = `
@keyframes uc-beam-draw {
  from { stroke-dashoffset: 1; opacity: 0.15; }
  to   { stroke-dashoffset: 0; opacity: 1; }
}
@keyframes uc-track-march { to { stroke-dashoffset: -40; } }
@keyframes uc-ring-out {
  0%   { transform: scale(0.88); opacity: 0.65; }
  70%  { opacity: 0; }
  100% { transform: scale(1.14); opacity: 0; }
}
@keyframes uc-halo-breathe {
  0%, 100% { opacity: 0.4; transform: scale(0.97); }
  50%      { opacity: 0.8; transform: scale(1.04); }
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
  100% { transform: translateY(620%); opacity: 0; }
}
@keyframes uc-swap-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}
@keyframes uc-expand-in {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: none; }
}
/* Declared rather than leaning on Tailwind's own "spin": that keyframe is only
   emitted when an animate-spin utility is generated somewhere in the project,
   which makes it an invisible dependency on unrelated code. The translate is
   repeated in both stops because a keyframe replaces the whole transform list —
   animating just the rotate would drop the centring. */
@keyframes uc-rim-spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
}
/* Two sines at unrelated periods, so the bloom never visibly loops. Amplitudes
   are deliberately below the threshold where the movement can be named — the
   effect wanted is "this surface is alive", not "something is sliding". */
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
/* The canvas grid, drifting one cell over a long period. \`background-position\`
   rather than a transform, so the grid can stay pinned to the section box and
   still move — a transformed grid has to be oversized to avoid showing its edge. */
@keyframes uc-grid-drift {
  from { background-position: 0 0; }
  to   { background-position: 28px 28px; }
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
/* Tight and warm, not a glow: on paper a wide soft shadow reads as smudge. */
.uc-root .uc-beams { filter: drop-shadow(0 1px 2px rgba(166, 44, 12, 0.3)); }
.uc-root .uc-ring { animation: uc-ring-out 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
.uc-root .uc-halo {
  background: radial-gradient(circle, rgba(238, 79, 39, 0.3), transparent 70%);
  animation: uc-halo-breathe 5.5s ease-in-out infinite;
}
/*
 * The rotating rim highlight, on the hub and on the featured plan.
 *
 * Two elements, and which one moves is the whole trick. The span is static: it is
 * masked to a 1px inset ring and clips its own overflow. The wedge lives on
 * \`::before\` — an oversized square, centred, and the only thing that rotates. So
 * what travels is a highlight around the border.
 *
 * Rotating the *span* instead, which is what this did first, works only on a
 * square. Turn a 325x210 card and its corners swing ~90px past its own bottom
 * edge; the masked ring follows them and draws a chevron hanging below the card.
 * The hub got away with it because it is 108x108.
 *
 * \`padding-bottom\` is a percentage of the *width*, which is how the child stays
 * square without knowing either dimension. 200% covers the box for any aspect
 * ratio up to about 1:1.7 — true of both uses, and the reason \`overflow: hidden\`
 * is here as well as the mask: if a future box is taller than that, or an engine
 * drops the mask, the fallback is a clipped wedge and not one sprayed across the
 * page.
 */
.uc-root .uc-rim {
  overflow: hidden;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  padding: 1px;
}
.uc-root .uc-rim::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200%;
  padding-bottom: 200%;
  background: conic-gradient(from 0deg, transparent 0deg, rgba(238, 79, 39, 0.9) 40deg, transparent 110deg);
  animation: uc-rim-spin 6s linear infinite;
}
.uc-root .uc-eq { animation: uc-eq-bounce 1.2s ease-in-out infinite; }
.uc-root .uc-progress { animation: uc-fill linear forwards; }
.uc-root .uc-blink { animation: uc-blink-dot 2s ease-in-out infinite; }
.uc-root .uc-swap { animation: uc-swap-in 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
.uc-root .uc-expand { animation: uc-expand-in 320ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
.uc-root .uc-bloom-a { animation: uc-bloom-a 31s ease-in-out infinite; will-change: transform; }
.uc-root .uc-bloom-b { animation: uc-bloom-b 43s ease-in-out infinite; will-change: transform; }

/* A workflow editor's dot grid. Two layers: the dots, and a squared hairline
   lattice at a quarter of their contrast, which is what stops the dots reading as
   a texture and makes them read as coordinates. */
.uc-root .uc-grid {
  background-image:
    radial-gradient(rgba(201, 178, 164, 0.55) 1px, transparent 1px),
    linear-gradient(to right, rgba(228, 210, 198, 0.5) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(228, 210, 198, 0.5) 1px, transparent 1px);
  background-size: 28px 28px, 112px 112px, 112px 112px;
  animation: uc-grid-drift 24s linear infinite;
}

.uc-root .uc-scanline { opacity: 0; }
.uc-root .group:hover .uc-scanline { animation: uc-scan-sweep 1.5s cubic-bezier(0.4, 0, 0.2, 1); }

/*
 * Scroll reveal. A transition rather than a keyframe, so the stagger delay only
 * applies on the way in and an element cannot be caught mid-animation by an
 * unrelated re-render. \`--i\` is the stagger index, set per child.
 */
.uc-root .uc-rise {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
              transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  transition-delay: calc(var(--i, 0) * 65ms);
}
.uc-root .uc-shown .uc-rise,
.uc-root .uc-rise.uc-shown { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .uc-root .uc-track,
  .uc-root .uc-halo,
  .uc-root .uc-eq,
  .uc-root .uc-blink,
  .uc-root .uc-grid,
  .uc-root .uc-bloom-a,
  .uc-root .uc-bloom-b { animation: none; }
  .uc-root .uc-blink { opacity: 1; }
  /* Stopped, but still centred: without the transform the wedge's own top-left
     lands on the box centre and a quarter of it shows in one corner. */
  .uc-root .uc-rim::before { animation: none; transform: translate(-50%, -50%); }
  .uc-root .uc-beam { animation: none; stroke-dashoffset: 0; }
  .uc-root .uc-progress { animation: none; transform: scaleX(1); }
  .uc-root .uc-swap,
  .uc-root .uc-expand { animation: none; }
  .uc-root .uc-scanline,
  .uc-root .group:hover .uc-scanline { animation: none; opacity: 0; }
  .uc-root .uc-rise { opacity: 1; transform: none; transition: none; }
}
`;
