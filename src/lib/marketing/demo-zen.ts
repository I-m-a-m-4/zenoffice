/**
 * "Ask your shop a question" — the Zen AI flow, drawn against the real page.
 *
 * Layout mirrors `src/app/(app)/ai-insights/page.tsx`:
 *
 *   - centred max-w-3xl column, `ZenMark` avatar in a white bordered circle,
 *     "ZEN AI" / "YOU" uppercase role labels above each turn;
 *   - the owner's prompt in the stone-100 bubble with the squared bottom-right
 *     corner (`rounded-2xl rounded-br-md`);
 *   - `ZenStatus` progress chips in the gray-50 pill while tools run — the copy
 *     is lifted verbatim from `TOOL_LINES` in `zen-status.tsx`;
 *   - the floating composer: white, rounded-2xl, orange focus ring, gray-900
 *     send button, with the "Guarded mode — all changes require approval" and
 *     credits-remaining footer;
 *   - a PROPOSAL card from `tool-renderer.tsx` with Approve / Discard.
 *
 * Note this page has no `dark:` variants in the app — it is light-only by
 * design — so the demo renders light regardless of the studio's theme toggle.
 * That is deliberate: a dark "Zen AI" video would not match what a prospect
 * sees after signing up.
 */

import {
  C, applyTheme, LIGHT, STAGE, s, card, text, paragraph, rgba, roundRectPath,
  cursor, ripple, click, glide, prog, pulse, easeOut, easeOutQuint, easeInOut,
  lerp, osc, typed, check, zenMark, clipContent, backdrop, titleCard, endCard,
  caption, FONT_DISPLAY, FONT_BODY, type Demo,
} from './anim';
import { icon, appShell } from './ui';

const wipeOut = (t: number) => t * t;

/** The page's own palette — gray and stone shades as the page hardcodes them. */
const G = {
  page: '#ffffff',
  line: '#e5e7eb',      // gray-200
  lineSoft: '#f3f4f6',  // gray-100
  wash: '#f9fafb',      // gray-50
  ink: '#111827',       // gray-900
  body: '#1f2937',      // gray-800
  mid: '#6b7280',       // gray-500
  soft: '#9ca3af',      // gray-400
  userBg: '#f5f5f4',    // stone-100
  userFg: '#292524',    // stone-800
  userLine: '#e7e5e4',  // stone-200
  orange: '#f97316',
  emerald: '#10b981',
  red: '#dc2626',
};

const QUESTION = 'Which products are about to run out?';

/** Verbatim from TOOL_LINES in src/components/ai-insights/zen-status.tsx. */
const TOOL_RUN = [
  { line: 'Scanning inventory', at: s(6.0) },
  { line: 'Checking shelf levels', at: s(7.1) },
  { line: 'Projecting days of cover', at: s(8.2) },
  { line: 'Building a reorder list', at: s(9.3) },
];

const ANSWER =
  'Three products run out within the week. Ankara Wax Print has 4 days of cover ' +
  'left at its current rate and it is your second best seller — that is the one ' +
  'worth acting on first.';

const RISK = [
  { name: 'Ankara Wax Print', days: 4, stock: 6, bar: 0.16, tone: G.red },
  { name: 'Shea Butter 500g', days: 6, stock: 11, bar: 0.3, tone: G.orange },
  { name: 'Cooking Gas 12.5kg', days: 7, stock: 9, bar: 0.42, tone: G.orange },
];

const T = {
  titleIn: s(0.4),
  titleHold: s(2.2),
  titleOut: s(2.9),
  shellIn: s(2.6),
  typeStart: s(3.3),
  typeEnd: s(5.4),
  send: s(5.7),
  thinking: s(5.9),
  answerStart: s(10.0),
  chart: s(12.2),
  proposal: s(14.8),
  approveClick: s(18.0),
  applied: s(18.6),
  endIn: s(21.4),
  total: s(23.8),
};

// ------------------------------------------------------------------ pieces

