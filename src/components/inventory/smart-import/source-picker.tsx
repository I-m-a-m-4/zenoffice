'use client';

/**
 * The source picker — the first thing the owner sees.
 *
 * The premise of the whole importer is on this screen: inventory software normally
 * expects a business to already have clean data, and almost none of them do. So this
 * does not ask for a file in a particular format. It asks for whatever they have,
 * and takes on the work of making sense of it.
 *
 * The tiles are ordered by how many shops can actually use them, not by how clever
 * they are. A spreadsheet and a paste come first because that is what most people
 * have; the photograph is the one that sells the feature but it is third, because
 * leading with it tells a shop with a perfectly good Excel file that they need AI
 * when they do not.
 *
 * Every tile says whether it costs credits, **before** it is pressed.
 */

import * as React from 'react';
import {
  Camera,
  ClipboardPaste,
  FileSpreadsheet,
  MessageSquareText,
  Monitor,
  Receipt,
  ScanLine,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeApp, isMobileApp } from '@/lib/platform';
import type { ImportSource } from '@/lib/import/types';

type Tile = {
  source: ImportSource;
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
    label: 'Paste data',
    hint: 'From Excel, Sheets or WhatsApp',
    usesAi: false,
  },
  {
    source: 'photo',
    icon: Camera,
    label: 'Photo of your stock',
    hint: 'Point at the shelf',
    usesAi: true,
  },
  {
    source: 'invoice',
    icon: Receipt,
    label: 'Supplier invoice',
    hint: 'Photograph the waybill',
    usesAi: true,
  },
  {
    source: 'text',
    icon: MessageSquareText,
    label: 'Just describe it',
    hint: '"20 cartons of Indomie at ₦12,000"',
    usesAi: true,
  },
  {
    source: 'desktop',
    icon: Monitor,
    label: 'Another program',
    hint: 'Pull it out of your old software',
    usesAi: false,
  },
  {
    source: 'barcode',
    icon: ScanLine,
    label: 'Scan barcodes',
    hint: 'One product at a time',
    usesAi: false,
  },
];

export default function SourcePicker({
  onPick,
  onFile,
  onImage,
  onDropzoneClick,
  creditsLeft,
}: {
  onPick: (source: ImportSource) => void;
  onFile: (file: File) => void;
  onImage: (file: File) => void;
  onDropzoneClick?: () => void;
  creditsLeft: number | null;
}) {
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  /**
   * Route a dropped file by what it is, not by which tile was pressed.
   *
   * Somebody who drops a photograph onto the drop zone means "read this photo", and
   * making them go back and press the right tile first is exactly the friction this
   * screen exists to remove.
   *
   * An image goes to `onImage`, which opens the photo panel with the file already
   * loaded — a shelf photo and an invoice photo need different prompts and cannot be
   * told apart from the file itself, so that one ambiguity is worth a single tap. It
   * must NOT go to `onFile`, which is the spreadsheet reader and would reject it.
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

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) routeFile(file);
  };

  // Barcode scanning needs a camera, and the desktop-capture flow needs another
  // window to alt-tab to. Hiding what cannot work beats a tile that fails politely.
  const tiles = TILES.filter((tile) => {
    if (tile.source === 'desktop') return isNativeApp() && !isMobileApp();
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center">
        <h3 className="text-lg font-semibold">Import your inventory</h3>
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
        onDrop={onDrop}
        onClick={() => {
          onDropzoneClick?.();
          fileRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onDropzoneClick?.();
            fileRef.current?.click();
          }
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/40',
        )}
      >
        <UploadCloud className={cn('h-9 w-9', dragging ? 'text-primary' : 'text-muted-foreground')} />
        <p className="text-sm font-medium">Drop anything here</p>
        <p className="text-xs text-muted-foreground">
          Spreadsheet, photo or invoice — Zeneva works out which
        </p>
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((tile) => (
          <button
            key={tile.source}
            type="button"
            onClick={() => {
              // Always record telemetry on which method the merchant clicked
              onPick(tile.source);

              // The spreadsheet tile triggers file picker immediately
              if (tile.source === 'spreadsheet') {
                fileRef.current?.click();
                return;
              }
            }}
            className="group relative flex flex-col items-start gap-1.5 rounded-lg border bg-card p-3 text-start transition-colors hover:border-primary/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        Zeneva will organise it for you — you check it before anything is saved.
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
