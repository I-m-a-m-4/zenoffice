/**
 * "A sale, start to finish" — the POS flow, drawn against the real page code.
 *
 * Layouts mirror `src/app/(app)/sales/pos/*` screen for screen:
 *
 *   - `layout.tsx`: the four-step progress rail (Select Products → Customer →
 *     Payment → Review), filled behind the current step.
 *   - `select-products`: the sticky search row with the magnifier, Filter and
 *     column-count buttons, the product grid with photo / name / price / add
 *     button, and the sticky Cart card with Hold + Clear Cart, per-line qty
 *     inputs, Subtotal, and the full-width "Next: Customer" button.
 *   - `customer`: the walk-in card with "New Customer".
 *   - `payment`: the four method cards (Cash, Card, Bank Transfer, Invoice)
 *     with their lucide icons and sub-labels, the Discount & Tax card, and the
 *     Order Summary column (Subtotal / Tax / Discount / Total, Print Receipt,
 *     "Review & Complete").
 *
 * Everything is a redraw rather than a screen recording on purpose: it stays
 * legible at 4K, needs no seed data, and never leaks a real business's
 * catalogue into a marketing asset.
 */

import {
  C, applyTheme, STAGE, s, card, text, paragraph, rgba, roundRectPath, cursor,
  ripple, click, glide, prog, pulse, easeOut, easeOutQuint, easeInOut, lerp, osc,
  typed, check, zenMark, clipContent, backdrop, titleCard, endCard, caption,
  FONT_DISPLAY, type Demo, type Theme,
} from './anim';
import { icon, button, input, badge, posStepper, appShell, toast, type IconName } from './ui';

const CURRENCY = '₦';
const wipeOut = (t: number) => t * t;

type Product = { name: string; price: number; stock: number; tag?: string; hue: string };

const CATALOG: Product[] = [
  { name: 'Ankara Wax Print — 6 yards', price: 18500, stock: 24, hue: '#e0632a' },
  { name: 'Rice — 50kg Bag', price: 78000, stock: 12, hue: '#8b5cf6' },
  { name: 'Bluetooth Earbuds Pro', price: 27900, stock: 40, hue: '#3b82f6' },
  { name: 'Shea Butter 500g', price: 4200, stock: 61, hue: '#c9a227' },
  { name: 'Cooking Gas Refill 12.5kg', price: 14300, stock: 18, hue: '#0ea5e9' },
  { name: 'Phone Repair', price: 9000, stock: 0, tag: 'Service', hue: '#14b8a6' },
];

const PICKS = [
  { idx: 0, qty: 2, at: s(3.9) },
  { idx: 2, qty: 1, at: s(5.7) },
  { idx: 4, qty: 1, at: s(7.4) },
];

const T = {
  titleIn: s(0.4),
  titleHold: s(2.2),
  titleOut: s(2.9),
  shellIn: s(2.6),
  search: s(3.1),
  cartReview: s(8.4),
  nextClick: s(9.5),
  custScene: s(10.2),
  custNext: s(13.0),
  payScene: s(13.8),
  cashClick: s(15.6),
  print: s(16.6),
  confirm: s(18.0),
  done: s(18.8),
  endIn: s(21.8),
  total: s(24.2),
};

const money = (n: number) => `${CURRENCY}${n.toLocaleString()}`;

/** Cart contents as of `frame` — derived from PICKS so it can never desync. */
function cartAt(frame: number) {
  return PICKS.filter((p) => frame >= p.at).map((p) => ({
    ...CATALOG[p.idx],
    qty: p.qty,
    addedAt: p.at,
  }));
}

const subtotalAt = (frame: number) =>
  cartAt(frame).reduce((sum, i) => sum + i.price * i.qty, 0);

/** Frozen once the cart is final, so later screens can't drift from it. */
const CART_TOTAL = 18500 * 2 + 27900 + 14300;

// ------------------------------------------------------------------ pieces

function productTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  item: Product, hot: number, pressed: number,
) {
  ctx.save();
  ctx.translate(0, -hot * 5);
  card(ctx, x, y, w, h, {
    r: 12,
    fill: hot > 0.02 ? C.cardLift : C.card,
    stroke: hot > 0.02 ? rgba(C.primary, 0.5) : C.border,
    lineWidth: hot > 0.02 ? 1.5 : 1,
    shadow: hot * 22,
  });

  const th = h * 0.46;
  ctx.save();
  roundRectPath(ctx, x + 10, y + 10, w - 20, th, 10);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + th);
  g.addColorStop(0, rgba(item.hue, 0.36));
  g.addColorStop(1, rgba(item.hue, 0.12));
  ctx.fillStyle = g;
  ctx.fillRect(x + 10, y + 10, w - 20, th);
  text(ctx, item.name[0], x + w / 2, y + 10 + th / 2, {
    size: 44, weight: 700, family: FONT_DISPLAY, color: rgba(item.hue, 0.9),
    align: 'center', baseline: 'middle',
  });
  ctx.restore();

  paragraph(ctx, item.name, x + 12, y + th + 34, w - 24, 20, { size: 14, weight: 500 });

  if (item.tag) {
    badge(ctx, x + 12, y + h - 34, item.tag, { tone: C.blue });
  } else if (item.stock <= 0) {
    badge(ctx, x + 12, y + h - 34, 'Out of Stock', { tone: C.red });
  }

  text(ctx, money(item.price), x + 12, y + h - 16, {
    size: 20, weight: 700, family: FONT_DISPLAY,
  });

  // h-11 w-11 rounded-lg outline button with PlusCircle
  const bx = x + w - 42, by = y + h - 40;
  ctx.save();
  ctx.translate(0, pressed * 2);
  card(ctx, bx, by, 32, 32 - pressed * 2, {
    r: 8,
    fill: hot > 0.02 ? C.primary : 'transparent',
    stroke: hot > 0.02 ? C.primary : C.border,
    lineWidth: 1,
  });
  icon(ctx, 'plus-circle', bx + 16, by + 16, 20, hot > 0.02 ? C.primaryFg : C.fg, 2);
  ctx.restore();
  ctx.restore();
}

const GRID = { cols: 3, gap: 16, tileH: 206 };

function tileRect(area: { x: number; y: number; w: number }, i: number) {
  const w = (area.w - GRID.gap * (GRID.cols - 1)) / GRID.cols;
  const col = i % GRID.cols, row = Math.floor(i / GRID.cols);
  return { x: area.x + col * (w + GRID.gap), y: area.y + row * (GRID.tileH + GRID.gap), w, h: GRID.tileH };
}

function cartPanel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  frame: number, nextPress: number, nextHot: number,
) {
  card(ctx, x, y, w, h, { r: 12, fill: C.card, stroke: C.border, lineWidth: 1 });

  icon(ctx, 'shopping-cart', x + 30, y + 26, 19, C.fg, 2);
  text(ctx, 'Cart', x + 48, y + 27, {
    size: 18, weight: 700, family: FONT_DISPLAY, baseline: 'middle',
  });

  const items = cartAt(frame);
  if (items.length === 0) {
    icon(ctx, 'shopping-cart', x + w / 2, y + h * 0.3, 34, C.faint, 1.6);
    text(ctx, 'Your cart is empty.', x + w / 2, y + h * 0.3 + 48, {
      size: 15, color: C.muted, align: 'center',
    });
  } else {
    // Hold / Clear Cart row
    button(ctx, x + 18, y + 52, 72, 30, 'Hold', { variant: 'outline', size: 12, iconName: 'archive' });
    button(ctx, x + w - 112, y + 52, 94, 30, 'Clear Cart', {
      variant: 'ghost', size: 12, iconName: 'trash',
    });
  }

  let ly = y + 104;
  items.forEach((item) => {
    const a = prog(frame, item.addedAt, item.addedAt + s(0.4), easeOutQuint);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate((1 - a) * 40, 0);
    // name gets the full width; the qty control sits on the row beneath it, so
    // a long product name never runs under the input
    paragraph(ctx, item.name, x + 18, ly, w - 40, 19, { size: 14, weight: 500 });
    text(ctx, money(item.price * item.qty), x + 18, ly + 46, {
      size: 14, weight: 600, baseline: 'middle',
    });
    input(ctx, x + w - 104, ly + 30, 52, 30, String(item.qty), { align: 'center' });
    icon(ctx, 'trash', x + w - 32, ly + 45, 15, C.red, 2);
    ctx.restore();
    ly += 78;
  });

  // Subtotal
  const ty = y + h - 96;
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 18, ty); ctx.lineTo(x + w - 18, ty);
  ctx.stroke();

  text(ctx, 'Subtotal', x + 18, ty + 28, { size: 16, weight: 600, baseline: 'middle' });
  const total = subtotalAt(frame);
  const last = items.length ? items[items.length - 1] : null;
  const settle = last ? prog(frame, last.addedAt, last.addedAt + s(0.4), easeOut) : 1;
  const prev = last ? total - last.price * last.qty : 0;
  text(ctx, money(Math.round(lerp(prev, total, settle))), x + w - 18, ty + 28, {
    size: 22, weight: 700, family: FONT_DISPLAY, align: 'right', baseline: 'middle',
  });

  // Next: Customer
  const bx = x + 18, by = y + h - 58, bw = w - 36, bh = 42;
  const enabled = items.length > 0;
  ctx.save();
  ctx.translate(0, nextPress * 2);
  card(ctx, bx, by, bw, bh - nextPress * 3, {
    r: 8,
    fill: enabled ? (nextHot > 0.02 ? C.primaryHi : C.primary) : C.subtle,
    stroke: '',
    shadow: enabled ? 12 + nextHot * 12 : 0,
  });
  text(ctx, 'Next: Customer', bx + bw / 2, by + bh / 2 - nextPress * 1.5, {
    size: 15, weight: 500, color: enabled ? C.primaryFg : C.faint,
    align: 'center', baseline: 'middle',
  });
  ctx.restore();
}