/** Avatar: ZenMark inside `w-8 h-8 rounded-full bg-white border shadow-sm`. */
function avatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, streaming: boolean, frame: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fillStyle = G.page;
  ctx.fill();
  ctx.strokeStyle = G.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  zenMark(ctx, cx, cy, 21, { sheen: streaming ? (frame % 48) / 48 : -1 });
  ctx.restore();
}

function roleLabel(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, align: CanvasTextAlign) {
  text(ctx, str, x, y, {
    size: 11, weight: 600, color: align === 'right' ? G.soft : G.mid,
    align, baseline: 'middle',
  });
}

/** The stone-100 prompt bubble, right-aligned, with the squared br corner. */
function userTurn(
  ctx: CanvasRenderingContext2D,
  right: number, y: number, maxW: number, str: string, alpha: number,
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  roleLabel(ctx, 'YOU', right, y, 'right');

  ctx.font = `400 16px ${FONT_BODY}`;
  const w = Math.min(maxW, ctx.measureText(str).width + 36);
  const h = 46;
  const x = right - w;
  const by = y + 18;

  // rounded-2xl with rounded-br-md
  const r = 16, rbr = 6;
  ctx.beginPath();
  ctx.moveTo(x + r, by);
  ctx.arcTo(x + w, by, x + w, by + h, r);
  ctx.arcTo(x + w, by + h, x, by + h, rbr);
  ctx.arcTo(x, by + h, x, by, r);
  ctx.arcTo(x, by, x + w, by, r);
  ctx.closePath();
  ctx.fillStyle = G.userBg;
  ctx.fill();
  ctx.strokeStyle = G.userLine;
  ctx.lineWidth = 1;
  ctx.stroke();

  text(ctx, str, x + 18, by + h / 2 + 1, { size: 16, color: G.userFg, baseline: 'middle' });
  ctx.restore();
  return by + h;
}

/** Height `paragraph` will occupy — lets layout reserve space before it streams. */
function wrapHeight(
  ctx: CanvasRenderingContext2D,
  str: string, width: number, lineHeight: number, size: number,
) {
  ctx.save();
  ctx.font = `400 ${size}px ${FONT_BODY}`;
  let lines = 1, line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) { lines++; line = word; }
    else line = next;
  }
  ctx.restore();
  return lines * lineHeight;
}

function assistantTurn(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, frame: number,
) {
  const streaming = frame >= T.thinking && frame < T.answerStart + s(2.4);
  avatar(ctx, x + 18, y + 18, streaming, frame);

  const tx = x + 48;
  const tw = w - 48;
  roleLabel(ctx, 'ZEN AI', tx, y + 8, 'left');
  let cy = y + 26;

  // ZenStatus chips in the gray-50 pill
  const running = frame < T.answerStart;
  if (frame >= T.thinking) {
    const fade = running ? 1 : 1 - prog(frame, T.answerStart, T.answerStart + s(0.45), easeOut);
    if (fade > 0.001) {
      TOOL_RUN.forEach((tool, i) => {
        const appear = prog(frame, tool.at, tool.at + s(0.28));
        if (appear <= 0) return;
        const done = frame >= (TOOL_RUN[i + 1]?.at ?? T.answerStart);
        const ly = cy + 20 + i * 34;

        ctx.save();
        ctx.globalAlpha = appear * fade;
        ctx.font = `500 14px ${FONT_BODY}`;
        const pw = ctx.measureText(tool.line).width + 62;
        card(ctx, tx, ly - 16, pw, 32, {
          r: 8, fill: G.wash, stroke: G.lineSoft, lineWidth: 1,
        });
        if (done) {
          check(ctx, tx + 20, ly, 8, 1, G.emerald);
        } else {
          for (let d = 0; d < 3; d++) {
            const a = 0.3 + 0.7 * Math.abs(Math.sin((frame / 9) + d * 0.7));
            ctx.beginPath();
            ctx.arc(tx + 14 + d * 7, ly, 2.4, 0, Math.PI * 2);
            ctx.fillStyle = rgba(G.orange, a);
            ctx.fill();
          }
        }
        text(ctx, tool.line, tx + 38, ly, {
          size: 14, weight: 500, color: G.mid, baseline: 'middle',
        });
        ctx.restore();
      });
      if (running) cy += 20 + TOOL_RUN.length * 34;
    }
  }

  // streamed answer
  const at = prog(frame, T.answerStart, T.answerStart + s(2.2));
  if (at > 0) {
    const top = cy + 18;
    const shown = ANSWER.slice(0, Math.round(at * ANSWER.length));
    const drawnBottom = paragraph(ctx, shown, tx, top, tw, 30, {
      size: 18, weight: 400, color: G.body,
    });
    cy = top + wrapHeight(ctx, ANSWER, tw, 30, 18);
    if (at < 1) {
      ctx.save();
      ctx.globalAlpha = Math.floor(frame / 7) % 2 === 0 ? 1 : 0.2;
      ctx.fillStyle = G.orange;
      ctx.fillRect(tx, drawnBottom - 17, 8, 19);
      ctx.restore();
    }
  }
  return cy;
}

