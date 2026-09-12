/**
 * "Stock that keeps itself honest" — the inventory flow.
 *
 * Layout mirrors `src/app/(app)/inventory/page.tsx`:
 *
 *   - the health tiles row (Out of Stock / Low Stock (≤5) / Missing Images),
 *     each a clickable filter Card with the big coloured figure over a small
 *     uppercase tracking-wider label;
 *   - the "Products" Card with its "Manage your products and view their sales
 *     performance." description;
 *   - the real table columns — checkbox, image, Name, Status, Price, Stock,
 *     Actions — with the Status badge logic from line 877 of that page
 *     (Service / In Stock / Out of Stock);
 *   - the toolbar: Search products…, Filter, Import, Add Product.
 *
 * The beat it sells: tap the Low Stock tile to filter, correct a count inline,
 * and watch the tile figure fall — the thing an owner does every morning.
 */

import {
  C, applyTheme, STAGE, s, card, text, paragraph, rgba, roundRectPath, cursor,
  ripple, click, glide, prog, pulse, easeOut, easeOutQuint, easeInOut, lerp, osc,
  typed, check, clipContent, backdrop, titleCard, endCard, caption,
  FONT_DISPLAY, type Demo,
} from './anim';
import { icon, button, input, badge, appShell, toast } from './ui';

const CURRENCY = '₦';
const wipeOut = (t: number) => t * t;
const money = (n: number) => `${CURRENCY}${n.toLocaleString()}`;

type Row = {
  name: string; sku: string; price: number; stock: number;
  service?: boolean; hue: string;
};

const ROWS: Row[] = [
  { name: 'Ankara Wax Print — 6 yards', sku: 'ANK-6Y', price: 18500, stock: 4, hue: '#e0632a' },
  { name: 'Shea Butter 500g', sku: 'SHE-500', price: 4200, stock: 3, hue: '#c9a227' },
  { name: 'Cooking Gas Refill 12.5kg', sku: 'GAS-125', price: 14300, stock: 5, hue: '#0ea5e9' },
  { name: 'Bluetooth Earbuds Pro', sku: 'BTE-PRO', price: 27900, stock: 40, hue: '#3b82f6' },
  { name: 'Rice — 50kg Bag', sku: 'RIC-50', price: 78000, stock: 12, hue: '#8b5cf6' },
  { name: 'Phone Repair', sku: 'SRV-RPR', price: 9000, stock: 0, service: true, hue: '#14b8a6' },
];

const T = {
  titleIn: s(0.4),
  titleHold: s(2.2),
  titleOut: s(2.9),
  shellIn: s(2.6),
  search: s(3.2),
  clearSearch: s(5.4),
  tileClick: s(6.2),
  filtered: s(6.5),
  qtyClick: s(8.4),
  qtyType: s(8.9),
  saved: s(10.6),
  tileDrop: s(11.0),
  toastIn: s(11.2),
  reorderScene: s(13.4),
  endIn: s(16.4),
  total: s(18.8),
};

/** Rows visible at `frame` — the Low Stock tile filters to stock ≤ 5. */
function rowsAt(frame: number) {
  if (frame < T.filtered) {
    return ROWS.filter((r) =>
      frame < T.clearSearch
        ? r.name.toLowerCase().includes('sh') || frame < T.search + s(0.6)
        : true,
    );
  }
  return ROWS.filter((r) => !r.service && r.stock <= 5);
}

/** The corrected count on the first row, once the owner has typed it. */
function stockOf(row: Row, frame: number) {
  if (row.sku !== 'ANK-6Y') return row.stock;
  if (frame < T.qtyType) return row.stock;
  const t = prog(frame, T.qtyType, T.qtyType + s(0.8));
  return Math.round(lerp(4, 46, t));
}

const lowCountAt = (frame: number) => (frame >= T.tileDrop ? 2 : 3);

// ------------------------------------------------------------------ layout

function layout() {
  const shell = { x: 60 + 62, y: 64 + 42, w: STAGE.w - 120 - 62, h: STAGE.h - 150 - 42 };
  const pad = 24;
  const innerW = shell.w - pad * 2;
  return {
    shell, pad, innerW,
    x: shell.x + pad,
    toolbarY: shell.y + 26,
    tilesY: shell.y + 84,
    tileH: 84,
    tableY: shell.y + 192,
  };
}

const TILES = [
  { label: 'Out of Stock', tone: '#dc2626', value: () => 1 },
  { label: 'Low Stock (≤5)', tone: '#ea580c', value: lowCountAt },
  { label: 'Missing Images', tone: '#2563eb', value: () => 4 },
];