// ------------------------------------------------------------------ scenes

/** Geometry shared by the painter and the cursor, so they cannot disagree. */
function selectLayout() {
  const shell = { x: 60 + 62, y: 64 + 42, w: STAGE.w - 120 - 62, h: STAGE.h - 150 - 42 };
  const pad = 24, cartW = 322;
  const leftW = shell.w - pad * 3 - cartW;
  return {
    shell, pad, cartW, leftW,
    search: { x: shell.x + pad, y: shell.y + 74, w: leftW, h: 42 },
    grid: { x: shell.x + pad, y: shell.y + 74 + 42 + 16, w: leftW },
    cartX: shell.x + shell.w - cartW - pad,
    cartY: shell.y + pad,
    cartH: shell.h - pad * 2,
  };
}

function drawSelectScene(ctx: CanvasRenderingContext2D, frame: number) {
  appShell(ctx, 60, 64, STAGE.w - 120, STAGE.h - 150, 'Zeneva — Point of Sale', 1);
  const L = selectLayout();
  ctx.save();
  clipContent(ctx, L.shell);

  posStepper(ctx, L.shell.x + L.pad, L.shell.y + 30, L.leftW, 0);

  const focused = frame >= T.search && frame < T.search + s(1.7);
  const q = typed('ankara', prog(frame, T.search, T.search + s(0.8)), frame);
  input(ctx, L.search.x, L.search.y, L.search.w - 196, L.search.h, q, {
    placeholder: 'Search name or SKU...',
    focused,
    iconName: 'search',
  });
  button(ctx, L.search.x + L.search.w - 190, L.search.y, 84, L.search.h, 'Filter', {
    variant: 'outline', size: 13, iconName: 'list-filter',
  });
  button(ctx, L.search.x + L.search.w - 100, L.search.y, 100, L.search.h, '3 Columns', {
    variant: 'outline', size: 13, iconName: 'columns',
  });

  CATALOG.forEach((item, i) => {
    const r = tileRect(L.grid, i);
    const pick = PICKS.find((p) => p.idx === i);
    const hot = pick ? pulse(frame, pick.at - s(0.5), pick.at + s(0.5), s(0.22)) : 0;
    const press = pick ? click(frame, pick.at).press : 0;
    productTile(ctx, r.x, r.y, r.w, r.h, item, hot, press);
  });

  const nextC = click(frame, T.nextClick);
  const nextHot = pulse(frame, T.nextClick - s(0.6), T.nextClick + s(0.4), s(0.25));
  cartPanel(ctx, L.cartX, L.cartY, L.cartW, L.cartH, frame, nextC.press, nextHot);

  // "+N" chips flying tile -> cart
  PICKS.forEach((p) => {
    const t = prog(frame, p.at, p.at + s(0.5), easeInOut);
    if (t <= 0 || t >= 1) return;
    const r = tileRect(L.grid, p.idx);
    const [fx, fy] = glide([r.x + r.w - 26, r.y + r.h - 24], [L.cartX + 40, L.cartY + 26], t, 0.28);
    ctx.save();
    ctx.globalAlpha = 1 - Math.pow(t, 3);
    const k = lerp(1, 0.5, t);
    card(ctx, fx - 24 * k, fy - 14 * k, 48 * k, 28 * k, {
      r: 14 * k, fill: C.primary, stroke: '', shadow: 14,
    });
    text(ctx, `+${p.qty}`, fx, fy, {
      size: 15 * k, weight: 700, color: C.primaryFg, align: 'center', baseline: 'middle',
    });
    ctx.restore();
  });

  ctx.restore();
}

