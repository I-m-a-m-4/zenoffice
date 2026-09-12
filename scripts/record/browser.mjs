/**
 * Finds and launches the locally installed Chrome (or Edge — same engine) with a
 * throwaway profile and remote debugging on.
 *
 * A throwaway `--user-data-dir` under the OS temp dir is what keeps this safe to
 * run against a real account: the login lands in a profile that is deleted when
 * the take finishes, so no session token is left on disk and the developer's own
 * Chrome profile is never opened, never locked, and never sees the app.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { freemem, tmpdir, totalmem } from 'node:os';
import path from 'node:path';
import { waitForEndpoint } from './cdp.mjs';

/**
 * Refuse to start a take the machine cannot hold, and say so in those terms.
 *
 * A recording Chrome plus a Next dev server wants roughly 1.5GB. Below that the
 * renderer gets killed partway through, the debug socket drops, and every error
 * downstream describes a *symptom* — a selector that never appeared, a route that
 * never arrived — which is a genuinely misleading place to start debugging from.
 * Checking here costs nothing and turns forty wasted seconds into one sentence.
 *
 * A warning rather than a hard stop: this is the developer's own machine and the
 * number moves constantly, so the call is theirs to make.
 */
function memoryAdvice() {
  const freeGb = freemem() / 1024 ** 3;
  const totalGb = totalmem() / 1024 ** 3;
  if (freeGb >= 1.5) return null;
  return `only ${freeGb.toFixed(1)}GB of ${totalGb.toFixed(1)}GB RAM is free — `
    + 'Chrome may be killed mid-take. Close some tabs if this run fails oddly.';
}

const WIN_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const POSIX_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

export function findBrowser(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`--browser path does not exist: ${explicit}`);
    return explicit;
  }
  const list = process.platform === 'win32' ? WIN_CANDIDATES : POSIX_CANDIDATES;
  const hit = list.find((p) => existsSync(p));
  if (!hit) {
    throw new Error(
      'Could not find Chrome or Edge. Pass --browser "<full path to chrome.exe>".',
    );
  }
  return hit;
}

/**
 * @param {{ width:number, height:number, dpr:number, headless:boolean,
 *           port:number, browserPath?:string }} opts
 */
export async function launch(opts) {
  const exe = findBrowser(opts.browserPath);
  const profile = mkdtempSync(path.join(tmpdir(), 'zeneva-rec-'));
  const advice = memoryAdvice();
  if (advice && opts.log) opts.log(`⚠ ${advice}`);

  const args = [
    `--remote-debugging-port=${opts.port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${opts.width},${opts.height}`,
    `--force-device-scale-factor=${opts.dpr}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate,MediaRouter,OptimizationHints',
    '--disable-extensions',
    '--disable-background-networking',
    '--hide-crash-restore-bubble',
    // Chrome's own scrollbars would be baked into the footage; the overlay adds
    // nothing to hide them, so suppress them at the engine level instead.
    '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required',
    // A recording browser is a single tab that lives for one take, so most of
    // Chrome's background machinery is pure memory cost. This matters more than
    // it sounds: a take died mid-flow on a machine with 1.6GB free because the
    // renderer was squeezed out, and the recorder reported it as a navigation
    // timeout. Trimming here is what makes a run survive alongside a dev server,
    // a browser full of tabs and an editor.
    '--disable-sync',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-client-side-phishing-detection',
    '--no-pings',
    '--mute-audio',
    // One renderer for the whole take. The default spawns a process per site,
    // and the app embeds enough third-party origins (Firebase, fonts) to make
    // that add up for no benefit — nothing here is a security boundary, since
    // the profile is thrown away when the take ends.
    '--process-per-site',
    'about:blank',
  ];
  if (opts.headless) args.unshift('--headless=new');

  // POSIX: own process group, so one kill takes the group. Windows has no groups
  // and `detached` there means "own console window", which we do not want.
  const child = spawn(exe, args, {
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });
  let exited = false;
  let cleaned = false;
  child.on('exit', () => { exited = true; });

  // A throw anywhere between here and the caller's `finally` used to leak the
  // whole browser: the probe scripts written during this work died before their
  // cleanup ran and left a Chrome per attempt behind. `exit` fires on a normal
  // return, an uncaught throw and an explicit process.exit alike, so hanging the
  // kill off it means no exit path can skip it. Handlers must be synchronous,
  // which is why the kill uses spawnSync rather than a promise.
  process.once('exit', onProcessExit);
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  let page;
  try {
    page = await waitForEndpoint(opts.port);
  } catch (err) {
    cleanup();
    throw err;
  }

  function killTree() {
    if (!exited) {
      // `child.kill()` alone is not enough on Windows: it terminates the single
      // PID we spawned, while Chrome's renderer, GPU and network processes are
      // separate children that survive and keep their memory. Twelve takes then
      // leave dozens of orphans behind and the machine runs out of RAM — which
      // surfaces as the *dev server* answering 500 to everything, so the recorder
      // gets blamed for breaking an app it never touched.
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
          // Negative pid = the whole process group, which `detached` gave us.
          try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
        }
      } catch { /* already dead */ }
    }
    sweepByProfile();
  }

  /**
   * Backstop: kill anything still holding *this take's* throwaway profile.
   *
   * `taskkill /T` walks the parent→child tree, so it only works while the process
   * we spawned is still alive to be the root of it. Chrome does not always stay
   * that process — it can hand off and let the launcher exit, at which point the
   * tree is orphaned, `exited` is true, and the kill above is skipped entirely.
   *
   * The `--user-data-dir` we generated is a fresh mkdtemp name that exists nowhere
   * else on the machine, so matching command lines against it targets exactly the
   * processes this call started and cannot touch the developer's own browser.
   */
  function sweepByProfile() {
    if (process.platform !== 'win32') return;
    const leaf = path.basename(profile);
    if (!/^zeneva-rec-/.test(leaf)) return; // never sweep on an unexpected name
    try {
      spawnSync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command',
          `Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" ` +
          `| Where-Object { $_.CommandLine -like '*${leaf}*' } ` +
          `| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
        { stdio: 'ignore', timeout: 15_000 },
      );
    } catch { /* best effort */ }
  }

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    process.off('exit', onProcessExit);
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    killTree();
    // Chrome writes the profile lazily; give it a beat before removing so the
    // rmSync doesn't race a flush and throw EBUSY on Windows.
    setTimeout(() => {
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 5 }); } catch { /* best effort */ }
    }, 400);
  }

  function onProcessExit() {
    if (cleaned) return;
    cleaned = true;
    killTree();
    // No timers run during `exit`, so the profile has to go synchronously or not
    // at all. Losing a temp dir is a far smaller problem than losing a browser.
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 1 }); } catch { /* best effort */ }
  }

  function onSignal() {
    onProcessExit();
    process.exit(130);
  }

  return { exe, page, cleanup };
}
