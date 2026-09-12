/**
 * Vector redraws of the lucide icons the POS and inventory pages actually use,
 * plus the shadcn primitives (button, input, badge, table row) at the sizes the
 * real components render them.
 *
 * Every path here is traced from the lucide source at a 24×24 grid and scaled,
 * so `icon(ctx, 'shopping-cart', x, y, 20)` reads the same as
 * `<ShoppingCart className="h-5 w-5" />` does in the app. Drawing them rather
 * than rasterising keeps the export sharp at 4K and avoids bundling an atlas.
 */

import { C, FONT_BODY, FONT_DISPLAY, roundRectPath, text, rgba, card } from './anim';

export type IconName =
  | 'search' | 'shopping-cart' | 'plus-circle' | 'trash' | 'archive' | 'list-filter'
  | 'columns' | 'package' | 'qr-code' | 'banknote' | 'credit-card' | 'landmark'
  | 'file-text' | 'chevron-right' | 'check' | 'user' | 'user-plus' | 'printer'
  | 'boxes' | 'pencil' | 'upload' | 'alert-triangle' | 'sparkles' | 'x';

/**
 * Stroke-drawn icon on a 24-unit grid, centred at (cx, cy).
 * `size` is the rendered box, matching lucide's `h-N w-N`.
 */
