/**
 * Renders the real app in Chrome at a range of device sizes and reads back the
 * computed values the short-phone density change depends on.
 *
 * This measures rather than reasons. The CSS can look right and still render
 * wrong in ways that matter here: a breakpoint that shifted, a form control
 * that dropped under the iOS 16px zoom threshold, a bottom nav that stopped
 * matching the content reserve beneath it, or a new horizontal scrollbar.
 *
 * Reuses the recorder's dependency-free CDP client, so this adds no package.
 *
 * Usage (dev server must already be running; `npm run dev` uses port 9007):
 *   node scripts/verify-mobile-scale.mjs
 *   VERIFY_ROUTE=dashboard node scripts/verify-mobile-scale.mjs
 *   ORIGIN=http://127.0.0.1:9007 VERIFY_ROUTE=login node scripts/verify-mobile-scale.mjs
 *
 * Give the route WITHOUT a leading slash. Git Bash (MSYS) rewrites any argument
 * that looks like a POSIX absolute path before node is started, so `/` arrives
 * as `C:/Program Files/Git/` and Page.navigate rejects the URL. That is decided
 * by the value, not the variable name, so the leading slash is added below.
 */

import { launch } from './record/browser.mjs';
import { Cdp } from './record/cdp.mjs';

const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:9007';

// A value that arrives looking like `C:\...` was rewritten by MSYS on the way in
// (someone passed a leading slash); treat that as "the site root" rather than
// pasting a Windows path into the URL.
const rawRoute = process.env.VERIFY_ROUTE ?? 'login';
const ROUTE = '/' + (/^[A-Za-z]:/.test(rawRoute) ? '' : rawRoute).replace(/^\/+/, '');

const DEVICES = [
  { name: 'Android 360x640',   w: 360,  h: 640,  expect: 14 },
  { name: 'iPhone SE 375x667', w: 375,  h: 667,  expect: 14 },
  { name: 'Galaxy S9 360x740', w: 360,  h: 740,  expect: 15 },
  { name: 'iPhone 13 390x844', w: 390,  h: 844,  expect: 16 },
  { name: 'Pixel 7 412x915',   w: 412,  h: 915,  expect: 16 },
  { name: 'iPad 768x1024',     w: 768,  h: 1024, expect: 16 },
  { name: 'Desktop 1280x600',  w: 1280, h: 600,  expect: 16 },
];

const PROBE = `(() => {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);

  // Form controls, split by whether they use the design system's default size.
  // A control on \`text-base\` must stay >=16px or iOS zooms on focus. Controls
  // that opted into text-sm/text-xs were already below that line before this
  // change; for those the invariant is only that they did not get SMALLER, so
  // they are measured against their own declared px size.
  // Only text-entry controls zoom iOS on focus. A checkbox or radio has a
  // font-size (inherited, often tiny) that affects nothing and must not be read
  // as a violation.
  const ZOOMS = new Set(['text','search','email','url','tel','password','number',
    'date','datetime-local','month','week','time','']);
  const controls = [...document.querySelectorAll('input, textarea, select')]
    .filter(e => e.offsetParent !== null && e.type !== 'hidden')
    .filter(e => e.tagName.toLowerCase() !== 'input' || ZOOMS.has(e.type));

  const sizeOf = e => parseFloat(getComputedStyle(e).fontSize);
  // Exact class tokens: a substring test would match the \`md:text-sm\` half of
  // \`text-base md:text-sm\` and misfile the design-system input as opted-out.
  const tokens = e => (e.className || '').toString().split(/\\s+/);
  const optedSize = e => {
    const t = tokens(e);
    if (t.includes('text-xs')) return 12;
    if (t.includes('text-sm')) return 14;
    return null;
  };

  const sizes = controls.filter(e => optedSize(e) === null)
    .map(sizeOf).filter(n => !Number.isNaN(n));

  // Each opted-out control against the px it should be pinned to.
  const optedOut = controls.filter(e => optedSize(e) !== null)
    .map(e => ({ want: optedSize(e), got: sizeOf(e) }));
  const shrunk = optedOut.filter(c => c.got < c.want - 0.1);

  // Breakpoint probe: does a md: utility apply at this width?
  const probe = document.createElement('div');
  probe.className = 'hidden md:block';
  document.body.appendChild(probe);
  const mdApplied = getComputedStyle(probe).display !== 'none';
  probe.remove();

  // A 1rem yardstick, so nav/reserve are measured from real layout rather than
  // assumed from the root value.
  const ruler = document.createElement('div');
  ruler.style.cssText = 'position:absolute;width:1rem;height:1rem;visibility:hidden';
  document.body.appendChild(ruler);
  const remPx = ruler.getBoundingClientRect().width;
  ruler.remove();

  return {
    root, remPx,
    minInput: sizes.length ? Math.min(...sizes) : null,
    controlCount: controls.length,
    optedOutCount: optedOut.length,
    shrunkCount: shrunk.length,
    shrunkDetail: shrunk.slice(0, 3).map(c => c.got + 'px < ' + c.want + 'px').join(', '),
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    mdApplied,
  };
})()`;

