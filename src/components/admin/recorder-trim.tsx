'use client';

import * as React from 'react';
import { Loader2, Scissors, SkipBack, SkipForward, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { adminApiFetch } from '@/lib/admin-api';
import {
  TRIM_MIN_SECONDS,
  type TrimMode, type TrimResult,
} from '@/lib/marketing/recorder';

/**
 * Set an in and an out point on a take, then write the cut as a new file.
 *
 * Deliberately not a timeline editor. The three things an operator actually does
 * to a screen recording are trim the fumbling off the front, trim the pause off
 * the back, and check the result — so this is a player, two points, and a button.
 * Every control sets the same two numbers, which are also typeable, because
 * "2.4" is faster than dragging when you already know where the cut goes.
 *
 * Nothing here can damage the take: the cut is a new file, and the route refuses
 * to write over anything. The original stays in the list next to it.
 */

/** Playhead redraw. `timeupdate` fires about four times a second, which reads as a stutter. */
function useRafTime(video: HTMLVideoElement | null, playing: boolean): number {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    if (!video) return;
    let raf = 0;
    const tick = () => {
      setT(video.currentTime);
      raf = requestAnimationFrame(tick);
    };
    if (playing) raf = requestAnimationFrame(tick);
    else setT(video.currentTime);
    return () => cancelAnimationFrame(raf);
  }, [video, playing]);
  return t;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fmt = (s: number) => `${s.toFixed(2)}s`;