export function icon(
  ctx: CanvasRenderingContext2D,
  name: IconName,
  cx: number, cy: number, size: number,
  color = C.fg,
  width = 2,
) {
  const k = size / 24;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.translate(-12, -12);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  switch (name) {
    case 'search':
      ctx.arc(11, 11, 8, 0, Math.PI * 2);
      ctx.moveTo(21, 21); ctx.lineTo(16.65, 16.65);
      break;
    case 'shopping-cart':
      ctx.arc(8, 21, 1, 0, Math.PI * 2);
      ctx.moveTo(20, 21); ctx.arc(19, 21, 1, 0, Math.PI * 2);
      ctx.moveTo(1, 1); ctx.lineTo(4.2, 1); ctx.lineTo(6.8, 14);
      ctx.lineTo(19, 14); ctx.lineTo(21.6, 5); ctx.lineTo(5, 5);
      break;
    case 'plus-circle':
      ctx.arc(12, 12, 10, 0, Math.PI * 2);
      ctx.moveTo(8, 12); ctx.lineTo(16, 12);
      ctx.moveTo(12, 8); ctx.lineTo(12, 16);
      break;
    case 'trash':
      ctx.moveTo(3, 6); ctx.lineTo(21, 6);
      ctx.moveTo(19, 6); ctx.lineTo(18, 20); ctx.lineTo(6, 20); ctx.lineTo(5, 6);
      ctx.moveTo(9, 6); ctx.lineTo(9, 3); ctx.lineTo(15, 3); ctx.lineTo(15, 6);
      break;
    case 'archive':
      ctx.moveTo(3, 4); ctx.lineTo(21, 4); ctx.lineTo(21, 9); ctx.lineTo(3, 9); ctx.closePath();
      ctx.moveTo(5, 9); ctx.lineTo(5, 20); ctx.lineTo(19, 20); ctx.lineTo(19, 9);
      ctx.moveTo(10, 13); ctx.lineTo(14, 13);
      break;
    case 'list-filter':
      ctx.moveTo(3, 6); ctx.lineTo(21, 6);
      ctx.moveTo(6, 12); ctx.lineTo(18, 12);
      ctx.moveTo(9, 18); ctx.lineTo(15, 18);
      break;
    case 'columns':
      ctx.moveTo(3, 4); ctx.lineTo(21, 4); ctx.lineTo(21, 20); ctx.lineTo(3, 20); ctx.closePath();
      ctx.moveTo(12, 4); ctx.lineTo(12, 20);
      break;
    case 'package':
      ctx.moveTo(12, 2); ctx.lineTo(21, 7); ctx.lineTo(21, 17); ctx.lineTo(12, 22);
      ctx.lineTo(3, 17); ctx.lineTo(3, 7); ctx.closePath();
      ctx.moveTo(3, 7); ctx.lineTo(12, 12); ctx.lineTo(21, 7);
      ctx.moveTo(12, 12); ctx.lineTo(12, 22);
      break;
    case 'qr-code':
      ctx.rect(3, 3, 6, 6); ctx.rect(15, 3, 6, 6); ctx.rect(3, 15, 6, 6);
      ctx.moveTo(15, 15); ctx.lineTo(18, 15);
      ctx.moveTo(21, 15); ctx.lineTo(21, 18);
      ctx.moveTo(15, 18); ctx.lineTo(15, 21); ctx.lineTo(18, 21);
      break;
    case 'banknote':
      ctx.rect(2, 6, 20, 12);
      ctx.moveTo(12, 12); ctx.arc(12, 12, 2.5, 0, Math.PI * 2);
      ctx.moveTo(6, 12); ctx.lineTo(6.01, 12);
      ctx.moveTo(18, 12); ctx.lineTo(18.01, 12);
      break;
    case 'credit-card':
      ctx.rect(2, 5, 20, 14);
      ctx.moveTo(2, 10); ctx.lineTo(22, 10);
      break;
    case 'landmark':
      ctx.moveTo(3, 22); ctx.lineTo(21, 22);
      ctx.moveTo(6, 18); ctx.lineTo(6, 11);
      ctx.moveTo(10, 18); ctx.lineTo(10, 11);
      ctx.moveTo(14, 18); ctx.lineTo(14, 11);
      ctx.moveTo(18, 18); ctx.lineTo(18, 11);
      ctx.moveTo(2, 8); ctx.lineTo(12, 2); ctx.lineTo(22, 8); ctx.closePath();
      break;
    case 'file-text':
      ctx.moveTo(14, 2); ctx.lineTo(6, 2); ctx.lineTo(6, 22); ctx.lineTo(18, 22);
      ctx.lineTo(18, 6); ctx.closePath();
      ctx.moveTo(14, 2); ctx.lineTo(14, 6); ctx.lineTo(18, 6);
      ctx.moveTo(9, 13); ctx.lineTo(15, 13);
      ctx.moveTo(9, 17); ctx.lineTo(15, 17);
      break;
    case 'chevron-right':
      ctx.moveTo(9, 6); ctx.lineTo(15, 12); ctx.lineTo(9, 18);
      break;
    case 'check':
      ctx.moveTo(20, 6); ctx.lineTo(9, 17); ctx.lineTo(4, 12);
      break;
    case 'user':
      ctx.arc(12, 8, 4, 0, Math.PI * 2);
      ctx.moveTo(4, 21); ctx.lineTo(4, 19);
      ctx.arcTo(4, 15, 8, 15, 4); ctx.lineTo(16, 15);
      ctx.arcTo(20, 15, 20, 19, 4); ctx.lineTo(20, 21);
      break;
    case 'user-plus':
      ctx.arc(9, 8, 4, 0, Math.PI * 2);
      ctx.moveTo(2, 21); ctx.lineTo(2, 19);
      ctx.arcTo(2, 15, 6, 15, 4); ctx.lineTo(12, 15);
      ctx.arcTo(16, 15, 16, 19, 4); ctx.lineTo(16, 21);
      ctx.moveTo(19, 8); ctx.lineTo(19, 14);
      ctx.moveTo(16, 11); ctx.lineTo(22, 11);
      break;
    case 'printer':
      ctx.moveTo(6, 9); ctx.lineTo(6, 2); ctx.lineTo(18, 2); ctx.lineTo(18, 9);
      ctx.moveTo(6, 18); ctx.lineTo(4, 18);
      ctx.arcTo(2, 18, 2, 16, 2); ctx.lineTo(2, 11);
      ctx.arcTo(2, 9, 4, 9, 2); ctx.lineTo(20, 9);
      ctx.arcTo(22, 9, 22, 11, 2); ctx.lineTo(22, 16);
      ctx.arcTo(22, 18, 20, 18, 2); ctx.lineTo(18, 18);
      ctx.moveTo(6, 14); ctx.lineTo(18, 14); ctx.lineTo(18, 22); ctx.lineTo(6, 22); ctx.closePath();
      break;
    case 'boxes':
      ctx.rect(2, 13, 8, 8); ctx.rect(14, 13, 8, 8); ctx.rect(8, 3, 8, 8);
      break;
    case 'pencil':
      ctx.moveTo(17, 3); ctx.lineTo(21, 7); ctx.lineTo(8, 20); ctx.lineTo(3, 21);
      ctx.lineTo(4, 16); ctx.closePath();
      break;
    case 'upload':
      ctx.moveTo(21, 15); ctx.lineTo(21, 19);
      ctx.arcTo(21, 21, 19, 21, 2); ctx.lineTo(5, 21);
      ctx.arcTo(3, 21, 3, 19, 2); ctx.lineTo(3, 15);
      ctx.moveTo(7, 9); ctx.lineTo(12, 3); ctx.lineTo(17, 9);
      ctx.moveTo(12, 3); ctx.lineTo(12, 16);
      break;
    case 'alert-triangle':
      ctx.moveTo(12, 3); ctx.lineTo(22, 20); ctx.lineTo(2, 20); ctx.closePath();
      ctx.moveTo(12, 9); ctx.lineTo(12, 14);
      ctx.moveTo(12, 17); ctx.lineTo(12.01, 17);
      break;
    case 'sparkles':
      ctx.moveTo(12, 3); ctx.lineTo(13.8, 8.2); ctx.lineTo(19, 10);
      ctx.lineTo(13.8, 11.8); ctx.lineTo(12, 17); ctx.lineTo(10.2, 11.8);
      ctx.lineTo(5, 10); ctx.lineTo(10.2, 8.2); ctx.closePath();
      ctx.moveTo(19, 16); ctx.lineTo(19.7, 18.3); ctx.lineTo(22, 19);
      ctx.lineTo(19.7, 19.7); ctx.lineTo(19, 22); ctx.lineTo(18.3, 19.7);
      ctx.lineTo(16, 19); ctx.lineTo(18.3, 18.3); ctx.closePath();
      break;
    case 'x':
      ctx.moveTo(18, 6); ctx.lineTo(6, 18);
      ctx.moveTo(6, 6); ctx.lineTo(18, 18);
      break;
  }
  ctx.stroke();
  ctx.restore();
}

