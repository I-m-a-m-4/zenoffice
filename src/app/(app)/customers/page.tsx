
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, User, Upload, ChevronRight, Loader2, Trash2, Award, ChevronLeft, Pencil, ChevronDown, Download, Tag as TagIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Customer } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import AddCustomerDialog from '@/components/customers/add-customer-dialog';
import EditCustomerDialog from '@/components/customers/edit-customer-dialog';
import { usePOS } from '@/context/pos-context';
import { useI18n } from '@/context/i18n-context';
import { useFirestore } from '@/firebase';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import CustomerImportDialog from '@/components/customers/smart-import/customer-import-dialog';
import { useRouter } from 'next/navigation';
import { useBranch } from '@/context/branch-context';
import NProgress from 'nprogress';
import { logAuditEvent } from '@/lib/audit';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerAnalyticsTab } from '@/components/customers/customer-analytics-tab';
import { cn } from '@/lib/utils';
import { downloadCsv } from '@/lib/csv';
import CustomerHealthPanel, { type HealthFilter } from '@/components/customers/customer-health-panel';
import {
  computeCustomerHealth,
  buildMergePlan,
  normalizeCode,
  type DuplicateGroup,
} from '@/lib/customer-health';
import {
  computeCustomerSegments,
  FILTERABLE_SEGMENTS,
  SEGMENT_HINTS,
  SEGMENT_LABELS,
  type SegmentKey,
} from '@/lib/customer-segments';

function CustomerRowSkeleton() {
  return (
    <TableRow>
      <TableCell className="w-12"><Skeleton className="h-4 w-4" /></TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 w-full">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Skeleton className="h-5 w-full" />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Skeleton className="h-5 w-full" />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Skeleton className="h-5 w-full" />
      </TableCell>
      <TableCell className="text-end">
        <Skeleton className="h-5 w-1/2 ms-auto" />
      </TableCell>
      <TableCell className="text-end">
        <Skeleton className="h-8 w-8 ms-auto rounded-md" />
      </TableCell>
    </TableRow>
  )
}

const CUSTOMERS_PER_PAGE_WEB = 500;
const CUSTOMERS_PER_PAGE_NATIVE = 100000;

/**
 * Rows rendered at once.
 *
 * `CUSTOMERS_PER_PAGE_WEB` / `_NATIVE` above and the `itemsPerPage` derived from
 * them were dead — computed and never referenced, with `ChevronLeft` imported and
 * never rendered — so every matched customer was rendered on one page. Customers
 * sync in full and uncapped, so a 3,000-customer shop was mounting 3,000 rows.
 * This is the page size that is actually applied.
 */
const PAGE_SIZE = 50;

/** Visual treatment per segment. Owing and lapsed are the ones that cost money. */
const SEGMENT_STYLE: Record<SegmentKey, string> = {
  owing: 'border-destructive/40 text-destructive',
  lapsed: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  'at-risk': 'border-amber-500/30 text-amber-600 dark:text-amber-400',
  vip: 'border-primary/40 text-primary',
  loyal: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  new: 'border-sky-500/40 text-sky-600 dark:text-sky-400',
  'never-seen': 'border-muted-foreground/30 text-muted-foreground',
};

