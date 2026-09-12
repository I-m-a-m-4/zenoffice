/**
 * The back-channel between the studio page and a running take.
 *
 * The recorder is a child process the API route spawns, so once it is running
 * there is no function call between the two — the studio can only start it and
 * watch it exit. Pausing needs to reach *into* the run, and the live view needs
 * to read out of it, so both go through two small files in `marketing-out/.live`:
 *
 *   control.json   studio writes  ->  recorder polls   (pause / resume / abort)
 *   live.json      recorder writes ->  studio polls    (what step, is it paused)
 *   live.jpg       recorder writes ->  studio polls    (the newest frame)
 *
 * A file rather than a socket or a signal because it survives the dev server's
 * hot reload, needs no port, and works identically whether the recorder was
 * started from the studio or by hand from a terminal. Writes go to a temp name
 * and get renamed, since rename is atomic and both sides poll on their own
 * schedule — the alternative is one of them eventually reading half a file.
 *
 * Everything here is best-effort by design. A live view that misses an update is
 * a cosmetic problem; a take that dies because its status file was locked by a
 * virus scanner for 40ms is not acceptable, so nothing in this module throws.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const LIVE_DIRNAME = '.live';

export function liveDir(outDir) {
  return path.join(outDir, LIVE_DIRNAME);
}

export function livePaths(outDir) {
  const dir = liveDir(outDir);
  return {
    dir,
    control: path.join(dir, 'control.json'),
    status: path.join(dir, 'live.json'),
    frame: path.join(dir, 'live.jpg'),
  };
}

/** Atomic-ish JSON write: temp file, then rename over the target. */
export function writeJson(file, value) {
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(value), 'utf8');
    renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

export function readJson(file, fallback = null) {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // A torn read is possible despite the rename if the reader opened the file
    // mid-swap on Windows; the next poll gets a clean one, so this is not worth
    // reporting.
    return fallback;
  }
}

/**
 * Clear stale files so a new run cannot inherit the last one's state.
 *
 * Without this, a run that was paused when it crashed leaves `paused: true`
 * behind and the *next* run starts frozen — with the studio showing a pause the
 * operator never asked for and the log sitting silent, which is a memorable way
 * to lose ten minutes.
 */
export function resetLive(outDir) {
  const p = livePaths(outDir);
  try { mkdirSync(p.dir, { recursive: true }); } catch { /* best effort */ }
  for (const f of [p.control, p.status, p.frame]) {
    try { rmSync(f, { force: true }); } catch { /* best effort */ }
  }
  return p;
}

/**
 * The recorder's side: read what the studio is asking for.
 *
 * Returns `{ paused, abort }`, defaulting to neither when the file is missing —
 * absence has to mean "carry on", or a run started from the terminal (which never
 * writes a control file) would never begin.
 */
export function readControl(controlFile) {
  const c = readJson(controlFile, null);
  return { paused: c?.paused === true, abort: c?.abort === true };
}

/** The studio's side: ask a running take to pause, resume or stop. */
export function writeControl(controlFile, patch) {
  const cur = readJson(controlFile, {}) ?? {};
  return writeJson(controlFile, { ...cur, ...patch, at: Date.now() });
}
