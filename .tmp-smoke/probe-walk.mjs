/**
 * Walk the whole POS flow with a real cart and report the real button labels.
 *
 * Two of the step labels are conditional — payment shows "Finalize & Print" or
 * "Review & Complete" depending on the business's autoPrint setting, and review
 * shows "Issue Professional Invoice" or "Complete Sale" depending on the payment
 * method. A flow that hardcodes one of each works on one account and hangs on
 * another, so this prints what this account actually renders.
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
const browser = await launch({ width: dev.width, height: dev.height, dpr: dev.dpr, headless: true, port: 9356, browserPath: null });
const log = (...a) => console.log('  ', ...a);
const ADD = 'button[class*="h-11"][class*="w-11"][class*="rounded-lg"]';

const snap = async (page, label) => {
  const info = JSON.parse(await page.eval(`JSON.stringify({
    p: location.pathname,
    buttons: [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null)
      .map(b => ({ t: (b.innerText||'').trim().replace(/\\s+/g,' '), d: !!b.disabled }))
      .filter(b => b.t).slice(0, 20),
  })`));
  log('');
  log(`── ${label}  [${info.p}]`);
  for (const b of info.buttons) log(`     ${b.d ? '(disabled) ' : '           '}${JSON.stringify(b.t)}`);
  return info;
};

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
  await sleep(4000);

  // Clear any cart left over from an earlier probe run, so this starts clean.
  const cleared = await page.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /^clear cart$/i.test((x.innerText||'').trim()));
    if (b) { b.click(); return true; } return false;
  })()`);
  if (cleared) { await sleep(1500); log('cleared a leftover cart'); }
  // Confirm dialog, if the app asks.
  await page.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /^(continue|confirm|clear|yes)$/i.test((x.innerText||'').trim()));
    if (b) b.click(); return true;
  })()`);
  await sleep(1200);

  await snap(page, 'select-products (clean)');
  for (let i = 0; i < 3; i++) { await page.click({ css: ADD, nth: i }); await sleep(600); }
  await snap(page, 'cart filled');

  await page.click({ text: 'Next: Customer', exact: true }, { settle: 3500 });
  await snap(page, 'after Next: Customer');

  await page.click({ text: 'Next: Payment', exact: true }, { settle: 3500 });
  const pay = await snap(page, 'after Next: Payment');

  // Pick cash, then whatever the forward button is actually called here.
  await page.click({ css: 'label[for="cash"]' }, { settle: 1200 }).catch((e) => log(`  cash click: ${e.message}`));
  const fwd = pay.buttons.map((b) => b.t).find((t) => /review & complete|finalize & print/i.test(t));
  log('');
  log(`   >> forward button on payment is: ${JSON.stringify(fwd || '(none found)')}`);
  if (fwd) {
    await page.click({ text: fwd, exact: true }, { settle: 4000 });
    const rev = await snap(page, 'after forward from payment');
    const done = rev.buttons.map((b) => b.t).find((t) => /complete sale|issue professional invoice/i.test(t));
    log('');
    log(`   >> finalise button on review is: ${JSON.stringify(done || '(none found)')}`);
  }

  cdp.close();
} finally {
  browser.cleanup();
}
