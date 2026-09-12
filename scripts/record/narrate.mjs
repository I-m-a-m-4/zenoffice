/**
 * Narration: turn the caption track into a spoken voice-over.
 *
 * A caption is already the script. Every flow and every recipe says what it is
 * doing in words on screen, timestamped by `page.caption()`, so a voice-over is
 * not new writing — it is the same sentences, spoken, landing on the frames they
 * were written for. Keeping one source is the whole design: a separate narration
 * script would drift from the captions the first time anyone edited one of them.
 *
 * ## Two engines, one timeline
 *
 * `gemini` is the good one and needs `GEMINI_API_KEY`. `windows` speaks through
 * `System.Speech` — the SAPI voices already installed on any Windows box — and
 * needs nothing at all. It is audibly more robotic, and it exists for two
 * reasons: a machine with no key still gets a voice-over rather than silence, and
 * the **audio-description** track a Microsoft Store listing asks for is a
 * separate spoken file that has to exist even when nobody has paid for a key.
 *
 * The engines are interchangeable because neither one owns the timing. Both are
 * asked for one line at a time and hand back a WAV; the assembly below delays
 * each file to the instant its caption appeared and mixes the set down. Swapping
 * engines therefore cannot desynchronise anything — it changes who is speaking,
 * not when.
 *
 * ## How the voice is made
 *
 * Google's Gemini TTS models return **raw signed 16-bit little-endian PCM at
 * 24kHz, mono** — not a WAV, not an MP3. There is no RIFF header on it, so it is
 * written here with one prepended; ffmpeg would otherwise read the first 44 bytes
 * of speech as a header and produce a click plus a wrong duration.
 *
 * SAPI, by contrast, writes a real RIFF file itself, at whatever rate the voice
 * was recorded at — so its duration is read back with `ffprobe` rather than
 * derived from a byte count. Every line's measured duration is returned to the
 * caller, which is what lets a `.vtt` cue end when the sentence ends instead of
 * at a guess.
 *
 * Each line is synthesised separately rather than as one long take. That costs
 * more requests, but it is what makes the timing exact: line *n* is delayed to
 * the instant caption *n* appeared, so a slow selector lookup mid-flow moves the
 * voice with it. One long file would desynchronise from the first hesitation
 * onward and there would be nothing to nudge.
 *
 * ## What happens when an engine is unavailable
 *
 * Nothing breaks. `synthNarration` returns `null`, the recorder logs one line
 * saying narration was skipped, and the take is scored exactly as it was before
 * this file existed. Narration is an enhancement to an already-working pipeline
 * and is wired to fail that way on purpose — a missing key at 2am should cost you
 * a voice track, not the video.
 *
 * Which engine gets used is decided by the caller, never here. `pickEngine()`
 * offers the obvious default — Gemini if a key is present, SAPI on Windows if not
 * — but it is called from the CLI so the choice is logged before a single line is
 * spoken. An engine that silently downgraded itself would hand back a robotic
 * voice-over on footage somebody expected Gemini to read, and the only symptom
 * would be a finished video that sounds wrong.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Gemini's TTS output format. Fixed by the API, not a preference. */
const PCM_RATE = 24_000;
const PCM_CHANNELS = 1;
const PCM_BITS = 16;

/**
 * Prebuilt Gemini voices, chosen for narration rather than listed exhaustively.
 *
 * The API offers around thirty; most are characterful in a way that fights a
 * product demo. These six read as a person explaining something they know well,
 * which is the register marketing footage wants.
 */
export const VOICES = [
  { id: 'Charon', label: 'Charon', note: 'Warm, measured. The default.' },
  { id: 'Kore', label: 'Kore', note: 'Bright and direct.' },
  { id: 'Puck', label: 'Puck', note: 'Upbeat, quicker.' },
  { id: 'Aoede', label: 'Aoede', note: 'Soft, unhurried.' },
  { id: 'Fenrir', label: 'Fenrir', note: 'Deeper, steady.' },
  { id: 'Leda', label: 'Leda', note: 'Youthful, clear.' },
];