// -------------------------------------------------------------- primitives

/**
 * `<Button>` as shadcn renders it — same radius (`--radius` 0.5rem = 8px),
 * same variants, with the press/hover states the demos animate.
 */
export function button(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string,
  o: {
    variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
    press?: number;
    hot?: number;
    disabled?: boolean;
    size?: number;
    iconName?: IconName;
    r?: number;
  } = {},
) {
  const {
    variant = 'default', press = 0, hot = 0, disabled = false,
    size = 16, iconName, r = 8,
  } = o;

  ctx.save();
  ctx.globalAlpha *= disabled ? 0.5 : 1;
  ctx.translate(0, press * 2);
  const hh = h - press * 3;

  let fill = 'transparent', stroke = '', fg = C.fg, shadow = 0;
  if (variant === 'default') {
    fill = hot > 0.02 ? C.primaryHi : C.primary;
    fg = C.primaryFg;
    shadow = 10 + hot * 14;
  } else if (variant === 'outline') {
    fill = hot > 0.02 ? C.subtle : 'transparent';
    stroke = C.border;
  } else if (variant === 'secondary') {
    fill = C.subtle;
  } else if (variant === 'ghost') {
    fill = hot > 0.02 ? C.subtle : 'transparent';
    fg = C.muted;
  } else if (variant === 'destructive') {
    fill = C.red;
    fg = '#ffffff';
  }

  card(ctx, x, y, w, hh, { r, fill, stroke, lineWidth: 1, shadow });

  ctx.font = `500 ${size}px ${FONT_BODY}`;
  const tw = ctx.measureText(label).width;
  const gap = iconName ? size + 8 : 0;
  const startX = x + w / 2 - (tw + gap) / 2;
  if (iconName) icon(ctx, iconName, startX + size / 2, y + hh / 2, size + 2, fg, 2);
  text(ctx, label, startX + gap, y + hh / 2 + 1, {
    size, weight: 500, color: fg, baseline: 'middle',
  });
  ctx.restore();
}

