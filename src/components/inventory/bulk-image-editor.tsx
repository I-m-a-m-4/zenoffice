'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  ImageOff,
  Sparkles,
  Lock,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product } from '@/types';
import { toast } from '@/hooks/use-toast';

export interface WebProductImage {
  id: string;
  title?: string;
  urls: { regular: string; full: string; small: string };
  alt_description: string;
  user: { name: string; links: { html: string } };
}

interface ProductImageCandidate {
  product: Product;
  status: 'idle' | 'fetching' | 'ready' | 'error' | 'approved' | 'rejected' | 'saving' | 'saved';
  images: WebProductImage[];
  selectedIdx: number;
  errorMsg?: string;
}

interface BulkImageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[]; // products without images
  onSave: (updates: { productId: string; imageUrl: string; imageFile: File }[]) => Promise<void>;
  /** Max products for free tier. Pass Infinity for pro. */
  freeTierLimit?: number;
  isPro?: boolean;
}

const FREE_TIER_LIMIT = 10;

export function BulkImageEditor({
  open,
  onOpenChange,
  products,
  onSave,
  freeTierLimit = FREE_TIER_LIMIT,
  isPro = false
}: BulkImageEditorProps) {
  const limit = isPro ? products.length : Math.min(products.length, freeTierLimit);
  const cappedProducts = products.slice(0, limit);
  const isLimited = !isPro && products.length > freeTierLimit;

  const [candidates, setCandidates] = useState<ProductImageCandidate[]>(() =>
    cappedProducts.map(p => ({
      product: p,
      status: 'idle',
      images: [],
      selectedIdx: 0
    }))
  );

  const [phase, setPhase] = useState<'fetch' | 'review' | 'saving' | 'done'>('fetch');
  const [fetchProgress, setFetchProgress] = useState(0);
  const [saveProgress, setSaveProgress] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      const capped = products.slice(0, isPro ? products.length : freeTierLimit);
      setCandidates(
        capped.map(p => ({ product: p, status: 'idle', images: [], selectedIdx: 0 }))
      );
      setPhase('fetch');
      setFetchProgress(0);
      setSaveProgress(0);
      setIsFetching(false);
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchAll = useCallback(async () => {
    setIsFetching(true);
    setPhase('fetch');

    // Mark all as fetching
    setCandidates(prev => prev.map(c => ({ ...c, status: 'fetching' })));

    const results: ProductImageCandidate[] = [...candidates];
    let done = 0;

    for (let i = 0; i < results.length; i++) {
      const candidate = results[i];
      try {
        const res = await fetch(
          `/api/images/search?q=${encodeURIComponent(candidate.product.name)}&limit=6`,
          { signal: AbortSignal.timeout(8000) }
        );
        const data = await res.json();
        const imgs: WebProductImage[] = data.results || [];
        results[i] = {
          ...candidate,
          status: imgs.length > 0 ? 'ready' : 'error',
          images: imgs,
          selectedIdx: 0,
          errorMsg: imgs.length === 0 ? 'No images found' : undefined
        };
      } catch (err) {
        results[i] = {
          ...candidate,
          status: 'error',
          images: [],
          selectedIdx: 0,
          errorMsg: 'Search failed'
        };
      }

      done++;
      setFetchProgress(Math.round((done / results.length) * 100));
      setCandidates([...results]);
    }

    setIsFetching(false);
    setPhase('review');
    // Auto-approve all that found images
    setCandidates(prev =>
      prev.map(c => ({
        ...c,
        status: c.images.length > 0 ? 'approved' : 'error'
      }))
    );
  }, [candidates]);

  const updateCandidate = (idx: number, patch: Partial<ProductImageCandidate>) => {
    setCandidates(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const approvedCount = candidates.filter(c => c.status === 'approved').length;
  const savedCount = candidates.filter(c => c.status === 'saved').length;

  const handleSave = async () => {
    const toSave = candidates.filter(c => c.status === 'approved' && c.images.length > 0);
    if (toSave.length === 0) {
      toast({ title: 'No images to save', description: 'Approve at least one image to continue.' });
      return;
    }

    setIsSaving(true);
    setPhase('saving');
    setSaveProgress(0);

    const updates: { productId: string; imageUrl: string; imageFile: File }[] = [];
    let done = 0;

    for (const candidate of toSave) {
      const image = candidate.images[candidate.selectedIdx];
      if (!image) { done++; continue; }

      try {
        // Download via proxy
        const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(image.urls.regular)}&fallback=${encodeURIComponent(image.urls.small)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error('Proxy failed');
        const blob = await res.blob();
        const file = new File([blob], `product-${candidate.product.id}.jpg`, {
          type: blob.type || 'image/jpeg'
        });

        updates.push({
          productId: candidate.product.id,
          imageUrl: image.urls.regular,
          imageFile: file
        });

        updateCandidate(
          candidates.findIndex(c => c.product.id === candidate.product.id),
          { status: 'saved' }
        );
      } catch {
        updateCandidate(
          candidates.findIndex(c => c.product.id === candidate.product.id),
          { status: 'error', errorMsg: 'Download failed' }
        );
      }

      done++;
      setSaveProgress(Math.round((done / toSave.length) * 100));
    }

    try {
      await onSave(updates);
      setPhase('done');
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Could not save images. Please try again.' });
      setPhase('review');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isFetching && !isSaving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[900px] w-[95vw] flex flex-col max-h-[90vh] p-4 sm:p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            Bulk Image Fetch
            {isLimited && (
              <Badge variant="outline" className="ml-2 text-[11px] font-medium border-amber-500/50 text-amber-600">
                <Lock className="h-3 w-3 mr-1" />
                Free: {freeTierLimit} of {products.length}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {phase === 'fetch' && !isFetching &&
              `Automatically find images for ${cappedProducts.length} product${cappedProducts.length !== 1 ? 's' : ''} without images. Review and approve before saving.`}
            {phase === 'fetch' && isFetching &&
              `Searching for product images... ${fetchProgress}% complete`}
            {phase === 'review' &&
              `Review the suggested images. Toggle approved/rejected for each product, then click Save.`}
            {phase === 'saving' &&
              `Downloading and saving approved images... ${saveProgress}% complete`}
            {phase === 'done' &&
              `${savedCount} image${savedCount !== 1 ? 's' : ''} saved successfully!`}
          </DialogDescription>
        </DialogHeader>

        {/* Pro upgrade notice */}
        {isLimited && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
            <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                Free plan: {freeTierLimit} products at a time
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upgrade to Pro to bulk-update all {products.length} products in one go.
              </p>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {(isFetching || isSaving) && (
          <div className="space-y-1.5">
            <Progress value={isFetching ? fetchProgress : saveProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {isFetching ? `Searching: ${fetchProgress}%` : `Saving: ${saveProgress}%`}
            </p>
          </div>
        )}

        {/* Phase: Fetch — initial prompt */}
        {phase === 'fetch' && !isFetching && (
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <div className="p-4 rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-base">Ready to fetch images</p>
              <p className="text-sm text-muted-foreground mt-1">
                We'll search for product images for each of your {cappedProducts.length} products using their names.
              </p>
            </div>
            <Button onClick={fetchAll} size="lg" className="gap-2 px-8">
              <Sparkles className="h-4 w-4" />
              Start Fetching
            </Button>
          </div>
        )}

        {/* Phase: Fetch — in progress */}
        {phase === 'fetch' && isFetching && (
          <div className="flex-1 min-h-0 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-1">
              {candidates.map((c) => (
                <div key={c.product.id} className={cn(
                  "rounded-lg border p-3 flex flex-col items-center gap-2 text-center transition-all",
                  c.status === 'ready' || c.status === 'approved' ? "border-green-500/40 bg-green-50/50 dark:bg-green-950/20" :
                  c.status === 'error' ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/20" :
                  "border-border bg-muted/30"
                )}>
                  <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center overflow-hidden relative">
                    {(c.status === 'ready' || c.status === 'approved') && c.images[0] ? (
                      <Image src={c.images[0].urls.small} alt={c.product.name} fill style={{ objectFit: 'cover' }} unoptimized className="rounded-md" />
                    ) : c.status === 'error' ? (
                      <AlertCircle className="h-6 w-6 text-red-400" />
                    ) : c.status === 'fetching' ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <ImageOff className="h-5 w-5 text-muted-foreground opacity-40" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium line-clamp-2 text-foreground">{c.product.name}</p>
                  {c.status === 'ready' || c.status === 'approved' ? (
                    <Badge className="text-[10px] bg-green-500/15 text-green-700 border-green-500/30">Found</Badge>
                  ) : c.status === 'error' ? (
                    <Badge variant="destructive" className="text-[10px]">Not found</Badge>
                  ) : c.status === 'fetching' ? (
                    <Badge variant="secondary" className="text-[10px]">Searching...</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase: Review */}
        {(phase === 'review' || phase === 'saving' || phase === 'done') && (
          <div className="flex-1 min-h-0 max-h-[54vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-1">
              {candidates.map((c, idx) => {
                const selectedImg = c.images[c.selectedIdx];
                const isApproved = c.status === 'approved';
                const isRejected = c.status === 'rejected';
                const isSaved = c.status === 'saved';
                const isErr = c.status === 'error';

                return (
                  <div
                    key={c.product.id}
                    className={cn(
                      "rounded-xl border-2 overflow-hidden transition-all",
                      isSaved ? "border-green-500 bg-green-50/40 dark:bg-green-950/20" :
                      isApproved ? "border-primary/70 bg-primary/5" :
                      isRejected ? "border-border/30 opacity-50" :
                      isErr ? "border-red-300 bg-red-50/30 dark:bg-red-950/10" :
                      "border-border"
                    )}
                  >
                    {/* Image Preview */}
                    <div className="relative h-36 bg-white/80 dark:bg-muted/30 flex items-center justify-center overflow-hidden">
                      {selectedImg ? (
                        <Image
                          src={selectedImg.urls.small}
                          alt={c.product.name}
                          fill
                          style={{ objectFit: 'contain' }}
                          unoptimized
                          className="p-2"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImageOff className="h-8 w-8 opacity-30" />
                          <span className="text-[11px]">{c.errorMsg || 'No images found'}</span>
                        </div>
                      )}

                      {/* Status overlay */}
                      {isSaved && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <div className="bg-green-500 text-white rounded-full p-2">
                            <CheckCircle2 className="h-6 w-6" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info + Controls */}
                    <div className="p-2.5 space-y-2">
                      <p className="text-xs font-semibold line-clamp-1" title={c.product.name}>
                        {c.product.name}
                      </p>

                      {/* Image Navigation */}
                      {c.images.length > 1 && !isSaved && (
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            disabled={c.selectedIdx === 0}
                            onClick={() => updateCandidate(idx, { selectedIdx: Math.max(0, c.selectedIdx - 1) })}
                            className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-[10px] text-muted-foreground">
                            {c.selectedIdx + 1} / {c.images.length}
                          </span>
                          <button
                            type="button"
                            disabled={c.selectedIdx >= c.images.length - 1}
                            onClick={() => updateCandidate(idx, { selectedIdx: Math.min(c.images.length - 1, c.selectedIdx + 1) })}
                            className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Approve / Reject toggle */}
                      {!isSaved && c.images.length > 0 && (
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={isApproved ? 'default' : 'outline'}
                            className={cn("flex-1 h-7 text-[11px] gap-1", isApproved && "bg-primary text-primary-foreground")}
                            onClick={() => updateCandidate(idx, { status: 'approved' })}
                            disabled={isSaving}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Use
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={isRejected ? 'destructive' : 'outline'}
                            className="flex-1 h-7 text-[11px] gap-1"
                            onClick={() => updateCandidate(idx, { status: 'rejected' })}
                            disabled={isSaving}
                          >
                            <XCircle className="h-3 w-3" /> Skip
                          </Button>
                        </div>
                      )}

                      {isSaved && (
                        <p className="text-[11px] text-green-600 font-medium text-center">✓ Saved</p>
                      )}

                      {isErr && !isSaving && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-[11px] gap-1"
                          onClick={async () => {
                            updateCandidate(idx, { status: 'fetching' });
                            try {
                              const res = await fetch(`/api/images/search?q=${encodeURIComponent(c.product.name)}&limit=6`);
                              const data = await res.json();
                              const imgs = data.results || [];
                              updateCandidate(idx, {
                                status: imgs.length > 0 ? 'approved' : 'error',
                                images: imgs,
                                selectedIdx: 0,
                                errorMsg: imgs.length === 0 ? 'No images found' : undefined
                              });
                            } catch {
                              updateCandidate(idx, { status: 'error', errorMsg: 'Search failed' });
                            }
                          }}
                        >
                          <RefreshCw className="h-3 w-3" /> Retry
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {phase === 'review' && (
              <>
                <Badge variant="outline" className="text-[11px]">
                  {approvedCount} approved
                </Badge>
                <Badge variant="secondary" className="text-[11px]">
                  {candidates.filter(c => c.status === 'rejected').length} skipped
                </Badge>
                <Badge variant="destructive" className="text-[11px] bg-destructive/10 text-destructive border-destructive/30">
                  {candidates.filter(c => c.status === 'error').length} failed
                </Badge>
              </>
            )}
            {phase === 'done' && (
              <span className="text-green-600 font-medium">
                ✓ {savedCount} images applied successfully
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {phase === 'done' ? (
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isFetching || isSaving}
                >
                  Cancel
                </Button>

                {phase === 'review' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={fetchAll}
                      disabled={isFetching || isSaving}
                      className="gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Re-fetch All
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving || approvedCount === 0}
                      className="gap-2"
                    >
                      {isSaving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4" /> Save {approvedCount} Image{approvedCount !== 1 ? 's' : ''}</>
                      )}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
