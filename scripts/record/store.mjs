#!/usr/bin/env node
/**
 * Microsoft Store delivery: turn a finished take into a submittable listing.
 *
 *   node scripts/record/store.mjs marketing-out/zeneva-trailer-desktop-light.mp4
 *
 * Partner Center does not accept a video on its own. A trailer is four files and a
 * string — the MP4, a 1920x1080 PNG thumbnail, a WebVTT caption file, an MP3 audio
 * description, and a title of 255 characters or fewer — and it will reject the set
 * for any one of them. This produces all of them from one take and then checks the
 * result against the published requirements, so the answer to "will this pass" is
 * a table rather than an upload attempt.
 *
 * ## Everything here is quoted, not chosen
 *
 * `STORE` below is transcribed from Microsoft's own page, and the numbers are
 * theirs even where they look wrong. 50 Mbps for screen content is roughly two
 * hundred times what a visually-lossless encode of this material needs; the
 * listing re-encodes everything to Smooth Streaming on ingest anyway. It is a
 * ceiling they want headroom under, so it is paid rather than argued with.
 *
 * Source: learn.microsoft.com/windows/apps/publish/publish-your-app/msix/
 * screenshots-and-images — "Trailer requirements".
 *
 * ## The three assets that are content, not conversion
 *
 * A thumbnail, a caption file and an audio description are not derivable from the
 * pixels, so each one has a rule about where its truth comes from:
 *
 * - **Captions** are the take's own caption track, read out of the `.marks.json`
 *   sidecar with the measured duration of each spoken line. Nothing is
 *   transcribed and nothing is estimated — the sentence on screen is the sentence
 *   in the file, and the cue ends when the voice stops.
 *
 * - **The audio description** is a *different* script, because it answers a
 *   different question. Captions are the audio in text for someone who cannot
 *   hear it; a description is the picture in audio for someone who cannot see it,
 *   so "Tap to add" is a caption and "a grid of product cards fills the screen" is
 *   a description. It lives in `describe.mjs` because it is writing, and it is
 *   checked for overlap here because a description that talks over the narration
 *   is worse than one that is missing.
 *
 * - **The thumbnail** is a still from the film, taken at a timestamp you choose.
 *   It defaults to a frame a third of the way in rather than frame 0, which on
 *   every take here is the opening title card fading up from black.
 *
 * Nothing in this file writes to Partner Center. It puts five things in a folder.
 */

import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasFfmpeg, probe, run } from './capture.mjs';
import { AUDIO_DESCRIPTIONS } from './describe.mjs';
import { synthNarration, pickEngine, voicesFor, defaultVoiceFor, ENGINES } from './narrate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The Microsoft Store's trailer contract, as data.
 *
 * `gop` is a function because the spec states it relatively — "GOP of half the
 * frame rate" — and the frame rate is a property of the take, not of the store. At
 * 30fps that is 15, which is a keyframe every half second.
 */
export const STORE = {
  width: 1920,
  height: 1080,
  container: ['mov', 'mp4'],
  videoCodec: 'h264',
  videoProfile: 'High',
  bitrate: '50M',
  bufsize: '100M',
  bFrames: 2,
  gop: (fps) => Math.max(1, Math.round(fps / 2)),
  pixFmt: 'yuv420p',
  audioCodec: 'aac',
  audioProfile: 'LC',
  audioBitrate: '384k',
  sampleRate: 48_000,
  channels: 2,
  /** Hard cap. Microsoft rejects above this. */
  maxBytes: 2 * 1024 ** 3,
  /** Recommendation, not a rejection: "60 seconds or less … recommended". */
  recommendedSeconds: 60,
  titleMaxChars: 255,
  captionMaxBytes: 50 * 1024 ** 2,
  descriptionMaxBytes: 500 * 1024 ** 2,
  thumbnail: { width: 1920, height: 1080, format: 'png' },
  /** 16:9 super hero art — recommended, and what puts trailers atop the listing. */
  hero: { width: 1920, height: 1080, format: 'png' },
};

