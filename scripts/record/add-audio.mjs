#!/usr/bin/env node
/**
 * Score a video that already exists.
 *
 *   node scripts/record/add-audio.mjs marketing-out/zeneva-pos-desktop-light.mp4 \
 *     --music assets/beds/upbeat.mp3
 *
 * Swap the music on a take from last week, try three beds against the same cut,
 * or add a bed to a video that was recorded silent — without re-shooting it. The
 * video stream is copied, never re-encoded, so this is near-instant and the
 * picture is bit-for-bit what you already approved.
 *
 * If the recorder wrote a `<video>.marks.json` sidecar next to the file, the
 * click and keystroke ticks land on exactly the frames they did in the original
 * take. Without the sidecar you still get the music bed; the ticks are simply
 * skipped, because guessing where the clicks were would put them on the wrong
 * frames and a tick half a beat off is worse than no tick.
 *
 * The sidecar also carries the spoken script — every caption and the instant it
 * appeared — so `--narrate` works here too. That is what makes a voice a thing
 * you can change your mind about: record once, then try Charon against Kore
 * against a different reading direction, at ffmpeg speed, on footage that is
 * already approved. Only lines you have never heard before cost a request.
 *
 * Writes alongside the input as `<name>-scored.mp4` unless you pass --out.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { mixAudio, resolveMusic, synthBed } from './audio.mjs';
import { hasFfmpeg, probe } from './capture.mjs';
import { synthNarration, DEFAULT_VOICE, VOICES, ENGINES, pickEngine, voicesFor, defaultVoiceFor } from './narrate.mjs';
import { STORE } from './store.mjs';

const HELP = `
Add music and interaction sound to an existing recording.

  node scripts/record/add-audio.mjs <video> [options]

  --music <path>        music bed: a file, or a folder to pick from
  --music-volume 0-1    bed level                      (default: 0.28)
  --out <path>          destination      (default: <video>-scored.<ext>)
  --no-click-sfx        skip click ticks
  --no-typing-sfx       skip keystroke ticks
  --marks <path>        marks sidecar   (default: <video>.marks.json)

  --narrate             speak the captions (needs GEMINI_API_KEY)
  --voice <name>        Charon | Kore | Puck | Aoede | Fenrir | Leda
                        (default: Charon.) Implies --narrate.
  --voice-style "..."   how to read it: "slower, and a little drier".
                        Implies --narrate.

Click/keystroke ticks need the marks sidecar the recorder writes next to each
video. Without it you still get the music bed.

Narration needs the sidecar too — it holds the script and the frame each line
belongs to, and neither survives in the video itself. With music, the bed ducks
under the voice on its own. Lines are cached by what they sound like, so a voice
you have used on this footage before re-scores for nothing.
`;

function parseArgs(argv) {
  const out = {
    video: null, music: null, musicVolume: 0.28,
    outPath: null, marks: null, clickSfx: true, typingSfx: true,
    narrate: false, voice: null, voiceEngine: null, voiceStyle: null, voiceRate: null,
    store: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--music': out.music = next(); break;
      case '--music-volume': out.musicVolume = Number(next()); break;
      case '--out': out.outPath = path.resolve(next()); break;
      case '--marks': out.marks = path.resolve(next()); break;
      case '--no-click-sfx': out.clickSfx = false; break;
      case '--no-typing-sfx': out.typingSfx = false; break;
      // Naming a voice or a reading is asking for narration; making you pass
      // --narrate as well would only be a way to get it silently wrong.
      case '--narrate': out.narrate = true; break;
      case '--voice': out.voice = next(); out.narrate = true; break;
      case '--voice-style': out.voiceStyle = next(); out.narrate = true; break;
      case '--voice-engine': {
        const v = String(next() ?? '');
        if (!ENGINES.includes(v)) {
          throw new Error(`--voice-engine must be one of ${ENGINES.join(', ')}, got ${JSON.stringify(v)}`);
        }
        out.voiceEngine = v;
        out.narrate = true;
        break;
      }
      case '--voice-rate': out.voiceRate = Number(next()); out.narrate = true; break;
      case '--store': out.store = true; break;
      case '-h': case '--help': out.help = true; break;
      default:
        if (a.startsWith('--')) throw new Error(`unknown flag ${a}`);
        else if (!out.video) out.video = path.resolve(a);
    }
  }
  return out;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || !o.video) {
    console.log(HELP);
    return o.video ? 0 : 1;
  }
  if (!existsSync(o.video)) throw new Error(`no such file: ${o.video}`);
  if (!(await hasFfmpeg())) throw new Error('ffmpeg is not on PATH');
  // Resolved before anything is read or synthesised, and validated against the
  // engine that will actually speak — for the same reason the recorder checks it
  // before launching Chrome: a mistyped voice would otherwise fail once per line,
  // and six identical errors is a worse answer than "no such voice".
  if (o.narrate) {
    o.voiceEngine ??= pickEngine();
    o.voice ??= defaultVoiceFor(o.voiceEngine);
    const catalog = voicesFor(o.voiceEngine);
    if (!catalog.some((v) => v.id === o.voice)) {
      throw new Error(`unknown ${o.voiceEngine} voice "${o.voice}" — `
        + `try: ${catalog.map((v) => v.id).join(', ')}`);
    }
  }

  const ext = path.extname(o.video);
  const outPath = o.outPath
    ?? path.join(path.dirname(o.video), `${path.basename(o.video, ext)}-scored${ext}`);
  if (path.resolve(outPath) === path.resolve(o.video)) {
    // ffmpeg reads the input while writing the output; the same path truncates
    // the source out from under it and you lose the take.
    throw new Error('--out must differ from the input video');
  }

  const info = await probe(o.video);
  const duration = info.seconds;

  const marksPath = o.marks ?? `${o.video}.marks.json`;
  let marks = { clicks: [], keys: [], narration: [] };
  const hasMarks = existsSync(marksPath);
  if (hasMarks) {
    marks = JSON.parse(readFileSync(marksPath, 'utf8'));
  } else if (o.clickSfx || o.typingSfx || o.narrate) {
    console.log(`   no marks sidecar at ${path.basename(marksPath)}`
      + ` — music only, no ticks${o.narrate ? ' and no voice' : ''}`);
  }

  // Derive the flow name from the recorder's own filename (zeneva-pos-desktop-light)
  // so a --music folder can still pick the matching bed.
  const flowId = path.basename(o.video, ext).replace(/^zeneva-/, '').split('-')[0];

  // Same default as the recorder: a supplied track, else the ambient pad. This
  // script's whole point is a video that was silent, so a re-score without any
  // audio choice should not come out silent again.
  const bedFile = o.music
    ? resolveMusic(o.music, flowId)
    : await synthBed(path.join(path.dirname(outPath), '.frames'));

  /**
   * The voice, re-synthesised from the script the take recorded.
   *
   * A sidecar written before narration existed has no `narration` array, and
   * there is nothing to fall back on: the caption timings live in the frame
   * sequence, which was deleted when the take was encoded. So this says what is
   * missing instead of narrating to guessed timings — a voice that lands a second
   * off its caption is worse than a video with no voice, and much harder to
   * diagnose than a sentence saying the take predates the feature.
   *
   * `dir` is the output's folder so the spoken-line cache sits next to the
   * recorder's own, which is what makes the second voice on the same footage — or
   * the same voice on the next re-score — cost nothing.
   */
  let narration = null;
  if (o.narrate) {
    const lines = Array.isArray(marks.narration) ? marks.narration : [];
    if (!lines.length && hasMarks) {
      console.log(`   ${path.basename(marksPath)} carries no script`
        + ' — re-record the take with --narrate to get one');
    } else if (lines.length) {
      narration = await synthNarration({
        lines,
        dir: path.dirname(outPath),
        // Named after the output, not the clock: re-scoring the same file
        // overwrites its own mixdown instead of leaving a folder per attempt,
        // and two voices written to two --out paths stay out of each other's way.
        stamp: path.basename(outPath, ext),
        engine: o.voiceEngine,
        voice: o.voice,
        style: o.voiceStyle,
        rate: o.voiceRate,
        duration,
        log: (m) => console.log(`   ${m}`),
      });
    }
  }

  const res = await mixAudio({
    videoPath: o.video,
    outPath,
    duration,
    music: bedFile,
    musicVolume: o.musicVolume,
    clicks: o.clickSfx ? (marks.clicks ?? []) : [],
    keys: o.typingSfx ? (marks.keys ?? []) : [],
    narration: narration?.file ?? null,
    audioBitrate: o.store ? STORE.audioBitrate : null,
  });

  if (!res.scored) {
    console.log('\n   Nothing to add — pass --music, or keep the ticks enabled.\n');
    return 1;
  }
  console.log(`\n   ✓ ${outPath}`);
  console.log(`     ${duration.toFixed(1)}s · ${res.clicks} clicks · ${res.keys} keystrokes`
    + (res.music ? ` · bed: ${res.music}` : ' · no bed')
    + (res.narrated ? ` · voice: ${o.voice}` : ''));
  console.log('');
  return 0;
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    console.error(`\n   ${e.message}\n`);
    process.exit(1);
  });
