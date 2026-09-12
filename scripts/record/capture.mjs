/**
 * Screen capture: CDP screencast frames -> one MJPEG file -> ffmpeg -> MP4/WebM.
 *
 * Why not `MediaRecorder` inside the page (what the canvas studio used)? Because
 * Chromium cannot mux H.264 into MP4 from `MediaRecorder`, so that path can only
 * ever produce WebM. `Page.startScreencast` hands us raw frames instead, and
 * ffmpeg — already on this machine — encodes a real H.264 MP4 that drops into
 * Premiere, CapCut, a store listing or a tweet without a conversion step.
 *
 * ## Why this file writes one big file instead of a JPEG per frame
 *
 * It used to write `f000123.jpg` per frame and hand ffmpeg a concat list with a
 * per-frame duration. That produced 7.5 captured frames a second against a
 * requested 30 — every real frame held for four output frames, which is exactly
 * what a stutter is. The cause was measured, not guessed:
 *
 *   screencast with the write removed .... 51.2 fps desktop, 40.1 fps mobile
 *   screencast with writeFileSync ........ 12.7 fps, and the write alone 73ms
 *   writeFileSync, one file each ......... 28.1 ms/frame
 *   writeSync to one already-open fd ..... 0.1 ms/frame
 *
 * 28ms is not throughput — a 32KB write is nothing. It is the cost of *creating*
 * a file on this machine: NTFS metadata plus Defender scanning each new `.jpg`
 * as it lands. Chrome was never the ceiling; the recorder was stalling its own
 * event loop, and Chrome will not send frame N+1 until frame N is acknowledged.
 *
 * So frames are appended to a single descriptor that is opened once. Concatenated
 * JPEGs are a valid MJPEG stream, which `-f mjpeg -framerate N` reads back as a
 * constant-rate video — and that removes the irregular-spacing problem at the
 * source rather than papering over it at encode time.
 *
 * ## Two clocks became one
 *
 * The old design had a hazard worth naming, because it is gone now and should
 * not come back: frame durations were clamped and pause-collapsed at encode
 * time, so `videoTimeFor()` had to replay the identical transform or every click
 * sound landed on the wrong frame. Here the emitter runs at a fixed rate, so
 * video time is just `frameIndex / fps`. There is one clock and nothing to keep
 * in agreement.
 */

import { spawn } from 'node:child_process';
import {
  mkdirSync, openSync, writeSync, closeSync, fsyncSync,
  rmSync, existsSync, statSync,
} from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { phoneFrame } from './phone.mjs';

