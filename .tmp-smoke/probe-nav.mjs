/**
 * How long does each POS step actually take to become interactive?
 *
 * `handleNext` fires (the button goes disabled) but the route does not arrive.
 * Neither the POS layout nor the customer page has a guard or a redirect, which
 * leaves Next.js dev-mode on-demand compilation as the remaining explanation.
 * This times a cold navigation to every step so the flow's waits can be set from
 * a measurement instead of a guess.
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
const browser = await launch({ width: dev.width, height: dev.height, dpr: dev.dpr, headless: true, port: 9355, browserPath: null });
const log = (...a) => console.log('  ', ...a);

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
  log('logged in');

  // Time a cold direct navigation to each POS step, and note the marker text we
  // would key a flow step off.
  const steps = [
    ['/sales/pos/select-products', 'Next: Customer'],
    ['/sales/pos/customer', 'Next: Payment'],
    ['/sales/pos/payment', 'Review & Complete'],
    ['/sales/pos/review', 'Complete Sale'],
  ];

  for (const [route, marker] of steps) {
    const t0 = Date.now();
    await page.goto(route);
    let found = false;
    let landedPath = route;
    while (Date.now() - t0 < 60_000) {
      const st = JSON.parse(await page.eval(`JSON.stringify({
        p: location.pathname,
        has: [...document.querySelectorAll('button,a')].some(b => (b.innerText||'').trim() === ${JSON.stringify(marker)}),
      })`));
      landedPath = st.p;
      if (st.has) { found = true; break; }
      await sleep(500);
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    log(`${found ? '✓' : '✗'} ${route.padEnd(30)} "${marker}" ${found ? 'in' : 'NOT FOUND after'} ${secs}s${landedPath !== route ? `  (ended on ${landedPath})` : ''}`);
  }

  cdp.close();
} finally {
  browser.cleanup();
}
