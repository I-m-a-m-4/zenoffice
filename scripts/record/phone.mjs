/**
 * Draws the phone chassis that mobile takes are composited into.
 *
 * The old frame was an inset `box-shadow` painted inside the page, which had two
 * problems that only show up on camera: it sat *over* the app, so ten pixels of
 * every screen edge were permanently hidden behind a bezel, and a border drawn
 * inside a full-bleed 9:16 rectangle does not read as a phone — it reads as a
 * vignette. A real device frame has to *contain* the screen, which means the
 * footage has to shrink, which means it cannot be done inside the page.
 *
 * So it happens at encode time instead: this file rasterises a chassis once per
 * run, `capture.mjs` scales the capture into the screen cut-out and lays the
 * chassis over the top. The app renders exactly as it always did — nothing here
 * is on the page's code path at all, which is the whole point.
 *
 * Written as a raw PNG with `zlib` and no image library. The alternative was a
 * dependency, and a dependency for one rounded rectangle is a bad trade in a
 * tool whose main virtue is that it can be deleted without touching the app.
 */

import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// ------------------------------------------------------------------ png

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** 8-bit RGBA PNG from a straight-alpha pixel buffer. */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  // Filter type 0 (None) on every scanline. The picture is mostly flat colour,
  // so deflate already gets it down to a few hundred KB and the per-row filter
  // heuristics would cost more time than they save on a one-off asset.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 8 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- rasterising

/**
 * Signed distance to a rounded rectangle: negative inside, zero on the edge.
 *
 * Everything below is drawn from this one function. Coverage is read straight
 * off the distance (`0.5 - d`, clamped), which gives a clean antialiased edge
 * without supersampling — at these radii the error is under a tenth of a pixel
 * and the alternative is four times the work for a chassis nobody inspects at
 * 400%.
 */
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Source-over one colour at `a` coverage into the buffer at index `i`. */
function blend(buf, i, r, g, b, a) {
  if (a <= 0) return;
  if (a >= 1) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    return;
  }
  const dstA = buf[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA <= 0) { buf[i + 3] = 0; return; }
  buf[i] = Math.round((r * a + buf[i] * dstA * (1 - a)) / outA);
  buf[i + 1] = Math.round((g * a + buf[i + 1] * dstA * (1 - a)) / outA);
  buf[i + 2] = Math.round((b * a + buf[i + 2] * dstA * (1 - a)) / outA);
  buf[i + 3] = Math.round(outA * 255);
}

const PALETTE = {
  light: {
    bgInner: [0xf7, 0xf8, 0xfa],
    bgOuter: [0xe2, 0xe5, 0xea],
    body: [0x1a, 0x1b, 0x20],
    rim: [0x4a, 0x4d, 0x57],
    shadow: 0.34,
  },
  dark: {
    bgInner: [0x14, 0x15, 0x1a],
    bgOuter: [0x07, 0x07, 0x0a],
    body: [0x24, 0x26, 0x2d],
    rim: [0x5c, 0x60, 0x6c],
    shadow: 0.55,
  },
};

/**
 * Fit a phone of a given screen aspect into the output canvas.
 *
 * Aspect-driven rather than hardcoded, because the screen has to match the
 * capture exactly: the composite scales the footage into this rectangle, and any
 * disagreement between the two stretches the app. A frame that distorts every
 * screen by two percent is worse than no frame — it makes the whole video subtly
 * wrong in a way nobody can point at.
 *
 * `MARGIN` leaves the phone floating on the backdrop rather than bleeding off
 * the edge, and is what separates "a phone in a shot" from "a screenshot with a
 * border drawn on it".
 */