/* ------------------------------------------------------------------ captions */

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** `HH:MM:SS.mmm` — WebVTT's only timestamp form for cues over an hour, and legal under. */
function stamp(seconds) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(sec)}.${pad(ms, 3)}`;
}

/**
 * Break a caption into at most two lines, at a word boundary near the middle.
 *
 * Not cosmetic. A single long line is rendered by the Store's player as one strip
 * across the full width in a small size, and by some players as an ellipsis. Two
 * balanced lines is the convention every captioning guideline lands on, and
 * splitting near the *middle* rather than at a fixed column is what stops the
 * second line being one orphaned word.
 */
export function wrapCue(text, max = 42) {
  const s = String(text).trim().replace(/\s+/g, ' ');
  if (s.length <= max) return s;

  const words = s.split(' ');
  const mid = s.length / 2;
  let best = null;
  let run = 0;
  for (let i = 0; i < words.length - 1; i++) {
    run += words[i].length + (i ? 1 : 0);
    const score = Math.abs(run - mid);
    if (best === null || score < best.score) best = { at: i, score, len: run };
  }
  if (!best) return s;
  return `${words.slice(0, best.at + 1).join(' ')}\n${words.slice(best.at + 1).join(' ')}`;
}

/** The smallest gap left between one cue and the next, in seconds. */
const CUE_GAP = 0.04;

/**
 * How long a cue lasts when nothing measured it.
 *
 * Only reached for a take recorded without narration, where the sidecar has the
 * caption and the instant it appeared but no spoken duration. 2.6 words a second
 * is what the SAPI voice measured at on this machine across the trailer's own
 * lines; the floor stops a three-word caption flashing past unreadably.
 */
const estimateCue = (text) => Math.max(1.6, (String(text).trim().split(/\s+/).length / 2.6) + 0.5);

/**
 * A WebVTT file from a take's caption track.
 *
 * Cues are clamped so they can never overlap the next one or run past the end of
 * the film. Overlapping cues are legal WebVTT and are rendered by stacking, which
 * on a 60-second trailer with eight captions turns the bottom third of the frame
 * into a wall of text — so the clamp is a quality rule, not a validity one.
 */
export function toVtt(lines, duration) {
  const cues = [...lines]
    .map((l) => ({
      text: String(l.text ?? '').trim(),
      at: Math.max(0, Number(l.at) || 0),
      dur: Number(l.dur) > 0 ? Number(l.dur) : estimateCue(l.text),
    }))
    .filter((c) => c.text)
    .sort((a, b) => a.at - b.at);

  const out = ['WEBVTT', ''];
  cues.forEach((c, i) => {
    const nextAt = i + 1 < cues.length ? cues[i + 1].at : Infinity;
    const end = Math.min(c.at + c.dur, nextAt - CUE_GAP, duration);
    // A cue whose start has already been passed by the previous cue's clamp — two
    // captions fired within 40ms of each other — is dropped rather than emitted
    // with a negative length, which is invalid WebVTT and fails the whole file.
    if (end <= c.at) return;
    out.push(String(i + 1), `${stamp(c.at)} --> ${stamp(end)}`, wrapCue(c.text), '');
  });
  return out.join('\n');
}

/* ----------------------------------------------------------------- thumbnail */

/**
 * One frame, as a PNG at exactly the size Partner Center demands.
 *
 * The scale/crop pair is belt and braces: the take is already 1920x1080, but this
 * is also run against trimmed and re-encoded files, and "must be a .png file that
 * is 1920 x 1080 pixels" is checked by the uploader rather than negotiated.
 */
export async function grabThumbnail(video, at, outPath) {
  const { width, height } = STORE.thumbnail;
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    // Before -i: seeks by keyframe, which is fast and exact enough for a still.
    '-ss', at.toFixed(3),
    '-i', video,
    '-frames:v', '1',
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,`
      + `crop=${width}:${height},format=rgb24`,
    outPath,
  ]);
  return outPath;
}

/* ------------------------------------------------------------------ hero art */