function customerLayout() {
  const shell = { x: 60 + 62, y: 64 + 42, w: STAGE.w - 120 - 62, h: STAGE.h - 150 - 42 };
  const pad = 24;
  const cw = Math.min(760, shell.w - pad * 2);
  return {
    shell, pad, cw,
    cx: shell.x + (shell.w - cw) / 2,
    cy: shell.y + 96,
    ch: 316,
  };
}

function drawCustomerScene(ctx: CanvasRenderingContext2D, frame: number) {
  appShell(ctx, 60, 64, STAGE.w - 120, STAGE.h - 150, 'Zeneva — Customer', 1);
  const L = customerLayout();
  ctx.save();
  clipContent(ctx, L.shell);

  posStepper(ctx, L.shell.x + L.pad, L.shell.y + 30, L.shell.w - L.pad * 2, 1);

  card(ctx, L.cx, L.cy, L.cw, L.ch, { r: 12, fill: C.card, stroke: C.border, lineWidth: 1 });
  text(ctx, 'Customer', L.cx + 24, L.cy + 30, { size: 17, weight: 700, family: FONT_DISPLAY });
  text(ctx, 'Attach this sale to a customer, or continue as a walk-in.', L.cx + 24, L.cy + 56, {
    size: 13, color: C.muted,
  });

  const a = prog(frame, T.custScene, T.custScene + s(0.5), easeOutQuint);
  ctx.save();
  ctx.globalAlpha = a;
  icon(ctx, 'user', L.cx + L.cw / 2, L.cy + 130, 46, C.muted, 1.7);
  text(ctx, 'Walk-in customer', L.cx + L.cw / 2, L.cy + 186, {
    size: 22, weight: 600, align: 'center', baseline: 'middle',
  });
  text(ctx, 'No details needed — 0 loyalty points earned', L.cx + L.cw / 2, L.cy + 216, {
    size: 14, color: C.muted, align: 'center', baseline: 'middle',
  });
  button(ctx, L.cx + L.cw / 2 - 130, L.cy + 244, 260, 44, 'New Customer', {
    variant: 'outline', size: 15, iconName: 'user-plus',
  });
  ctx.restore();

  const cc = click(frame, T.custNext);
  const chot = pulse(frame, T.custNext - s(0.6), T.custNext + s(0.3), s(0.25));
  ctx.save();
  ctx.translate(0, cc.press * 2);
  card(ctx, L.cx + L.cw / 2 - 170, L.cy + L.ch + 26, 340, 46 - cc.press * 3, {
    r: 8, fill: chot > 0.02 ? C.primaryHi : C.primary, stroke: '', shadow: 12 + chot * 12,
  });
  text(ctx, 'Next: Payment', L.cx + L.cw / 2, L.cy + L.ch + 26 + 23 - cc.press * 1.5, {
    size: 16, weight: 500, color: C.primaryFg, align: 'center', baseline: 'middle',
  });
  ctx.restore();

  ctx.restore();
}

const METHODS: { name: string; sub: string; ic: IconName }[] = [
  { name: 'Cash', sub: 'Direct Cash Payment', ic: 'banknote' },
  { name: 'Card', sub: 'POS Card Payment', ic: 'credit-card' },
  { name: 'Bank Transfer', sub: 'Direct Bank Deposit', ic: 'landmark' },
  { name: 'Invoice', sub: 'Pay Later / Credit', ic: 'file-text' },
];