export function hasFfmpeg() {
  const probe = spawn(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg']);
  return new Promise((resolve) => {
    probe.on('error', () => resolve(false));
    probe.on('exit', (code) => resolve(code === 0));
  });
}

/**
 * How long the emitter will keep repeating a frame that Chrome has stopped
 * refreshing, before it stops emitting entirely.
 *
 * Chrome only paints when something changes, so "no new frame" means either the
 * page is genuinely still (a caption holding, a card on screen) or the renderer
 * is stuck behind something slow. From out here those look identical, so this is
 * a compromise rather than a detection: hold long enough that no authored beat
 * is ever truncated — cards run to ~4.5s and captions to ~5s — and short enough
 * that a pathological network stall does not put thirty seconds of frozen
 * spinner in the middle of an ad. While the timeline is stopped, wall time keeps
 * running and video time does not, which is the intended trade.
 */
const MAX_HOLD = 6.0;

/**
 * Ceiling on how many frames one tick may emit to catch up after the event loop
 * was blocked.
 *
 * The sampler is a timer, and a timer that fires late owes frames. Emitting them
 * keeps video time equal to wall time, which is what keeps the click sounds on
 * the clicks. This caps the debt at the same duration as MAX_HOLD so a single
 * pathological stall cannot dump a thousand duplicate frames into the file.
 */
const MAX_CATCHUP = Math.ceil(MAX_HOLD * 60);

/**
 * Build an ffmpeg expression for a value that holds, then eases to a new value,
 * then holds again — the shape of a camera move.
 *
 * `marks` are `{ at, dur, val }` on the *video* timeline, sorted. Each segment
 * eases from the previous value over `dur` and then holds, which the `clip` on
 * the progress term does for free: past `at + dur` it pins at 1 and the segment
 * evaluates to `val` until the next mark takes over. Built back to front because
 * the nesting runs that way — the last segment is the innermost else.
 *
 * easeOutCubic, `1-(1-u)^3`: fast off the mark and settling gently, which is how
 * a camera move reads as deliberate rather than mechanical.
 */
function moveExpr(T, marks, initial) {
  if (!marks.length) return String(initial);
  const seg = (m) => {
    const u = `clip((${T}-${m.at.toFixed(4)})/${Math.max(0.05, m.dur).toFixed(4)},0,1)`;
    if (Math.abs(m.val - m.prev) < 1e-6) return m.val.toFixed(5);
    return `(${m.prev.toFixed(5)}+${(m.val - m.prev).toFixed(5)}*(1-pow(1-${u},3)))`;
  };
  let expr = seg(marks[marks.length - 1]);
  for (let i = marks.length - 2; i >= 0; i--) {
    expr = `if(lt(${T},${marks[i + 1].at.toFixed(4)}),${seg(marks[i])},${expr})`;
  }
  return `if(lt(${T},${marks[0].at.toFixed(4)}),${initial},${expr})`;
}

export function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code === 0) resolve(err);
      else reject(new Error(`${cmd} exited ${code}\n${err.split('\n').slice(-14).join('\n')}`));
    });
  });
}

export class Recorder {
  /** @param {import('./cdp.mjs').Cdp} cdp */
  constructor(cdp, { dir, fps = 30, quality = 92, maxWidth, maxHeight, preview = null }) {
    this.cdp = cdp;
    this.dir = dir;
    this.fps = fps;
    this.quality = quality;
    this.maxWidth = maxWidth;
    this.maxHeight = maxHeight;
    this.off = null;
    this.dropped = 0;

    /** The MJPEG stream every emitted frame is appended to, and its descriptor. */
    this.file = path.join(dir, 'frames.mjpg');
    this.fd = null;

    /**
     * The newest JPEG Chrome has sent, and when it landed (epoch seconds).
     *
     * The screencast handler does nothing but keep this current. Anything slower
     * than that in the handler throttles the capture, because Chrome waits for
     * the ack before painting the next frame — see the header.
     */
    this.latest = null;
    this.latestAt = 0;

    /** Frames Chrome delivered, vs frames written. They are not the same number. */
    this.painted = 0;
    this.emitted = 0;
    this.duplicated = 0;
    this.stalledTicks = 0;

    /**
     * Wall-clock instant (epoch seconds) each emitted frame was written at.
     *
     * Frame `i` occupies video time `[i/fps, (i+1)/fps)`, so this array is the
     * whole of the wall-clock -> video-time mapping that `videoTimeFor` needs.
     * At 30fps a two-minute take is 3600 numbers; keeping them is cheaper than
     * any scheme that reconstructs them.
     */
    this.marks = [];
    this.timer = null;
    this.stopped = false;

    /**
     * Where to mirror the newest frame so the studio can show a live view, or
     * null for none. Written at a throttled rate rather than per frame — the
     * preview only has to look live, and at 30fps a second JPEG write per frame
     * competes with the capture it is supposed to be showing.
     */
    this.preview = preview;
    this.previewEveryMs = 200;
    this.lastPreview = 0;
    this.previewBusy = false;

    /**
     * Wall-clock spans the operator paused for, as [start, end] epoch seconds.
     *
     * A pause is not a stall: nothing about the app is slow, the human just
     * stopped to look. Nothing is emitted while paused, so the span costs zero
     * video time and a five-minute inspection does not become five minutes of
     * frozen picture. Kept for the run log.
     */
    this.pauses = [];
    this.pausedAt = null;

    /**
     * Spans the *flow* asked not to be filmed, as [start, end, label].
     *
     * Same effect as a pause and a different owner, which is why it is a second
     * flag rather than a reuse of the first. A page reload is plumbing: the white
     * flash, the boot loader, and — on a dev server — the on-demand compile of a
     * route nobody warmed. None of it is the product, and all of it used to land
     * in the middle of a take. Held, it costs zero video time, so the encoded film
     * cuts straight from the frame before the navigation to the frame after it.
     */
    this.blinds = [];
    this.blindAt = null;
    this.blindLabel = '';
  }