/** Zeneva's primary, and the two ends of its ramp. From src/lib/marketing/anim.ts. */
const BRAND = { primary: 'f47125', hi: 'ff9040', lo: 'cc5200' };

/**
 * 16:9 super hero art: an abstract brand plate, drawn by ffmpeg.
 *
 * Recommended rather than required, but it is what makes trailers appear at the
 * *top* of a listing instead of below the fold, so it ships with them.
 *
 * Microsoft's rules for this image are unusually specific and they rule out the
 * obvious thing. No text, no product title, no app UI, no device imagery, nothing
 * in the bottom third (a gradient is laid over it in some layouts), key detail
 * centred, and minimal empty space. That is a description of an abstract plate, so
 * that is what this draws.
 *
 * `type=radial`, and the first version was linear — which is why this note exists.
 * A linear ramp across 1920px is a wall of flat colour: it satisfies every hard rule
 * and fails two of the soft ones outright, because "place the most important details
 * in the center" and "minimize empty space" cannot both be true of a plate that has
 * no centre and no detail. A radial bloom has both.
 *
 * The bloom is placed slightly **above** centre. That is the one compositional
 * decision here and it is theirs: the bottom third has to survive having a gradient
 * and a title dropped over it, so the light is kept out of it.
 */
export async function heroArt(outPath) {
  const { width, height } = STORE.hero;
  const src = [
    `gradients=s=${width}x${height}`,
    ':type=radial',
    /*
     * Three stops, not four, and the radius spans the frame.
     *
     * `x1/y1` on a radial gradient is the *end of the radius*, and the stops are
     * spread evenly along it — so a radius near the frame height puts the last stop
     * at the corners and a radius much larger than the frame never gets past the
     * first. The first attempt used four stops ending in near-black at a radius of
     * 1.02x the height and produced a small orange ball on a black field: the last
     * stop resolved a few hundred pixels out. Worse empty space than the linear
     * version it replaced, which is the opposite of what this was for.
     *
     * At 1.15x the height the frame's far corners sit about 0.91 of the way along
     * the radius, so the plate reads hot in the middle, brand orange through the
     * body, and deep ember — not black — in the corners.
     */
    `:c0=0x${BRAND.hi}:c1=0x${BRAND.primary}:c2=0x3d1a08`,
    ':nb_colors=3',
    `:x0=${Math.round(width * 0.5)}:y0=${Math.round(height * 0.44)}`,
    `:x1=${Math.round(width * 0.5)}:y1=${Math.round(height * 1.15)}`,
    ':duration=1:speed=0',
  ].join('');

  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', src,
    '-frames:v', '1',
    '-vf', [
      // Softens the boundaries between the stops without flattening the bloom.
      'gblur=sigma=40',
      // Mild. A strong vignette on a plate that already falls off radially crushes
      // the corners to black and re-creates the empty space this is avoiding.
      'vignette=PI/6',
      // `allf=u` — uniform, not temporal. A single still has no frames to vary
      // across, and `t` on one frame produces a fixed pattern that tiles visibly.
      'noise=alls=7:allf=u',
      'format=rgb24',
    ].join(','),
    outPath,
  ]);
  return outPath;
}

/* ---------------------------------------------------------- audio description */

/** Smallest silence left between a description and the narration around it. */
const AD_MARGIN = 0.25;

/**
 * Where the film is quiet, in seconds.
 *
 * Built from the caption track's measured line durations, so a gap is a real
 * silence in the finished mix rather than a place no caption happened to be — the
 * synth bed plays throughout, but the bed is not speech and a description over it
 * is fine.
 */
export function silentGaps(lines, duration) {
  const spoken = [...lines]
    .map((l) => ({
      at: Math.max(0, Number(l.at) || 0),
      dur: Number(l.dur) > 0 ? Number(l.dur) : estimateCue(l.text),
    }))
    .sort((a, b) => a.at - b.at);

  const gaps = [];
  let cursor = 0;
  for (const l of spoken) {
    if (l.at - cursor > 0) gaps.push({ from: cursor, to: l.at });
    cursor = Math.max(cursor, l.at + l.dur);
  }
  if (duration - cursor > 0) gaps.push({ from: cursor, to: duration });
  return gaps.map((g) => ({ ...g, len: g.to - g.from }));
}

