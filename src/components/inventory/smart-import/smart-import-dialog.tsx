'use client';

/**
 * The smart importer dialog.
 *
 * Deliberately thin: every decision lives in `use-smart-import.ts` and every screen is
 * its own component, so this file only routes between them. That matters because the
 * importer has seven entry points and five stages, and any logic that leaks in here
 * ends up duplicated per source.
 *
 * The overlay portal and `modal={false}` are copied from the old `import-dialog.tsx`
 * on purpose — the app's Radix setup needs them for a dialog this tall to scroll
 * correctly, and "fixing" it to a normal modal reintroduces a trapped-scroll bug.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Loader2, PartyPopper, Sparkles, TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSmartImport } from './use-smart-import';
import SourcePicker from './source-picker';
import MappingReview from './mapping-review';
import ReviewStep from './review-step';
import { DesktopPanel, PastePanel, PhotoPanel, SheetPicker, TextPanel } from './input-panels';
import { estimateCredits } from '@/lib/import/pricing';
import type { ImportSource } from '@/lib/import/types';
import { FeatureGateUpgradeCard } from '@/components/shared/feature-gate';
import { Sparkles as SparklesIcon } from 'lucide-react';
import { track } from '@vercel/analytics';
import { usePOS } from '@/context/pos-context';
import { useFirestore, useUser } from '@/firebase';
import { logImportTelemetry } from '@/lib/import/telemetry';

export default function SmartImportDialog({
  isOpen,
  onOpenChange,
  onSuccess,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { business } = usePOS();
  const { user } = useUser();
  const firestore = useFirestore();

  const importer = useSmartImport(() => {
    onSuccess();
    // Left open on the done screen rather than closing immediately: the queue drains
    // in the background and closing on commit makes a large import look like it did
    // nothing. The owner closes it when they have read the summary.
  });

  /** Track any import interaction with complete merchant context */
  const trackImport = React.useCallback((
    action: string,
    extra?: { source?: string; fileName?: string; fileSize?: number; fileType?: string; metadata?: Record<string, any> }
  ) => {
    logImportTelemetry(firestore, {
      userId: user?.uid || 'anonymous',
      userEmail: user?.email || '',
      userName: user?.displayName || '',
      businessId: business?.id || '',
      businessName: business?.name || '',
      action,
      ...extra,
    });
  }, [firestore, user, business]);

  /** Which input panel is showing, before any data exists. `null` = the picker. */
  const [picked, setPicked] = React.useState<ImportSource | null>(null);
  /** A file dropped on the picker that belongs to a panel not yet mounted. */
  const [handoff, setHandoff] = React.useState<File | null>(null);

  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Track when the import modal is opened by a user
  React.useEffect(() => {
    if (isOpen) {
      trackImport('opened_modal');
    }
  }, [isOpen, trackImport]);

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
        <DialogContent 
          className="flex max-h-[92vh] flex-col sm:max-w-4xl"
          onInteractOutside={(e) => {
            if (showUpgradeModal) {
              e.preventDefault();
            }
          }}
        >
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
              <Sparkles className="h-4 w-4 text-primary" />
              Add stock to Zeneva
            </DialogTitle>
            <DialogDescription>
              {stage === 'review'
                ? 'Check what Zeneva understood. Nothing is saved until you press Import.'
                : 'Excel, a photo, a paste, an invoice or a sentence — Zeneva will organise it.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-0.5">
            {importer.error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p>{importer.error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => importer.setError(null)}
                  className="text-xs underline underline-offset-2"
                >
                  Dismiss
                </button>
              </div>
            )}

            {stage === 'reading' && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">{importer.busy ?? 'Working…'}</p>
                <p className="max-w-sm text-center text-xs text-muted-foreground">
                  Zeneva is turning this into products. You will see everything before it saves.
                </p>
              </div>
            )}

            {stage === 'committing' && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Saving to your inventory…</p>
              </div>
            )}

            {stage === 'done' && (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                <PartyPopper className="h-10 w-10 text-primary" />
                <p className="text-base font-semibold">Your inventory is updated</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {importer.plan.create.length > 0 &&
                    `${importer.plan.create.length.toLocaleString()} new product${importer.plan.create.length === 1 ? '' : 's'}. `}
                  {importer.plan.addStock.length + importer.plan.overwrite.length > 0 &&
                    `${(importer.plan.addStock.length + importer.plan.overwrite.length).toLocaleString()} updated. `}
                  Anything queued while you were offline will sync by itself.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" onClick={backToPicker}>
                    Import something else
                  </Button>
                  <Button onClick={() => close(false)}>Done</Button>
                </div>
              </div>
            )}

            {/* ── Sheet choice sits inside the map stage ── */}
            {stage === 'map' && importer.sheets.length > 0 && (
              <SheetPicker sheets={importer.sheets} onChoose={importer.chooseSheet} />
            )}

            {stage === 'map' && importer.sheets.length === 0 && importer.table && importer.mapping && (
              <MappingReview
                table={importer.table}
                mapping={importer.mapping}
                busy={importer.busy}
                quote={importer.mappingQuote}
                creditsLeft={importer.creditsLeft}
                rowCount={importer.table.rows.length}
                onChange={importer.changeMapping}
                onRunAi={importer.runAiMapping}
                onContinue={importer.proceedToReview}
              />
            )}

            {stage === 'review' && (
              <ReviewStep
                rows={importer.rows}
                intent={importer.intent}
                plan={importer.plan}
                openQuestions={importer.openQuestions}
                duplicateWarnings={importer.duplicateWarnings}
                skippedRows={importer.skippedRows}
                notes={importer.notes}
                busy={importer.busy}
                matchQuote={importer.matchQuote}
                creditsLeft={importer.creditsLeft}
                currencySymbol={importer.currencySymbol}
                limitMessage={importer.limitCheck.ok ? null : importer.limitCheck.message}
                onIntentChange={importer.changeIntent}
                onDecide={importer.decideRow}
                onEdit={importer.editDraft}
                onRemove={importer.removeRow}
                onRunAiMatching={importer.runAiMatching}
                onCommit={() => {
                  if (!importer.limitCheck.ok) {
                    setShowUpgradeModal(true);
                  } else {
                    trackImport('committed_import', {
                      metadata: {
                        created: importer.plan.create.length,
                        updated: importer.plan.addStock.length + importer.plan.overwrite.length,
                      },
                    });
                    importer.commit();
                  }
                }}
              />
            )}

            {stage === 'pick' && picked === null && (
              <SourcePicker
                creditsLeft={importer.creditsLeft}
                onDropzoneClick={() => {
                  trackImport('clicked_dropzone', { source: 'dropzone' });
                }}
                onPick={(source) => {
                  trackImport('selected_source', { source });

                  if (source === 'barcode') {
                    // The scanner lives on the Inventory page and already searches the
                    // catalogue. Sending people there beats a second scanner here that
                    // would not know what is already in stock.
                    importer.setError(
                      'Use the Scan button on the Inventory page — it looks the barcode up first, and only brings you here if it is a new product.',
                    );
                    return;
                  }
                  setPicked(source);
                }}
                onFile={(file) => {
                  trackImport('file_dropped', {
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    source: 'spreadsheet',
                  });

                  importer.loadFile(file);
                }}
                onImage={(file) => {
                  trackImport('image_dropped', {
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    source: 'photo',
                  });

                  setHandoff(file);
                  setPicked('photo');
                }}
              />
            )}

            {stage === 'pick' && picked === 'paste' && (
              <PastePanel
                busy={importer.busy}
                aiQuote={estimateCredits('parse-text', 100)}
                onSubmit={importer.loadPaste}
                onAiRead={importer.loadText}
              />
            )}

            {stage === 'pick' && picked === 'text' && (
              <TextPanel
                busy={importer.busy}
                quote={estimateCredits('parse-text', 10)}
                creditsLeft={importer.creditsLeft}
                onSubmit={importer.loadText}
              />
            )}

            {stage === 'pick' && (picked === 'photo' || picked === 'invoice') && (
              <PhotoPanel
                kind={picked}
                busy={importer.busy}
                pendingFile={handoff}
                onSwitchKind={setPicked}
                quote={estimateCredits(picked === 'invoice' ? 'parse-invoice' : 'parse-photo', 20)}
                creditsLeft={importer.creditsLeft}
                onSubmit={importer.loadImage}
              />
            )}

            {stage === 'pick' && picked === 'desktop' && (
              <DesktopPanel busy={importer.busy} onDone={importer.loadCaptured} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="max-w-lg p-0 border-none bg-transparent shadow-none">
          <DialogTitle className="sr-only">Upgrade to Pro</DialogTitle>
          <FeatureGateUpgradeCard 
            featureName="Bulk Product Import"
            featureDescription="Import hundreds of products, categories, and stock counts at once with our smart scanner."
            requiredPlan="pro"
            icon={SparklesIcon}
            currency={importer.currencySymbol === '₦' ? 'NGN' : 'USD'}
            featurePoints={[
              { title: "Increase Product Limits", description: "Expand your catalogue capacity beyond the Starter limit." },
              { title: "Bulk Smart Import", description: "Upload unlimited rows from Excel, photos, invoices or text." },
              { title: "Sync Everywhere", description: "Updated stock instantly propagates to your till and team." }
            ]}
            onUpgradeClick={() => setShowUpgradeModal(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