function layout(outW, outH, screenAspect) {
  const MARGIN = 0.11;          // of the shorter axis, per side
  const BEZEL = 0.023;          // of screen width
  const inset = Math.round(Math.min(outW, outH) * MARGIN);
  const maxW = outW - inset * 2;
  const maxH = outH - inset * 2;

  // With bezel proportional to the screen, the body is just the screen scaled by
  // a constant on each axis — so both constraints solve for screenW directly and
  // the tighter one wins. No iteration, and no chance of an overflow that only
  // shows up at an unusual output size.
  const wScale = 1 + 2 * BEZEL;
  const hScale = 1 / screenAspect + 2 * BEZEL;
  const screenW = Math.floor(Math.min(maxW / wScale, maxH / hScale)) & ~1;
  const screenH = Math.round(screenW / screenAspect) & ~1;
  const bezel = Math.max(6, Math.round(screenW * BEZEL));

  return {
    screen: {
      x: Math.round((outW - screenW) / 2),
      y: Math.round((outH - screenH) / 2),
      w: screenW,
      h: screenH,
      r: Math.round(screenW * 0.062),
    },
    bezel,
    bodyR: Math.round((screenW + bezel * 2) * 0.083),
    // A dynamic island only belongs on a tall screen. On a 16:9 body — the
    // iPhone-8 shape — it is an anachronism that makes the whole frame read as
    // a mock-up of a phone that never existed, so short screens get the camera
    // dot that generation actually had.
    island: screenAspect < 0.5
      ? { kind: 'island', w: Math.round(screenW * 0.30), h: Math.round(screenW * 0.086), top: Math.round(screenW * 0.032) }
      : { kind: 'dot', w: Math.round(screenW * 0.022), h: Math.round(screenW * 0.022), top: Math.round(screenW * 0.026) },
  };
}