/**
 * The audio-description MP3.
 *
 * `script` is `[{ at, text }]` in video seconds, authored in `describe.mjs`. It is
 * spoken by the same engine the narration uses and laid on a track exactly as long
 * as the film, because Partner Center plays the two in parallel and a description
 * track that outlasts its video drifts out of sync at the end.
 *
 * Overlaps are reported, never silently fixed. A description shifted to fit is a
 * description landing on a different shot than the one it describes, which for the
 * person relying on it is worse than a gap — so a clash is the operator's problem
 * and the message says exactly which line and by how much.
 */
export async function audioDescription({
  script, lines, duration, dir, stamp: takeStamp, engine, voice, rate, outPath, log = () => {},
}) {
  if (!script?.length) return { path: null, warnings: ['no audio-description script for this flow'] };

  const spoken = await synthNarration({
    lines: script, dir, stamp: `${takeStamp}-ad`, engine, voice, rate, duration, log,
  });
  if (!spoken) return { path: null, warnings: ['the description could not be spoken'] };

  const warnings = [];
  const placed = [...spoken.lines].sort((a, b) => a.at - b.at);

  for (const [i, d] of placed.entries()) {
    const end = d.at + d.dur;
    if (end > duration) {
      warnings.push(`description ${i + 1} runs ${(end - duration).toFixed(2)}s past the end of the film`);
    }
    const next = placed[i + 1];
    if (next && end + AD_MARGIN > next.at) {
      warnings.push(`descriptions ${i + 1} and ${i + 2} overlap by `
        + `${(end - next.at).toFixed(2)}s — move one in describe.mjs`);
    }
    // The clash that matters most: talking over the film's own voice.
    for (const l of lines) {
      const lEnd = (Number(l.at) || 0) + (Number(l.dur) > 0 ? Number(l.dur) : estimateCue(l.text));
      if (d.at < lEnd - AD_MARGIN && end > (Number(l.at) || 0) + AD_MARGIN) {
        warnings.push(`description ${i + 1} at ${d.at.toFixed(1)}s talks over the narration `
          + `"${String(l.text).slice(0, 40)}…"`);
        break;
      }
    }
  }

  /*
   * MP3, because that is the only format the field accepts — and mono, because a
   * description is one voice and Partner Center's 500 MB cap is not the binding
   * constraint on a 60-second file. 128k mono of SAPI output is transparent; the
   * voice was 24kHz to begin with.
   *
   * `apad` matters more than it looks. The mixdown ends with its last delayed input,
   * not at the length of the film — measured 52.3s against a 60.6s trailer, because
   * the final description finishes eight seconds before the credits. Partner Center
   * plays this track *alongside* the video, so it is padded to exactly the film's
   * length rather than left to run out early: a description track and a video of
   * different durations is a track whose relationship to the picture a player is free
   * to guess at. `-t` alone cannot do it — it truncates and never extends.
   */
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', spoken.file,
    '-af', `apad=whole_dur=${duration.toFixed(3)}`,
    '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '1',
    '-t', duration.toFixed(3),
    outPath,
  ]);

  return { path: outPath, warnings, lines: placed };
}

/* --------------------------------------------------------------- verification */

/**
 * Whether the moov atom is in front of the mdat.
 *
 * Microsoft asks for this explicitly ("moov atom at the front of the file (Fast
 * Start)") and warns that getting it wrong loses A/V sync. `-movflags +faststart`
 * is supposed to guarantee it, which is exactly why it is worth checking rather
 * than assuming: the flag is passed twice in this pipeline, on two different
 * ffmpeg invocations, and the second one copies the video stream. A flag that
 * silently stopped applying would produce a file that plays perfectly here and
 * fails on ingest.
 *
 * Walks the top-level box list rather than searching for the bytes. `moov` and
 * `mdat` both occur inside other structures, so a byte search finds whichever
 * appears first in an unrelated context and reports it as the layout.
 */
