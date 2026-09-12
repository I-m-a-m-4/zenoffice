/**
 * Offscreen recorder: renders a `Demo` frame by frame into a WebM file.
 *
 * Why not just record the live preview canvas? `canvas.captureStream(fps)`
 * samples in real time, so a frame that takes 40ms to paint gets dropped and
 * the export stutters differently on every machine. Instead the canvas stream
 * is driven manually — draw frame N, `requestFrame()`, draw N+1 — so the file
 * has exactly `demo.frames` frames regardless of how slow the paint was. That
 * makes the export reproducible, which is the whole point of keeping `draw`
 * pure.
 *
 * Output is WebM (VP9, falling back to VP8). Chromium — which is what the Tauri
 * shell and the admin's browser both are — cannot mux H.264 into MP4 from
 * MediaRecorder, so anything claiming `.mp4` here would be a lie. WebM imports
 * fine into CapCut, Premiere and Resolve; for a store listing that demands MP4,
 * remux once with ffmpeg (`-c copy` won't do it, `-c:v libx264` will).
 */

import { FPS, ensureFonts, stageOf, type Demo, type Theme } from './anim';

export type Preset = {
  id: string;
  label: string;
  /** Width in px; height follows the demo's own stage aspect unless `h` is given. */
  w: number;
  h?: number;
  note: string;
};

export const PRESETS: Preset[] = [
  { id: '1080p', label: '1080p landscape', w: 1920, h: 1080, note: 'Website, YouTube, X' },
  { id: '720p', label: '720p landscape', w: 1280, h: 720, note: 'Lighter file, email-friendly' },
  { id: 'square', label: 'Square 1080', w: 1080, h: 1080, note: 'Instagram, LinkedIn feed' },
  { id: 'vertical', label: 'Vertical 1080×1920', w: 1080, h: 1920, note: 'Reels, TikTok, Shorts' },
];

export const QUALITY = {
  high: 12_000_000,
  standard: 6_000_000,
} as const;

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export const canRecord = () => pickMime() !== null;

/**
 * Fit a demo's stage into an arbitrary output box. A matching aspect is a
 * straight scale; a mismatch letterboxes the stage and fills the rest with the
 * brand backdrop plus a wordmark, so a vertical export of a landscape demo
 * doesn't just crop the UI in half.
 *
 * `stage` is the demo's own design space, not the module-level `STAGE`: a
 * vertical-native demo paired with the vertical preset must land here as a
 * straight 1:1 scale with no bars, and it only does that if the aspect being
 * compared is the one the demo actually drew in.
 */
function layout(w: number, h: number, stage: { w: number; h: number }) {
  const scale = Math.min(w / stage.w, h / stage.h);
  return {
    scale,
    dx: (w - stage.w * scale) / 2,
    dy: (h - stage.h * scale) / 2,
    letterboxed: Math.abs(w / h - stage.w / stage.h) > 0.02,
  };
}

export type RecordOpts = {
  demo: Demo;
  preset: Preset;
  theme: Theme;
  bitrate: number;
  /** 0..1 */
  onProgress?: (t: number) => void;
  signal?: AbortSignal;
};

export async function recordDemo({
  demo, preset, theme, bitrate, onProgress, signal,
}: RecordOpts): Promise<Blob> {
  const mime = pickMime();
  if (!mime) throw new Error('This browser cannot record video (MediaRecorder unavailable).');

  await ensureFonts();

  const stage = stageOf(demo);
  const w = preset.w;
  const h = preset.h ?? Math.round((preset.w * stage.h) / stage.w);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not get a 2D context for recording.');

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const manual = typeof track.requestFrame === 'function';

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    recorder.onerror = () => reject(new Error('Recording failed partway through.'));
  });

  const L = layout(w, h, stage);
  const paint = (frame: number) => {
    ctx.save();
    ctx.fillStyle = theme.id === 'light' ? '#f4f1ee' : '#050506';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(L.dx, L.dy);
    ctx.scale(L.scale, L.scale);
    demo.draw(ctx, frame, theme);
    ctx.restore();
    if (L.letterboxed) brandBars(ctx, w, h, L, demo, theme);
  };

  recorder.start();
  try {
    for (let frame = 0; frame < demo.frames; frame++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      paint(frame);
      if (manual) track.requestFrame();
      onProgress?.((frame + 1) / demo.frames);
      // Yield so the tab keeps painting its own UI and the encoder drains.
      // rAF rather than setTimeout(0): a background tab throttles rAF, which is
      // the behaviour we want (a throttled export is slow, not corrupt).
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
  }

  return done;
}

/** Fill the letterbox with brand rather than black. */
function brandBars(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  L: { dx: number; dy: number; scale: number },
  demo: Demo,
  theme: Theme,
) {
  if (L.dy < 40) return;
  ctx.save();
  ctx.font = `700 ${Math.round(w * 0.055)}px "Bricolage Grotesque", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.primary;
  ctx.fillText('zeneva', w / 2, L.dy / 2);
  ctx.fillStyle = theme.muted;
  ctx.font = `500 ${Math.round(w * 0.026)}px Inter, sans-serif`;
  ctx.fillText(demo.title, w / 2, h - L.dy / 2);
  ctx.restore();
}

/** Single frame as a PNG — for thumbnails and store screenshots. */
export async function stillFrame(
  demo: Demo, frame: number, preset: Preset, theme: Theme,
): Promise<Blob> {
  await ensureFonts();
  const stage = stageOf(demo);
  const w = preset.w;
  const h = preset.h ?? Math.round((preset.w * stage.h) / stage.w);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not get a 2D context.');
  const L = layout(w, h, stage);
  ctx.fillStyle = theme.id === 'light' ? '#f4f1ee' : '#050506';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(L.dx, L.dy);
  ctx.scale(L.scale, L.scale);
  demo.draw(ctx, frame, theme);
  ctx.restore();
  if (L.letterboxed) brandBars(ctx, w, h, L, demo, theme);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png'),
  );
}

/** Estimated seconds the export will take — rough, for the progress copy. */
export const estimateSeconds = (demo: Demo) => Math.ceil(demo.frames / 22);

export const durationLabel = (frames: number) => {
  const total = frames / FPS;
  const m = Math.floor(total / 60);
  const sec = Math.round(total % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke late: Chromium cancels an in-flight download if the URL dies first.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