function paymentLayout() {
  const shell = { x: 60 + 62, y: 64 + 42, w: STAGE.w - 120 - 62, h: STAGE.h - 150 - 42 };
  const pad = 24, sumW = 320;
  const leftW = shell.w - pad * 3 - sumW;
  const mgap = 12, mcw = (leftW - 44 - mgap * 3) / 4;
  return {
    shell, pad, sumW, leftW, mgap, mcw,
    leftX: shell.x + pad,
    cardY: shell.y + 82,
    mTop: shell.y + 82 + 74,
    mh: 118,
    sumX: shell.x + shell.w - sumW - pad,
    sumY: shell.y + 82,
    sumH: shell.h - 82 - pad + 42,
  };
}

function drawPaymentScene(ctx: CanvasRenderingContext2D, frame: number) {
  appShell(ctx, 60, 64, STAGE.w - 120, STAGE.h - 150, 'Zeneva — Payment', 1);
  const L = paymentLayout();
  ctx.save();
  clipContent(ctx, L.shell);

  posStepper(ctx, L.leftX, L.shell.y + 30, L.leftW, 2);

  // Payment Method card
  const pmH = 216;
  card(ctx, L.leftX, L.cardY, L.leftW, pmH, { r: 12, fill: C.card, stroke: C.border, lineWidth: 1 });
  text(ctx, 'Payment Method', L.leftX + 22, L.cardY + 30, {
    size: 17, weight: 700, family: FONT_DISPLAY,
  });
  text(ctx, 'Select how the customer will pay.', L.leftX + 22, L.cardY + 54, {
    size: 13, color: C.muted,
  });

  const cashClick = click(frame, T.cashClick);
  METHODS.forEach((m, i) => {
    const selected = i === 0 && frame >= T.cashClick;
    const hot = i === 0 ? pulse(frame, T.cashClick - s(0.5), T.cashClick + s(0.3), s(0.2)) : 0;
    const mx = L.leftX + 22 + i * (L.mcw + L.mgap);
    const press = i === 0 ? cashClick.press : 0;
    ctx.save();
    ctx.translate(0, press * 2);
    card(ctx, mx, L.mTop, L.mcw, L.mh - press * 3, {
      r: 8,
      fill: selected ? rgba(C.primary, 0.07) : C.card,
      stroke: selected || hot > 0.02 ? C.primary : C.border,
      lineWidth: selected ? 2 : 1,
    });
    icon(ctx, m.ic, mx + L.mcw / 2, L.mTop + 36, 30, selected ? C.primary : C.fg, 1.8);
    text(ctx, m.name, mx + L.mcw / 2, L.mTop + 74, {
      size: 14, weight: 600, align: 'center', baseline: 'middle',
      color: selected ? C.primary : C.fg,
    });
    text(ctx, m.sub, mx + L.mcw / 2, L.mTop + 96, {
      size: 10, color: C.muted, align: 'center', baseline: 'middle',
    });
    ctx.restore();
  });

  // Discount & Tax card
  const dTop = L.cardY + pmH + 16;
  card(ctx, L.leftX, dTop, L.leftW, 132, { r: 12, fill: C.card, stroke: C.border, lineWidth: 1 });
  text(ctx, 'Discount & Tax', L.leftX + 22, dTop + 30, { size: 17, weight: 700, family: FONT_DISPLAY });
  text(ctx, 'Apply discounts or adjust tax rates for this sale.', L.leftX + 22, dTop + 54, {
    size: 13, color: C.muted,
  });
  const half = (L.leftW - 56) / 2;
  text(ctx, `Discount (${CURRENCY})`, L.leftX + 22, dTop + 80, { size: 12.5, weight: 500 });
  input(ctx, L.leftX + 22, dTop + 90, half, 36, '0');
  text(ctx, 'Tax Rate (%)', L.leftX + 34 + half, dTop + 80, { size: 12.5, weight: 500 });
  input(ctx, L.leftX + 34 + half, dTop + 90, half, 36, '0');

  // Order Summary
  card(ctx, L.sumX, L.sumY, L.sumW, L.sumH, { r: 12, fill: C.card, stroke: C.border, lineWidth: 1 });
  text(ctx, 'Order Summary', L.sumX + 22, L.sumY + 30, { size: 17, weight: 700, family: FONT_DISPLAY });

  const rows: [string, string, string][] = [
    ['Subtotal', money(CART_TOTAL), C.fg],
    ['Tax', `${CURRENCY}0.00`, C.fg],
    ['Discount', `-${CURRENCY}0.00`, C.red],
  ];
  rows.forEach(([k, v, col], i) => {
    const ry = L.sumY + 70 + i * 32;
    text(ctx, k, L.sumX + 22, ry, { size: 14, color: C.muted, baseline: 'middle' });
    text(ctx, v, L.sumX + L.sumW - 22, ry, {
      size: 14, weight: 500, color: col, align: 'right', baseline: 'middle',
    });
  });

  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.sumX + 18, L.sumY + 180); ctx.lineTo(L.sumX + L.sumW - 18, L.sumY + 180);
  ctx.stroke();

  text(ctx, 'Total', L.sumX + 22, L.sumY + 212, { size: 18, weight: 700, baseline: 'middle' });
  text(ctx, money(CART_TOTAL), L.sumX + L.sumW - 22, L.sumY + 212, {
    size: 24, weight: 700, family: FONT_DISPLAY, align: 'right', baseline: 'middle',
  });

  ctx.beginPath();
  ctx.moveTo(L.sumX + 18, L.sumY + 240); ctx.lineTo(L.sumX + L.sumW - 18, L.sumY + 240);
  ctx.strokeStyle = C.border;
  ctx.stroke();

  // Print Receipt checkbox
  const printed = frame >= T.print;
  text(ctx, 'Print Receipt', L.sumX + 22, L.sumY + 270, { size: 14, weight: 500, baseline: 'middle' });
  card(ctx, L.sumX + L.sumW - 42, L.sumY + 260, 20, 20, {
    r: 4, fill: printed ? C.primary : 'transparent', stroke: printed ? C.primary : C.border, lineWidth: 1.5,
  });
  if (printed) {
    const t = prog(frame, T.print, T.print + s(0.25));
    ctx.save();
    ctx.globalAlpha = t;
    icon(ctx, 'check', L.sumX + L.sumW - 32, L.sumY + 270, 14, C.primaryFg, 3);
    ctx.restore();
  }

  // full-width CTA (h-12 text-lg)
  const cc = click(frame, T.confirm);
  const chot = pulse(frame, T.confirm - s(0.6), T.confirm + s(0.3), s(0.25));
  const cbw = L.sumW - 44;
  const cby = L.sumY + L.sumH - 112;
  ctx.save();
  ctx.translate(0, cc.press * 2);
  card(ctx, L.sumX + 22, cby, cbw, 48 - cc.press * 3, {
    r: 8, fill: chot > 0.02 ? C.primaryHi : C.primary, stroke: '', shadow: 14 + chot * 12,
  });
  text(ctx, printed ? 'Finalize & Print' : 'Review & Complete', L.sumX + 22 + cbw / 2, cby + 24 - cc.press * 1.5, {
    size: 17, weight: 500, color: C.primaryFg, align: 'center', baseline: 'middle',
  });
  ctx.restore();
  button(ctx, L.sumX + 22, cby + 58, cbw, 42, 'Back', { variant: 'outline', size: 15 });

  ctx.restore();
}