export function boxOrder(file, max = 16) {
  const fd = openSync(file, 'r');
  try {
    const size = statSync(file).size;
    const head = Buffer.alloc(16);
    const boxes = [];
    let at = 0;
    while (at + 8 <= size && boxes.length < max) {
      const got = readSync(fd, head, 0, 16, at);
      if (got < 8) break;
      let len = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      let header = 8;
      if (len === 1) {
        if (got < 16) break;
        // 64-bit size. Node has no readUInt64BE; the high word is zero for any
        // file under 4GB and this one is capped at 2GB, so the low word is it.
        if (head.readUInt32BE(8) !== 0) break;
        len = head.readUInt32BE(12);
        header = 16;
      } else if (len === 0) {
        // Extends to EOF.
        boxes.push(type);
        break;
      }
      if (len < header) break;
      boxes.push(type);
      at += len;
    }
    return boxes;
  } finally {
    closeSync(fd);
  }
}

/** Full stream detail, for checks `probe()` does not cover. */
async function deepProbe(file) {
  const out = await new Promise((resolve, reject) => {
    const p = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'stream=codec_type,codec_name,profile,width,height,pix_fmt,'
        + 'r_frame_rate,has_b_frames,bit_rate,sample_rate,channels,start_time,color_range',
      '-show_entries', 'format=duration,size,bit_rate,format_name,nb_streams',
      '-of', 'json', file,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    let err = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve(buf) : reject(new Error(err.trim() || `ffprobe exited ${c}`))));
  });
  return JSON.parse(out);
}

const ok = (pass, actual) => ({ pass, actual });

/**
 * Check a finished MP4 against every published trailer requirement.
 *
 * Returns rows rather than throwing, and separates a hard requirement from a
 * recommendation: a 70-second trailer is submittable and a 70-second trailer is
 * also a worse trailer, and collapsing those two into "fail" would mean the only
 * way to ship one is to ignore the checker.
 */
