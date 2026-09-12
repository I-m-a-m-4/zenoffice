/**
 * Is something covering the "Next: Customer" button?
 *
 * The button is enabled and its onClick is a bare router.push, yet clicking it
 * does nothing — which means the click is landing on some other element. This
 * hit-tests the exact point `Page.click` would aim at.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Cdp } from '../scripts/record/cdp.mjs';
import { launch } from '../scripts/record/browser.mjs';
import { Page, sleep } from '../scripts/record/page.mjs';

const ROOT = path.resolve('..');
function loadEnvFile() {
  const out = {};
  for (const raw of readFileSync(path.join(ROOT, '.env.recorder'), 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}

const env = loadEnvFile();
const dev = { id: 'desktop', width: 1280, height: 720, dpr: 1.5, outW: 1920, outH: 1080, mobile: false };
const browser = await launch({ width: dev.width, height: dev.height, dpr: dev.dpr, headless: true, port: 9354, browserPath: null });
const log = (...a) => console.log('  ', ...a);
const ADD = 'button[class*="h-11"][class*="w-11"][class*="rounded-lg"]';

try {
  const cdp = await Cdp.attach(browser.page.webSocketDebuggerUrl);
  const page = new Page(cdp, { device: dev, theme: 'light', baseUrl: 'http://localhost:9007', log });
  await page.prepare();

  await page.goto('/login');
  await page.find({ css: '#email' }, { timeoutMs: 30_000 });
  await page.click({ css: '#email' }, { settle: 120, dur: 260 });
  await page.type(env.ZENEVA_RECORD_EMAIL, { delay: 6 });
  await page.click({ css: '#password' }, { settle: 120, dur: 260 });
  await page.type(env.ZENEVA_RECORD_PASSWORD, { delay: 6 });
  await page.click({ text: 'Login', tag: 'button', exact: true }, { settle: 400 });
  await page.waitUntil(async () => (await page.eval('location.pathname')) !== '/login', 45_000, 'login');
  await page.waitForSettled();

  await page.goto('/sales/pos/select-products');
  await sleep(3500);
  for (let i = 0; i < 3; i++) { await page.click({ css: ADD, nth: i }); await sleep(500); }
  await sleep(1200);

  const hit = JSON.parse(await page.eval(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null && (b.innerText||'').trim() === 'Next: Customer')[0];
    if (!btn) return JSON.stringify({ found: false });
    const r = btn.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(cx, cy);
    const describe = (el) => el ? \`\${el.tagName.toLowerCase()}\${el.id?'#'+el.id:''}.\${(el.className&&el.className.baseVal!==undefined?el.className.baseVal:String(el.className||'')).split(/\\s+/).filter(Boolean).slice(0,4).join('.')}\` : 'null';
    // Walk up from the hit element to see if it is the button or inside it.
    let cur = top, insideBtn = false;
    while (cur) { if (cur === btn) { insideBtn = true; break; } cur = cur.parentElement; }
    // What is the covering element's stacking context / role?
    const chain = [];
    let c = top; for (let i=0;i<5 && c;i++){ chain.push(describe(c)); c = c.parentElement; }
    return JSON.stringify({
      found: true,
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      point: { cx, cy },
      inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      topElement: describe(top),
      topText: (top?.innerText||'').trim().replace(/\\s+/g,' ').slice(0,120),
      clickReachesButton: insideBtn,
      chain,
    });
  })()`));

  log('');
  log(`button found      : ${hit.found}`);
  if (hit.found) {
    log(`viewport          : ${hit.viewport.w}x${hit.viewport.h}`);
    log(`button rect       : x=${hit.rect.x} y=${hit.rect.y} w=${hit.rect.w} h=${hit.rect.h}`);
    log(`click point       : (${hit.point.cx}, ${hit.point.cy})`);
    log(`fully in viewport : ${hit.inViewport}`);
    log(`element at point  : ${hit.topElement}`);
    log(`  its text        : ${JSON.stringify(hit.topText)}`);
    log(`CLICK REACHES BTN : ${hit.clickReachesButton ? 'YES' : 'NO  <-- something is covering it'}`);
    log(`ancestry at point : ${hit.chain.join('  <  ')}`);
  }

  cdp.close();
} finally {
  browser.cleanup();
}
