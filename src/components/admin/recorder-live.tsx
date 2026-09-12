'use client';

import * as React from 'react';
import { getAuth } from 'firebase/auth';
import {
  Loader2, Pause, Play, Square, Maximize2, Minimize2, Radio, Lock, MonitorPlay,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { adminApiBase } from '@/lib/admin-api';
import type { LiveResponse, LiveStatus } from '@/lib/marketing/recorder';

/**
 * Watch the take that is happening right now.
 *
 * The recorder runs headless by default, so without this the studio's only
 * feedback is a log line every few seconds and a video that appears at the end —
 * and a selector that resolves to the wrong button produces a *perfectly
 * successful* run of useless footage. Seeing the frames as they are captured is
 * how that gets caught in the first ten seconds instead of the last.
 *
 * Two polls, deliberately separate. The status is small and wanted often; the
 * frame is ~200 KB and only changes when the recorder writes a new one, which
 * `If-None-Match` turns into an empty 304. Folding the frame into the status
 * response as base64 would inflate every poll by a third and throw that away.
 *
 * **The sign-in is never mirrored.** The recorder only starts the screencast
 * after login, so the credential screen — with a real password typed into it —
 * cannot reach this component. That is a property of where capture starts, not
 * something filtered here.
 */

/** Slightly faster than the recorder's 200ms preview write, so nothing queues. */
const FRAME_MS = 320;
const STATUS_MS = 900;

const PHASES: Record<LiveStatus['phase'], { label: string; tone: string }> = {
  launching: { label: 'Launching Chrome', tone: 'text-muted-foreground' },
  'signing in': { label: 'Signing in', tone: 'text-muted-foreground' },
  warming: { label: 'Warming routes', tone: 'text-amber-600 dark:text-amber-500' },
  recording: { label: 'Recording', tone: 'text-red-600 dark:text-red-500' },
  encoding: { label: 'Encoding', tone: 'text-primary' },
  done: { label: 'Finished', tone: 'text-emerald-600' },
  failed: { label: 'Failed', tone: 'text-destructive' },
};

async function authHeaders(): Promise<Record<string, string> | null> {
  const user = getAuth().currentUser;
  if (!user) return null;
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

/**
 * @param fill  Grow to fill a flex parent instead of sizing to a viewport
 *              fraction. For the editor layout, where the container owns the
 *              height and this is the element that should absorb whatever is
 *              left. Off by default, so any existing caller renders exactly as
 *              it did before.
 */
export function RecorderLive({ onFinished, fill = false }: { onFinished?: () => void; fill?: boolean }) {
  const [live, setLive] = React.useState<LiveStatus | null>(null);
  const [running, setRunning] = React.useState(false);
  const [frameUrl, setFrameUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const urlRef = React.useRef<string | null>(null);
  const etagRef = React.useRef<string | null>(null);
  // Fires the parent's refresh exactly once per finished run, rather than on
  // every poll that still reports the same terminal state.
  const finishedRef = React.useRef(false);

  const swapFrame = React.useCallback((blob: Blob) => {
    const next = URL.createObjectURL(blob);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    setFrameUrl(next);
  }, []);

  React.useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  // ---- status poll. Recursive timeout rather than setInterval: a slow response
  // must not let a second request start on top of the first.
  React.useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const headers = await authHeaders();
        if (headers) {
          const res = await fetch(`${adminApiBase()}/api/admin/record/live`, { headers, cache: 'no-store' });
          if (res.ok && alive) {
            const body = (await res.json()) as LiveResponse;
            setLive(body.live);
            setRunning(body.running);
            if (body.running) {
              finishedRef.current = false;
            } else if (body.live && !finishedRef.current) {
              finishedRef.current = true;
              onFinished?.();
            }
          }
        }
      } catch {
        // A dropped poll is not worth surfacing; the next one is a second away.
      }
      if (alive) timer = setTimeout(tick, STATUS_MS);
    };

    void tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [onFinished]);

  // ---- frame poll. Only while something is running: once a take is over the
  // last frame is already on screen and re-fetching it forever is pure waste.
  React.useEffect(() => {
    if (!running) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      // A hidden tab cannot show anything, so skip the transfer entirely and
      // pick up again on the next tick after the operator comes back.
      if (document.visibilityState === 'visible') {
        try {
          const headers = await authHeaders();
          if (headers) {
            if (etagRef.current) headers['If-None-Match'] = etagRef.current;
            const res = await fetch(`${adminApiBase()}/api/admin/record/live/frame`, {
              headers,
              cache: 'no-store',
            });
            if (alive && res.ok) {
              etagRef.current = res.headers.get('ETag');
              swapFrame(await res.blob());
            }
            // 304 and 404 both mean "nothing new" — keep what is on screen.
          }
        } catch {
          /* same as above */
        }
      }
      if (alive) timer = setTimeout(tick, FRAME_MS);
    };

    void tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [running, swapFrame]);

  const send = async (action: 'pause' | 'resume' | 'abort') => {
    setBusy(true);
    // Reflect the click immediately. The recorder checks the control file between
    // actions, so a real pause can be a second away — without this the button
    // looks dead for exactly as long as the operator is most likely to click it
    // again.
    setLive((l) => (l && action !== 'abort' ? { ...l, paused: action === 'pause' } : l));
    try {
      const headers = await authHeaders();
      if (headers) {
        await fetch(`${adminApiBase()}/api/admin/record/live`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
          cache: 'no-store',
        });
      }
    } catch {
      /* the next status poll re-reads the truth either way */
    } finally {
      setBusy(false);
    }
  };

  const phase = live ? PHASES[live.phase] : null;
  const portrait = !!live && live.height > live.width;
  const ratio = live ? `${live.width} / ${live.height}` : '16 / 9';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border bg-card shadow-sm transition-all',
        running ? 'border-primary/40 shadow-md' : 'border-border',
        // A flex column, so the stage below can be the child that absorbs the
        // leftover height. `h-full min-h-0` because this element is itself a flex
        // child in the editor layout and has to be shrinkable for that to work.
        fill && 'flex h-full min-h-0 flex-col',
      )}
    >
      {/* Browser chrome. Cosmetic, but it frames the capture as a window rather
          than a floating screenshot — and the pill is a genuinely useful readout
          of which take is rolling. */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex shrink-0 gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2.5 py-1">
          <Lock className="h-3 w-3 shrink-0 text-emerald-600" />
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {live ? `localhost:9007 — ${live.stamp}` : 'localhost:9007'}
          </span>
        </div>
        {running && (
          <Badge variant="outline" className="shrink-0 gap-1.5 border-red-500/40 text-red-600 dark:text-red-500">
            <Radio className="h-3 w-3 animate-pulse" />
            Live
          </Badge>
        )}
        {/* Redundant once the container owns the height — there is nothing left to
            expand into, and a button that does nothing is worse than no button. */}
        {!fill && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 shrink-0 p-0"
            aria-label={expanded ? 'Shrink the live view' : 'Expand the live view'}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>

      {/* Stage */}
      <div
        className={cn(
          'flex items-center justify-center bg-neutral-950 p-4',
          // `fill` hands height control to the parent: `min-h-0` is the part that
          // actually matters, because a flex child defaults to min-height:auto and
          // would refuse to shrink below its content, pushing the page taller
          // instead of letterboxing inside the space it was given.
          fill
            ? 'min-h-0 flex-1'
            : cn('transition-[min-height]', expanded ? 'min-h-[76vh]' : portrait ? 'min-h-[520px]' : 'min-h-[380px]'),
        )}
      >
        {frameUrl ? (
          <div
            className={cn(
              'relative overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10',
              // Filling means constraining on *both* axes and letting the aspect
              // ratio pick which one binds — `w-full` alone would overflow a short
              // container vertically.
              fill ? 'max-h-full max-w-full' : 'w-full',
              portrait && !fill ? 'mx-auto max-w-[320px]' : '',
              !portrait && !fill ? 'max-w-full' : '',
            )}
            style={fill
              ? { aspectRatio: ratio, height: '100%' }
              : { aspectRatio: ratio, maxHeight: expanded ? '72vh' : '58vh' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frameUrl}
              alt="The frame the recorder is capturing right now"
              className="h-full w-full object-contain"
            />
            {live?.paused && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
                <div className="flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 shadow-lg">
                  <Pause className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Paused</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            {running ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-neutral-300">
                  {phase?.label ?? 'Starting'}…
                </p>
                <p className="max-w-sm text-xs leading-relaxed text-neutral-500">
                  The picture starts once the bot is signed in — the login screen is
                  never mirrored here.
                </p>
              </>
            ) : (
              <>
                <MonitorPlay className="h-7 w-7 text-neutral-600" />
                <p className="text-sm text-neutral-400">Nothing is recording</p>
                <p className="max-w-sm text-xs leading-relaxed text-neutral-500">
                  Start a run and the browser appears here, frame by frame, as it is
                  captured.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Transport */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              running ? 'animate-pulse bg-red-500' : live?.phase === 'done' ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            )}
          />
          <div className="min-w-0">
            <p className={cn('text-xs font-semibold', phase?.tone ?? 'text-muted-foreground')}>
              {phase?.label ?? 'Idle'}
              {live && ` · ${live.device} · ${live.theme}`}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {live?.step || 'Waiting for a run to start.'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={!running || busy}
            onClick={() => void send(live?.paused ? 'resume' : 'pause')}
          >
            {live?.paused
              ? <><Play className="h-3.5 w-3.5" /> Resume</>
              : <><Pause className="h-3.5 w-3.5" /> Pause</>}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
            disabled={!running || busy}
            onClick={() => void send('abort')}
          >
            <Square className="h-3.5 w-3.5" /> Stop
          </Button>
        </div>
      </div>

      {live?.paused && running && (
        <p className="border-t border-border bg-amber-500/5 px-4 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-500">
          Pausing holds the flow between actions and drops the paused span from the
          finished video — so however long you look, the cut stays tight.
        </p>
      )}
    </div>
  );
}