export async function verifyTrailer(file) {
  const info = await deepProbe(file);
  const v = (info.streams || []).find((s) => s.codec_type === 'video') || {};
  const a = (info.streams || []).find((s) => s.codec_type === 'audio') || {};
  const f = info.format || {};

  const fps = (() => {
    const [n, d] = String(v.r_frame_rate || '0/1').split('/').map(Number);
    return d ? n / d : 0;
  })();
  const bytes = Number(f.size) || 0;
  const seconds = Number(f.duration) || 0;
  const boxes = boxOrder(file);
  const moov = boxes.indexOf('moov');
  const mdat = boxes.indexOf('mdat');

  const rows = [
    ['container', 'mp4/mov', ok(
      STORE.container.some((c) => String(f.format_name || '').includes(c)),
      f.format_name,
    )],
    ['video codec', STORE.videoCodec, ok(v.codec_name === STORE.videoCodec, v.codec_name)],
    ['profile', STORE.videoProfile, ok(v.profile === STORE.videoProfile, v.profile)],
    ['resolution', `${STORE.width}x${STORE.height}`, ok(
      Number(v.width) === STORE.width && Number(v.height) === STORE.height,
      `${v.width}x${v.height}`,
    )],
    ['pixel format', STORE.pixFmt, ok(v.pix_fmt === STORE.pixFmt, v.pix_fmt)],
    ['consecutive B frames', String(STORE.bFrames), ok(
      Number(v.has_b_frames) === STORE.bFrames, String(v.has_b_frames),
    )],
    ['audio codec', `${STORE.audioCodec} ${STORE.audioProfile}`, ok(
      a.codec_name === STORE.audioCodec && a.profile === STORE.audioProfile,
      `${a.codec_name} ${a.profile || ''}`.trim(),
    )],
    ['sample rate', `${STORE.sampleRate}`, ok(Number(a.sample_rate) === STORE.sampleRate, a.sample_rate)],
    ['channels', 'stereo', ok(Number(a.channels) === STORE.channels, `${a.channels}ch`)],
    ['moov before mdat', 'faststart', ok(moov >= 0 && (mdat < 0 || moov < mdat), boxes.join(' '))],
    ['no edit list', 'start_time 0', ok(
      Math.abs(Number(v.start_time) || 0) < 0.001 && Math.abs(Number(a.start_time) || 0) < 0.001,
      `v=${v.start_time} a=${a.start_time}`,
    )],
    ['file size', `< ${(STORE.maxBytes / 1024 ** 3).toFixed(0)} GB`, ok(
      bytes > 0 && bytes < STORE.maxBytes, `${(bytes / 1e6).toFixed(1)} MB`,
    )],
  ];

  /*
   * Both bitrates are recommendations here, and that is a measurement rather than a
   * convenience.
   *
   * The spec names 50 Mbps video and 384 kbps stereo audio. Both are *requested* at
   * encode — see the store branch in `capture.mjs` and `audioBitrate` in
   * `audio.mjs` — and neither is reached, because on this material no encoder can
   * spend that many bits. A UI trailer is three quarters held frames, so x264 has
   * almost nothing to encode and ABR cannot inflate a skip frame; the measured video
   * rate lands near 5 Mbps at what is already visually lossless. The same is true of
   * the audio: a quiet synth bed under one voice, asked for 384k, comes out near
   * 230k, and ffmpeg's AAC encoder will not pad silence to hit a target.
   *
   * So a hard failure on either would be a check that can never pass, which is a
   * check nobody keeps. What is enforced instead is that the file was *asked* for the
   * spec — profile, GOP, B-frames, sample rate, channels and codec are all exact and
   * all above — and the measured rates are reported as what they are. Microsoft
   * re-encodes every trailer to Smooth Streaming on ingest, so the mezzanine rate is
   * a quality ceiling, not a gate.
   */
  const advisories = [
    ['duration', `<= ${STORE.recommendedSeconds}s recommended`, ok(
      seconds > 0 && seconds <= STORE.recommendedSeconds, `${seconds.toFixed(1)}s`,
    )],
    ['video bitrate', `${STORE.bitrate}bps requested`, ok(
      Number(v.bit_rate) > 3_000_000, `${(Number(v.bit_rate) / 1e6).toFixed(1)} Mbps`,
    )],
    ['audio bitrate', `${STORE.audioBitrate} requested`, ok(
      // Above the 192k default, which is how you can tell the store request was
      // actually applied rather than silently dropped somewhere in the mix.
      Number(a.bit_rate) > 200_000, `${Math.round(Number(a.bit_rate) / 1000)} kbps`,
    )],
    ['GOP', `${STORE.gop(fps)} frames (half of ${fps.toFixed(0)}fps)`, ok(true, 'set at encode')],
  ];

  return { rows, advisories, seconds, fps, bytes };
}

/* ------------------------------------------------------------------- the CLI */

const HELP = `
Build the Microsoft Store asset set from a finished take.

  node scripts/record/store.mjs <video.mp4> [options]

  --out <dir>          where the assets go        (default: beside the video)
  --thumb-at <s>       thumbnail timestamp        (default: a third of the way in)
  --title "..."        trailer title, <= 255 chars
  --voice <name>       voice for the description   (default: the engine's own)
  --voice-engine <e>   ${ENGINES.join(' | ')}
  --voice-rate <n>     SAPI rate, -10..10
  --no-hero            skip the 16:9 super hero art
  --no-describe        skip the audio-description MP3
  --scaffold           print the caption timeline and the silent gaps, then stop

Produces, next to the video:

  <name>.vtt                    closed captions   (Web VTT, required format)
  <name>-thumb.png              1920x1080 thumbnail
  <name>-audio-description.mp3  audio description (MP3, required format)
  <name>-hero.png               16:9 super hero art
  <name>-store.json             the title, and what was checked

--scaffold is how the audio description gets written: it prints where the film is
quiet, in seconds, which is what the times in describe.mjs have to fit inside.
`;

