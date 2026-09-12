/**
 * Sound design pass: music bed + interaction ticks, mixed onto a silent take.
 *
 * Runs as a second ffmpeg invocation *after* the video is encoded, and only ever
 * copies the video stream (`-c:v copy`). That matters twice over: scoring a
 * 40-second 1080p take costs a second or two instead of a full re-encode, and
 * `add-audio.mjs` can re-score a video you recorded last week without touching a
 * single pixel of it.
 *
 * Ticks are synthesised here rather than shipped as .wav assets — `aevalsrc` can
 * describe a click as an equation, so the recorder stays a folder of text files
 * with no binaries to license, review or lose.
 *
 * Click times come from `Recorder.videoTimeFor()`, i.e. the encoded file's own
 * timeline rather than wall-clock, because held frames make those two disagree.
 */

import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { run } from './capture.mjs';

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus']);

/**
 * Two decaying partials — a noise transient and a sine body — is the whole
 * recipe for a UI click.
 *
 * The noise is what makes it read as a *click* rather than a *beep*. A pure sine
 * burst, which is what this used to be, is a pitched tone however short you make
 * it, and a pitched tone at 1180Hz over an otherwise silent video sounds like an
 * alarm. Real interface clicks are broadband transients: mostly noise, shaped by
 * a lowpass into a soft tock, with just enough sine under it to give the tock a
 * body you can feel.
 *
 * `exp(-t*decay)` rather than a linear fade because a linear tail sounds like a
 * tone being switched off, and a click is a transient, not a note.
 */
const TICKS = {
  click: { hz: 620, decay: 78, dur: 0.075, gain: 0.34, noise: 0.62, cut: 4200 },
  // Keystrokes fire dozens of times a take, so they sit quieter, shorter and
  // brighter — at click level and click length a typed sentence turns into a
  // machine-gun, and at click pitch it turns into a melody.
  key: { hz: 1400, decay: 190, dur: 0.028, gain: 0.11, noise: 0.78, cut: 7000 },
};

function tickExpr(t) {
  const { hz, decay, gain, noise } = t;
  const body = `${(1 - noise).toFixed(2)}*sin(2*PI*${hz}*t)`;
  // random(0) reseeds per evaluation, which is what makes each tick's noise
  // slightly different — identical transients repeated 40 times read as a loop.
  const air = `${noise.toFixed(2)}*(random(0)*2-1)`;
  return `${gain}*exp(-t*${decay})*(${body}+${air})`;
}

/**
 * A quiet ambient bed, synthesised, for takes with no music file.
 *
 * The alternative was silence, and silence is what made the first scored takes
 * sound broken: a marketing video whose entire soundtrack is forty disembodied
 * clicks reads as a bug, not as restraint. A bed at -15dB fixes that without
 * pretending to be a soundtrack — and the moment you pass `--music`, a real
 * track replaces this entirely.
 *
 * Synthesised rather than shipped as a .wav for the same reason the ticks are:
 * no binary in the repo to license, review, or explain to a store reviewer. Four
 * chords, sine partials with a little detune, crossfading on a 16-second loop —
 * Am, F, C, G, which is the least attention-seeking progression in existence and
 * is exactly what is wanted underneath someone talking about stock counts.
 */
const BED_CHORDS = [
  [220.00, 261.63, 329.63], // Am
  [174.61, 220.00, 261.63], // F
  [261.63, 329.63, 392.00], // C
  [196.00, 246.94, 293.66], // G
];
const BED_CHORD_SECONDS = 4;
const BED_LOOP_SECONDS = BED_CHORDS.length * BED_CHORD_SECONDS;
const BED_FADE = 1.4;
/** Root louder than the upper notes, so the chord has a bottom rather than a middle. */
const BED_VOICE_AMP = (n) => (n === 0 ? 0.5 : 0.34);
/** Level of the three-cents-sharp twin, relative to its voice. */
const BED_DETUNE_AMP = 0.6;
/**
 * Peak the bed is scaled to, linear — -6 dBFS.
 *
 * Deliberately mastered like a track someone would hand us, rather than left at
 * whatever the oscillators happen to sum to. Twelve sines drift in and out of
 * phase, and the unscaled sum peaks at about 0.94 — which measured as
 * `max_volume: 0.0 dB`, i.e. clipping. Scaling to a known headroom here means
 * `musicVolume` is the only level decision left, and it means the same number
 * works whether the bed is this synth or an mp3.
 */