export default function CustomersPage() {
  const [mounted, setMounted] = React.useState(false);
  const [isNative, setIsNative] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setIsNative(typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__);
  }, []);

  const itemsPerPage = isNative ? CUSTOMERS_PER_PAGE_NATIVE : CUSTOMERS_PER_PAGE_WEB;
  const { 
    customers, 
    receipts,
    isLoading: isPosLoading, 
    business, 
    currentUserProfile: currentUser, 
    triggerRefresh, 
    isFullSyncingCustomers,
    searchCustomers,
    allCustomersUnfiltered,
    addToQueue
  } = usePOS();
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useI18n();
  const firestore = useFirestore();
  const { isMultiBranchEnabled } = useBranch();

  const [isAddCustomerOpen, setIsAddCustomerOpen] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = React.useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [customerToEdit, setCustomerToEdit] = React.useState<Customer | null>(null);
  const [activeTab, setActiveTab] = React.useState<'all' | 'health' | 'analytics'>('all');
  const [healthFilter, setHealthFilter] = React.useState<HealthFilter>('all');
  const [isFixingHealth, setIsFixingHealth] = React.useState(false);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'recent' | 'spent' | 'loyalty' | 'name'>('spent');
  const [searchedCustomers, setSearchedCustomers] = React.useState<Customer[] | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [segmentFilter, setSegmentFilter] = React.useState<SegmentKey | 'all'>('all');
  const [tagFilter, setTagFilter] = React.useState<string>('all');
  const [page, setPage] = React.useState(0);

  /**
   * The clock, held in state and re-armed at local midnight.
   *
   * Every segment here is a statement about *days since* something. A till that
   * stays open for days would otherwise keep classifying against the day it was
   * opened, so "at risk" would silently stop advancing — the same trap
   * `docs/business-rating.md` records for its `today`.
   */
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 30);
    const timer = setTimeout(() => setNow(new Date()), midnight.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [now]);

  // Customers are fetched and branch-filtered by pos-context (via `customers`).
  // We do NOT run a separate Firestore query here as it would bypass branch filtering.

  const [isDataLoaded, setIsDataLoaded] = React.useState(false);
  


  // Always use the branch-filtered customers from POS context
  const displayCustomers = customers;
  
  const isLoading = isNative 
    ? (isPosLoading && (!customers || customers.length === 0))
    : isPosLoading;

  // Prevent flicker of "No Customers Found"
  React.useEffect(() => {
    if (isNative && customers && customers.length > 0) {
      setIsDataLoaded(true);
      return;
    }
    if (!isPosLoading && displayCustomers !== null) {
      // Small delay to ensure any background syncs have a chance to start
      const timer = setTimeout(() => setIsDataLoaded(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isPosLoading, displayCustomers, isNative, customers]);

  // Global Search Logic
  React.useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchCustomers(searchTerm);
        setSearchedCustomers(results);
      } catch (err) {
        console.error("Global search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, searchCustomers]);

  /**
   * Segments and per-customer money, computed once for the whole list.
   *
   * The Debt column used to filter the entire receipt array *inside* the row
   * `.map()` — O(customers × receipts) on every single render. This does the same
   * work once and looks the answer up per row.
   *
   * Note the Debt column now counts **unpaid and pending**, matching the "Owing"
   * segment, the invoices page and the overdue-credit notification rule. It
   * previously counted `unpaid` only, which meant a row could show no debt while
   * being tagged as owing.
   */
  const segmentData = React.useMemo(
    () => computeCustomerSegments({ customers: displayCustomers, receipts, now }),
    [displayCustomers, receipts, now],
  );

  /**
   * The integrity report, over the **whole** customer book.
   *
   * `allCustomersUnfiltered` and not `displayCustomers`, for two reasons the
   * context's own comment spells out: branch filtering hides exactly the
   * customers the "no branch" check is looking for, and two records for one
   * person sitting in two branches are still one duplicate worth merging.
   *
   * `now` is threaded through even though no check uses it yet — the module takes
   * it as an input so that the first time-based check anybody adds cannot quietly
   * start reading the clock. Same reason the segments memo above takes it.
   */
  const healthReport = React.useMemo(
    () => computeCustomerHealth(allCustomersUnfiltered ?? null, {
      isMultiBranch: isMultiBranchEnabled,
      now: now.getTime(),
    }),
    [allCustomersUnfiltered, isMultiBranchEnabled, now],
  );

  /** Every code in use, so a suggested replacement cannot collide with one. */
  const codesInUse = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of allCustomersUnfiltered || []) {
      const code = normalizeCode(c.code);
      if (code) set.add(code);
    }
    return set;
  }, [allCustomersUnfiltered]);

  /**
   * Merge a duplicate group: one update, then a delete per retired record.
   *
   * Everything goes through `addToQueue`, never a direct `updateDoc`. It is the
   * only thing that enforces RBAC, injects the active branch, survives being
   * offline and updates the SQLite mirror — the same rule Zen AI's proposals
   * follow. `update-customer` and `delete-customer` both have real cases in the
   * queue's commit switch, which is worth checking before adding an action type
   * (`update-settings` does not, and silently retries forever).
   *
   * Order matters: the update lands before the deletes, so if the queue drains
   * halfway the surviving record already carries the merged totals. The other way
   * round loses the money.
   */
  const handleMergeGroup = React.useCallback(async (group: DuplicateGroup) => {
    const plan = buildMergePlan(group.members);
    if (!plan) return;

    setIsFixingHealth(true);
    try {
      await addToQueue(
        { type: 'update-customer', payload: { id: plan.primaryId, values: plan.values } },
        plan.summary,
      );

      for (const id of plan.duplicateIds) {
        await addToQueue(
          { type: 'delete-customer', payload: { id } },
          `Removed duplicate customer record`,
        );
      }

      if (business && currentUser) {
        const primary = group.members.find(m => m.id === plan.primaryId);
        logAuditEvent(firestore, business.id, currentUser, {
          action: 'customer.merge',
          entity: { type: 'Customer', id: plan.primaryId, name: primary?.name },
          details: {
            matchedOn: group.kind,
            mergedIds: plan.duplicateIds,
            mergedCount: plan.duplicateIds.length,
            totalSpentAfter: plan.values.totalSpent,
            loyaltyPointsAfter: plan.values.loyaltyPoints,
          },
        }).catch(() => {
          // An audit write must never block the merge the user asked for.
        });
      }

      toast({
        variant: 'success',
        title: 'Customers merged',
        description: `${plan.duplicateIds.length} duplicate record${plan.duplicateIds.length === 1 ? '' : 's'} removed. Spend and points were kept.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Merge failed',
        description: 'Nothing was changed. Please try again.',
      });
    } finally {
      setIsFixingHealth(false);
    }
  }, [addToQueue, business, currentUser, firestore, toast]);

  /** Resolve a code collision by giving one record a free code. */
  const handleRecode = React.useCallback(async (customer: Customer, newCode: string) => {
    setIsFixingHealth(true);
    try {
      await addToQueue(
        { type: 'update-customer', payload: { id: customer.id, values: { code: newCode } } },
        `Changed customer code for ${customer.name || 'customer'} to ${newCode}`,
      );
      toast({
        variant: 'success',
        title: 'Code changed',
        description: `${customer.name || 'That customer'} is now ${newCode}.`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not change the code', description: 'Please try again.' });
    } finally {
      setIsFixingHealth(false);
    }
  }, [addToQueue, toast]);

  /** Every tag in use, for the filter. Sorted so the control is stable. */
  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of displayCustomers || []) {
      for (const tag of c.tags || []) {
        const trimmed = String(tag).trim();
        if (trimmed) set.add(trimmed);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [displayCustomers]);

  const filtered = React.useMemo(() => {
    const receiptTotals: Record<string, number> = {};
    if (receipts) {
      receipts.forEach(r => {
        if (r.customer?.id) {
          receiptTotals[r.customer.id] = (receiptTotals[r.customer.id] || 0) + (Number(r.total) || 0);
        }
      });
    }

    /*
     * On the Health tab the table lists the flagged records, and it has to draw
     * from the *unfiltered* book to do that honestly. Branch filtering removes a
     * customer with no `branchId` from every specific branch's view, so filtering
     * first and then flagging would hide exactly the rows the "no branch" check
     * exists to surface. Integrity is a property of the business, not of a branch.
     */
    const source = activeTab === 'health'
      ? (allCustomersUnfiltered || [])
      : (displayCustomers || []);

    let base = [...source].map(c => {
      const fromReceipts = receiptTotals[c.id] || 0;
      return {
        ...c,
        computedTotalSpent: Math.max(Number(c.totalSpent) || 0, fromReceipts)
      };
    });

    // Combine with remote search results
    if (searchedCustomers && searchedCustomers.length > 0) {
      searchedCustomers.forEach(rc => {
        if (!base.find(bc => bc.id === rc.id)) {
          const fromReceipts = receiptTotals[rc.id] || 0;
          base.push({
            ...rc,
            computedTotalSpent: Math.max(Number(rc.totalSpent) || 0, fromReceipts)
          } as any);
        }
      });
    }

    let filtered = searchTerm.trim()
      ? base.filter(c =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone?.includes(searchTerm) ||
          c.code?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : base;

    if (segmentFilter !== 'all') {
      filtered = filtered.filter(c =>
        segmentData.byCustomerId.get(c.id)?.segments.includes(segmentFilter),
      );
    }

    if (tagFilter !== 'all') {
      filtered = filtered.filter(c => (c.tags || []).some(tg => String(tg).trim() === tagFilter));
    }

    /*
     * Health filtering. Reads the same `issuesByCustomer` map the tiles are
     * counted from, so a tile that says 4 and a table that lists 7 cannot happen
     * — the mismatch the Inventory Health tab's comment warns about.
     *
     * The "Likely duplicates" tile covers three kinds at once (phone, email,
     * name), because to a shopkeeper they are one idea: this looks like the same
     * person twice.
     */
    if (activeTab === 'health' && healthReport) {
      filtered = filtered.filter(c => {
        const issues = healthReport.issuesByCustomer.get(c.id);
        if (!issues || issues.length === 0) return false;
        if (healthFilter === 'all') return true;
        if (healthFilter === 'duplicate-phone') {
          return issues.some(i => i === 'duplicate-phone' || i === 'duplicate-email' || i === 'duplicate-name');
        }
        return issues.includes(healthFilter);
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'spent') {
        return (Number((b as any).computedTotalSpent) || 0) - (Number((a as any).computedTotalSpent) || 0);
      }
      if (sortBy === 'loyalty') {
        return (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0);
      }
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      // default: recent (createdAt)
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return Number(dateB) - Number(dateA);
    });

    return filtered;
  }, [searchTerm, displayCustomers, allCustomersUnfiltered, sortBy, searchedCustomers, receipts, segmentFilter, tagFilter, segmentData, activeTab, healthFilter, healthReport]);

  // Switching tab or health filter changes what is listed, so the page has to
  // reset with it — same reason as the filters below.
  React.useEffect(() => {
    setPage(0);
  }, [activeTab, healthFilter]);

  // Any change to what is being filtered has to reset the page, or a narrowed
  // result set leaves the reader stranded on a page that no longer exists.
  React.useEffect(() => {
    setPage(0);
  }, [searchTerm, segmentFilter, tagFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = React.useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage],
  );

  const currencySymbol = React.useMemo(() => {
    const code = business?.settings?.currency || 'NGN';
    return CURRENCY_SYMBOLS[code] || '₦';
  }, [business]);

  /**
   * Select-all is scoped to the visible page, not the whole filtered set.
   *
   * The only bulk action here is delete. With the list paginated, a control that
   * ticks 3,000 unseen rows from a header above 50 visible ones is a way to lose a
   * customer book by accident.
   */
  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedCustomerIds(prev => [...new Set([...prev, ...visible.map(c => c.id)])]);
    } else {
      const onPage = new Set(visible.map(c => c.id));
      setSelectedCustomerIds(prev => prev.filter(id => !onPage.has(id)));
    }
  };

  const handleRowSelect = (customerId: string) => {
    setSelectedCustomerIds(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  /**
   * Export what is on screen — the current filter and sort, not the whole book.
   *
   * Exporting everything regardless of the active filter is the more surprising
   * behaviour: someone who has just filtered to "lapsed" wants the lapsed list.
   * The header row says which filter produced the file.
   */
  const handleExportCsv = () => {
    const rows: (string | number)[][] = [
      [
        'Name',
        'Email',
        'Phone',
        'Code',
        'Segments',
        'Tags',
        'Orders (observed)',
        `Total spent (${currencySymbol})`,
        `Outstanding (${currencySymbol})`,
        'Loyalty points',
        'Last purchase',
        'Days since last purchase',
        'Notes',
      ],
    ];

    for (const c of filtered) {
      const m = segmentData.byCustomerId.get(c.id);
      rows.push([
        c.name || '',
        c.email || '',
        c.phone || '',
        c.code || '',
        (m?.segments || []).map(s => SEGMENT_LABELS[s]).join('; '),
        (c.tags || []).join('; '),
        m?.orders ?? 0,
        Math.round(Number((c as any).computedTotalSpent) || 0),
        Math.round(m?.outstanding ?? 0),
        c.loyaltyPoints ?? 0,
        m?.lastSeen ? m.lastSeen.toISOString().slice(0, 10) : '',
        m?.daysSinceLastPurchase ?? '',
        c.notes || '',
      ]);
    }

    rows.push([]);
    rows.push([
      'Filter',
      segmentFilter === 'all' ? 'All customers' : SEGMENT_LABELS[segmentFilter],
      'Tag',
      tagFilter === 'all' ? 'All tags' : tagFilter,
      'Search',
      searchTerm || '(none)',
    ]);
    rows.push([
      'Note',
      `Orders and outstanding are counted from the ${segmentData.summary.receiptCount} sales held on this device, covering ${segmentData.summary.coveredDays} days. Outstanding is a floor, not a total.`,
    ]);

    downloadCsv(`zeneva-customers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast({ variant: 'success', title: 'Customers exported', description: `${filtered.length} rows saved.` });
  };

  /**
   * Bulk delete, routed through the offline queue.
   *
   * This used to `writeBatch` straight to Firestore, which skipped every guarantee
   * `addToQueue` provides: the RBAC check, branch scoping, surviving an offline
   * moment, the SQLite mirror update, and the `stats.totalCustomers` decrement that
   * the `delete-customer` handler already performs. That handler existed and was
   * fully implemented — nothing in the UI had ever called it.
   */
  const handleBulkDelete = async () => {
    if (selectedCustomerIds.length === 0 || !business || !currentUser) {
      toast({ title: t('toast.error'), description: t('customers.deleteFailedSession'), variant: 'destructive' });
      return;
    }

    const targets = selectedCustomerIds
      .map(id => displayCustomers?.find(c => c.id === id))
      .filter((c): c is Customer => !!c);

    try {
      for (const customer of targets) {
        await addToQueue({
          type: 'delete-customer',
          payload: { id: customer.id, name: customer.name, email: customer.email },
        } as any);
      }

      // Audit stays a direct write: it is append-only, has its own rule, and a
      // failed log must not roll back a delete the owner already confirmed.
      if (firestore) {
        await Promise.all(
          targets.map(customer =>
            logAuditEvent(firestore, business.id, currentUser, {
              action: 'customer.delete',
              entity: { type: 'Customer', id: customer.id, name: customer.name },
              details: { customerName: customer.name, customerEmail: customer.email }
            }).catch(() => undefined)
          )
        );
      }

      toast({
        variant: 'success',
        title: t('customers.deletedTitle'),
        description: t('customers.deletedDescription', { count: targets.length }),
      });
      setSelectedCustomerIds([]);
      triggerRefresh();
    } catch (e) {
      toast({ variant: 'destructive', title: t('toast.error'), description: t('customers.deleteFailed') });
    }
    setIsDeleteDialogOpen(false);
  };

  if (!mounted) return null;

  return (
    <>
      {/*
        * Tabs above the card, mirroring the Inventory page's All / Health split so
        * the two pages behave the same way. The dot is the only badge — a count
        * here would compete with the tiles inside the tab that already carry it.
        */}
      <div className="w-full mb-4">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'all' | 'health' | 'analytics')} className="w-full md:max-w-lg">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All customers</TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-1.5">
              Health
              {!!healthReport && healthReport.affected > 0 && (
                <span className="flex h-2 w-2 rounded-full bg-red-500" />
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1.5">
              Analytics
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'analytics' && (
        <CustomerAnalyticsTab
          customers={displayCustomers || []}
          receipts={receipts || []}
          currencySymbol={currencySymbol}
          segmentData={segmentData}
          businessName={business?.name || 'Zeneva Store'}
        />
      )}

      {activeTab === 'health' && (
        <div className="mb-6">
          {/*
            * `null` means the book is still arriving — keep a skeleton up rather
            * than drawing "no issues found" over a list that has not loaded. The
            * empty-vs-pending distinction the POS learned the hard way.
            */}
          {healthReport === null ? (
            <div className="space-y-4" role="status" aria-busy="true">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <CustomerHealthPanel
              report={healthReport}
              currencySymbol={currencySymbol}
              activeFilter={healthFilter}
              onFilterChange={setHealthFilter}
              onMerge={handleMergeGroup}
              onRecode={handleRecode}
              codesInUse={codesInUse}
              busy={isFixingHealth}
            />
          )}
        </div>
      )}

      {activeTab !== 'analytics' && (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {t('customers.title')}
                {isFullSyncingCustomers && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </CardTitle>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2">
                <div className="relative w-full max-w-sm group">
                  <User className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder={t('customers.searchNameEmailCode')}
                    className="ps-8 pe-8 ring-offset-background focus-visible:ring-primary"
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  />
                  {isSearching && (
                    <div className="absolute end-2.5 top-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-between font-normal bg-background">
                      <span>
                        {sortBy === 'spent'
                          ? t('customers.sortBiggestSpender')
                          : sortBy === 'loyalty'
                            ? t('customers.sortTopLoyalty')
                            : sortBy === 'name'
                              ? t('customers.sortName')
                              : t('customers.sortMostRecent')}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 ms-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[180px]">
                    <DropdownMenuItem onClick={() => setSortBy('spent')}>{t('customers.sortBiggestSpender')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('loyalty')}>{t('customers.sortTopLoyalty')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('name')}>{t('customers.sortName')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('recent')}>{t('customers.sortMostRecent')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Select value={segmentFilter} onValueChange={v => setSegmentFilter(v as SegmentKey | 'all')}>
                  <SelectTrigger className="w-[190px] bg-background font-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All customers</SelectItem>
                    {FILTERABLE_SEGMENTS.map(key => (
                      <SelectItem key={key} value={key}>
                        <span className="flex w-full items-center justify-between gap-3">
                          <span>{SEGMENT_LABELS[key]}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {segmentData.summary.counts[key]}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {allTags.length > 0 && (
                  <Select value={tagFilter} onValueChange={setTagFilter}>
                    <SelectTrigger className="w-[160px] bg-background font-normal">
                      <SelectValue placeholder="All tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tags</SelectItem>
                      {allTags.map(tg => (
                        <SelectItem key={tg} value={tg}>{tg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {segmentFilter !== 'all' && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {SEGMENT_HINTS[segmentFilter]}
                  {(segmentFilter === 'never-seen' || segmentFilter === 'lapsed') &&
                    !segmentData.summary.reliable && (
                      <>
                        {' '}
                        <span className="text-amber-600 dark:text-amber-400">
                          Based on the {segmentData.summary.receiptCount} most recent sales, which
                          cover only {segmentData.summary.coveredDays} days — someone here may
                          simply have bought longer ago than that.
                        </span>
                      </>
                    )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const visibleSelectedCount = selectedCustomerIds.filter(id => filtered.some(c => c.id === id)).length;
                return visibleSelectedCount > 0 && (
                  <Button variant="destructive" size="sm" className="h-8 gap-1" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      {t('customers.deleteSelected', { count: visibleSelectedCount })}
                    </span>
                  </Button>
                );
              })()}

              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleExportCsv} disabled={filtered.length === 0}>
                <Download className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Export
                </span>
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setIsImportOpen(true)}>
                <Upload className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  {t('common.import')}
                </span>
              </Button>
              <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddCustomerOpen(true)}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  {t('customers.addCustomer')}
                </span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"><Checkbox disabled /></TableHead>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('customers.codeCol')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('common.phone')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('customers.loyaltyPoints')}</TableHead>
                  <TableHead className="text-end">{t('customers.totalSpent')}</TableHead>
                  <TableHead className="text-end text-destructive">{t('customers.debtCol')}</TableHead>
                  <TableHead><span className="sr-only">{t('common.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <CustomerRowSkeleton />
                <CustomerRowSkeleton />
                <CustomerRowSkeleton />
              </TableBody>
            </Table>
          ) : !isDataLoaded ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"><Checkbox disabled /></TableHead>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('customers.codeCol')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('common.phone')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('customers.loyaltyPoints')}</TableHead>
                  <TableHead className="text-end">{t('customers.totalSpent')}</TableHead>
                  <TableHead className="text-end text-destructive">{t('customers.debtCol')}</TableHead>
                  <TableHead><span className="sr-only">{t('common.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <CustomerRowSkeleton />
                <CustomerRowSkeleton />
                <CustomerRowSkeleton />
              </TableBody>
            </Table>
          ) : filtered && filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        visible.length > 0 && visible.every(c => selectedCustomerIds.includes(c.id))
                          ? true
                          : visible.some(c => selectedCustomerIds.includes(c.id))
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('customers.codeCol')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('common.phone')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Award className="h-4 w-4" />
                      {t('customers.loyaltyPoints')}
                    </div>
                  </TableHead>
                  <TableHead className="text-end">{t('customers.totalSpent')}</TableHead>
                  <TableHead className="text-end text-destructive">{t('customers.debtCol')}</TableHead>
                  <TableHead><span className="sr-only">{t('common.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((customer) => {
                  const totalSpent = (customer as any).computedTotalSpent ?? customer.totalSpent ?? 0;
                  const metrics = segmentData.byCustomerId.get(customer.id);
                  const debt = metrics?.outstanding ?? 0;
                  const badge = metrics?.primarySegment ?? null;
                  const tags = customer.tags || [];
                  return (
                    <TableRow 
                      key={customer.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button, input')) return;
                        NProgress.start(); 
                        router.push(`/customers/details?id=${customer.id}`); 
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedCustomerIds.includes(customer.id)}
                          onCheckedChange={() => handleRowSelect(customer.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{customer.name}</span>
                          {badge && badge !== 'never-seen' && (
                            <Badge
                              variant="outline"
                              className={cn('px-1.5 py-0 text-[10px] font-medium', SEGMENT_STYLE[badge])}
                            >
                              {SEGMENT_LABELS[badge]}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{customer.email}</div>
                        {tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <TagIcon className="h-3 w-3 text-muted-foreground" />
                            {tags.slice(0, 3).map(tg => (
                              <span
                                key={tg}
                                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {tg}
                              </span>
                            ))}
                            {tags.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {customer.code ? (
                          <span className="font-mono text-xs font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{customer.code}</span>
                        ) : t('customers.notAvailable')}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{customer.phone || t('customers.notAvailable')}</TableCell>
                      <TableCell className="hidden md:table-cell">{customer.loyaltyPoints || 0}</TableCell>
                      <TableCell className="text-end">{currencySymbol}{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-end text-destructive font-bold">
                        {debt > 0 ? `${currencySymbol}${debt.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCustomerToEdit(customer)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { NProgress.start(); router.push(`/customers/details?id=${customer.id}`); }}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 border-2 border-dashed rounded-lg">
              <User className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-xl font-semibold mt-4">{t('customers.noneFound')}</h3>
              <p className="text-muted-foreground mt-2 mb-4">
                {searchTerm ? t('customers.noneFoundSearch') : t('customers.noneFoundHint')}
              </p>
              {!searchTerm && (
                <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddCustomerOpen(true)}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    {t('customers.addCustomer')}
                  </span>
                </Button>
              )}
            </div>
          )}
        </CardContent>
        {filtered && filtered.length > 0 && (
          <CardFooter className="flex flex-col border-t py-4 gap-4">
            <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{t('customers.matched', { count: filtered.length })}</span>
                {pageCount > 1 && (
                  <span>
                    · showing {safePage * PAGE_SIZE + 1}–
                    {Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(searchTerm || segmentFilter !== 'all' || tagFilter !== 'all') && (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      setSearchTerm('');
                      setSegmentFilter('all');
                      setTagFilter('all');
                    }}
                  >
                    {t('customers.clearFilters')}
                  </Button>
                )}
                {pageCount > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={safePage === 0}
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-1 tabular-nums">
                      {safePage + 1} / {pageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Background Sync & Deep Retrieval Bridge */}
            {isFullSyncingCustomers && (
              <div className="flex flex-col items-center justify-center pt-4 border-t w-full space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {t('customers.syncingCatalog')}
                </div>
              </div>
            )}
          </CardFooter>
        )}
      </Card>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('customers.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('customers.deleteConfirmBody', { count: selectedCustomerIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {currentUser?.businessId && (
        <AddCustomerDialog
          isOpen={isAddCustomerOpen}
          onOpenChange={setIsAddCustomerOpen}
          businessId={currentUser.businessId}
          customers={displayCustomers}
        />
      )}
      {currentUser?.businessId && (
        <CustomerImportDialog
          isOpen={isImportOpen}
          onOpenChange={setIsImportOpen}
          onSuccess={() => {
            // The dialog stays open on its own summary screen; it triggers a refresh
            // itself, so this only needs to close the *page's* notion of the flow when
            // the owner dismisses it.
            triggerRefresh();
          }}
        />
      )}
      <EditCustomerDialog
        isOpen={!!customerToEdit}
        onOpenChange={(open) => !open && setCustomerToEdit(null)}
        customer={customerToEdit}
      />
    </>
  );
}