  /** Hold the capture. Frames keep arriving; they are just not written. */
  pause() {
    if (this.pausedAt !== null) return false;
    this.pausedAt = Date.now() / 1000;
    return true;
  }

  resume() {
    if (this.pausedAt === null) return false;
    this.pauses.push([this.pausedAt, Date.now() / 1000]);
    this.pausedAt = null;
    return true;
  }

  get paused() {
    return this.pausedAt !== null;
  }

  /**
   * Stop filming for something that must not appear in the video.
   *
   * Deliberately not `pause()`. Both stop frames reaching the file, but they
   * belong to different people: one is the operator holding the take, the other
   * is the flow saying "the next second is plumbing". Sharing one flag would mean
   * a navigation that finished while the operator was paused resumed the
   * recording under them — and the reverse, an operator resume that started
   * filming a reload. Two flags, two owners, and `#emit` checks both.
   *
   * Returns false if already held, so the caller knows whether it owns the
   * release. Nesting is not supported and does not need to be: the only caller
   * is a navigation, and a navigation cannot be inside another one.
   */
  blind(label = '') {
    if (this.blindAt !== null) return false;
    this.blindAt = Date.now() / 1000;
    this.blindLabel = label;
    return true;
  }

  unblind() {
    if (this.blindAt === null) return false;
    this.blinds.push([this.blindAt, Date.now() / 1000, this.blindLabel]);
    this.blindAt = null;
    this.blindLabel = '';
    return true;
  }

  /** Wall-clock seconds kept out of the film. For the run log. */
  get blindSeconds() {
    return this.blinds.reduce((s, [a, b]) => s + (b - a), 0);
  }