export const DEFAULT_VOICE = 'Charon';

/**
 * SAPI voices, named by the half of the name that is stable.
 *
 * Windows installs these as "Microsoft David Desktop" / "Microsoft Zira Desktop",
 * but the exact string differs by OS build and by which language packs are on the
 * machine — "Microsoft Zira" without the suffix exists too. So the id here is the
 * distinctive word and `resolveWinVoice()` substring-matches it against whatever
 * `GetInstalledVoices()` actually reports. Asking SAPI for an exact name it does
 * not have throws, and it throws *per line*, which turns one typo into one failure
 * per sentence.
 */
export const WIN_VOICES = [
  { id: 'David', label: 'David', note: 'Male, en-US. The default.' },
  { id: 'Zira', label: 'Zira', note: 'Female, en-US.' },
];

export const DEFAULT_WIN_VOICE = 'David';

/** The engines, and what each one needs to work. */
export const ENGINES = ['gemini', 'windows'];

/**
 * The voice list for an engine, so a caller can validate a `--voice` and print a
 * useful list without knowing which engine it is talking to.
 */
export const voicesFor = (engine) => (engine === 'windows' ? WIN_VOICES : VOICES);
export const defaultVoiceFor = (engine) => (engine === 'windows' ? DEFAULT_WIN_VOICE : DEFAULT_VOICE);

/**
 * The engine to use when nobody said. Gemini if it can, SAPI if it must.
 *
 * Called from the CLI rather than from `synthNarration` on purpose — see the
 * header. The point is that the operator reads which voice they are getting in the
 * log *before* the take, not afterwards in the video.
 */
export function pickEngine() {
  if (apiKey()) return 'gemini';
  return process.platform === 'win32' ? 'windows' : 'gemini';
}

/** The model that speaks. Flash is enough for narration and far cheaper. */
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

export function apiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}

/**
 * How the model should read the line.
 *
 * Gemini TTS takes direction in the prompt itself — there is no separate style
 * parameter — so the instruction is prepended to the text. It is deliberately
 * about *restraint*: the failure mode of TTS on marketing copy is an infomercial
 * voice, and a product demo needs someone who already believes the product works.
 */
function directed(text, style) {
  const tone = style?.trim()
    || 'Read this calmly and warmly, like a knowledgeable colleague explaining '
     + 'something useful. Natural pace, no salesy emphasis, no rising sing-song.';
  return `${tone}\n\n${text}`;
}

/** Wrap raw PCM in a RIFF header so ffmpeg reads it as audio and not as noise. */
function wavHeader(bytes) {
  const blockAlign = (PCM_CHANNELS * PCM_BITS) / 8;
  const byteRate = PCM_RATE * blockAlign;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + bytes, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);          // PCM chunk size
  h.writeUInt16LE(1, 20);           // format: PCM
  h.writeUInt16LE(PCM_CHANNELS, 22);
  h.writeUInt32LE(PCM_RATE, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(PCM_BITS, 34);
  h.write('data', 36);
  h.writeUInt32LE(bytes, 40);
  return h;
}

/**
 * Speak one line. Returns a WAV buffer, or throws with the API's own message.
 *
 * The 60s timeout is per line, and lines are one or two sentences — anything
 * slower than that is the API being unavailable rather than busy, and a recorder
 * that hangs on a network call is worse than one that says narration failed.
 */