function drawDoneScene(ctx: CanvasRenderingContext2D, frame: number) {
  const shell = appShell(ctx, 60, 64, STAGE.w - 120, STAGE.h - 150, 'Zeneva — Review', 1);
  ctx.save();
  clipContent(ctx, shell);
  const cx = shell.x + shell.w / 2;

  posStepper(ctx, shell.x + 24, shell.y + 30, shell.w - 48, 3);

  const t = prog(frame, T.done, T.done + s(0.6), easeOutQuint);
  ctx.save();
  ctx.globalAlpha = t;
  check(ctx, cx, shell.y + 130, 44, prog(frame, T.done + s(0.1), T.done + s(0.8)));
  text(ctx, 'Sale Recorded', cx, shell.y + 212, {
    size: 36, weight: 700, family: FONT_DISPLAY, align: 'center', baseline: 'middle',
  });
  text(ctx, 'Receipt 100481 generated · Stock deducted · Books balanced', cx, shell.y + 250, {
    size: 16, color: C.muted, align: 'center', baseline: 'middle',
  });
  ctx.restore();

  const rt = prog(frame, T.done + s(0.5), T.done + s(1.3), easeOutQuint);
  if (rt > 0) {
    const rw = 330, rh = 250;
    const rx = cx - rw / 2, ry = shell.y + 288 + (1 - rt) * 70;
    ctx.save();
    ctx.globalAlpha = rt;
    card(ctx, rx, ry, rw, rh, {
      r: 10, fill: '#fbfbf8', stroke: 'rgba(0,0,0,0.14)', lineWidth: 1, shadow: 30,
    });
    zenMark(ctx, rx + rw / 2, ry + 32, 25);
    text(ctx, 'ZENEVA', rx + rw / 2, ry + 58, {
      size: 12.5, weight: 700, color: '#333', align: 'center', baseline: 'middle',
    });
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(rx + 18, ry + 74); ctx.lineTo(rx + rw - 18, ry + 74);
    ctx.stroke();
    ctx.setLineDash([]);

    let ly = ry + 96;
    cartAt(T.cartReview).forEach((item) => {
      text(ctx, `${item.qty}× ${item.name.split('—')[0].trim()}`, rx + 18, ly, {
        size: 11.5, color: '#444', maxWidth: rw - 120,
      });
      text(ctx, money(item.price * item.qty), rx + rw - 18, ly, {
        size: 11.5, weight: 600, color: '#222', align: 'right',
      });
      ly += 24;
    });
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    ctx.moveTo(rx + 18, ly + 4); ctx.lineTo(rx + rw - 18, ly + 4);
    ctx.stroke();
    text(ctx, 'TOTAL', rx + 18, ly + 32, { size: 13.5, weight: 700, color: '#111' });
    text(ctx, money(CART_TOTAL), rx + rw - 18, ly + 32, {
      size: 16, weight: 700, color: '#111', align: 'right', family: FONT_DISPLAY,
    });
    text(ctx, 'Thank you!', rx + rw / 2, ry + rh - 20, {
      size: 11.5, color: '#777', align: 'center',
    });
    ctx.restore();
  }
  ctx.restore();

  // the real success toast
  toast(
    ctx, shell.x + shell.w - 26, shell.y + shell.h - 22,
    'Sale Recorded', 'Receipt 100481 generated.',
    prog(frame, T.done + s(0.6), T.done + s(1.1), easeOutQuint),
  );
}