/** `<Input>` — h-11 in the POS search, h-10 elsewhere. */
export function input(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  value: string,
  o: { placeholder?: string; focused?: boolean; iconName?: IconName; align?: CanvasTextAlign } = {},
) {
  const { placeholder = '', focused = false, iconName, align = 'left' } = o;
  card(ctx, x, y, w, h, {
    r: 8,
    fill: C.id === 'light' ? '#ffffff' : C.card,
    stroke: focused ? C.primary : C.border,
    lineWidth: focused ? 2 : 1,
  });
  const padL = iconName ? 40 : 14;
  if (iconName) icon(ctx, iconName, x + 21, y + h / 2, 16, focused ? C.primary : C.muted, 2);
  const shown = value || placeholder;
  text(
    ctx, shown,
    align === 'center' ? x + w / 2 : x + padL,
    y + h / 2 + 1,
    { size: 15, color: value ? C.fg : C.faint, baseline: 'middle', align },
  );
}

/** `<Badge>` — the pill used for Service / Out of Stock / counts. */
export function badge(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, label: string,
  o: { tone?: string; size?: number; solid?: boolean } = {},
) {
  const { tone = C.primary, size = 11, solid = false } = o;
  ctx.save();
  ctx.font = `600 ${size}px ${FONT_BODY}`;
  const w = ctx.measureText(label).width + 14;
  const h = size + 9;
  card(ctx, x, y, w, h, {
    r: h / 2,
    fill: solid ? tone : rgba(tone, 0.12),
    stroke: solid ? '' : rgba(tone, 0.3),
    lineWidth: 1,
  });
  text(ctx, label, x + w / 2, y + h / 2 + 0.5, {
    size, weight: 600, color: solid ? '#fff' : tone, align: 'center', baseline: 'middle',
  });
  ctx.restore();
  return w;
}

// -------------------------------------------------------------- POS chrome

export const POS_STEPS = ['Select Products', 'Customer', 'Payment', 'Review'];

/**
 * The POS progress rail from `src/app/(app)/sales/pos/layout.tsx`: numbered
 * circles joined by a rule, filled behind the current step, with the active and
 * upcoming step names captioned underneath.
 *
 * `current` may be fractional so the rail can animate between steps.
 */
