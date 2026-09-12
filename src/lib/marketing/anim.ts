/**
 * Canvas drawing + timing kit for the marketing demo videos.
 *
 * Every demo is a pure function of (frame, theme), drawn onto a 2D canvas at a
 * fixed design size (`STAGE`). Purity is the point: the preview player and the
 * recorder call the same `draw`, so what the admin scrubs through is what gets
 * exported. Nothing here may read the clock or `Math.random()` — a frame must
 * always render identically.
 */

/** Design space. Export sizes are integer-ish multiples of this. */
export const STAGE = { w: 1600, h: 900 };
export const FPS = 30;

/** seconds -> frames, so scene timings read in human units */
export const s = (seconds: number) => Math.round(seconds * FPS);

/**
 * The app's own tokens, resolved to hex.
 *
 * Canvas cannot read CSS variables, so these are transcribed from the `:root`
 * and `.dark` blocks in `src/app/globals.css`. If a token changes there, change
 * it here — the whole point of the demos is that they look like the product.
 */
export type Theme = {
  id: 'light' | 'dark';
  /** page background */
  bg: string;
  /** --card */
  card: string;
  /** a hair above `card`, for hover states */
  cardLift: string;
  /** --foreground */
  fg: string;
  /** --muted-foreground */
  muted: string;
  /** muted-foreground at lower contrast, for placeholders */
  faint: string;
  /** --muted / --secondary fill */
  subtle: string;
  /** --border */
  border: string;
  /** --primary and its ramp */
  primary: string;
  primaryHi: string;
  primaryLo: string;
  primaryFg: string;
  /** semantic accents — same hues in both themes */
  green: string;
  blue: string;
  amber: string;
  red: string;
  /** window chrome + drop shadows */
  bar: string;
  shadow: string;
};

export const LIGHT: Theme = {
  id: 'light',
  bg: '#fffcfa',          // 30 100% 99%
  card: '#ffffff',        // 0 0% 100%
  cardLift: '#fdf8f4',
  fg: '#030711',          // 224 71% 4%
  muted: '#64748b',       // 215.4 16.3% 46.9%
  faint: '#94a3b8',
  subtle: '#f1f5f9',      // 210 40% 96.1%
  border: '#e5e5e5',      // 0 0% 90%
  primary: '#f47125',     // 22 90% 55%
  primaryHi: '#ff9040',
  primaryLo: '#cc5200',
  primaryFg: '#ffffff',
  green: '#16a34a',
  blue: '#2563eb',
  amber: '#d97706',
  red: '#dc2626',
  bar: '#f6f6f7',
  shadow: 'rgba(15, 23, 42, 0.16)',
};

export const DARK: Theme = {
  id: 'dark',
  bg: '#09090b',          // 240 10% 3.9%
  card: '#0a0a0d',        // 240 10% 4.5%
  cardLift: '#141418',
  fg: '#fafafa',          // 0 0% 98%
  muted: '#a1a1aa',       // 240 5% 64.9%
  faint: '#6b6b73',
  subtle: '#27272a',      // 240 3.7% 15.9%
  border: '#1d1d1f',      // 240 3.7% 12%
  primary: '#f47125',
  primaryHi: '#ff9040',
  primaryLo: '#cc5200',
  primaryFg: '#ffffff',
  green: '#22c55e',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  bar: '#131316',
  shadow: 'rgba(0, 0, 0, 0.55)',
};

export const THEMES = { light: LIGHT, dark: DARK } as const;

/**
 * The palette every widget below paints with.
 *
 * `draw` is synchronous and single-threaded, so binding the theme once at the
 * top of a frame is safe and keeps all the call sites free of a theme argument.
 * `applyTheme` mutates in place rather than reassigning so that `C` stays a
 * stable import for modules that captured it at load time.
 */
export const C: Theme = { ...DARK };

export function applyTheme(t: Theme) {
  Object.assign(C, t);
}

export const FONT_DISPLAY = '"Bricolage Grotesque", system-ui, sans-serif';
export const FONT_BODY = 'Inter, system-ui, sans-serif';

/** The exact faces the demos draw with, so export never races font loading. */
const FACES = [
  '700 64px "Bricolage Grotesque"',
  '500 64px "Bricolage Grotesque"',
  '400 24px Inter',
  '500 24px Inter',
  '600 24px Inter',
  '700 24px Inter',
];

export async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(FACES.map((f) => document.fonts.load(f).catch(() => null)));
  await document.fonts.ready;
}

// ---------------------------------------------------------------- timing

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const easeOut: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutQuint: Ease = (t) => 1 - Math.pow(1 - t, 5);
export const easeIn: Ease = (t) => t * t * t;
export const easeInOut: Ease = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/** Slight overshoot — what makes a card land like a real UI spring. */
export const easeBack: Ease = (t) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
export const easeElastic: Ease = (t) =>
  t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;

