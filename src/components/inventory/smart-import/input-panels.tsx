'use client';

/**
 * The per-source input panels.
 *
 * Kept together because they are variations on one idea — give us the data, we will
 * sort it out — and splitting four twenty-line components across four files makes the
 * shared wording harder to keep consistent than it makes anything easier to find.
 *
 * The interesting one is `DesktopPanel`. See `src/lib/import/desktop-capture.ts` for
 * what it can and cannot do; the short version is that regaining window focus is the
 * trigger, so the owner never presses anything in Zeneva between pages.
 */

import * as React from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardPaste,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Receipt,
  Sparkles,
} from 'lucide-react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  canReadWindowsDirectly,
  captureInstructions,
  combine,
  ingest,
  listDesktopWindows,
  newSession,
  pagesAgree,
  readClipboard,
  readDesktopWindow,
  type CaptureSession,
  type DesktopWindow,
} from '@/lib/import/desktop-capture';
import type { RawTable } from '@/lib/import/types';

// ─────────────────────────────────────────────────────────────────────────────
// Paste
// ─────────────────────────────────────────────────────────────────────────────

export function PastePanel({
  onSubmit,
  onAiRead,
  aiQuote,
  busy,
}: {
  onSubmit: (text: string) => void;
  onAiRead: (text: string) => void;
  aiQuote: number;
  busy: string | null;
}) {
  const [text, setText] = React.useState('');
  const rowGuess = text.trim() ? text.trim().split(/\r?\n/).filter((l) => l.trim()).length : 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ClipboardPaste className="h-4 w-4 text-primary" />
          Paste your data
        </h3>
        <p className="text-sm text-muted-foreground">
          Straight out of Excel, Google Sheets, WhatsApp or a note. Columns, or one product per
          line — either works.
        </p>
      </div>

      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        spellCheck={false}
        placeholder={'Coca-Cola 50cl\t24\t1200\nIndomie Chicken 70g\t120\t450\n\nor\n\nCoke 50cl - 1200\nIndomie - 450'}
        className="font-mono text-xs"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {rowGuess > 0 ? `${rowGuess.toLocaleString()} line${rowGuess === 1 ? '' : 's'}` : 'Nothing pasted yet'}
          {' · '}
          Reading it is free.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!text.trim() || !!busy}
            onClick={() => onAiRead(text)}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Messy? Let AI read it
            <span className="ms-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">~{aiQuote}</span>
          </Button>
          <Button size="sm" disabled={!text.trim() || !!busy} onClick={() => onSubmit(text)}>
            Continue
            <ArrowRight className="ms-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Natural language
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_EXAMPLES = [
  'Add 20 cartons of Indomie Chicken at ₦12,000 each',
  '5 crates of Coke 50cl, cost ₦9,500, selling ₦450 a bottle',
  'Received 3 bags of rice at 62k, plus 2 cartons of Peak milk 400g',
];