const BED_PEAK = 0.5;
/** Bump when the synth changes, so a stale cached bed is not reused. */
const BED_VERSION = 2;

/**
 * Render the bed to a wav under `dir`, once, and return its path.
 *
 * Cached because `aevalsrc` evaluates its expression per sample per source —
 * twelve detuned oscillators across four chords costs about eleven seconds of
 * CPU for sixteen seconds of audio, and paying that on every take of a batch of
 * six would be nearly a minute spent re-deriving a byte-identical file. The
 * output depends on nothing but the constants above, so the version in the name
 * is the whole cache key.
 *
 * A file rather than more filter graph, because it then travels down exactly the
 * same path as a user-supplied track — looped by `aloop`, trimmed, faded and
 * levelled by code that is already proven. A second code path for "music we made
 * ourselves" is a second place for the `apad`/`atrim` hang to come back.
 */
export async function synthBed(dir) {
  const outPath = path.join(dir, `.bed-v${BED_VERSION}.wav`);
  // A truncated file from an interrupted run would loop as a click track, so
  // require it to be about the size a full render produces.
  if (existsSync(outPath) && statSync(outPath).size > BED_LOOP_SECONDS * 48000 * 3) {
    return outPath;
  }
  mkdirSync(dir, { recursive: true });

  const chords = BED_CHORDS.map((notes, i) => {
    const start = i * BED_CHORD_SECONDS;
    /*
     * The envelope has to *wrap*, not just fade.
     *
     * This file gets looped end to end by `aloop`. A trapezoid that opens at
     * t=0 and closes at t=16 leaves the first chord rising from silence and the
     * last cut off at full level, so every sixteen seconds the bed dips and then
     * clicks. Evaluating the same shape one loop either side and taking the
     * loudest means the first chord is already swelling in the last second and
     * the last chord is still decaying through the first — the seam lands in the
     * middle of a crossfade that was going to happen anyway.
     *
     * The ramps straddle each boundary by half a fade rather than sitting
     * outside it, and that half matters. With the ramps outside, every chord was
     * at full level for its whole four seconds *and* ramping through its
     * neighbours' — so at each junction two chords played at 1.0 together. That
     * measured as a seam 2dB louder than mid-chord and as clipping. Crossing at
     * the boundary puts both at 0.5 there, summing to the same 1.0 as anywhere
     * else, which is what a crossfade is supposed to do.
     */
    const half = (BED_FADE / 2).toFixed(2);
    const seg = (u) => `min(1,min((${u}-${start.toFixed(2)}+${half})/${BED_FADE},`
      + `(${(start + BED_CHORD_SECONDS).toFixed(2)}+${half}-(${u}))/${BED_FADE}))`;
    /*
     * `sqrt` around the whole thing is what makes the crossfade equal-*power*.
     *
     * Two chords at amplitude 0.5 do not add up to one chord at 1.0. They are
     * different notes, so they are uncorrelated, and uncorrelated signals sum in
     * power: 0.5² + 0.5² is half the power of a single chord at 1.0, i.e. 3dB
     * down. That measured as a 3.4dB dip at every chord change — a slow pump
     * every four seconds, which is precisely the kind of thing a viewer notices
     * without being able to say what they noticed. Ramping sqrt(x) instead of x
     * puts both chords at 0.707 mid-fade, and 0.707² + 0.707² is 1.
     *
     * The flat part of the trapezoid is unaffected: sqrt(1) is 1.
     */
    const env = `sqrt(max(0,max(${seg('t')},max(${seg(`t-${BED_LOOP_SECONDS}`)},${seg(`t+${BED_LOOP_SECONDS}`)}))))`;
    const voices = notes.map((hz, n) => {
      // A second oscillator three cents sharp. Two sines a hair apart beat
      // against each other slowly, which is the whole difference between "pad"
      // and "test tone".
      const amp = BED_VOICE_AMP(n);
      return `${amp}*(sin(2*PI*${hz.toFixed(2)}*t)`
        + `+${BED_DETUNE_AMP}*sin(2*PI*${(hz * 1.003).toFixed(2)}*t))`;
    }).join('+');
    return `aevalsrc='(${env})*(${voices})':s=48000:c=stereo:d=${BED_LOOP_SECONDS}[c${i}]`;
  });

  // Worst case all twelve oscillators peak together, mid-crossfade, where the
  // equal-power ramps hold two chords at 0.707 apiece — so the bound is sqrt(2)
  // chords, not one. They rarely all align, so this over-estimates and the real
  // file lands a little under BED_PEAK, which is the direction to be wrong in.
  const worst = Math.SQRT2 * Math.max(...BED_CHORDS.map((notes) => notes
    .reduce((sum, _, n) => sum + BED_VOICE_AMP(n) * (1 + BED_DETUNE_AMP), 0)));
  const gain = (BED_PEAK / worst).toFixed(4);

  const graph = [
    ...chords,
    `${BED_CHORDS.map((_, i) => `[c${i}]`).join('')}amix=inputs=${BED_CHORDS.length}:normalize=0,`
      // Sines have no top end to lose, so the lowpass is not about brightness —
      // it rounds off the corners the detune beating puts into the waveform.
      //
      // No `aecho` and no `afade` here, deliberately: both have tails that run
      // past the loop point, which is exactly the seam the wrapping envelope was
      // built to avoid. The fade-in the finished video needs is applied once, by
      // the mix, to the whole bed rather than to every repetition of it.
      + `lowpass=f=2200,volume=${gain}[bedout]`,
  ].join(';');

  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-filter_complex', graph,
    '-map', '[bedout]',
    // Exactly one loop length. `aevalsrc`'s own `d` is the same number, but the
    // mix can round a sample either way and one stray sample is an audible tick
    // at every repeat.
    '-t', String(BED_LOOP_SECONDS),
    '-c:a', 'pcm_s16le',
    outPath,
  ]);
  return outPath;
}