/** Progress of `frame` through [start, end] in frames, eased and clamped. */
export function prog(frame: number, start: number, end: number, ease: Ease = easeOut) {
  if (end <= start) return frame >= end ? 1 : 0;
  return ease(clamp((frame - start) / (end - start)));
}

/** Rises 0->1, holds, falls back to 0. For things that appear then leave. */
export function pulse(frame: number, start: number, end: number, ramp = s(0.35)) {
  return Math.min(prog(frame, start, start + ramp), 1 - prog(frame, end - ramp, end, easeIn));
}

/** Ambient bob/sway. Deterministic — driven by frame, never by Date.now(). */
export const osc = (frame: number, period: number, amp = 1, phase = 0) =>
  Math.sin(((frame / period) * Math.PI * 2) + phase) * amp;

// ---------------------------------------------------------------- paint

export function rgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp(alpha, 0, 1)})`;
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function card(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  o: { r?: number; fill?: string; stroke?: string; lineWidth?: number; shadow?: number } = {},
) {
  const { r = 18, fill = C.card, stroke = C.border, lineWidth = 1.5, shadow = 0 } = o;
  ctx.save();
  if (shadow > 0) {
    ctx.shadowColor = C.shadow;
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = shadow * 0.35;
  }
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  if (stroke) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export type TextOpts = {
  size?: number;
  weight?: number | string;
  family?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  alpha?: number;
  maxWidth?: number;
  /** Extra px between glyphs — for the uppercase `tracking-wider` labels. */
  tracking?: number;
};

export function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number, y: number,
  o: TextOpts = {},
) {
  const {
    size = 24, weight = 500, family = FONT_BODY, color = C.fg,
    align = 'left', baseline = 'alphabetic', alpha = 1, maxWidth, tracking = 0,
  } = o;
  ctx.save();
  ctx.globalAlpha *= clamp(alpha, 0, 1);
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textBaseline = baseline;

  if (tracking > 0) {
    // canvas has no letterSpacing in every engine we target, so step manually
    const chars = [...str];
    const total = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0)
      + tracking * (chars.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    for (const ch of chars) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + tracking;
    }
    ctx.restore();
    return total;
  }

  ctx.textAlign = align;
  ctx.fillText(str, x, y, maxWidth);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** Greedy wrap. Returns the y of the line after the last one drawn. */
export function paragraph(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number, y: number, width: number, lineHeight: number,
  o: TextOpts = {},
) {
  ctx.save();
  ctx.font = `${o.weight ?? 400} ${o.size ?? 24}px ${o.family ?? FONT_BODY}`;
  const words = str.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  ctx.restore();
  lines.forEach((l, i) => text(ctx, l, x, y + i * lineHeight, o));
  return y + lines.length * lineHeight;
}

// ---------------------------------------------------------------- widgets

/**
 * Typewriter. `t` is 0..1 across the whole string; the caret blinks on a
 * frame-derived cycle so it stays deterministic.
 */
export function typed(str: string, t: number, frame: number, caret = true) {
  const shown = str.slice(0, Math.round(clamp(t) * str.length));
  const blink = caret && Math.floor(frame / 8) % 2 === 0;
  return shown + (blink && t < 1 ? '|' : '');
}

/** Cubic bezier point — cursor travel that arcs instead of sliding on a rail. */
export function bezier(
  p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], t: number,
): [number, number] {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/**
 * Move between two points along a gentle arc. The control points bow
 * perpendicular to the travel direction, which is what stops long cursor moves
 * from looking like a linear tween.
 */
export function glide(
  from: [number, number], to: [number, number], t: number, bow = 0.18,
): [number, number] {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const nx = -dy * bow, ny = dx * bow;
  return bezier(
    from,
    [from[0] + dx * 0.25 + nx, from[1] + dy * 0.25 + ny],
    [from[0] + dx * 0.75 + nx, from[1] + dy * 0.75 + ny],
    to,
    t,
  );
}

/** The pointer itself: arrow, white on a dark hairline, with a press dip. */
export function cursor(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  o: { press?: number; alpha?: number; scale?: number } = {},
) {
  const { press = 0, alpha = 1, scale = 1 } = o;
  const k = scale * (1 - press * 0.16);
  ctx.save();
  ctx.globalAlpha *= clamp(alpha, 0, 1);
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 30);
  ctx.lineTo(7.4, 22.8);
  ctx.lineTo(12.6, 34.5);
  ctx.lineTo(18.4, 31.8);
  ctx.lineTo(13.2, 20.2);
  ctx.lineTo(23, 19.4);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(10,10,11,0.85)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

/** Click feedback: a ring that expands and fades. `t` is 0..1 over the click. */
export function ripple(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, t: number, color = C.primary, max = 62,
) {
  if (t <= 0 || t >= 1) return;
  const e = easeOut(t);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 6 + e * max, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(color, (1 - t) * 0.85);
  ctx.lineWidth = 3.5 * (1 - t) + 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 6 + e * max * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = rgba(color, (1 - t) * 0.18);
  ctx.fill();
  ctx.restore();
}

/**
 * A press "budget": returns how pressed the mouse is at `frame` for a click
 * that starts at `at`, plus the ripple progress. Keeps click choreography in
 * one place so every scene's clicks feel the same.
 */
export function click(frame: number, at: number) {
  const down = s(0.09);
  return {
    press: pulse(frame, at, at + down * 2, down),
    ripple: prog(frame, at, at + s(0.55), linear),
    done: frame >= at + down,
  };
}

/** The Zeneva glyph, traced from `AppConfig.logoIconUrl`'s two paths. */
export function zenMark(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number,
  o: { sheen?: number; alpha?: number } = {},
) {
  const { sheen = -1, alpha = 1 } = o;
  const k = size / 116; // glyph occupies a 116-unit box in the logo's viewBox
  ctx.save();
  ctx.globalAlpha *= clamp(alpha, 0, 1);
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.translate(-100, -104.5); // glyph centroid inside the 200x200 viewBox

  const grad = ctx.createLinearGradient(0, 55, 0, 154);
  grad.addColorStop(0, C.primaryHi);
  grad.addColorStop(1, C.primaryLo);

  // ring: outer circle r35 with an r27 hole, both centred (100, 90)
  ctx.beginPath();
  ctx.arc(100, 90, 35, 0, Math.PI * 2);
  ctx.arc(100, 90, 27, 0, Math.PI * 2, true);
  ctx.fillStyle = grad;
  ctx.fill('evenodd');

  // crescent
  ctx.beginPath();
  ctx.moveTo(60, 127);
  ctx.quadraticCurveTo(100, 154, 140, 127);
  ctx.quadraticCurveTo(100, 142, 60, 127);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  if (sheen >= 0 && sheen <= 1) {
    const x = lerp(40, 180, sheen);
    const band = ctx.createLinearGradient(x - 34, 0, x + 34, 0);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = band;
    ctx.fillRect(40, 40, 140, 130);
  }
  ctx.restore();
}

/** Animated tick, drawn stroke-first so it can be revealed by progress. */
export function check(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, t: number, color = C.green,
) {
  ctx.save();
  ctx.translate(cx, cy);
  const pop = easeBack(clamp(t * 2));
  ctx.scale(pop, pop);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(color, 0.16);
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();

  const draw = clamp((t - 0.35) / 0.5);
  if (draw > 0) {
    const pts: [number, number][] = [[-r * 0.4, 0], [-r * 0.08, r * 0.32], [r * 0.44, -r * 0.3]];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (draw < 0.5) {
      const u = draw / 0.5;
      ctx.lineTo(lerp(pts[0][0], pts[1][0], u), lerp(pts[0][1], pts[1][1], u));
    } else {
      const u = (draw - 0.5) / 0.5;
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(lerp(pts[1][0], pts[2][0], u), lerp(pts[1][1], pts[2][1], u));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- chrome

/** Clip subsequent drawing to a window's content area. */
export function clipContent(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
) {
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
}

/** Full-bleed title card. `t` 0..1 in, `out` 0..1 leaving. */
export function titleCard(
  ctx: CanvasRenderingContext2D,
  headline: string, sub: string,
  t: number, out: number, frame: number,
) {
  const a = t * (1 - out);
  if (a <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = C.id === 'light' ? '#fffcfa' : '#050506';
  ctx.fillRect(0, 0, STAGE.w, STAGE.h);

  const glow = ctx.createRadialGradient(
    STAGE.w / 2, STAGE.h * 0.42, 0,
    STAGE.w / 2, STAGE.h * 0.42, STAGE.w * 0.45,
  );
  glow.addColorStop(0, rgba(C.primary, C.id === 'light' ? 0.2 : 0.16));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STAGE.w, STAGE.h);

  const rise = lerp(26, 0, easeOutQuint(t)) + out * -22;
  zenMark(ctx, STAGE.w / 2, STAGE.h * 0.33 + rise, 92, { sheen: (frame % 90) / 90 });
  text(ctx, headline, STAGE.w / 2, STAGE.h * 0.53 + rise, {
    size: 76, weight: 700, family: FONT_DISPLAY, align: 'center', baseline: 'middle',
  });
  text(ctx, sub, STAGE.w / 2, STAGE.h * 0.62 + rise, {
    size: 28, weight: 400, color: C.muted, align: 'center', baseline: 'middle',
  });
  ctx.restore();
}

/** Closing frame: mark, wordmark, call to action. */
export function endCard(
  ctx: CanvasRenderingContext2D,
  line: string, cta: string, t: number, frame: number,
) {
  if (t <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = t;
  ctx.fillStyle = C.id === 'light' ? '#fffcfa' : '#050506';
  ctx.fillRect(0, 0, STAGE.w, STAGE.h);

  const glow = ctx.createRadialGradient(
    STAGE.w / 2, STAGE.h / 2, 0, STAGE.w / 2, STAGE.h / 2, STAGE.w * 0.4,
  );
  glow.addColorStop(0, rgba(C.primary, 0.2));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STAGE.w, STAGE.h);

  const k = easeBack(clamp(t * 1.4));
  ctx.save();
  ctx.translate(STAGE.w / 2, STAGE.h * 0.38);
  ctx.scale(k, k);
  zenMark(ctx, 0, 0, 104, { sheen: (frame % 80) / 80 });
  ctx.restore();

  text(ctx, 'zeneva', STAGE.w / 2, STAGE.h * 0.56, {
    size: 82, weight: 700, family: FONT_DISPLAY, align: 'center', baseline: 'middle',
    color: C.primary,
  });
  text(ctx, line, STAGE.w / 2, STAGE.h * 0.66, {
    size: 27, weight: 400, color: C.muted, align: 'center', baseline: 'middle',
  });

  const cw = 300, ch = 62;
  card(ctx, STAGE.w / 2 - cw / 2, STAGE.h * 0.74, cw, ch, {
    r: 31, fill: C.primary, stroke: '',
  });
  text(ctx, cta, STAGE.w / 2, STAGE.h * 0.74 + ch / 2 + 1, {
    size: 23, weight: 600, color: C.primaryFg, align: 'center', baseline: 'middle',
  });
  ctx.restore();
}

/** Painted first in every frame so nothing inherits a stale buffer. */
export function backdrop(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.fillStyle = C.id === 'light' ? '#f4f1ee' : '#050506';
  ctx.fillRect(0, 0, STAGE.w, STAGE.h);

  const g = ctx.createRadialGradient(
    STAGE.w * 0.5, STAGE.h * -0.15 + osc(frame, 260, 14), 0,
    STAGE.w * 0.5, STAGE.h * -0.15, STAGE.h * 1.25,
  );
  g.addColorStop(0, rgba(C.primary, C.id === 'light' ? 0.16 : 0.1));
  g.addColorStop(0.55, rgba(C.primary, 0.03));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, STAGE.w, STAGE.h);
}

/** Lower-third caption strip. Narrates what the viewer is watching. */
export function caption(
  ctx: CanvasRenderingContext2D,
  str: string, t: number,
) {
  if (t <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = t;
  ctx.font = `500 26px ${FONT_BODY}`;
  const w = ctx.measureText(str).width + 60;
  const h = 60;
  const x = STAGE.w / 2 - w / 2;
  const y = STAGE.h - 84 + (1 - easeOut(t)) * 18;
  card(ctx, x, y, w, h, {
    r: 30,
    fill: C.id === 'light' ? 'rgba(255,255,255,0.96)' : 'rgba(20,20,24,0.95)',
    stroke: C.border,
    shadow: 26,
  });
  text(ctx, str, STAGE.w / 2, y + h / 2 + 1, {
    size: 26, weight: 500, align: 'center', baseline: 'middle',
  });
  ctx.restore();
}

// ---------------------------------------------------------------- demo type

export type Demo = {
  id: string;
  title: string;
  blurb: string;
  /** Total length in frames. */
  frames: number;
  /**
   * Design space this demo draws in. Absent means the landscape {@link STAGE},
   * which is what every demo written before the reels existed assumes — so
   * omitting it keeps those three playing and exporting exactly as they did.
   *
   * It exists because a vertical demo must be *drawn* vertical, not letterboxed
   * into 16:9 by the recorder. Cropping a 1600×900 composition into 1080×1920
   * leaves the picture in a 1080×608 band with brand bars above and below it,
   * which is the shape of a landscape video posted to Reels — the exact thing
   * the reels format exists to avoid.
   */
  stage?: { w: number; h: number };
  /**
   * Pure: the same (frame, theme) always paints the same pixels. Implementations
   * must call `applyTheme(theme)` before drawing anything.
   */
  draw: (ctx: CanvasRenderingContext2D, frame: number, theme: Theme) => void;
  /** Scrubber markers — label plus the frame the beat starts on. */
  chapters: { label: string; at: number }[];
};

/** The design space a demo draws in. The player and the recorder must agree. */
export const stageOf = (demo: Pick<Demo, 'stage'>) => demo.stage ?? STAGE;


