
'use client';

import * as React from 'react';
import Link from "next/link";
import { useRouter, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';
import {
  File,
  ListFilter,
  MoreHorizontal,
  PlusCircle,
  Inbox,
  Upload,
  Trash2,
  Package,
  PackageOpen,
  Edit,
  Search,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
  Barcode as BarcodeIcon,
  TrendingDown,
  Layers,
  Box,
  Activity,
  ChevronDown,
  Coins,
  Truck,
  PackagePlus,
  Sparkles,
  FileText,
  ImageOff
} from "lucide-react";
import { ReorderInvoiceModal } from '@/components/inventory/reorder-invoice-modal';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CachedImage } from "@/components/shared/cached-image";
import { useFirestore } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, query, where, orderBy, limit, startAfter, onSnapshot, count, getAggregateFromServer, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { Product, UserProfile } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import SmartImportDialog from '@/components/inventory/smart-import/smart-import-dialog';
import CostPriceDialog from '@/components/inventory/cost-price-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import QuickEditDialog from '@/components/inventory/quick-edit-dialog';
import { QuickRestockModal } from '@/components/inventory/quick-restock-modal';
import { usePOS } from '@/context/pos-context';
import { useI18n } from '@/context/i18n-context';
import { useBranch } from '@/context/branch-context';
import { cn, safeToDate } from '@/lib/utils';
import { trackFeature } from '@/lib/product-telemetry';
import Papa from 'papaparse';
import { logAuditEvent } from '@/lib/audit';
import BulkEditDialog from '@/components/inventory/bulk-edit-dialog';
import { BulkImageEditor } from '@/components/inventory/bulk-image-editor';
import BarcodeDialog from '@/components/inventory/barcode-dialog';
import { BarcodeScanner } from '@/components/inventory/barcode-scanner';
import { QrCode } from 'lucide-react';
import { ImageDialog } from "@/components/shared/image-dialog";
import { CatalogUnavailable } from "@/components/shared/catalog-unavailable";
import { InventoryBodySkeleton } from './skeleton';


/**
 * One loading row, matching the real product row cell for cell: checkbox,
 * thumbnail, name over SKU, status badge, price, stock (from `md` up) and the
 * actions menu.
 *
 * `canManageStock` is not cosmetic — the real table omits the price and stock
 * columns for staff who may not see them (see the `TableHead`s below), so a
 * fixed seven cells would draw two columns that never arrive and every bar
 * would land under the wrong heading.
 */
function ProductRowSkeleton({ canManageStock = true }: { canManageStock?: boolean }) {
  return (
    <TableRow>
      <TableCell className="w-12"><Skeleton className="h-4 w-4" /></TableCell>
      <TableCell className="w-16 sm:w-[100px]">
        <Skeleton className="h-12 w-12 sm:h-16 sm:w-16 rounded-md" />
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-full" />
      </TableCell>
      {canManageStock && (
        <TableCell>
          <Skeleton className="h-6 w-full" />
        </TableCell>
      )}
      {canManageStock && (
        <TableCell className="hidden md:table-cell">
          <Skeleton className="h-6 w-full" />
        </TableCell>
      )}
      <TableCell>
        <Skeleton className="h-8 w-8 ms-auto" />
      </TableCell>
    </TableRow>
  )
}

const PRODUCTS_PER_PAGE = 60;

/**
 * The sort the page opens on.
 *
 * Named because `activeFilterCount` has to compare against it. It used to count
 * `sortBy !== 'name'`, so a page nobody had touched reported "Filter 1", and
 * "Clear filters" — which resets to exactly this value — could never clear the
 * badge. Beside an empty product list that reads as "a filter is hiding your
 * stock", which is the wrong thing to be looking at when a catalogue has failed
 * to load.
 */
const DEFAULT_SORT_BY = 'newest' as const;

/**
 * A service has no stock to run out of.
 *
 * Services sit in the same collection as products and carry `stock: 0` because
 * the field is shared, not because there is none left. So every stock-health
 * check has to skip them — counting a haircut as "out of stock" tells the owner
 * to restock something that was never stocked, and buries the products that
 * genuinely did run out.
 *
 * Module-level on purpose: the stock filter, the health tiles and the health
 * table all need the same answer, and this used to be defined inside one memo
 * where the other two could not reach it.
 */
const isService = (p: Product) =>
  p.categoryType === 'service' ||
  p.category?.toLowerCase() === 'service' ||
  p.category?.toLowerCase() === 'services';

export default function InventoryPage() {
    return (
        <React.Suspense fallback={<InventoryBodySkeleton />}>
            <InventoryPageContent />
        </React.Suspense>
    );
}