export function RecorderTrim({
  name,
  url,
  onCut,
}: {
  name: string;
  url: string;
  /** Called with the new file so the list can refresh and select it. */
  onCut: (result: TrimResult) => void;
}) {
  const { toast } = useToast();

  const [video, setVideo] = React.useState<HTMLVideoElement | null>(null);
  const [duration, setDuration] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [inAt, setInAt] = React.useState(0);
  const [outAt, setOutAt] = React.useState(0);
  const [mode, setMode] = React.useState<TrimMode>('exact');
  const [busy, setBusy] = React.useState(false);

  // Typed values are held as text while they are being typed: parsing on every
  // keystroke makes "1" out of "1.5" the moment the dot is pressed.
  const [draft, setDraft] = React.useState<{ in: string; out: string } | null>(null);

  const now = useRafTime(video, playing);
  /** Set while "Play selection" is running, so playback stops at the out-point. */
  const stopAt = React.useRef<number | null>(null);

  // A new take resets both points; keeping them would apply one clip's in-point
  // to another clip's timeline.
  React.useEffect(() => {
    setInAt(0);
    setOutAt(0);
    setDuration(0);
    setDraft(null);
  }, [url]);

  const onMeta = (el: HTMLVideoElement) => {
    // Chrome reports Infinity for a still-streaming blob; there is nothing to
    // trim against until it settles, and it does so before the first frame.
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    setDuration(el.duration);
    setInAt(0);
    setOutAt(el.duration);
  };

  const seek = (to: number) => {
    if (!video) return;
    video.currentTime = clamp(to, 0, duration || video.duration || 0);
  };

  const setIn = (v: number) => {
    const next = clamp(v, 0, Math.max(0, outAt - TRIM_MIN_SECONDS));
    setInAt(next);
    return next;
  };
  const setOut = (v: number) => {
    const next = clamp(v, Math.min(duration, inAt + TRIM_MIN_SECONDS), duration);
    setOutAt(next);
    return next;
  };

  const playSelection = () => {
    if (!video) return;
    stopAt.current = outAt;
    video.currentTime = inAt;
    void video.play();
  };

  const cut = async () => {
    setBusy(true);
    try {
      const result = await adminApiFetch<TrimResult>('/api/admin/record/trim', {
        body: { name, start: inAt, end: outAt, mode },
      });
      onCut(result);
      toast({
        title: `Cut saved — ${fmt(result.seconds)}`,
        description: result.snappedFrom !== null
          ? `${result.take.name} · starts at ${fmt(result.start)}, the nearest keyframe before ${fmt(result.snappedFrom)}. Use Exact if that matters.`
          : `${result.take.name}${result.marks ? ' · click and voice timings came along' : ''}`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not cut this take',
        description: (err as Error)?.message ?? 'Something went wrong.',
      });
    } finally {
      setBusy(false);
    }
  };

  const ready = duration > 0;
  const selected = Math.max(0, outAt - inAt);
  const tooShort = ready && selected < TRIM_MIN_SECONDS;
  const whole = ready && inAt <= 0.001 && outAt >= duration - 0.001;
  const pct = (t: number) => (ready ? (clamp(t, 0, duration) / duration) * 100 : 0);

  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        key={url}
        ref={setVideo}
        src={url}
        controls
        className="mx-auto max-h-[60vh] w-auto max-w-full rounded-lg bg-black"
        onLoadedMetadata={(e) => onMeta(e.currentTarget)}
        onDurationChange={(e) => onMeta(e.currentTarget)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          // Stop where the selection ends, but only when it was "Play selection"
          // that started this — scrubbing past the out-point by hand is allowed.
          if (stopAt.current !== null && e.currentTarget.currentTime >= stopAt.current) {
            e.currentTarget.pause();
            stopAt.current = null;
          }
        }}
      />

      {/* -------------------------------------------------- the selection bar */}
      <button
        type="button"
        aria-label="Seek"
        disabled={!ready}
        className="relative block h-9 w-full overflow-hidden rounded-md border border-border bg-muted/50 disabled:opacity-50"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - box.left) / box.width) * duration);
        }}
      >
        {/* What survives the cut */}
        <span
          className="absolute inset-y-0 bg-primary/20 ring-1 ring-inset ring-primary/40"
          style={{ left: `${pct(inAt)}%`, width: `${Math.max(0, pct(outAt) - pct(inAt))}%` }}
        />
        {/* What does not */}
        <span className="absolute inset-y-0 left-0 bg-background/60" style={{ width: `${pct(inAt)}%` }} />
        <span className="absolute inset-y-0 right-0 bg-background/60" style={{ width: `${100 - pct(outAt)}%` }} />
        <span className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: `${pct(inAt)}%` }} />
        <span className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: `calc(${pct(outAt)}% - 2px)` }} />
        {/* Playhead */}
        <span
          className="absolute inset-y-0 w-px bg-foreground/70"
          style={{ left: `${pct(now)}%` }}
        />
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* -------------------------------------------------- in / out points */}
        {([['in', inAt, setIn], ['out', outAt, setOut]] as const).map(([which, value, apply]) => (
          <div key={which} className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {which === 'in' ? 'Start at' : 'End at'}
            </Label>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={!ready}
                title="Back 0.1s"
                onClick={() => { setDraft(null); seek(apply(value - 0.1)); }}
              >
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
              <Input
                inputMode="decimal"
                className="h-8 w-[5.5rem] text-center font-mono text-xs"
                value={draft ? draft[which] : value.toFixed(2)}
                disabled={!ready}
                onChange={(e) => setDraft({
                  in: which === 'in' ? e.target.value : (draft?.in ?? inAt.toFixed(2)),
                  out: which === 'out' ? e.target.value : (draft?.out ?? outAt.toFixed(2)),
                })}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) apply(n);
                  setDraft(null);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={!ready}
                title="Forward 0.1s"
                onClick={() => { setDraft(null); seek(apply(value + 0.1)); }}
              >
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 px-2 text-[11px]"
                disabled={!ready}
                title="Use the current position in the player"
                onClick={() => { setDraft(null); apply(video?.currentTime ?? 0); }}
              >
                Here
              </Button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={!ready || tooShort}
            onClick={playSelection}
          >
            <Play className="h-3.5 w-3.5" /> Play selection
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs"
            disabled={!ready || whole}
            onClick={() => { setDraft(null); setInAt(0); setOutAt(duration); }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Whole take
          </Button>
        </div>
      </div>

      {/* -------------------------------------------------- how, then do it */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-1.5">
          {(['exact', 'fast'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs capitalize transition-colors',
                mode === m
                  ? 'border-primary bg-primary/10 font-medium text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {m}
            </button>
          ))}
          {/*
            Exact is the default because it is the one that does what the two
            points say. Fast can only begin on a keyframe, and these takes carry
            one about every eight seconds — so it is the right choice when you are
            trimming the end and leaving the start at zero, and the wrong one
            otherwise. Saying which is which here is cheaper than a surprise.
          */}
          <p className="ml-1 max-w-[23rem] text-[11px] leading-snug text-muted-foreground">
            {mode === 'exact'
              ? 'Starts on the exact frame you set. Re-encodes, so a long take takes a few seconds.'
              : 'Instant and lossless, but it can only start on a keyframe — best when you are only trimming the end.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {!ready ? 'Reading the file…' : tooShort
              ? `At least ${TRIM_MIN_SECONDS}s`
              : <>Keeping <span className="font-medium text-foreground">{fmt(selected)}</span> of {fmt(duration)}</>}
          </p>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={!ready || tooShort || busy}
            onClick={() => void cut()}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scissors className="h-3.5 w-3.5" />}
            {whole ? 'Save a copy' : 'Cut'}
          </Button>
        </div>
      </div>
    </div>
  );
}