/**
 * Gain applied to the finished mix, linear.
 *
 * The balance above is set in relative terms — a click stands about 10dB over
 * the bed, a keystroke sits about 4dB under a click — and that balance is right.
 * What it is not is *loud*: measured on a scored take, the mix peaked at
 * -12.4dBFS, which plays roughly eleven decibels under everything else in a
 * feed and reads as a quiet, cheap-sounding video.
 *
 * A fixed gain rather than normalisation, because this material defeats every
 * automatic option. Peak-normalising would push whichever element happens to be
 * loudest up to full scale — and on a take with no clicks that element is the
 * ambient bed, which would arrive at deafening. `loudnorm` and `dynaudnorm` both
 * ride the gain, so a near-constant pad with occasional transients comes back
 * pumping: the bed swells in every gap between clicks. Multiplying a balance
 * that is already correct has neither failure mode.
 *
 * 2.1 puts click peaks near -6dBFS and the bed around -16dBFS, which is a normal
 * sparse mix. `alimiter` below still catches a hot `--music` track.
 */
const MASTER_GAIN = 2.1;

/**
 * Resolve `--music`. A directory is searched for a file named after the flow
 * (`pos.mp3`, `zen.m4a`) and falls back to the first track in it, so you can keep
 * a folder of beds and never pass a filename again.
 */
export function resolveMusic(spec, flowId) {
  if (!spec) return null;
  if (!existsSync(spec)) throw new Error(`--music path does not exist: ${spec}`);
  if (!statSync(spec).isDirectory()) return spec;

  const tracks = readdirSync(spec)
    .filter((f) => AUDIO_EXT.has(path.extname(f).toLowerCase()))
    .sort();
  if (!tracks.length) throw new Error(`no audio files in ${spec}`);
  const named = tracks.find((f) => path.basename(f, path.extname(f)).toLowerCase() === flowId);
  return path.join(spec, named ?? tracks[0]);
}