  async start() {
    mkdirSync(this.dir, { recursive: true });
    this.fd = openSync(this.file, 'w');
    this.off = this.cdp.on('Page.screencastFrame', (p) => this.#onFrame(p));
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: this.quality,
      maxWidth: this.maxWidth,
      maxHeight: this.maxHeight,
      everyNthFrame: 1,
    });
    this.t0 = Date.now() / 1000;
    this.#sample();
  }

  #onFrame(params) {
    // Ack first and unconditionally: Chrome will not paint the next frame until
    // this one is acknowledged, so anything queued ahead of the ack becomes the
    // capture rate. That is not hypothetical — the JPEG write used to sit here,
    // and it cost two thirds of the frames.
    this.cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {
      this.dropped++;
    });
    let buf;
    try {
      buf = Buffer.from(params.data, 'base64');
    } catch {
      this.dropped++;
      return;
    }
    this.latest = buf;
    this.latestAt = Date.now() / 1000;
    this.painted++;

    // The live view keeps updating while paused — the whole point of pausing is
    // to look at the page, so a frozen preview would defeat it.
    this.#writePreview(buf);
  }

  /**
   * Emit exactly `fps` frames a second, whatever Chrome happens to be doing.
   *
   * Sampling on our own clock rather than on Chrome's paints is what makes the
   * output constant-rate by construction. A page that paints at 50fps gets
   * evenly decimated; one that paints at 12 gets each frame repeated, which is
   * what a screen recorder is supposed to do and reads as smooth. The old code
   * instead wrote one video frame per paint and asked ffmpeg to resample
   * afterwards, so an uneven capture stayed uneven.
   *
   * The timer is self-correcting: `next` advances by exactly one period every
   * tick regardless of when the callback actually ran, so drift cannot
   * accumulate over a two-minute take.
   */
  #sample() {
    const period = 1000 / this.fps;
    let next = performance.now() + period;

    const tick = () => {
      if (this.stopped) return;

      // A late tick owes frames. Emitting them keeps video time equal to wall
      // time, which is the whole reason the sound effects land where they
      // should; skipping them would silently fast-forward past whatever blocked
      // the loop.
      const behind = Math.floor((performance.now() - next) / period);
      const owed = 1 + Math.max(0, Math.min(behind, MAX_CATCHUP));
      this.#emit(owed);

      next += owed * period;
      const delay = next - performance.now();
      this.timer = setTimeout(tick, Math.max(0, delay));
    };

    this.timer = setTimeout(tick, period);
  }

  /** One sampler tick: append the newest frame `count` times, or nothing. */
  #emit(count) {
    if (this.pausedAt !== null || this.blindAt !== null || this.fd === null || !this.latest) return;

    // Nothing has painted for a long time: either the page is a still image or
    // the renderer is wedged, and from here those are the same thing. Stop the
    // timeline rather than pile up frozen frames — see MAX_HOLD.
    if (Date.now() / 1000 - this.latestAt > MAX_HOLD) {
      this.stalledTicks++;
      return;
    }
    this.#append(this.latest, count, Date.now() / 1000);
  }

  /** The only writer. Appends `buf` `count` times and marks each frame at `now`. */
  #append(buf, count, now) {
    if (this.fd === null) return;
    for (let i = 0; i < count; i++) {
      try {
        // writeSync is not obliged to take the whole buffer in one call.
        let off = 0;
        while (off < buf.length) off += writeSync(this.fd, buf, off, buf.length - off);
        this.marks.push(now);
        this.emitted++;
      } catch {
        this.dropped++;
        return;
      }
    }
    if (count > 1) this.duplicated += count - 1;
  }

  /**
   * Mirror the newest frame for the studio's live view.
   *
   * Written to a temp name and renamed, because rename is atomic on both
   * platforms while a plain write is not: the studio polls this file on its own
   * schedule and would otherwise eventually read a half-written JPEG and render a
   * torn or blank frame.
   *
   * Asynchronous, and skipped entirely while a previous one is still in flight.
   * The preview creates two files every time it runs, and file creation is the
   * expensive operation on this machine — doing it synchronously here would
   * reintroduce the stall this file exists to remove, at 10 writes a second.
   */
  #writePreview(buf) {
    if (!this.preview || this.previewBusy) return;
    const now = Date.now();
    if (now - this.lastPreview < this.previewEveryMs) return;
    this.lastPreview = now;
    this.previewBusy = true;
    const tmp = `${this.preview}.tmp`;
    writeFile(tmp, buf)
      .then(() => rename(tmp, this.preview))
      .catch(() => { /* preview is cosmetic — never let it break a take */ })
      .finally(() => { this.previewBusy = false; });
  }

  async stop({ tailHoldMs = 700 } = {}) {
    this.stopped = true;
    // A take aborted mid-navigation leaves a span open. Closing it here keeps the
    // run log honest rather than silently losing the last hold.
    this.unblind();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      await this.cdp.send('Page.stopScreencast');
    } catch { /* page may already be closing */ }
    if (this.off) this.off();
    this.off = null;
    this.tStop = Date.now() / 1000;

    if (this.fd !== null) {
      // Hold the closing frame for a beat. Cutting to black on the same frame
      // the last animation lands on reads as a dropped connection, not an
      // ending. Appended directly rather than through #emit, which would refuse
      // on the staleness check — a page that has finished animating is exactly
      // the case here.
      const hold = Math.round((tailHoldMs / 1000) * this.fps);
      if (hold > 0 && this.latest) this.#append(this.latest, hold, Date.now() / 1000);
      // Flush before ffmpeg opens it: 250MB of MJPEG can otherwise still be
      // sitting in the page cache when the encoder starts reading.
      try { fsyncSync(this.fd); } catch { /* best effort */ }
      try { closeSync(this.fd); } catch { /* best effort */ }
      this.fd = null;
    }
    return {
      count: this.emitted,
      painted: this.painted,
      duplicated: this.duplicated,
      dropped: this.dropped,
    };
  }

  /** Wall-clock seconds the capture was open for. */
  get seconds() {
    if (!this.t0) return 0;
    return (this.tStop ?? Date.now() / 1000) - this.t0;
  }

  /** Frames a second Chrome actually delivered — for the run log, not for timing. */
  get paintedFps() {
    const s = this.seconds;
    return s > 0 ? this.painted / s : 0;
  }

  /**
   * Was this wall-clock instant actually inside the captured window?
   *
   * `videoTimeFor` has to answer with a number for anything it is handed, so it
   * clamps: an instant from before the first frame maps to 0. That is right for
   * placing a mark that arrives a hair early, and wrong for a mark that belongs
   * to something the camera never saw — and the recorder types a full email and
   * password into a login form before capture begins. Clamped, those 22
   * keystrokes and 3 clicks all landed on frame zero, so every scored take opened
   * on a single splat of ticks. Asking this first turns that clamp into a drop.
   */
  captured(wallSeconds) {
    return this.marks.length > 0 && wallSeconds >= this.marks[0];
  }

  /**
   * Map a wall-clock instant (epoch seconds, as `Date.now()/1000` gives) onto the
   * encoded video's own timeline.
   *
   * Frame `i` is written at `marks[i]` and occupies video time `i/fps`, so this is
   * a binary search over `marks` — which is sorted, being append-only in time.
   * The two clocks are nearly the same now that emission is constant-rate; they
   * still diverge across a pause and across a stall, which is exactly what makes
   * this function necessary rather than decorative. Sound effects are placed with
   * it so a click tick stays on the frame where the button actually depresses.
   *
   * Clamps at both ends. Callers placing a mark that may predate the capture
   * should filter with `captured()` first.
   */
  videoTimeFor(wallSeconds) {
    const m = this.marks;
    if (!m.length) return 0;
    if (wallSeconds <= m[0]) return 0;
    if (wallSeconds >= m[m.length - 1]) return (m.length - 1) / this.fps;

    let lo = 0;
    let hi = m.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (m[mid] <= wallSeconds) lo = mid;
      else hi = mid;
    }
    // Interpolate across the gap so several ticks between two emitted frames do
    // not all collapse onto the same instant.
    const span = m[hi] - m[lo];
    const frac = span > 0 ? (wallSeconds - m[lo]) / span : 0;
    return (lo + frac) / this.fps;
  }

  /** Length of the encoded video in its own timeline. One clock, one division. */
  get videoSeconds() {
    return this.emitted / this.fps;
  }

  /**
   * @param {string} outPath  final .mp4 (or .webm) path
   * @param {{ crf?:number, preset?:string,
   *           zooms?:Array<{at:number,dur:number,to:number,px:number,py:number}>,
   *           phone?:{ theme:string, aspect:number, dir:string }|null }} opts
   */
  async encode(outPath, opts = {}) {
    if (this.emitted < 2) {
      throw new Error(`only ${this.emitted} frame(s) captured — nothing to encode`);
    }
    const { crf = 18, preset = 'veryfast', phone = null, zooms = [], store = null } = opts;

    mkdirSync(path.dirname(outPath), { recursive: true });
    const webm = outPath.endsWith('.webm');
    /*
     * `veryfast` rather than `slow`, by default.
     *
     * At crf 18 on screen content the two are visually indistinguishable — flat
     * UI panels and text are cheap to encode, the motion is a cursor and some
     * scrolling — while `slow` costs several times the wall clock on a
     * two-minute take. The operator is waiting for this, so the time is worth
     * more than the last few percent of bitrate efficiency.
     */
    /*
     * Measured, so it does not get "optimised" again: on a 205MB / 1962-frame
     * take this stage is 18.3s, and 8.2s of that is MJPEG *decode*. Swapping the
     * encoder does not touch it — h264_qsv came out at 19.7s and h264_mf at
     * 20.4s, both slower than libx264 veryfast, and `-threads 8` /
     * `-filter_complex_threads 8` land inside run-to-run noise. Dropping the
     * camera filter entirely saves under a second. The stage is decode-bound and
     * already at its floor; the time worth cutting is upstream of here.
     */
    /*
     * Keyframe spacing is left at the encoder's default on purpose.
     *
     * It is tempting to add `-g fps` so the studio's instant (stream-copy) trim
     * can start anywhere: a copy can only begin on a keyframe, so at the default
     * spacing an instant cut of one of these takes can start at 0s, 8.3s, 16.6s…
     * and nowhere else. Measured on a 42s mobile take, `-g 30` moved the nearest
     * keyframe to 3s exactly as intended — and took the file from 1646 KB to
     * 4336 KB. Screen content is the worst case for it, not the best: a still page
     * makes P-frames nearly empty, so forcing an I-frame every second is most of
     * the bitrate.
     *
     * So every take would pay 2.6x for a feature only some takes use. The studio's
     * exact trim re-encodes instead and lands on the frame asked for, which costs
     * a couple of seconds at cut time and nothing at all to the takes nobody cuts.
     */
    const codec = webm
      ? ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf + 12), '-row-mt', '1',
         '-deadline', 'realtime', '-cpu-used', '4']
      /*
       * Microsoft Store delivery, encoded to the letter of the published spec.
       *
       * Every value here is quoted from Microsoft's own MP4 requirements rather
       * than chosen — see STORE in store.mjs for the source. That matters because
       * three of them are things this encoder deliberately does *not* do
       * otherwise, and the note above about keyframe spacing explains why: a
       * closed GOP of half the frame rate costs about 2.6x the bitrate on screen
       * content. Here that is irrelevant, because the same spec asks for 50 Mbps,
       * which is roughly two hundred times what crf 18 chooses for this material.
       *
       * The bitrate is the one number that looks absurd and is correct anyway. It
       * is a *ceiling* Microsoft wants headroom under, and the listing re-encodes
       * everything to Smooth Streaming on ingest regardless — so paying it buys
       * certification, not picture. A 60s trailer lands near 375 MB, well inside
       * the 2 GB cap.
       *
       * `-b_strategy 0` is what makes "2 consecutive B frames" literally true.
       * Left adaptive, x264 decides per-frame how many B-frames to use and the
       * count varies through the film; with the strategy off, `-bf 2` means
       * exactly two, everywhere. `-coder 1` is CABAC, `-flags +cgop` closes the
       * GOP, and `-sc_threshold 0` stops a scene cut inserting an unscheduled
       * keyframe, which would break the fixed GOP the spec asks for.
       */
      : store
        ? ['-c:v', 'libx264', '-preset', preset,
           '-b:v', store.bitrate, '-maxrate', store.bitrate, '-bufsize', store.bufsize,
           '-profile:v', 'high', '-level', '4.2',
           '-bf', String(store.bFrames), '-b_strategy', '0',
           '-g', String(store.gop(this.fps)), '-keyint_min', String(store.gop(this.fps)),
           '-sc_threshold', '0', '-flags', '+cgop',
           '-coder', '1',
           '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
           '-color_range', 'tv',
           '-movflags', '+faststart']
        : ['-c:v', 'libx264', '-preset', preset, '-crf', String(crf),
           '-profile:v', 'high', '-movflags', '+faststart'];

    /*
     * Mobile takes are composited into a phone chassis here rather than drawn
     * inside the page.
     *
     * A border painted in the page sits *over* the app, so every screen loses its
     * outer ten pixels behind a bezel — and a frame drawn inside a full-bleed
     * rectangle reads as a vignette, not a device. Containing the screen means
     * shrinking the footage, which cannot happen in the page at all. Doing it in
     * one ffmpeg graph also means the app renders exactly as it always did:
     * nothing about the frame is on the page's code path.
     */
    const frame = phone ? phoneFrame({
      outW: this.maxWidth, outH: this.maxHeight,
      // The *capture's* aspect, not the output's. These are not the same number
      // once the phone viewport stops being 9:16 — the output stays 1080x1920
      // because that is what Reels and Shorts want, while the screen inside the
      // chassis takes the shape of the phone being simulated. Passing the output
      // aspect here would letterbox a tall phone into a square-ish screen.
      aspect: phone.aspect,
      theme: phone.theme, dir: phone.dir,
    }) : null;

    /*
     * One sequential file at a constant rate, so there is no concat list, no
     * per-frame duration and no `fps=` resample filter. The stream *is* the
     * timeline. This is also the reason the encode got faster: ffmpeg reads
     * forward through one 250MB file instead of opening several thousand.
     */
    const input = ['-f', 'mjpeg', '-framerate', String(this.fps), '-i', this.file];

    /*
     * The camera move.
     *
     * `zoompan` rather than `crop`, because a crop's output size is fixed at
     * filter-configuration time — it can pan, but it cannot zoom. zoompan
     * re-samples to a constant `s` every frame, which is exactly a camera.
     *
     * Two things it is easy to get wrong here. Its time constant is `on/fps` and
     * not `t` — there is no `t` in this filter, and referring to one fails at
     * configuration with "Undefined constant". And its default `fps` is 25, so
     * leaving it off silently resamples a 30fps take to 25 and undoes the
     * constant-rate capture this file exists for.
     *
     * x/y place the *crop centre* on the anchor rather than treating the anchor
     * as a corner, clamped so the window can never leave the frame — which is
     * what lets a flow punch in on a button near the edge of the screen without
     * having to know how close to the edge is too close.
     */
    const T = `(on/${this.fps})`;
    const zoomTo = frame ? { w: frame.screen.w, h: frame.screen.h } : { w: this.maxWidth, h: this.maxHeight };
    const camera = zooms.length
      ? `zoompan=z='${moveExpr(T, zooms.map((z) => ({ at: z.at, dur: z.dur, val: z.to, prev: z.from })), 1)}'`
        + `:x='clip((${moveExpr(T, zooms.map((z) => ({ at: z.at, dur: z.dur, val: z.px, prev: z.fromPx })), 0.5)})*iw-(iw/zoom)/2,0,iw-iw/zoom)'`
        + `:y='clip((${moveExpr(T, zooms.map((z) => ({ at: z.at, dur: z.dur, val: z.py, prev: z.fromPy })), 0.5)})*ih-(ih/zoom)/2,0,ih-ih/zoom)'`
        + `:d=1:fps=${this.fps}:s=${zoomTo.w}x${zoomTo.h}`
      : null;

    /*
     * Force the declared output size instead of accepting whatever the capture
     * came out as.
     *
     * A 1600x900 viewport at dpr 1.2 ought to be exactly 1920x1080, but Chrome
     * rounds the surface and delivered 1078 — and the old `trunc(ih/2)*2` guard
     * only rounded that further down, so takes shipped at 1920x1078. Two rows
     * short of 1080p is the kind of thing a store listing rejects. Scaling to
     * *cover* and cropping loses a pixel or two off an edge, which is invisible,
     * where padding would add visible black bars and a plain scale would stretch.
     */
    const fitTo = (w, h) => `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`;

    // The camera already outputs at exactly the size the next stage wants, so it
    // replaces the fit rather than stacking with it.
    const screen = camera || fitTo(zoomTo.w, zoomTo.h);

    /*
     * Full range in, limited range out — for Store delivery only.
     *
     * The capture arrives as MJPEG, which is full-range YUV: ffprobe reports the
     * finished file as `yuvj420p`, and the `j` is the whole problem. Microsoft's
     * spec says "Color Space: 4.2.0", meaning broadcast-range 4:2:0, and a
     * full-range file handed to a player that assumes limited range renders with
     * crushed blacks and clipped whites. Converting the range is what makes the
     * pixel format plain `yuv420p` rather than merely relabelling it.
     *
     * A separate `scale` with no dimensions rather than range arguments on the
     * existing one: the camera path replaces `fitTo` entirely, so parameters added
     * there would silently not apply to any take with a zoom in it.
     */
    const range = store ? ',scale=w=iw:h=ih:in_range=full:out_range=tv' : '';

    const filter = frame
      // Three steps, and the order is the whole trick. Scale the footage into the
      // cut-out; `pad` it onto a full-size canvas at the cut-out's offset — which
      // is what keeps the output at `maxWidth`x`maxHeight`, since `overlay` clips
      // to its *base* and a base the size of the screen would silently crop the
      // chassis off; then lay the chassis over the top, where its transparent
      // screen shows the footage through and its rounded corners give the app's
      // square frame rounded corners.
      //
      // The camera move belongs on the screen content, before the chassis goes
      // on. Zooming the composite would zoom the phone, which is a different and
      // much worse idea.
      ? `[0:v]${screen}${range},`
        + `pad=${this.maxWidth}:${this.maxHeight}:${frame.screen.x}:${frame.screen.y}:black[scr];`
        + `[scr][1:v]overlay=0:0:shortest=1[v]`
      : `[0:v]${screen}${range}[v]`;

    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      ...input,
      // The chassis is one still image, looped for the length of the footage.
      ...(frame ? ['-loop', '1', '-i', frame.file] : []),
      '-filter_complex', filter,
      '-map', '[v]',
      '-fps_mode', 'cfr',
      ...codec,
      '-pix_fmt', 'yuv420p',
      outPath,
    ]);

    return {
      path: outPath,
      bytes: existsSync(outPath) ? statSync(outPath).size : 0,
    };
  }

  cleanup() {
    try { rmSync(this.dir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* best effort */ }
  }
}

