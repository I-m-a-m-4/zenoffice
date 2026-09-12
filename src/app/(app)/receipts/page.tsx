
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye, Inbox, MoreHorizontal, Trash2, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore } from '@/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import type { Receipt } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { usePOS } from '@/context/pos-context';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import React from "react";
import { createPortal } from 'react-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import RefreshButton from "@/components/shared/refresh-button";
import { logAuditEvent } from '@/lib/audit';
import { safeToDate } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';
import { Checkbox } from "@/components/ui/checkbox";

function ReceiptRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
      <TableCell className="text-end"><Skeleton className="h-5 w-1/2 ms-auto" /></TableCell>
      <TableCell className="text-end"><Skeleton className="h-8 w-8 rounded-md ms-auto" /></TableCell>
    </TableRow>
  )
}

export default function ReceiptsPage() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ReceiptsContent />
    </Suspense>
  );
}

function ReceiptsContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const customerId = searchParams.get('customerId');

  const {
    receipts,
    isLoading: isPosLoading,
    business,
    currentUserProfile: currentUser,
    currencySymbol,
    triggerRefresh,
    searchReceipts,
    fetchMoreReceipts,
    voidReceipt
  } = usePOS();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useI18n();

  const [searchTerm, setSearchTerm] = React.useState(initialSearch);
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [receiptToDelete, setReceiptToDelete] = React.useState<Receipt | null>(null);
  const [selectedReceipts, setSelectedReceipts] = React.useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isBulkVoidDialogOpen, setIsBulkVoidDialogOpen] = React.useState(false);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(receipts ? receipts.length >= 50 : true);

  // Clear selection if receipts change
  React.useEffect(() => {
    setSelectedReceipts(new Set());
  }, [receipts]);

  // Update hasMore if receipts change
  React.useEffect(() => {
    if (receipts && receipts.length < 50) {
      setHasMore(false);
    }
  }, [receipts]);

  const displayedReceipts = React.useMemo(() => {
    if (!receipts) return [];
    let filtered = receipts.filter(r => r && r.paymentMethod !== 'Invoice');

    if (customerId) {
      filtered = filtered.filter(r => r.customer?.id === customerId);
    } else if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(r => {
        const receiptId = r.id || '';
        const rNumber = r.receiptNumber || `rec-${receiptId.substring(0, 8)}`;

        return rNumber.toLowerCase().includes(lower) ||
          receiptId.toLowerCase().includes(lower) ||
          (r.customer?.name || '').toLowerCase().includes(lower) ||
          (r.paymentMethod || '').toLowerCase().includes(lower) ||
          (r.total || 0).toString().includes(lower);
      });
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(r => {
        const date = safeToDate(r.createdAt);
        return date >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => {
        const date = safeToDate(r.createdAt);
        return date <= end;
      });
    }

    return filtered;
  }, [receipts, searchTerm, customerId, startDate, endDate]);

  const handleLoadMore = async () => {
    setIsFetchingMore(true);
    const count = await fetchMoreReceipts();
    if (count === 0) setHasMore(false);
    setIsFetchingMore(false);
  };

  const safeFormatDate = (val: any) => {
    if (!val) return 'N/A';
    const date = safeToDate(val);
    if (date.getTime() === 0) return 'N/A';
    return format(date, 'PP');
  };

  const safeFormatTime = (val: any) => {
    if (!val) return 'N/A';
    const date = safeToDate(val);
    if (date.getTime() === 0) return 'N/A';
    return format(date, 'p');
  };

  const isLoading = receipts === null;

  const handleDeleteReceipt = async () => {
    if (!receiptToDelete || !firestore || !business || !currentUser) return;
    setIsDeleting(true);

    try {
      await runTransaction(firestore, async (transaction) => {
        const receiptRef = doc(firestore, 'receipts', receiptToDelete.id);
        const receiptDoc = await transaction.get(receiptRef);

        if (!receiptDoc.exists()) {
          throw new Error("Receipt not found. It may have already been deleted.");
        }

        const receiptData = receiptDoc.data() as Receipt;

        // 1. Read all necessary documents first
        const productRefs = receiptData.items.map(item => doc(firestore, 'products', item.productId));
        const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        let customerDoc = null;
        if (receiptData.customer?.id && business.settings?.loyaltyProgramEnabled) {
          const customerRef = doc(firestore, 'customers', receiptData.customer.id);
          customerDoc = await transaction.get(customerRef);
        }

        // 2. Perform all write operations
        // 2a. Update product stock
        productDocs.forEach((pDoc, index) => {
          if (pDoc.exists()) {
            const item = receiptData.items[index];
            const newStock = (pDoc.data().stock || 0) + item.quantity;
            transaction.update(pDoc.ref, { stock: newStock });
          }
        });

        // 2b. Revert customer loyalty points
        if (customerDoc && customerDoc.exists()) {
          const pointsPerUnit = business.settings?.pointsPerUnit || 0;
          const pointsEarned = Math.floor(receiptData.total * pointsPerUnit);
          const currentPoints = customerDoc.data()?.loyaltyPoints || 0;
          transaction.update(customerDoc.ref, { loyaltyPoints: Math.max(0, currentPoints - pointsEarned) });
        }

        // 2c. Delete the receipt
        transaction.delete(receiptRef);
      });

      // Log audit event after successful void (Awaiting for reliability)
      //
      // A void deletes the receipt, so this log is the *only* surviving record of
      // the sale. `saleCreatedAt` and `soldBy` are what let the loss-prevention
      // scan tell a cashier cancelling their own sale minutes later — the classic
      // cash skim — apart from a manager correcting someone else's mistake the
      // next day. Nothing can reconstruct either field afterwards.
      await logAuditEvent(firestore, business.id, currentUser, {
        action: 'sale.void',
        entity: { type: 'Receipt', id: receiptToDelete.id, name: `Receipt ${receiptToDelete.id.substring(0, 8)}` },
        details: {
          total: receiptToDelete.total,
          reason: 'Manual void by user',
          saleCreatedAt: safeToDate(receiptToDelete.createdAt).toISOString(),
          soldBy: receiptToDelete.createdBy || undefined,
          receiptNumber: receiptToDelete.receiptNumber || null,
          paymentMethod: receiptToDelete.paymentMethod || null,
          discount: receiptToDelete.discount || 0,
          itemCount: receiptToDelete.items?.length || 0,
          customerId: receiptToDelete.customer?.id || null,
        }
      });

      toast({ title: t('receipts.voidedTitle'), description: t('receipts.voidedDescription', { receipt: receiptToDelete.id.substring(0, 8) }), variant: 'success' });
      await voidReceipt(receiptToDelete.id);
    } catch (e: any) {
      console.error("Failed to void sale:", e);

      // Fallback: Even if the direct online transaction failed (e.g. network error, already deleted, or sync mismatch),
      // we MUST call voidReceipt to clear it from local cache and enqueue the operation for safety.
      await voidReceipt(receiptToDelete.id);

      toast({
        title: t('receipts.offlineVoidTitle'),
        description: t('receipts.offlineVoidDescription'),
        variant: 'default'
      });
    } finally {
      setReceiptToDelete(null);
      setIsDeleting(false);
    }
  };

  const handleBulkVoid = async () => {
    if (selectedReceipts.size === 0 || !firestore || !business || !currentUser) return;
    setIsDeleting(true);

    const idsToVoid = Array.from(selectedReceipts);
    let successCount = 0;
    let offlineCount = 0;

    for (const receiptId of idsToVoid) {
      const receiptToVoid = receipts?.find(r => r.id === receiptId);
      if (!receiptToVoid) continue;

      try {
        await runTransaction(firestore, async (transaction) => {
          const receiptRef = doc(firestore, 'receipts', receiptId);
          const receiptDoc = await transaction.get(receiptRef);

          if (!receiptDoc.exists()) return;

          const receiptData = receiptDoc.data() as Receipt;

          // Read product docs
          const productRefs = receiptData.items.map(item => doc(firestore, 'products', item.productId));
          const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));

          // Read customer doc
          let customerDoc = null;
          if (receiptData.customer?.id && business.settings?.loyaltyProgramEnabled) {
            const customerRef = doc(firestore, 'customers', receiptData.customer.id);
            customerDoc = await transaction.get(customerRef);
          }

          // Update stock
          productDocs.forEach((pDoc, index) => {
            if (pDoc.exists()) {
              const item = receiptData.items[index];
              const newStock = (pDoc.data().stock || 0) + item.quantity;
              transaction.update(pDoc.ref, { stock: newStock });
            }
          });

          // Update loyalty points
          if (customerDoc && customerDoc.exists()) {
            const pointsPerUnit = business.settings?.pointsPerUnit || 0;
            const pointsEarned = Math.floor(receiptData.total * pointsPerUnit);
            const currentPoints = customerDoc.data()?.loyaltyPoints || 0;
            transaction.update(customerDoc.ref, { loyaltyPoints: Math.max(0, currentPoints - pointsEarned) });
          }

          transaction.delete(receiptRef);
        });

        await logAuditEvent(firestore, business.id, currentUser, {
          action: 'sale.void',
          entity: { type: 'Receipt', id: receiptId, name: `Receipt ${receiptId.substring(0, 8)}` },
          details: {
            total: receiptToVoid.total,
            reason: 'Bulk manual void',
            saleCreatedAt: safeToDate(receiptToVoid.createdAt).toISOString(),
            soldBy: receiptToVoid.createdBy || undefined,
            receiptNumber: receiptToVoid.receiptNumber || null,
            paymentMethod: receiptToVoid.paymentMethod || null,
            discount: receiptToVoid.discount || 0,
            itemCount: receiptToVoid.items?.length || 0,
            customerId: receiptToVoid.customer?.id || null,
          }
        });

        await voidReceipt(receiptId);
        successCount++;
      } catch (err) {
        console.warn(`Bulk void offline fallback for ${receiptId}:`, err);
        await voidReceipt(receiptId);
        offlineCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Sales Voided",
        description: `Successfully voided ${successCount} sale(s) and restored inventory.`,
        variant: "success"
      });
    }
    if (offlineCount > 0) {
      toast({
        title: "Offline Voids Queued",
        description: `${offlineCount} sale(s) voided offline. Synchronization will complete when online.`,
        variant: "default"
      });
    }

    setSelectedReceipts(new Set());
    setIsBulkVoidDialogOpen(false);
    setIsDeleting(false);
  };

  const toggleSelectAll = () => {
    if (selectedReceipts.size === displayedReceipts.length) {
      setSelectedReceipts(new Set());
    } else {
      setSelectedReceipts(new Set(displayedReceipts.map(r => r.id)));
    }
  };

  const toggleSelectReceipt = (id: string) => {
    const next = new Set(selectedReceipts);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedReceipts(next);
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <CardTitle>{t('receipts.historyTitle')}</CardTitle>
                <CardDescription>{t('receipts.historyDesc')}</CardDescription>
              </div>
              {selectedReceipts.size > 0 && (currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setIsBulkVoidDialogOpen(true)}
                  className="animate-in fade-in slide-in-from-left-2 duration-200"
                >
                  <Trash2 className="me-2 h-4 w-4" /> Void Selected ({selectedReceipts.size})
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 no-print w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('receipts.searchSales')}
                  className="ps-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="w-full sm:w-auto h-9 text-xs"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-muted-foreground text-xs">{t('receipts.dateTo')}</span>
                <Input
                  type="date"
                  className="w-full sm:w-auto h-9 text-xs"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-xs text-muted-foreground hover:text-foreground h-9 px-2"
                  >
                    {t('receipts.clearDates')}
                  </Button>
                )}
              </div>
              <RefreshButton />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('receipts.receiptIdCol')}</TableHead>
                  <TableHead>{t('pos.customer')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('receipts.timeCol')}</TableHead>
                  <TableHead>{t('receipts.paymentMethodCol')}</TableHead>
                  <TableHead className="text-end">{t('common.total')}</TableHead>
                  <TableHead><span className="sr-only">{t('common.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ReceiptRowSkeleton />
                <ReceiptRowSkeleton />
                <ReceiptRowSkeleton />
                <ReceiptRowSkeleton />
                <ReceiptRowSkeleton />
              </TableBody>
            </Table>
          ) : displayedReceipts && displayedReceipts.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={displayedReceipts.length > 0 && selectedReceipts.size === displayedReceipts.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all receipts"
                        />
                      </TableHead>
                    )}
                    <TableHead>{t('receipts.receiptIdCol')}</TableHead>
                    <TableHead>{t('pos.customer')}</TableHead>
                    <TableHead>{t('common.date')}</TableHead>
                    <TableHead>{t('receipts.timeCol')}</TableHead>
                    <TableHead>{t('receipts.paymentMethodCol')}</TableHead>
                    <TableHead className="text-end">{t('common.total')}</TableHead>
                    <TableHead><span className="sr-only">{t('common.actions')}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedReceipts.map((receipt: Receipt) => (
                    <TableRow
                      key={receipt.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${selectedReceipts.has(receipt.id) ? 'bg-muted/30' : ''}`}
                      onClick={() => router.push(`/receipts/details?id=${receipt.id}`)}
                    >
                      {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedReceipts.has(receipt.id)}
                            onCheckedChange={() => toggleSelectReceipt(receipt.id)}
                            aria-label={`Select receipt ${receipt.receiptNumber || receipt.id}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium font-mono text-xs whitespace-nowrap">
                        {receipt.receiptNumber || `rec-${(receipt.id || '').substring(0, 8)}`}
                      </TableCell>
                      <TableCell>{receipt.customer?.name || t('receipts.walkIn')}</TableCell>
                      <TableCell className="whitespace-nowrap">{safeFormatDate(receipt.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{safeFormatTime(receipt.createdAt)}</TableCell>
                      <TableCell>{receipt.paymentMethod || 'N/A'}</TableCell>
                      <TableCell className="text-end">{currencySymbol}{(receipt.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">{t('receipts.toggleMenu')}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                            <DropdownMenuItem className="cursor-pointer" onSelect={() => router.push(`/receipts/details?id=${receipt.id}`)}>
                              <Eye className="me-2 h-4 w-4" /> {t('receipts.view')}
                            </DropdownMenuItem>
                            {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive cursor-pointer" onSelect={(e) => { e.preventDefault(); setReceiptToDelete(receipt); }}>
                                  <Trash2 className="me-2 h-4 w-4" /> {t('receipts.voidSale')}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!searchTerm && hasMore && (
                <div className="flex justify-center mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isFetchingMore}
                    className="min-w-[200px]"
                  >
                    {isFetchingMore ? (
                      <>
                        <Loader2 className="me-2 h-4 w-4 animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      t('receipts.loadMore')
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 border-2 border-dashed rounded-lg">
              <Inbox className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-xl font-semibold mt-4">{t('receipts.noneFound')}</h3>
              <p className="text-muted-foreground mt-2 mb-4">
                {searchTerm ? t('receipts.noneFoundSearch') : t('receipts.noneFoundHint')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {typeof window !== 'undefined' && !!receiptToDelete && createPortal(
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] transition-opacity animate-in fade-in-0"
          onClick={() => !isDeleting && setReceiptToDelete(null)}
        />,
        document.body
      )}
      <Dialog open={!!receiptToDelete} onOpenChange={(open) => !open && !isDeleting && setReceiptToDelete(null)} modal={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('receipts.voidConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('receipts.voidConfirmBody', {
                receipt: receiptToDelete?.receiptNumber || `rec-${receiptToDelete?.id.substring(0, 8)}`,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptToDelete(null)} disabled={isDeleting}>{t('common.cancel')}</Button>
            <Button onClick={handleDeleteReceipt} disabled={isDeleting} variant="destructive">
              {isDeleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('receipts.voidSale')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkVoidDialogOpen} onOpenChange={(open) => !open && !isDeleting && setIsBulkVoidDialogOpen(false)} modal={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Multiple Sales</DialogTitle>
            <DialogDescription>
              Are you sure you want to void the {selectedReceipts.size} selected sale(s)? 
              This will permanently delete the receipts, restore stock quantities to your inventory, and deduct any earned loyalty points. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkVoidDialogOpen(false)} disabled={isDeleting}>{t('common.cancel')}</Button>
            <Button onClick={handleBulkVoid} disabled={isDeleting} variant="destructive">
              {isDeleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Void All Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
