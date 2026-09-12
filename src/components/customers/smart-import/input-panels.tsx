'use client';

/**
 * The customer importer's input screens: the source picker and the three panels
 * behind it.
 *
 * One file rather than four, because each panel is a textarea or a file input with a
 * sentence above it — splitting them out would be more imports than code. The product
 * importer splits them because its photo panel has a camera, its desktop panel drives
 * a Rust bot, and its barcode panel owns a scanner.
 *
 * The ordering rule from the product picker holds here too: tiles are ordered by how
 * many shops can use them, not by which is cleverest. A spreadsheet and a paste come
 * first because that is what most people have. The photograph is the one that sells
 * the feature, and it is third — leading with it tells a shop with a perfectly good
 * CSV that they need AI when they do not.
 */

import * as React from 'react';
import {
  Camera,
  ClipboardPaste,
  FileSpreadsheet,
  MessageSquareText,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { estimateCredits } from '@/lib/import/pricing';
import type { CustomerImportSource } from './use-customer-import';

type Tile = {
  source: CustomerImportSource;
  icon: React.ElementType;
  label: string;
  hint: string;
  usesAi: boolean;
};

const TILES: Tile[] = [
  {
    source: 'spreadsheet',
    icon: FileSpreadsheet,
    label: 'Excel or CSV',
    hint: 'Any columns, any order',
    usesAi: false,
  },
  {
    source: 'paste',
    icon: ClipboardPaste,
    label: 'Paste a list',
    hint: 'From Excel, Sheets or WhatsApp',
    usesAi: false,
  },
  {
    source: 'photo',
    icon: Camera,
    label: 'Photo of your book',
    hint: 'A ledger page or customer list',
    usesAi: true,
  },
  {
    source: 'text',
    icon: MessageSquareText,
    label: 'Just type them',
    hint: '"Musa on 0803 123 4567, wholesale"',
    usesAi: true,
  },
];

export function CustomerSourcePicker({
  onPick,
  onFile,
  onImage,
  creditsLeft,
}: {
  onPick: (source: CustomerImportSource) => void;
  onFile: (file: File) => void;
  onImage: (file: File) => void;
  creditsLeft: number | null;
}) {
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  /**
   * Route a dropped file by what it is, not by which tile was pressed.
   *
   * Somebody who drops a photograph on the drop zone means "read this photo", and
   * sending them back to press the right tile first is the friction this screen
   * exists to remove. An image must go to `onImage` and not to `onFile`, which is the
   * spreadsheet reader and would reject it with a parse error.
   */
  const routeFile = React.useCallback(
    (file: File) => {
      if (file.type.startsWith('image/')) {
        onImage(file);
        return;
      }
      onFile(file);
    },
    [onFile, onImage],
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center">
        <h3 className="text-lg font-semibold">Import your customers</h3>
        <p className="text-sm text-muted-foreground">
          Don&apos;t worry about formatting. Give Zeneva whatever you already have.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) routeFile(file);
        }}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40',
        )}
      >
        <UploadCloud className={cn('h-9 w-9', dragging ? 'text-primary' : 'text-muted-foreground')} />
        <p className="text-sm font-medium">Drop anything here</p>
        <p className="text-xs text-muted-foreground">Spreadsheet or photo — Zeneva works out which</p>
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          accept=".csv,.tsv,.txt,.xlsx,.xlsm,image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so re-picking the same file fires `change` again — otherwise a
            // failed import cannot be retried with the same file.
            e.target.value = '';
            if (file) routeFile(file);
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TILES.map((tile) => (
          <button
            key={tile.source}
            type="button"
            onClick={() => {
              // The spreadsheet tile has no panel of its own — the file input *is* the
              // interaction — so it opens the picker directly. Routing it through
              // `onPick` reads as a dead tile: nothing to show, and the press appears
              // to do nothing at all.
              if (tile.source === 'spreadsheet') {
                fileRef.current?.click();
                return;
              }
              onPick(tile.source);
            }}
            className="group flex flex-col items-start gap-1.5 rounded-lg border bg-card p-3 text-start transition-colors hover:border-primary/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <tile.icon className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium leading-tight">{tile.label}</span>
            <span className="text-xs leading-tight text-muted-foreground">{tile.hint}</span>
            {tile.usesAi ? (
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                <Sparkles className="h-2.5 w-2.5" /> Uses AI
              </span>
            ) : (
              <span className="mt-0.5 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Free
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Zeneva checks every row against the customers you already have, so nothing gets duplicated.
        {creditsLeft != null && (
          <>
            {' '}
            <span className="font-medium">{creditsLeft.toLocaleString()} AI credits left.</span>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Paste a list.
 *
 * Free, and the placeholder says so by showing a tab-separated shape rather than
 * prose. Somebody who pastes prose here still gets a useful result — `parseTabular`
 * falls back and, below its confidence bar, the AI reader is offered on the next
 * screen rather than a bad guess being imported.
 */
export function CustomerPastePanel({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = React.useState('');

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Paste your customer list</h3>
        <p className="text-sm text-muted-foreground">
          Copy the rows out of Excel, Sheets or a WhatsApp message and paste them here. Free, however
          many there are.
        </p>
      </div>
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        className="font-mono text-xs"
        placeholder={'Musa Ibrahim\t08031234567\tmusa@example.com\nAda Okeke\t08098765432\nChinedu Obi\t07011122233'}
      />
      <div className="flex justify-end">
        <Button type="button" disabled={!text.trim()} onClick={() => onSubmit(text)}>
          Read this
        </Button>
      </div>
    </div>
  );
}

/**
 * Type them out.
 *
 * The example in the placeholder carries a phone number, a tag and a name that is
 * plainly a person, because the model is asked never to invent a contact detail and
 * the example should not imply it will fill one in.
 */
export function CustomerTextPanel({
  onSubmit,
  creditsLeft,
}: {
  onSubmit: (text: string) => void;
  creditsLeft: number | null;
}) {
  const [text, setText] = React.useState('');
  const quote = estimateCredits('parse-customer-text', countLines(text));

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Type out your customers</h3>
        <p className="text-sm text-muted-foreground">
          Write them however you like — one per line, or in a sentence. Zeneva works out who is who.
        </p>
      </div>
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={
          'Musa Ibrahim, 0803 123 4567, wholesale\nAda Okeke on 08098765432\nChinedu Obi — buys every Friday, no phone yet'
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
          About {quote} credit{quote === 1 ? '' : 's'}
          {creditsLeft != null ? ` — you have ${creditsLeft.toLocaleString()}` : ''}
        </p>
        <Button type="button" disabled={!text.trim()} onClick={() => onSubmit(text)}>
          Read this
        </Button>
      </div>
    </div>
  );
}

/**
 * Photograph a page.
 *
 * `capture="environment"` opens the rear camera on a phone straight away, which is
 * the whole point on the shop floor. On desktop it is ignored and the file picker
 * opens, which is also right — that is where a scanned page lives.
 *
 * The guidance is specific about *one page at a time* because a photo of a whole open
 * notebook halves the resolution of each page, and handwriting is exactly where that
 * matters: an unreadable digit means the phone number is dropped entirely rather than
 * guessed.
 */
export function CustomerPhotoPanel({
  onSubmit,
  creditsLeft,
  initialFile,
}: {
  onSubmit: (file: File) => void;
  creditsLeft: number | null;
  initialFile?: File | null;
}) {
  const [file, setFile] = React.useState<File | null>(initialFile ?? null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    // Revoked on change, or the dialog leaks a blob per retaken photo — and people
    // retake these several times when a page comes out blurry.
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const quote = estimateCredits('parse-customer-photo');

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Photograph your customer book</h3>
        <p className="text-sm text-muted-foreground">
          A ledger page, a visitors&apos; book, or a printed list. One page at a time, as straight and
          bright as you can manage — Zeneva leaves out any number it cannot read clearly rather than
          guessing at it.
        </p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob URL; next/image cannot take one
          <img src={preview} alt="The page you photographed" className="max-h-56 rounded-lg object-contain" />
        ) : (
          <>
            <Camera className="h-9 w-9 text-muted-foreground" />
            <p className="text-sm font-medium">Take a photo, or choose one</p>
          </>
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
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
          About {quote} credits
          {creditsLeft != null ? ` — you have ${creditsLeft.toLocaleString()}` : ''}
        </p>
        <div className="flex gap-2">
          {file && (
            <Button type="button" variant="outline" onClick={() => setFile(null)}>
              Retake
            </Button>
          )}
          <Button type="button" disabled={!file} onClick={() => file && onSubmit(file)}>
            Read this page
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Which sheet, when a workbook has more than one with rows in it. */
export function CustomerSheetPicker({
  sheets,
  onChoose,
}: {
  sheets: { label?: string; rows: string[][] }[];
  onChoose: (index: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Which sheet holds your customers?</h3>
        <p className="text-sm text-muted-foreground">
          That file has more than one sheet with data in it.
        </p>
      </div>
      <div className="space-y-2">
        {sheets.map((sheet, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onChoose(index)}
            className="flex w-full items-center justify-between rounded-lg border bg-card p-3 text-start transition-colors hover:border-primary/60 hover:bg-muted/50"
          >
            <span className="text-sm font-medium">{sheet.label || `Sheet ${index + 1}`}</span>
            <span className="text-xs text-muted-foreground">
              {sheet.rows.length.toLocaleString()} row{sheet.rows.length === 1 ? '' : 's'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lines with something on them — what the text quote scales on. */
function countLines(text: string): number {
  return text.split('\n').filter((line) => line.trim()).length;
}
