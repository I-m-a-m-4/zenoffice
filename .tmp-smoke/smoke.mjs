/**
 * Smoke test: everything except login and the flow selectors.
 *
 * Drives the app's own public landing page so no account and no Firestore reads
 * are involved, but exercises the real launch -> CDP -> cursor overlay -> real
 * input events -> screencast -> ffmpeg encode -> probe path.
 */
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { Cdp } from '../scripts/record/cdp.mjs';
import { launch } from '../scripts/record/browser.mjs';
import { Page, sleep } from '../scripts/record/page.mjs';
import { Recorder, probe } from '../scripts/record/capture.mjs';

const log = (...a) => console.log('  ', ...a);
const OUT = path.join(process.cwd(), '..', 'marketing-out', '.smoke');
mkdirSync(OUT, { recursive: true });

const dev = { id: 'desktop', width: 1280, height: 720, dpr: 1.5, outW: 1920, outH: 1080, mobile: false };

const browser = await launch({ width: dev.width, height: dev.height, dpr: 1, headless: true, port: 9344 });
let cdp, recorder, failed = null;
try {
  cdp = await Cdp.attach(browser.page.webSocketDebuggerUrl);
  log('CDP attached');

  const page = new Page(cdp, { device: dev, theme: 'dark', baseUrl: 'http://localhost:9007', log });
  await page.prepare();
  log('page prepared (theme forced, overlay injected)');

  await page.goto('/');
  log('navigated to / — title:', JSON.stringify(await page.eval('document.title')));

  await page.zen('mode("desktop")');
  await page.zen('show(true)');
  await page.zen('place(700,500)');
  log('cursor overlay live');

  recorder = new Recorder(cdp, {
    dir: path.join(OUT, '.frames'), fps: 30, quality: 92,
    maxWidth: dev.outW, maxHeight: dev.outH,
  });
  await recorder.start();
  log('screencast started');

  await page.caption('Smoke test — real app, real cursor', 1500);
  await page.mouseTo(400, 300);
  await sleep(300);
  await page.mouseClick(400, 300);
  await sleep(300);
  await page.scrollBy(500);
  await sleep(400);
  await page.mouseTo(900, 420);
  await page.mouseClick(900, 420);
  await sleep(600);
  await page.card('Zeneva', 'pipeline verified', 'end to end', 1500);
  await sleep(400);

  const stats = await recorder.stop();
  log(`captured ${stats.count} frames over ${recorder.seconds.toFixed(1)}s` + (stats.dropped ? ` (${stats.dropped} dropped)` : ''));
  if (!stats.count) throw new Error('no frames captured');

  const outFile = path.join(OUT, 'smoke.mp4');
  await recorder.encode(outFile);
  const info = await probe(outFile);
  log(`encoded: ${info.width}x${info.height} · ${info.seconds.toFixed(2)}s · ${info.frames} frames @ ${info.fps} · ${(info.bytes/1e6).toFixed(2)} MB`);
  log(`marks: ${page.marks.clicks.length} clicks, ${page.marks.keys.length} keys`);
  console.log('\nSMOKE OK');
} catch (err) {
  failed = err;
  console.log('\nSMOKE FAILED:', err.message);
} finally {
  try { if (recorder) await recorder.stop(); } catch {}
  try { cdp?.close(); } catch {}
  browser.cleanup();
}
process.exit(failed ? 1 : 0);