/** Duration / frame count / size, straight from the encoded file. */
export async function probe(file) {
  const out = await new Promise((resolve, reject) => {
    const p = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_frames',
      '-show_entries', 'stream=nb_read_frames,avg_frame_rate,width,height:format=duration,size',
      '-of', 'json', file,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    let err = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('exit', (c) => (c === 0 ? resolve(buf) : reject(new Error(err || `ffprobe exited ${c}`))));
  });
  const j = JSON.parse(out);
  const s = j.streams?.[0] ?? {};
  return {
    width: s.width,
    height: s.height,
    frames: Number(s.nb_read_frames ?? 0),
    fps: s.avg_frame_rate,
    seconds: Number(j.format?.duration ?? 0),
    bytes: Number(j.format?.size ?? 0),
  };
}

/**
 * How much of a finished take is actually animating.
 *
 * The container's frame rate is a promise, not a measurement. A browser only
 * paints when the page changes, so a screen recording of a web app repeats the
 * last frame through every still moment: takes in `marketing-out/` measure 21-50%
 * unique frames against a 30fps container, and *that* is what reads as stutter.
 * A rendered scene measures upward of 90%.
 *
 * Worth printing on every take because it is the one number that says which of
 * those you got, and no encoder setting moves it — the fix is always upstream, in
 * whether the source was animating at all.
 *
 * `mpdecimate` drops frames that are near-identical to their predecessor and
 * ffmpeg reports how many survived, so kept/total is the ratio. Costs one decode
 * pass, which on a two-minute 1080p take is a couple of seconds.
 *
 * Returns null rather than throwing: this is a diagnostic, and a take must not
 * fail because a measurement did.
 */
export async function uniqueRatio(file, total) {
  if (!total || total < 2) return null;
  try {
    // The count lands on stderr as ffmpeg's usual progress line, which `run`
    // returns; there is no cleaner way to ask this filter what it kept. So the
    // stats output has to stay on — `-nostats` suppresses the very line being
    // parsed here, which makes this return null and look like a broken measurement.
    const err = await run('ffmpeg', [
      '-hide_banner', '-v', 'info',
      '-i', file, '-vf', 'mpdecimate', '-f', 'null', '-',
    ]);
    const frames = [...String(err).matchAll(/frame=\s*(\d+)/g)].pop();
    if (!frames) return null;
    const kept = Number(frames[1]);
    if (!Number.isFinite(kept) || kept < 1) return null;
    return { kept, total, ratio: kept / total };
  } catch {
    return null;
  }
}