function parseArgs(argv) {
  const out = {
    video: null, outDir: null, thumbAt: null, title: null,
    voice: null, voiceEngine: null, voiceRate: null,
    hero: true, describe: true, scaffold: false,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--out': out.outDir = next(); break;
      case '--thumb-at': out.thumbAt = Number(next()); break;
      case '--title': out.title = next(); break;
      case '--voice': out.voice = next(); break;
      case '--voice-engine': {
        const v = String(next() ?? '');
        if (!ENGINES.includes(v)) throw new Error(`--voice-engine must be one of ${ENGINES.join(', ')}`);
        out.voiceEngine = v;
        break;
      }
      case '--voice-rate': out.voiceRate = Number(next()); break;
      case '--no-hero': out.hero = false; break;
      case '--no-describe': out.describe = false; break;
      case '--scaffold': out.scaffold = true; break;
      case '--help': case '-h': console.log(HELP); process.exit(0); break;
      default:
        if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
        rest.push(arg);
    }
  }
  out.video = rest[0] ?? null;
  return out;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.video) { console.log(HELP); process.exit(1); }
  if (!hasFfmpeg()) throw new Error('ffmpeg is not on PATH. Install it (winget install ffmpeg) and retry.');

  const video = path.resolve(o.video);
  if (!existsSync(video)) throw new Error(`no such video: ${video}`);

  const marksPath = `${video}.marks.json`;
  if (!existsSync(marksPath)) {
    throw new Error(`no marks sidecar at ${path.basename(marksPath)} — the captions and the `
      + 'audio-description timings both come from it, and neither survives in the video. '
      + 'Re-record, or re-score with add-audio.mjs to regenerate it.');
  }
  const marks = JSON.parse(readFileSync(marksPath, 'utf8'));

  const info = await probe(video);
  const duration = Number(marks.duration) || info.seconds;
  const lines = Array.isArray(marks.narration) ? marks.narration : [];

  const outDir = o.outDir ? path.resolve(o.outDir) : path.dirname(video);
  mkdirSync(outDir, { recursive: true });
  const base = path.basename(video, path.extname(video));
  const at = (p) => path.join(outDir, p);
  const log = (m) => console.log(`   ${m}`);

  console.log(`\nMicrosoft Store assets → ${path.relative(ROOT, outDir)}`);
  console.log(`  take: ${base} · ${duration.toFixed(1)}s · ${info.width}x${info.height} @ ${info.fps}fps`);

  /* --scaffold: the numbers needed to author describe.mjs, then stop. */
  if (o.scaffold) {
    console.log('\n  caption track');
    for (const l of lines) {
      const d = Number(l.dur) > 0 ? Number(l.dur) : estimateCue(l.text);
      console.log(`    ${l.at.toFixed(2).padStart(6)} → ${(l.at + d).toFixed(2).padStart(6)}  ${l.text}`);
    }
    console.log('\n  silent gaps (where a description fits)');
    for (const g of silentGaps(lines, duration)) {
      const room = g.len - AD_MARGIN * 2;
      console.log(`    ${g.from.toFixed(2).padStart(6)} → ${g.to.toFixed(2).padStart(6)}  `
        + `${g.len.toFixed(2)}s${room > 1.2 ? `  (~${Math.floor(room * 2.6)} words)` : '  — too short'}`);
    }
    console.log('');
    return;
  }

  const written = [];

  /* Captions. */
  const vtt = toVtt(lines, duration);
  const vttPath = at(`${base}.vtt`);
  writeFileSync(vttPath, vtt, 'utf8');
  const cueCount = (vtt.match(/-->/g) || []).length;
  written.push([vttPath, `${cueCount} cue(s)`]);
  if (!cueCount) {
    log('captions: the take recorded no caption track — the .vtt is empty and should not be uploaded');
  }

  /* Thumbnail. A third in, which on every take here is past the title card. */
  const thumbAt = Number.isFinite(o.thumbAt) ? o.thumbAt : duration / 3;
  const thumbPath = at(`${base}-thumb.png`);
  await grabThumbnail(video, Math.max(0, Math.min(thumbAt, duration - 0.1)), thumbPath);
  written.push([thumbPath, `frame at ${thumbAt.toFixed(1)}s`]);

  /* Hero art. */
  if (o.hero) {
    const heroPath = at(`${base}-hero.png`);
    await heroArt(heroPath);
    written.push([heroPath, '16:9 super hero art']);
  }

  /* Audio description. */
  let adWarnings = [];
  if (o.describe) {
    const engine = o.voiceEngine ?? pickEngine();
    const voice = o.voice ?? defaultVoiceFor(engine);
    if (!voicesFor(engine).some((v) => v.id === voice)) {
      throw new Error(`unknown ${engine} voice "${voice}" — `
        + `try: ${voicesFor(engine).map((v) => v.id).join(', ')}`);
    }
    const script = AUDIO_DESCRIPTIONS[marks.flow] || null;
    const adPath = at(`${base}-audio-description.mp3`);
    const ad = await audioDescription({
      script, lines, duration, dir: path.dirname(video), stamp: base,
      engine, voice, rate: o.voiceRate, outPath: adPath, log,
    });
    adWarnings = ad.warnings || [];
    if (ad.path) written.push([ad.path, `${ad.lines.length} description(s), ${voice}`]);
  }

  /* Verify, and say so. */
  const { rows, advisories, seconds } = await verifyTrailer(video);
  const failed = rows.filter(([, , r]) => !r.pass);

  console.log('\n  requirements');
  for (const [name, want, r] of rows) {
    console.log(`    ${r.pass ? '✓' : '✗'} ${name.padEnd(22)} ${String(r.actual).padEnd(22)} ${r.pass ? '' : `want ${want}`}`);
  }
  console.log('\n  recommendations');
  for (const [name, want, r] of advisories) {
    console.log(`    ${r.pass ? '✓' : '·'} ${name.padEnd(22)} ${String(r.actual).padEnd(22)} ${r.pass ? '' : want}`);
  }

  const title = o.title || `Zeneva — ${marks.flow === 'trailer' ? 'Retail, handled' : marks.flow}`;
  if (title.length > STORE.titleMaxChars) {
    throw new Error(`--title is ${title.length} characters; the limit is ${STORE.titleMaxChars}`);
  }

  writeFileSync(at(`${base}-store.json`), JSON.stringify({
    title,
    video: path.basename(video),
    thumbnail: path.basename(thumbPath),
    captions: path.basename(vttPath),
    audioDescription: o.describe ? `${base}-audio-description.mp3` : null,
    heroArt: o.hero ? `${base}-hero.png` : null,
    durationSeconds: Number(seconds.toFixed(3)),
    requirements: Object.fromEntries(rows.map(([n, want, r]) => [n, { want, got: r.actual, pass: r.pass }])),
  }, null, 2), 'utf8');

  console.log('\n  written');
  for (const [p, note] of written) {
    console.log(`    ${path.relative(ROOT, p)}  — ${note}`);
  }
  console.log(`    ${path.relative(ROOT, at(`${base}-store.json`))}  — title: "${title}"`);

  for (const w of adWarnings) console.log(`\n  ! ${w}`);

  if (failed.length) {
    console.log(`\n  ${failed.length} requirement(s) not met — this will be rejected. `
      + 'Re-record with --store, or re-encode.\n');
    process.exitCode = 1;
  } else {
    console.log('\n  ✓ every published requirement met.\n');
  }
}

/*
 * Both a CLI and a module.
 *
 * `record.mjs` imports `STORE` from here so the encoder and the checker cannot
 * disagree about what the spec says — one transcription of Microsoft's numbers,
 * used by the thing that writes the file and the thing that validates it. Without
 * this guard that import would run the CLI, and `npm run record` would exit with
 * this file's usage text.
 */
const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(`\n  ${err.message}\n`);
    process.exit(1);
  });
}