function InventoryValuation({ products, currencySymbol, canViewCostPrice }: { products: Product[], currencySymbol: string, canViewCostPrice: boolean }) {
  const { t } = useI18n();
  const metrics = React.useMemo(() => {
    let atCost = 0, atRetail = 0, units = 0, missingCost = 0, skus = 0;
    for (const p of products) {
      if (isService(p)) continue; // Skip services for valuation
      const stock = Math.max(0, p.stock ?? 0);
      units += stock;
      atRetail += stock * (p.price ?? 0);
      skus++;
      if (p.costPrice != null) {
        atCost += stock * p.costPrice;
      } else {
        missingCost++;
      }
    }
    return { atCost, atRetail, units, skus, missingCost, potentialProfit: atRetail - atCost };
  }, [products]);

  if (products.length === 0) return null;

  return (
    <Card className="mb-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/10 overflow-hidden shadow-sm">
      <CardHeader className="py-3 px-4 border-b bg-background/50 backdrop-blur-sm flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Inventory Valuation
        </CardTitle>
        {metrics.missingCost > 0 && (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50 gap-1 font-medium">
            <AlertCircle className="h-3 w-3" /> {metrics.missingCost} item(s) missing cost price
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Coins className="h-3 w-3" /> Retail Value</p>
            <p className="text-lg font-bold tracking-tight">{currencySymbol}{metrics.atRetail.toLocaleString()}</p>
          </div>
          {canViewCostPrice && (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Box className="h-3 w-3" /> Cost Value</p>
                <p className="text-lg font-bold tracking-tight">{currencySymbol}{metrics.atCost.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingDown className="h-3 w-3 rotate-180" /> Potential Profit</p>
                <p className="text-lg font-bold tracking-tight text-green-600">{currencySymbol}{metrics.potentialProfit.toLocaleString()}</p>
              </div>
            </>
          )}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Package className="h-3 w-3" /> Units on Hand</p>
            <p className="text-lg font-bold tracking-tight">{metrics.units.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><BarcodeIcon className="h-3 w-3" /> Unique SKUs</p>
            <p className="text-lg font-bold tracking-tight">{metrics.skus.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InventoryPageContent() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useI18n();
  const { activeBranchId } = useBranch();
  const { 
    products, 
    receipts, 
    onlineOrders, 
    optimisticProducts, 
    isLoading: isPosLoading, 
    isSyncing,
    business, 
    currencySymbol, 
    currentUserProfile, 
    triggerRefresh, 
    removeFromQueue, 
    addToQueue,
    searchProducts,
    searchProductsByField,
    fetchMoreProducts,
    queuedActions,
    isImpersonating,
    productSyncError,
    isCatalogUnverified,
    retryProductSync
  } = usePOS();

  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [isCostPriceOpen, setIsCostPriceOpen] = React.useState(false);
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isBulkEditDialogOpen, setIsBulkEditDialogOpen] = React.useState(false);
  const [bulkEditInitialMode, setBulkEditInitialMode] = React.useState<'grid' | 'ai'>('grid');
  const [bulkEditInitialInstruction, setBulkEditInitialInstruction] = React.useState<string>('');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [quickEditProduct, setQuickEditProduct] = React.useState<Product | null>(null);
  const [quickRestockProduct, setQuickRestockProduct] = React.useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = React.useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('all');
  const [healthFilter, setHealthFilter] = React.useState<'all'|'missing-image'|'out-of-stock'|'low-stock'|'negative'|'missing-cost-price'>('all');
  const [analyticsPeriod, setAnalyticsPeriod] = React.useState<'30d' | '90d' | '6m' | '1y' | 'all'>('30d');
  const [isManualSearching, setIsManualSearching] = React.useState(false);
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [previewImage, setPreviewImage] = React.useState<{ src: string, alt: string } | null>(null);
  const [showHealthModal, setShowHealthModal] = React.useState(false);
  const [isReorderInvoiceModalOpen, setIsReorderInvoiceModalOpen] = React.useState(false);
  const [isBulkImageEditorOpen, setIsBulkImageEditorOpen] = React.useState(false);
  const [expandedParentIds, setExpandedParentIds] = React.useState<string[]>([]);

  const toggleExpandParent = (parentId: string) => {
    setExpandedParentIds(prev => 
      prev.includes(parentId) ? prev.filter(id => id !== parentId) : [...prev, parentId]
    );
  };

  const getVariantInfo = React.useCallback((parent: Product) => {
    const isParent = parent.type === 'variant' || (products || []).some(p => p.parentId === parent.id);
    if (!isParent) {
      return {
        isVariantParent: false,
        totalStock: parent.stock || 0,
        priceDisplay: `${currencySymbol}${parent.price?.toLocaleString() || 0}`,
        variants: []
      };
    }

    const variants = (products || []).filter(p => p.parentId === parent.id);
    const totalStock = variants.length > 0 
      ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : (parent.stock || 0);

    const prices = variants.map(v => v.price || 0).filter(p => p > 0);
    let priceDisplay = `${currencySymbol}${parent.price?.toLocaleString() || 0}`;
    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      priceDisplay = minPrice === maxPrice 
        ? `${currencySymbol}${minPrice.toLocaleString()}`
        : `${currencySymbol}${minPrice.toLocaleString()} - ${currencySymbol}${maxPrice.toLocaleString()}`;
    }

    return {
      isVariantParent: true,
      totalStock,
      priceDisplay,
      variants
    };
  }, [products, currencySymbol]);

  const searchParams = useSearchParams();
  const initialSortBy = (searchParams.get('sortBy') as any) || 'name';

  const [stockFilter, setStockFilter] = React.useState('all');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [sortBy, setSortBy] = React.useState<'name' | 'stock-desc' | 'stock-asc' | 'newest'>((searchParams.get('sortBy') as any) || DEFAULT_SORT_BY);

  const isLoading = isPosLoading;
  const isPageLoading = isLoading;

  /*
   * The list is empty because the catalogue could not be loaded, not because the
   * shop has nothing in it.
   *
   * This page had no such branch at all — it went straight from its skeleton to
   * "Empty Inventory · Start adding products to your shop", which is a confident
   * claim about someone's business that it had no basis to make. A desktop shell
   * pinned offline by a bad OS flag, or an unreadable `zeneva.db`, both landed
   * there, so the owner of a 12,000-product shop was invited to add their first
   * product. `isCatalogUnverified` is the context's answer to "can this emptiness
   * be trusted?" and `productSyncError` says why not. Same treatment the POS grid
   * already gives it.
   */
  const isCatalogUnavailable = !isPageLoading && isCatalogUnverified && (products?.length ?? 0) === 0;

  // Manual search button helper
  const performSearch = React.useCallback(async (term: string) => {
    // No-op for remote search, local filtering is instant via filteredProducts useMemo
  }, []);


  // Update sorting from URL
  React.useEffect(() => {
    const s = searchParams.get('sortBy');
    if (s === 'stock-desc' || s === 'stock-asc' || s === 'name' || s === 'newest') {
      setSortBy(s as any);
    }
  }, [searchParams]);

  // Subscription logic removed here as it is now handled by the root layout's subscription guard overlay.

  const userRole = currentUserProfile?.role;
  const canManageStock = currentUserProfile?.permissions?.manage_inventory ?? (userRole === 'admin' || userRole === 'manager');
  const canViewCostPrice = userRole === 'admin' || userRole === 'owner' || 
    (userRole === 'manager' && business?.settings?.allowManagerCostPriceView !== false) ||
    currentUserProfile?.permissions?.view_cost_price === true;

  // Get IDs of products queued for deletion
  const queuedDeletionIds = React.useMemo(() => {
    return queuedActions
      .filter(a => a.type === 'delete-product' && (a.status === 'pending' || a.status === 'processing' || a.status === 'synced'))
      .flatMap(a => a.payload.productIds as string[]);

  }, [queuedActions]);

  const filteredProducts = React.useMemo(() => {
    // Local products only
    let base = [...(products || [])];
    
    // Apply local search filter
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      base = base.filter(p => 
        p.name.toLowerCase().includes(lower) || 
        p.sku?.toLowerCase().includes(lower) ||
        p.category?.toLowerCase().includes(lower)
      );
    }

    
    // 1. Combine with optimistic products
    let combined = [...(optimisticProducts || []), ...base];
    
    // 2. Filter out queued deletions and child variants (child variants sit inside parent expandable sub-rows)
    let valid = combined.filter(p => !queuedDeletionIds.includes(p.id) && !p.parentId);

  // 3. Category
    if (categoryFilter !== 'all') {
      valid = valid.filter(p => p.category === categoryFilter);
    }

    // 4. Stock Status — services are skipped, see `isService`.
    if (stockFilter === 'out-of-stock') {
      valid = valid.filter(p => !isService(p) && (p.stock || 0) === 0);
    } else if (stockFilter === 'debt') {
      valid = valid.filter(p => !isService(p) && (p.stock || 0) < 0);
    } else if (stockFilter === 'in-stock') {
      valid = valid.filter(p => isService(p) || (p.stock || 0) > 0);
    } else if (stockFilter === 'low-stock') {
      valid = valid.filter(p => !isService(p) && (p.stock || 0) <= (p.lowStockThreshold || 10));
    }

    // 5. Apply Sorting
    valid.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'stock-desc') {
        const stockDiff = (b.stock || 0) - (a.stock || 0);
        if (stockDiff !== 0) return stockDiff;
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'stock-asc') {
        const stockDiff = (a.stock || 0) - (b.stock || 0);
        if (stockDiff !== 0) return stockDiff;
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'newest') {
        // Via `safeToDate`, not `toMillis?.() || seconds || 0`. A product this
        // device just created carries `createdAt: Date.now()` — a plain number,
        // which has neither of those properties, so it scored 0 and this default
        // sort put brand-new products at the very bottom of the table.
        const dateA = safeToDate(a.createdAt).getTime();
        const dateB = safeToDate(b.createdAt).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return valid;
  }, [products, optimisticProducts, queuedDeletionIds, searchTerm, categoryFilter, stockFilter, sortBy]);

  const healthMetrics = React.useMemo(() => {
    if (!products) return { missingImages: 0, outOfStock: 0, lowStock: 0, negativeStock: 0, missingCostPrice: 0, total: 0, score: 0, availabilityScore: 0, completenessScore: 0, accuracyScore: 0, costCompletenessScore: 0 };
    let missing = 0, oos = 0, low = 0, neg = 0, missingCost = 0, total = 0;
    products.forEach(p => {
      let isUnhealthy = false;
      // A missing image is worth flagging on a service too — it still shows on
      // the storefront. The three stock counts below are not: see `isService`.
      if (!p.imageUrl) { missing++; isUnhealthy = true; }
      if (p.costPrice === undefined || p.costPrice === null || p.costPrice === 0) { missingCost++; isUnhealthy = true; }
      if (!isService(p)) {
        if (p.stock === 0) { oos++; isUnhealthy = true; }
        if (p.stock !== undefined && p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5)) { low++; isUnhealthy = true; }
        if (p.stock !== undefined && p.stock < 0) { neg++; isUnhealthy = true; }
      }
      if (isUnhealthy) total++;
    });

    const totalItems = products.length;
    if (totalItems === 0) {
       return { missingImages: 0, outOfStock: 0, lowStock: 0, negativeStock: 0, missingCostPrice: 0, total: 0, score: 100, availabilityScore: 100, completenessScore: 100, accuracyScore: 100, costCompletenessScore: 100 };
    }

    const availabilityScore = Math.max(0, Math.round(((totalItems - oos) / totalItems) * 100));
    const completenessScore = Math.max(0, Math.round(((totalItems - missing) / totalItems) * 100));
    const accuracyScore = Math.max(0, Math.round(((totalItems - neg) / totalItems) * 100));
    const costCompletenessScore = Math.max(0, Math.round(((totalItems - missingCost) / totalItems) * 100));
    
    // Overall score is weighted average
    const score = Math.round((availabilityScore + completenessScore + accuracyScore + costCompletenessScore) / 4);

    return { missingImages: missing, outOfStock: oos, lowStock: low, negativeStock: neg, missingCostPrice: missingCost, total, score, availabilityScore, completenessScore, accuracyScore, costCompletenessScore };
  }, [products]);

  const analyticsData = React.useMemo(() => {
    if (!products || products.length === 0) {
      return {
        totalItems: 0,
        totalUnits: 0,
        totalRetailValue: 0,
        totalCostValue: 0,
        potentialProfit: 0,
        marginPercent: 0,
        sellThroughRate: 0,
        deadStockCount: 0,
        deadStockValue: 0,
        outOfStockCount: 0,
        belowReorderCount: 0,
        topSellers: [],
        categoryData: [],
        fastMoversLow: [],
        slowMovers: [],
        expiringSoon: [],
        stockFlow: []
      };
    }

    let totalUnits = 0;
    let totalRetailValue = 0;
    let totalCostValue = 0;
    let outOfStockCount = 0;
    let belowReorderCount = 0;
    const expiringSoon: Product[] = [];
    const categoryMap = new Map<string, { name: string; value: number; stock: number }>();

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const periodCutoff = new Date();
    if (analyticsPeriod === '30d') periodCutoff.setDate(now.getDate() - 30);
    else if (analyticsPeriod === '90d') periodCutoff.setDate(now.getDate() - 90);
    else if (analyticsPeriod === '6m') periodCutoff.setMonth(now.getMonth() - 6);
    else if (analyticsPeriod === '1y') periodCutoff.setFullYear(now.getFullYear() - 1);
    else if (analyticsPeriod === 'all') periodCutoff.setTime(0);

    const productSalesMap = new Map<string, { product: Product; totalQuantity: number; totalRevenue: number }>();

    products.forEach(p => {
      productSalesMap.set(p.id, { product: p, totalQuantity: 0, totalRevenue: 0 });

      const stock = p.stock || 0;
      const price = p.retailPrice || p.price || 0;
      const cost = p.costPrice || 0;
      const reorderThreshold = p.lowStockThreshold ?? 5;

      totalUnits += stock;
      totalRetailValue += stock * price;
      totalCostValue += stock * cost;

      if (stock <= 0) outOfStockCount++;
      if (stock > 0 && stock <= reorderThreshold) belowReorderCount++;

      const catName = p.category?.trim() || 'Uncategorized';
      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, { name: catName, value: 0, stock: 0 });
      }
      const catEntry = categoryMap.get(catName)!;
      catEntry.value += stock * price;
      catEntry.stock += stock;

      if (p.expiryDate) {
        const expDate = p.expiryDate instanceof Date ? p.expiryDate : (p.expiryDate as any).toDate ? (p.expiryDate as any).toDate() : new Date(p.expiryDate);
        if (expDate <= thirtyDaysFromNow) {
          expiringSoon.push(p);
        }
      }
    });

    expiringSoon.sort((a, b) => {
      const dA = a.expiryDate instanceof Date ? a.expiryDate : new Date(a.expiryDate as any);
      const dB = b.expiryDate instanceof Date ? b.expiryDate : new Date(b.expiryDate as any);
      return dA.getTime() - dB.getTime();
    });

    if (receipts && receipts.length > 0) {
      receipts.forEach(r => {
        const rDate = r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)) : null;
        if (rDate && rDate >= periodCutoff) {
          if (r.items && Array.isArray(r.items)) {
            r.items.forEach(item => {
              if (item.productId && productSalesMap.has(item.productId)) {
                const entry = productSalesMap.get(item.productId)!;
                entry.totalQuantity += (item.quantity || 1);
                entry.totalRevenue += (item.quantity || 1) * (item.price || 0);
              }
            });
          }
        }
      });
    }

    const allSalesEntries = Array.from(productSalesMap.values());

    const topSellers = allSalesEntries
      .filter(entry => entry.totalQuantity > 0)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 7);

    const periodDays = analyticsPeriod === '30d' ? 30 : analyticsPeriod === '90d' ? 90 : analyticsPeriod === '6m' ? 180 : analyticsPeriod === '1y' ? 365 : 90;

    let totalSoldUnits = 0;
    allSalesEntries.forEach(e => { totalSoldUnits += e.totalQuantity; });
    const sellThroughRate = (totalUnits + totalSoldUnits) > 0 ? (totalSoldUnits / (totalUnits + totalSoldUnits)) * 100 : 0;

    const fastMoversLow = allSalesEntries
      .filter(entry => entry.totalQuantity >= 2 && entry.product.stock <= (entry.product.lowStockThreshold ?? 5))
      .map(entry => {
        const dailyRate = entry.totalQuantity / periodDays;
        const runwayDays = dailyRate > 0 ? Math.max(1, Math.round((entry.product.stock || 0) / dailyRate)) : 14;
        return {
          product: entry.product,
          runwayDays,
          dailyRate: Number(dailyRate.toFixed(1))
        };
      })
      .sort((a, b) => a.runwayDays - b.runwayDays);

    const allSlowEntries = allSalesEntries.filter(entry => entry.totalQuantity === 0 && (entry.product.stock || 0) > 0);
    const deadStockCount = allSlowEntries.length;
    const deadStockValue = allSlowEntries.reduce((sum, e) => sum + ((e.product.stock || 0) * (e.product.costPrice || e.product.price || 0)), 0);

    const slowMovers = allSlowEntries
      .sort((a, b) => ((b.product.stock || 0) * (b.product.price || 0)) - ((a.product.stock || 0) * (a.product.price || 0)))
      .slice(0, 5)
      .map(entry => entry.product);

    const categoryData = Array.from(categoryMap.values())
      .filter(c => c.value > 0 || c.stock > 0)
      .sort((a, b) => b.value - a.value);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const numMonths = analyticsPeriod === '30d' ? 1 : analyticsPeriod === '90d' ? 3 : analyticsPeriod === '1y' ? 12 : 6;
    const stockFlow: { month: string; salesUnits: number; restockUnits: number }[] = [];
    
    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = numMonths <= 3 
        ? `${d.getDate()} ${monthNames[d.getMonth()]}`
        : `${monthNames[d.getMonth()]}`;
      const targetMonth = d.getMonth();
      const targetYear = d.getFullYear();

      let salesUnits = 0;
      if (receipts) {
        receipts.forEach(r => {
          const rDate = r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)) : null;
          if (rDate && rDate.getMonth() === targetMonth && rDate.getFullYear() === targetYear) {
            if (r.items) {
              r.items.forEach(item => { salesUnits += (item.quantity || 1); });
            }
          }
        });
      }

      let restockUnits = 0;
      products.forEach(p => {
        const pDate = p.createdAt ? (p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt)) : null;
        if (pDate && pDate.getMonth() === targetMonth && pDate.getFullYear() === targetYear) {
          restockUnits += (p.stock || 0);
        }
      });

      stockFlow.push({
        month: monthLabel,
        salesUnits,
        restockUnits
      });
    }

    const potentialProfit = totalRetailValue - totalCostValue;
    const marginPercent = totalRetailValue > 0 ? (potentialProfit / totalRetailValue) * 100 : 0;

    return {
      totalItems: products.length,
      totalUnits,
      totalRetailValue,
      totalCostValue,
      potentialProfit,
      marginPercent,
      sellThroughRate,
      deadStockCount,
      deadStockValue,
      outOfStockCount,
      belowReorderCount,
      topSellers,
      categoryData,
      fastMoversLow,
      slowMovers,
      expiringSoon,
      stockFlow
    };
  }, [products, receipts, analyticsPeriod]);

  const displayedProducts = React.useMemo(() => {
    if (activeTab === 'all') return filteredProducts;

    return filteredProducts.filter(p => {
      if (healthFilter === 'missing-image') return !p.imageUrl;
      if (healthFilter === 'out-of-stock') return !isService(p) && p.stock === 0;
      if (healthFilter === 'low-stock') return !isService(p) && p.stock !== undefined && p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5);
      if (healthFilter === 'negative') return !isService(p) && p.stock !== undefined && p.stock < 0;
      if (healthFilter === 'missing-cost-price') return p.costPrice === undefined || p.costPrice === null || p.costPrice === 0;

      // 'all' health issues
      if (!p.imageUrl) return true;
      if (p.costPrice === undefined || p.costPrice === null || p.costPrice === 0) return true;
      if (isService(p)) return false;
      return p.stock === 0 || (p.stock !== undefined && p.stock > 0 && p.stock <= 5) || (p.stock !== undefined && p.stock < 0);
    });
  }, [filteredProducts, activeTab, healthFilter]);

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedProductIds(displayedProducts.map(p => p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleRowSelect = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0 || !business || !currentUserProfile) return;

    addToQueue({
      type: 'delete-product',
      payload: { productIds: selectedProductIds }
    }, t('inventory.queueDeleting', { count: selectedProductIds.length }));

    // One log per product, carrying the count that was still on the shelf.
    //
    // Deleting a product erases the item and its outstanding count together, so
    // a shortage vanishes with no adjustment left behind to question. That makes
    // bulk delete the fastest way to clear a lot of missing stock at once, and
    // `stockAtDeletion` the only trace of it. Cannot be reconstructed afterwards
    // — the product document is gone. Forensics check S6.
    for (const id of selectedProductIds) {
      const deleted = products?.find(p => p.id === id);
      addToQueue({
        type: 'add-audit-log',
        payload: {
          businessId: business.id,
          userId: currentUserProfile.id,
          userName: currentUserProfile.name,
          userEmail: currentUserProfile.email,
          userRole: currentUserProfile.role,
          action: 'product.delete',
          entityType: 'Product',
          entityId: id,
          details: {
            entityName: deleted?.name ?? null,
            stockAtDeletion: deleted?.stock ?? 0,
            price: deleted?.price ?? 0,
            costPrice: deleted?.costPrice ?? 0,
            sku: deleted?.sku ?? null,
            reason: 'Bulk delete from Inventory',
          }
        }
      }, `Logging deletion of ${deleted?.name ?? id}`);
    }

    // We don't need to manually mutate here because we will filter in the UI based on queuedActions
    toast({
      variant: 'default',
      title: t('inventory.deletionQueuedTitle'),
      description: t('inventory.deletionQueuedDescription', { count: selectedProductIds.length }),
    });

    setSelectedProductIds([]);
    setIsDeleteDialogOpen(false);
  };

  const handleImportSuccess = () => {
    // Fired on success rather than on opening the dialog: the question is whether
    // bulk import is how stock actually gets in, and an abandoned import answers
    // that with a no.
    trackFeature('inventory_csv_import');
    setIsImportOpen(false);
  };

  const handleBulkEditSuccess = () => {
    setSelectedProductIds([]);
  }

  // The old Visual Count dialog lived here. Its handler was the only surviving
  // half — the dialog itself was imported but never mounted, so photographing
  // stock was unreachable from this page, and on desktop/Android/iOS it could not
  // have worked anyway: prepare-tauri.mjs stubs src/ai/flows, so visualCount
  // returned a canned string. Photographing stock is now a source inside
  // SmartImportDialog, which goes through duplicate matching and the review step
  // instead of writing straight to Firestore.

  const handleBulkImageSave = async (updates: { productId: string; imageUrl: string; imageFile: File }[]) => {
    for (const update of updates) {
      // Upload image to Firebase via /api/upload
      let finalImageUrl = update.imageUrl;
      try {
        const formData = new FormData();
        formData.append('file', update.imageFile);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.url) {
          finalImageUrl = uploadData.url;
        }
      } catch {
        // Fall back to the proxied URL if upload fails
      }

      addToQueue({
        type: 'update-product',
        payload: {
          productId: update.productId,
          values: { imageUrl: finalImageUrl }
        }
      }, `Updating image for product ${update.productId}`);
    }
    toast({
      title: `${updates.length} image${updates.length !== 1 ? 's' : ''} saved`,
      description: 'Product images have been updated successfully.'
    });
  };

  const handleExport = async () => {
    if (!business?.id) return;

    trackFeature('reports_exported');

    toast({ variant: 'default', title: t('inventory.preparingExportTitle'), description: t('inventory.preparingExportDescription') });

    try {
      const q = query(collection(firestore, 'products'), where('businessId', '==', business.id));
      const snap = await getDocs(q);
      const allProductsData = snap.docs.map(doc => doc.data() as Product);

      const csvData = Papa.unparse(
        allProductsData.map(p => ({
          Name: p.name,
          SKU: p.sku,
          Category: p.category,
          Price: p.price,
          Stock: p.stock,
          Description: p.description,
          ImageURL: p.imageUrl,
        }))
      );
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const reader = new FileReader();
      reader.onloadend = () => {
        const url = reader.result as string;
        link.setAttribute('href', url);
        link.setAttribute('download', `zeneva-products-export-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      reader.readAsDataURL(blob);
      toast({
        variant: 'success',
        title: t('inventory.exportCompleteTitle'),
        description: t('inventory.exportCompleteDescription'),
      });
    } catch (e) {
      toast({ variant: 'destructive', title: t('inventory.exportFailedTitle'), description: t('inventory.exportFailedDescription') });
    }
  };

  const activeFilterCount = (stockFilter !== 'all' ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0) + (sortBy !== DEFAULT_SORT_BY ? 1 : 0);
  return (
    <div className="flex flex-col flex-1 w-full pb-16 md:pb-0">

      <div className="flex items-center sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-3.5 gap-4 z-10 border-b mb-4">
        <div className="flex flex-col flex-1">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="search"
                placeholder={t('inventory.searchProducts')}
                className="w-full rounded-lg bg-background ps-8 ring-offset-background focus-visible:ring-primary h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    performSearch(searchTerm);
                  }
                }}
              />

            </div>
            <Button 
               variant="secondary" 
               size="icon"
               className="h-10 w-10 shrink-0 border shadow-sm hover:shadow-md transition-all active:scale-95"
               onClick={() => performSearch(searchTerm)}
               aria-label={t('inventory.searchAria')}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
            {selectedProductIds.length > 0 && canManageStock && (
               <>
                 <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => { setBulkEditInitialMode('grid'); setBulkEditInitialInstruction(''); setIsBulkEditDialogOpen(true); }}>
                   <Edit className="h-3.5 w-3.5" />
                   <span className="sm:whitespace-nowrap">
                     {t('inventory.bulkEditCount', { count: selectedProductIds.length })}
                   </span>
                 </Button>
                 <Button variant="default" size="sm" className="h-9 gap-1 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:bg-primary/90" onClick={() => { setBulkEditInitialMode('ai'); setBulkEditInitialInstruction(''); setIsBulkEditDialogOpen(true); }}>
                   <Sparkles className="h-3.5 w-3.5" />
                   <span className="sm:whitespace-nowrap">
                     AI Bulk Edit
                   </span>
                 </Button>
                 <Button variant="destructive" size="sm" className="h-9 gap-1" onClick={() => setIsDeleteDialogOpen(true)}>
                   <Trash2 className="h-3.5 w-3.5" />
                   <span className="sm:whitespace-nowrap">
                     {t('inventory.deleteCount', { count: selectedProductIds.length })}
                   </span>
                 </Button>
               </>
             )}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1" suppressHydrationWarning>
                  <ListFilter className="h-3.5 w-3.5" />
                  <span>{t('inventory.filter')}</span>
                  {activeFilterCount > 0 && (
                    <span className="bg-secondary text-secondary-foreground rounded-full h-5 w-5 p-0 flex items-center justify-center ms-1 text-[10px] font-semibold">{activeFilterCount}</span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('inventory.actionsAndFilters')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsScannerOpen(true)}>
                  <QrCode className="me-2 h-4 w-4" /> {t('inventory.searchByBarcode')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>{t('inventory.stockStatus')}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup value={stockFilter} onValueChange={setStockFilter}>
                      <DropdownMenuRadioItem value="all">{t('common.all')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="in-stock">{t('inventory.statusInStock')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="low-stock">{t('inventory.statusLowStock')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="out-of-stock">{t('inventory.statusOutOfStock')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="debt">{t('inventory.statusNegative')}</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>{t('inventory.category')}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup value={categoryFilter} onValueChange={setCategoryFilter}>
                      <DropdownMenuRadioItem value="all">{t('inventory.allCategories')}</DropdownMenuRadioItem>
                      {business?.settings?.productCategories?.map((cat: string) => (
                        <DropdownMenuRadioItem key={cat} value={cat}>{cat}</DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>{t('inventory.sortBy')}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                      <DropdownMenuRadioItem value="newest">{t('inventory.sortNewest')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name">{t('inventory.sortNameAz')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="stock-desc">{t('inventory.sortStockDescLong')}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="stock-asc">{t('inventory.sortStockAscLong')}</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                {activeFilterCount > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => { setStockFilter('all'); setCategoryFilter('all'); setSortBy(DEFAULT_SORT_BY); }} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      {t('inventory.clearFilters')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => handleExport()}>
              <Download className="h-3.5 w-3.5" />
              <span className="sm:whitespace-nowrap">{t('common.export')}</span>
            </Button>
            {canManageStock && (
              <Button size="sm" variant="outline" className="h-9 gap-1" id="tour-import-products" onClick={() => setIsImportOpen(true)}>
                <Upload className="h-3.5 w-3.5" />
                <span className="sm:whitespace-nowrap">{t('common.import')}</span>
              </Button>
            )}
            {canManageStock && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9 gap-1.5 font-medium border-border/80 hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Truck className="h-3.5 w-3.5 text-primary" />
                    <span className="sm:whitespace-nowrap">Restock & Orders</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-md">
                  <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                    Restock & Suppliers
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setIsReorderInvoiceModalOpen(true)}
                    className="flex items-start gap-2.5 p-2 cursor-pointer rounded-md focus:bg-orange-500/10 focus:text-orange-700 dark:focus:text-orange-300 group"
                  >
                    <div className="h-7 w-7 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-orange-500/20 transition-colors">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs flex items-center gap-1 text-orange-600 dark:text-orange-400">
                        ⚡ Auto Reorder PO
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        Generate purchase order for low stock
                      </span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="flex items-start gap-2.5 p-2 cursor-pointer rounded-md focus:bg-orange-500/10 focus:text-orange-700 dark:focus:text-orange-300 group">
                    <Link href="/expenses?tab=purchases" className="flex items-start gap-2.5 w-full">
                      <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Truck className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-xs">
                          Purchases & Restock
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Track incoming supplier shipments
                        </span>
                      </div>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="flex items-start gap-2.5 p-2 cursor-pointer rounded-md focus:bg-orange-500/10 focus:text-orange-700 dark:focus:text-orange-300 group">
                    <Link href="/inventory/debts" className="flex items-start gap-2.5 w-full">
                      <div className="h-7 w-7 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                        <TrendingDown className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-xs">
                          {t('inventory.manageDebts')}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Supplier debt ledger & balances
                        </span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canManageStock && (
              <Button size="sm" asChild className="h-9 gap-1" id="tour-add-product">
                <Link href="/inventory/add">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sm:whitespace-nowrap">{t('inventory.addProduct')}</span>
                </Link>
              </Button>
            )}
          </div>

          {/* Mobile Actions Modal/Menu */}
          <div className="flex md:hidden items-center gap-2">
            {selectedProductIds.length > 0 && canManageStock && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm" className="h-9 px-3 gap-2">
                    <Activity className="h-4 w-4" />
                    <span>{t('inventory.selectedCount', { count: selectedProductIds.length })}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsBulkEditDialogOpen(true)}>
                    <Edit className="me-2 h-4 w-4" /> {t('inventory.bulkEdit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="me-2 h-4 w-4" /> {t('inventory.deleteSelected')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('inventory.inventoryOptions')}</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => setIsScannerOpen(true)}>
                  <QrCode className="me-2 h-4 w-4" /> {t('inventory.scanBarcode')}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Mobile Filter Group */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ListFilter className="me-2 h-4 w-4" />
                    {t('inventory.filterAndSort')} {activeFilterCount > 0 && `(${activeFilterCount})`}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuLabel>{t('inventory.filterBy')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>{t('inventory.stockStatus')}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={stockFilter} onValueChange={setStockFilter}>
                          <DropdownMenuRadioItem value="all">{t('common.all')}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="in-stock">{t('inventory.statusInStock')}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="low-stock">{t('inventory.statusLowStock')}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="out-of-stock">{t('inventory.statusOutOfStock')}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="debt">{t('inventory.statusNegative')}</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>{t('inventory.category')}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={categoryFilter} onValueChange={setCategoryFilter}>
                          <DropdownMenuRadioItem value="all">{t('inventory.allCategories')}</DropdownMenuRadioItem>
                          {business?.settings?.productCategories?.map((cat: string) => (
                            <DropdownMenuRadioItem key={cat} value={cat}>{cat}</DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>{t('inventory.sortBy')}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                          <DropdownMenuRadioItem value="newest">{t('inventory.sortNewest')}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="name">{t('inventory.sortNameAz')}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="stock-desc">{t('inventory.sortStockDesc')}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="stock-asc">{t('inventory.sortStockAsc')}</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => handleExport()}>
                  <Download className="me-2 h-4 w-4" /> {t('inventory.exportCsv')}
                </DropdownMenuItem>

                {canManageStock && (
                  <DropdownMenuItem onClick={() => setIsImportOpen(true)}>
                    <Upload className="me-2 h-4 w-4" /> {t('inventory.importCsv')}
                  </DropdownMenuItem>
                )}

                {canManageStock && (
                  <DropdownMenuItem onClick={() => setIsReorderInvoiceModalOpen(true)} className="text-orange-600 dark:text-orange-400 focus:text-orange-700 dark:focus:text-orange-300 focus:bg-orange-500/10">
                    <FileText className="me-2 h-4 w-4" /> ⚡ Auto Reorder PO
                  </DropdownMenuItem>
                )}

                {canManageStock && (
                  <DropdownMenuItem onClick={() => setIsCostPriceOpen(true)}>
                    <Coins className="me-2 h-4 w-4" /> Cost prices
                  </DropdownMenuItem>
                )}

                {canManageStock && (
                  <DropdownMenuItem asChild>
                    <Link href="/inventory/debts">
                      <TrendingDown className="me-2 h-4 w-4" /> {t('inventory.manageDebts')}
                    </Link>
                  </DropdownMenuItem>
                )}

                {canManageStock && (
                  <DropdownMenuItem asChild>
                    <Link href="/inventory/suppliers">
                      <Truck className="me-2 h-4 w-4" /> Suppliers & Purchase Orders
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {canManageStock && (
                  <DropdownMenuItem asChild className="bg-primary text-primary-foreground focus:bg-primary/90">
                    <Link href="/inventory/add">
                      <PlusCircle className="me-2 h-4 w-4" /> {t('inventory.addNewProduct')}
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </div>

      <div className="w-full mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:max-w-lg">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">{t('inventory.tabAllProducts')}</TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-1.5">
              {t('inventory.tabHealth')}
              {healthMetrics.total > 0 && <span className="flex h-2 w-2 rounded-full bg-red-500" />}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1.5">
              Analytics
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-6 mb-6">
          {/* Header Controls: Time Period Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/60 p-4 rounded-xl border">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Inventory Analytics & Insights</h2>
              <p className="text-xs text-muted-foreground">Deep dive into stock valuation, movement trends, category distribution, and restock priorities.</p>
            </div>
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs">
              <span className="text-[11px] font-semibold text-muted-foreground px-2">Period:</span>
              {[
                { id: '30d', label: '30 Days' },
                { id: '90d', label: '90 Days' },
                { id: '6m', label: '6 Months' },
                { id: '1y', label: '1 Year' },
                { id: 'all', label: 'All Time' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setAnalyticsPeriod(p.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium transition-all",
                    analyticsPeriod === p.id 
                      ? "bg-background text-foreground shadow-sm font-semibold" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Moved from top of page: Inventory Valuation */}
          {canManageStock && products && (
            <InventoryValuation products={products} currencySymbol={currencySymbol} canViewCostPrice={canViewCostPrice} />
          )}

          {/* Top 6 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Products</p>
                <p className="text-4xl font-bold mt-2">{analyticsData.totalItems}</p>
                <p className="text-xs text-muted-foreground mt-1">{analyticsData.totalUnits.toLocaleString()} units in stock</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Retail Valuation</p>
                <p className="text-3xl font-bold mt-2 text-emerald-600 truncate">{currencySymbol}{analyticsData.totalRetailValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground mt-1">Total retail value</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Cost Valuation</p>
                <p className="text-3xl font-bold mt-2 text-blue-600 truncate">{currencySymbol}{analyticsData.totalCostValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground mt-1">Total capital invested</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Profit Potential</p>
                <p className="text-3xl font-bold mt-2 text-teal-600 truncate">{currencySymbol}{analyticsData.potentialProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-emerald-600 font-semibold mt-1">~{analyticsData.marginPercent.toFixed(1)}% Margin • {analyticsData.sellThroughRate.toFixed(1)}% STR</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Reorder Alerts</p>
                <p className="text-4xl font-bold mt-2 text-amber-500">{analyticsData.belowReorderCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Below reorder point</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Stockouts</p>
                <p className="text-4xl font-bold mt-2 text-rose-500">{analyticsData.outOfStockCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Zero stock remaining</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock Movement Flow Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Stock Flow Movement</span>
                  <Badge variant="outline" className="text-xs font-normal">Sales vs Restocks</Badge>
                </CardTitle>
                <CardDescription>Units sold (outflow) vs. Units restocked (inflow) in period</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.stockFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="salesUnits" name="Units Sold" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="restockUnits" name="Units Restocked" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Selling Products */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Top Selling Products</span>
                  <Badge variant="outline" className="text-xs font-normal">By Quantity</Badge>
                </CardTitle>
                <CardDescription>Best-performing inventory items in selected period</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {analyticsData.topSellers.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={analyticsData.topSellers.map(s => ({ name: s.product.name, units: s.totalQuantity }))} margin={{ top: 10, right: 20, left: 30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" fontSize={11} tickLine={false} />
                      <YAxis dataKey="name" type="category" fontSize={11} width={90} tickLine={false} />
                      <RechartsTooltip contentStyle={{ borderRadius: '8px' }} />
                      <Bar dataKey="units" name="Units Sold" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No sales recorded for this time period
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Capital Distribution */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Inventory Valuation by Category</CardTitle>
                <CardDescription>Where your capital is currently tied up across product categories</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsData.categoryData.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData.categoryData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={85}
                            paddingAngle={2}
                          >
                            {analyticsData.categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'][index % 7]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(val: any) => `${currencySymbol}${Number(val).toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2">
                      {analyticsData.categoryData.map((cat, idx) => {
                        const pct = analyticsData.totalRetailValue > 0 
                          ? ((cat.value / analyticsData.totalRetailValue) * 100).toFixed(1)
                          : '0';
                        return (
                          <div key={cat.name} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40 border">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'][idx % 7] }} />
                              <span className="font-medium truncate max-w-[150px]">{cat.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold">{currencySymbol}{cat.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              <span className="text-muted-foreground ml-2">({pct}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">No category data available</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actionable Intelligence Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fast Movers Running Low */}
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <span>⚡</span> Fast Movers Needing Restock
                </CardTitle>
                <CardDescription>High sales velocity items low on stock</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {analyticsData.fastMoversLow.length > 0 ? (
                  analyticsData.fastMoversLow.map(item => (
                    <div key={item.product.id} className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold">{item.product.name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>Reorder: {item.product.lowStockThreshold ?? 5} units</span>
                          <span>•</span>
                          <span className={item.runwayDays <= 7 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground"}>
                            ⚡ ~{item.runwayDays}d runway
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive" className="text-[10px]">
                          {item.product.stock} remaining
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">All fast-moving products have healthy stock levels 👍</p>
                )}
              </CardContent>
            </Card>

            {/* Slow Moving / Stagnant Capital */}
            <Card className="border-blue-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <span>💤</span> Slow-Moving Capital
                </CardTitle>
                <CardDescription>
                  {analyticsData.deadStockCount} items • {currencySymbol}{analyticsData.deadStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} frozen capital
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {analyticsData.slowMovers.length > 0 ? (
                  analyticsData.slowMovers.map(p => (
                    <div key={p.id} className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">{p.stock} in stock</p>
                      </div>
                      <div className="text-right font-medium">
                        <span className="text-blue-600 dark:text-blue-400 font-bold">
                          {currencySymbol}{((p.stock || 0) * (p.price || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">No slow-moving inventory detected</p>
                )}
              </CardContent>
            </Card>

            {/* Expiring Soon */}
            <Card className="border-rose-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <span>⏳</span> Expiring Soon (Next 30 Days)
                </CardTitle>
                <CardDescription>Stock approaching expiration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {analyticsData.expiringSoon.length > 0 ? (
                  analyticsData.expiringSoon.slice(0, 5).map((p) => {
                    const expDate = p.expiryDate instanceof Date ? p.expiryDate : new Date(p.expiryDate as any);
                    const daysRemaining = Math.ceil((expDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={p.id} className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">Stock: {p.stock || 0} units</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={daysRemaining <= 7 ? 'destructive' : 'secondary'} className="text-[10px]">
                            {daysRemaining <= 0 ? 'EXPIRED' : `${daysRemaining}d left`}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">No products expiring soon 🎉</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Left Column: Metric Cards */}
          <div className="flex flex-col gap-4">
            <Card 
              className={cn("flex-1 cursor-pointer transition-all border", healthFilter === 'all' ? "border-orange-500/50 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent shadow-[inset_0_0_20px_rgba(249,115,22,0.15)]" : "border-transparent hover:bg-muted/50")}
              onClick={() => setHealthFilter('all')}
            >
              <CardContent className="p-4 flex flex-col justify-center h-full gap-1 text-center">
                <span className="text-2xl font-bold">{healthMetrics.total}</span>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('inventory.healthTotalIssues')}</span>
              </CardContent>
            </Card>
            <Card 
              className={cn("flex-1 cursor-pointer transition-all border", healthFilter === 'low-stock' ? "border-orange-500/50 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent shadow-[inset_0_0_20px_rgba(249,115,22,0.15)]" : "border-transparent hover:bg-orange-50/50 dark:hover:bg-orange-950/20")}
              onClick={() => setHealthFilter('low-stock')}
            >
              <CardContent className="p-4 flex flex-col justify-center h-full gap-1 text-center">
                <span className="text-2xl font-bold text-orange-600">{healthMetrics.lowStock}</span>
                <span className="text-xs text-orange-600/80 font-medium uppercase tracking-wider">{t('inventory.healthLowStock')}</span>
              </CardContent>
            </Card>
            <Card 
              className={cn("flex-1 cursor-pointer transition-all border", healthFilter === 'negative' ? "border-orange-500/50 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent shadow-[inset_0_0_20px_rgba(249,115,22,0.15)]" : "border-transparent hover:bg-red-50/50 dark:hover:bg-red-950/20")}
              onClick={() => setHealthFilter('negative')}
            >
              <CardContent className="p-4 flex flex-col justify-center h-full gap-1 text-center">
                <span className="text-2xl font-bold text-red-500">{healthMetrics.negativeStock}</span>
                <span className="text-xs text-red-500/80 font-medium uppercase tracking-wider">{t('inventory.healthNegativeStock')}</span>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column: Overall Score */}
          <div className="flex items-stretch lg:order-none order-first cursor-pointer" onClick={() => setShowHealthModal(true)}>
            <Card className="w-full bg-gradient-to-br from-slate-50 to-muted/30 dark:from-slate-900/30 dark:to-muted/10 border-border overflow-hidden transition-all hover:shadow-md hover:border-primary/50">
              <CardContent className="p-5 flex flex-col items-center justify-center h-full text-center gap-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Overall Health Score</h3>
                
                <div className="relative flex items-center justify-center">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="56" className="stroke-muted" strokeWidth="12" fill="none" />
                    <circle 
                      cx="64" cy="64" r="56" 
                      className={cn("transition-all duration-1000 ease-out", healthMetrics.score >= 90 ? "stroke-green-500" : healthMetrics.score >= 70 ? "stroke-orange-500" : "stroke-red-500")}
                      strokeWidth="12" fill="none" 
                      strokeDasharray="351.85" 
                      strokeDashoffset={351.85 - (351.85 * healthMetrics.score) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn("text-3xl font-black", healthMetrics.score >= 90 ? "text-green-600" : healthMetrics.score >= 70 ? "text-orange-500" : "text-red-600")}>
                      {healthMetrics.score}%
                    </span>
                  </div>
                </div>

                <div className="flex w-full justify-between text-[9px] text-muted-foreground uppercase font-medium mt-2 px-1 gap-1">
                  <div className="flex flex-col items-center flex-1">
                    <span>Avail</span>
                    <span className="text-foreground font-semibold">{healthMetrics.availabilityScore}%</span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <span>Complete</span>
                    <span className="text-foreground font-semibold">{healthMetrics.completenessScore}%</span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <span>Accur</span>
                    <span className="text-foreground font-semibold">{healthMetrics.accuracyScore}%</span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <span>Costed</span>
                    <span className="text-foreground font-semibold">{healthMetrics.costCompletenessScore}%</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  {healthMetrics.score >= 90 ? "Your inventory is in great shape!" : 
                   healthMetrics.score >= 70 ? "Your inventory is okay, but needs a bit of attention." : 
                   "Your inventory needs urgent attention to prevent lost sales."}
                </p>
                <div className="text-[10px] text-primary underline underline-offset-2 opacity-80 mt-1">Tap to learn more</div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Metric Cards */}
          <div className="flex flex-col gap-4">
            <Card 
              className={cn("flex-1 cursor-pointer transition-all border", healthFilter === 'out-of-stock' ? "border-orange-500/50 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent shadow-[inset_0_0_20px_rgba(249,115,22,0.15)]" : "border-transparent hover:bg-red-50/50 dark:hover:bg-red-950/20")}
              onClick={() => setHealthFilter('out-of-stock')}
            >
              <CardContent className="p-4 flex flex-col justify-center h-full gap-1 text-center">
                <span className="text-2xl font-bold text-red-600">{healthMetrics.outOfStock}</span>
                <span className="text-xs text-red-600/80 font-medium uppercase tracking-wider">{t('inventory.healthOutOfStock')}</span>
              </CardContent>
            </Card>
            <Card 
              className={cn("flex-1 cursor-pointer transition-all border", healthFilter === 'missing-image' ? "border-orange-500/50 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent shadow-[inset_0_0_20px_rgba(249,115,22,0.15)]" : "border-transparent hover:bg-blue-50/50 dark:hover:bg-blue-950/20")}
              onClick={() => setHealthFilter('missing-image')}
            >
              <CardContent className="p-4 flex flex-col justify-center h-full gap-1 text-center">
                <span className="text-2xl font-bold text-blue-600">{healthMetrics.missingImages}</span>
                <span className="text-xs text-blue-600/80 font-medium uppercase tracking-wider">{t('inventory.healthMissingImages')}</span>
              </CardContent>
            </Card>
            <Card 
              className={cn("flex-1 cursor-pointer transition-all border", healthFilter === 'missing-cost-price' ? "border-orange-500/50 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent shadow-[inset_0_0_20px_rgba(249,115,22,0.15)]" : "border-transparent hover:bg-yellow-50/50 dark:hover:bg-yellow-950/20")}
              onClick={() => setHealthFilter('missing-cost-price')}
            >
              <CardContent className="p-4 flex flex-col justify-center h-full gap-1 text-center">
                <span className="text-2xl font-bold text-yellow-600">{healthMetrics.missingCostPrice}</span>
                <span className="text-xs text-yellow-600/80 font-medium uppercase tracking-wider">{t('inventory.healthMissingCostPrice')}</span>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Health Score Explanation Modal */}
      <Dialog open={showHealthModal} onOpenChange={setShowHealthModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How Your Health Score is Calculated</DialogTitle>
            <DialogDescription>
              We measure four key retail metrics to determine the health of your inventory. Keep these high to maximize sales and minimize operational issues.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <h4 className="font-semibold text-sm">1. Availability ({healthMetrics.availabilityScore}%)</h4>
              <p className="text-xs text-muted-foreground">Measures how much of your catalog is currently in stock. Stockouts directly result in lost sales and frustrated customers.</p>
            </div>
            <div className="grid gap-2">
              <h4 className="font-semibold text-sm">2. Completeness ({healthMetrics.completenessScore}%)</h4>
              <p className="text-xs text-muted-foreground">Measures how many products have images. Good visual data is crucial for Point of Sale speed and customer trust.</p>
            </div>
            <div className="grid gap-2">
              <h4 className="font-semibold text-sm">3. Accuracy ({healthMetrics.accuracyScore}%)</h4>
              <p className="text-xs text-muted-foreground">Measures how much of your catalog avoids negative stock. Negative stock means you sold items you didn't officially record as received.</p>
            </div>
            <div className="grid gap-2">
              <h4 className="font-semibold text-sm">4. Cost Price ({healthMetrics.costCompletenessScore}%)</h4>
              <p className="text-xs text-muted-foreground">Measures how many products have a cost price set. Cost prices are essential to calculate profit margins and business profit & loss statements.</p>
            </div>
            <div className="mt-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-xs text-primary/90 font-medium">
                <span className="font-bold">Solution:</span> Use the health filters at the top of this page (Out of Stock, Negative Stock, Missing Images, No Cost Price) to find and fix these issues!
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button type="button" variant="secondary" onClick={() => setShowHealthModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeTab === 'health' && displayedProducts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-primary/10 to-blue-500/10 border border-primary/20 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 text-primary rounded-xl shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm flex items-center gap-2">
                Fix {displayedProducts.length} {healthFilter === 'missing-cost-price' ? 'Missing Cost Price' : healthFilter === 'out-of-stock' ? 'Out of Stock' : healthFilter === 'low-stock' ? 'Low Stock' : healthFilter === 'negative' ? 'Negative Stock' : healthFilter === 'missing-image' ? 'Missing Image' : 'Inventory Health'} Issues
                <Badge variant="secondary" className="text-[10px] font-medium">{displayedProducts.length} affected</Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select all affected items or use Zeneva AI to bulk estimate cost prices, reset stock levels, or adjust reorder thresholds in seconds.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedProductIds(displayedProducts.map(p => p.id));
                toast({ title: "Selected issue products", description: `${displayedProducts.length} products selected for bulk editing.` });
              }}
              className="text-xs flex-1 sm:flex-none"
            >
              Select All ({displayedProducts.length})
            </Button>
            {healthFilter === 'missing-image' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsBulkImageEditorOpen(true)}
                className="text-xs gap-1.5 flex-1 sm:flex-none border-blue-500/50 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
              >
                <ImageOff className="h-3.5 w-3.5" />
                Fetch Images
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                const allIds = displayedProducts.map(p => p.id);
                setSelectedProductIds(allIds);
                setBulkEditInitialMode('ai');
                if (healthFilter === 'missing-cost-price') {
                  setBulkEditInitialInstruction('Estimate cost prices at a 30% margin off the selling price');
                } else if (healthFilter === 'negative') {
                  setBulkEditInitialInstruction('Set stock to 0 for these products');
                } else if (healthFilter === 'low-stock') {
                  setBulkEditInitialInstruction('Set low-stock alert to 15 for these products');
                } else if (healthFilter === 'out-of-stock') {
                  setBulkEditInitialInstruction('Set stock to 25 for these products');
                } else {
                  setBulkEditInitialInstruction('');
                }
                setIsBulkEditDialogOpen(true);
              }}
              className="text-xs gap-1.5 flex-1 sm:flex-none bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Fix with AI & Bulk Edit
            </Button>
          </div>
        </div>
      )}

      {activeTab !== 'analytics' && (
        <Card className="flex-1 flex flex-col min-h-0 w-full overflow-hidden mb-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {t('inventory.productsTitle')}
          </CardTitle>
          <CardDescription>
            {t('inventory.productsDescription')}
          </CardDescription>
          {/*
            Admin-only honesty note. While impersonating, the catalogue sync is
            capped (see IMPERSONATION_PRODUCT_CAP in pos-context) so viewing an
            account does not spend the owner's Firestore budget on a full 12,000
            product pull. Without saying so, 500 rows reads as "this shop has 500
            products" — a truncation nobody was told about.
          */}
          {isImpersonating && products && products.length >= 500 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Viewing another account: only the first {products.length.toLocaleString()} products were
              loaded, to avoid a full catalogue sync. Counts and totals on this page cover the loaded
              items only — every other section (sales, customers, reports) is complete.
            </p>
          )}
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-y-auto min-h-0">
          {(isLoading && displayedProducts.length === 0) || products === null ? (
            /*
              The catalogue is still arriving. This used to be a centred spinner
              over "Scanning catalogs…", which said nothing about what was
              coming; `ProductRowSkeleton` had been written for exactly this and
              was left unused. Drawing the real table — same headings, same
              column set — means the rows land in place instead of replacing a
              different picture.

              `products === null` is the load-bearing half of the condition: it
              is the state a locked or empty offline mirror leaves behind, and it
              must keep showing this rather than falling through to an empty
              table. Same rule as the POS grid.
            */
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">
                    <Skeleton className="h-4 w-4" />
                  </TableHead>
                  <TableHead className="w-16 sm:w-[100px]">
                    <span className="sr-only">{t('inventory.colImage')}</span>
                  </TableHead>
                  <TableHead className="font-semibold">{t('common.name')}</TableHead>
                  <TableHead className="font-semibold">{t('common.status')}</TableHead>
                  {canManageStock && <TableHead className="font-semibold">{t('common.price')}</TableHead>}
                  {canManageStock && <TableHead className="hidden md:table-cell font-semibold">{t('inventory.colStock')}</TableHead>}
                  <TableHead className="text-end font-semibold pe-6">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody aria-busy="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductRowSkeleton key={i} canManageStock={canManageStock} />
                ))}
              </TableBody>
            </Table>
          ) : (
            displayedProducts && displayedProducts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={displayedProducts.length > 0 && selectedProductIds.length === displayedProducts.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-16 sm:w-[100px]">
                      <span className="sr-only">{t('inventory.colImage')}</span>
                    </TableHead>
                    <TableHead className="font-semibold">{t('common.name')}</TableHead>
                    <TableHead className="font-semibold">{t('common.status')}</TableHead>
                    {canManageStock && <TableHead className="font-semibold">{t('common.price')}</TableHead>}
                    {canManageStock && <TableHead className="hidden md:table-cell font-semibold">{t('inventory.colStock')}</TableHead>}
                    <TableHead className="text-end font-semibold pe-6">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedProducts.map((product) => {
                    const variantInfo = getVariantInfo(product);
                    const isExpanded = expandedParentIds.includes(product.id);

                    return (
                      <React.Fragment key={product.id}>
                        <TableRow 
                          data-state={selectedProductIds.includes(product.id) && "selected"} 
                          className={cn(
                            "group hover:bg-muted/50 cursor-pointer transition-colors",
                            (product as any).isOptimistic && "opacity-70 bg-muted/50",
                            variantInfo.isVariantParent && "bg-muted/15 font-semibold"
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedProductIds.includes(product.id)}
                              onCheckedChange={() => handleRowSelect(product.id)}
                              disabled={(product as any).isOptimistic}
                            />
                          </TableCell>
                          <TableCell className="cursor-pointer" onClick={() => !(product as any).isOptimistic && router.push(`/inventory/details?id=${product.id}`)}>
                            {(() => {
                              const effectiveImageUrl = product.imageUrl || (product.parentId ? products?.find(p => p.id === product.parentId)?.imageUrl : undefined);
                              return effectiveImageUrl ? (
                                <div 
                                  className="relative h-12 w-12 sm:h-16 sm:w-16" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewImage({ src: effectiveImageUrl, alt: product.name });
                                  }}
                                >
                                  <CachedImage
                                    alt={product.name}
                                    className="aspect-square rounded-md object-cover hover:ring-2 ring-primary/50 transition-all w-full h-full"
                                    src={effectiveImageUrl}
                                  />
                                {(product as any).isOptimistic && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                  </div>
                                )}
                                </div>
                              ) : (
                                <div className="h-12 w-12 sm:h-16 sm:w-16 bg-muted rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors relative">
                                  <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                                  {(product as any).isOptimistic && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="font-medium whitespace-normal">
                            <div className="flex items-center gap-2">
                              {variantInfo.isVariantParent && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0 hover:bg-muted"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpandParent(product.id);
                                  }}
                                >
                                  {isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                              )}
                              <Link href={(product as any).isOptimistic ? '#' : `/inventory/details?id=${product.id}`} className={cn("hover:underline font-medium", (product as any).isOptimistic && "pointer-events-none")}>
                                {product.name}
                              </Link>
                              {variantInfo.isVariantParent && (
                                <Badge variant="secondary" className="text-[10px] h-4 cursor-pointer" onClick={() => toggleExpandParent(product.id)}>
                                  {variantInfo.variants.length} options
                                </Badge>
                              )}
                              {(product as any).isOptimistic && <Badge variant="secondary" className="text-[10px] h-4">{t('common.saving')}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                              <span className="font-mono text-[10px] bg-muted px-1 rounded">{product.sku || 'NO-SKU'}</span>
                              {((product as any).material || product.variantValue) && (
                                <span className="text-[10px] flex items-center gap-1 opacity-80">
                                   • {((product as any).material ? (product as any).material : '')} 
                                   {product.variantValue && <Badge variant="secondary" className="text-[8px] h-3 px-1 ms-0.5 font-normal">{product.variantValue}</Badge>}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                (product.categoryType === 'service' || product.category?.toLowerCase() === 'service' || product.category?.toLowerCase() === 'services') ? "outline" :
                                variantInfo.totalStock > 0 ? "outline" : "destructive"
                              }
                              className={cn(
                                "whitespace-nowrap",
                                (product.categoryType === 'service' || product.category?.toLowerCase() === 'service' || product.category?.toLowerCase() === 'services') && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                                (product.categoryType !== 'service' && product.category?.toLowerCase() !== 'service' && product.category?.toLowerCase() !== 'services') && variantInfo.totalStock < 0 && "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/50"
                              )}
                            >
                              {(product.categoryType === 'service' || product.category?.toLowerCase() === 'service' || product.category?.toLowerCase() === 'services') ? t('inventory.statusService') : variantInfo.totalStock > 0 ? t('inventory.statusInStock') : variantInfo.totalStock < 0 ? t('inventory.statusBackordered') : t('inventory.statusOutOfStock')}
                            </Badge>
                          </TableCell>
                          {canManageStock && <TableCell>{variantInfo.priceDisplay}</TableCell>}
                          {canManageStock && (
                            <TableCell className="hidden md:table-cell">
                              {product.categoryType === 'service' ? (
                                <span className="text-muted-foreground/40 italic">{t('inventory.notAvailable')}</span>
                              ) : (
                                <>
                                  {variantInfo.totalStock} <span className="text-[10px] text-muted-foreground">{product.baseUnit || ''}</span>
                                </>
                              )}
                            </TableCell>
                          )}
                      <TableCell className="text-end pe-6">
                        <DropdownMenu modal={false}
                          open={openMenuId === product.id} 
                          onOpenChange={(open) => setOpenMenuId(open ? product.id : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canManageStock && (
                              <>
                                <DropdownMenuItem onSelect={() => router.push(`/inventory/details?id=${product.id}`)}>
                                  <Edit className="me-2 h-4 w-4" /> {t('inventory.fullEdit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setQuickEditProduct(product)}>
                                  <Edit className="me-2 h-4 w-4" /> {t('inventory.quickEdit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setQuickRestockProduct(product)}>
                                  <PackagePlus className="me-2 h-4 w-4" /> Quick Restock
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onSelect={() => setBarcodeProduct(product)} disabled={!product.sku}>
                              <BarcodeIcon className="me-2 h-4 w-4" /> {t('inventory.printBarcode')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>


                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {variantInfo.isVariantParent && isExpanded && variantInfo.variants.map((child) => (
                      <TableRow 
                        key={child.id}
                        className="bg-muted/30 hover:bg-muted/60 text-xs border-l-4 border-l-primary transition-colors"
                      >
                        <TableCell className="ps-8">
                          <Checkbox
                            checked={selectedProductIds.includes(child.id)}
                            onCheckedChange={() => handleRowSelect(child.id)}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="h-8 w-8 bg-muted rounded flex items-center justify-center text-muted-foreground">
                            <Package className="h-4 w-4" />
                          </div>
                        </TableCell>
                        <TableCell className="py-2 font-normal ps-6">
                          <div className="flex items-center gap-2">
                            <Link href={`/inventory/details?id=${child.id}`} className="hover:underline font-medium text-foreground">
                              {child.name}
                            </Link>
                            <Badge variant="outline" className="text-[9px] h-4 font-mono">
                              Option: {child.variantValue || child.name}
                            </Badge>
                          </div>
                          <span className="font-mono text-[9px] text-muted-foreground">{child.sku || 'NO-SKU'}</span>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant={(child.stock || 0) > 0 ? "outline" : "destructive"} className="text-[10px]">
                            {(child.stock || 0) > 0 ? "In Stock" : "Out of Stock"}
                          </Badge>
                        </TableCell>
                        {canManageStock && <TableCell className="py-2">{currencySymbol}{child.price?.toLocaleString()}</TableCell>}
                        {canManageStock && (
                          <TableCell className="hidden md:table-cell py-2">
                            {child.stock || 0} <span className="text-[10px] text-muted-foreground">{child.baseUnit || ''}</span>
                          </TableCell>
                        )}
                        <TableCell className="text-end pe-6 py-2">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => router.push(`/inventory/details?id=${child.id}`)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                  );
                })}
                </TableBody>
              </Table>
            ) : isCatalogUnavailable ? (
              /*
               * A load that failed is not a shop with no stock.
               *
               * Ordered before the search and health empty states on purpose: a
               * search run against a catalogue that never arrived must not report
               * "no product found", which sends the owner to check their spelling
               * instead of their connection. The Add Product / Import CSV pair in
               * the branch below is withheld here for the same reason — offering
               * "add your first product" to a shop whose catalogue merely failed
               * to download is what made this bug so hard to recognise.
               *
               * The drawing is shared with the POS grid — see
               * `<CatalogUnavailable />` and `src/lib/product-catalog-state.ts`
               * for why it no longer claims a missing permission.
               */
              <CatalogUnavailable
                kind={productSyncError}
                onRetry={retryProductSync}
                className="h-full m-4"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-12 min-h-[400px]">
                <PackageOpen className="h-24 w-24 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-semibold">
                  {activeTab === 'health' ? t('inventory.noHealthIssues') : (searchTerm ? t('inventory.noProductFound') : t('inventory.emptyInventory'))}
                </h3>
                <p className="text-muted-foreground mt-2 mb-6 max-w-sm mx-auto">
                  {activeTab === 'health'
                    ? t('inventory.healthyHint')
                    : (searchTerm ? t('inventory.searchHint') : t('inventory.startAddingHint'))}
                </p>
                {activeTab === 'all' && (!searchTerm && stockFilter === 'all' && categoryFilter === 'all') && (
                  <div className="flex gap-2">
                    <Button asChild>
                      <Link href="/inventory/add">
                        <PlusCircle className="me-2 h-4 w-4" /> {t('inventory.addProduct')}
                      </Link>
                    </Button>
                    <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                      <Upload className="me-2 h-4 w-4" /> {t('inventory.importProducts')}
                    </Button>
                  </div>
                )}
              </div>
            )
          )}
        </CardContent>
        {filteredProducts && filteredProducts.length > 0 && (
          <CardFooter className="flex items-center justify-between border-t py-4">
            <div className="text-sm text-muted-foreground">
              {t('inventory.totalFound', { count: filteredProducts.length })}
            </div>
          </CardFooter>
        )}
      </Card>
      )}
      
      {business && (
        <SmartImportDialog
          isOpen={isImportOpen}
          onOpenChange={setIsImportOpen}
          onSuccess={handleImportSuccess}
        />
      )}

      <CostPriceDialog isOpen={isCostPriceOpen} onOpenChange={setIsCostPriceOpen} />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('inventory.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('inventory.deleteConfirmBody', { count: selectedProductIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {quickEditProduct && currentUserProfile && (
        <QuickEditDialog
          product={quickEditProduct}
          isOpen={!!quickEditProduct}
          onOpenChange={(open) => !open && setQuickEditProduct(null)}
          userProfile={currentUserProfile}
        />
      )}

      {quickRestockProduct && (
        <QuickRestockModal
          product={quickRestockProduct}
          onClose={() => setQuickRestockProduct(null)}
        />
      )}

      {isBulkEditDialogOpen && (
        <BulkEditDialog
          productIds={selectedProductIds}
          isOpen={isBulkEditDialogOpen}
          onOpenChange={setIsBulkEditDialogOpen}
          onSuccess={handleBulkEditSuccess}
          initialMode={bulkEditInitialMode}
          initialInstruction={bulkEditInitialInstruction}
        />
      )}

      {barcodeProduct && (
        <BarcodeDialog
          product={barcodeProduct}
          isOpen={!!barcodeProduct}
          onOpenChange={(open) => !open && setBarcodeProduct(null)}
        />
      )}

      {isScannerOpen && (
        <BarcodeScanner
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={(sku) => {
            setSearchTerm(sku);
            setIsScannerOpen(false);
          }}
        />
      )}
      <ImageDialog 
          isOpen={!!previewImage} 
          onClose={() => setPreviewImage(null)} 
          src={previewImage?.src || null} 
          alt={previewImage?.alt || ''} 
      />
      <ReorderInvoiceModal
          isOpen={isReorderInvoiceModalOpen}
          onOpenChange={setIsReorderInvoiceModalOpen}
      />
      <BulkImageEditor
        open={isBulkImageEditorOpen}
        onOpenChange={setIsBulkImageEditorOpen}
        products={(products || []).filter(p => !p.imageUrl)}
        onSave={handleBulkImageSave}
        freeTierLimit={10}
        isPro={false}
      />
    </div>

  );
}