/**
 * Scene table. Each entry owns the frame range from its `at` up to the next
 * one's, and scenes cross-dissolve: during the first `XFADE` frames the
 * outgoing scene is still painted underneath at full opacity while the incoming
 * one fades up over it. Fading the outgoing scene *out* as well leaves both at
 * zero alpha on the boundary frame, which showed up as a blank flash.
 */
const XFADE = s(0.25);

const SCENES: { at: number; draw: (ctx: CanvasRenderingContext2D, frame: number) => void }[] = [
  { at: 0, draw: drawSelectScene },
  { at: T.custScene, draw: drawCustomerScene },
  { at: T.payScene, draw: drawPaymentScene },
  { at: T.done, draw: drawDoneScene },
];

function drawScenes(ctx: CanvasRenderingContext2D, frame: number) {
  let idx = 0;
  for (let i = 0; i < SCENES.length; i++) if (frame >= SCENES[i].at) idx = i;

  const fade = idx === 0 ? 1 : prog(frame, SCENES[idx].at, SCENES[idx].at + XFADE, easeInOut);
  if (idx > 0 && fade < 1) SCENES[idx - 1].draw(ctx, frame);

  ctx.save();
  ctx.globalAlpha = fade;
  SCENES[idx].draw(ctx, frame);
  ctx.restore();
}

// ------------------------------------------------------------------ cursor