function drawTiles(ctx: CanvasRenderingContext2D, frame: number) {
  const L = layout();
  const gap = 16;
  const tw = (L.innerW - gap * 2) / 3;
  TILES.forEach((tile, i) => {
    const x = L.x + i * (tw + gap);
    const selected = i === 1 && frame >= T.tileClick;
    const hot = i === 1 ? pulse(frame, T.tileClick - s(0.6), T.tileClick + s(0.3), s(0.25)) : 0;
    const press = i === 1 ? click(frame, T.tileClick).press : 0;

    ctx.save();
    ctx.translate(0, press * 2);
    card(ctx, x, L.tilesY, tw, L.tileH - press * 3, {
      r: 12,
      fill: selected ? rgba(tile.tone, 0.08) : hot > 0.02 ? rgba(tile.tone, 0.05) : C.card,
      stroke: selected ? tile.tone : C.border,
      lineWidth: selected ? 2 : 1,
    });
    const v = tile.value(frame);
    const bump = i === 1 ? 1 + pulse(frame, T.tileDrop, T.tileDrop + s(0.5), s(0.25)) * 0.12 : 1;
    ctx.save();
    ctx.translate(x + tw / 2, L.tilesY + 34);
    ctx.scale(bump, bump);
    text(ctx, String(v), 0, 0, {
      size: 30, weight: 700, family: FONT_DISPLAY, color: tile.tone,
      align: 'center', baseline: 'middle',
    });
    ctx.restore();
    text(ctx, tile.label.toUpperCase(), x + tw / 2, L.tilesY + 62, {
      size: 12, weight: 600, color: rgba(tile.tone, 0.9),
      align: 'center', baseline: 'middle', tracking: 1.4,
    });
    ctx.restore();
  });
}

const COLS = { img: 0.055, name: 0.36, status: 0.16, price: 0.15, stock: 0.14 };