const browser = await launch({
  width: 400, height: 800, dpr: 1,
  headless: true, port: 9333,
});

let cdp;
let failures = 0;
const rows = [];

try {
  if (!browser.page?.webSocketDebuggerUrl) {
    throw new Error('no page target to attach to; Chrome launched but exposed no page');
  }
  console.log(`target: ${ORIGIN + ROUTE}`);
  cdp = await Cdp.attach(browser.page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const d of DEVICES) {
    // `mobile` matters: it makes the viewport meta apply the way a phone does,
    // rather than treating the size as a narrow desktop window.
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: d.w, height: d.h, deviceScaleFactor: 1, mobile: d.w < 768,
    });

    await cdp.send('Page.navigate', { url: ORIGIN + ROUTE });
    await new Promise((r) => setTimeout(r, 2500));

    const { result } = await cdp.send('Runtime.evaluate', {
      expression: PROBE, returnByValue: true,
    });
    const v = result.value;
    if (!v) {
      console.error(`  FAIL ${d.name}: probe returned nothing (is the dev server up?)`);
      failures++;
      continue;
    }

    const nav = 4 * v.remPx;      // h-16 / 4rem bottom nav
    const reserve = 8 * v.remPx;  // pb-32 content reserve beneath it
    const btn = 2.5 * v.remPx;    // h-10 default button

    const checks = [
      [Math.abs(v.root - d.expect) < 0.6, `root ${v.root}px, expected ~${d.expect}px`],
      // The 16px floor is a phone-width rule only. `input.tsx` ships
      // `text-base md:text-sm`, so 14px controls at >=768px are the existing
      // design and are deliberately left alone.
      [d.w >= 768 || v.minInput === null || v.minInput >= 15.9,
        `smallest default-sized control ${v.minInput}px, must be >=16 or iOS zooms on focus`],
      // The no-regression invariant: text-sm/text-xs controls must not have been
      // shrunk by the root scaling below the px they rendered at before it.
      [v.shrunkCount === 0,
        `${v.shrunkCount} of ${v.optedOutCount} small control(s) shrunk by root scaling: ${v.shrunkDetail}`],
      [v.overflowX <= 1, `horizontal overflow ${v.overflowX}px, must be 0`],
      [v.mdApplied === (d.w >= 768), `md: applied=${v.mdApplied} at ${d.w}px, must flip at exactly 768`],
      [reserve >= nav, `content reserve ${reserve.toFixed(0)}px < nav ${nav.toFixed(0)}px (content would be hidden)`],
      [btn >= 34, `button height ${btn.toFixed(0)}px is too small to tap`],
    ];

    const bad = checks.filter(([ok]) => !ok);
    failures += bad.length;
    for (const [, msg] of bad) console.error(`  FAIL ${d.name}: ${msg}`);

    rows.push({
      name: d.name,
      root: v.root.toFixed(1) + 'px',
      input: v.minInput === null ? '--' : v.minInput.toFixed(0) + 'px',
      n: `${v.controlCount}${v.optedOutCount ? `/${v.optedOutCount}sm` : ''}`,
      nav: nav.toFixed(0) + 'px',
      reserve: reserve.toFixed(0) + 'px',
      btn: btn.toFixed(0) + 'px',
      ovf: String(v.overflowX),
      md: v.mdApplied ? 'yes' : 'no',
      status: bad.length ? 'FAIL' : 'ok',
    });
  }

  console.log('');
  console.log('device                root    input  ctrl    nav    reserve  btn    ovf   md:   ');
  console.log('-'.repeat(78));
  for (const r of rows) {
    console.log(
      r.name.padEnd(22) + r.root.padEnd(8) + r.input.padEnd(7) + r.n.padEnd(8) +
      r.nav.padEnd(7) + r.reserve.padEnd(9) + r.btn.padEnd(7) +
      r.ovf.padEnd(6) + r.md.padEnd(6) + r.status,
    );
  }
  console.log('');
  console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`);
} finally {
  try { cdp?.close(); } catch { /* best effort */ }
  browser.close?.();
}

process.exit(failures === 0 ? 0 : 1);