function riskChart(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, frame: number,
) {
  const t = prog(frame, T.chart, T.chart + s(0.5), easeOutQuint);
  if (t <= 0) return y;
  const h = 186;
  ctx.save();
  ctx.globalAlpha = t;
  ctx.translate(0, (1 - t) * 14);
  card(ctx, x, y, w, h, { r: 12, fill: G.page, stroke: G.line, lineWidth: 1, shadow: 8 });
  text(ctx, 'Days of cover', x + 20, y + 30, { size: 14, weight: 600, color: G.mid });

  RISK.forEach((r, i) => {
    const ry = y + 62 + i * 40;
    const grow = prog(frame, T.chart + s(0.25) + i * s(0.12), T.chart + s(1) + i * s(0.12), easeOut);
    text(ctx, r.name, x + 20, ry, { size: 15, weight: 500, color: G.body, baseline: 'middle' });
    const bx = x + 230, bw = w - 350;
    roundRectPath(ctx, bx, ry - 6, bw, 12, 6);
    ctx.fillStyle = G.lineSoft;
    ctx.fill();
    const fill = bw * r.bar * grow;
    if (fill > 2) {
      roundRectPath(ctx, bx, ry - 6, fill, 12, 6);
      ctx.fillStyle = r.tone;
      ctx.fill();
    }
    text(ctx, `${r.days}d · ${r.stock} left`, x + w - 20, ry, {
      size: 14, weight: 600, color: r.tone, align: 'right', baseline: 'middle',
    });
  });
  ctx.restore();
  return y + h;
}

/**
 * The PROPOSAL card. Approve/Discard are the whole point: Zen AI never writes
 * on the server — the write goes through `addToQueue` after the owner approves,
 * and `proposal-guard.ts` re-validates against live data first.
 */
function proposalCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, frame: number,
) {
  const t = prog(frame, T.proposal, T.proposal + s(0.55), easeOutQuint);
  if (t <= 0) return null;

  const applied = prog(frame, T.applied, T.applied + s(0.6), easeOut);
  const h = 206;
  ctx.save();
  ctx.globalAlpha = t;
  ctx.translate(0, (1 - t) * 18);

  card(ctx, x, y, w, h, {
    r: 12,
    fill: G.page,
    stroke: applied > 0.3 ? rgba(G.emerald, 0.5) : rgba(G.orange, 0.45),
    lineWidth: 1.5,
    shadow: 14,
  });

  ctx.save();
  roundRectPath(ctx, x, y, w, h, 12);
  ctx.clip();
  ctx.fillStyle = applied > 0.3 ? rgba(G.emerald, 0.08) : rgba(G.orange, 0.07);
  ctx.fillRect(x, y, w, 48);
  ctx.restore();

  icon(ctx, applied > 0.3 ? 'check' : 'sparkles', x + 26, y + 24, 17,
    applied > 0.3 ? G.emerald : G.orange, 2);
  text(ctx, applied > 0.3 ? 'Restock queued' : 'Proposed restock', x + 44, y + 25, {
    size: 15, weight: 700, baseline: 'middle',
    color: applied > 0.3 ? G.emerald : G.orange,
  });
  ctx.save();
  ctx.globalAlpha *= 1 - applied;
  text(ctx, 'Requires your approval', x + w - 22, y + 25, {
    size: 12.5, color: G.mid, align: 'right', baseline: 'middle',
  });
  ctx.restore();

  ([
    ['Product', 'Ankara Wax Print — 6 yards'],
    ['Current stock', '6 units'],
    ['Suggested order', '+40 units'],
  ] as [string, string][]).forEach(([k, v], i) => {
    const ry = y + 76 + i * 28;
    text(ctx, k, x + 22, ry, { size: 14, color: G.mid, baseline: 'middle' });
    text(ctx, v, x + w - 22, ry, {
      size: 14, weight: 600, color: G.body, align: 'right', baseline: 'middle',
    });
  });

  const bw = 140, bh = 42;
  const ax = x + w - bw - 20, ay = y + h - bh - 18;
  const dx = ax - bw - 10;

  ctx.save();
  ctx.globalAlpha *= 1 - applied;
  card(ctx, dx, ay, bw, bh, { r: 8, fill: 'transparent', stroke: G.line, lineWidth: 1 });
  text(ctx, 'Discard', dx + bw / 2, ay + bh / 2, {
    size: 15, weight: 500, color: G.mid, align: 'center', baseline: 'middle',
  });

  const cc = click(frame, T.approveClick);
  const hot = pulse(frame, T.approveClick - s(0.6), T.approveClick + s(0.3), s(0.25));
  ctx.translate(0, cc.press * 2);
  card(ctx, ax, ay, bw, bh - cc.press * 3, {
    r: 8, fill: hot > 0.02 ? '#000000' : G.ink, stroke: '', shadow: 10 + hot * 12,
  });
  text(ctx, 'Approve', ax + bw / 2, ay + bh / 2 - cc.press * 1.5, {
    size: 15, weight: 500, color: '#ffffff', align: 'center', baseline: 'middle',
  });
  ctx.restore();

  if (applied > 0.01) {
    ctx.save();
    ctx.globalAlpha *= applied;
    check(ctx, ax + bw - 20, ay + bh / 2, 14, applied, G.emerald);
    text(ctx, 'Added to the sync queue', ax + bw - 44, ay + bh / 2, {
      size: 14, weight: 500, color: G.emerald, align: 'right', baseline: 'middle',
    });
    ctx.restore();
  }

  ctx.restore();
  return { x: ax + bw / 2, y: ay + bh / 2 };
}

/** The floating composer, with its guarded-mode footer. */
function composer(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, frame: number,
) {
  const h = 108;
  const focused = frame >= T.typeStart && frame < T.send;
  card(ctx, x, y, w, h, {
    r: 16, fill: G.page, stroke: focused ? G.orange : G.line,
    lineWidth: focused ? 2 : 1, shadow: 12,
  });
  if (focused) {
    roundRectPath(ctx, x - 3, y - 3, w + 6, h + 6, 19);
    ctx.strokeStyle = rgba(G.orange, 0.2);
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  const sent = frame >= T.send;
  const t = prog(frame, T.typeStart, T.typeEnd, (v) => v);
  const str = sent ? '' : typed(QUESTION, t, frame);
  text(ctx, str || (sent ? 'Ask Zen AI...' : 'Ask anything about your business...'), x + 22, y + 32, {
    size: 16, color: str ? G.ink : G.soft, baseline: 'middle',
  });

  // footer strip
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 16);
  ctx.clip();
  ctx.fillStyle = G.wash;
  ctx.fillRect(x, y + 58, w, h - 58);
  ctx.strokeStyle = G.lineSoft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 58); ctx.lineTo(x + w, y + 58);
  ctx.stroke();
  ctx.restore();

  // Footer: guarded-mode note and the credits counter share the left side
  // (separated by a divider, as on the page); Send owns the right.
  const gx = x + 26;
  icon(ctx, 'alert-triangle', gx, y + 83, 14, G.emerald, 2);
  const gw = text(ctx, 'Guarded mode — all changes require approval', gx + 14, y + 83, {
    size: 12.5, weight: 500, color: G.mid, baseline: 'middle',
  });
  const dx = gx + 14 + gw + 14;
  ctx.strokeStyle = G.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(dx, y + 72); ctx.lineTo(dx, y + 94);
  ctx.stroke();
  icon(ctx, 'sparkles', dx + 14, y + 83, 14, G.orange, 2);
  text(ctx, '84 AI credits left', dx + 28, y + 83, {
    size: 12.5, weight: 500, color: G.mid, baseline: 'middle',
  });

  // gray-900 Send button
  const sc = click(frame, T.send);
  const bw = 86, bh = 32;
  const bx = x + w - bw - 20, by = y + 83 - bh / 2;
  const ready = t > 0.05 && !sent;
  ctx.save();
  ctx.translate(0, sc.press * 2);
  card(ctx, bx, by, bw, bh - sc.press * 2, {
    r: 8, fill: ready ? G.ink : '#e5e7eb', stroke: '',
  });
  icon(ctx, 'chevron-right', bx + 24, by + bh / 2 - sc.press, 13, ready ? '#fff' : G.soft, 2.4);
  text(ctx, 'Send', bx + 52, by + bh / 2 - sc.press, {
    size: 13.5, weight: 500, color: ready ? '#fff' : G.soft,
    align: 'center', baseline: 'middle',
  });
  ctx.restore();

  return { x: bx + bw / 2, y: by + bh / 2 };
}

