'use client';

import * as React from 'react';
import {
  Clapperboard, Download, Loader2, ImageDown, AlertTriangle, Info, X, Film,
  Sun, Moon, Bot, PenTool,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DemoPlayer } from '@/components/admin/demo-player';
import { RecorderPanel } from '@/components/admin/recorder-panel';
import { THEMES, type Demo, type Theme } from '@/lib/marketing/anim';
import { posDemo } from '@/lib/marketing/demo-pos';
import { zenDemo } from '@/lib/marketing/demo-zen';
import { inventoryDemo } from '@/lib/marketing/demo-inventory';
import {
  PRESETS, QUALITY, canRecord, recordDemo, stillFrame, download, durationLabel,
  type Preset,
} from '@/lib/marketing/record';

const DEMOS: Demo[] = [posDemo, inventoryDemo, zenDemo];

export default function MarketingStudioPage() {
  const { toast } = useToast();

  const [demoId, setDemoId] = React.useState(DEMOS[0].id);
  const demo = DEMOS.find((d) => d.id === demoId) ?? DEMOS[0];

  const [frame, setFrame] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [preset, setPreset] = React.useState<Preset>(PRESETS[0]);
  const [quality, setQuality] = React.useState<keyof typeof QUALITY>('high');
  const [themeId, setThemeId] = React.useState<keyof typeof THEMES>('dark');
  const theme: Theme = THEMES[themeId];

  const [progress, setProgress] = React.useState<number | null>(null);
  const [savingStill, setSavingStill] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  // MediaRecorder support can't be read during SSR, so resolve it after mount.
  const [recordable, setRecordable] = React.useState<boolean | null>(null);
  React.useEffect(() => setRecordable(canRecord()), []);

  // Switching demos rewinds — frame numbers don't mean the same thing across demos.
  const selectDemo = (id: string) => {
    if (progress !== null) return;
    setDemoId(id);
    setFrame(0);
    setPlaying(false);
  };

  const exporting = progress !== null;

  const handleExport = async () => {
    if (exporting) return;
    setPlaying(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    try {
      const blob = await recordDemo({
        demo,
        preset,
        theme,
        bitrate: QUALITY[quality],
        onProgress: setProgress,
        signal: controller.signal,
      });
      download(blob, `zeneva-${demo.id}-${preset.id}-${themeId}.webm`);
      toast({
        title: 'Video ready',
        description: `${demo.title} · ${preset.label} · ${themeId} · ${(blob.size / 1e6).toFixed(1)} MB`,
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        toast({ title: 'Export cancelled' });
      } else {
        console.error('Demo export failed:', err);
        toast({
          variant: 'destructive',
          title: 'Export failed',
          description: (err as Error)?.message ?? 'Something went wrong while recording.',
        });
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  const handleStill = async () => {
    setSavingStill(true);
    try {
      const blob = await stillFrame(demo, frame, preset, theme);
      download(blob, `zeneva-${demo.id}-${themeId}-frame-${frame}.png`);
      toast({ title: 'Frame saved', description: `Frame ${frame} as PNG.` });
    } catch (err) {
      console.error('Still export failed:', err);
      toast({ variant: 'destructive', title: 'Could not save the frame.' });
    } finally {
      setSavingStill(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header. Deliberately compact: the recorder tab below is a viewport-first
          layout, and every row spent here is a row taken off the picture. The
          longer explanation of the two modes lives on the tab that needs it. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-headline text-2xl font-black tracking-tight">
          <Clapperboard className="h-6 w-6 text-primary" />
          Marketing Studio
        </h1>
        <Badge variant="outline" className="shrink-0 gap-1.5 border-primary/30 text-primary">
          <Film className="h-3.5 w-3.5" />
          {DEMOS.length} demos
        </Badge>
      </div>

      <Tabs defaultValue="record" className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-2">
          <TabsTrigger value="record" className="gap-2">
            <Bot className="h-4 w-4" /> Record the real app
          </TabsTrigger>
          <TabsTrigger value="drawn" className="gap-2">
            <PenTool className="h-4 w-4" /> Drawn demos
          </TabsTrigger>
        </TabsList>

        {/* The bot: signs in, clicks through a coded flow, records it with sound. */}
        <TabsContent value="record" className="mt-0">
          <RecorderPanel />
        </TabsContent>

        <TabsContent value="drawn" className="mt-0 space-y-6">
          <div className="flex gap-2.5 rounded-xl border border-border bg-muted/30 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              These are drawn from code rather than captured, so they contain no real customer
              data and export at any resolution — but they only ever look <em>like</em> the app.
              For footage that is guaranteed to match the product, use the recorder.
            </p>
          </div>

          {/* Demo picker */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMOS.map((d) => {
          const active = d.id === demo.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => selectDemo(d.id)}
              disabled={exporting && !active}
              className={cn(
                'rounded-xl border p-4 text-left transition-all disabled:opacity-50',
                active
                  ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:bg-accent/50',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-headline text-lg font-bold">{d.title}</h3>
                <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                  {durationLabel(d.frames)}
                </Badge>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.blurb}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Player */}
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <DemoPlayer
              demo={demo}
              theme={theme}
              frame={frame}
              onFrame={setFrame}
              playing={playing}
              onPlayingChange={setPlaying}
            />
          </CardContent>
        </Card>

        {/* Export panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Export</CardTitle>
              <CardDescription>Pick a size, then render.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Theme — the demos redraw in the app's own light/dark tokens */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'light' as const, label: 'Light', Icon: Sun },
                  { id: 'dark' as const, label: 'Dark', Icon: Moon },
                ]).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setThemeId(id)}
                    disabled={exporting}
                    aria-pressed={themeId === id}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50',
                      themeId === id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent/50',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p)}
                    disabled={exporting}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50',
                      preset.id === p.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-accent/50',
                    )}
                  >
                    <span>
                      <span className="block text-sm font-medium">{p.label}</span>
                      <span className="block text-xs text-muted-foreground">{p.note}</span>
                    </span>
                    {preset.id === p.id && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                {(['high', 'standard'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuality(q)}
                    disabled={exporting}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors disabled:opacity-50',
                      quality === q
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent/50',
                    )}
                  >
                    {q} quality
                  </button>
                ))}
              </div>

              {exporting ? (
                <div className="space-y-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-150"
                      style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Rendering frame {Math.round((progress ?? 0) * demo.frames)} of {demo.frames}…
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs text-destructive"
                      onClick={() => abortRef.current?.abort()}
                    >
                      <X className="h-3 w-3" /> Cancel
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Keep this tab in front — a background tab throttles rendering
                    and the export will crawl.
                  </p>
                </div>
              ) : (
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={handleExport}
                  disabled={recordable === false}
                >
                  <Download className="h-4 w-4" />
                  Export video
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleStill}
                disabled={savingStill || exporting}
              >
                {savingStill
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ImageDown className="h-4 w-4" />}
                Save this frame as PNG
              </Button>

              {recordable === false && (
                <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-xs leading-relaxed text-destructive">
                    This browser can&apos;t record video. Open the studio in Chrome or
                    Edge — PNG frames still work here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-muted bg-muted/30">
            <CardContent className="flex gap-2.5 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Exports are <strong className="text-foreground">WebM</strong>. Chromium
                  can&apos;t mux MP4 from the browser, so anything labelled .mp4 here would
                  just be a mislabelled WebM.
                </p>
                <p>
                  WebM uploads directly to YouTube, X and LinkedIn, and imports into
                  CapCut, Premiere and Resolve. For a store listing that insists on MP4:
                </p>
                <code className="block rounded bg-background/80 px-2 py-1.5 font-mono text-[10px] text-foreground">
                  ffmpeg -i in.webm -c:v libx264 -crf 18 -pix_fmt yuv420p out.mp4
                </code>
              </div>
            </CardContent>
          </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