export function posStepper(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, current: number,
) {
  const n = POS_STEPS.length;
  const gap = w / n;
  const r = 17;

  POS_STEPS.forEach((label, i) => {
    const cx = x + i * gap + r;
    const done = current > i + 0.5;
    const active = Math.round(current) === i;

    // connector to the next circle
    if (i < n - 1) {
      const fill = Math.min(1, Math.max(0, current - i));
      ctx.beginPath();
      ctx.moveTo(cx + r, y);
      ctx.lineTo(cx + gap - r, y);
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (fill > 0) {
        ctx.beginPath();
        ctx.moveTo(cx + r, y);
        ctx.lineTo(cx + r + (gap - r * 2) * fill, y);
        ctx.strokeStyle = C.primary;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fillStyle = done ? C.primary : C.bg;
    ctx.fill();
    ctx.strokeStyle = done || active ? C.primary : C.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (done) {
      icon(ctx, 'check', cx, y, 17, C.primaryFg, 2.6);
    } else {
      text(ctx, String(i + 1), cx, y + 1, {
        size: 14, weight: 500, align: 'center', baseline: 'middle',
        color: active ? C.primary : C.muted,
      });
    }

    if (!done) {
      // The real page centres each caption under its circle
      // (`left-1/2 -translate-x-1/2`) and lets it overhang the rail. On canvas
      // the shell clips, so the first and last captions get shaved — nudge them
      // back inside instead of losing half the word.
      ctx.save();
      ctx.font = `${active ? 600 : 400} 13px ${FONT_BODY}`;
      const halfW = ctx.measureText(label).width / 2;
      ctx.restore();
      const lx = Math.min(Math.max(cx, x + halfW), x + w - halfW);
      text(ctx, label, lx, y + 40, {
        size: 13, weight: active ? 600 : 400, align: 'center', baseline: 'middle',
        color: active ? C.primary : C.muted,
      });
    }
  });
}

/**
 * The app shell: sidebar rail + top bar, so a demo frame reads as "inside
 * Zeneva" rather than as a floating card. Returns the content rect.
 */
export function appShell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  pageTitle: string,
  activeNav: number,
) {
  const barH = 42;
  const railW = 62;

  card(ctx, x, y, w, h, { r: 16, fill: C.bg, stroke: C.border, shadow: 44 });

  ctx.save();
  roundRectPath(ctx, x, y, w, h, 16);
  ctx.clip();

  // window title bar
  ctx.fillStyle = C.bar;
  ctx.fillRect(x, y, w, barH);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(x + 24 + i * 20, y + barH / 2, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
  text(ctx, pageTitle, x + w / 2, y + barH / 2, {
    size: 14, weight: 500, color: C.muted, align: 'center', baseline: 'middle',
  });
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + barH); ctx.lineTo(x + w, y + barH);
  ctx.stroke();

  // sidebar rail
  const railY = y + barH;
  const railH = h - barH;
  ctx.fillStyle = C.id === 'light' ? '#fbfaf9' : '#0c0c0e';
  ctx.fillRect(x, railY, railW, railH);
  ctx.beginPath();
  ctx.moveTo(x + railW, railY); ctx.lineTo(x + railW, railY + railH);
  ctx.strokeStyle = C.border;
  ctx.stroke();

  const navIcons: IconName[] = ['boxes', 'shopping-cart', 'package', 'user', 'file-text', 'sparkles'];
  navIcons.forEach((n, i) => {
    const iy = railY + 46 + i * 52;
    if (i === activeNav) {
      card(ctx, x + 11, iy - 18, railW - 22, 36, {
        r: 9, fill: rgba(C.primary, 0.14), stroke: '',
      });
    }
    icon(ctx, n, x + railW / 2, iy, 20, i === activeNav ? C.primary : C.muted, 2);
  });

  ctx.restore();
  return { x: x + railW, y: y + barH, w: w - railW, h: h - barH };
}

/** The success toast from `useToast` — bottom-right, slide-in. */
export function toast(
  ctx: CanvasRenderingContext2D,
  right: number, bottom: number,
  title: string, body: string,
  t: number,
  tone = C.green,
) {
  if (t <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, t * 1.4);
  ctx.font = `400 14px ${FONT_BODY}`;
  const w = Math.max(300, ctx.measureText(body).width + 78);
  const h = 74;
  const x = right - w + (1 - t) * 40;
  const y = bottom - h;
  card(ctx, x, y, w, h, { r: 10, fill: C.card, stroke: rgba(tone, 0.45), lineWidth: 1.5, shadow: 26 });
  ctx.beginPath();
  ctx.arc(x + 32, y + h / 2, 13, 0, Math.PI * 2);
  ctx.fillStyle = rgba(tone, 0.16);
  ctx.fill();
  icon(ctx, 'check', x + 32, y + h / 2, 15, tone, 2.6);
  text(ctx, title, x + 56, y + 28, { size: 15, weight: 600 });
  text(ctx, body, x + 56, y + 50, { size: 13.5, color: C.muted });
  ctx.restore();
}