// ------------------------------------------------------------------ scene

function chatLayout() {
  const shell = { x: 60 + 62, y: 64 + 42, w: STAGE.w - 120 - 62, h: STAGE.h - 150 - 42 };
  const colW = Math.min(768, shell.w - 120);   // max-w-3xl
  return {
    shell, colW,
    colX: shell.x + (shell.w - colW) / 2,
    top: shell.y + 30,
    composerY: shell.y + shell.h - 128,
  };
}

function drawChat(ctx: CanvasRenderingContext2D, frame: number) {
  // The page is light-only, so the shell is painted with the light palette
  // regardless of the studio toggle.
  applyTheme(LIGHT);
  const shell = appShell(ctx, 60, 64, STAGE.w - 120, STAGE.h - 150, 'Zeneva — Zen AI', 5);
  const L = chatLayout();

  ctx.save();
  clipContent(ctx, shell);
  ctx.fillStyle = G.page;
  ctx.fillRect(shell.x, shell.y, shell.w, shell.h);

  const comp = composer(ctx, L.colX, L.composerY, L.colW, frame);

  // The transcript grows past the viewport, so it scrolls to keep the newest
  // block in view. Tuned to stop with the proposal card sitting just above the
  // composer rather than pinned to the top of the column.
  const scroll =
    prog(frame, T.chart, T.chart + s(0.8), easeInOut) * 110 +
    prog(frame, T.proposal, T.proposal + s(0.9), easeInOut) * 150;

  ctx.save();
  ctx.beginPath();
  ctx.rect(shell.x, shell.y, shell.w, L.composerY - shell.y - 12);
  ctx.clip();
  ctx.translate(0, -scroll);

  let y = L.top;
  y = userTurn(ctx, L.colX + L.colW, y, L.colW * 0.8, QUESTION,
    prog(frame, T.send, T.send + s(0.3), easeOutQuint));

  let approve: { x: number; y: number } | null = null;
  if (frame >= T.thinking) {
    y = assistantTurn(ctx, L.colX, y + 30, L.colW, frame);
    y = riskChart(ctx, L.colX + 48, y + 20, L.colW - 48, frame);
    approve = proposalCard(ctx, L.colX + 48, y + 20, L.colW - 48, frame);
  }
  ctx.restore();
  ctx.restore();

  // Approve is measured where it was actually drawn, then shifted back out of
  // the scrolled space — the transcript height depends on how much has streamed,
  // so re-deriving it here would drift.
  return {
    comp,
    approve: approve ? { x: approve.x, y: approve.y - scroll } : null,
  };
}

// ------------------------------------------------------------------ cursor

