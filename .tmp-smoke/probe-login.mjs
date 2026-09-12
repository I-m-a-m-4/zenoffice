/**
 * Does the bot's typing actually land in the login fields?
 *
 * "The app rejected those credentials" has two very different causes: the
 * password is wrong, or the bot mistyped it. This reads the fields back before
 * submitting, so the two stop looking alike.
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
const email = env.ZENEVA_RECORD_EMAIL;
const password = env.ZENEVA_RECORD_PASSWORD;

const dev = { id: 'desktop', width: 1280, height: 720, dpr: 1.5, outW: 1920, outH: 1080, mobile: false };
const browser = await launch({
  width: dev.width, height: dev.height, dpr: dev.dpr,
  headless: true, port: 9351, browserPath: null,
});

const log = (...a) => console.log('  ', ...a);

try {
  const cdp = await Cdp.attach(browser.page.webSocketDebuggerUrl);
  const page = new Page(cdp, { device: dev, theme: 'light', baseUrl: 'http://localhost:9007', log });
  await page.prepare();

  // Capture the app's own console + any failed network call, so a Firebase
  // config problem shows up as itself rather than as "bad password".
  await cdp.send('Runtime.enable');
  const console_ = [];
  cdp.on('Runtime.consoleAPICalled', (p) => {
    console_.push(`${p.type}: ${(p.args || []).map((a) => a.value ?? a.description ?? '').join(' ')}`);
  });

  await page.goto('/login');
  await page.find({ css: '#email' }, { timeoutMs: 30_000 });

  await page.click({ css: '#email' }, { settle: 120, dur: 260 });
  await page.type(email, { delay: 8 });
  await page.click({ css: '#password' }, { settle: 120, dur: 260 });
  await page.type(password, { delay: 8 });
  await sleep(300);

  const got = await page.eval(
    `JSON.stringify({
       email: document.querySelector('#email')?.value ?? null,
       password: document.querySelector('#password')?.value ?? null,
     })`,
  );
  const parsed = JSON.parse(got);
  log(`expected email : ${JSON.stringify(email)}`);
  log(`actual   email : ${JSON.stringify(parsed.email)}`);
  log(`email matches  : ${parsed.email === email ? 'YES' : 'NO  <-- typing bug'}`);
  log(`expected pw len: ${password.length}`);
  log(`actual   pw len: ${parsed.password === null ? 'null' : parsed.password.length}`);
  log(`pw matches     : ${parsed.password === password ? 'YES' : 'NO  <-- typing bug'}`);

  if (parsed.email === email && parsed.password === password) {
    log('');
    log('fields are correct — submitting to see what the app says');
    await page.click({ text: 'Login', tag: 'button', exact: true }, { settle: 400 });
    await sleep(9000);
    const where = await page.eval('location.pathname');
    const toast = await page.eval(
      `(document.body.innerText||'').split('\\n').filter(l=>/invalid|failed|error|disabled|too many|network/i.test(l)).slice(0,6).join(' | ')`,
    );
    log(`landed on      : ${where}`);
    log(`page says      : ${toast || '(nothing matching)'}`);
  }

  const noise = console_.filter((l) => /error|warn|auth|firebase/i.test(l)).slice(-12);
  if (noise.length) {
    log('');
    log('browser console:');
    for (const l of noise) log(`   ${l.slice(0, 200)}`);
  }

  cdp.close();
} finally {
  browser.cleanup();
}