export function TextPanel({
  onSubmit,
  quote,
  creditsLeft,
  busy,
}: {
  onSubmit: (text: string) => void;
  quote: number;
  creditsLeft: number | null;
  busy: string | null;
}) {
  const [text, setText] = React.useState('');

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Just describe it
        </h3>
        <p className="text-sm text-muted-foreground">
          Write it the way you would say it. Zeneva works out the products, quantities and prices.
        </p>
      </div>

      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Add 20 cartons of Indomie Chicken at ₦12,000 each"
      />

      <div className="flex flex-wrap gap-1.5">
        {TEXT_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(example)}
            className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          About {quote} credit{quote === 1 ? '' : 's'}
          {creditsLeft != null ? ` · ${creditsLeft.toLocaleString()} left` : ''}
        </p>
        <Button size="sm" disabled={!text.trim() || !!busy} onClick={() => onSubmit(text)}>
          {busy ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Read it
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo and invoice
// ─────────────────────────────────────────────────────────────────────────────

export function PhotoPanel({
  kind,
  onSubmit,
  onSwitchKind,
  quote,
  creditsLeft,
  busy,
  pendingFile,
}: {
  kind: 'photo' | 'invoice';
  onSubmit: (file: File, kind: 'photo' | 'invoice') => void;
  onSwitchKind?: (kind: 'photo' | 'invoice') => void;
  quote: number;
  creditsLeft: number | null;
  busy: string | null;
  pendingFile?: File | null;
}) {
  const [file, setFile] = React.useState<File | null>(pendingFile ?? null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // A file dropped on the picker arrives as a prop rather than through the input.
  React.useEffect(() => {
    if (pendingFile) setFile(pendingFile);
  }, [pendingFile]);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    // Revoked on cleanup: an import session that goes through several photographs
    // otherwise holds every one of them in memory until the tab is closed.
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isInvoice = kind === 'invoice';

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          {isInvoice ? <Receipt className="h-4 w-4 text-primary" /> : <Camera className="h-4 w-4 text-primary" />}
          {isInvoice ? 'Photograph your supplier invoice' : 'Photograph your stock'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isInvoice
            ? 'Zeneva reads the line items. The prices on an invoice are what you paid, so they go in as cost prices.'
            : 'Point at a shelf. Zeneva reads the products and counts what it can see.'}
        </p>
        {/* Which prompt to use is the one thing a photograph cannot tell us, and the
            two read the money in opposite directions — an invoice price is what the
            shop paid, a shelf tag is what they charge. So the switch stays visible
            rather than being buried behind the back button, which would also lose a
            file that was dropped rather than picked. */}
        {onSwitchKind && (
          <button
            type="button"
            onClick={() => onSwitchKind(isInvoice ? 'photo' : 'invoice')}
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            {isInvoice ? 'Actually, this is a photo of my stock' : 'This is a supplier invoice instead'}
          </button>
        )}
      </div>

      {preview ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          <NextImage src={preview} alt="" fill className="object-contain" unoptimized />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">Take a photo or choose one</span>
          <span className="text-xs text-muted-foreground">
            {isInvoice ? 'Lay it flat and fill the frame' : 'Get the labels facing the camera'}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null;
          e.target.value = '';
          if (picked) setFile(picked);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          About {quote} credit{quote === 1 ? '' : 's'}
          {creditsLeft != null ? ` · ${creditsLeft.toLocaleString()} left` : ''}
        </p>
        <div className="flex gap-2">
          {file && (
            <Button variant="outline" size="sm" onClick={() => setFile(null)} disabled={!!busy}>
              Change photo
            </Button>
          )}
          <Button size="sm" disabled={!file || !!busy} onClick={() => file && onSubmit(file, kind)}>
            {busy ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Read {isInvoice ? 'invoice' : 'photo'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop capture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pull data out of the Windows program the shop used before Zeneva.
 *
 * The loop is driven by **window focus**: the owner copies in the other program and
 * alt-tabs back, and the return of focus is what makes Zeneva read the clipboard. So
 * there is nothing to press in here between pages, which is what makes forty pages
 * bearable.
 *
 * `session` is a ref rather than state on purpose. Two focus events can arrive in one
 * tick, and an immutable copy would let the second overwrite the first and silently
 * lose a page. The ref is mutated; a counter drives the re-render.
 */
export function DesktopPanel({
  onDone,
  busy,
}: {
  onDone: (table: RawTable, notes: string[]) => void;
  busy: string | null;
}) {
  const session = React.useRef<CaptureSession>(newSession());
  const [, bump] = React.useState(0);
  const [status, setStatus] = React.useState<string | null>(null);
  const [armed, setArmed] = React.useState(false);
  const [manual, setManual] = React.useState('');

  /**
   * The automatic path, when it exists.
   *
   * `null` while it has not been tried, so the panel leads with one button rather than
   * a list of windows the owner did not ask for. Reading another program's window is a
   * surprising thing for an app to do, and it should be something they pressed.
   */
  const [windows, setWindows] = React.useState<DesktopWindow[] | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [reading, setReading] = React.useState<number | null>(null);
  const [autoError, setAutoError] = React.useState<string | null>(null);
  const canAuto = React.useMemo(() => canReadWindowsDirectly(), []);

  const scan = async () => {
    setScanning(true);
    setAutoError(null);
    try {
      setWindows(await listDesktopWindows());
    } catch (err) {
      setAutoError(
        err instanceof Error ? err.message : 'Zeneva could not look at your open windows.',
      );
      setWindows([]);
    } finally {
      setScanning(false);
    }
  };

  const readWindow = async (target: DesktopWindow) => {
    setReading(target.handle);
    setAutoError(null);
    try {
      const { table, notes } = await readDesktopWindow(target.handle);
      onDone(table, [`Read directly from "${target.title}".`, ...notes]);
    } catch (err) {
      setAutoError(
        err instanceof Error
          ? err.message
          : 'That window could not be read. Try the copy-and-paste method below.',
      );
    } finally {
      setReading(null);
    }
  };

  const platform: 'windows' | 'mac' | 'other' =
    typeof navigator === 'undefined'
      ? 'other'
      : /Win/i.test(navigator.userAgent)
        ? 'windows'
        : /Mac/i.test(navigator.userAgent)
          ? 'mac'
          : 'other';

  const take = React.useCallback((text: string) => {
    const result = ingest(session.current, text);
    bump((n) => n + 1);
    if (result.status === 'added') {
      setStatus(
        `Page ${result.page.index} captured — ${result.page.rowCount.toLocaleString()} rows. ${result.totalRows.toLocaleString()} in total. Go get the next page.`,
      );
    } else {
      setStatus(result.message);
    }
  }, []);

  // Focus is the trigger. `visibilitychange` is listened for as well because on
  // Windows an alt-tab back to a window that never lost DOM focus fires only that.
  React.useEffect(() => {
    if (!armed) return;

    let cancelled = false;
    const grab = async () => {
      const read = await readClipboard();
      if (cancelled) return;
      if (!read.ok) {
        setStatus(read.reason);
        return;
      }
      take(read.text);
    };

    const onFocus = () => void grab();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void grab();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [armed, take]);

  const pages = session.current.pages;
  const totalRows = pages.reduce((sum, page) => sum + page.rowCount, 0);
  const mismatched = !pagesAgree(session.current);

  const finish = () => {
    const combined = combine(session.current);
    if (!combined) return;
    const notes: string[] = [
      `Captured from another program in ${pages.length} page${pages.length === 1 ? '' : 's'}.`,
    ];
    if (mismatched) {
      notes.push(
        'The captured pages did not all have the same number of columns — check the rows carefully.',
      );
    }
    onDone(combined, notes);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Monitor className="h-4 w-4 text-primary" />
          Bring it over from your old program
        </h3>
        <p className="text-sm text-muted-foreground">
          Zeneva watches the clipboard. Copy in the other program, come back here, and it reads the
          rows by itself — no export needed.
        </p>
      </div>

      <ol className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
        {captureInstructions(platform).map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
              {i + 1}
            </span>
            <span className="text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>

      {/* ── The automatic path, Windows desktop only ── */}
      {canAuto && (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">Or let Zeneva read it for you</p>
              <p className="text-xs text-muted-foreground">
                No copying, no paging — Zeneva reads the whole list out of the other
                program&apos;s window in one go.
              </p>
            </div>
            <Button size="sm" onClick={scan} disabled={scanning || reading !== null} className="shrink-0">
              {scanning ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {windows === null ? 'Find my old program' : 'Refresh list'}
            </Button>
          </div>

          {autoError && <p className="text-xs text-amber-600 dark:text-amber-500">{autoError}</p>}

          {windows !== null && windows.length === 0 && !autoError && (
            <p className="text-xs text-muted-foreground">
              No other windows found. Open your old program, then press Refresh.
            </p>
          )}

          {windows !== null && windows.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {windows.map((target) => (
                <button
                  key={target.handle}
                  type="button"
                  onClick={() => readWindow(target)}
                  disabled={reading !== null}
                  className="flex w-full items-center justify-between gap-2 rounded border bg-background p-2 text-start text-xs transition-colors hover:border-primary/60 disabled:opacity-60"
                >
                  <span className="min-w-0 truncate">
                    {target.title}
                    {target.minimized && (
                      <span className="ms-1.5 text-[10px] text-muted-foreground">(minimised)</span>
                    )}
                  </span>
                  {reading === target.handle ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Zeneva only reads what is on screen — it never clicks or types in the other
            program. Some older programs expose nothing to read; the copy method below
            always works.
          </p>
        </div>
      )}

      {!armed ? (
        <Button variant={canAuto ? 'outline' : 'default'} className="w-full" onClick={() => setArmed(true)}>
          {canAuto ? 'Use copy and paste instead' : 'Start watching the clipboard'}
        </Button>
      ) : (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Watching — {pages.length} page{pages.length === 1 ? '' : 's'},{' '}
            {totalRows.toLocaleString()} row{totalRows === 1 ? '' : 's'}
          </p>
          {status && <p className="mt-1 text-xs text-muted-foreground">{status}</p>}
        </div>
      )}

      {/* Always available: clipboard reading needs focus and a permission the owner
          can refuse, and both failures have this as their remedy. */}
      <details className="rounded-lg border p-2.5" open={!armed ? false : undefined}>
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Clipboard blocked? Paste a page here instead
        </summary>
        <div className="mt-2 space-y-2">
          <Textarea
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            rows={4}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder="Ctrl+V here"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!manual.trim()}
            onClick={() => {
              take(manual);
              setManual('');
            }}
          >
            Add this page
          </Button>
        </div>
      </details>

      {pages.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {totalRows.toLocaleString()} rows captured across {pages.length} page
            {pages.length === 1 ? '' : 's'}
          </p>
          <Button size="sm" onClick={finish} disabled={!!busy}>
            Continue with {totalRows.toLocaleString()} rows
            <ArrowRight className="ms-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet picker
// ─────────────────────────────────────────────────────────────────────────────

/** Which worksheet to import. Asked rather than assumed — see `readSpreadsheet`. */
export function SheetPicker({
  sheets,
  onChoose,
}: {
  sheets: RawTable[];
  onChoose: (index: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Which sheet holds your products?</h3>
        <p className="text-sm text-muted-foreground">
          That workbook has {sheets.length} sheets with data in them.
        </p>
      </div>
      <div className="space-y-2">
        {sheets.map((sheet, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onChoose(index)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border p-3 text-start transition-colors',
              'hover:border-primary/60 hover:bg-muted/50',
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{sheet.label}</p>
              <p className="text-xs text-muted-foreground">
                {sheet.rows.length.toLocaleString()} row{sheet.rows.length === 1 ? '' : 's'}
                {sheet.hasHeaderRow && sheet.headers.length > 0
                  ? ` · ${sheet.headers.filter(Boolean).slice(0, 4).join(', ')}`
                  : ' · no header row'}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