function cursorAt(
  frame: number,
  comp: { x: number; y: number },
  approve: { x: number; y: number } | null,
) {
  const L = chatLayout();
  const composerPt: [number, number] = [L.colX + 160, L.composerY + 32];
  const approvePt: [number, number] = approve
    ? [approve.x, approve.y]
    : [L.colX + L.colW * 0.8, L.shell.y + L.shell.h * 0.6];

  const keys: { at: number; p: [number, number] }[] = [
    { at: T.shellIn + s(0.3), p: [L.shell.x + L.shell.w * 0.4, L.shell.y + L.shell.h + 70] },
    { at: T.typeStart, p: composerPt },
    { at: T.send, p: [comp.x, comp.y] },
    { at: T.proposal + s(1.2), p: [L.colX + L.colW * 0.45, L.shell.y + L.shell.h * 0.55] },
    { at: T.approveClick, p: approvePt },
  ];

  const alpha =
    prog(frame, T.shellIn + s(0.2), T.shellIn + s(0.7)) *
    (1 - prog(frame, T.applied + s(0.8), T.applied + s(1.4), easeOut));

  let pos: [number, number] = keys[0].p;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], next = keys[i + 1];
    if (!next) { pos = k.p; break; }
    if (frame < next.at) {
      const t = prog(frame, k.at + s(0.3), next.at - s(0.1), easeInOut);
      pos = glide(k.p, next.p, t, 0.14);
      break;
    }
  }

  const drift = alpha > 0 ? [osc(frame, 101, 1.7), osc(frame, 79, 1.3, 0.8)] : [0, 0];
  const press = Math.max(click(frame, T.send).press, click(frame, T.approveClick).press);
  return { x: pos[0] + drift[0], y: pos[1] + drift[1], press, alpha };
}

// ------------------------------------------------------------------ demo

export const zenDemo: Demo = {
  id: 'zen-ai',
  title: 'Ask your shop a question',
  blurb:
    'Zen AI reads live inventory and sales, answers in plain language, then ' +
    'proposes the fix — which only happens once the owner approves it.',
  frames: T.total,
  chapters: [
    { label: 'Open', at: 0 },
    { label: 'Ask', at: T.typeStart },
    { label: 'Tools run', at: T.thinking },
    { label: 'Answer', at: T.answerStart },
    { label: 'Approve', at: T.proposal },
    { label: 'End card', at: T.endIn },
  ],
  draw(ctx, frame, theme) {
    applyTheme(theme);
    backdrop(ctx, frame);

    const { comp, approve } = drawChat(ctx, frame);

    // captions and cards follow the studio theme, the chat itself does not
    applyTheme(theme);
    const caps: [string, number, number][] = [
      ['Ask in plain language — no report to build', T.typeStart, T.thinking - s(0.2)],
      ['Zen reads your real inventory and sales', T.thinking + s(0.3), T.answerStart - s(0.2)],
      ['An answer, not a dashboard to decipher', T.answerStart + s(0.5), T.proposal - s(0.3)],
      ['Nothing changes until you approve it', T.proposal + s(0.3), T.endIn - s(0.5)],
    ];
    caps.forEach(([str, a, b]) => caption(ctx, str, pulse(frame, a, b, s(0.3))));

    const c = cursorAt(frame, comp, approve);
    if (c.alpha > 0.01) {
      [T.send, T.approveClick].forEach((at) => {
        const r = click(frame, at).ripple;
        if (r > 0 && r < 1) ripple(ctx, c.x, c.y, r, G.orange);
      });
      cursor(ctx, c.x, c.y, { press: c.press, alpha: c.alpha });
    }

    titleCard(
      ctx, 'Your shop, answered.', 'Zen AI in Zeneva',
      prog(frame, T.titleIn, T.titleHold, easeOut),
      prog(frame, T.titleHold, T.titleOut, wipeOut),
      frame,
    );
    endCard(ctx, '42 tools. Reads everything. Writes nothing without you.',
      'Try Zen AI', prog(frame, T.endIn, T.endIn + s(0.6)), frame);
  },
};