function cursorAt(frame: number) {
  const S = selectLayout();
  const Cu = customerLayout();
  const P = paymentLayout();

  const tileBtn = (i: number) => {
    const r = tileRect(S.grid, i);
    return [r.x + r.w - 26, r.y + r.h - 24] as [number, number];
  };

  const keys: { at: number; p: [number, number] }[] = [
    { at: T.shellIn + s(0.4), p: [S.shell.x + S.shell.w * 0.5, S.shell.y + S.shell.h + 70] },
    { at: T.search, p: [S.search.x + 140, S.search.y + 21] },
    { at: PICKS[0].at, p: tileBtn(PICKS[0].idx) },
    { at: PICKS[1].at, p: tileBtn(PICKS[1].idx) },
    { at: PICKS[2].at, p: tileBtn(PICKS[2].idx) },
    { at: T.nextClick, p: [S.cartX + S.cartW / 2, S.cartY + S.cartH - 58 + 21] },
    { at: T.custNext, p: [Cu.cx + Cu.cw / 2, Cu.cy + Cu.ch + 26 + 23] },
    { at: T.cashClick, p: [P.leftX + 22 + P.mcw / 2, P.mTop + P.mh / 2] },
    { at: T.confirm, p: [P.sumX + P.sumW / 2, P.sumY + P.sumH - 112 + 24] },
  ];

  const alpha =
    prog(frame, T.shellIn + s(0.3), T.shellIn + s(0.8)) *
    (1 - prog(frame, T.done - s(0.25), T.done + s(0.1), easeOut));

  let pos: [number, number] = keys[0].p;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], next = keys[i + 1];
    if (!next) { pos = k.p; break; }
    if (frame < next.at) {
      const t = prog(frame, k.at + s(0.28), next.at - s(0.1), easeInOut);
      pos = glide(k.p, next.p, t, 0.15);
      break;
    }
  }

  const drift = alpha > 0 ? [osc(frame, 97, 1.6), osc(frame, 73, 1.2, 1.1)] : [0, 0];
  const presses = [...PICKS.map((p) => p.at), T.nextClick, T.custNext, T.cashClick, T.confirm];
  const press = Math.max(0, ...presses.map((at) => click(frame, at).press));
  return { x: pos[0] + drift[0], y: pos[1] + drift[1], press, alpha, presses };
}

// ------------------------------------------------------------------ demo

export const posDemo: Demo = {
  id: 'pos-flow',
  title: 'A sale, start to finish',
  blurb:
    'The full checkout — search the catalogue, add to cart, walk-in customer, ' +
    'take payment, print the receipt. Drawn from the real POS screens.',
  frames: T.total,
  chapters: [
    { label: 'Open', at: 0 },
    { label: 'Search', at: T.search },
    { label: 'Add to cart', at: PICKS[0].at },
    { label: 'Customer', at: T.custScene },
    { label: 'Payment', at: T.payScene },
    { label: 'Recorded', at: T.done },
    { label: 'End card', at: T.endIn },
  ],
  draw(ctx, frame, theme) {
    applyTheme(theme);
    backdrop(ctx, frame);
    drawScenes(ctx, frame);

    const caps: [string, number, number][] = [
      ['Search your whole catalogue — offline included', T.search - s(0.2), PICKS[0].at - s(0.3)],
      ['Tap to add. Stock and totals update instantly', PICKS[0].at, T.nextClick - s(0.3)],
      ['Walk-ins never slow the queue down', T.custScene + s(0.5), T.custNext - s(0.2)],
      ['Cash, card, transfer or invoice — all in one step', T.payScene + s(0.5), T.confirm - s(0.2)],
      ['Receipt printed, stock deducted, books balanced', T.done + s(0.7), T.endIn - s(0.4)],
    ];
    caps.forEach(([str, a, b]) => caption(ctx, str, pulse(frame, a, b, s(0.3))));

    const c = cursorAt(frame);
    if (c.alpha > 0.01) {
      c.presses.forEach((at) => {
        const r = click(frame, at).ripple;
        if (r > 0 && r < 1) ripple(ctx, c.x, c.y, r);
      });
      cursor(ctx, c.x, c.y, { press: c.press, alpha: c.alpha });
    }

    titleCard(
      ctx, 'One tap to sold.', 'Zeneva Point of Sale',
      prog(frame, T.titleIn, T.titleHold, easeOut),
      prog(frame, T.titleHold, T.titleOut, wipeOut),
      frame,
    );
    endCard(ctx, 'Sell anywhere. Even offline.', 'Start free',
      prog(frame, T.endIn, T.endIn + s(0.6)), frame);
  },
};