function drawTable(ctx: CanvasRenderingContext2D, frame: number) {
  const L = layout();
  const h = L.shell.h - (L.tableY - L.shell.y) - L.pad;
  card(ctx, L.x, L.tableY, L.innerW, h, { r: 12, fill: C.card, stroke: C.border, lineWidth: 1 });

  text(ctx, 'Products', L.x + 22, L.tableY + 30, { size: 18, weight: 700, family: FONT_DISPLAY });
  text(ctx, 'Manage your products and view their sales performance.', L.x + 22, L.tableY + 56, {
    size: 13, color: C.muted,
  });

  const rowH = 62;
  const headY = L.tableY + 84;
  const cx = {
    check: L.x + 26,
    img: L.x + 58,
    name: L.x + 110,
    status: L.x + 22 + L.innerW * 0.46,
    price: L.x + 22 + L.innerW * 0.62,
    stock: L.x + 22 + L.innerW * 0.76,
    actions: L.x + L.innerW - 34,
  };

  // header row
  ctx.save();
  ctx.globalAlpha *= 0.9;
  card(ctx, L.x + 1, headY, L.innerW - 2, 38, { r: 0, fill: C.subtle, stroke: '' });
  ctx.restore();
  card(ctx, cx.check - 8, headY + 11, 16, 16, { r: 3, fill: 'transparent', stroke: C.border, lineWidth: 1.5 });
  ([['Image', cx.img - 12], ['Name', cx.name], ['Status', cx.status], ['Price', cx.price], ['Stock', cx.stock]] as [string, number][])
    .forEach(([label, x]) => {
      text(ctx, label, x, headY + 20, { size: 12.5, weight: 600, color: C.muted, baseline: 'middle' });
    });
  text(ctx, 'Actions', cx.actions, headY + 20, {
    size: 12.5, weight: 600, color: C.muted, align: 'right', baseline: 'middle',
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(L.x, headY + 38, L.innerW, h - (headY + 38 - L.tableY) - 2);
  ctx.clip();

  const rows = rowsAt(frame);
  rows.forEach((row, i) => {
    const y = headY + 38 + i * rowH;
    const shift = row.sku === 'ANK-6Y' ? 0 : prog(frame, T.filtered, T.filtered + s(0.4), easeOutQuint);
    const editing = row.sku === 'ANK-6Y' && frame >= T.qtyClick && frame < T.saved;

    ctx.save();
    ctx.globalAlpha *= frame >= T.filtered ? 1 : 1;
    ctx.translate(0, (1 - (shift || 1)) * -6);

    if (editing) {
      card(ctx, L.x + 1, y, L.innerW - 2, rowH, { r: 0, fill: rgba(C.primary, 0.05), stroke: '' });
    }
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L.x + 1, y + rowH); ctx.lineTo(L.x + L.innerW - 1, y + rowH);
    ctx.stroke();

    card(ctx, cx.check - 8, y + rowH / 2 - 8, 16, 16, {
      r: 3, fill: 'transparent', stroke: C.border, lineWidth: 1.5,
    });

    // product thumbnail
    const iy = y + rowH / 2 - 18;
    ctx.save();
    roundRectPath(ctx, cx.img - 18, iy, 36, 36, 7);
    ctx.clip();
    const g = ctx.createLinearGradient(cx.img - 18, iy, cx.img + 18, iy + 36);
    g.addColorStop(0, rgba(row.hue, 0.4));
    g.addColorStop(1, rgba(row.hue, 0.14));
    ctx.fillStyle = g;
    ctx.fillRect(cx.img - 18, iy, 36, 36);
    text(ctx, row.name[0], cx.img, iy + 18, {
      size: 17, weight: 700, family: FONT_DISPLAY, color: rgba(row.hue, 0.95),
      align: 'center', baseline: 'middle',
    });
    ctx.restore();

    text(ctx, row.name, cx.name, y + rowH / 2 - 8, {
      size: 14.5, weight: 500, baseline: 'middle', maxWidth: L.innerW * 0.3,
    });
    text(ctx, row.sku, cx.name, y + rowH / 2 + 12, {
      size: 12, color: C.muted, baseline: 'middle',
    });

    const stock = stockOf(row, frame);
    const label = row.service ? 'Service' : stock > 0 ? 'In Stock' : 'Out of Stock';
    const tone = row.service ? C.blue : stock > 5 ? C.green : stock > 0 ? '#ea580c' : C.red;
    badge(ctx, cx.status, y + rowH / 2 - 10, label, { tone });

    text(ctx, money(row.price), cx.price, y + rowH / 2, {
      size: 14, weight: 500, baseline: 'middle',
    });

    if (editing) {
      const typedVal = frame >= T.qtyType ? typed('46', prog(frame, T.qtyType, T.qtyType + s(0.5)), frame) : '4';
      input(ctx, cx.stock - 8, y + rowH / 2 - 17, 74, 34, typedVal, { focused: true, align: 'center' });
    } else {
      const flash = row.sku === 'ANK-6Y'
        ? pulse(frame, T.saved, T.saved + s(1.1), s(0.3))
        : 0;
      text(ctx, String(stock), cx.stock + 6, y + rowH / 2, {
        size: 15, weight: 600, baseline: 'middle',
        color: flash > 0.02 ? C.green : stock <= 5 && !row.service ? '#ea580c' : C.fg,
      });
      if (flash > 0.02) {
        ctx.save();
        ctx.globalAlpha *= flash;
        check(ctx, cx.stock + 42, y + rowH / 2, 8, 1, C.green);
        ctx.restore();
      }
    }

    icon(ctx, 'pencil', cx.actions - 26, y + rowH / 2, 16, C.muted, 2);
    text(ctx, '⋯', cx.actions, y + rowH / 2, {
      size: 20, weight: 700, color: C.muted, align: 'right', baseline: 'middle',
    });
    ctx.restore();
  });
  ctx.restore();

  return { cx, headY, rowH };
}

function drawScene(ctx: CanvasRenderingContext2D, frame: number) {
  appShell(ctx, 60, 64, STAGE.w - 120, STAGE.h - 150, 'Zeneva — Inventory', 0);
  const L = layout();
  ctx.save();
  clipContent(ctx, L.shell);

  // toolbar
  const searching = frame >= T.search && frame < T.clearSearch;
  const q = searching ? typed('shea', prog(frame, T.search, T.search + s(0.6)), frame) : '';
  input(ctx, L.x, L.toolbarY, L.innerW * 0.38, 38, q, {
    placeholder: 'Search products...', focused: searching, iconName: 'search',
  });
  button(ctx, L.x + L.innerW - 330, L.toolbarY, 96, 38, 'Filter', {
    variant: 'outline', size: 13, iconName: 'list-filter',
  });
  button(ctx, L.x + L.innerW - 226, L.toolbarY, 100, 38, 'Import', {
    variant: 'outline', size: 13, iconName: 'upload',
  });
  button(ctx, L.x + L.innerW - 118, L.toolbarY, 118, 38, 'Add Product', {
    size: 13, iconName: 'plus-circle',
  });

  drawTiles(ctx, frame);
  const t = drawTable(ctx, frame);
  ctx.restore();

  toast(
    ctx, L.shell.x + L.shell.w - 26, L.shell.y + L.shell.h - 22,
    'Stock updated', 'Ankara Wax Print — 6 yards is now 46.',
    prog(frame, T.toastIn, T.toastIn + s(0.5), easeOutQuint) *
      (1 - prog(frame, T.reorderScene - s(0.6), T.reorderScene - s(0.1), easeOut)),
  );
  return t;
}

// ------------------------------------------------------------------ cursor

function cursorAt(frame: number, t: { cx: Record<string, number>; headY: number; rowH: number }) {
  const L = layout();
  const gap = 16;
  const tw = (L.innerW - gap * 2) / 3;
  const lowTile: [number, number] = [L.x + tw + gap + tw / 2, L.tilesY + L.tileH / 2];
  const firstRowY = t.headY + 38 + t.rowH / 2;

  const keys: { at: number; p: [number, number] }[] = [
    { at: T.shellIn + s(0.3), p: [L.shell.x + L.shell.w * 0.5, L.shell.y + L.shell.h + 70] },
    { at: T.search, p: [L.x + 120, L.toolbarY + 19] },
    { at: T.tileClick, p: lowTile },
    { at: T.qtyClick, p: [t.cx.stock + 28, firstRowY] },
    { at: T.saved + s(1.4), p: [L.x + L.innerW * 0.5, L.shell.y + L.shell.h * 0.62] },
  ];

  const alpha =
    prog(frame, T.shellIn + s(0.2), T.shellIn + s(0.7)) *
    (1 - prog(frame, T.reorderScene - s(0.8), T.reorderScene - s(0.3), easeOut));

  let pos: [number, number] = keys[0].p;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], next = keys[i + 1];
    if (!next) { pos = k.p; break; }
    if (frame < next.at) {
      const tt = prog(frame, k.at + s(0.28), next.at - s(0.1), easeInOut);
      pos = glide(k.p, next.p, tt, 0.15);
      break;
    }
  }

  const drift = alpha > 0 ? [osc(frame, 91, 1.6), osc(frame, 67, 1.2, 0.6)] : [0, 0];
  const press = Math.max(click(frame, T.tileClick).press, click(frame, T.qtyClick).press);
  return { x: pos[0] + drift[0], y: pos[1] + drift[1], press, alpha };
}