async function speak(text, voice, style, signal) {
  const key = apiKey();
  if (!key) throw new Error('no GEMINI_API_KEY');

  const res = await fetch(`${API_ROOT}/${TTS_MODEL}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: directed(text, style) }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || DEFAULT_VOICE } },
        },
      },
    }),
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body?.error?.message || detail;
    } catch { /* the status alone is the message */ }
    throw new Error(detail);
  }

  const body = await res.json();
  const b64 = body?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data)?.inlineData?.data;
  if (!b64) throw new Error('the model returned no audio');

  const pcm = Buffer.from(b64, 'base64');
  return Buffer.concat([wavHeader(pcm.length), pcm]);
}

/*
 * ---------------------------------------------------------------------------
 * The Windows engine
 * ---------------------------------------------------------------------------
 */

/** SAPI's rate scale. -10 is a crawl, 10 is unintelligible. */
const WIN_RATE_MIN = -10;
const WIN_RATE_MAX = 10;

/**
 * Slightly under default speed.
 *
 * SAPI at rate 0 reads marketing copy faster than the footage moves, and the
 * lines here are written to land on a specific frame — a sentence that finishes
 * early leaves the shot silent while the cursor is still travelling. -1 is about
 * 8% slower and closes that gap without sounding sedated.
 */
const WIN_RATE_DEFAULT = -1;

/**
 * Anything that reaches PowerShell as an interpolated string is reduced to this
 * set first.
 *
 * The voice name is the only value below that is *not* passed as a file path, so
 * it is the only one that ends up inside a double-quoted PowerShell wildcard. A
 * name is a name — letters, digits and spaces — and clamping it to that means a
 * hostile or fat-fingered `--voice` cannot become a second statement.
 */
const winVoiceSafe = (name) => String(name ?? '').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 60);

/** PowerShell single-quoted literal: the only escape inside one is `''`. */
const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

function powershell(script) {
  return new Promise((resolve, reject) => {
    /*
     * `powershell.exe`, not `pwsh`.
     *
     * `System.Speech` is a .NET Framework assembly. PowerShell 7 runs on .NET
     * Core, where `Add-Type -AssemblyName System.Speech` fails unless the
     * compatibility pack happens to be installed — so a machine with pwsh on PATH
     * would lose narration for a reason that has nothing to do with narration.
     * Windows PowerShell 5.1 ships with the OS and always has the assembly.
     */
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0
      ? resolve()
      : reject(new Error(err.trim().split('\n')[0] || `powershell exited ${code}`))));
  });
}

/**
 * Speak one line through SAPI, straight to `outFile`.
 *
 * Unlike the Gemini path this returns nothing — SAPI writes the WAV itself, and
 * asking it to hand back a buffer would mean reading the file it just wrote only
 * to write it again.
 *
 * The text goes via a UTF-8 file rather than into the command line. A caption is
 * arbitrary prose containing apostrophes, em-dashes and (in eleven languages)
 * non-Latin characters; every one of those is a quoting bug waiting in a
 * `-Command` string, and the non-Latin ones are also a codepage bug, because the
 * console PowerShell is spawned with is not UTF-8. `ReadAllText` with an explicit
 * encoding sidesteps both.
 */
async function speakWindows(outFile, text, voice, rate) {
  if (process.platform !== 'win32') throw new Error('the windows voice needs Windows');

  const txt = `${outFile}.txt`;
  writeFileSync(txt, String(text), 'utf8');

  const want = winVoiceSafe(voice || DEFAULT_WIN_VOICE);
  const r = Math.max(WIN_RATE_MIN, Math.min(WIN_RATE_MAX, Math.round(Number(rate ?? WIN_RATE_DEFAULT))));

  /*
   * `SetOutputToNull()` before `Dispose()`, and both in a `finally`.
   *
   * The wave file is held open and its RIFF length field is only written when the
   * output is released. A throw between `SetOutputToWaveFile` and the release
   * leaves a WAV on disk whose header claims zero bytes of data — which ffmpeg
   * reads as a valid empty file rather than an error, so the line would go
   * silently missing from the mix instead of being reported as a failed line.
   */
  const script = [
    "$ErrorActionPreference='Stop'",
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    'try {',
    `  $v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Name -like "*${want}*" } | Select-Object -First 1`,
    '  if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }',
    `  $s.Rate = ${r}`,
    `  $s.SetOutputToWaveFile(${psQuote(outFile)})`,
    `  $s.Speak([IO.File]::ReadAllText(${psQuote(txt)}, [Text.Encoding]::UTF8))`,
    '} finally {',
    '  $s.SetOutputToNull()',
    '  $s.Dispose()',
    '}',
  ].join('\n');

  try {
    await powershell(script);
  } finally {
    rmSync(txt, { force: true });
  }

  if (!existsSync(outFile) || statSync(outFile).size < 1024) {
    throw new Error('SAPI produced no audio');
  }

  await trimTail(outFile);
}

/**
 * Cut the silence SAPI leaves on the end of every line.
 *
 * Measured on this machine: SAPI appends a consistent ~0.87s of digital silence
 * after the last phoneme. It is inaudible in the mix — `adelay` places each line
 * absolutely, so trailing silence overlaps nothing — but the file's duration is
 * what a `.vtt` cue is built from, and a caption that stays on screen for 4.0s to
 * read four words looks like a bug in the captions rather than in the voice.
 *
 * Trimmed here, once, into the cache: the file on disk becomes the honest length
 * of the sentence, so `ffprobe` needs no correction and nothing downstream has to
 * know SAPI does this.
 *
 * `start_silence=0.12` keeps a beat of it. `silenceremove` cuts at the first
 * sample under the threshold, which on a trailing fricative — the *s* of "totals"
 * — lands a few milliseconds inside the word; 120ms of padding costs nothing and
 * means the trim can never clip a soft final consonant.
 *
 * Best-effort: a failed trim leaves the untrimmed file, which still plays.
 */
async function trimTail(file) {
  const tmp = `${file}.trim.wav`;
  try {
    await ffmpeg([
      '-i', file,
      // No `silenceremove` option trims the *end*, only the start — so the file
      // is reversed, its new start trimmed, and reversed back.
      '-af', 'areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse',
      tmp,
    ]);
    if (existsSync(tmp) && statSync(tmp).size > 1024) renameSync(tmp, file);
    else rmSync(tmp, { force: true });
  } catch {
    rmSync(tmp, { force: true });
  }
}

/** How long a spoken line actually runs. Read off the file, never estimated. */
async function wavSeconds(file) {
  const out = await new Promise((resolve) => {
    const p = spawn('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', file,
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.on('error', () => resolve(''));
    p.on('close', () => resolve(buf));
  });
  const n = Number(String(out).trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}


function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `ffmpeg exited ${code}`))));
  });
}

/**
 * Where a spoken line is cached, addressed by what it sounds like.
 *
 * The key is the whole request — model, voice, tone direction, text — and **not**
 * the line's position in the take. Keying by index was the first version and it
 * was wrong in a way that would have been maddening to debug: re-recording
 * `pos-desktop-light` with `--voice Kore` would have found `line-03.wav` from the
 * Charon run sitting there and reused it, so the flag would have appeared to do
 * nothing at all.
 *
 * Content-addressing also makes the cache shared rather than per-take, which is
 * where the money is. `--device both --theme both` is four takes of identical
 * captions; the first pays for the voice and the other three read it off disk.
 * Same for re-scoring a take from last week in a voice you have already used.
 *
 * `engine` and `rate` are in the key for exactly the reason the index was taken
 * out of it. Gemini's Charon and SAPI's David are both "a voice"; a key that did
 * not name the engine would let a Gemini line satisfy a `--voice-engine windows`
 * request, and the flag would appear to do nothing — the same silent no-op, one
 * layer down.
 */
function cachePath(dir, text, { engine, voice, style, rate }) {
  // JSON rather than joining on a separator: a caption is arbitrary text, and any
  // separator it might contain would let two different requests hash alike.
  const key = createHash('sha1')
    .update(JSON.stringify([
      engine,
      engine === 'windows' ? 'sapi' : TTS_MODEL,
      voice || defaultVoiceFor(engine),
      engine === 'windows' ? String(rate ?? WIN_RATE_DEFAULT) : (style || ''),
      text,
    ]))
    .digest('hex')
    .slice(0, 16);
  return path.join(dir, `${key}.wav`);
}

/**
 * Synthesise a narration track for a take.
 *
 * `lines` is `page.marks.narration` already converted to **video time** — the
 * conversion belongs to the caller, which owns the frame timeline. Each line is
 * delayed to its own instant with `adelay` and the whole set mixed down to one
 * track the length of the video.
 *
 * Returns `{ file, lines }` — the mixdown's path, and every line that made it in
 * with the duration it actually turned out to be. The durations are the reason
 * this returns an object rather than a path: a `.vtt` cue has to *end*, and the
 * only honest end for "Tap to add. Stock and totals update instantly." is when
 * that sentence stops being spoken. Nothing else in the pipeline knows it.
 *
 * Returns `null` when narration is off, unavailable, or produced nothing usable.
 * Never throws for a reason the operator cannot fix.
 */
export async function synthNarration({
  lines, dir, stamp, engine = 'gemini', voice, style, rate, duration, log = () => {}, signal,
}) {
  if (!lines?.length) return null;
  if (engine === 'gemini' && !apiKey()) {
    log('narration: skipped — no GEMINI_API_KEY (try --voice-engine windows)');
    return null;
  }
  if (engine === 'windows' && process.platform !== 'win32') {
    log('narration: skipped — the windows voice needs Windows');
    return null;
  }

  // Two directories, because they have different lifetimes: the mixdown belongs
  // to this take and is overwritten by the next run of it, while a spoken line
  // belongs to whoever asks for that text in that voice again.
  const takeDir = path.join(dir, '.narration', stamp);
  const cacheDir = path.join(dir, '.narration', 'voices');
  mkdirSync(takeDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  const spoken = [];
  let paid = 0;
  for (const [i, line] of lines.entries()) {
    const text = String(line.text ?? '').trim();
    if (!text) continue;
    const file = cachePath(cacheDir, text, { engine, voice, style, rate });
    try {
      if (!existsSync(file)) {
        if (engine === 'windows') await speakWindows(file, text, voice, rate);
        else writeFileSync(file, await speak(text, voice, style, signal));
        paid++;
      }
      spoken.push({ file, text, at: Math.max(0, Number(line.at) || 0), dur: await wavSeconds(file) });
    } catch (err) {
      // One failed line loses one sentence, not the narration. Reported so the
      // gap in the voice-over has a stated cause rather than looking like a bug.
      log(`narration: line ${i + 1} failed (${err.message}) — continuing`);
      // A half-written WAV would be treated as a cache hit on the next run and
      // the line would stay missing for good.
      rmSync(file, { force: true });
    }
  }

  if (!spoken.length) {
    log('narration: no lines were synthesised');
    return null;
  }

  const out = path.join(takeDir, 'narration.wav');
  const inputs = spoken.flatMap((s) => ['-i', s.file]);
  const delays = spoken
    .map((s, i) => `[${i}:a]adelay=${Math.round(s.at * 1000)}:all=1[d${i}]`)
    .join(';');
  const mixIn = spoken.map((_, i) => `[d${i}]`).join('');

  // `amix` normalises by input count, which would make a ten-line narration a
  // third the level of a three-line one. `normalize=0` keeps every line at the
  // level it was spoken; they do not overlap, so nothing sums into clipping.
  const filter = `${delays};${mixIn}amix=inputs=${spoken.length}:normalize=0:dropout_transition=0[n]`;

  try {
    await ffmpeg([
      ...inputs,
      '-filter_complex', filter,
      '-map', '[n]',
      '-t', String(duration),
      '-ar', String(PCM_RATE),
      '-ac', '1',
      out,
    ]);
  } catch (err) {
    log(`narration: mixdown failed (${err.message}) — continuing without it`);
    return null;
  }

  // The cached count is worth printing: it is the difference between a re-score
  // that costs nothing and one that quietly re-buys every line.
  const reused = spoken.length - paid;
  log(`narration: ${spoken.length}/${lines.length} line(s) in `
    + `${voice || defaultVoiceFor(engine)}${engine === 'windows' ? ' (SAPI)' : ''}`
    + (reused ? ` (${reused} from cache)` : ''));
  return {
    file: out,
    // Sorted, because a caption track has to be monotonic to be a caption track.
    // The mix does not care about order — `adelay` places every line absolutely —
    // so nothing upstream has ever had a reason to keep these sorted.
    lines: spoken
      .map(({ text, at, dur }) => ({ text, at, dur }))
      .sort((a, b) => a.at - b.at),
  };
}