function draw(outW, outH, theme, screenAspect) {
  const pal = PALETTE[theme] ?? PALETTE.light;
  const L = layout(outW, outH, screenAspect);
  const s = L.screen;

  const body = {
    cx: outW / 2,
    cy: outH / 2,
    hw: s.w / 2 + L.bezel,
    hh: s.h / 2 + L.bezel,
    r: L.bodyR,
  };

  const buf = Buffer.alloc(outW * outH * 4);
  const maxR = Math.hypot(outW / 2, outH / 2);
  const SHADOW_BLUR = Math.round(outW * 0.037);
  const SHADOW_DY = Math.round(outW * 0.017);

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const i = (y * outW + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      // 1. Backdrop. A flat colour behind a phone looks like a placeholder; a
      //    slow radial falloff reads as a lit surface and costs one hypot.
      const t = clamp01(Math.hypot(px - outW / 2, py - outH / 2) / maxR);
      const e = t * t;
      buf[i] = Math.round(pal.bgInner[0] + (pal.bgOuter[0] - pal.bgInner[0]) * e);
      buf[i + 1] = Math.round(pal.bgInner[1] + (pal.bgOuter[1] - pal.bgInner[1]) * e);
      buf[i + 2] = Math.round(pal.bgInner[2] + (pal.bgOuter[2] - pal.bgInner[2]) * e);
      buf[i + 3] = 255;

      // 2. Contact shadow, offset down so the phone sits on the surface rather
      //    than floating in front of it.
      const ds = sdRoundRect(px, py - SHADOW_DY, body.cx, body.cy, body.hw, body.hh, body.r);
      if (ds < SHADOW_BLUR) {
        const f = clamp01(1 - ds / SHADOW_BLUR);
        blend(buf, i, 0, 0, 0, f * f * pal.shadow);
      }

      // 3. Chassis, then a one-pixel rim just inside its edge. The rim is what
      //    separates a dark body from a dark backdrop in the dark theme.
      const db = sdRoundRect(px, py, body.cx, body.cy, body.hw, body.hh, body.r);
      blend(buf, i, pal.body[0], pal.body[1], pal.body[2], clamp01(0.5 - db));
      const rim = clamp01(0.5 - Math.abs(db + 1.4) * 1.1);
      if (rim > 0) blend(buf, i, pal.rim[0], pal.rim[1], pal.rim[2], rim * 0.85);
    }
  }

  // 4. Side buttons — power right, volume left. Drawn after the body so they
  //    read as attached hardware rather than a notch in the outline.
  const btn = (bx, by, bw, bh) => {
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    for (let y = Math.floor(by) - 2; y < by + bh + 2; y++) {
      for (let x = Math.floor(bx) - 2; x < bx + bw + 2; x++) {
        if (x < 0 || y < 0 || x >= outW || y >= outH) continue;
        const d = sdRoundRect(x + 0.5, y + 0.5, cx, cy, bw / 2, bh / 2, Math.min(bw, bh) / 2);
        blend(buf, (y * outW + x) * 4, pal.rim[0], pal.rim[1], pal.rim[2], clamp01(0.5 - d) * 0.9);
      }
    }
  };
  const bw = Math.max(4, Math.round(outW * 0.0056));
  const right = body.cx + body.hw - 1;
  const left = body.cx - body.hw - bw + 1;
  btn(right, body.cy - s.h * 0.22, bw, s.h * 0.085);
  btn(left, body.cy - s.h * 0.30, bw, s.h * 0.048);
  btn(left, body.cy - s.h * 0.24, bw, s.h * 0.048);

  // 5. Cut the screen out. Everything painted so far stays; the hole is what
  //    the footage shows through, and the rounded corners of the cut are what
  //    make the app's square frame look like it has rounded corners.
  for (let y = s.y - 2; y < s.y + s.h + 2; y++) {
    for (let x = s.x - 2; x < s.x + s.w + 2; x++) {
      if (x < 0 || y < 0 || x >= outW || y >= outH) continue;
      const d = sdRoundRect(x + 0.5, y + 0.5, s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, s.r);
      const inside = clamp01(0.5 - d);
      if (inside > 0) {
        const i = (y * outW + x) * 4;
        buf[i + 3] = Math.round(buf[i + 3] * (1 - inside));
      }
    }
  }

  // 6. Camera. Painted after the cut or it would be erased by it — a dynamic
  //    island on a tall screen, a lens dot on a short one.
  const isl = {
    cx: outW / 2,
    cy: s.y + L.island.top + L.island.h / 2,
    hw: L.island.w / 2,
    hh: L.island.h / 2,
  };
  for (let y = Math.floor(isl.cy - isl.hh) - 2; y < isl.cy + isl.hh + 2; y++) {
    for (let x = Math.floor(isl.cx - isl.hw) - 2; x < isl.cx + isl.hw + 2; x++) {
      if (x < 0 || y < 0 || x >= outW || y >= outH) continue;
      const d = sdRoundRect(x + 0.5, y + 0.5, isl.cx, isl.cy, isl.hw, isl.hh, Math.min(isl.hw, isl.hh));
      const a = clamp01(0.5 - d);
      blend(buf, (y * outW + x) * 4, 6, 6, 9, a);
      // A faint lens ring inside the dot, so it is not a flat black circle.
      if (L.island.kind === 'dot') {
        const ring = clamp01(0.5 - Math.abs(d + isl.hw * 0.34) * 1.6);
        if (ring > 0) blend(buf, (y * outW + x) * 4, 42, 46, 60, ring * 0.8);
      }
    }
  }

  return { png: encodePng(outW, outH, buf), screen: s };
}

// ---------------------------------------------------------------- public

/**
 * The chassis for a given output size and theme, written to `dir` and cached.
 *
 * Cached because a run is usually several takes of the same shape, and each one
 * would otherwise re-rasterise two million pixels for a picture that is byte for
 * byte identical.
 */
/**
 * The chassis for a given output size and theme, written to `dir` and cached.
 *
 * `aspect` is the *screen's* width/height — the shape of the phone being
 * simulated, which the footage is scaled into. It is deliberately separate from
 * the output size: a take renders to 1080x1920 because that is what Reels and
 * Shorts want, while the phone inside it may be any modern aspect.
 *
 * Cached because a run is usually several takes of the same shape, and each one
 * would otherwise re-rasterise two million pixels for a picture that is byte for
 * byte identical.
 */
export function phoneFrame({ outW, outH, aspect, theme, dir }) {
  const key = aspect.toFixed(4);
  const file = path.join(dir, `phone-${outW}x${outH}-${key}-${theme}.png`);
  // `layout` is pure and cheap, so the cached path gets its geometry without
  // touching the raster at all.
  const screen = layout(outW, outH, aspect).screen;
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, draw(outW, outH, theme, aspect).png);
  }
  return { file, screen };
}