// ------------------------------------------------------------------ demo

export const inventoryDemo: Demo = {
  id: 'inventory',
  title: 'Stock that keeps itself honest',
  blurb:
    'Search the catalogue, filter to what is running low, correct a count inline ' +
    'and watch the health tiles settle. Drawn from the real inventory table.',
  frames: T.total,
  chapters: [
    { label: 'Open', at: 0 },
    { label: 'Search', at: T.search },
    { label: 'Filter low stock', at: T.tileClick },
    { label: 'Fix a count', at: T.qtyClick },
    { label: 'Saved', at: T.saved },
    { label: 'End card', at: T.endIn },
  ],
  draw(ctx, frame, theme) {
    applyTheme(theme);
    backdrop(ctx, frame);

    ctx.save();
    ctx.globalAlpha = 1 - prog(frame, T.reorderScene, T.reorderScene + s(0.4), easeOut) * 0;
    const t = drawScene(ctx, frame);
    ctx.restore();

    const caps: [string, number, number][] = [
      ['Search 10,000 products — instantly, offline', T.search, T.tileClick - s(0.4)],
      ['One tap filters to everything running low', T.tileClick, T.qtyClick - s(0.3)],
      ['Fix a count inline. No forms, no page reload', T.qtyClick, T.saved + s(0.2)],
      ['Every change syncs and the tiles settle themselves', T.saved + s(0.5), T.endIn - s(0.5)],
    ];
    caps.forEach(([str, a, b]) => caption(ctx, str, pulse(frame, a, b, s(0.3))));

    const c = cursorAt(frame, t);
    if (c.alpha > 0.01) {
      [T.tileClick, T.qtyClick].forEach((at) => {
        const r = click(frame, at).ripple;
        if (r > 0 && r < 1) ripple(ctx, c.x, c.y, r);
      });
      cursor(ctx, c.x, c.y, { press: c.press, alpha: c.alpha });
    }

    titleCard(
      ctx, 'Know what you have.', 'Zeneva Inventory',
      prog(frame, T.titleIn, T.titleHold, easeOut),
      prog(frame, T.titleHold, T.titleOut, wipeOut),
      frame,
    );
    endCard(ctx, 'Counts you can trust, on every device.', 'Start free',
      prog(frame, T.endIn, T.endIn + s(0.6)), frame);
  },
};
