'use client';

import * as React from 'react';
import { Play, Pause, SkipBack, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FPS, ensureFonts, stageOf, type Demo, type Theme } from '@/lib/marketing/anim';

/**
 * Preview player for a `Demo`.
 *
 * Plays on a frame clock derived from elapsed wall time rather than a
 * frame++ per rAF tick, so a dropped frame during preview shifts nothing —
 * the demo stays the same length here as it is in the export. `draw` is pure,
 * so scrubbing is just "paint frame N".
 */
export function DemoPlayer({
  demo,
  theme,
  frame,
  onFrame,
  playing,
  onPlayingChange,
  className,
}: {
  demo: Demo;
  theme: Theme;
  frame: number;
  onFrame: (f: number) => void;
  playing: boolean;
  onPlayingChange: (p: boolean) => void;
  className?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [loop, setLoop] = React.useState(true);
  const [fontsReady, setFontsReady] = React.useState(false);

  // The demo's own design space, not the landscape default — a vertical reel
  // has to preview in 9:16 or the scrub is not what the export will be.
  const stage = stageOf(demo);

  // Keep the latest values in refs so the rAF loop never needs re-subscribing.
  const frameRef = React.useRef(frame);
  frameRef.current = frame;
  const loopRef = React.useRef(loop);
  loopRef.current = loop;

  React.useEffect(() => {
    let alive = true;
    ensureFonts().then(() => { if (alive) setFontsReady(true); });
    return () => { alive = false; };
  }, []);

  /** Paint one frame at device pixel ratio. */
  const paint = React.useCallback((f: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth;
    const cssH = Math.round((cssW * stage.h) / stage.w);
    const pxW = Math.round(cssW * dpr);
    const pxH = Math.round(cssH * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
      canvas.style.height = `${cssH}px`;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(pxW / stage.w, pxH / stage.h);
    demo.draw(ctx, f, theme);
  }, [demo, theme, stage.w, stage.h]);

  // Repaint on scrub, demo swap, font load and container resize.
  React.useEffect(() => { paint(frame); }, [paint, frame, fontsReady]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => paint(frameRef.current));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [paint]);

  // Playback clock. Rebases its origin on loop rather than restarting the
  // effect, so looping never drops a frame at the seam.
  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let originMs = performance.now();
    let originFrame = frameRef.current >= demo.frames - 1 ? 0 : frameRef.current;

    const tick = (now: number) => {
      const elapsed = ((now - originMs) / 1000) * FPS;
      const next = Math.floor(originFrame + elapsed);
      if (next >= demo.frames) {
        if (loopRef.current) {
          originMs = now;
          originFrame = 0;
          onFrame(0);
          raf = requestAnimationFrame(tick);
          return;
        }
        onFrame(demo.frames - 1);
        onPlayingChange(false);
        return;
      }
      onFrame(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [playing, demo.frames, onFrame, onPlayingChange]);

  const seconds = (f: number) => (f / FPS).toFixed(1);
  const pct = (frame / Math.max(1, demo.frames - 1)) * 100;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative overflow-hidden rounded-xl border bg-[#0a0a0b] shadow-2xl">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-pointer"
          style={{ aspectRatio: `${stage.w} / ${stage.h}` }}
          onClick={() => onPlayingChange(!playing)}
          role="img"
          aria-label={`${demo.title} preview, frame ${frame} of ${demo.frames}`}
        />
        {!playing && frame === 0 && (
          <button
            type="button"
            onClick={() => onPlayingChange(true)}
            className="absolute inset-0 flex items-center justify-center bg-black/25 transition-opacity hover:bg-black/15"
            aria-label="Play preview"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/95 shadow-xl">
              <Play className="ml-1 h-9 w-9 fill-white text-white" />
            </span>
          </button>
        )}
      </div>

      {/* Transport */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="h-10 w-10 shrink-0"
          onClick={() => onPlayingChange(!playing)}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-10 w-10 shrink-0"
          onClick={() => { onPlayingChange(false); onFrame(0); }}
          aria-label="Back to start"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={loop ? 'default' : 'outline'}
          className="h-10 w-10 shrink-0"
          onClick={() => setLoop((v) => !v)}
          aria-label={loop ? 'Looping on' : 'Looping off'}
          aria-pressed={loop}
        >
          <Repeat className="h-4 w-4" />
        </Button>

        <div className="relative flex-1 px-1">
          <input
            type="range"
            min={0}
            max={demo.frames - 1}
            value={frame}
            onChange={(e) => { onPlayingChange(false); onFrame(Number(e.target.value)); }}
            className="w-full accent-primary"
            aria-label="Scrub timeline"
          />
          {/* Chapter ticks, positioned against the same scale as the range */}
          <div className="pointer-events-none absolute inset-x-1 top-1/2 -z-10 h-1 -translate-y-1/2">
            {demo.chapters.map((ch) => (
              <span
                key={ch.label}
                className="absolute top-0 h-1 w-0.5 bg-muted-foreground/50"
                style={{ left: `${(ch.at / (demo.frames - 1)) * 100}%` }}
              />
            ))}
          </div>
        </div>

        <span className="w-24 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {seconds(frame)}s / {seconds(demo.frames)}s
        </span>
      </div>

      {/* Chapters */}
      <div className="flex flex-wrap gap-1.5">
        {demo.chapters.map((ch, i) => {
          const next = demo.chapters[i + 1]?.at ?? demo.frames;
          const active = frame >= ch.at && frame < next;
          return (
            <button
              key={ch.label}
              type="button"
              onClick={() => { onPlayingChange(false); onFrame(ch.at); }}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {ch.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
