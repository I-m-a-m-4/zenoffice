/**
 * Walk the POS flow one step at a time and report the real DOM at each stage.
 *
 * The flow failed at "Next: Payment", but the step before it is the suspect: if
 * the add-to-cart selector matches nothing, the cart is empty and the customer
 * step never becomes reachable. Guessing which is which is how selectors get
 * "fixed" one label at a time, so this prints what is actually on screen.
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
const browser = await launch({
  width: dev.width, height: dev.height, dpr: dev.dpr,
  headless: true, port: 9353, browserPath: null,
});
const log = (...a) => console.log('  ', ...a);

const ADD = 'button[class*="h-11"][class*="w-11"][class*="rounded-lg"]';

try {
  const cdp = await Cdp.attach(browser.page.webSocketDebuggerUrl);
  const page = new Page(cdp, { device: dev, theme: 'light', baseUrl: 'http://localhost:9007', log });
  await page.prepare();

  // --- login (now that typing is fixed) ---
  await page.goto('/login');
  await page.find({ css: '#email' }, { timeoutMs: 30_000 });
  await page.click({ css: '#email' }, { settle: 120, dur: 260 });
  await page.type(env.ZENEVA_RECORD_EMAIL, { delay: 6 });
  await page.click({ css: '#password' }, { settle: 120, dur: 260 });
  await page.type(env.ZENEVA_RECORD_PASSWORD, { delay: 6 });
  await page.click({ text: 'Login', tag: 'button', exact: true }, { settle: 400 });
  await page.waitUntil(async () => (await page.eval('location.pathname')) !== '/login', 45_000, 'login');
  await page.waitForSettled();
  log(`logged in -> ${await page.eval('location.pathname')}`);

  const report = async (label) => {
    const info = JSON.parse(await page.eval(`JSON.stringify({
      path: location.pathname,
      addButtons: document.querySelectorAll(${JSON.stringify(ADD)}).length,
      buttons: [...document.querySelectorAll('button,a[role="button"]')]
        .filter(b => b.offsetParent !== null)
        .map(b => (b.innerText||'').trim().replace(/\\s+/g,' '))
        .filter(Boolean).slice(0, 24),
      disabled: [...document.querySelectorAll('button')]
        .filter(b => b.disabled && b.offsetParent !== null)
        .map(b => (b.innerText||'').trim().replace(/\\s+/g,' ')).filter(Boolean).slice(0,8),
      emptyCart: /cart is empty|no items|add products/i.test(document.body.innerText||''),
      toast: [...document.querySelectorAll('[role="status"],[role="alert"],li[data-state]')]
        .map(t=>(t.innerText||'').trim().replace(/\\s+/g,' ')).filter(Boolean).slice(0,3),
    })`));
    log('');
    log(`── ${label}`);
    log(`   path        : ${info.path}`);
    log(`   ADD matches : ${info.addButtons}`);
    log(`   emptyCart?  : ${info.emptyCart}`);
    if (info.toast.length) log(`   toast       : ${info.toast.join(' | ')}`);
    if (info.disabled.length) log(`   DISABLED    : ${JSON.stringify(info.disabled)}`);
    log(`   buttons     : ${JSON.stringify(info.buttons)}`);
    return info;
  };

  await page.goto('/sales/pos/select-products');
  await sleep(3500);
  const step1 = await report('select-products (landed)');

  if (step1.addButtons > 0) {
    for (let i = 0; i < Math.min(3, step1.addButtons); i++) {
      await page.click({ css: ADD, nth: i });
      await sleep(500);
    }
    await report('after 3 add-to-cart clicks');
  } else {
    log('   !! ADD selector matched nothing — cart cannot fill');
  }

  await page.click({ text: 'Next: Customer', exact: true }, { settle: 2500 }).catch((e) => log(`   click failed: ${e.message}`));
  await sleep(2500);
  await report('after Next: Customer');

  cdp.close();
} finally {
  browser.cleanup();
}