/** Drop ticks that fall outside the video, and ones too close together to hear. */
function tidy(times, duration, minGap) {
  const out = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    if (t < 0 || t > duration - 0.02) continue;
    if (out.length && t - out[out.length - 1] < minGap) continue;
    out.push(t);
  }
  return out;
}

/**
 * @param {object} o
 * @param {string}   o.videoPath   silent take to score
 * @param {string}   o.outPath     destination (a different file from videoPath)
 * @param {number}   o.duration    video length in seconds
 * @param {string?}  o.music       path to a music bed, or null
 * @param {number}   o.musicVolume 0..1, applied before the mix
 * @param {number[]} o.clicks      click times, in video-timeline seconds
 * @param {number[]} o.keys        keystroke times, in video-timeline seconds
 * @param {number}   o.fadeOut     seconds of music fade at the tail
 * @param {string?}  o.narration   path to a voice-over WAV, already time-aligned
 * @param {string?}  o.audioBitrate  AAC bitrate, e.g. '384k' for Store delivery
 */
export async function mixAudio(o) {
  const {
    videoPath, outPath, duration,
    music = null, musicVolume = 0.28,
    clicks = [], keys = [], fadeOut = 1.6,
    narration = null, audioBitrate = null,
  } = o;

  const clickTimes = tidy(clicks, duration, 0.05);
  const keyTimes = tidy(keys, duration, 0.03);
  const hasTicks = clickTimes.length + keyTimes.length > 0;
  if (!music && !hasTicks && !narration) return { path: videoPath, scored: false };

  const inputs = ['-i', videoPath];
  const filters = [];
  const stems = [];

  if (music) {
    inputs.push('-i', music);
    // Loop a short bed to cover a long take, then trim back to the video: a bed
    // that runs out mid-demo is worse than no bed at all. `apad=whole_dur`
    // covers the opposite case, where the track is shorter even once looped.
    //
    // It must be `apad=whole_dur=D`, never `apad,atrim=0:D`. Bare `apad`
    // generates silence forever and `atrim` only *discards* what comes after
    // its end — it never reports EOF — so the pair spins producing nothing and
    // ffmpeg hangs until it is killed. `whole_dur` pads to an exact length and
    // ends the stream itself.
    filters.push(
      `[1:a]aloop=loop=-1:size=2e9,atrim=0:${duration.toFixed(3)},` +
      `volume=${musicVolume.toFixed(3)},` +
      `afade=t=in:st=0:d=0.9,afade=t=out:st=${Math.max(0, duration - fadeOut).toFixed(3)}:d=${fadeOut},` +
      `aresample=48000,apad=whole_dur=${duration.toFixed(3)}[bed]`,
    );
    stems.push('[bed]');
  }

  // The voice-over. Already delayed line-by-line to its own timestamps by
  // narrate.mjs, so here it is one continuous track that only needs levelling.
  if (narration) {
    const vin = inputs.length / 2;
    inputs.push('-i', narration);
    filters.push(
      `[${vin}:a]aresample=48000,aformat=channel_layouts=stereo,`
      // Speech is the one stem worth compressing: TTS output varies a few dB
      // line to line, and a voice that dips under the bed mid-sentence is the
      // difference between narration and a distraction.
      + `acompressor=threshold=0.09:ratio=3:attack=12:release=220:makeup=1,`
      + `apad=whole_dur=${duration.toFixed(3)},asplit=2[vkey][vmix]`,
    );
    // The trim happens on the mix branch only. Tapping the sidechain key *after*
    // it would hand the ducker a signal 7.5dB quieter than the voice actually is,
    // and since the threshold is absolute the bed would barely move — that version
    // measured 0.4dB of duck in the finished mix, which is nothing. Keying off the
    // untrimmed copy measures 5.0dB on the same fixture. The key has to be the
    // voice at the level it was spoken; only the copy that reaches the mix gets
    // levelled.
    filters.push(
      // 0.42 because MASTER_GAIN (2.1) is applied to the sum: TTS arrives near
      // full scale, so 0.42 × 2.1 lands just under the limiter's 0.94 ceiling.
      // Leaving it at unity would make the limiter the volume control, which is
      // what pumping sounds like.
      `[vmix]volume=0.42[voice]`,
    );
    stems.push('[voice]');
  }

  // Duck the bed under the voice rather than picking one fixed music level that
  // works for both. `sidechaincompress` keys the bed's gain off the voice track
  // itself, so the music drops only while someone is talking and comes back up
  // in the gaps — the same move a human mix engineer makes, and it needs no
  // knowledge of where the lines are because the voice track is the trigger.
  if (narration && music) {
    const bedIdx = stems.indexOf('[bed]');
    filters.push(
      `[bed][vkey]sidechaincompress=threshold=0.02:ratio=12:attack=8:release=420:makeup=1[bedduck]`,
    );
    stems[bedIdx] = '[bedduck]';
  } else if (narration) {
    // Nothing to key off. Discard the split copy or ffmpeg fails on an unused
    // filter output rather than ignoring it.
    filters.push('[vkey]anullsink');
  }

  // One synthesised source per tick kind, split into as many copies as there are
  // hits and each copy delayed to its own timestamp. `adelay` is per-channel, so
  // the value is given twice for stereo.
  for (const [kind, times] of [['click', clickTimes], ['key', keyTimes]]) {
    if (!times.length) continue;
    const spec = TICKS[kind];
    const src = `${kind}src`;
    filters.push(
      // The lowpass is on the source, before the split, so it is computed once
      // rather than once per hit — a 40-click take would otherwise instantiate
      // 40 filters that all produce the identical result.
      `aevalsrc=${tickExpr(spec)}:s=48000:c=stereo:d=${spec.dur},`
      + `lowpass=f=${spec.cut}[${src}]`,
    );
    const labels = times.map((_, i) => `${kind}${i}`);
    filters.push(`[${src}]asplit=${times.length}${labels.map((l) => `[${l}r]`).join('')}`);
    times.forEach((t, i) => {
      const ms = Math.round(t * 1000);
      filters.push(`[${labels[i]}r]adelay=${ms}|${ms}[${labels[i]}]`);
    });
    filters.push(
      `${labels.map((l) => `[${l}]`).join('')}amix=inputs=${times.length}:normalize=0,` +
      `apad=whole_dur=${duration.toFixed(3)}[${kind}bus]`,
    );
    stems.push(`[${kind}bus]`);
  }

  // normalize=0 keeps the levels as mixed. With amix's default the bed would be
  // divided by the number of inputs, so adding ticks would quietly duck it.
  const master = `volume=${MASTER_GAIN},alimiter=limit=0.94[aout]`;
  const mix = stems.length > 1
    ? `${stems.join('')}amix=inputs=${stems.length}:normalize=0,${master}`
    : `${stems[0]}${master}`;
  filters.push(mix);

  const webm = outPath.endsWith('.webm');
  const codec = webm
    ? ['-c:a', 'libopus', '-b:a', '160k']
    /*
     * `audioBitrate` exists for one caller: the Microsoft Store, whose published
     * spec asks for AAC-LC 384 Kbps stereo at 48 KHz. Everything else keeps 192k,
     * which is already transparent for a voice-over over a synth bed — the higher
     * number buys compliance, not quality.
     *
     * `-ar`/`-ac`/`-profile:a` are stated rather than inherited even though the
     * filter graph already resamples to 48000 and every stem is stereo. A spec is
     * checked with `ffprobe` against the file, and a value that is only correct
     * because of something three filters upstream is one refactor away from
     * silently failing certification.
     */
    : ['-c:a', 'aac', '-profile:a', 'aac_low',
       '-b:a', audioBitrate || '192k', '-ar', '48000', '-ac', '2',
       '-movflags', '+faststart'];

  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '0:v:0', '-map', '[aout]',
    '-c:v', 'copy',
    ...codec,
    '-t', duration.toFixed(3),
    outPath,
  ]);

  return {
    path: outPath,
    scored: true,
    music: music ? path.basename(music) : null,
    clicks: clickTimes.length,
    keys: keyTimes.length,
    narrated: Boolean(narration),
  };
}
