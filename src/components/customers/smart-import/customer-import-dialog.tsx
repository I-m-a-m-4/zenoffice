'use client';

/**
 * The customer importer dialog.
 *
 * Deliberately thin: every decision lives in `use-customer-import.ts` and every screen
 * is its own component, so this file only routes between them.
 *
 * The overlay portal and `modal={false}` are copied from the product importer on
 * purpose — the app's Radix setup needs both for a dialog this tall to scroll
 * correctly, and "fixing" it to a normal modal reintroduces a trapped-scroll bug on
 * the phones this runs on.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Loader2, PartyPopper, Sparkles, TriangleAlert, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCustomerImport, type CustomerImportSource } from './use-customer-import';
import {
  CustomerSourcePicker,
  CustomerPastePanel,
  CustomerPhotoPanel,
  CustomerTextPanel,
  CustomerSheetPicker,
} from './input-panels';
import { CustomerMappingReview, CustomerReviewStep } from './review';

export default function CustomerImportDialog({
  isOpen,
  onOpenChange,
  onSuccess,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const importer = useCustomerImport(() => {
    onSuccess();
    // Left open on the done screen rather than closing on commit: the queue drains in
    // the background, and closing immediately makes a large import look like it did
    // nothing at all. The owner closes it once they have read the summary.
  });

  /** Which input panel is showing, before any data exists. `null` = the picker. */
  const [picked, setPicked] = React.useState<CustomerImportSource | null>(null);
  /** A photo dropped on the picker, handed to the photo panel when it mounts. */
  const [handoff, setHandoff] = React.useState<File | null>(null);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const close = (open: boolean) => {
    if (!open) {
      importer.reset();
      setPicked(null);
      setHandoff(null);
    }
    onOpenChange(open);
  };

  const backToPicker = () => {
    importer.reset();
    setPicked(null);
    setHandoff(null);
  };

  const { stage } = importer;
  const showBack = stage !== 'committing' && stage !== 'done' && (picked !== null || stage !== 'pick');

  return (
    <>
      {mounted && isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] animate-in fade-in-0"
            onClick={() => close(false)}
          />,
          document.body,
        )}

      <Dialog open={isOpen} onOpenChange={close} modal={false}>
        <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-3xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {showBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ms-2 h-7 w-7"
                  onClick={backToPicker}
                  aria-label="Start over"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <Users className="h-4 w-4 text-primary" />
              Add customers to Zeneva
            </DialogTitle>
            <DialogDescription>
              {stage === 'review'
                ? 'Check what Zeneva understood. Nothing is saved until you press Import.'
                : 'A spreadsheet, a paste, a photo of your book, or just type them out.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-0.5">
            {importer.error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="min-w-0 flex-1">{importer.error}</p>
                <button
                  type="button"
                  onClick={() => importer.setError(null)}
                  className="text-xs underline underline-offset-2"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/*
             * The customer book is still arriving.
             *
             * Blocked rather than allowed through, because duplicate detection matches
             * against the book and an unloaded book is an empty one — which reports
             * every row as new and creates exactly the duplicates this dialog exists to
             * prevent. `allCustomersUnfiltered` distinguishes "not yet" (`null`) from
             * "none" (`[]`), so this waits on the former and proceeds on the latter.
             */}
            {!importer.bookLoaded && stage === 'pick' && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Loading your customers…</p>
                <p className="max-w-sm text-center text-xs text-muted-foreground">
                  Zeneva checks every row against the customers you already have, so it needs your
                  list first.
                </p>
              </div>
            )}

            {importer.bookLoaded && stage === 'pick' && picked === null && (
              <CustomerSourcePicker
                creditsLeft={importer.creditsLeft}
                onPick={(source) => setPicked(source)}
                onFile={importer.loadFile}
                onImage={(file) => {
                  setHandoff(file);
                  setPicked('photo');
                }}
              />
            )}

            {importer.bookLoaded && stage === 'pick' && picked === 'paste' && (
              <CustomerPastePanel onSubmit={importer.loadPaste} />
            )}

            {importer.bookLoaded && stage === 'pick' && picked === 'text' && (
              <CustomerTextPanel onSubmit={importer.loadText} creditsLeft={importer.creditsLeft} />
            )}

            {importer.bookLoaded && stage === 'pick' && picked === 'photo' && (
              <CustomerPhotoPanel
                onSubmit={importer.loadImage}
                creditsLeft={importer.creditsLeft}
                initialFile={handoff}
              />
            )}

            {stage === 'reading' && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">{importer.busy ?? 'Working…'}</p>
                <p className="max-w-sm text-center text-xs text-muted-foreground">
                  You will see every row before anything is saved.
                </p>
              </div>
            )}

            {/* ── The sheet choice sits inside the map stage ── */}
            {stage === 'map' && importer.sheets.length > 0 && (
              <CustomerSheetPicker sheets={importer.sheets} onChoose={importer.chooseSheet} />
            )}

            {stage === 'map' && importer.sheets.length === 0 && importer.mapping && (
              <CustomerMappingReview
                table={importer.table}
                mapping={importer.mapping}
                busy={importer.busy}
                quote={importer.mappingQuote}
                creditsLeft={importer.creditsLeft}
                onChange={importer.changeMapping}
                onRunAi={importer.runAiMapping}
                onContinue={importer.proceedToReview}
              />
            )}

            {stage === 'review' && (
              <CustomerReviewStep
                rows={importer.rows}
                plan={importer.plan}
                openQuestions={importer.openQuestions}
                skippedRows={importer.skippedRows}
                notes={importer.notes}
                busy={importer.busy}
                onDecide={importer.decideRow}
                onEdit={importer.editDraft}
                onRemove={importer.removeRow}
                onCommit={importer.commit}
              />
            )}

            {stage === 'committing' && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Saving your customers…</p>
              </div>
            )}

            {stage === 'done' && (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                <PartyPopper className="h-10 w-10 text-primary" />
                <p className="text-base font-semibold">Your customer list is updated</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {importer.committed.created > 0 &&
                    `${importer.committed.created.toLocaleString()} new customer${importer.committed.created === 1 ? '' : 's'}. `}
                  {importer.committed.updated > 0 &&
                    `${importer.committed.updated.toLocaleString()} updated. `}
                  Anything queued while you were offline will sync by itself.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" onClick={backToPicker}>
                    Import more
                  </Button>
                  <Button onClick={() => close(false)}>Done</Button>
                </div>
              </div>
            )}
          </div>

          {stage === 'pick' && picked === null && importer.bookLoaded && (
            <p className="shrink-0 border-t pt-3 text-center text-xs text-muted-foreground">
              <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
              Excel, CSV and pasted lists are free, however many rows. Only photos and typed
              descriptions use AI credits.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
