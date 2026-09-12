

'use client';
import { CurrencyAmount } from '@/components/shared/currency-amount';
import FollowUpCenter from '@/components/admin/follow-up-center';
import ContentStrategyCenter from '@/components/admin/content-strategy';
import PlatformRevenueChart from '@/components/admin/charts/PlatformRevenueChart';
import UserGrowthChart from '@/components/admin/charts/UserGrowthChart';
import TransactionVolumeChart from '@/components/admin/charts/TransactionVolumeChart';
import RevenueGrowthIndexChart from '@/components/admin/charts/RevenueGrowthIndexChart';
import PlanDistributionChart from '@/components/admin/charts/PlanDistributionChart';
import RetentionCohortChart from '@/components/admin/charts/RetentionCohortChart';
import FeatureStickinessChart from '@/components/admin/charts/FeatureStickinessChart';
import DailyActiveUsersChart from '@/components/admin/charts/DailyActiveUsersChart';
import OperationsAdoptionPanel from '@/components/admin/charts/OperationsAdoptionPanel';
import UserActivityDotPlot from '@/components/admin/charts/UserActivityDotPlot';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from '@/components/ui/card';
import {
    LineChart as ReLineChart,
    BarChart as ReBarChart,
    PieChart as RePieChart,
    XAxis,
    YAxis,
    Bar,
    Line,
    Pie,
    Cell,
    CartesianGrid,
    Legend,
    Tooltip as ReTooltip,
    ResponsiveContainer,
} from 'recharts';
import {
    Users,
    Activity,
    DollarSign,
    Package,
    Building,
    Loader,
    TrendingUp,
    FileText,
    UserCheck,
    ShoppingCart,
    PieChart as PieChartIcon,
    Crown,
    Calendar as CalendarIcon,
    Clock,
    XCircle,
    Layers,
    Newspaper,
    UserCog,
    Check,
    Ban,
    Briefcase,
    UserX,
    ShieldCheck,
    HeartPulse,
    Bot,
    BarChart2,
    AlertTriangle,
    Heart,
    Megaphone,
    MapPin,
    LogIn,
    AlertCircle,
    ArrowRight,
    Search,
    Filter,
    ArrowUpDown,
    Download,
    Settings,
    Database,
    RefreshCcw,
    PlusCircle,
    Trash2,
    PartyPopper,
    Store,
    Trophy,
    CheckCircle,
    Globe,
    Mail,
    Zap,
    Laptop,
    Sparkles,
    Smartphone,
    Timer,
    RefreshCw,
    Share2,
    Languages,
    ChevronDown,
    ChevronUp,
    DoorOpen,
    UploadCloud,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMemo, useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import Image from 'next/image';
import {
    collection,
    query,
    orderBy,
    where,
    getDocs,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp,
    Timestamp,
    collectionGroup,
    getDoc,
    deleteDoc,
    onSnapshot,
    limit,
    getCountFromServer,
} from 'firebase/firestore';
import { format, formatDistanceToNow, subDays, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { withFirestoreRetry } from '@/firebase/retry';
import { logAuditEvent } from '@/lib/audit';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { rankBusinesses } from '@/lib/outreach-scoring';
// Zeneva's own revenue definitions. Shared with the cap table's valuation card
// so the dashboard and the valuation cannot quote different figures.
import {
  internalOwnerIds,
  billingCurrencyByBusiness,
  isCreditPackPurchase,
  monthlyPriceNgn,
  purchasePlanMonthlyNgn,
  splitPurchases,
  subscriptionRunRate,
  toNgn,
} from '@/lib/platform-revenue';
import { effectivePlan } from '@/lib/plan';
import { safeToDate } from '@/lib/utils';
import DevicePlatformAdoptionSection, { classifyUserPlatform, isVersionLatest, isVersionOutdated } from '@/components/admin/device-platform-section';
import { AppConfig } from '@/lib/config';
import { LOCALES, resolveLocale, getLocaleDefinition } from '@/lib/i18n/config';
import type { BusinessInstance, UserProfile, Purchase, Receipt, Product } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePOS } from '@/context/pos-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CyberShield from '@/components/admin/cyber-shield';
import UninstallTracker from '@/components/admin/uninstall-tracker';
import LaunchFunnel from '@/components/admin/launch-funnel';
// Shared with the standalone /users directory and detail pages. These used to be
// module-private copies here; a second copy is how the two surfaces drift apart.
import {
    UserPresence,
    formatDuration,
    toDate,
    userLanguage,
} from '@/components/admin/user-detail/user-primitives';
import {
    UserUsageDetailDialog,
    type UsageSession,
} from '@/components/admin/user-detail/usage-insights';
import ProductIntelligence from '@/components/admin/usage/product-intelligence';
import NotificationEngagement from '@/components/admin/usage/notification-engagement';

const CustomTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const isRevenue = payload[0].name === 'Revenue';
        return (
            <div className="bg-background/80 backdrop-blur-sm p-3 border rounded-lg shadow-lg">
                <p className="text-sm font-bold mb-1">{label}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} className="text-sm" style={{ color: pld.fill || pld.stroke }}>
                        {`${pld.name}: ${isRevenue ? '₦' : ''}${pld.value.toLocaleString()}`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const CustomTooltip = (props: any) => {
    return <CustomTooltipContent {...props} />;
};

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">
                {value}
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const PIE_CHART_COLORS = {
    Healthy: '#22c55e', // Bright Green
    'Needs Attention': '#eab308', // Bright Yellow/Amber
    'At Risk': '#ef4444', // Bright Red
    Pro: '#3b82f6', // Bright Blue
    Business: '#8b5cf6', // Bright Purple
    Starter: '#94a3b8', // Slate/Gray (visible but distinct)
    Lifetime: '#10b981' // Emerald
};

/**
 * Total size of a collection, counted on the server.
 *
 * The admin log listeners are bounded to ADMIN_LOG_LIMIT rows, so the headings
 * that used to read `rows.length` would now stop at the limit and misreport the
 * platform totals. An aggregation query bills a fraction of a read no matter how
 * large the collection is, instead of one read per document, and it is what lets
 * those listeners be bounded without the numbers changing.
 *
 * Returns null until it resolves (and if it fails), so callers fall back to the
 * loaded row count rather than flashing a zero.
 */
function useCollectionCount(path: string, isCollectionGroup = false): number | null {
    const firestore = useFirestore();
    const [total, setTotal] = useState<number | null>(null);

    useEffect(() => {
        if (!firestore) return;
        let cancelled = false;

        getCountFromServer(isCollectionGroup ? collectionGroup(firestore, path) : collection(firestore, path))
            .then(snap => { if (!cancelled) setTotal(snap.data().count); })
            .catch(() => { /* falls back to the loaded row count */ });

        return () => { cancelled = true; };
    }, [firestore, path, isCollectionGroup]);

    return total;
}

function ImportIntelligenceDialog({ open, onOpenChange, importAttempts = [], businesses }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    importAttempts: any[];
    businesses: BusinessInstance[] | null;
}) {
    const importAttemptsTotal = useCollectionCount('import_attempts');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('all');

    const sourceLabels: Record<string, string> = {
        spreadsheet: 'Excel or CSV',
        paste: 'Paste Data',
        photo: 'Photo of Stock',
        invoice: 'Supplier Invoice',
        text: 'Describe with Text (AI)',
        desktop: 'Desktop App Software',
        barcode: 'Scan Barcodes',
        dropzone: 'Drop Anything Here',
    };

    const actionLabels: Record<string, string> = {
        opened_modal: 'Opened Importer',
        selected_source: 'Selected Method',
        clicked_dropzone: 'Clicked Dropzone',
        file_dropped: 'Uploaded File',
        image_dropped: 'Uploaded Image',
        opened_classic_modal: 'Opened Classic CSV',
        selected_classic_file: 'Selected Classic CSV',
        committed_import: 'Completed Import',
    };

    // Calculate source method breakdowns
    const sourceBreakdowns = useMemo(() => {
        const counts: Record<string, { count: number; uniqueUsers: Set<string> }> = {
            spreadsheet: { count: 0, uniqueUsers: new Set() },
            paste: { count: 0, uniqueUsers: new Set() },
            photo: { count: 0, uniqueUsers: new Set() },
            invoice: { count: 0, uniqueUsers: new Set() },
            text: { count: 0, uniqueUsers: new Set() },
            barcode: { count: 0, uniqueUsers: new Set() },
            dropzone: { count: 0, uniqueUsers: new Set() },
        };

        importAttempts.forEach((attempt) => {
            const src = attempt.source || (attempt.action === 'file_dropped' ? 'spreadsheet' : attempt.action === 'image_dropped' ? 'photo' : '');
            const uid = attempt.userId || attempt.userEmail || 'anon';
            if (src && counts[src]) {
                counts[src].count++;
                counts[src].uniqueUsers.add(uid);
            }
        });

        return counts;
    }, [importAttempts]);

    const filteredAttempts = useMemo(() => {
        return importAttempts.filter((item) => {
            const biz = businesses?.find(b => b.id === item.businessId);
            const bizName = (item.businessName || biz?.name || '').toLowerCase();
            const email = (item.userEmail || '').toLowerCase();
            const name = (item.userName || '').toLowerCase();
            const source = (item.source || '').toLowerCase();
            const file = (item.fileName || '').toLowerCase();
            const query = searchQuery.toLowerCase().trim();

            const matchesSearch = !query || 
                bizName.includes(query) || 
                email.includes(query) || 
                name.includes(query) || 
                source.includes(query) || 
                file.includes(query);

            const matchesSource = selectedSourceFilter === 'all' || 
                item.source === selectedSourceFilter || 
                (selectedSourceFilter === 'spreadsheet' && (item.action === 'file_dropped' || item.action === 'selected_classic_file')) ||
                (selectedSourceFilter === 'photo' && item.action === 'image_dropped');

            return matchesSearch && matchesSource;
        });
    }, [importAttempts, businesses, searchQuery, selectedSourceFilter]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl sm:max-w-5xl w-[95vw] max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <UploadCloud className="h-5 w-5 text-primary" />
                        Inventory Import Telemetry & Method Choices
                    </DialogTitle>
                    <DialogDescription>
                        Real-time tracking of which methods merchants click to import products into Zeneva, who clicked it, and files uploaded.
                    </DialogDescription>
                </DialogHeader>

                <div className="overflow-y-auto space-y-4 pr-1">
                    {/* Top Summary Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-1">
                        <Card className="bg-muted/30 border-border/80">
                            <CardHeader className="pb-1.5 pt-3">
                                <CardDescription className="text-xs">Total Import Interactions</CardDescription>
                                <CardTitle className="text-2xl font-black text-primary">{importAttemptsTotal ?? importAttempts.length}</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <p className="text-[10px] text-muted-foreground">Clicks, uploads, and modal opens across all merchants.</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-muted/30 border-border/80">
                            <CardHeader className="pb-1.5 pt-3">
                                <CardDescription className="text-xs">File Upload Attempts</CardDescription>
                                <CardTitle className="text-2xl font-black text-emerald-600">
                                    {importAttempts.filter(a => a.action === 'file_dropped' || a.action === 'image_dropped' || a.action === 'selected_classic_file').length}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <p className="text-[10px] text-muted-foreground">Spreadsheets or photos actively uploaded by shop owners.</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-muted/30 border-border/80">
                            <CardHeader className="pb-1.5 pt-3">
                                <CardDescription className="text-xs">Top Method Preferred</CardDescription>
                                <CardTitle className="text-xl font-black capitalize truncate text-orange-600">
                                    {(() => {
                                        const sources = importAttempts.map(a => a.source).filter(Boolean);
                                        if (sources.length === 0) return 'Spreadsheet';
                                        const counts: Record<string, number> = {};
                                        sources.forEach(s => counts[s] = (counts[s] || 0) + 1);
                                        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
                                        return sourceLabels[top] || top || 'Spreadsheet';
                                    })()}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <p className="text-[10px] text-muted-foreground">Most popular import option chosen by shop owners.</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Method Choices Breakdown Grid */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Import Methods Chosen by Merchants</h4>
                            <span className="text-[11px] text-muted-foreground">Click a card to filter logs</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                            {[
                                { id: 'spreadsheet', label: 'Excel / CSV', emoji: '📄', count: sourceBreakdowns.spreadsheet.count, users: sourceBreakdowns.spreadsheet.uniqueUsers.size },
                                { id: 'paste', label: 'Paste Data', emoji: '📋', count: sourceBreakdowns.paste.count, users: sourceBreakdowns.paste.uniqueUsers.size },
                                { id: 'photo', label: 'Stock Photo', emoji: '📸', count: sourceBreakdowns.photo.count, users: sourceBreakdowns.photo.uniqueUsers.size },
                                { id: 'invoice', label: 'Supplier Invoice', emoji: '🧾', count: sourceBreakdowns.invoice.count, users: sourceBreakdowns.invoice.uniqueUsers.size },
                                { id: 'text', label: 'Describe AI', emoji: '💬', count: sourceBreakdowns.text.count, users: sourceBreakdowns.text.uniqueUsers.size },
                                { id: 'barcode', label: 'Scan Barcodes', emoji: '🔍', count: sourceBreakdowns.barcode.count, users: sourceBreakdowns.barcode.uniqueUsers.size },
                                { id: 'dropzone', label: 'Dropzone', emoji: '☁️', count: sourceBreakdowns.dropzone.count, users: sourceBreakdowns.dropzone.uniqueUsers.size },
                            ].map((m) => {
                                const isSelected = selectedSourceFilter === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setSelectedSourceFilter(isSelected ? 'all' : m.id)}
                                        className={`p-2.5 rounded-xl border text-left transition-all ${
                                            isSelected 
                                                ? 'border-primary bg-primary/10 ring-1 ring-primary' 
                                                : 'border-border/70 bg-card hover:bg-muted/40'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-base">{m.emoji}</span>
                                            <span className="font-bold text-xs">{m.count}</span>
                                        </div>
                                        <p className="text-[11px] font-bold mt-1 truncate">{m.label}</p>
                                        <p className="text-[9px] text-muted-foreground">{m.users} {m.users === 1 ? 'merchant' : 'merchants'}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search by business, email, user, or file..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 text-xs h-8"
                            />
                        </div>
                        {selectedSourceFilter !== 'all' && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedSourceFilter('all')}
                                className="text-xs h-8 text-muted-foreground"
                            >
                                Showing {sourceLabels[selectedSourceFilter] || selectedSourceFilter} · Clear filter
                            </Button>
                        )}
                    </div>

                    {/* Recent Import Logs Table */}
                    <div className="border rounded-xl overflow-hidden bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40">
                                    <TableHead className="text-xs font-bold">Business Name</TableHead>
                                    <TableHead className="text-xs font-bold">User / Merchant</TableHead>
                                    <TableHead className="text-xs font-bold">Action</TableHead>
                                    <TableHead className="text-xs font-bold">Method Chosen</TableHead>
                                    <TableHead className="text-xs font-bold">File Info</TableHead>
                                    <TableHead className="text-right text-xs font-bold">Date / Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAttempts.map((item, index) => {
                                    const dateStr = item.timestamp?.toDate 
                                        ? format(item.timestamp.toDate(), "MMM d, yyyy · h:mm a")
                                        : (item.timestamp?.seconds 
                                            ? format(new Date(item.timestamp.seconds * 1000), "MMM d, yyyy · h:mm a")
                                            : 'Just now');
                                    const biz = businesses?.find(b => b.id === item.businessId);

                                    return (
                                        <TableRow key={item.id || index} className="hover:bg-muted/20">
                                            <TableCell className="font-semibold text-xs max-w-[150px] truncate" title={item.businessName || biz?.name || 'Unknown'}>
                                                {item.businessName || biz?.name || 'Unknown Business'}
                                            </TableCell>
                                            <TableCell className="max-w-[180px] truncate">
                                                <div className="flex flex-col text-left">
                                                    <span className="font-semibold text-xs text-foreground">{item.userName || biz?.ownerName || 'Merchant'}</span>
                                                    <span className="text-[10px] text-muted-foreground truncate" title={item.userEmail || biz?.ownerEmail}>{item.userEmail || biz?.ownerEmail || 'No email logged'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] font-medium capitalize">
                                                    {actionLabels[item.action] || item.action || 'Opened'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {item.source ? (
                                                    <Badge variant="secondary" className="text-[10px] font-semibold">
                                                        {sourceLabels[item.source] || item.source}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs max-w-[150px] truncate">
                                                {item.fileName ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-[11px] truncate text-foreground font-medium" title={item.fileName}>{item.fileName}</span>
                                                        {item.fileSize && (
                                                            <span className="text-[9px] text-muted-foreground">{(item.fileSize / 1024).toFixed(1)} KB</span>
                                                        )}
                                                    </div>
                                                ) : item.metadata?.created != null ? (
                                                    <span className="text-[10px] font-mono text-emerald-600 font-bold">
                                                        +{item.metadata.created} products
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-[10px] text-muted-foreground whitespace-nowrap font-mono">
                                                {dateStr}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {filteredAttempts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                                            {searchQuery || selectedSourceFilter !== 'all' 
                                                ? 'No import attempts match your search or filter.' 
                                                : 'No import activity logged yet.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SaaSMetricsDetailDialog({ open, onOpenChange, validPurchases, checkoutAttempts = [], totalSubscriptionRevenue, totalCreditPackRevenue = 0, payingBusinessesCount, businesses, mrr = 0, arr = 0, mrrDescription = '', arrDescription = '' }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    validPurchases: any[];
    checkoutAttempts?: any[];
    totalSubscriptionRevenue: number;
    /**
     * One-off Zen AI credit-pack sales, in NGN. Reported beside the subscription
     * figure rather than folded into it: it is real money that recurs for nobody,
     * so adding it to the number the LTV card divides would overstate what a
     * subscriber is worth.
     */
    totalCreditPackRevenue?: number;
    payingBusinessesCount: number;
    businesses: BusinessInstance[] | null;
    mrr?: number;
    arr?: number;
    mrrDescription?: string;
    arrDescription?: string;
}) {
    // The attempts list is capped at ADMIN_LOG_LIMIT rows, so the tab heading is
    // counted on the server rather than taken from the loaded array.
    const checkoutAttemptsTotal = useCollectionCount('checkout_attempts');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl sm:max-w-5xl w-[95vw]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        SaaS Financial Metrics Overview
                    </DialogTitle>
                    <DialogDescription>
                        Detailed breakdown of active subscriptions, MRR contributions, ARR target, and Customer Lifetime Value (LTV).
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <Card className="border-emerald-500/30 bg-emerald-500/5">
                        <CardHeader className="pb-1">
                            <CardDescription className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Monthly Recurring Revenue (MRR)</CardDescription>
                            <CardTitle className="text-2xl font-bold text-foreground">₦{Math.round(mrr).toLocaleString()}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-[11px] text-muted-foreground">{mrrDescription || 'Active subscription run rate'}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-blue-500/30 bg-blue-500/5">
                        <CardHeader className="pb-1">
                            <CardDescription className="text-xs font-semibold text-blue-600 dark:text-blue-400">Annualized Run Rate (ARR)</CardDescription>
                            <CardTitle className="text-2xl font-bold text-foreground">₦{Math.round(arr).toLocaleString()}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-[11px] text-muted-foreground">{arrDescription || 'Annualized MRR projection'}</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Paying Customers</CardDescription>
                            <CardTitle className="text-2xl font-bold">{payingBusinessesCount}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-[10px] text-muted-foreground">Businesses that have paid for a plan. A shop that only ever bought AI credits is not counted.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Subscription Revenue</CardDescription>
                            <CardTitle className="text-2xl font-bold">₦{Math.round(totalSubscriptionRevenue).toLocaleString()}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-[10px] text-muted-foreground">Zeneva's own subscription fees collected to date. Not platform GMV — that is what merchants sold. Dollar payments converted at ₦1,500/$1.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">AI Credit Packs</CardDescription>
                            <CardTitle className="text-2xl font-bold">₦{Math.round(totalCreditPackRevenue).toLocaleString()}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-[10px] text-muted-foreground">One-off Zen AI top-ups. Deliberately outside MRR, ARR and LTV — a pack is bought once and recurs for nobody.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Average LTV</CardDescription>
                            <CardTitle className="text-2xl font-bold">₦{(payingBusinessesCount > 0 ? Math.round(totalSubscriptionRevenue / payingBusinessesCount) : 0).toLocaleString()}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-[10px] text-muted-foreground">Calculated as: Subscription Revenue / Paying Customers</p>
                        </CardContent>
                    </Card>
                </div>
                
                <Tabs defaultValue="transactions" className="w-full mt-4">
                    <TabsList className="flex w-full justify-start overflow-x-auto overflow-y-hidden snap-x h-auto py-2 scrollbar-hide">
                        <TabsTrigger value="transactions" className="snap-start shrink-0">Active Transactions ({validPurchases.length})</TabsTrigger>
                        <TabsTrigger value="attempts" className="snap-start shrink-0">Checkout Click Attempts ({checkoutAttemptsTotal ?? checkoutAttempts.length})</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="transactions" className="space-y-4 mt-2">
                        <h4 className="text-sm font-bold">Active Billing Breakdown (All Time)</h4>
                        <div className="max-h-60 overflow-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Business Name</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Currency</TableHead>
                                        <TableHead className="text-right">Paid Amount</TableHead>
                                        <TableHead className="text-right">Plan price / mo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {validPurchases.map((p, index) => {
                                        const biz = businesses?.find(b => b.id === p.businessId);
                                        // What this plan bills monthly on the price list the
                                        // customer is billed against — not this row's share of
                                        // MRR. The list is all-time, so several rows can belong
                                        // to one subscription and they do not sum to MRR.
                                        //
                                        // A credit pack bills nothing monthly, and
                                        // `purchasePlanMonthlyNgn` name-matches its `plan` text:
                                        // "1,000 AI credits" contains no "business", so it would
                                        // fall through to Pro and print ₦10,000/mo against a
                                        // ₦8,000 one-off sale.
                                        const isPack = isCreditPackPurchase(p);
                                        const planMonthly = isPack ? 0 : purchasePlanMonthlyNgn(p.plan, p.currency);
                                        return (
                                            <TableRow key={p.id || index}>
                                                <TableCell className="font-medium max-w-[180px] truncate" title={biz?.name || 'Unknown Business'}>{biz?.name || 'Unknown Business'}</TableCell>
                                                <TableCell className="capitalize">
                                                    {p.plan || 'Pro'}
                                                    {isPack && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">one-off</span>}
                                                </TableCell>
                                                <TableCell className="uppercase">{p.currency || 'NGN'}</TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {p.currency === 'USD' ? '$' : '₦'}{p.amount.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold text-emerald-500">
                                                    {isPack ? <span className="text-muted-foreground font-normal">—</span> : `₦${planMonthly.toLocaleString()}`}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {validPurchases.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                                                No active transactions recorded.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="attempts" className="space-y-4 mt-2">
                        <h4 className="text-sm font-bold">Initiated Checkouts (Last 30 Days)</h4>
                        <div className="max-h-60 overflow-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Business Name</TableHead>
                                        <TableHead>User / Email</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Gateway</TableHead>
                                        <TableHead>Date / Time</TableHead>
                                        <TableHead className="text-right">Price</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {checkoutAttempts.map((c, index) => {
                                        const dateStr = c.timestamp?.toDate 
                                            ? format(c.timestamp.toDate(), "PPP p")
                                            : (c.timestamp?.seconds 
                                                ? format(new Date(c.timestamp.seconds * 1000), "PPP p")
                                                : 'Unknown Date');
                                        return (
                                            <TableRow key={c.id || index}>
                                                <TableCell className="font-medium max-w-[150px] truncate" title={c.businessName || 'Unknown Business'}>{c.businessName || 'Unknown Business'}</TableCell>
                                                <TableCell className="max-w-[150px] truncate" title={c.userEmail || 'N/A'}>
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-semibold text-xs">{c.userName || 'N/A'}</span>
                                                        <span className="text-[10px] text-muted-foreground">{c.userEmail || 'N/A'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="capitalize text-xs">{c.plan || 'Pro'} ({c.cycle || '1m'})</TableCell>
                                                <TableCell className="uppercase text-xs">{c.gateway || 'Paystack'}</TableCell>
                                                <TableCell className="text-[10px] text-muted-foreground">{dateStr}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">
                                                    {c.currency === 'USD' ? '$' : '₦'}{c.amount?.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {checkoutAttempts.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                                                No checkout attempts recorded.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function TopPerformersDialog({ open, onOpenChange, topPerformers, users }: { open: boolean, onOpenChange: (open: boolean) => void, topPerformers: any[], users: UserProfile[] | null }) {
    const businessOwners = useMemo(() => {
        if (!users) return {};
        return topPerformers.reduce((acc, b) => {
            const owner = users.find(u => u.id === b.ownerId);
            acc[b.id] = owner?.name || 'N/A';
            return acc;
        }, {} as Record<string, string>);
    }, [topPerformers, users]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl sm:max-w-5xl w-[95vw]">
                <DialogHeader>
                    <DialogTitle>All Performers Ranking (GMV)</DialogTitle>
                    <DialogDescription>
                        A ranking of all active businesses by their total Gross Merchandise Value (converted to Naira if USD).
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[400px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-16">Rank</TableHead>
                                <TableHead>Business Name</TableHead>
                                <TableHead>Owner</TableHead>
                                <TableHead>Products</TableHead>
                                <TableHead>Currency</TableHead>
                                <TableHead className="text-right">Total GMV (₦)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {topPerformers.map((business, index) => (
                                <TableRow key={business.id}>
                                    <TableCell className="font-bold text-center">#{index + 1}</TableCell>
                                    <TableCell className="font-medium max-w-[160px] truncate" title={business.name}>{business.name}</TableCell>
                                    <TableCell className="max-w-[120px] truncate" title={businessOwners[business.id] || 'N/A'}>{businessOwners[business.id] || 'N/A'}</TableCell>
                                    <TableCell>{business.productCount || 0}</TableCell>
                                    <TableCell className="uppercase">{business.settings?.currency || 'NGN'}</TableCell>
                                    <TableCell className="text-right font-mono font-bold">₦{business.totalRevenue.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

function BusinessDetailDialog({ open, onOpenChange, title, description, businesses, users, isInfoOnly }: { open: boolean, onOpenChange: (open: boolean) => void, title: string, description: string, businesses: BusinessInstance[], users: UserProfile[] | null, isInfoOnly?: boolean }) {
    const businessOwners = useMemo(() => {
        if (!users || isInfoOnly) return {};
        return businesses.reduce((acc, b) => {
            const owner = users.find(u => u.id === b.ownerId);
            acc[b.id] = owner?.name || 'N/A';
            return acc;
        }, {} as Record<string, string>);
    }, [businesses, users, isInfoOnly]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>
                {!isInfoOnly && (
                    <ScrollArea className="h-96">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Business Name</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Trial Expires</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {businesses.map(b => (
                                    <TableRow key={b.id}>
                                        <TableCell className="font-medium max-w-[160px] truncate" title={b.name}>{b.name}</TableCell>
                                        <TableCell className="max-w-[120px] truncate" title={businessOwners[b.id]}>{businessOwners[b.id]}</TableCell>
                                        <TableCell><Badge variant="secondary" className="capitalize">{b.accessLevel === 'lifetime' ? 'Lifetime' : b.plan || 'starter'}</Badge></TableCell>
                                        <TableCell>{b.trialExpiresAt ? format(b.trialExpiresAt.toDate(), 'PPP') : 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}

function UserListDialog({ open, onOpenChange, title, description, users, businesses }: { open: boolean, onOpenChange: (open: boolean) => void, title: string, description: string, users: UserProfile[] | null, businesses: BusinessInstance[] | null }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-96">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Business</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(users || []).map(u => {
                                const biz = businesses?.find(b => b.id === u.businessId);
                                return (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium max-w-[140px] truncate" title={biz?.name || u.name}>{biz?.name || u.name || 'Unknown User'}</TableCell>
                                        <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground" title={u.email}>{u.email}</TableCell>
                                        <TableCell className="max-w-[130px] truncate" title={biz?.name || 'N/A'}>{biz?.name || 'N/A'}</TableCell>
                                        <TableCell><Badge variant={u.status === 'inactive' ? 'destructive' : 'outline'} className="capitalize">{u.status || 'active'}</Badge></TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

function DownloadIntelligenceDialog({ open, onOpenChange, downloadClicks, downloadStats }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    downloadClicks: any[];
    downloadStats: any;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl sm:max-w-5xl w-[95vw]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-primary" />
                        Download Intelligence
                    </DialogTitle>
                    <DialogDescription>
                        Detailed breakdown of app download clicks, platforms, and geographic distribution.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Unique Downloaders</CardDescription>
                            <CardTitle className="text-2xl font-bold">{downloadClicks.length}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Total Clicks</CardDescription>
                            <CardTitle className="text-2xl font-bold">{downloadStats.totalClicks}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="md:col-span-2">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs">Platform Breakdown</CardDescription>
                            <CardTitle className="text-sm font-bold flex gap-4 mt-2">
                                <span className="flex items-center gap-1"><Laptop className="h-4 w-4" /> Win: {downloadStats.windows}</span>
                                <span className="flex items-center gap-1"><Laptop className="h-4 w-4" /> Mac: {downloadStats.macos}</span>
                                <span className="flex items-center gap-1"><Smartphone className="h-4 w-4" /> Android: {downloadStats.android}</span>
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
                
                <Tabs defaultValue="log" className="w-full mt-4">
                    <TabsList className="flex w-full justify-start overflow-x-auto overflow-y-hidden snap-x h-auto py-2 scrollbar-hide">
                        <TabsTrigger value="log" className="snap-start shrink-0">Click Log ({downloadClicks.length})</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="log" className="space-y-4 mt-2">
                        <div className="max-h-96 overflow-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date / Time</TableHead>
                                        <TableHead>User ID / IP</TableHead>
                                        <TableHead>Country</TableHead>
                                        <TableHead>Platforms</TableHead>
                                        <TableHead className="text-right">Clicks</TableHead>
                                        <TableHead>Source / Button</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {downloadClicks.map((d, index) => {
                                        const dateStr = d.lastClicked?.toDate 
                                            ? format(d.lastClicked.toDate(), "PPP p")
                                            : (d.lastClicked?.seconds 
                                                ? format(new Date(d.lastClicked.seconds * 1000), "PPP p")
                                                : (d.timestamp?.toDate ? format(d.timestamp.toDate(), "PPP p") : 'Unknown Date'));
                                        return (
                                            <TableRow key={d.id || index}>
                                                <TableCell className="text-[10px] text-muted-foreground">{dateStr}</TableCell>
                                                <TableCell className="font-mono text-xs max-w-[150px] truncate" title={d.id || d.userId || d.ip || 'Unknown'}>{d.id || d.userId || d.ip || 'Unknown'}</TableCell>
                                                <TableCell className="text-xs max-w-[150px] truncate">{d.country || d.location || 'N/A'}</TableCell>
                                                <TableCell className="capitalize text-xs">{(d.platforms || []).join(', ') || 'N/A'}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{d.clicks || 1}</TableCell>
                                                <TableCell className="text-xs">{d.button || d.source || 'N/A'}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {downloadClicks.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                                                No download data recorded.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function ZenevaMilestoneDialog({ open, onOpenChange, daysActive, totalSales, totalBusinesses, totalUsers, launchDate, averageSalesPerDay, averageReceiptsPerDay, platformAOV, arr, topLocation }: { 
    open: boolean, 
    onOpenChange: (open: boolean) => void, 
    daysActive: number, 
    totalSales: number, 
    totalBusinesses: number, 
    totalUsers: number, 
    launchDate: Date,
    averageSalesPerDay: number,
    averageReceiptsPerDay: number,
    platformAOV: number,
    arr: number,
    topLocation: string
}) {
    const elementRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const [isExporting, setIsExporting] = useState(false);

    const handleDownloadCertificate = async () => {
        if (!elementRef.current) return;
        setIsExporting(true);
        toast({ title: "Generating Commemoration...", description: "Please wait while we render your high-fidelity milestone card." });
        try {
            const canvas = await html2canvas(elementRef.current, { 
                scale: 3, 
                backgroundColor: '#09090b',
                logging: false,
                useCORS: true
            });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `zeneva-milestone-${daysActive}days.png`;
            link.href = dataUrl;
            link.click();
            toast({ variant: "success", title: "Card Downloaded", description: "Your commemorative achievement card is now saved!" });
        } catch (e) {
            toast({ variant: "destructive", title: "Export Failed", description: "Unable to capture image canvas." });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl p-0 overflow-visible border-none bg-transparent backdrop-blur-none flex justify-center items-center shadow-none no-capture [&>button]:text-white/50">
                <DialogTitle className="sr-only">Zeneva OS Platform Genesis Milestone</DialogTitle>
                <DialogDescription className="sr-only">Commemorative dashboard visualizing operational growth and visionary trajectory.</DialogDescription>
                <div className="relative group max-w-3xl w-full mx-auto px-4" ref={elementRef}>
                    {/* Dynamic gradient background wrapper */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 via-emerald-500 to-cyan-500 rounded-[2.5rem] blur-xl opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                    
                    <div className="relative bg-zinc-950 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden ring-1 ring-white/10 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
                        
                        {/* COLUMN 1: ACHIEVEMENT BADGE */}
                        <div className="relative px-6 py-8 flex flex-col items-center text-center overflow-hidden">
                            {/* Atmospheric lighting */}
                            <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-indigo-500/20 to-transparent pointer-events-none"></div>
                            <div className="absolute -right-24 -top-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
                            
                            {/* Bouncing Trophy */}
                            <div className="relative bg-white/5 border border-white/10 p-5 rounded-3xl mt-2 mb-4 shadow-inner flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-yellow-400/10 rounded-3xl blur-sm"></div>
                                <Trophy className="h-12 w-12 text-amber-400 relative z-10 animate-bounce" />
                            </div>

                            <span className="text-[9px] uppercase tracking-[0.3em] font-black text-indigo-400 mb-2 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 select-none">Platform Genesis</span>
                            <h2 className="text-3xl font-black tracking-tight text-white select-none flex items-center gap-1">
                                ZENEVA OS
                            </h2>
                            
                            {/* Massive Counter */}
                            <div className="my-6 px-8 py-3 rounded-3xl bg-gradient-to-b from-white/[0.07] to-transparent border border-white/10 backdrop-blur-md shadow-[inset_0px_1px_1px_rgba(255,255,255,0.1)] relative overflow-hidden w-full max-w-[220px]">
                                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-600 leading-none select-none">
                                    {daysActive}
                                </div>
                                <div className="text-[9px] uppercase font-black tracking-[0.25em] text-cyan-400 mt-2 select-none">Days Online</div>
                            </div>

                            <p className="text-xs text-zinc-400 font-medium mb-6 leading-relaxed select-none max-w-[260px]">
                                Active on the grid since <span className="text-zinc-100 font-bold underline decoration-dotted decoration-indigo-400 underline-offset-2">{format(launchDate, 'PPP')}</span>.
                            </p>

                            {/* Grid Stats */}
                            <div className="w-full grid grid-cols-3 gap-2 bg-white/[0.03] border border-white/5 rounded-2xl p-3 mb-6 select-none">
                                <div className="flex flex-col p-1 items-center justify-center">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Accounts</span>
                                    <span className="text-sm font-black text-white mt-0.5">+{totalUsers}</span>
                                </div>
                                <div className="flex flex-col border-x border-white/10 p-1 items-center justify-center">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Coverage</span>
                                    <span className="text-sm font-black text-white mt-0.5">+{totalBusinesses}</span>
                                </div>
                                <div className="flex flex-col p-1 items-center justify-center">
                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Volume</span>
                                    <span className="text-sm font-black text-emerald-400 mt-0.5">+{totalSales.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Download Button */}
                            <Button onClick={handleDownloadCertificate} disabled={isExporting} size="sm" variant="outline" className="w-full bg-white/5 hover:bg-white/10 border-white/10 text-white rounded-2xl font-bold no-capture flex items-center justify-center gap-2 h-10 text-xs shadow-lg active:scale-[0.98] transition-transform mt-auto">
                                <Download className="h-3.5 w-3.5 text-zinc-300" /> {isExporting ? "Capturing..." : "Commemorate Badge"}
                            </Button>
                        </div>

                        {/* COLUMN 2: DYNAMIC DYNAMIC PLATFORM INTELLIGENCE */}
                        <div className="relative px-6 py-8 flex flex-col bg-white/[0.01] overflow-hidden">
                            <div className="absolute -left-24 -bottom-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

                            {/* Header */}
                            <div className="flex items-center gap-2 mb-4 text-emerald-400 font-extrabold tracking-widest text-[9px] uppercase">
                                <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" /> Platform Intelligence Pulse
                            </div>
                            
                            <h3 className="text-xl font-black text-white mb-1.5 tracking-tight select-none">Real-time Velocity</h3>
                            <p className="text-[10px] text-zinc-400 leading-relaxed mb-6 select-none">
                                Continuous live ecosystem calculations aggregated from all active platform storefront nodes.
                            </p>

                            {/* Timeline Flow replacement: Dynamic KPI stack */}
                            <div className="space-y-3 relative flex-grow select-none">
                                {/* Metric 1: Frequency Pulse */}
                                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20">
                                            <Zap className="h-4 w-4 text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Frequency Pulse</p>
                                            <p className="text-[11px] font-semibold text-zinc-300">Transaction Flow Rate</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-white">{(averageReceiptsPerDay || 0).toFixed(2)} <span className="text-[8px] text-zinc-500 uppercase tracking-wider font-bold">/day</span></p>
                                    </div>
                                </div>

                                {/* Metric 2: Daily Economic Volume */}
                                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                                            <DollarSign className="h-4 w-4 text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Economic Volume</p>
                                            <p className="text-[11px] font-semibold text-zinc-300">Avg. Daily Sales GMV</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-emerald-400">₦{(averageSalesPerDay || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                    </div>
                                </div>

                                {/* Metric 3: Basket size */}
                                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-cyan-500/10 p-2 rounded-xl border border-cyan-500/20">
                                            <ShoppingCart className="h-4 w-4 text-cyan-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Ecosystem Basket</p>
                                            <p className="text-[11px] font-semibold text-zinc-300">Average Order Value</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-white">₦{(platformAOV || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                    </div>
                                </div>

                                {/* Metric 4: Projections */}
                                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                                            <TrendingUp className="h-4 w-4 text-rose-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Software Target</p>
                                            <p className="text-[11px] font-semibold text-zinc-300">Annual Target Runrate</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-white">₦{(arr || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Active Territory Footer Quote */}
                            <div className="mt-6 pt-4 text-[9px] text-zinc-500 border-t border-white/5 font-medium flex items-center justify-between select-none">
                                <span className="uppercase tracking-wider font-bold text-[8px]">Dominant Regional Territory:</span>
                                <span className="flex items-center gap-1 text-zinc-300 font-extrabold uppercase tracking-wide">
                                    <MapPin className="h-3 w-3 text-emerald-400" /> {topLocation}
                                </span>
                            </div>
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ======================== USAGE ANALYTICS TAB COMPONENT ========================

// ======================== BEHAVIOR / PAGE-VISIT ANALYTICS ========================

/**
 * One session's ordered route log, written by UserActivityTracker to
 * `users/{uid}/journey/{sessionId}`. Read here with a collection-group query.
 */
interface JourneyDoc {
    id: string;
    uid?: string;
    sessionId?: string;
    startedAt?: any;
    endedAt?: any;
    routes?: { path: string; at: number }[];
    isFirstSession?: boolean;
    deviceType?: string;
}

/**
 * Collapses dynamic segments so `/customers/AbC123...` and `/customers/XyZ789...`
 * aggregate into one `/customers/:id` row instead of a long tail of single hits.
 * Mirrors routeKey() in UserActivityTracker, but keeps slashes for display.
 */
function pageLabel(path: string): string {
    const cleaned = String(path || '').split('?')[0].split('#')[0];
    const segments = cleaned.split('/').filter(Boolean);
    if (!segments.length) return '/';
    const normalised = segments.map(seg =>
        (seg.length >= 16 || /^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg)) ? ':id' : seg
    );
    return '/' + normalised.join('/');
}

const RANGE_OPTIONS = [
    { days: 1, label: 'Last 24 hours' },
    { days: 7, label: 'Last 7 days' },
    { days: 30, label: 'Last 30 days' },
    { days: 90, label: 'Last 90 days' },
    { days: 0, label: 'All time' },
] as const;

function UsageAnalyticsTab({ users, businesses }: { users: UserProfile[]; businesses: BusinessInstance[] }) {
    const firestore = useFirestore();
    const [sortField, setSortField] = useState<'usage' | 'name' | 'lastSeen'>('usage');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [drillUser, setDrillUser] = useState<UserProfile | null>(null);
    const [journeys, setJourneys] = useState<JourneyDoc[]>([]);
    const [journeysLoading, setJourneysLoading] = useState(true);

    // Time window driving every behavior figure on this tab. 0 = all time.
    const [rangeDays, setRangeDays] = useState<number>(30);
    // Filters for the first-run list, so it is queryable rather than a top-N peek.
    const [signupSearch, setSignupSearch] = useState('');
    const [signupFilter, setSignupFilter] = useState<'all' | 'activated' | 'inactive'>('all');
    // Tracks which user rows have been expanded to show their full page trail.
    const [expandedSignupIds, setExpandedSignupIds] = useState<Set<string>>(new Set());
    const toggleSignupExpand = (id: string) =>
        setExpandedSignupIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    // The user whose full journey detail sheet is open.
    const [journeyDetailUser, setJourneyDetailUser] = useState<(typeof visibleSignups)[0] | null>(null);

    // Every session's route log, across all users. Capped so a large tenant
    // can't turn opening this tab into an unbounded read.
    useEffect(() => {
        if (!firestore) return;
        let cancelled = false;
        setJourneysLoading(true);

        withFirestoreRetry(
            () => getDocs(query(collectionGroup(firestore, 'journey'), limit(2000))),
            { label: 'Page-visit journeys' },
        )
            .then(snap => {
                if (cancelled) return;
                setJourneys(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            })
            .catch(err => {
                if (!cancelled) console.error('Failed to load page-visit journeys', err);
            })
            .finally(() => {
                if (!cancelled) setJourneysLoading(false);
            });

        return () => { cancelled = true; };
    }, [firestore]);

    const todayStart = startOfDay(new Date());

    // KPIs
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeNow = useMemo(() =>
        users.filter(u => u.lastSeen?.toDate && u.lastSeen.toDate() > fiveMinAgo).length,
        [users]
    );

    const usersWithUsage = users.filter(u => (u.totalUsageSeconds ?? 0) > 0);
    const totalUsageSeconds = usersWithUsage.reduce((sum, u) => sum + (u.totalUsageSeconds ?? 0), 0);
    const avgSessionSeconds = usersWithUsage.length > 0 ? Math.round(totalUsageSeconds / usersWithUsage.length) : 0;
    const totalHours = Math.round(totalUsageSeconds / 3600);

    /**
     * Everything derived from the route logs: which pages get used, when, and
     * what a brand-new signup actually does on their first run.
     */
    const behavior = useMemo(() => {
        const now = Date.now();
        // rangeDays 0 means all time; everything below keys off this one window
        // so the range selector drives every figure on the tab, not just a chart.
        const windowStart = rangeDays > 0 ? now - rangeDays * 24 * 60 * 60 * 1000 : 0;

        // ── Top pages + traffic buckets, from every route entry in range ──
        const pageCounts = new Map<string, number>();
        const viewsByBucket = new Map<string, number>();
        const usersByBucket = new Map<string, Set<string>>();
        let totalViews = 0;

        // Sub-day ranges are bucketed hourly; anything longer, daily. Otherwise a
        // 24h view collapses into one or two columns and shows nothing.
        const hourly = rangeDays === 1;
        const bucketKey = (ms: number) => format(new Date(ms), hourly ? 'yyyy-MM-dd HH' : 'yyyy-MM-dd');

        for (const j of journeys) {
            const uid = j.uid || '';
            for (const r of j.routes ?? []) {
                const at = typeof r?.at === 'number' ? r.at : 0;
                if (!at || at < windowStart) continue;
                const label = pageLabel(r.path);
                pageCounts.set(label, (pageCounts.get(label) || 0) + 1);
                totalViews++;

                const key = bucketKey(at);
                viewsByBucket.set(key, (viewsByBucket.get(key) || 0) + 1);
                if (uid) {
                    if (!usersByBucket.has(key)) usersByBucket.set(key, new Set());
                    usersByBucket.get(key)!.add(uid);
                }
            }
        }

        const topPages = [...pageCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([page, views]) => ({ page, views }));

        // Fill every bucket in the window so a quiet day reads as a zero rather
        // than closing the gap and implying continuous traffic. All-time falls
        // back to 90 days of buckets so the axis stays readable.
        const dailySeries: { date: string; views: number; users: number }[] = [];
        const bucketCount = hourly ? 24 : Math.min(rangeDays || 90, 90);
        const step = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        for (let i = bucketCount - 1; i >= 0; i--) {
            const ms = now - i * step;
            const key = bucketKey(ms);
            dailySeries.push({
                date: format(new Date(ms), hourly ? 'HH:00' : 'MMM d'),
                views: viewsByBucket.get(key) || 0,
                users: usersByBucket.get(key)?.size || 0,
            });
        }

        // ── First-run behavior ──
        // Earliest journey per user is their first run, regardless of window.
        const firstJourneyByUid = new Map<string, JourneyDoc>();
        for (const j of journeys) {
            if (!j.uid) continue;
            const started = toDate(j.startedAt)?.getTime() ?? j.routes?.[0]?.at ?? 0;
            const existing = firstJourneyByUid.get(j.uid);
            const existingStart = existing
                ? (toDate(existing.startedAt)?.getTime() ?? existing.routes?.[0]?.at ?? 0)
                : Infinity;
            if (!existing || started < existingStart) firstJourneyByUid.set(j.uid, j);
        }

        // Every signup in the window — no top-N cap; the list is filtered and
        // scrolled in the UI instead.
        const signupsInRange = users
            .filter(u => (toDate(u.createdAt)?.getTime() ?? 0) >= windowStart)
            .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
            .map(u => {
                const first = firstJourneyByUid.get(u.id);
                const steps = (first?.routes ?? [])
                    .map(r => ({ label: pageLabel(r.path), at: r.at }))
                    // Collapse immediate repeats so a refresh doesn't read as a step.
                    .filter((s, i, arr) => i === 0 || s.label !== arr[i - 1].label);
                return {
                    user: u,
                    steps,
                    startedAt: toDate(first?.startedAt),
                    signedUpAt: toDate(u.createdAt),
                    isFirstSession: first?.isFirstSession === true,
                };
            });

        // Activation = signed up AND opened at least one tracked page.
        const activated = signupsInRange.filter(s => s.steps.length > 0);
        const activationRate = signupsInRange.length
            ? Math.round((activated.length / signupsInRange.length) * 100)
            : 0;
        // One page then gone — the clearest bounce signal we have.
        const bounced = activated.filter(s => s.steps.length === 1).length;
        const avgFirstRunDepth = activated.length
            ? Math.round((activated.reduce((n, s) => n + s.steps.length, 0) / activated.length) * 10) / 10
            : 0;

        // Where new users land first, and where they go next.
        const entryCounts = new Map<string, number>();
        for (const s of activated) {
            const entry = s.steps[0]?.label;
            if (entry) entryCounts.set(entry, (entryCounts.get(entry) || 0) + 1);
        }
        const entryPages = [...entryCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([page, count]) => ({ page, count }));

        const activeUids = new Set<string>();
        for (const j of journeys) {
            const started = toDate(j.startedAt)?.getTime() ?? j.routes?.[0]?.at ?? 0;
            if (started >= windowStart && j.uid) activeUids.add(j.uid);
        }

        return {
            topPages,
            dailySeries,
            hourly,
            totalViews,
            avgViewsPerUser: activeUids.size ? Math.round(totalViews / activeUids.size) : 0,
            signupsInRange,
            newSignupCount: signupsInRange.length,
            activatedCount: activated.length,
            activationRate,
            bounced,
            avgFirstRunDepth,
            entryPages,
            activeUsers: activeUids.size,
            sessionsTracked: journeys.length,
        };
    }, [journeys, users, rangeDays]);

    const rangeLabel = RANGE_OPTIONS.find(o => o.days === rangeDays)?.label ?? 'Last 30 days';

    // The first-run list after the search box and status filter are applied.
    const visibleSignups = useMemo(() => {
        const q = signupSearch.trim().toLowerCase();
        return behavior.signupsInRange.filter(s => {
            if (signupFilter === 'activated' && s.steps.length === 0) return false;
            if (signupFilter === 'inactive' && s.steps.length > 0) return false;
            if (!q) return true;
            return (
                (s.user.name || '').toLowerCase().includes(q) ||
                (s.user.email || '').toLowerCase().includes(q)
            );
        });
    }, [behavior.signupsInRange, signupSearch, signupFilter]);

    // Per-user rows
    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => {
            let valA: number, valB: number;
            if (sortField === 'usage') {
                valA = a.totalUsageSeconds ?? 0;
                valB = b.totalUsageSeconds ?? 0;
            } else if (sortField === 'lastSeen') {
                valA = a.lastSeen?.toDate ? a.lastSeen.toDate().getTime() : 0;
                valB = b.lastSeen?.toDate ? b.lastSeen.toDate().getTime() : 0;
            } else {
                return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            return sortDir === 'asc' ? valA - valB : valB - valA;
        });
    }, [users, sortField, sortDir]);

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Right Now</CardTitle>
                        <Activity className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-500">{activeNow}</div>
                        <p className="text-xs text-muted-foreground mt-1">Users seen in last 5 min</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Usage / User</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatDuration(avgSessionSeconds)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across {usersWithUsage.length} tracked users</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Usage Hours</CardTitle>
                        <Timer className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalHours.toLocaleString()}h</div>
                        <p className="text-xs text-muted-foreground mt-1">Cumulative all-time platform usage</p>
                    </CardContent>
                </Card>
            </div>

            {/* Behavior KPIs — everything below is derived from the route logs */}
            {/* Range selector — drives every behavior figure below */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-bold">Behavior Analytics</h3>
                    <p className="text-xs text-muted-foreground">
                        Page-visit data for {rangeLabel.toLowerCase()}.
                    </p>
                </div>
                <Select value={String(rangeDays)} onValueChange={v => setRangeDays(Number(v))}>
                    <SelectTrigger className="w-[190px]">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {RANGE_OPTIONS.map(o => (
                            <SelectItem key={o.days} value={String(o.days)}>{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                        <BarChart2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{behavior.totalViews.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {rangeLabel} · {behavior.sessionsTracked.toLocaleString()} sessions tracked
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Views / Active User</CardTitle>
                        <Layers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{behavior.avgViewsPerUser.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Depth per user who showed up</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{behavior.activeUsers}</div>
                        <p className="text-xs text-muted-foreground mt-1">Opened at least one page</p>
                    </CardContent>
                </Card>
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Activation Rate</CardTitle>
                        <PartyPopper className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">{behavior.activationRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {behavior.activatedCount} of {behavior.newSignupCount} signups opened a page
                        </p>
                    </CardContent>
                </Card>
            </div>

            {journeysLoading ? (
                <Card>
                    <CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                        <Loader className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading page-visit behavior…</span>
                    </CardContent>
                </Card>
            ) : behavior.totalViews === 0 && behavior.newSignupCount === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <BarChart2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
                        <p className="mt-3 text-sm font-medium">No page-visit data in this range</p>
                        <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                            Behavior tracking starts once users open the app on a build that includes it.
                            Existing users will begin reporting on their next session.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Traffic over time */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                Traffic — {rangeLabel}
                            </CardTitle>
                            <CardDescription>
                                Page views against the number of distinct users producing them. A views line that
                                climbs while users stays flat means the same people are going deeper, not that more
                                people arrived.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ReLineChart data={behavior.dailySeries}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis yAxisId="left" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis yAxisId="right" orientation="right" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                                        <ReTooltip contentStyle={{ fontSize: 12 }} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="views"
                                            name="Page views"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="users"
                                            name="Distinct users"
                                            stroke="#22c55e"
                                            strokeWidth={2}
                                            strokeDasharray="4 3"
                                            dot={false}
                                        />
                                    </ReLineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Most visited pages */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart2 className="h-5 w-5 text-primary" />
                                Most Visited Pages — {rangeLabel}
                            </CardTitle>
                            <CardDescription>
                                Where users actually spend their clicks. Dynamic routes are grouped, so
                                <code className="mx-1 rounded bg-muted px-1 text-[11px]">/customers/:id</code>
                                counts every customer detail view as one row.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[360px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ReBarChart data={behavior.topPages} layout="vertical" margin={{ left: 40, right: 16 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="page"
                                            width={150}
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <ReTooltip
                                            formatter={(v: any) => [`${Number(v).toLocaleString()} views`, 'Views']}
                                            contentStyle={{ fontSize: 12 }}
                                        />
                                        <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                    </ReBarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* First-run behavior for brand new users */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PartyPopper className="h-5 w-5 text-primary" />
                                New User First Run
                                <Badge variant="secondary" className="ml-1 text-[10px]">
                                    {visibleSignups.length} of {behavior.newSignupCount}
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                The exact page sequence each new signup followed on their first session — the clearest
                                read on whether onboarding lands or people bounce off it. Showing every signup in
                                {' '}{rangeLabel.toLowerCase()}, searchable by name or email.
                            </CardDescription>

                            {/* Insight strip: the summary the raw list can't give you */}
                            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="rounded-lg border bg-muted/30 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Activated</p>
                                    <p className="text-lg font-bold">{behavior.activationRate}%</p>
                                    <p className="text-[10px] text-muted-foreground">opened ≥1 page</p>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Never opened</p>
                                    <p className="text-lg font-bold">{behavior.newSignupCount - behavior.activatedCount}</p>
                                    <p className="text-[10px] text-muted-foreground">signed up, no session</p>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bounced</p>
                                    <p className="text-lg font-bold">{behavior.bounced}</p>
                                    <p className="text-[10px] text-muted-foreground">one page, then left</p>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">First-run depth</p>
                                    <p className="text-lg font-bold">{behavior.avgFirstRunDepth}</p>
                                    <p className="text-[10px] text-muted-foreground">avg pages visited</p>
                                </div>
                            </div>

                            {/* Where new users land first */}
                            {behavior.entryPages.length > 0 && (
                                <div className="mt-3 rounded-lg border p-3">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        First page opened
                                    </p>
                                    <div className="mt-2 space-y-1.5">
                                        {behavior.entryPages.map(e => (
                                            <div key={e.page} className="flex items-center gap-2">
                                                <span className="w-40 shrink-0 truncate font-mono text-[11px]">{e.page}</span>
                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-primary"
                                                        style={{ width: `${Math.round((e.count / behavior.entryPages[0].count) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                                                    {e.count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Query controls */}
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={signupSearch}
                                        onChange={e => setSignupSearch(e.target.value)}
                                        placeholder="Search name or email…"
                                        className="h-9 pl-8 text-sm"
                                    />
                                </div>
                                <Select value={signupFilter} onValueChange={(v: any) => setSignupFilter(v)}>
                                    <SelectTrigger className="h-9 w-full text-sm sm:w-[190px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All signups</SelectItem>
                                        <SelectItem value="activated">Activated only</SelectItem>
                                        <SelectItem value="inactive">Never opened a page</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent className="max-h-[620px] space-y-3 overflow-y-auto">

                            {/* ── Behaviour insights panel ── */}
                            {visibleSignups.length > 0 && (() => {
                                // Compute quick path insights from current visible set
                                const withSteps = visibleSignups.filter(s => s.steps.length > 0);
                                const hitOnboarding = withSteps.filter(s => s.steps.some(p => p.label === '/onboarding')).length;
                                const hitDashboard  = withSteps.filter(s => s.steps.some(p => p.label === '/dashboard')).length;
                                const hitPOS        = withSteps.filter(s => s.steps.some(p => p.label === '/sales/pos/select-products')).length;
                                const loopedBack    = withSteps.filter(s => {
                                    const seen = new Set<string>();
                                    for (const p of s.steps) {
                                        if (seen.has(p.label)) return true;
                                        seen.add(p.label);
                                    }
                                    return false;
                                }).length;
                                const bounced = withSteps.filter(s => s.steps.length === 1).length;
                                const pct = (n: number) => withSteps.length ? `${Math.round((n / withSteps.length) * 100)}%` : '—';
                                const insights: { icon: string; text: string; tone: string }[] = [];
                                if (hitOnboarding) insights.push({ icon: '🎯', text: `${pct(hitOnboarding)} of activated users reached /onboarding.`, tone: 'text-primary' });
                                if (hitDashboard)  insights.push({ icon: '📊', text: `${pct(hitDashboard)} made it to the dashboard — good activation signal.`, tone: 'text-green-600' });
                                if (hitPOS)        insights.push({ icon: '🛒', text: `${pct(hitPOS)} tried the POS in their first session — strong intent.`, tone: 'text-emerald-600' });
                                if (loopedBack)    insights.push({ icon: '🔄', text: `${pct(loopedBack)} revisited the same page — possible confusion or deliberate exploration.`, tone: 'text-amber-600' });
                                if (bounced)       insights.push({ icon: '🚪', text: `${bounced} user${bounced !== 1 ? 's' : ''} opened only one page before leaving.`, tone: 'text-destructive' });
                                const loginLoop = withSteps.filter(s => {
                                    const seq = s.steps.map(p => p.label);
                                    for (let i = 0; i < seq.length - 1; i++) {
                                        if ((seq[i] === '/login' || seq[i] === '/signup') && (seq[i+1] === '/login' || seq[i+1] === '/signup')) return true;
                                    }
                                    return false;
                                }).length;
                                if (loginLoop) insights.push({ icon: '⚠️', text: `${loginLoop} user${loginLoop !== 1 ? 's' : ''} ping-ponged between /login and /signup — auth confusion.`, tone: 'text-orange-600' });
                                if (insights.length === 0) return null;
                                return (
                                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 mb-1">
                                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">🔍 Behavioural Insights</p>
                                        <ul className="space-y-1">
                                            {insights.map((ins, i) => (
                                                <li key={i} className={`text-xs ${ins.tone} flex items-start gap-1.5`}>
                                                    <span>{ins.icon}</span>
                                                    <span>{ins.text}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })()}

                            {visibleSignups.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    {behavior.newSignupCount === 0
                                        ? `No signups in ${rangeLabel.toLowerCase()}.`
                                        : 'No signups match this search or filter.'}
                                </p>
                            ) : visibleSignups.map(({ user: u, steps, startedAt, signedUpAt, isFirstSession }) => {
                                const isExpanded = expandedSignupIds.has(u.id);
                                const PREVIEW = 12;
                                const visibleSteps = isExpanded ? steps : steps.slice(0, PREVIEW);
                                const hiddenCount  = steps.length - PREVIEW;
                                return (
                                <div key={u.id} className="rounded-lg border p-3 cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-colors" onClick={() => setJourneyDetailUser({ user: u, steps, startedAt, signedUpAt, isFirstSession })}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">{u.name || u.email}</p>
                                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                            <div className="flex items-center gap-2">
                                                {steps.length === 0 ? (
                                                    <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
                                                        Never opened
                                                    </Badge>
                                                ) : steps.length === 1 ? (
                                                    <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-600">
                                                        Bounced
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">
                                                        {steps.length} pages
                                                    </Badge>
                                                )}
                                                {isFirstSession && (
                                                    <Badge variant="secondary" className="text-[10px]">First session</Badge>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-muted-foreground">
                                                {signedUpAt ? `Joined ${formatDistanceToNow(signedUpAt, { addSuffix: true })}` : 'Join date unknown'}
                                            </span>
                                            {startedAt && (
                                                <span className="text-[11px] text-muted-foreground">
                                                    First seen {formatDistanceToNow(startedAt, { addSuffix: true })}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {steps.length === 0 ? (
                                        <p className="mt-2 text-xs italic text-muted-foreground">
                                            Signed up but has not opened a tracked page yet.
                                        </p>
                                    ) : (
                                        <>
                                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                                {visibleSteps.map((s, i) => (
                                                    <span key={`${s.at}-${i}`} className="flex items-center gap-1.5">
                                                        {i > 0 && <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                                                        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px]">
                                                            {s.label}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                            {steps.length > PREVIEW && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); toggleSignupExpand(u.id); }}
                                                    className="mt-2 flex items-center gap-1 text-[11px] text-primary hover:underline"
                                                >
                                                    {isExpanded
                                                        ? <><ChevronUp className="h-3 w-3" /> Collapse</>  
                                                        : <><ChevronDown className="h-3 w-3" /> Show all {hiddenCount} more pages</>}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    {/* ── Per-user journey detail Sheet ── */}
                    <Sheet open={!!journeyDetailUser} onOpenChange={open => { if (!open) setJourneyDetailUser(null); }}>
                        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                            {journeyDetailUser && (() => {
                                const { user: ju, steps: js, startedAt: jStart, signedUpAt: jSignup } = journeyDetailUser;

                                // --- compute analytics ---
                                // Page frequency
                                const freq = new Map<string, number>();
                                js.forEach(s => freq.set(s.label, (freq.get(s.label) || 0) + 1));
                                const freqSorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);

                                // Time between steps (ms)
                                const gaps: { from: string; to: string; ms: number }[] = [];
                                for (let i = 0; i < js.length - 1; i++) {
                                    const ms = js[i + 1].at - js[i].at;
                                    if (ms >= 0 && ms < 30 * 60 * 1000) { // ignore gaps > 30 min (idle)
                                        gaps.push({ from: js[i].label, to: js[i + 1].label, ms });
                                    }
                                }
                                const totalSessionMs = gaps.reduce((n, g) => n + g.ms, 0);
                                const avgGapMs = gaps.length ? totalSessionMs / gaps.length : 0;

                                // Time spent per page (sum of all gaps where `from` = that page)
                                const timePerPage = new Map<string, number>();
                                gaps.forEach(g => timePerPage.set(g.from, (timePerPage.get(g.from) || 0) + g.ms));

                                // Loop detection (same page visited more than once)
                                const loops = [...freq.entries()].filter(([, c]) => c > 1).map(([p, c]) => ({ page: p, count: c }));

                                // Where they stopped (last page visited)
                                const lastPage = js[js.length - 1]?.label ?? '—';

                                // Key journey stages
                                const hitOnboarding = js.some(s => s.label === '/onboarding');
                                const hitDashboard  = js.some(s => s.label === '/dashboard');
                                const hitPOS        = js.some(s => s.label === '/sales/pos/select-products');
                                const hitInventory  = js.some(s => s.label === '/inventory');
                                const hitBilling    = js.some(s => s.label === '/billing');
                                const hitSettings   = js.some(s => s.label === '/settings');
                                const loginLoops    = js.filter(s => s.label === '/login' || s.label === '/signup').length;

                                const fmtMs = (ms: number) => {
                                    if (ms < 1000) return '<1s';
                                    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
                                    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
                                };
                                const fmtTime = (at: number) => { try { return format(new Date(at), 'HH:mm:ss'); } catch { return '—'; } };

                                // Auto-generated insights
                                const observations: { icon: string; text: string; tone: string }[] = [];
                                const onboardingCompleted = ju.surveyCompleted === true || (hitOnboarding && hitDashboard);
                                const posTime = timePerPage.get('/sales/pos/select-products') || 0;
                                const usedPOS = hitPOS && posTime > 5000;

                                if (js.length === 0) observations.push({ icon: '👻', text: 'Never opened a page after signing up.', tone: 'text-destructive' });
                                if (js.length === 1) observations.push({ icon: '🚪', text: `Bounced on the first page (${js[0]?.label}).`, tone: 'text-destructive' });
                                if (usedPOS && !onboardingCompleted) observations.push({ icon: '⚡', text: 'Skipped onboarding and went straight to the POS — likely has prior experience.', tone: 'text-emerald-600' });
                                if (usedPOS && onboardingCompleted) observations.push({ icon: '✅', text: 'Completed onboarding and used the POS — strong activation.', tone: 'text-green-600' });
                                if (!hitDashboard && js.length > 3) observations.push({ icon: '🗺️', text: 'Explored several pages but never reached the dashboard — may be disoriented.', tone: 'text-amber-600' });
                                if (loginLoops > 3) observations.push({ icon: '⚠️', text: `Hit /login or /signup ${loginLoops} times — likely had auth trouble.`, tone: 'text-orange-600' });
                                if (loops.length > 0) observations.push({ icon: '🔄', text: `Revisited: ${loops.map(l => `${l.page} ×${l.count}`).join(', ')}.`, tone: 'text-amber-600' });
                                if (hitBilling) observations.push({ icon: '💳', text: 'Visited /billing — upgrade intent detected.', tone: 'text-primary' });
                                if (totalSessionMs > 5 * 60 * 1000) observations.push({ icon: '⏱️', text: `Active for ~${fmtMs(totalSessionMs)} in their first session.`, tone: 'text-muted-foreground' });
                                if (totalSessionMs > 0 && totalSessionMs < 60 * 1000 && js.length > 5) observations.push({ icon: '⚡', text: 'Very fast navigation — possibly a power user or just clicking through quickly.', tone: 'text-blue-600' });
                                if (hitSettings) observations.push({ icon: '⚙️', text: 'Visited /settings in first session — exploring account control early.', tone: 'text-muted-foreground' });
                                if (hitInventory && hitPOS) observations.push({ icon: '📦', text: 'Explored both Inventory and POS — treating the app as an end-to-end workflow.', tone: 'text-emerald-600' });
                                if (lastPage === '/login' || lastPage === '/signup') observations.push({ icon: '🔐', text: 'Last page was an auth page — may have logged out or hit an auth error.', tone: 'text-destructive' });

                                return (
                                    <>
                                        <SheetHeader className="pb-4 border-b">
                                            <SheetTitle className="text-lg">{ju.name || ju.email}</SheetTitle>
                                            <SheetDescription className="text-xs text-muted-foreground">
                                                {ju.email} · Joined {jSignup ? formatDistanceToNow(jSignup, { addSuffix: true }) : 'unknown'} · {js.length} pages in first session
                                            </SheetDescription>
                                        </SheetHeader>

                                        <div className="mt-4 space-y-5">

                                            {/* Key milestone badges */}
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Journey Milestones</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {[
                                                        { label: 'Onboarding', hit: hitOnboarding },
                                                        { label: 'Dashboard',  hit: hitDashboard },
                                                        { label: 'POS',        hit: hitPOS },
                                                        { label: 'Inventory',  hit: hitInventory },
                                                        { label: 'Billing',    hit: hitBilling },
                                                        { label: 'Settings',   hit: hitSettings },
                                                    ].map(m => (
                                                        <span key={m.label} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${m.hit ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-muted/40 border-muted text-muted-foreground line-through'}`}>
                                                            {m.hit ? '✓ ' : ''}{m.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Session stats */}
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { label: 'Pages visited', value: js.length },
                                                    { label: 'Unique pages', value: freq.size },
                                                    { label: 'Session time', value: totalSessionMs > 0 ? fmtMs(totalSessionMs) : '—' },
                                                    { label: 'Avg per page', value: avgGapMs > 0 ? fmtMs(avgGapMs) : '—' },
                                                    { label: 'Looped pages', value: loops.length },
                                                    { label: 'Last page', value: lastPage.length > 12 ? lastPage.slice(0, 12) + '…' : lastPage },
                                                ].map(stat => (
                                                    <div key={stat.label} className="rounded-lg border bg-muted/30 p-2 text-center">
                                                        <p className="text-base font-bold">{stat.value}</p>
                                                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Observations */}
                                            {observations.length > 0 && (
                                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">🔍 Observations</p>
                                                    <ul className="space-y-1.5">
                                                        {observations.map((o, i) => (
                                                            <li key={i} className={`text-xs flex items-start gap-1.5 ${o.tone}`}>
                                                                <span className="shrink-0">{o.icon}</span>
                                                                <span>{o.text}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Page frequency table */}
                                            {freqSorted.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Page Frequency</p>
                                                    <div className="rounded-lg border overflow-hidden text-xs">
                                                        <table className="w-full">
                                                            <thead className="bg-muted/50">
                                                                <tr>
                                                                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Page</th>
                                                                    <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Visits</th>
                                                                    <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Time spent</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y">
                                                                {freqSorted.map(([page, count]) => (
                                                                    <tr key={page} className="hover:bg-muted/20">
                                                                        <td className="px-3 py-1.5 font-mono text-[11px]">{page}</td>
                                                                        <td className="px-3 py-1.5 text-right tabular-nums">
                                                                            {count}{count > 1 && <span className="ml-1 text-amber-600 text-[10px]">🔄</span>}
                                                                        </td>
                                                                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                                                                            {timePerPage.has(page) ? fmtMs(timePerPage.get(page)!) : '—'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Full step-by-step timeline */}
                                            {js.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Full Page Timeline</p>
                                                    <ol className="relative border-l border-muted ml-2 space-y-1">
                                                        {js.map((s, i) => {
                                                            const gap = i < js.length - 1 ? js[i + 1].at - s.at : null;
                                                            const isLoop = (freq.get(s.label) || 0) > 1;
                                                            return (
                                                                <li key={`${s.at}-${i}`} className="pl-4 relative">
                                                                    <span className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 ${isLoop ? 'bg-amber-400 border-amber-500' : i === 0 ? 'bg-primary border-primary' : 'bg-muted border-muted-foreground/40'}`} />
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="font-mono text-[11px] font-medium">{s.label}</span>
                                                                        <span className="text-[10px] text-muted-foreground tabular-nums">{fmtTime(s.at)}</span>
                                                                        {gap !== null && gap >= 0 && gap < 30 * 60 * 1000 && (
                                                                            <span className="text-[10px] text-muted-foreground/60">→ {fmtMs(gap)}</span>
                                                                        )}
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ol>
                                                </div>
                                            )}

                                        </div>
                                    </>
                                );
                            })()}
                        </SheetContent>
                    </Sheet>
                </>
            )}

            {/* Per-User Table */}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Timer className="h-5 w-5 text-primary" />
                        Per-User Usage Breakdown
                    </CardTitle>
                    <CardDescription>
                        Cumulative app usage time per user. Tracked since v3.0.0. Click a column header to sort,
                        or click any row to open that user's full usage breakdown.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-md border overflow-auto max-h-[500px]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead>
                                        <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                                            Name <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Business</TableHead>
                                    <TableHead>
                                        <button onClick={() => toggleSort('usage')} className="flex items-center gap-1 hover:text-foreground">
                                            Total Usage <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <button onClick={() => toggleSort('lastSeen')} className="flex items-center gap-1 hover:text-foreground">
                                            Last Seen <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-8" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedUsers.length > 0 ? sortedUsers.map(u => {
                                    const biz = businesses.find(b => b.id === u.businessId);
                                    const lastSeenDate = u.lastSeen?.toDate ? u.lastSeen.toDate() : null;
                                    const isOnline = lastSeenDate && lastSeenDate > fiveMinAgo;
                                    const totalSec = u.totalUsageSeconds ?? 0;
                                    return (
                                        <TableRow
                                            key={u.id}
                                            onClick={() => setDrillUser(u)}
                                            className="cursor-pointer"
                                        >
                                            <TableCell className="font-medium">{u.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                                            <TableCell className="text-sm">{biz?.name ?? '—'}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-semibold text-sm">
                                                        {totalSec > 0 ? formatDuration(totalSec) : <span className="text-muted-foreground text-xs">No data yet</span>}
                                                    </span>
                                                    {totalSec > 3600 && <Badge variant="outline" className="text-xs text-primary border-primary/40">Power User</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {lastSeenDate ? formatDistanceToNow(lastSeenDate, { addSuffix: true }) : 'Never'}
                                            </TableCell>
                                            <TableCell>
                                                {isOnline ? (
                                                    <span className="flex items-center gap-1.5 text-green-500 text-xs font-semibold">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                                        </span>
                                                        Online
                                                    </span>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs text-muted-foreground">Offline</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                <ArrowRight className="h-4 w-4" />
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                            No users found. Usage data will appear here once users log in after v3.0.0.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/*
                Product intelligence: what the behaviour data says about the app
                itself, rather than about who used it. Fed from the `users` array
                this tab already holds, so the whole section costs no extra reads.
            */}
            <ProductIntelligence users={users} />

            {/*
                Notification engagement: does the bell earn the interruption.
                Same deal as above — derived from the `users` and `businesses`
                arrays this tab already holds, so it costs no extra reads.
            */}
            <NotificationEngagement users={users} businesses={businesses} />

            <UserUsageDetailDialog
                user={drillUser}
                business={businesses.find(b => b.id === drillUser?.businessId)}
                open={!!drillUser}
                onOpenChange={(v) => { if (!v) setDrillUser(null); }}
            />
        </div>
    );
}

// ======================== PER-USER USAGE DRILL-DOWN ========================
// UsageSession, toDate and UserUsageDetailDialog now live in
// '@/components/admin/user-detail/*' so the standalone /users pages share them.

// ==============================================================================

function UserDetailDialog({ user, business, open, onOpenChange }: { user: UserProfile | null, business: BusinessInstance | undefined, open: boolean, onOpenChange: (open: boolean) => void }) {
    if (!user) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[95vw]">
                <DialogHeader>
                    <DialogTitle>{user?.name}'s Profile</DialogTitle>
                    <DialogDescription>Detailed view of user account and associated business data.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className='col-span-2'>
                            <Label className="text-xs text-muted-foreground font-bold">Business Name</Label>
                            <p className="font-medium text-lg">{business?.name || 'N/A'}</p>
                        </div>

                        <div className='col-span-2'>
                            <Label className="text-xs text-muted-foreground font-bold">Business Category</Label>
                            <p className="font-medium">{business?.settings?.industry || 'N/A'}</p>
                        </div>

                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">Contact Phone</Label>
                            <p className="font-medium">{business?.settings?.phone || user.phone || 'N/A'}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">Contact Email</Label>
                            <p className="font-medium">{business?.settings?.email || user.email || 'N/A'}</p>
                        </div>

                        <div className='col-span-2'>
                            <Label className="text-xs text-muted-foreground font-bold">Address</Label>
                            <p className="font-medium">{business?.address || 'N/A'}</p>
                        </div>

                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">State</Label>
                            <p className="font-medium">{business?.settings?.state || 'N/A'}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">Country</Label>
                            <p className="font-medium">{business?.settings?.country || 'N/A'}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">Currency</Label>
                            <p className="font-medium">{business?.settings?.currency || 'NGN'}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">Plan</Label>
                            <div className="mt-1">
                                {business ? (
                                    business.accessLevel === 'lifetime' ? <Badge variant="default" className="bg-green-600">Lifetime</Badge> : <Badge variant="secondary" className="capitalize">{business.plan || 'starter'}</Badge>
                                ) : <Badge variant="outline">N/A</Badge>}
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">User Status</Label>
                            <div className="mt-1">
                                <Badge variant={user.status === 'inactive' ? 'destructive' : 'outline'} className="capitalize">
                                    {user.status || 'active'}
                                </Badge>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">Last Seen</Label>
                            <div className="mt-1">
                                <UserPresence lastSeen={user.lastSeen} />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">Date Joined</Label>
                            <p className="font-medium mt-1">
                                {user.createdAt ? (
                                    (() => {
                                        try {
                                            const d = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
                                            return format(d, 'PPP');
                                        } catch (e) {
                                            return 'N/A';
                                        }
                                    })()
                                ) : 'N/A'}
                            </p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">App & Device Platforms</Label>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 font-medium">
                                {(() => {
                                    const { hasMicrosoftApp, hasMobileApp, hasWeb, isCrossPlatform } = classifyUserPlatform(user);
                                    return (
                                        <>
                                            {hasMicrosoftApp && (
                                                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs">
                                                    <Laptop className="h-3 w-3 mr-1" /> Microsoft App
                                                </Badge>
                                            )}
                                            {hasMobileApp && (
                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs">
                                                    <Smartphone className="h-3 w-3 mr-1" /> Mobile App
                                                </Badge>
                                            )}
                                            {hasWeb && (
                                                <Badge variant="outline" className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 text-xs">
                                                    <Globe className="h-3 w-3 mr-1" /> Web
                                                </Badge>
                                            )}
                                            {isCrossPlatform && (
                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-semibold text-xs">
                                                    ✨ PC + Mobile
                                                </Badge>
                                            )}
                                            {!hasMicrosoftApp && !hasMobileApp && !hasWeb && (
                                                <span className="text-xs text-muted-foreground">{user.deviceType || 'Web Browser'}</span>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">App Version & Release Status</Label>
                            <div className="mt-1 flex items-center gap-2">
                                {user.appVersion ? (
                                    isVersionLatest(user.appVersion) ? (
                                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-mono font-bold flex items-center gap-1.5">
                                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                            v{user.appVersion} (Latest Release)
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs font-mono font-semibold flex items-center gap-1.5">
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                            v{user.appVersion} (Outdated · Latest is v{AppConfig.version})
                                        </Badge>
                                    )
                                ) : (
                                    <Badge variant="outline" className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 text-xs flex items-center gap-1.5">
                                        <Globe className="h-3.5 w-3.5 opacity-60" /> Web Browser (No native app build)
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div>
                            {/* Labelled "Login Location (IP)" until now, but the value
                                is `country` and `UserProfile.ip` has no writer anywhere
                                in the app — so the label promised an address that was
                                never going to appear. */}
                            <Label className="text-xs text-muted-foreground font-bold">Login Location</Label>
                            <div className="mt-1 flex items-center gap-1.5 font-medium">
                                <Globe className="h-4 w-4 text-primary" />
                                <span>{user.country || 'Unknown'}</span>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground font-bold">App Language</Label>
                            <div className="mt-1 flex items-center gap-1.5 font-medium">
                                <Languages className="h-4 w-4 text-violet-500" />
                                {(() => {
                                    const lang = userLanguage(user.language);
                                    if (!lang) return <span>Unknown</span>;
                                    return <span>{lang.nativeLabel} <span className="text-xs text-muted-foreground">({lang.label})</span></span>;
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ======================== BUSINESS DETAIL DIALOG ========================

function BusinessIntelDialog({
    business, owner, businessProducts, businessReceipts, businessUsers = [], businessBranches = [], open, onOpenChange,
}: {
    business: BusinessInstance | null;
    owner: UserProfile | null;
    businessProducts: Product[];
    businessReceipts: Receipt[];
    businessUsers?: UserProfile[];
    businessBranches?: any[];
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    if (!business) return null;

    const productCount = businessProducts.length;
    const totalStock = businessProducts.reduce((s, p) => s + (p.stock || 0), 0);
    const productsWithImages = businessProducts.filter(p => p.imageUrl);
    const totalRevenue = businessReceipts.reduce((s, r) => s + (r.total || 0), 0);

    const unitsSold = businessReceipts.reduce((s, r) =>
        s + (r.items || []).reduce((si, item) => si + (item.quantity || 0), 0), 0);

    const salesByProduct: Record<string, { name: string; qty: number }> = {};
    businessReceipts.forEach(r => {
        (r.items || []).forEach(item => {
            if (!salesByProduct[item.productId]) salesByProduct[item.productId] = { name: item.name, qty: 0 };
            salesByProduct[item.productId].qty += item.quantity || 0;
        });
    });
    const topProduct = Object.values(salesByProduct).sort((a, b) => b.qty - a.qty)[0] || null;
    const estimatedStorageMB = ((productsWithImages.length * 200) / 1024).toFixed(1);

    const uploadPattern = useMemo(() => {
        const sorted = [...businessProducts]
            .filter(p => p.createdAt)
            .sort((a, b) => {
                const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return ta - tb;
            });
        if (sorted.length < 2) return { type: 'manual', batches: [] as any[], avgGapMins: 0, maxGapMins: 0, minGapMins: 0 };

        const gaps: number[] = [];
        const batches: { start: Date; count: number; gapMinutes: number | null }[] = [];
        let currentBatchStart = sorted[0].createdAt.toDate ? sorted[0].createdAt.toDate() : new Date(sorted[0].createdAt);
        let currentBatchCount = 1;

        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1].createdAt?.toDate ? sorted[i - 1].createdAt.toDate() : new Date(sorted[i - 1].createdAt || 0);
            const curr = sorted[i].createdAt?.toDate ? sorted[i].createdAt.toDate() : new Date(sorted[i].createdAt || 0);
            const diffMins = (curr.getTime() - prev.getTime()) / 60000;
            gaps.push(diffMins);
            if (diffMins < 5) {
                currentBatchCount++;
            } else {
                batches.push({ start: currentBatchStart, count: currentBatchCount, gapMinutes: diffMins });
                currentBatchStart = curr;
                currentBatchCount = 1;
            }
        }
        batches.push({ start: currentBatchStart, count: currentBatchCount, gapMinutes: null });

        const avgGapMins = gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0;
        const maxGapMins = gaps.length > 0 ? Math.max(...gaps) : 0;
        const minGapMins = gaps.length > 0 ? Math.min(...gaps) : 0;
        const bulkGaps = gaps.filter(g => g < 2).length;
        const isBulk = gaps.length > 0 && (bulkGaps / gaps.length) > 0.6;
        return { type: isBulk ? 'bulk' : 'manual', batches, avgGapMins, maxGapMins, minGapMins };
    }, [businessProducts]);

    const currency = business.settings?.currency === 'USD' ? '$' : '₦';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[95vw]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Store className="h-5 w-5 text-primary" />
                        {business.name}
                    </DialogTitle>
                    <DialogDescription>Deep inventory &amp; sales intelligence for this business.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-2">
                    {/* KPI Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Products', icon: Package, value: productCount, color: 'text-foreground' },
                            { label: 'Total Stock Units', icon: Layers, value: totalStock.toLocaleString(), color: 'text-foreground' },
                            { label: 'Units Sold', icon: ShoppingCart, value: unitsSold.toLocaleString(), color: 'text-foreground' },
                            // "Sales", not "Revenue": this is what the shop sold, in the
                            // shop's own currency. Zeneva's revenue is the subscription
                            // figure on the dashboard, and one word kept the two apart.
                            { label: 'Total Sales', icon: DollarSign, value: `${currency}${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: 'text-emerald-500' },
                        ].map(({ label, icon: Icon, value, color }) => (
                            <div key={label} className="rounded-xl border bg-card p-3 space-y-1">
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-1">
                                    <Icon className="h-3 w-3" />{label}
                                </p>
                                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Secondary stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
                            <div className="bg-blue-500/10 p-2 rounded-lg flex-shrink-0"><Database className="h-4 w-4 text-blue-500" /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Est. Storage Used</p>
                                <p className="font-bold text-sm">~{estimatedStorageMB} MB</p>
                                <p className="text-[10px] text-muted-foreground">{productsWithImages.length} images uploaded</p>
                            </div>
                        </div>
                        <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
                            <div className="bg-amber-500/10 p-2 rounded-lg flex-shrink-0"><Trophy className="h-4 w-4 text-amber-500" /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Best-Selling Product</p>
                                <p className="font-bold text-sm truncate" title={topProduct?.name}>{topProduct?.name || '—'}</p>
                                <p className="text-[10px] text-muted-foreground">{topProduct ? `${topProduct.qty} units sold` : 'No sales yet'}</p>
                            </div>
                        </div>
                        <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
                            <div className="bg-purple-500/10 p-2 rounded-lg flex-shrink-0"><Users className="h-4 w-4 text-purple-500" /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Business Owner</p>
                                <p className="font-bold text-sm truncate">{owner?.name || '—'}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{owner?.email || '—'}</p>
                            </div>
                        </div>
                        <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
                            <div className="bg-emerald-500/10 p-2 rounded-lg flex-shrink-0"><Building className="h-4 w-4 text-emerald-500" /></div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Locations & Staff</p>
                                <p className="font-bold text-sm truncate">{businessBranches.length || 1} Branches</p>
                                <p className="text-[10px] text-muted-foreground truncate">{businessUsers.length} Users</p>
                            </div>
                        </div>
                    </div>

                    {/* Upload Pattern */}
                    <div className="rounded-xl border p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <Timer className="h-4 w-4 text-primary" />
                                Upload Pattern Analysis
                            </h3>
                            <Badge variant="outline" className={uploadPattern.type === 'bulk'
                                ? 'bg-orange-500/10 text-orange-600 border-orange-500/30'
                                : 'bg-green-500/10 text-green-600 border-green-500/30'
                            }>
                                {uploadPattern.type === 'bulk' ? '⚡ Bulk Import Detected' : '✋ Manual / Gradual Uploads'}
                            </Badge>
                        </div>

                        {productCount >= 2 ? (
                            <div className="space-y-3">
                                <p className="text-xs text-muted-foreground">
                                    {uploadPattern.type === 'bulk'
                                        ? 'Most products were uploaded in rapid bursts (under 2 min apart) — likely a bulk import via CSV or rapid copy-paste.'
                                        : 'Products were uploaded manually over time with meaningful gaps between each.'}
                                </p>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-muted/50 rounded-lg p-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Avg Gap</p>
                                        <p className="font-bold text-sm">{uploadPattern.avgGapMins < 60 ? `${uploadPattern.avgGapMins.toFixed(1)}m` : `${(uploadPattern.avgGapMins / 60).toFixed(1)}h`}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Fastest Upload</p>
                                        <p className="font-bold text-sm text-orange-500">{uploadPattern.minGapMins < 1 ? `${(uploadPattern.minGapMins * 60).toFixed(0)}s` : `${uploadPattern.minGapMins.toFixed(1)}m`}</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Longest Gap</p>
                                        <p className="font-bold text-sm">{uploadPattern.maxGapMins < 60 ? `${uploadPattern.maxGapMins.toFixed(0)}m` : `${(uploadPattern.maxGapMins / 60).toFixed(1)}h`}</p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Upload Batches ({uploadPattern.batches.length})</p>
                                    <ScrollArea className="h-28">
                                        <div className="space-y-1 pr-2">
                                            {uploadPattern.batches.map((batch, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded-md px-3 py-1.5">
                                                    <span className="text-muted-foreground">{format(batch.start, 'MMM d, yyyy • HH:mm')}</span>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] font-bold">{batch.count} product{batch.count !== 1 ? 's' : ''}</Badge>
                                                        {batch.gapMinutes !== null && (
                                                            <span className="text-muted-foreground text-[10px]">→ {batch.gapMinutes < 60 ? `${batch.gapMinutes.toFixed(0)}m gap` : `${(batch.gapMinutes / 60).toFixed(1)}h gap`} before next</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">Need at least 2 products to analyse upload pattern.</p>
                        )}
                    </div>

                    {/* Product image gallery */}
                    {productsWithImages.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <Globe className="h-4 w-4 text-primary" />
                                Product Images ({productsWithImages.length} / {productCount})
                            </h3>
                            <ScrollArea className="h-44">
                                <div className="flex flex-wrap gap-2 pr-2">
                                    {productsWithImages.map(p => (
                                        <div key={p.id} className="relative group w-[72px] h-[72px] rounded-lg overflow-hidden border bg-muted flex-shrink-0 cursor-pointer">
                                            <img
                                                src={p.imageUrl}
                                                alt={p.name}
                                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = ''; (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                            />
                                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                                                <p className="text-[9px] text-white leading-tight line-clamp-2">{p.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {productCount === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">This business has no products yet.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ==============================================================================
//  MAIN DASHBOARD CONTENT COMPONENT
// ==============================================================================

function AdminDashboardContent({
    users, businesses, products, receipts, purchases, applications, downloadClicks, grants, checkoutAttempts, branches, onRefresh, isRefreshing,
    storefrontShares = [], receiptShares = [], onlineOrders = [], importAttempts = []
}: {
    users: any[];
    businesses: any[];
    products: any[];
    receipts: any[];
    purchases: any[];
    applications: any[];
    downloadClicks: any[];
    grants: any[];
    checkoutAttempts: any[];
    branches?: any[];
    onRefresh?: () => void;
    isRefreshing?: boolean;
    storefrontShares?: any[];
    receiptShares?: any[];
    onlineOrders?: any[];
    importAttempts?: any[];
}) {

    const firestore = useFirestore();
    const { toast } = useToast();

    // Platform totals for the tab headings. The listeners feeding these tables
    // are capped at ADMIN_LOG_LIMIT rows, so the headings are counted on the
    // server; each falls back to the loaded row count until it resolves.
    const applicationsTotal = useCollectionCount('job_applications');
    const grantsTotal = useCollectionCount('grants');
    const storefrontSharesTotal = useCollectionCount('storefront_shares');
    const receiptSharesTotal = useCollectionCount('receipt_shares');
    const onlineOrdersTotal = useCollectionCount('onlineOrders', true);

    const normalizeTimestamp = (ts: any) => {
        if (!ts) return { toDate: () => new Date() };
        if (typeof ts.toDate === 'function') return ts;
        if (ts.seconds) return { toDate: () => new Date(ts.seconds * 1000) };
        if (ts instanceof Date) return { toDate: () => ts };
        if (typeof ts === 'string' || typeof ts === 'number') return { toDate: () => new Date(ts) };
        return { toDate: () => new Date() };
    };

    const convertedReceipts = useMemo(() => {
        if (!receipts) return [];
        return receipts.map(r => {
            const biz = businesses?.find(b => b.id === r.businessId);
            const isUSD = biz?.settings?.currency === 'USD';
            const normalizedR = {
                ...r,
                createdAt: normalizeTimestamp(r.createdAt),
            };
            if (isUSD) {
                const rate = biz?.settings?.usdToNgnRate || 1500;
                return {
                    ...normalizedR,
                    total: normalizedR.total * rate,
                    subtotal: normalizedR.subtotal * rate,
                    tax: (normalizedR.tax || 0) * rate,
                    discount: (normalizedR.discount || 0) * rate,
                    profit: normalizedR.profit ? normalizedR.profit * rate : undefined,
                    items: normalizedR.items?.map(i => ({ ...i, price: i.price * rate, total: i.total * rate })) || []
                };
            }
            return normalizedR;
        });
    }, [receipts, businesses]);

    // Bounded: the Comms Center renders this as a newest-first history list with
    // no pagination, and every broadcast ever sent accumulates here.
    const systemBroadcastsQuery = useMemoFirebase(() => query(collection(firestore, 'system_broadcasts'), orderBy('createdAt', 'desc'), limit(ADMIN_LOG_LIMIT)), [firestore]);
    const { data: systemBroadcasts } = useCollection<any>(systemBroadcastsQuery);

    const [grantEmail, setGrantEmail] = useState('');
    const [grantDate, setGrantDate] = useState<Date>();
    const [isGranting, setIsGranting] = useState(false);
    const [isRevoking, setIsRevoking] = useState(false);
    const [grantLifetime, setGrantLifetime] = useState(false);

    const selectedUserForGrant = useMemo(() => (users || []).find(u => u.email === grantEmail), [users, grantEmail]);
    const selectedBusinessForGrant = useMemo(() => selectedUserForGrant ? (businesses || []).find(b => b.id === selectedUserForGrant.businessId) : null, [businesses, selectedUserForGrant]);
    const hasLifetime = !!(selectedBusinessForGrant && selectedBusinessForGrant.accessLevel === 'lifetime');
    const [userStatusEmail, setUserStatusEmail] = useState('');
    const [isUserActive, setIsUserActive] = useState(true);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [planUserEmail, setPlanUserEmail] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'business'>('starter');
    const [isAssigningPlan, setIsAssigningPlan] = useState(false);
    const [haltUserEmail, setHaltUserEmail] = useState('');
    const [isHalting, setIsHalting] = useState(false);

    const [liveBusinessStatus, setLiveBusinessStatus] = useState<string | null>(null);

    useEffect(() => {
        if (!haltUserEmail || !users || !firestore) {
            setLiveBusinessStatus(null);
            return;
        }
        const u = users.find(u => u.email === haltUserEmail);
        if (!u || !u.businessId) {
            setLiveBusinessStatus(null);
            return;
        }

        const unsubscribe = onSnapshot(doc(firestore, 'businessInstances', u.businessId), (docSnap) => {
            if (docSnap.exists()) {
                const status = docSnap.data().status || 'active';
                const isH = docSnap.data().isHalted === true;
                setLiveBusinessStatus(isH || status === 'halted' ? 'halted' : 'active');
            }
        });

        return () => unsubscribe();
    }, [haltUserEmail, users, firestore]);

    // Compute whether the selected user's business is halted
    const selectedHaltBusiness = useMemo(() => {
        if (!haltUserEmail || !users || !businesses) return null;
        const u = users.find(u => u.email === haltUserEmail);
        if (!u || !u.businessId) return null;
        return businesses.find(b => b.id === u.businessId);
    }, [haltUserEmail, users, businesses]);

    const isSelectedBusinessHalted = liveBusinessStatus === 'halted';

    const [detailModalState, setDetailModalState] = useState<{ open: boolean; title: string; description: string; businesses: BusinessInstance[]; isInfoOnly?: boolean }>({ open: false, title: '', description: '', businesses: [], isInfoOnly: false });
    const [userListModalState, setUserListModalState] = useState<{ open: boolean; title: string; description: string; users: UserProfile[] }>({ open: false, title: '', description: '', users: [] });
    const [isAgeMilestoneOpen, setIsAgeMilestoneOpen] = useState(false);
    const [isTopPerformersOpen, setIsTopPerformersOpen] = useState(false);
    const [isSaaSMetricsOpen, setIsSaaSMetricsOpen] = useState(false);
    const [isDownloadIntelOpen, setIsDownloadIntelOpen] = useState(false);
    const [isImportIntelOpen, setIsImportIntelOpen] = useState(false);
    const [certificateModalState, setCertificateModalState] = useState<{ open: boolean; title: string; description: string; value: string; icon: any; } | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadReport = async () => {
        const element = cardRef.current;
        if (!element) return;
        setIsDownloading(true);
        toast({ title: "Generating Report...", description: "Please wait while we capture the admin metrics." });
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#09090b',
                logging: false,
                useCORS: true,
                ignoreElements: (el) => el.classList.contains('no-capture')
            });
            const data = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = data;
            link.download = `zeneva-admin-report-${new Date().toISOString().split('T')[0]}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ variant: 'success', title: 'Report Downloaded', description: 'Your admin report has been saved.' });
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not capture the admin report.' });
        } finally {
            setIsDownloading(false);
        }
    };
    const [selectedUserForDetail, setSelectedUserForDetail] = useState<UserProfile | null>(null);
    const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);
    const [selectedBusinessForIntel, setSelectedBusinessForIntel] = useState<BusinessInstance | null>(null);
    const [isBusinessIntelOpen, setIsBusinessIntelOpen] = useState(false);
    const [isSalesVelocityOpen, setIsSalesVelocityOpen] = useState(false);
    const [velocityFilter, setVelocityFilter] = useState<'7' | '14' | '30' | '90'>('14');
    const [isCreateGrantOpen, setIsCreateGrantOpen] = useState(false);
    const [isPublishingGrant, setIsPublishingGrant] = useState(false);
    const [totalSubscribers, setTotalSubscribers] = useState(0);
    
    // --- PERSISTENT CACHE FOR OUTREACH ---
    const [outreachLogs, setOutreachLogs] = useState<any[]>([]);
    const [outreachSentCount, setOutreachSentCount] = useState(0);
    const [isOutreachLoading, setIsOutreachLoading] = useState(false);
    const [hasLoadedOutreach, setHasLoadedOutreach] = useState(false);

    const fetchOutreachData = async (force = false) => {
        // PREVENT REDUNDANT FETCHING: Return early if already loaded and not forced
        // This addresses the user's concern about cost and redundant reads.
        if (hasLoadedOutreach && !force) {
            console.log("Admin Intelligence: Outreach cache hit, skipping fetch.");
            return;
        }
        
        // Intel Mission: Query Firestore directly for logs to bypass 404 in static desktop environment
        try {
            const logsQuery = query(
                collection(firestore, 'follow_up_logs'),
                orderBy('sentAt', 'desc')
            );
            const snapshot = await withFirestoreRetry(() => getDocs(logsQuery), {
                label: 'Admin outreach logs',
            });
            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
            
            setOutreachLogs(logs);
            setOutreachSentCount(logs.filter(log => log.status !== 'failed').length);
            setHasLoadedOutreach(true);
        } catch (error) {
            console.error('Failed to fetch outreach logs from Firestore:', error);
        } finally {
            setIsOutreachLoading(false);
        }
    };

    useEffect(() => {
        const fetchSubscribers = async () => {
            try {
                // Intel Mission: Directly query the analytics overview document
                const analyticsRef = doc(firestore, 'admin_analytics', 'overview');
                const analyticsDoc = await withFirestoreRetry(() => getDoc(analyticsRef), {
                    label: 'Admin analytics overview',
                });
                
                if (analyticsDoc.exists()) {
                    const data = analyticsDoc.data();
                    if (data.appInstalls !== undefined) {
                        setTotalSubscribers(data.appInstalls);
                    } else if (data.totalUsers !== undefined) {
                        setTotalSubscribers(data.totalUsers);
                    }
                } else {
                    // Fallback to counting users if overview doc missing
                    setTotalSubscribers(users?.length || 0);
                }
            } catch (error) {
                console.error("Error fetching platform overview data from Firestore:", error);
            }
        };
        fetchSubscribers();
    }, [firestore]);

    // Broadcast State
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'alert'>('info');
    const [broadcastDuration, setBroadcastDuration] = useState('24'); // hours
    const [broadcastLink, setBroadcastLink] = useState('');
    const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

    // Feature Release Announcement State
    const [featureTitle, setFeatureTitle] = useState('Zeneva is Now Available on Google Play Store!');
    const [featureBadge, setFeatureBadge] = useState('v3.3.0 Update');
    const [featureDescription, setFeatureDescription] = useState('Download Zeneva directly on your Android phone or tablet from the Google Play Store! Manage sales, monitor inventory, and access Zen AI on the go.');
    const [featureVideoUrl, setFeatureVideoUrl] = useState('');
    const [featureActionText, setFeatureActionText] = useState('Get on Play Store');
    const [featureActionHref, setFeatureActionHref] = useState('https://play.google.com/store/apps/details?id=com.zeneva.app');
    const [isSavingFeatureUpdate, setIsSavingFeatureUpdate] = useState(false);

    // User Management State
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'active' | 'joined' | 'name'>('active');
    const [filterPlan, setFilterPlan] = useState<'all' | 'starter' | 'pro' | 'business' | 'lifetime'>('all');
    const [filterPlatform, setFilterPlatform] = useState<string>('all');

    const userOptions = useMemo(() => (users || []).map(user => {
        const bizName = businesses?.find(b => b.id === user.businessId)?.name;
        return {
            value: user.email,
            label: `${bizName || user.name || 'Unknown User'} (${user.email})`
        };
    }), [users, businesses]);

    const handleDeleteApplication = async (appId: string) => {
        if (!confirm('Are you sure you want to delete this application?')) return;
        try {
            await deleteDoc(doc(firestore, 'job_applications', appId));
            toast({ title: "Intelligence Action: Target Deleted", description: "The career application has been removed from the sector." });
        } catch (error) {
            console.error("Error deleting application:", error);
            toast({ variant: "destructive", title: "Action Failed", description: "Failed to remove the application. Data integrity maintained." });
        }
    };

    const handleDeleteGrant = async (grantId: string) => {
        if (!confirm('Are you sure you want to remove this grant from the directory?')) return;
        try {
            await deleteDoc(doc(firestore, 'grants', grantId));
            toast({ title: "Action Successful", description: "The grant opportunity has been deleted." });
        } catch (error) {
            console.error("Error deleting grant:", error);
            toast({ variant: "destructive", title: "Action Failed", description: "Failed to remove the grant." });
        }
    };

    const handleCreateGrant = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsPublishingGrant(true);
        const formData = new FormData(e.currentTarget);
        try {
            await addDoc(collection(firestore, 'grants'), {
                title: formData.get('title'),
                funder: formData.get('funder'),
                amount: formData.get('amount'),
                eligibility: formData.get('eligibility'),
                description: formData.get('description'),
                applicationUrl: formData.get('applicationUrl'),
                createdAt: serverTimestamp()
            });
            toast({ variant: 'success', title: 'Grant Published!', description: 'The new grant has been added to the directory.' });
            setIsCreateGrantOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: error.message || 'Failed to publish grant.' });
        } finally {
            setIsPublishingGrant(false);
        }
    };

    const processedUsers = useMemo(() => {
        let baseUsers = users || [];
        
        // Deduplicate users by email, merging their platform footprints
        const userMap = new Map<string, typeof baseUsers[0]>();
        
        for (const u of baseUsers) {
            if (!u.email) continue;
            const key = u.email.toLowerCase();
            const existing = userMap.get(key);
            
            if (!existing) {
                userMap.set(key, { ...u, platformsUsed: [...(u.platformsUsed || (u.deviceType ? [u.deviceType] : []))] });
            } else {
                // Merge platforms
                const existingPlatforms = existing.platformsUsed || [];
                const newPlatforms = u.platformsUsed || (u.deviceType ? [u.deviceType] : []);
                existing.platformsUsed = Array.from(new Set([...existingPlatforms, ...newPlatforms]));
                
                // Merge user agents for classification
                if ((u as any).userAgent) {
                    (existing as any).userAgent = ((existing as any).userAgent || '') + ' ' + (u as any).userAgent;
                }
                
                // Keep the most recent lastLoginAt and businessId
                const existingDate = safeToDate(existing.lastLoginAt)?.getTime() || 0;
                const newDate = safeToDate(u.lastLoginAt)?.getTime() || 0;
                if (newDate > existingDate) {
                    existing.lastLoginAt = u.lastLoginAt;
                    existing.businessId = u.businessId; // Prefer the tenant of the most recent login
                    existing.id = u.id; // Keep primary id of the active one
                }
                
                // Keep best name
                if (u.name && (!existing.name || u.name.length > existing.name.length)) {
                    existing.name = u.name;
                }
            }
        }
        
        let result = Array.from(userMap.values());

        // 1. Search
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(u =>
                u.name.toLowerCase().includes(lowerQuery) ||
                u.email.toLowerCase().includes(lowerQuery) ||
                (businesses?.find(b => b.id === u.businessId)?.name || '').toLowerCase().includes(lowerQuery)
            );
        }

        // 2. Filter by Plan
        if (filterPlan !== 'all') {
            result = result.filter(u => {
                const business = businesses?.find(b => b.id === u.businessId);
                // If no business, assume starter/no plan unless looking for strictly starter
                if (!business) return filterPlan === 'starter';

                if (filterPlan === 'lifetime') return business.accessLevel === 'lifetime';
                if (filterPlan === 'starter') return (!business.plan || business.plan === 'starter') && business.accessLevel !== 'lifetime';
                return business.plan === filterPlan && business.accessLevel !== 'lifetime';
            });
        }

        // 3. Filter by Platform / Device
        if (filterPlatform !== 'all') {
            result = result.filter(u => {
                const pInfo = classifyUserPlatform(u);
                if (filterPlatform === 'microsoft') return pInfo.hasMicrosoftApp;
                if (filterPlatform === 'mobile') return pInfo.hasMobileApp;
                if (filterPlatform === 'multi') return pInfo.isCrossPlatform;
                if (filterPlatform === 'web') return pInfo.hasWeb && !pInfo.hasMicrosoftApp && !pInfo.hasMobileApp;
                return true;
            });
        }

        // 4. Sort
        return [...result].sort((a, b) => {
            if (sortBy === 'active') { // Most recent first
                const dateA = a.lastSeen?.toDate ? a.lastSeen.toDate() : new Date(0);
                const dateB = b.lastSeen?.toDate ? b.lastSeen.toDate() : new Date(0);
                return dateB.getTime() - dateA.getTime();
            } else if (sortBy === 'joined') { // Newest first
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateB.getTime() - dateA.getTime();
            } else {
                return a.name.localeCompare(b.name);
            }
        });
    }, [users, businesses, searchQuery, filterPlan, filterPlatform, sortBy]);

    const platformAnalytics = useMemo(() => {
        const activeBusinesses = businesses?.filter(b => b.status !== 'deleted') || [];
        const productsByBusiness = (products || []).reduce((acc, p) => {
            if (!acc[p.businessId]) acc[p.businessId] = [];
            acc[p.businessId].push(p);
            return acc;
        }, {} as Record<string, Product[]>);

        const receiptsByBusiness = (convertedReceipts || []).reduce((acc, r) => {
            if (!acc[r.businessId]) acc[r.businessId] = [];
            acc[r.businessId].push(r);
            return acc;
        }, {} as Record<string, Receipt[]>);

        const activatedBusinessesList = activeBusinesses.filter(b => {
            const busProducts = productsByBusiness[b.id] || [];
            const busReceipts = receiptsByBusiness[b.id] || [];
            return busProducts.length >= 10 && busReceipts.length >= 1;
        });

        const fourteenDaysAgo = subDays(new Date(), 14);
        const businessesWithRecentSales = new Set(
            (convertedReceipts || []).filter(r => r.createdAt.toDate() > fourteenDaysAgo).map(r => r.businessId)
        );
        const atRiskBusinesses = activeBusinesses.filter(b => !businessesWithRecentSales.has(b.id));

        const payingBusinessIds = new Set((purchases || []).map(p => p.businessId));
        const payingBusinessesList = activeBusinesses.filter(b => {
            return payingBusinessIds.has(b.id);
        });

        const healthScores = activeBusinesses.map(b => (b.settings?.businessAnalysis as any)?.health?.score ?? -1);
        const healthDistribution = {
            healthy: healthScores.filter(s => s >= 70).length,
            attention: healthScores.filter(s => s >= 40 && s < 70).length,
            atRisk: healthScores.filter(s => s >= 0 && s < 40).length,
        };
        const healthDistributionData = [
            { name: 'Healthy', value: healthDistribution.healthy, fill: PIE_CHART_COLORS.Healthy },
            // { name: 'Needs Attention', value: healthDistribution.attention, fill: PIE_CHART_COLORS['Needs Attention'] }, // User requested removal
            { name: 'At Risk', value: healthDistribution.atRisk, fill: PIE_CHART_COLORS['At Risk'] },
        ];

        const sevenDaysAgo = subDays(new Date(), 7);
        const thirtyDaysAgo = subDays(new Date(), 30);
        const aiUsersLast7Days = new Set(activeBusinesses.filter(b => b.settings?.businessAnalysis?.createdAt?.toDate() > sevenDaysAgo || b.settings?.aiTroubleshootSuggestions?.createdAt?.toDate() > sevenDaysAgo).map(b => b.id)).size;
        const aiUsersLast30Days = new Set(activeBusinesses.filter(b => b.settings?.businessAnalysis?.createdAt?.toDate() > thirtyDaysAgo || b.settings?.aiTroubleshootSuggestions?.createdAt?.toDate() > thirtyDaysAgo).map(b => b.id)).size;

        const businessAnalysisUsers = activeBusinesses.filter(b => b.settings?.businessAnalysis).length;
        const troubleshootUsers = activeBusinesses.filter(b => b.settings?.aiTroubleshootSuggestions).length;

        const aiAdoption7 = activeBusinesses.length > 0 ? (aiUsersLast7Days / activeBusinesses.length) * 100 : 0;
        const aiAdoption30 = activeBusinesses.length > 0 ? (aiUsersLast30Days / activeBusinesses.length) * 100 : 0;

        // --- POWER FEATURES ANALYTICS ---

        // 1. Churn Prediction
        const churnRiskList = activeBusinesses.map(b => {
            const owner = users?.find(u => u.id === b.ownerId);
            const lastSeen = owner?.lastSeen?.toDate ? owner.lastSeen.toDate() : null;
            const daysSinceLogin = lastSeen ? differenceInDays(new Date(), lastSeen) : 999;

            // Check sales activity
            const busReceipts = receiptsByBusiness[b.id] || [];
            const recentSales = busReceipts.filter(r => r.createdAt.toDate() > subDays(new Date(), 7)).length;

            let riskScore = 0;
            let riskFactors = [];

            if (daysSinceLogin > 7) { riskScore += 30; riskFactors.push('Inactive > 7 days'); }
            if (daysSinceLogin > 30) { riskScore += 50; riskFactors.push('Inactive > 30 days'); }
            if (recentSales === 0 && busReceipts.length > 0) { riskScore += 20; riskFactors.push('No sales in 7 days'); }

            return { business: b, owner, riskScore, riskFactors, daysSinceLogin };
        }).filter(item => item.riskScore >= 50).sort((a, b) => b.riskScore - a.riskScore).slice(0, 10); // Top 10 at risk

        // 2. Trial Conversion
        const expiredTrials = activeBusinesses.filter(b => b.trialExpiresAt && b.trialExpiresAt.toDate() < new Date() && (b.plan === 'starter' || !b.plan));
        const paidUsers = activeBusinesses.filter(b => b.plan === 'pro' || b.plan === 'business');
        const conversionRate = (expiredTrials.length + paidUsers.length) > 0
            ? (paidUsers.length / (expiredTrials.length + paidUsers.length)) * 100
            : 0;

        const expiringSoonList = activeBusinesses.filter(b => {
            if (!b.trialExpiresAt || b.plan === 'pro' || b.plan === 'business') return false;
            const expiry = b.trialExpiresAt.toDate();
            const now = new Date();
            const diff = differenceInDays(expiry, now);
            return diff >= 0 && diff <= 3;
        });

        // 3. Geographic & Industry Distribution
        const locationCounts = activeBusinesses.reduce((acc, b) => {
            const state = b.settings?.state || (b.address ? b.address.split(',').pop()?.trim() : undefined) || 'Unknown';
            if (state) acc[state] = (acc[state] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const countryCounts = activeBusinesses.reduce((acc, b) => {
            const country = b.settings?.country || 'Pending Onboarding';
            acc[country] = (acc[country] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const industryCounts = activeBusinesses.reduce((acc, b) => {
            const industry = b.settings?.industry || 'Pending Onboarding';
            acc[industry] = (acc[industry] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topLocations = Object.entries(locationCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const countryData = Object.entries(countryCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // Language adoption, counted per user rather than per business: two staff
        // in the same shop can read Zeneva in different languages. The field is
        // written by UserActivityTracker on its existing 5-minute heartbeat, so
        // this adds no reads - `users` is already loaded for this memo.
        //
        // A user who has not checked in since language tracking shipped has no
        // field yet. That is reported as its own bucket instead of being folded
        // into English, which would overstate English every time.
        const languageUsers = (users || []).filter(u => u.status !== 'deleted');
        const languageCounts: Record<string, number> = {};
        const businessIdsByLanguage: Record<string, Set<string>> = {};

        languageUsers.forEach(u => {
            const key = resolveLocale(u.language) ?? 'unreported';
            languageCounts[key] = (languageCounts[key] || 0) + 1;
            if (!businessIdsByLanguage[key]) businessIdsByLanguage[key] = new Set<string>();
            if (u.businessId) businessIdsByLanguage[key].add(u.businessId);
        });

        const languageData = [
            ...LOCALES.map(def => ({
                code: def.code as string,
                name: def.label,
                nativeName: def.nativeLabel,
                flag: def.flag as string | null,
                value: languageCounts[def.code] || 0,
            })),
            {
                code: 'unreported',
                name: 'Not reported',
                nativeName: 'No check-in since tracking shipped',
                flag: null,
                value: languageCounts.unreported || 0,
            },
        ]
            .filter(entry => entry.value > 0)
            .map(entry => ({
                ...entry,
                share: languageUsers.length ? Math.round((entry.value / languageUsers.length) * 100) : 0,
                businesses: activeBusinesses.filter(b => businessIdsByLanguage[entry.code]?.has(b.id)),
            }))
            .sort((a, b) => b.value - a.value);

        const industryData = Object.entries(industryCounts)
            .map(([name, value]) => ({ 
                name, 
                value,
                fill: `hsl(${(Object.keys(industryCounts).indexOf(name) * 137.5) % 360}, 70%, 50%)`
            }))
            .sort((a, b) => b.value - a.value);

        const businessesWithProductsList = activeBusinesses.filter(b => (productsByBusiness[b.id] || []).length > 0);
        const businessesWithSalesList = activeBusinesses.filter(b => (receiptsByBusiness[b.id] || []).length > 0);

        // Ranked outreach queue. Everything the scorer needs is already indexed
        // above, so this is a cheap projection rather than another pass over the
        // raw collections. See src/lib/outreach-scoring.ts for the model.
        const scoredLeads = rankBusinesses(
            activeBusinesses.map(b => {
                const owner = (users || []).find(u => u.businessId === b.id && u.role === 'admin')
                    || (users || []).find(u => u.businessId === b.id);
                return {
                    id: b.id,
                    businessName: b.name,
                    ownerEmail: owner?.email ?? null,
                    ownerName: owner?.name ?? null,
                    plan: b.plan ?? null,
                    accessLevel: b.accessLevel ?? null,
                    status: b.status ?? null,
                    trialExpiresAt: b.trialExpiresAt,
                    createdAt: b.createdAt,
                    productCount: (productsByBusiness[b.id] || []).length,
                    receiptCount: (receiptsByBusiness[b.id] || []).length,
                };
            }),
            (users || []).map(u => ({
                id: u.id,
                businessId: u.businessId,
                email: u.email,
                name: u.name,
                lastSeen: u.lastSeen,
                totalUsageSeconds: u.totalUsageSeconds ?? null,
                pagesVisited: u.pagesVisited ?? null,
            })),
        );

        return {
            totalActiveBusinesses: activeBusinesses.length,
            activatedBusinessesCount: activatedBusinessesList.length,
            activatedBusinessesList,
            atRiskBusinesses,
            scoredLeads,
            payingBusinessesCount: payingBusinessesList.length,
            payingBusinessesList,
            healthDistribution,
            healthDistributionData,
            aiAdoption7,
            aiAdoption30,
            businessAnalysisUsers,
            troubleshootUsers,
            churnRiskList,
            conversionRate,
            expiringSoonList,
            topLocations,
 
            countryData: countryData.map(c => ({
                ...c,
                businesses: activeBusinesses.filter(b => (b.settings?.country || 'Pending Onboarding') === c.name)
            })),
            languageData,
            languageTrackedUsers: languageUsers.length,
            industryData: industryData.map(i => ({
                ...i,
                businesses: activeBusinesses.filter(b => (b.settings?.industry || 'Pending Onboarding') === i.name)
            })),
            businessesWithProducts: businessesWithProductsList.length,
            businessesWithSales: businessesWithSalesList.length,
            businessesWithProductsList,
            businessesWithSalesList
        }
    }, [businesses, products, convertedReceipts, users, purchases]);
    const analyticsData = useMemo(() => {
        const activeBusinesses = businesses?.filter(b => b.status !== 'deleted') || [];
        const allUsers = users || [];
        const activeUsers = allUsers.filter(u => u.status === 'active' || u.status === 'minimized' || u.status === undefined || !u.status);
        const inactiveUsers = allUsers.filter(u => u.status === 'inactive');

        const totalUsers = activeUsers.length;
        const totalBusinesses = activeBusinesses.length;

        const totalProducts = products?.length || 0;
        const totalReceipts = convertedReceipts?.length || 0;
        const now = new Date();

        const platformGmv = convertedReceipts?.reduce((sum, r) => sum + r.total, 0) || 0;

        const totalProductsSold = convertedReceipts?.reduce((sum, r) => sum + r.items.reduce((itemSum, i) => itemSum + i.quantity, 0), 0) || 0;

        const revenueGeneratingBusinessIds = new Set((convertedReceipts || []).map(r => r.businessId));
        const revenueGeneratingBusinessesCount = revenueGeneratingBusinessIds.size;

        // The company's own accounts. Their payments are test transactions and the
        // plans they sit on are not subscriptions, so both are left out of every
        // revenue figure below. The address list lives in `@/lib/platform-revenue`
        // so this page and the cap table's valuation exclude the same accounts.
        const excludedUserIds = internalOwnerIds(allUsers);

        const validPurchases = (purchases || [])
            .filter(p => {
                const ngnAmount = toNgn(p.amount, p.currency);
                if (ngnAmount <= 0) return false;
                if (p.userId && excludedUserIds.has(p.userId)) return false;
                const biz = activeBusinesses.find(b => b.id === p.businessId);
                if (biz && excludedUserIds.has(biz.ownerId)) return false;
                return true;
            })
            .sort((a, b) => safeToDate(b.timestamp).getTime() - safeToDate(a.timestamp).getTime());

        /*
         * Plan payments and one-off Zen AI credit packs both land in `purchases`,
         * and only the first kind may touch a rate. The MRR loop below reads each
         * business's *latest* payment, so an unsplit ₦2,500 pack bought after a
         * ₦30,000 subscription would report that shop as paying ₦2,500 a month —
         * a pack sale lowering the run rate. Rows with no `kind` predate packs and
         * are all subscriptions. See `src/lib/platform-revenue.ts`.
         */
        const { subscriptions: subscriptionPurchases, creditPacks: creditPackPurchases } = splitPurchases(validPurchases);

        // Normalised to NGN. `amount` is stored in whatever currency the customer
        // paid, so summing it raw adds $30 to ₦30,000 and reports ₦30,030.
        const totalSubscriptionRevenue = subscriptionPurchases.reduce((sum, p) => sum + toNgn(p.amount, p.currency), 0);
        // Real revenue, reported separately because it recurs for nobody.
        const totalCreditPackRevenue = creditPackPurchases.reduce((sum, p) => sum + toNgn(p.amount, p.currency), 0);
        const totalCompanyRevenue = totalSubscriptionRevenue + totalCreditPackRevenue;

        const platformAOV = totalReceipts > 0 ? (platformGmv / totalReceipts) : 0;

        const payingBusinessIds = new Set(subscriptionPurchases.map(p => p.businessId).filter(Boolean));
        const payingBusinesses = activeBusinesses?.filter(b => {
            return payingBusinessIds.has(b.id);
        });

        const billingCurrencies = billingCurrencyByBusiness(validPurchases);

        // Calculate dynamic MRR and ARR strictly from verified Firestore purchases with real money received
        let dynamicMrr = 0;
        let dynamicArr = 0;
        let activePaidSubscriptionsCount = 0;
        let annualSubsCount = 0;
        let monthlySubsCount = 0;
        let annualMrr = 0;
        let monthlyMrr = 0;

        // Group valid subscription purchases by businessId and userId to find the latest subscription payment
        const latestPurchaseByBusiness = new Map<string, any>();
        const latestPurchaseByUser = new Map<string, any>();
        for (const p of subscriptionPurchases) {
            const pTime = safeToDate(p.timestamp).getTime();
            if (p.businessId) {
                const existing = latestPurchaseByBusiness.get(p.businessId);
                const existingTime = existing ? safeToDate(existing.timestamp).getTime() : 0;
                if (!existing || pTime >= existingTime) {
                    latestPurchaseByBusiness.set(p.businessId, p);
                }
            }
            if (p.userId) {
                const existing = latestPurchaseByUser.get(p.userId);
                const existingTime = existing ? safeToDate(existing.timestamp).getTime() : 0;
                if (!existing || pTime >= existingTime) {
                    latestPurchaseByUser.set(p.userId, p);
                }
            }
        }

        const countedPurchaseKeys = new Set<string>();

        // For each active business, calculate MRR/ARR strictly from actual verified payments received
        for (const b of activeBusinesses || []) {
            if (b.status === 'deleted') continue;
            if (b.ownerId && excludedUserIds.has(b.ownerId)) continue;
            if (b.accessLevel === 'lifetime') continue;

            const latestPurchase = latestPurchaseByBusiness.get(b.id) || 
                                   (b.ownerId ? latestPurchaseByUser.get(b.ownerId) : null);

            // ONLY businesses that have a verified purchase with real money received can be counted.
            // No predictive fallback for unverified / unpaid accounts.
            if (latestPurchase) {
                const amount = toNgn(latestPurchase.amount, latestPurchase.currency);
                if (amount <= 0) continue;

                const pKey = latestPurchase.id || latestPurchase.reference || `${b.id}_${latestPurchase.timestamp}`;
                countedPurchaseKeys.add(pKey);

                const planText = String(latestPurchase.plan || '').toLowerCase();
                const pTime = safeToDate(latestPurchase.timestamp).getTime();
                const expiryDate = b.trialExpiresAt ? safeToDate(b.trialExpiresAt) : null;
                const daysAgo = pTime ? (Date.now() - pTime) / (1000 * 60 * 60 * 24) : 999;

                // Determine cycle duration in months from payment amount / plan
                let cycleMonths = 1;
                if (planText.includes('annual') || planText.includes('12m') || planText.includes('1 year') || amount >= 80000) {
                    cycleMonths = 12;
                } else if (planText.includes('6m') || planText.includes('6 month') || amount >= 45000) {
                    cycleMonths = 6;
                } else if (planText.includes('3m') || planText.includes('3 month') || (amount >= 24000 && amount < 45000)) {
                    cycleMonths = 3;
                } else if (expiryDate && pTime && expiryDate.getTime() > pTime) {
                    const diffMonths = Math.round((expiryDate.getTime() - pTime) / (1000 * 60 * 60 * 24 * 30.4));
                    if (diffMonths >= 11) cycleMonths = 12;
                    else if (diffMonths >= 5) cycleMonths = 6;
                    else if (diffMonths >= 2) cycleMonths = 3;
                }

                // Check if the subscription is still fresh/active
                const maxActiveDays = cycleMonths * 31 + 5;
                const isFresh = (expiryDate && expiryDate.getTime() > Date.now()) || daysAgo <= maxActiveDays;
                if (!isFresh) continue;

                // Real cash-based contributions (no predictive hypothetical list-price markups)
                const isAnnual = cycleMonths === 12;
                const mrrContribution = Math.round(amount / cycleMonths);
                const arrContribution = isAnnual ? amount : Math.round(mrrContribution * 12);

                if (isAnnual) {
                    annualSubsCount += 1;
                    annualMrr += mrrContribution;
                } else {
                    monthlySubsCount += 1;
                    monthlyMrr += mrrContribution;
                }

                dynamicMrr += mrrContribution;
                dynamicArr += arrContribution;
                activePaidSubscriptionsCount += 1;
            }
        }

        // Also check if there are standalone active subscription purchases not yet mapped to a business
        for (const p of subscriptionPurchases) {
            const pKey = p.id || p.reference;
            if (pKey && countedPurchaseKeys.has(pKey)) continue;
            const pTime = safeToDate(p.timestamp).getTime();
            if (!pTime) continue;
            const amount = toNgn(p.amount, p.currency);
            if (amount <= 0) continue;

            const planText = String(p.plan || '').toLowerCase();
            let cycleMonths = 1;
            if (planText.includes('annual') || planText.includes('12m') || planText.includes('1 year') || amount >= 80000) {
                cycleMonths = 12;
            } else if (planText.includes('6m') || planText.includes('6 month') || amount >= 45000) {
                cycleMonths = 6;
            } else if (planText.includes('3m') || planText.includes('3 month') || (amount >= 24000 && amount < 45000)) {
                cycleMonths = 3;
            }

            const maxActiveDays = cycleMonths * 31 + 5;
            const daysAgo = pTime ? (Date.now() - pTime) / (1000 * 60 * 60 * 24) : 999;
            const isFresh = daysAgo <= maxActiveDays;

            if (isFresh) {
                const isAnnual = cycleMonths === 12;
                const mrrContribution = Math.round(amount / cycleMonths);
                const arrContribution = isAnnual ? amount : Math.round(mrrContribution * 12);

                if (isAnnual) {
                    annualSubsCount += 1;
                    annualMrr += mrrContribution;
                } else {
                    monthlySubsCount += 1;
                    monthlyMrr += mrrContribution;
                }
                dynamicMrr += mrrContribution;
                dynamicArr += arrContribution;
                activePaidSubscriptionsCount += 1;
            }
        }

        const mrr = dynamicMrr;
        const arr = dynamicArr;

        const mrrDescription = activePaidSubscriptionsCount > 0
            ? `${annualSubsCount > 0 ? `₦${Math.round(annualMrr).toLocaleString()} (Annual: ${annualSubsCount})` : ''}${annualSubsCount > 0 && monthlySubsCount > 0 ? ' + ' : ''}${monthlySubsCount > 0 ? `₦${Math.round(monthlyMrr).toLocaleString()} (Monthly: ${monthlySubsCount})` : ''} · ${activePaidSubscriptionsCount} active sub${activePaidSubscriptionsCount === 1 ? '' : 's'}`
            : '0 active subscriptions';

        const arrDescription = activePaidSubscriptionsCount > 0
            ? `₦${Math.round(arr).toLocaleString()} Annualized Run Rate (${activePaidSubscriptionsCount} paying store${activePaidSubscriptionsCount === 1 ? '' : 's'})`
            : 'No active paid subscriptions';

        const usersByDate = (activeUsers || []).reduce((acc, user) => {
            const d = safeToDate(user.createdAt);
            if (d && !isNaN(d.getTime())) {
                const date = format(d, 'MMM d');
                acc[date] = (acc[date] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
        const newUserGrowth = Object.entries(usersByDate).map(([date, count]) => ({ date, 'New Users': count }));

        /*
         * Money received per day — both kinds. Same NGN normalisation and the same
         * internal-account exclusions as the totals above, so it reconciles with
         * `totalCompanyRevenue`, **not** with the Sub Revenue tile. A cash-in chart
         * that hid pack sales would show a day with revenue as a day with none.
         */
        const revenueByDate = validPurchases.reduce((acc, purchase) => {
            const d = safeToDate(purchase.timestamp);
            if (d && !isNaN(d.getTime())) {
                const date = format(d, 'MMM d');
                acc[date] = (acc[date] || 0) + toNgn(purchase.amount, purchase.currency);
            }
            return acc;
        }, {} as Record<string, number>);
        const revenueGrowth = Object.entries(revenueByDate).map(([date, amount]) => ({ date, 'Revenue': amount }));

        const categoryCounts = (products || []).reduce((acc, product) => {
            const category = product.category || 'Uncategorized';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

        // Businesses on a live paid plan — the base the MRR above rests on. Not the
        // same as `payingBusinesses`, which is everyone who has ever paid and so
        // includes subscriptions that have since lapsed.
        const activeSubscriptions = activePaidSubscriptionsCount;

        const trialingBusinessIds = new Set((activeBusinesses || []).filter(b => b.trialExpiresAt?.toDate() > now && (b.plan === 'starter' || !b.plan)).map(b => b.id));
        const trialingUsers = activeUsers.filter(u => u.businessId && trialingBusinessIds.has(u.businessId)).length;

        const planCounts = (activeBusinesses || []).reduce((acc, business) => {
            const plan = business.accessLevel === 'lifetime' ? 'Lifetime' : business.plan || 'Starter';
            acc[plan] = (acc[plan] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const planDistributionData = Object.entries(planCounts).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            fill: PIE_CHART_COLORS[name as keyof typeof PIE_CHART_COLORS] || '#ccc'
        }));

        const userRoleData = (activeUsers || []).reduce((acc, user) => {
            const role = user.role || 'unknown';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const businessRevenues = (convertedReceipts || []).reduce((acc, r) => {
            if (r.businessId) {
                acc[r.businessId] = (acc[r.businessId] || 0) + r.total;
            }
            return acc;
        }, {} as Record<string, number>);

        activeBusinesses.forEach(b => {
            if (businessRevenues[b.id] === undefined) {
                businessRevenues[b.id] = 0;
            }
        });

        const sortedBusinessRevenues = Object.entries(businessRevenues)
            .sort(([, a], [, b]) => b - a)
            .map(([bId, rev]) => {
                const business = businesses?.find(b => b.id === bId);
                const productCount = products ? products.filter(p => p.businessId === bId).length : 0;
                return business ? { ...business, totalRevenue: rev, productCount } : null;
            })
            .filter((b): b is any => b !== null);

        const richestBusiness = sortedBusinessRevenues[0] || null;
        const allPerformers = sortedBusinessRevenues;
        const topPerformers = sortedBusinessRevenues.slice(0, 3);

        // --- New Daily Metrics ---
        const launchDate = new Date(2026, 1, 17); // February 17, 2026
        
        const daysActive = Math.max(differenceInDays(new Date(), launchDate), 1);
        const earliestBusiness = launchDate;
        const averageSalesPerDay = platformGmv / daysActive;
        const averageReceiptsPerDay = totalReceipts / daysActive;

        const daysToFetch = parseInt(velocityFilter);
        const dailyGmvData = [];
        const dailyReceiptsData = [];
        for (let i = daysToFetch - 1; i >= 0; i--) {
            const d = subDays(new Date(), i);
            const dateStr = format(d, 'MMM d');
            const dayStart = startOfDay(d);
            const dayEnd = endOfDay(d);
            const dayReceipts = convertedReceipts?.filter(r => {
                const rDate = r.createdAt.toDate();
                return rDate >= dayStart && rDate <= dayEnd;
            }) || [];
            const dayTotal = dayReceipts.reduce((sum, r) => sum + r.total, 0);
            dailyGmvData.push({
                date: dateStr,
                'Revenue': dayTotal
            });
            dailyReceiptsData.push({
                date: dateStr,
                'Sales': dayReceipts.length
            });
        }

        // LTV = Total Subscription Revenue / Total Paying Customers
        const payingBusinessesCount = payingBusinessIds.size;
        const ltv = payingBusinessesCount > 0 ? totalSubscriptionRevenue / payingBusinessesCount : 0;

        // --- DOWNLOAD TELEMETRY INTELLIGENCE ---
        const downloadStats = (downloadClicks || []).reduce((acc, d) => {
            const pList = d.platforms || [];
            pList.forEach((p: string) => {
                if (p.includes('windows')) acc.windows += 1;
                else if (p.includes('macos')) acc.macos += 1;
                else if (p.includes('android')) acc.android += 1;
            });
            acc.totalClicks += (d.clicks || 0);
            return acc;
        }, { windows: 0, macos: 0, android: 0, totalClicks: 0 });

        // Operations & adoption metrics now live in OperationsAdoptionPanel, which
        // scopes them to the reader's chosen timeframe instead of all-time.

        return {
            totalUsers, totalBusinesses, totalProducts, platformGmv, totalProductsSold,
            totalReceipts, platformAOV, mrr, arr, mrrDescription, arrDescription, annualSubsCount, monthlySubsCount, annualMrr, monthlyMrr, ltv, activeUsers, inactiveUsers,
            newUserGrowth, revenueGrowth, categoryData, activeSubscriptions,
            trialingUsers, planDistributionData, userRoleData, totalSubscriptionRevenue,
            totalCreditPackRevenue, totalCompanyRevenue,
            richestBusiness, topPerformers, allPerformers, averageSalesPerDay, averageReceiptsPerDay, dailyGmvData, dailyReceiptsData,
            earliestBusiness, daysActive,
            uniqueDownloaders: downloadClicks?.length || 0,
            downloadStats,
            payingBusinesses,
            validPurchases,
            revenueGeneratingBusinessesCount
        };
    }, [users, businesses, products, convertedReceipts, purchases, downloadClicks, velocityFilter]);


    const handleOpenDetailModal = (type: 'active' | 'activated' | 'atRisk' | 'paying' | 'totalBusinesses' | 'inventoryActive' | 'generatingSales' | 'totalUsers') => {
        let modalData = { open: true, title: '', description: '', businesses: [] as BusinessInstance[] };
        const activeBusinesses = businesses?.filter(b => b.status !== 'deleted') || [];

        switch (type) {
            case 'active':
            case 'totalBusinesses':
                modalData.title = 'All Registered Businesses';
                modalData.description = 'A list of all active business accounts currently established on the platform.';
                modalData.businesses = activeBusinesses;
                break;
            case 'inventoryActive':
                modalData.title = 'Active Inventory Businesses';
                modalData.description = 'A list of all businesses that have added at least one product or service to their stock catalog.';
                modalData.businesses = platformAnalytics.businessesWithProductsList || [];
                break;
            case 'generatingSales':
                modalData.title = 'Revenue Generating Stores';
                modalData.description = 'A list of all stores that have recorded and processed at least one checkout sale.';
                modalData.businesses = platformAnalytics.businessesWithSalesList || [];
                break;
            case 'totalUsers':
                setUserListModalState({
                    open: true,
                    title: 'Total Platform Users',
                    description: 'Complete register of all authenticated accounts active across all businesses.',
                    users: users || []
                });
                return;
            case 'activated':
                modalData.title = 'Activated Businesses';
                modalData.description = 'Businesses with at least 10 products and at least 1 sale.';
                modalData.businesses = platformAnalytics.activatedBusinessesList;
                break;
            case 'atRisk':
                modalData.title = 'Businesses At Risk';
                modalData.description = 'Businesses with no sales in the last 14 days.';
                modalData.businesses = platformAnalytics.atRiskBusinesses;
                break;
            case 'paying':
                modalData.title = 'Paying Businesses';
                modalData.description = 'Businesses on a Pro or Business plan whose trial has expired.';
                modalData.businesses = platformAnalytics.payingBusinessesList;
                break;
        }
        setDetailModalState(modalData);
    };

    const handleGrantAccess = async () => {
        if (!grantEmail) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide a user email.' });
            return;
        }
        if (!grantDate && !grantLifetime) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide a date or grant lifetime access.' });
            return;
        }
        setIsGranting(true);
        try {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where("email", "==", grantEmail));
            const userSnapshot = await getDocs(q);
            if (userSnapshot.empty) throw new Error(`User with email ${grantEmail} not found.`);
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data() as UserProfile;
            if (!userData.businessId) throw new Error("This user is not associated with any business.");
            const businessDocRef = doc(firestore, 'businessInstances', userData.businessId);
            const historyColRef = collection(firestore, 'businessInstances', userData.businessId, 'subscription_history');

            if (grantLifetime) {
                await updateDoc(businessDocRef, { accessLevel: 'lifetime', trialExpiresAt: null, plan: 'business' });
                await addDoc(historyColRef, {
                    action: 'Admin Grant: Lifetime access',
                    amount: 0,
                    currency: 'NGN',
                    timestamp: serverTimestamp()
                });

                if (currentUserProfile) {
                    await logAuditEvent(firestore, userData.businessId, currentUserProfile, {
                        action: 'billing.grant_lifetime',
                        entity: { type: 'business', id: userData.businessId, name: userData.name },
                        details: { targetEmail: grantEmail }
                    });
                }

                toast({ variant: 'success', title: 'Lifetime Access Granted!', description: `${userData.name} now has lifetime access.` });
            } else if (grantDate) {
                await updateDoc(businessDocRef, { trialExpiresAt: grantDate });
                await addDoc(historyColRef, {
                    action: `Admin Grant: Trial extended to ${format(grantDate, 'PPP')}`,
                    amount: 0,
                    currency: 'NGN',
                    timestamp: serverTimestamp()
                });

                if (currentUserProfile) {
                    await logAuditEvent(firestore, userData.businessId, currentUserProfile, {
                        action: 'billing.extend_trial',
                        entity: { type: 'business', id: userData.businessId, name: userData.name },
                        details: { targetEmail: grantEmail, newExpiry: format(grantDate, 'PPP') }
                    });
                }

                toast({ variant: 'success', title: 'Access Granted', description: `${userData.name}'s trial now expires on ${format(grantDate, 'PPP')}.` });
            }
            setGrantEmail('');
            setGrantDate(undefined);
            setGrantLifetime(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Grant Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsGranting(false);
        }
    }

    const handleRevokeLifetime = async () => {
        if (!grantEmail) return;
        setIsRevoking(true);
        try {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where("email", "==", grantEmail));
            const userSnapshot = await getDocs(q);
            if (userSnapshot.empty) throw new Error(`User with email ${grantEmail} not found.`);
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data() as UserProfile;
            if (!userData.businessId) throw new Error("This user is not associated with any business.");
            
            const businessDocRef = doc(firestore, 'businessInstances', userData.businessId);
            const historyColRef = collection(firestore, 'businessInstances', userData.businessId, 'subscription_history');

            await updateDoc(businessDocRef, { 
                accessLevel: null,
                plan: 'starter',
                trialExpiresAt: serverTimestamp()
            });

            await addDoc(historyColRef, {
                action: 'Admin Revoke: Lifetime access revoked',
                amount: 0,
                currency: 'NGN',
                timestamp: serverTimestamp()
            });

            if (currentUserProfile) {
                await logAuditEvent(firestore, userData.businessId, currentUserProfile, {
                    action: 'billing.revoke_lifetime',
                    entity: { type: 'business', id: userData.businessId, name: userData.name },
                    details: { targetEmail: grantEmail }
                });
            }

            toast({ variant: 'success', title: 'Lifetime Access Revoked', description: `Lifetime access for ${userData.name} has been revoked.` });
            setGrantEmail('');
            setGrantLifetime(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Revocation Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsRevoking(false);
        }
    };

    const handleUserStatusSelection = (email: string) => {
        setUserStatusEmail(email);
        if (email && users) {
            const selectedUser = users.find(u => u.email === email);
            if (selectedUser) {
                setIsUserActive(selectedUser.status !== 'inactive');
            }
        }
    };

    const handleUpdateUserStatus = async () => {
        if (!userStatusEmail) {
            toast({ variant: 'destructive', title: 'Missing Email', description: 'Please select a user to update.' });
            return;
        }
        setIsUpdatingStatus(true);
        try {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where("email", "==", userStatusEmail));
            const userSnapshot = await getDocs(q);
            if (userSnapshot.empty) throw new Error(`User with email ${userStatusEmail} not found.`);

            const userDoc = userSnapshot.docs[0];
            const newStatus = isUserActive ? 'active' : 'inactive';
            await updateDoc(userDoc.ref, { status: newStatus });

            toast({ variant: 'success', title: 'User Status Updated', description: `${userDoc.data().name}'s account is now ${newStatus}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsUpdatingStatus(false);
        }
    };
    const handleToggleHaltBusiness = async () => {
        if (!haltUserEmail) {
            toast({ variant: 'destructive', title: 'Missing User', description: 'Please select a user to manage freeze state.' });
            return;
        }
        setIsHalting(true);
        try {
            const u = users?.find(u => u.email === haltUserEmail);
            if (!u || !u.businessId) throw new Error("User or business association not found.");

            const businessDocRef = doc(firestore, 'businessInstances', u.businessId);
            const newHaltedState = !isSelectedBusinessHalted;

            await updateDoc(businessDocRef, {
                status: newHaltedState ? 'halted' : 'active',
                isHalted: newHaltedState
            });

            // Log event to audit logs
            await addDoc(collection(firestore, 'follow_up_logs'), {
                timestamp: serverTimestamp(),
                userId: u.id,
                userEmail: u.email,
                businessId: u.businessId,
                businessName: selectedHaltBusiness?.name || '',
                action: newHaltedState ? 'business_halted' : 'business_resumed',
                details: `Admin toggled halt state to: ${newHaltedState ? 'Halted' : 'Active'}.`
            });

            // Tell the owner. A halt stops every till in the shop and the app's own
            // explanation only appears once they try to use it — until now the only
            // record of the decision was a `follow_up_logs` document nobody outside
            // this dashboard can read.
            await addDoc(collection(firestore, `users/${u.id}/notifications`), {
                title: newHaltedState ? 'Your account has been suspended' : 'Your account is active again',
                body: newHaltedState
                    ? 'Operations for your business have been paused by Zeneva support. Contact us to resolve this and get the till working again.'
                    : 'Operations for your business have been restored. You can record sales again.',
                link: '/support',
                type: 'account',
                createdAt: serverTimestamp(),
                read: false,
            }).catch((notifyErr) => {
                // The halt itself already committed; failing to announce it must not
                // report the halt as failed and invite a second attempt.
                console.warn('Halt notification failed:', notifyErr);
            });

            toast({ 
                variant: 'success', 
                title: newHaltedState ? 'Business Halted' : 'Business Resumed', 
                description: `Successfully ${newHaltedState ? 'suspended' : 're-activated'} operations for ${selectedHaltBusiness?.name || 'this business'}.` 
            });
            setHaltUserEmail('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsHalting(false);
        }
    };

    const handleAssignPlan = async () => {
        if (!planUserEmail) {
            toast({ variant: 'destructive', title: 'Missing User', description: 'Please select a user to assign a plan.' });
            return;
        }
        setIsAssigningPlan(true);
        try {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where("email", "==", planUserEmail));
            const userSnapshot = await getDocs(q);
            if (userSnapshot.empty) throw new Error(`User with email ${planUserEmail} not found.`);

            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data() as UserProfile;
            if (!userData.businessId) throw new Error("This user is not associated with any business.");

            const businessDocRef = doc(firestore, 'businessInstances', userData.businessId);
            await updateDoc(businessDocRef, {
                plan: selectedPlan,
                accessLevel: null, // Ensure plan takes precedence over lifetime
            });

            // An upgrade changes what the app will let them do, so it should not be
            // something they discover by accident.
            await addDoc(collection(firestore, `users/${userDoc.id}/notifications`), {
                title: 'Your plan has been updated',
                body: `Your business is now on the ${selectedPlan} plan. Any features that plan includes are available immediately.`,
                link: '/billing',
                type: 'billing',
                createdAt: serverTimestamp(),
                read: false,
            }).catch((notifyErr) => {
                console.warn('Plan assignment notification failed:', notifyErr);
            });

            toast({ variant: 'success', title: 'Plan Assigned', description: `${userData.name} is now on the ${selectedPlan} plan.` });
            setPlanUserEmail('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Plan Assignment Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsAssigningPlan(false);
        }
    };

    const handleSendBroadcast = async () => {
        if (!broadcastTitle || !broadcastMessage) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide both a title and a message for the broadcast.' });
            return;
        }

        setIsSendingBroadcast(true);
        try {
            const broadcastsRef = collection(firestore, 'system_broadcasts');
            const durationInHours = parseInt(broadcastDuration);
            const expiryDate = new Date();
            expiryDate.setHours(expiryDate.getHours() + durationInHours);

            await addDoc(broadcastsRef, {
                title: broadcastTitle,
                message: broadcastMessage,
                type: broadcastType,
                createdAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(expiryDate),
                active: true,
                isActive: true, // Write both active and isActive for absolute backward safety
                link: broadcastLink || null,
            });

            // A `system_broadcasts` document only drives the dismissible banner. It is
            // read by nothing else — not the bell, and not the document-to-OS bridge —
            // so a broadcast used to be invisible the moment someone dismissed it, and
            // never reached a phone at all. The announcement below is the durable
            // half: it lands in every user's notification centre and raises the native
            // notification, exactly like an alert sent from /admin-imamshaffy/notifications.
            let announcementId: string | null = null;
            try {
                const announcement = await addDoc(collection(firestore, 'notifications'), {
                    title: broadcastTitle,
                    body: broadcastMessage,
                    link: broadcastLink || null,
                    targetEmail: null,
                    sentBy: currentUserProfile?.id || null,
                    createdAt: serverTimestamp(),
                    deleted: false,
                    pushedToPhones: true,
                });
                announcementId = announcement.id;
            } catch (announcementErr) {
                console.error('Broadcast announcement document failed:', announcementErr);
            }

            // Trigger FCM Native Push Notification to all active users/devices
            try {
                const { broadcastNotification } = await import('@/actions/notifications');
                const { idToken } = await import('@/lib/id-token');
                // With no explicit link, send the tap to the announcement itself rather
                // than to `/`, so there is something to read on arrival.
                const pushLink = broadcastLink || (announcementId ? `/notifications?g=${announcementId}` : '/notifications');
                const pushResult = await broadcastNotification(broadcastTitle, broadcastMessage, pushLink, await idToken());
                if (pushResult.success) {
                    toast({ variant: 'success', title: 'Broadcast Sent!', description: `Announcement stored and pushed: ${pushResult.message}` });
                } else {
                    toast({ variant: 'warning', title: 'Announcement Saved', description: `Stored in app, but push failed: ${pushResult.error}` });
                }
            } catch (err: any) {
                console.error("FCM Push notification broadcast error:", err);
                toast({ variant: 'warning', title: 'Announcement Saved', description: 'Stored in app. Failed to trigger push notification service.' });
            }

            setBroadcastTitle('');
            setBroadcastMessage('');
            setBroadcastType('info');
            setBroadcastDuration('24');
            setBroadcastLink('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Broadcast Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsSendingBroadcast(false);
        }
    };

    const handleToggleBroadcastActive = async (broadcastId: string, currentActive: boolean) => {
        try {
            const broadcastDocRef = doc(firestore, 'system_broadcasts', broadcastId);
            await updateDoc(broadcastDocRef, {
                isActive: !currentActive,
                active: !currentActive
            });
            toast({ variant: 'success', title: `Broadcast ${!currentActive ? 'Activated' : 'Deactivated'}`, description: `The announcement was successfully updated.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Update Broadcast', description: error.message || 'An unexpected error occurred.' });
        }
    };

    const handleDeleteBroadcast = async (broadcastId: string) => {
        if (!confirm('Are you sure you want to delete this broadcast? This cannot be undone.')) return;
        try {
            const broadcastDocRef = doc(firestore, 'system_broadcasts', broadcastId);
            await deleteDoc(broadcastDocRef);
            toast({ variant: 'success', title: 'Broadcast Deleted', description: 'The announcement has been deleted successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Delete Broadcast', description: error.message || 'An unexpected error occurred.' });
        }
    };

    const handlePublishFeatureUpdate = async () => {
        if (!featureTitle || !featureDescription) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide a title and description for the feature update.' });
            return;
        }
        setIsSavingFeatureUpdate(true);
        try {
            const updatesRef = collection(firestore, 'feature_updates');
            await addDoc(updatesRef, {
                title: featureTitle,
                badge: featureBadge,
                description: featureDescription,
                videoUrl: featureVideoUrl,
                actionText: featureActionText,
                actionHref: featureActionHref,
                releaseVersion: '3.2.8',
                isActive: true,
                createdAt: serverTimestamp(),
            });
            toast({ variant: 'success', title: 'Feature Release Published!', description: 'The announcement modal is now active for users.' });
        } catch (err: any) {
            console.error('Error publishing feature release:', err);
            toast({ variant: 'destructive', title: 'Publish Failed', description: err?.message || 'Could not publish update.' });
        } finally {
            setIsSavingFeatureUpdate(false);
        }
    };

    const { impersonateUser, currentUserProfile } = usePOS();
    const router = useRouter();

    const handleImpersonateUser = (user: UserProfile) => {
        impersonateUser(user.id);
        router.push('/dashboard');
    };

    return (
        <div ref={cardRef} className="p-4 md:p-6 lg:p-8 space-y-6 high-fidelity-shell">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <p className="text-muted-foreground">
                        Platform-wide overview, analytics, and admin tools.
                    </p>
                </div>
                <div className="no-capture flex items-center gap-2">
                    {onRefresh && (
                        <Button onClick={onRefresh} disabled={isRefreshing} variant="outline" className="gap-2">
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
                        </Button>
                    )}
                    <Button onClick={handleDownloadReport} disabled={isDownloading} variant="outline">
                        <Download className="mr-2 h-4 w-4" /> {isDownloading ? "Downloading..." : "Download Report"}
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="no-capture flex w-full justify-start overflow-x-auto overflow-y-hidden snap-x h-auto py-2 scrollbar-hide">
                    <TabsTrigger value="overview" className="snap-start shrink-0">Overview</TabsTrigger>
                    <TabsTrigger value="acquisition" className="gap-2 snap-start shrink-0">
                        <DoorOpen className="h-4 w-4" />
                        Acquisition
                    </TabsTrigger>
                    <TabsTrigger value="users" className="snap-start shrink-0">User Management</TabsTrigger>
                    <TabsTrigger value="broadcasts" className="snap-start shrink-0">Comms Center</TabsTrigger>
                    <TabsTrigger value="followups" className="snap-start shrink-0">Strategic Outreach</TabsTrigger>
                    <TabsTrigger value="content" className="gap-2 snap-start shrink-0">
                        <Newspaper className="h-4 w-4" />
                        Content Strategy
                    </TabsTrigger>
                    <TabsTrigger value="recruitment" className="gap-2 snap-start shrink-0">
                        <Briefcase className="h-4 w-4" />
                        Recruitment
                    </TabsTrigger>
                    <TabsTrigger value="grants" className="gap-2 snap-start shrink-0">
                        <Trophy className="h-4 w-4" />
                        Business Grants
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-2 snap-start shrink-0">
                        <ShieldCheck className="h-4 w-4" />
                        Cyber Shield
                    </TabsTrigger>
                    <TabsTrigger value="storefront-orders" className="gap-2 snap-start shrink-0">
                        <Store className="h-4 w-4" />
                        Storefronts & Orders ({onlineOrdersTotal ?? onlineOrders.length})
                    </TabsTrigger>
                    <TabsTrigger value="usage" className="gap-2 snap-start shrink-0">
                        <Timer className="h-4 w-4" />
                        Usage Analytics
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HeartPulse className="h-5 w-5 text-red-500 animate-pulse" />
                                Platform Overview Command
                            </CardTitle>
                        </CardHeader>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
                        <button onClick={() => handleOpenDetailModal('totalUsers')} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard 
                                title="Total Users" 
                                value={analyticsData.totalUsers} 
                                icon={Users} 
                                description="Total registered user accounts"
                            />
                        </button>
                        <button onClick={() => handleOpenDetailModal('totalBusinesses')} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard 
                                title="Total Businesses" 
                                value={analyticsData.totalBusinesses} 
                                icon={Building} 
                                description="Total business registrations"
                            />
                        </button>
                        <button onClick={() => handleOpenDetailModal('inventoryActive')} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard 
                                title="Inventory Active" 
                                value={platformAnalytics.businessesWithProducts} 
                                icon={Package} 
                                description="Businesses with added stock"
                            />
                        </button>
                        <button onClick={() => handleOpenDetailModal('generatingSales')} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard 
                                title="Generating Sales" 
                                value={platformAnalytics.businessesWithSales} 
                                icon={DollarSign} 
                                description="Businesses with transactions"
                            />
                        </button>
                        <button onClick={() => setIsAgeMilestoneOpen(true)} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard 
                                title="Zeneva Age" 
                                value={analyticsData.daysActive > 365 
                                    ? `${(analyticsData.daysActive / 365).toFixed(1)} Years` 
                                    : `${analyticsData.daysActive} Days`} 
                                icon={Clock} 
                                description={`Launched ${format(analyticsData.earliestBusiness, 'MMM yyyy')} (${Math.floor(analyticsData.daysActive / 30)} months, ${Math.floor((analyticsData.daysActive % 30) / 7)} weeks)`}
                            />
                        </button>
                        <button 
                            onClick={() => setIsDownloadIntelOpen(true)} 
                            className="text-left w-full h-full transition-transform active:scale-95"
                        >
                            <StatCard 
                                title="Unique Downloaders" 
                                value={analyticsData.uniqueDownloaders} 
                                icon={Download} 
                                description={`${analyticsData.downloadStats.windows} Win / ${analyticsData.downloadStats.macos} Mac / ${analyticsData.downloadStats.android} Android`}
                            />
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 border-t border-white/5 pt-6">
                        <button onClick={() => handleOpenDetailModal('active')} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard title="Active Stores" value={platformAnalytics.totalActiveBusinesses} icon={Building} description="Currently active businesses" />
                        </button>
                        <button onClick={() => setIsSaaSMetricsOpen(true)} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard title="MRR" value={`₦${Math.round(analyticsData.mrr).toLocaleString()}`} icon={DollarSign} description={analyticsData.mrrDescription} />
                        </button>
                        <button onClick={() => setIsSalesVelocityOpen(true)} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard title="Sales Velocity" value={`₦${analyticsData.averageSalesPerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day`} icon={Activity} description="Platform momentum" />
                        </button>
                        <button onClick={() => handleOpenDetailModal('activated')} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard title="Activated" value={platformAnalytics.activatedBusinessesCount} icon={UserCheck} description="Businesses with >10 products" />
                        </button>
                        <button onClick={() => handleOpenDetailModal('atRisk')} className="text-left w-full h-full transition-transform active:scale-95" disabled={platformAnalytics.atRiskBusinesses.length === 0}>
                            <StatCard title="At Risk" value={platformAnalytics.atRiskBusinesses.length} icon={AlertTriangle} description="No activity for 14 days" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mt-4">
                        <button onClick={() => setIsSaaSMetricsOpen(true)} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard title="ARR" value={`₦${Math.round(analyticsData.arr).toLocaleString()}`} icon={TrendingUp} description={analyticsData.arrDescription} />
                        </button>
                        <button onClick={() => setIsSaaSMetricsOpen(true)} className="text-left w-full h-full transition-transform active:scale-95">
                            <StatCard title="LTV" value={`₦${analyticsData.ltv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={Crown} description="Est. Lifetime Value" />
                        </button>
                        {/* Subscriptions only. Credit-pack sales are reported in the
                            description and broken out in the SaaS metrics dialog, so a
                            one-off top-up never reads as software revenue. */}
                        <StatCard
                            title="Sub Revenue"
                            value={`₦${analyticsData.totalSubscriptionRevenue.toLocaleString()}`}
                            icon={ShieldCheck}
                            description={analyticsData.totalCreditPackRevenue > 0
                                ? `+₦${Math.round(analyticsData.totalCreditPackRevenue).toLocaleString()} AI credits · ₦${Math.round(analyticsData.totalCompanyRevenue).toLocaleString()} all in`
                                : 'Total Software Sales'}
                        />
                        <StatCard title="Platform AOV" value={`₦${analyticsData.platformAOV.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={ShoppingCart} description="Avg. Receipt Value" />
                    </div>
                    </Card>

                    {/* Dot Plot moved to overview as requested */}
                    <UserActivityDotPlot users={users || []} businesses={businesses || []} />

                    {/* Operations & feature adoption — tiles plus their own trend, profile and sharing charts. */}
                    <OperationsAdoptionPanel
                        receipts={convertedReceipts || []}
                        storefrontShares={storefrontShares}
                        receiptShares={receiptShares}
                    />

                    {/* App & Device Platform Ecosystem (Microsoft App vs Mobile App vs Web) */}
                    <DevicePlatformAdoptionSection
                        users={users || []}
                        businesses={businesses || []}
                        onSelectUser={(u) => {
                            setSelectedUserForDetail(u);
                            setIsUserDetailOpen(true);
                        }}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Top Locations</CardTitle><CardDescription>Where are your users located?</CardDescription></CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={250}>
                                    <ReBarChart data={platformAnalytics.topLocations} layout="vertical" margin={{ left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                        <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                                    </ReBarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="border-yellow-500/20 overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent pointer-events-none" />
                            <CardHeader className="flex flex-row items-center justify-between pb-3 relative z-10 space-y-0">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Trophy className="h-5 w-5 text-yellow-500" /> Platform Performer Spotlight
                                    </CardTitle>
                                    <CardDescription>Top 3 businesses driving the most GMV.</CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setIsTopPerformersOpen(true)}>
                                    View All
                                </Button>
                            </CardHeader>
                            <CardContent className="relative z-10 space-y-3">
                                {analyticsData.topPerformers && analyticsData.topPerformers.length > 0 ? (
                                    analyticsData.topPerformers.map((business, index) => (
                                        <div key={business.id} className={cn(
                                            "flex items-center justify-between p-3 rounded-lg border",
                                            index === 0 ? "bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-500/30" : "bg-background/60 border-border/50"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn( 
                                                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                                    index === 0 ? "bg-yellow-500 text-white" : "bg-muted text-muted-foreground"
                                                )}>
                                                    #{index + 1}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold leading-none">{business.name}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">Platform Partner • {business.productCount || 0} Products</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold">₦{business.totalRevenue.toLocaleString()}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Gross GMV</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-muted-foreground text-sm">Waiting for more high-performing data...</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart2 className="h-5 w-5 text-primary" />
                                Platform Activity Overview
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Card className="group cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-1 overflow-hidden relative border-yellow-500/20" onClick={() => {
                                setCertificateModalState({ open: true, title: 'Push Subscribers', description: `There are currently ${totalSubscribers} devices that have installed the app.`, value: String(totalSubscribers), icon: Megaphone });
                            }}>
                                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent pointer-events-none" />
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-center text-lg">
                                        Push Subscribers
                                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full group-hover:bg-yellow-200 transition-colors">
                                            <Megaphone className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-600 to-yellow-400">
                                        {totalSubscribers}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">Active devices opted-in</p>
                                    <p className="text-xs text-yellow-600/80 font-semibold mt-4 flex items-center"><Download className="h-3 w-3 mr-1" /> Click to download certified visual</p>
                                </CardContent>
                            </Card>

                            <Card className="group cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-1 overflow-hidden relative border-green-500/20" onClick={() => {
                                setCertificateModalState({ open: true, title: 'Platform GMV', description: `Total gross merchandise value across the Zeneva platform.`, value: `₦${analyticsData.platformGmv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign });
                            }}>
                                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent pointer-events-none" />
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-center text-lg">
                                        Platform GMV
                                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full group-hover:bg-green-200 transition-colors">
                                            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-500" />
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-green-400">
                                        <CurrencyAmount symbol="₦" amount={analyticsData.platformGmv} hideFraction={true} className="items-center" symbolClassName="text-[0.55em] font-medium opacity-70 mr-1" />
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">Value of goods sold</p>
                                    <p className="text-xs text-green-600/80 font-semibold mt-4 flex items-center"><Download className="h-3 w-3 mr-1" /> Click to download certified visual</p>
                                </CardContent>
                            </Card>

                            <Card className="group cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-1 overflow-hidden relative border-blue-500/20" onClick={() => {
                                setCertificateModalState({ open: true, title: 'Total Receipts', description: `Total number of sales receipts across the platform.`, value: analyticsData.totalReceipts.toLocaleString(), icon: FileText });
                            }}>
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-center text-lg">
                                        Total Receipts
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full group-hover:bg-blue-200 transition-colors">
                                            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">
                                        {analyticsData.totalReceipts.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">Total number of sales</p>
                                    <p className="text-xs text-blue-600/80 font-semibold mt-4 flex items-center"><Download className="h-3 w-3 mr-1" /> Click to download certified visual</p>
                                </CardContent>
                            </Card>

                            <Card className="group cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-1 overflow-hidden relative border-purple-500/20" onClick={() => {
                                setCertificateModalState({ open: true, title: 'Total Products', description: `We currently host ${analyticsData.totalProducts.toLocaleString()} unique products on the Zeneva platform across all businesses.`, value: analyticsData.totalProducts.toLocaleString(), icon: Package });
                            }}>
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-center text-lg">
                                        Total Products
                                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full group-hover:bg-purple-200 transition-colors">
                                            <Package className="h-5 w-5 text-purple-600 dark:text-purple-500" />
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-purple-400">
                                        {analyticsData.totalProducts.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">Unique catalog variants</p>
                                    <p className="text-xs text-purple-600/80 font-semibold mt-4 flex items-center"><Download className="h-3 w-3 mr-1" /> Click to download certified visual</p>
                                </CardContent>
                            </Card>

                            <Card className="group cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-1 overflow-hidden relative border-orange-500/20" onClick={() => {
                                setCertificateModalState({ open: true, title: 'Total Units Sold', description: `Total individual items sold through all registered businesses.`, value: analyticsData.totalProductsSold.toLocaleString(), icon: ShoppingCart });
                            }}>
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none" />
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-center text-lg">
                                        Total Units Sold
                                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full group-hover:bg-orange-200 transition-colors">
                                            <ShoppingCart className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-orange-400">
                                        {analyticsData.totalProductsSold.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">Physical checkout goods</p>
                                    <p className="text-xs text-orange-600/80 font-semibold mt-4 flex items-center"><Download className="h-3 w-3 mr-1" /> Click to download certified visual</p>
                                </CardContent>
                            </Card>

                            {/* Zeneva's own money, not the merchants'. This card used to
                                repeat platformGmv under the title "Total Revenue", which
                                read as though every naira the shops took was ours. */}
                            <Card className="group cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-1 overflow-hidden relative border-pink-500/20" onClick={() => {
                                setCertificateModalState({ open: true, title: 'Subscription Revenue', description: `Zeneva's own subscription fees collected to date, across all plans.`, value: `₦${analyticsData.totalSubscriptionRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: Check });
                            }}>
                                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent pointer-events-none" />
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-center text-lg">
                                        Subscription Revenue
                                        <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-full group-hover:bg-pink-200 transition-colors">
                                            <Check className="h-5 w-5 text-pink-600 dark:text-pink-500" />
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
                                        <CurrencyAmount symbol="₦" amount={analyticsData.totalSubscriptionRevenue} hideFraction={true} className="items-center" symbolClassName="text-[0.55em] font-medium opacity-70 mr-1" />
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">Zeneva's own revenue</p>
                                    <p className="text-xs text-pink-600/80 font-semibold mt-4 flex items-center"><Download className="h-3 w-3 mr-1" /> Click to download certified visual</p>
                                </CardContent>
                            </Card>

                            <Card className="group cursor-pointer hover:shadow-lg transition-transform hover:-translate-y-1 overflow-hidden relative border-cyan-500/20" onClick={() => setIsImportIntelOpen(true)}>
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none" />
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-center text-lg">
                                        Import Activity
                                        <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-full group-hover:bg-cyan-200 transition-colors">
                                            <UploadCloud className="h-5 w-5 text-cyan-600 dark:text-cyan-500" />
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-cyan-400">
                                        {importAttempts?.length || 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">Inventory import attempts & options</p>
                                    <p className="text-xs text-cyan-600/80 font-semibold mt-4 flex items-center"><UploadCloud className="h-3 w-3 mr-1" /> Click to view import logs</p>
                                </CardContent>
                            </Card>
                        </CardContent>
                    </Card>
                    <div className="mb-8">


                    
                    {/* New Industry & Country Analytics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Briefcase className="h-5 w-5 text-blue-500" />
                                    Industry Diversity
                                </CardTitle>
                                <CardDescription>Numbers of businesses categorized by industry.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ReBarChart
                                            data={platformAnalytics.industryData}
                                            layout="vertical"
                                            margin={{ left: 40, right: 40 }}
                                            onClick={(data) => {
                                                if (data && data.activePayload) {
                                                    const d = data.activePayload[0].payload;
                                                    setDetailModalState({
                                                        open: true,
                                                        title: `${d.name} Businesses`,
                                                        description: `List of all businesses in the ${d.name} sector.`,
                                                        businesses: d.businesses,
                                                    });
                                                }
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                            <XAxis type="number" hide />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                tick={{ fontSize: 11, fontWeight: 500 }}
                                                width={100}
                                            />
                                            <ReTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
                                            <Bar
                                                dataKey="value"
                                                radius={[0, 4, 4, 0]}
                                                className="cursor-pointer"
                                            >
                                                {platformAnalytics.industryData.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </ReBarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Languages className="h-5 w-5 text-violet-500" />
                                    Language Adoption
                                </CardTitle>
                                <CardDescription>
                                    Which language each of the {platformAnalytics.languageTrackedUsers.toLocaleString()} tracked users reads Zeneva in. Click a language to view its businesses.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[250px] pr-4">
                                    <div className="space-y-4">
                                        {platformAnalytics.languageData.length === 0 && (
                                            <p className="text-sm text-muted-foreground">No users have checked in yet.</p>
                                        )}
                                        {platformAnalytics.languageData.map((item) => (
                                            <div
                                                key={item.code}
                                                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border cursor-pointer group"
                                                onClick={() => setDetailModalState({
                                                    open: true,
                                                    title: `Businesses using ${item.name}`,
                                                    description: `Businesses with at least one user reading Zeneva in ${item.name}.`,
                                                    businesses: item.businesses,
                                                })}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="flex items-center justify-center w-6 h-6 group-hover:scale-110 transition-transform">
                                                        {item.flag
                                                            ? <img src={`https://flagcdn.com/w40/${item.flag}.png`} alt="" className="w-6 h-4 rounded-sm object-cover inline-block" />
                                                            : <span className="text-xl">🌐</span>}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-sm truncate">{item.nativeName}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-xs text-muted-foreground font-mono">{item.share}%</span>
                                                    <Badge variant="secondary" className="font-mono">{item.value}</Badge>
                                                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Globe className="h-5 w-5 text-emerald-500" />
                                    Country Presence
                                </CardTitle>
                                <CardDescription>Global footprint. Click a country to view businesses.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[250px] pr-4">
                                    <div className="space-y-4">
                                        {platformAnalytics.countryData.map((item, i) => {
                                            const getFlag = (c: string) => {
                                                const normalized = c.toLowerCase();
                                                if (normalized.includes('nigeria')) {
                                                    return <img src="https://flagcdn.com/w40/ng.png" alt="Nigeria" className="w-6 h-4 rounded-sm object-cover inline-block" />;
                                                }
                                                if (normalized.includes('united states') || normalized === 'usa') {
                                                    return <img src="https://flagcdn.com/w40/us.png" alt="USA" className="w-6 h-4 rounded-sm object-cover inline-block" />;
                                                }
                                                if (normalized.includes('united kingdom') || normalized === 'uk') {
                                                    return <img src="https://flagcdn.com/w40/gb.png" alt="UK" className="w-6 h-4 rounded-sm object-cover inline-block" />;
                                                }
                                                if (normalized.includes('ghana')) {
                                                    return <img src="https://flagcdn.com/w40/gh.png" alt="Ghana" className="w-6 h-4 rounded-sm object-cover inline-block" />;
                                                }
                                                if (normalized.includes('canada')) {
                                                    return <img src="https://flagcdn.com/w40/ca.png" alt="Canada" className="w-6 h-4 rounded-sm object-cover inline-block" />;
                                                }
                                                if (normalized.includes('south africa')) {
                                                    return <img src="https://flagcdn.com/w40/za.png" alt="South Africa" className="w-6 h-4 rounded-sm object-cover inline-block" />;
                                                }
                                                if (normalized.includes('kenya')) {
                                                    return <img src="https://flagcdn.com/w40/ke.png" alt="Kenya" className="w-6 h-4 rounded-sm object-cover inline-block" />;
                                                }
                                                if (normalized.includes('onboarding')) return <span className="text-xl">⏳</span>;
                                                return <span className="text-xl">🌐</span>;
                                            };
                                            return (
                                                <div 
                                                    key={i} 
                                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border cursor-pointer group"
                                                    onClick={() => setDetailModalState({
                                                        open: true,
                                                        title: `Businesses in ${item.name}`,
                                                        description: `Registered business entities operating in ${item.name}.`,
                                                        businesses: item.businesses
                                                    })}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex items-center justify-center w-6 h-6 group-hover:scale-110 transition-transform">{getFlag(item.name)}</span>
                                                        <span className="font-semibold text-sm">{item.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary" className="font-mono">{item.value}</Badge>
                                                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <Card className="hover:shadow-md transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5 text-blue-500" />
                                Operational Cost & Usage Tracking
                            </CardTitle>
                            <CardDescription>Track Zeneva's live infrastructure costs, database reads, and store performance.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <a href="https://console.cloud.google.com/billing/01459A-506211-CE0671?project=studio-3699136485-6747d" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full group-hover:bg-blue-200 transition-colors">
                                        <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">GCP Billing Console</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Track total amount paid & cost savings</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </a>
                            
                            <a href="https://console.cloud.google.com/firestore/databases/-default-/usage?authuser=0&hl=en-US&project=studio-3699136485-6747d" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full group-hover:bg-purple-200 transition-colors">
                                        <Activity className="h-4 w-4 text-purple-600 dark:text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">Firestore Usage Metrics</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Track daily reads, writes, and database load</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </a>

                            <a href="https://partner.microsoft.com/en-us/dashboard/insights/analytics/store/acquisitions?productId=9NVN0F8NJWMJ" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full group-hover:bg-green-200 transition-colors">
                                        <Store className="h-4 w-4 text-green-600 dark:text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">Microsoft Store Analytics</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Track desktop app acquisitions and installs</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </a>
                        </CardContent>
                    </Card>

                    <UninstallTracker />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                    <PlatformRevenueChart receipts={convertedReceipts || []} />
                    <TransactionVolumeChart receipts={convertedReceipts || []} />
                    
                    <div className="lg:col-span-2">
                        <RevenueGrowthIndexChart purchases={purchases || []} />
                    </div>

                    {/* Usage & Engagement Metrics */}
                    <div className="lg:col-span-2 mt-4">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><UserCheck className="h-6 w-6 text-primary"/> Usage & Engagement Metrics</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <StatCard 
                                title="Total Zeneva Users" 
                                value={analyticsData.totalUsers.toLocaleString()} 
                                icon={Users} 
                                description="All authenticated accounts" 
                            />
                            <StatCard 
                                title="Active Users" 
                                value={analyticsData.activeUsers.length.toLocaleString()} 
                                icon={UserCheck} 
                                description="Users not marked inactive" 
                            />
                            <StatCard 
                                title="Avg. Active Time" 
                                value="1h 45m" 
                                icon={Timer} 
                                description="Daily average session length" 
                            />
                            <StatCard 
                                title="Weekly Retention" 
                                value="68%" 
                                icon={TrendingUp} 
                                description="Return rate after 7 days" 
                            />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <UserGrowthChart users={users || []} />
                            <DailyActiveUsersChart users={users || []} receipts={convertedReceipts || []} />
                            <FeatureStickinessChart businesses={businesses || []} products={products || []} />
                            <div className="lg:col-span-2">
                                <RetentionCohortChart users={users || []} receipts={convertedReceipts || []} businesses={businesses || []} />
                            </div>
                        </div>
                    </div>
                    
                    <div className="lg:col-span-2">
                        <PlanDistributionChart businesses={businesses || []} />
                    </div>


                    </div>
                 </TabsContent>

                {/* Everyone who installed and never got as far as an account. This
                    is the only surface in the app that sees a signed-out user —
                    every other analytics path is gated on `onAuthStateChanged`. */}
                <TabsContent value="acquisition" className="space-y-6">
                    <LaunchFunnel />
                </TabsContent>



                <TabsContent value="users" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>All Accounts</CardTitle>
                                    <CardDescription>List of all users on the platform.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search users, emails, or businesses..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pl-8"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Select value={filterPlan} onValueChange={(v: any) => setFilterPlan(v)}>
                                                <SelectTrigger className="w-[130px]">
                                                    <div className="flex items-center gap-2">
                                                        <Filter className="h-4 w-4" />
                                                        <SelectValue />
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Plans</SelectItem>
                                                    <SelectItem value="starter">Starter</SelectItem>
                                                    <SelectItem value="pro">Pro</SelectItem>
                                                    <SelectItem value="business">Business</SelectItem>
                                                    <SelectItem value="lifetime">Lifetime</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select value={filterPlatform} onValueChange={(v: any) => setFilterPlatform(v)}>
                                                <SelectTrigger className="w-[145px]">
                                                    <div className="flex items-center gap-2">
                                                        <Laptop className="h-4 w-4" />
                                                        <SelectValue />
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Devices</SelectItem>
                                                    <SelectItem value="microsoft">Microsoft App</SelectItem>
                                                    <SelectItem value="mobile">Mobile App</SelectItem>
                                                    <SelectItem value="multi">Cross-Device</SelectItem>
                                                    <SelectItem value="web">Web Browser</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                                                <SelectTrigger className="w-[180px]">
                                                    <div className="flex items-center gap-2">
                                                        <ArrowUpDown className="h-4 w-4" />
                                                        <SelectValue />
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Most Recently Active</SelectItem>
                                                    <SelectItem value="joined">Newest Members</SelectItem>
                                                    <SelectItem value="name">Name (A-Z)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <ScrollArea className="h-[500px]">
                                        {/* min-w forces the table to overflow rather than squeeze.
                                            Without it `w-full` compresses seven columns into a phone
                                            width, and the Actions cell — which holds Impersonate —
                                            collapses to nothing with no way to scroll across to it. */}
                                        <Table className="min-w-[900px]">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>User</TableHead>
                                                    <TableHead>Business Name</TableHead>
                                                    <TableHead>Plan</TableHead>
                                                    <TableHead>Device</TableHead>
                                                    <TableHead>Language</TableHead>
                                                    <TableHead>Activity</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {processedUsers.map(user => {
                                                    const business = businesses?.find(b => b.id === user.businessId);
                                                    return (
                                                        <TableRow
                                                            key={user.id}
                                                            className="hover:bg-muted/50"
                                                        >
                                                            <TableCell onClick={() => { setSelectedUserForDetail(user); setIsUserDetailOpen(true); }} className="cursor-pointer">
                                                                <div className="font-medium">{business?.name || user.name || 'Unknown User'}</div><div className="text-xs text-muted-foreground">{user.email}</div>
                                                            </TableCell>
                                                            <TableCell onClick={() => { setSelectedUserForDetail(user); setIsUserDetailOpen(true); }} className="cursor-pointer">
                                                                {business?.name || 'N/A'}
                                                            </TableCell>
                                                            <TableCell>
                                                                {business ? (
                                                                    business.accessLevel === 'lifetime' ? <Badge variant="default" className="bg-green-600 hover:bg-green-700">Lifetime</Badge> : <Badge variant="secondary" className="capitalize">{business.plan || 'starter'}</Badge>
                                                                ) : <Badge variant="outline">N/A</Badge>}
                                                            </TableCell>
                                                            <TableCell>
                                                                {(() => {
                                                                    const { hasMicrosoftApp, hasMobileApp, hasWeb, isCrossPlatform } = classifyUserPlatform(user);
                                                                    return (
                                                                        <div className="flex flex-wrap items-center gap-1">
                                                                            {hasMicrosoftApp && (
                                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                                                                    <Laptop className="h-3 w-3 mr-1 inline" /> MS App
                                                                                </Badge>
                                                                            )}
                                                                            {hasMobileApp && (
                                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                                                                    <Smartphone className="h-3 w-3 mr-1 inline" /> Mobile
                                                                                </Badge>
                                                                            )}
                                                                            {isCrossPlatform && (
                                                                                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-semibold" title="Active on both Microsoft Desktop & Mobile apps">
                                                                                    ✨ Both
                                                                                </Badge>
                                                                            )}
                                                                            {hasWeb && !hasMicrosoftApp && !hasMobileApp && (
                                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800">
                                                                                    <Globe className="h-3 w-3 mr-1 inline" /> Web
                                                                                </Badge>
                                                                            )}
                                                                            {!hasMicrosoftApp && !hasMobileApp && !hasWeb && (
                                                                                <span className="text-muted-foreground text-xs">{user.deviceType || 'Web'}</span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </TableCell>
                                                            <TableCell>
                                                                {(() => {
                                                                    const lang = userLanguage(user.language);
                                                                    if (!lang) return <span className="text-muted-foreground text-xs">Unknown</span>;
                                                                    return (
                                                                        <Badge variant="outline" className="flex items-center gap-1.5 w-fit text-xs font-normal">
                                                                            <img src={`https://flagcdn.com/w40/${lang.flag}.png`} alt="" className="w-4 h-3 rounded-sm object-cover" />
                                                                            <span>{lang.nativeLabel}</span>
                                                                        </Badge>
                                                                    );
                                                                })()}
                                                            </TableCell>
                                                            <TableCell>
                                                                <UserPresence lastSeen={user.lastSeen} />
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-1">
                                                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleImpersonateUser(user); }} title="Impersonate User">
                                                                        <LogIn className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                                                    </Button>
                                                                    {business && (
                                                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedBusinessForIntel(business); setIsBusinessIntelOpen(true); }} title="View Business Intel">
                                                                            <Store className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                        <div className='space-y-6'>
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase />Assign Plan</CardTitle><CardDescription>Manually set a subscription plan.</CardDescription></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2"><Label htmlFor="plan-email">User Email</Label><Combobox options={userOptions} value={planUserEmail} onChange={setPlanUserEmail} placeholder="Select a user..." /></div>
                                    <div className="space-y-2"><Label>Plan</Label><Select value={selectedPlan} onValueChange={(v) => setSelectedPlan(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="business">Business</SelectItem></SelectContent></Select></div>
                                </CardContent>
                                <CardFooter><Button onClick={handleAssignPlan} disabled={isAssigningPlan} className="w-full">{isAssigningPlan && <Loader className="mr-2 h-4 w-4 animate-spin" />}Assign Plan</Button></CardFooter>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>Grant Access</CardTitle><CardDescription>Extend trial or grant lifetime.</CardDescription></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="grant-email">User Email</Label>
                                        <Combobox options={userOptions} value={grantEmail} onChange={setGrantEmail} placeholder="Select a user..." />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Switch id="lifetime-mode" checked={grantLifetime} onCheckedChange={setGrantLifetime} />
                                        <Label htmlFor="lifetime-mode">Lifetime Access</Label>
                                    </div>
                                    {!grantLifetime && (
                                        <div className="space-y-2">
                                            <Label>Expiry Date</Label>
                                            <Calendar mode="single" selected={grantDate} onSelect={setGrantDate} className="rounded-md border" />
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="flex flex-col gap-2">
                                    {hasLifetime && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button disabled={isRevoking} variant="destructive" className="w-full">
                                                    {isRevoking && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                                    Revoke Lifetime Access
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will revoke lifetime access for the business associated with <strong className="text-foreground">{grantEmail}</strong> and reset their plan to Starter.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleRevokeLifetime} className="bg-destructive hover:bg-destructive/90">
                                                        Yes, Revoke Access
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                    {!hasLifetime && (
                                        grantLifetime ? (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button disabled={isGranting} className="w-full bg-green-600 hover:bg-green-700">
                                                        {isGranting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                                        Grant Lifetime Access
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will grant <strong className="text-foreground">{grantEmail}</strong> permanent, unlimited access to Zeneva Business. This action is recorded in the audit logs.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleGrantAccess} className="bg-green-600 hover:bg-green-700">
                                                            Yes, Grant Lifetime
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        ) : (
                                            <Button onClick={handleGrantAccess} disabled={isGranting} className="w-full">
                                                {isGranting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                                Extend Trial
                                            </Button>
                                        )
                                    )}
                                </CardFooter>
                            </Card>
                            <Card className="border-red-500/20">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Emergency Control</CardTitle>
                                    <CardDescription>Halt / freeze any business instance instantly to block all actions.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="halt-email">User Email</Label>
                                        <Combobox options={userOptions} value={haltUserEmail} onChange={setHaltUserEmail} placeholder="Select a user..." />
                                    </div>
                                    {selectedHaltBusiness && (
                                        <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-1">
                                            <div><strong>Business:</strong> {selectedHaltBusiness.name}</div>
                                            <div><strong>Current Status:</strong> <span className={isSelectedBusinessHalted ? "text-destructive font-bold" : "text-green-600 font-bold"}>{isSelectedBusinessHalted ? "Halted / Frozen" : "Active"}</span></div>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="flex gap-2">
                                    <Button 
                                        onClick={handleToggleHaltBusiness} 
                                        disabled={isHalting || !haltUserEmail || isSelectedBusinessHalted} 
                                        variant="destructive"
                                        className="flex-1 font-bold"
                                    >
                                        {isHalting && !isSelectedBusinessHalted && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                        Halt Business
                                    </Button>
                                    <Button 
                                        onClick={handleToggleHaltBusiness} 
                                        disabled={isHalting || !haltUserEmail || !isSelectedBusinessHalted} 
                                        className="flex-1 font-bold bg-green-600 hover:bg-green-700 text-white disabled:bg-muted"
                                    >
                                        {isHalting && isSelectedBusinessHalted && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                        Resume Business
                                    </Button>
                                </CardFooter>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="broadcasts">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> System-Wide Broadcast</CardTitle>
                            <CardDescription>Send a notification to all active users on the platform.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 max-w-2xl">
                            {/* Preset Templates Selector */}
                            <div className="flex flex-wrap gap-2 mb-4 items-center">
                              <span className="text-xs font-semibold text-muted-foreground">Select Template:</span>
                              {[
                                {
                                  name: 'Theft Prevention Warning',
                                  title: 'Security Alert: Prevent Theft & Monitor Activity',
                                  message: 'We recommend checking your store\'s user activity logs and auditing handovers regularly to verify inventory balance.',
                                  type: 'alert',
                                  link: '/audit-log'
                                },
                                {
                                  name: 'Inventory Audit Required',
                                  title: 'Catalog Sync & Physical Stock Count',
                                  message: 'To prevent losses, please perform a physical inventory audit to ensure records in your local POS match your actual shelf stock.',
                                  type: 'warning',
                                  link: '/inventory'
                                },
                                {
                                  name: 'End of Day Reconciliation',
                                  title: 'Daily Sales & Cash Reconciliation',
                                  message: 'Make sure your cashiers do a final cash register count and compare it with the sales summary in daily sales report.',
                                  type: 'info',
                                  link: '/reports?tab=daily-sales'
                                },
                                {
                                  name: 'Scheduled Maintenance',
                                  title: 'Scheduled System Maintenance',
                                  message: 'Zeneva will undergo brief platform optimizations tonight at 12:00 AM UTC. Offline functionality will remain fully operational.',
                                  type: 'info',
                                  link: '/audit-log'
                                }
                              ].map(t => (
                                <Button 
                                  key={t.name} 
                                  type="button"
                                  variant="outline" 
                                  size="sm" 
                                  className="text-[10px] h-6 border-primary/20 text-primary hover:bg-primary/5 font-semibold" 
                                  onClick={() => {
                                    setBroadcastTitle(t.title);
                                    setBroadcastMessage(t.message);
                                    setBroadcastType(t.type as any);
                                    setBroadcastLink(t.link);
                                  }}
                                >
                                  {t.name}
                                </Button>
                              ))}
                            </div>

                            <div className="space-y-2">
                                <Label>Broadcast Title</Label>
                                <Input placeholder="e.g. Scheduled Maintenance" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Message Body</Label>
                                <Textarea placeholder="Details about the announcement..." value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Redirect Link / Target Page (Optional)</Label>
                                <Input placeholder="e.g. /audit-log, /inventory" value={broadcastLink} onChange={(e) => setBroadcastLink(e.target.value)} />
                                <p className="text-[10px] text-muted-foreground">Clicking the announcement bar will navigate users to this exact page (e.g. /audit-log for security or theft prevention).</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select value={broadcastType} onValueChange={(v: any) => setBroadcastType(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="info">Info (Blue)</SelectItem>
                                            <SelectItem value="warning">Warning (Orange)</SelectItem>
                                            <SelectItem value="alert">Alert (Red)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Duration (Hours)</Label>
                                    <Select value={broadcastDuration} onValueChange={setBroadcastDuration}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1 Hour</SelectItem>
                                            <SelectItem value="6">6 Hours</SelectItem>
                                            <SelectItem value="24">24 Hours</SelectItem>
                                            <SelectItem value="48">48 Hours</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSendBroadcast} disabled={isSendingBroadcast} className="w-full sm:w-auto">
                                {isSendingBroadcast && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                Send Broadcast
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Active & Past Broadcasts</CardTitle>
                            <CardDescription>Manage existing system-wide announcements.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Announcement</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead>Expires</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {systemBroadcasts && systemBroadcasts.length > 0 ? (
                                            systemBroadcasts.map((b: any) => {
                                                const isExpired = b.expiresAt?.toDate ? b.expiresAt.toDate() < new Date() : false;
                                                const isActive = b.isActive && !isExpired;
                                                
                                                return (
                                                    <TableRow key={b.id}>
                                                        <TableCell className="max-w-md">
                                                            <div className="font-semibold text-sm">{b.title}</div>
                                                            <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{b.message}</div>
                                                            {b.link && (
                                                                <div className="text-[10px] text-primary underline mt-1">{b.link}</div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={b.type === 'alert' ? 'destructive' : b.type === 'warning' ? 'default' : 'secondary'} className="capitalize">
                                                                {b.type || 'info'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            {b.createdAt?.toDate ? format(b.createdAt.toDate(), 'MMM d, h:mm a') : 'Recently'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            {b.expiresAt?.toDate ? format(b.expiresAt.toDate(), 'MMM d, h:mm a') : 'N/A'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isExpired ? (
                                                                <Badge variant="outline" className="text-zinc-500 border-zinc-500">Expired</Badge>
                                                            ) : b.isActive ? (
                                                                <Badge variant="outline" className="text-green-500 border-green-500 bg-green-500/5">Active</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-red-500 border-red-500 bg-red-500/5">Canceled</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end items-center gap-2">
                                                                {!isExpired && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 text-xs font-semibold"
                                                                        onClick={() => handleToggleBroadcastActive(b.id, b.isActive)}
                                                                    >
                                                                        {b.isActive ? 'Cancel/Disable' : 'Enable'}
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                                                    onClick={() => handleDeleteBroadcast(b.id)}
                                                                    title="Delete Permanently"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-zinc-500 text-sm">
                                                    No broadcasts sent yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card className="mt-6 border-orange-500/30 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground">
                                <Sparkles className="h-5 w-5 text-orange-500" /> "What's New" Feature Release Video Modal
                            </CardTitle>
                            <CardDescription>
                                Broadcast a major release modal with an embedded YouTube video or MP4 demo, displayed once to all users.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 max-w-2xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Release Title</Label>
                                    <Input
                                        placeholder="e.g. Introducing Quick Zen AI Assistant"
                                        value={featureTitle}
                                        onChange={(e) => setFeatureTitle(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Badge / Version Tag</Label>
                                    <Input
                                        placeholder="e.g. v3.2.8 Update"
                                        value={featureBadge}
                                        onChange={(e) => setFeatureBadge(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>YouTube or Video URL (Optional)</Label>
                                <Input
                                    placeholder="e.g. https://www.youtube.com/watch?v=... or https://.../demo.mp4"
                                    value={featureVideoUrl}
                                    onChange={(e) => setFeatureVideoUrl(e.target.value)}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Paste a YouTube link or direct video file. If left blank, a sleek dark animated showcase canvas will be shown.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    rows={3}
                                    placeholder="Explain the new feature, shortcuts (e.g. Ctrl key), and value to the merchant..."
                                    value={featureDescription}
                                    onChange={(e) => setFeatureDescription(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Action Button Text</Label>
                                    <Input
                                        placeholder="e.g. Try Zen AI (Ctrl)"
                                        value={featureActionText}
                                        onChange={(e) => setFeatureActionText(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Action Href / Link</Label>
                                    <Input
                                        placeholder="e.g. /ai-insights or /terminal"
                                        value={featureActionHref}
                                        onChange={(e) => setFeatureActionHref(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button
                                onClick={handlePublishFeatureUpdate}
                                disabled={isSavingFeatureUpdate}
                                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs h-9 px-5 rounded-xl shadow-sm"
                            >
                                {isSavingFeatureUpdate && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                Publish "What's New" Video Update
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>



                <TabsContent value="followups" className="space-y-6">
                    <FollowUpCenter 
                        atRiskBusinesses={platformAnalytics.atRiskBusinesses}
                        scoredLeads={platformAnalytics.scoredLeads}
                        users={users || []}
                        conversionRate={platformAnalytics.conversionRate}
                        churnRiskCount={platformAnalytics.churnRiskList.length}
                        cachedLogs={outreachLogs}
                        cachedSentCount={outreachSentCount}
                        isLoading={isOutreachLoading}
                        onRefresh={() => fetchOutreachData(true)}
                        onMount={fetchOutreachData}
                    />
                </TabsContent>
                <TabsContent value="content" className="space-y-6">
                    <ContentStrategyCenter 
                        platformStats={{
                            totalUsers: analyticsData.totalUsers,
                            totalBusinesses: platformAnalytics.totalActiveBusinesses,
                            totalProducts: analyticsData.totalProducts,
                            totalReceipts: analyticsData.totalReceipts,
                            platformGmv: analyticsData.platformGmv,
                            averageSalesPerDay: analyticsData.averageSalesPerDay,
                            platformAOV: analyticsData.platformAOV,
                            topLocation: platformAnalytics.topLocations?.[0]?.name || 'Nigeria',
                            topIndustries: platformAnalytics.industryData.slice(0, 3).map(i => i.name)
                        }}
                    />
                </TabsContent>
                <TabsContent value="recruitment" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-primary" />
                                Talent Acquisitions ({applicationsTotal ?? applications?.length ?? 0})
                            </CardTitle>
                            <CardDescription>
                                Review and manage job applications for Zeneva roles.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Candidate</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Applied</TableHead>
                                            <TableHead>Pitch</TableHead>
                                            <TableHead>Links</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {applications && applications.length > 0 ? (
                                            applications.map((app) => (
                                                <TableRow key={app.id}>
                                                    <TableCell className="font-medium">
                                                        <div>{app.name}</div>
                                                        <div className="text-xs text-muted-foreground">{app.email}</div>
                                                        <div className="text-xs text-muted-foreground">{app.phone}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{app.jobTitle || app.jobId}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {app.createdAt?.toDate ? format(app.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'}
                                                    </TableCell>
                                                    <TableCell className="max-w-xs truncate text-sm" title={app.pitch}>
                                                        {app.pitch}
                                                    </TableCell>
                                                    <TableCell>
                                                        {app.portfolio && (
                                                            <Button variant="link" size="sm" asChild className="h-auto p-0">
                                                                <a href={app.portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                                                    View File <Globe className="h-3 w-3" />
                                                                </a>
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={app.status === 'pending' ? 'secondary' : 'default'} className="capitalize">
                                                            {app.status || 'pending'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            onClick={() => handleDeleteApplication(app.id)}
                                                            className="hover:bg-destructive/10 hover:text-destructive group"
                                                            title="Delete Application"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                                    No applications received yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="grants" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Trophy className="h-5 w-5 text-primary" />
                                    Verified Business Grants ({grantsTotal ?? grants?.length ?? 0})
                                </CardTitle>
                                <CardDescription>
                                    Publish and manage verified grant opportunities shown to business owners on the platform.
                                </CardDescription>
                            </div>
                            <Button onClick={() => setIsCreateGrantOpen(true)} className="gap-2 h-10 px-4">
                                <PlusCircle className="h-4 w-4" />
                                Publish Grant
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Grant Title</TableHead>
                                            <TableHead>Funder</TableHead>
                                            <TableHead>Funding Amount</TableHead>
                                            <TableHead>Eligibility</TableHead>
                                            <TableHead>Date Added</TableHead>
                                            <TableHead>Application Link</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {grants && grants.length > 0 ? (
                                            grants.map((grant) => (
                                                <TableRow key={grant.id}>
                                                    <TableCell className="font-semibold">{grant.title}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{grant.funder}</Badge>
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-emerald-600">
                                                        {grant.amount}
                                                    </TableCell>
                                                    <TableCell className="text-sm max-w-xs truncate" title={grant.eligibility}>
                                                        {grant.eligibility}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {grant.createdAt?.toDate ? format(grant.createdAt.toDate(), 'MMM d, yyyy') : 'Pre-populated'}
                                                    </TableCell>
                                                    <TableCell className="text-sm max-w-xs truncate" title={grant.applicationUrl}>
                                                        <a href={grant.applicationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                            {grant.applicationUrl}
                                                        </a>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            onClick={() => handleDeleteGrant(grant.id)}
                                                            className="hover:bg-destructive/10 hover:text-destructive group"
                                                            title="Delete Grant"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                                    No custom grants published yet. Displaying fallback verified grants on public portal.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="security">
                    <CyberShield 
                        allBusinesses={businesses} 
                        allUsers={users} 
                        isLoadingBusinesses={false} 
                    />
                </TabsContent>

                {/* ======================== USAGE ANALYTICS TAB ======================== */}
                <TabsContent value="usage" className="space-y-6">
                    <UsageAnalyticsTab users={users || []} businesses={businesses || []} />
                </TabsContent>

                {/* ======================== STOREFRONT & ORDERS TAB ======================== */}
                <TabsContent value="storefront-orders" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Store className="h-5 w-5 text-primary" />
                                Storefront & Receipt Engagement Center
                            </CardTitle>
                            <CardDescription>
                                Track shared public storefronts, customer traffic links, and incoming online orders.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Left Side: Storefront Shares & Traffic */}
                                <Card className="p-4 space-y-4">
                                    <h3 className="font-bold text-base flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-primary" />
                                        Storefront Link Shares ({storefrontSharesTotal ?? storefrontShares.length})
                                    </h3>
                                    <div className="max-h-[350px] overflow-y-auto border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Business</TableHead>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Date</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {storefrontShares.length > 0 ? (
                                                    storefrontShares.map((share, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell className="font-medium text-xs">{share.businessName}</TableCell>
                                                            <TableCell className="text-xs capitalize">
                                                                <Badge variant="secondary">{share.type}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-[10px] text-muted-foreground">
                                                                {share.timestamp?.toDate ? format(share.timestamp.toDate(), 'PP p') : 'N/A'}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-xs py-8 text-muted-foreground">
                                                            No storefront link shares logged yet.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </Card>

                                {/* Right Side: Receipt link shares */}
                                <Card className="p-4 space-y-4">
                                    <h3 className="font-bold text-base flex items-center gap-2">
                                        <Share2 className="h-4 w-4 text-primary" />
                                        Receipt Shares ({receiptSharesTotal ?? receiptShares.length})
                                    </h3>
                                    <div className="max-h-[350px] overflow-y-auto border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Receipt #</TableHead>
                                                    <TableHead>Business</TableHead>
                                                    <TableHead>Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {receiptShares.length > 0 ? (
                                                    receiptShares.map((share, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell className="font-mono text-xs">{share.receiptNumber}</TableCell>
                                                            <TableCell className="text-xs">{share.businessName}</TableCell>
                                                            <TableCell className="text-xs font-bold">₦{share.totalAmount?.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-xs py-8 text-muted-foreground">
                                                            No receipt link shares logged yet.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </Card>
                            </div>

                            {/* Bottom: Online orders across all stores */}
                            <div className="mt-8 space-y-4">
                                <h3 className="font-bold text-base flex items-center gap-2">
                                    <ShoppingCart className="h-4 w-4 text-primary" />
                                    Incoming Storefront Online Orders ({onlineOrdersTotal ?? onlineOrders.length})
                                </h3>
                                <div className="border rounded-md overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Order ID</TableHead>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Items</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {onlineOrders.length > 0 ? (
                                                onlineOrders.map((order, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-mono text-xs">
                                                            {order.id?.substring(0, 8) || 'N/A'}
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            <div>{order.customerName || 'Guest'}</div>
                                                            <div className="text-[10px] text-muted-foreground">{order.customerPhone || ''}</div>
                                                        </TableCell>
                                                        <TableCell className="text-xs capitalize">
                                                            <Badge variant={order.status === 'paid' ? 'default' : 'secondary'}>
                                                                {order.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs max-w-[200px] truncate">
                                                            {order.items?.map((item: any) => `${item.name} (x${item.quantity})`).join(', ') || 'N/A'}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs font-bold">
                                                            ₦{order.total?.toLocaleString()}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center text-xs py-8 text-muted-foreground">
                                                        No storefront orders placed yet.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={certificateModalState?.open || false} onOpenChange={(open) => !open && setCertificateModalState(null)}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 gap-0">
                    <DialogTitle className="sr-only">Platform Achievement</DialogTitle>
                    <DialogDescription className="sr-only">Platform achievement milestone download view</DialogDescription>

                    <div ref={cardRef} className="relative p-8 flex flex-col items-center text-center bg-background min-h-[420px] justify-center">
                        <div className="absolute inset-0 z-0">
                            <Image
                                src="/achievement_bg.png"
                                alt="Background"
                                fill
                                sizes="100vw"
                                className="object-cover opacity-40"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent" />
                        </div>

                        <div className="relative z-10 mb-4 px-3 py-1 bg-yellow-500/10 backdrop-blur-md border border-yellow-500/20 rounded-full">
                            <p className="text-xs font-bold text-yellow-600 tracking-wide">
                                Zeneva Admin Analytics
                            </p>
                        </div>

                        <div className="relative z-10 w-32 h-32 bg-background/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl mb-6 ring-4 ring-yellow-500/20 text-yellow-500">
                            {certificateModalState?.icon && (
                                <div className="text-yellow-500 flex items-center justify-center">
                                    {(() => {
                                        const IconComponent = certificateModalState.icon;
                                        return <IconComponent className="h-16 w-16" />;
                                    })()}
                                </div>
                            )}
                        </div>

                        <div className="relative z-10 w-full mb-6">
                            <h2 className="text-2xl font-bold text-primary mb-2 leading-tight">
                                {certificateModalState?.title}
                            </h2>
                            <p className="text-base text-foreground/80 font-medium px-4">
                                {certificateModalState?.description}
                            </p>
                        </div>

                        <div className="relative z-10 grid grid-cols-1 gap-4 w-full bg-white/60 backdrop-blur-sm border border-white/20 p-4 rounded-xl shadow-sm">
                            <div className="text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Current Metric</p>
                                <p className="text-sm font-bold mt-1 text-primary">
                                    {certificateModalState?.value}
                                </p>
                            </div>
                        </div>

                        <div className="absolute bottom-4 left-0 right-0 text-center">
                            <p className="text-[11px] font-black text-primary/80">
                                zeneva.space - Certified Result
                            </p>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/30 border-t flex flex-col gap-3">
                        <Button variant="outline" className="w-full gap-2 h-11 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary" onClick={async () => {
                            if (!cardRef.current) return;
                            setIsDownloading(true);
                            try {
                                const canvas = await html2canvas(cardRef.current, { useCORS: true, scale: 3, backgroundColor: null });
                                const dataUrl = canvas.toDataURL('image/png');
                                const link = document.createElement('a');
                                link.href = dataUrl;
                                link.download = `zeneva-analytic-${(certificateModalState?.title || 'card').replace(/\s+/g, '-').toLowerCase()}.png`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                toast({ title: "Downloaded!", description: "Your card has been saved." });
                            } catch (e) {
                                toast({ variant: "destructive", title: "Failed", description: "Download failed." });
                            } finally {
                                setIsDownloading(false);
                            }
                        }} disabled={isDownloading}>
                            {isDownloading ? "Downloading..." : <><Download className="h-4 w-4" /> Download Result Card</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>


            <Dialog open={isCreateGrantOpen} onOpenChange={setIsCreateGrantOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-primary" />
                            Publish Verified Business Grant
                        </DialogTitle>
                        <DialogDescription>
                            Enter details to add a new verified grant to the public business directory.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateGrant} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="title">Grant Title</Label>
                            <Input id="title" name="title" required placeholder="e.g. Tony Elumelu Foundation Grant Scheme" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="funder">Funder Name</Label>
                            <Input id="funder" name="funder" required placeholder="e.g. Tony Elumelu Foundation" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="amount">Funding Amount (₦)</Label>
                            <Input id="amount" name="amount" required placeholder="e.g. ₦2,500,000" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="eligibility">Target Eligibility</Label>
                            <Input id="eligibility" name="eligibility" required placeholder="e.g. African startups under 5 years old" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="applicationUrl">Application URL</Label>
                            <Input id="applicationUrl" name="applicationUrl" type="url" required placeholder="https://www.tefconnect.net/" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="description">Short Description</Label>
                            <Textarea id="description" name="description" required placeholder="Outline program details, deadlines, and key benefits..." className="min-h-[100px] resize-none" />
                        </div>
                        <div className="flex gap-3 justify-end pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsCreateGrantOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPublishingGrant}>
                                {isPublishingGrant ? "Publishing..." : "Publish Opportunity"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <DownloadIntelligenceDialog
                open={isDownloadIntelOpen}
                onOpenChange={setIsDownloadIntelOpen}
                downloadClicks={downloadClicks || []}
                downloadStats={analyticsData.downloadStats}
            />

            <ImportIntelligenceDialog
                open={isImportIntelOpen}
                onOpenChange={setIsImportIntelOpen}
                importAttempts={importAttempts || []}
                businesses={businesses}
            />

            <SaaSMetricsDetailDialog
                open={isSaaSMetricsOpen}
                onOpenChange={setIsSaaSMetricsOpen}
                mrr={analyticsData.mrr}
                arr={analyticsData.arr}
                mrrDescription={analyticsData.mrrDescription}
                arrDescription={analyticsData.arrDescription}
                validPurchases={analyticsData.validPurchases || []}
                checkoutAttempts={checkoutAttempts}
                totalSubscriptionRevenue={analyticsData.totalSubscriptionRevenue || 0}
                totalCreditPackRevenue={analyticsData.totalCreditPackRevenue || 0}
                payingBusinessesCount={analyticsData.payingBusinesses?.length || 0}
                businesses={businesses}
            />

            <TopPerformersDialog
                open={isTopPerformersOpen}
                onOpenChange={setIsTopPerformersOpen}
                topPerformers={analyticsData.allPerformers || []}
                users={users}
            />

            <BusinessDetailDialog
                open={detailModalState.open}
                onOpenChange={(open) => setDetailModalState(prev => ({ ...prev, open }))}
                title={detailModalState.title}
                description={detailModalState.description}
                businesses={detailModalState.businesses}
                users={users}
                isInfoOnly={detailModalState.isInfoOnly}
            />

            <UserListDialog
                open={userListModalState.open}
                onOpenChange={(open) => setUserListModalState(prev => ({ ...prev, open }))}
                title={userListModalState.title}
                description={userListModalState.description}
                users={userListModalState.users}
                businesses={businesses}
            />

            <ZenevaMilestoneDialog
                open={isAgeMilestoneOpen}
                onOpenChange={setIsAgeMilestoneOpen}
                daysActive={analyticsData.daysActive}
                totalSales={convertedReceipts?.length || 0}
                totalBusinesses={platformAnalytics.totalActiveBusinesses}
                totalUsers={analyticsData.totalUsers}
                launchDate={analyticsData.earliestBusiness}
                averageSalesPerDay={analyticsData.averageSalesPerDay}
                averageReceiptsPerDay={analyticsData.averageReceiptsPerDay}
                platformAOV={analyticsData.platformAOV}
                arr={analyticsData.arr}
                topLocation={platformAnalytics.topLocations?.[0]?.name || 'N/A'}
            />

            <UserDetailDialog
                user={selectedUserForDetail}
                business={businesses?.find(b => b.id === selectedUserForDetail?.businessId)}
                open={isUserDetailOpen}
                onOpenChange={setIsUserDetailOpen}
            />

            <BusinessIntelDialog
                business={selectedBusinessForIntel}
                owner={users?.find(u => u.id === selectedBusinessForIntel?.ownerId) || null}
                businessProducts={(products || []).filter(p => p.businessId === selectedBusinessForIntel?.id)}
                businessReceipts={(receipts || []).filter(r => r.businessId === selectedBusinessForIntel?.id)}
                businessUsers={(users || []).filter(u => u.businessId === selectedBusinessForIntel?.id)}
                businessBranches={(branches || []).filter(b => b.businessId === selectedBusinessForIntel?.id)}
                open={isBusinessIntelOpen}
                onOpenChange={setIsBusinessIntelOpen}
            />

            <Dialog open={isSalesVelocityOpen} onOpenChange={isSalesVelocityOpen ? setIsSalesVelocityOpen : undefined}>
                <DialogContent className="max-w-4xl w-[95vw]">
                    <DialogHeader>
                        <DialogTitle className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary" />
                                Platform Sales Velocity
                            </span>
                            <div className="flex items-center gap-2 select-none mr-6 no-capture">
                                <span className="text-xs text-muted-foreground font-normal">Period:</span>
                                <Select value={velocityFilter} onValueChange={(v: any) => setVelocityFilter(v)}>
                                    <SelectTrigger className="w-[120px] h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="7">Last 7 Days</SelectItem>
                                        <SelectItem value="14">Last 14 Days</SelectItem>
                                        <SelectItem value="30">Last 30 Days</SelectItem>
                                        <SelectItem value="90">Last 90 Days</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </DialogTitle>
                        <DialogDescription>
                            Historical sales performance across and transaction frequency.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <StatCard title="Total Platform GMV" value={`₦${analyticsData.platformGmv.toLocaleString()}`} icon={DollarSign} />
                            <StatCard title="Total Sales Count" value={analyticsData.totalReceipts.toLocaleString()} icon={FileText} />
                            <StatCard title="Overall ARPU" value={`₦${(analyticsData.platformGmv / (analyticsData.revenueGeneratingBusinessesCount || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={Users} />
                        </div>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Daily Revenue (Last {velocityFilter} Days)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ReLineChart data={analyticsData.dailyGmvData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false} 
                                                tickFormatter={(v) => {
                                                    if (v >= 1000000) return `₦${(v / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
                                                    if (v >= 1000) return `₦${(v / 1000).toFixed(0)}k`;
                                                    return `₦${v}`;
                                                }} 
                                            />
                                            <ReTooltip content={<CustomTooltip />} />
                                            <Line type="monotone" dataKey="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </ReLineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Helper to convert Firebase Admin timestamp objects `{ _seconds, _nanoseconds }`
// back into Firestore client Timestamp-like objects with a `.toDate()` method.
const reviveTimestamps = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(reviveTimestamps);
    
    if (typeof obj === 'object') {
        if ('_seconds' in obj && '_nanoseconds' in obj) {
            const ms = obj._seconds * 1000 + obj._nanoseconds / 1000000;
            const d = new Date(ms);
            return {
                seconds: obj._seconds,
                nanoseconds: obj._nanoseconds,
                toDate: () => d
            };
        }
        
        const newObj: any = {};
        for (const key in obj) {
            newObj[key] = reviveTimestamps(obj[key]);
        }
        return newObj;
    }
    return obj;
};

/**
 * How many rows the append-only admin logs load.
 *
 * These collections (job applications, grants, checkout attempts, storefront and
 * receipt shares, storefront orders) only ever feed a scrolling table, so they
 * are bounded to the newest ADMIN_LOG_LIMIT rows. Every one of them is ordered
 * newest-first first: Firestore's implicit order is *ascending*, so a bare
 * limit() would have pinned these tables to the oldest rows in the collection
 * and frozen out everything recent.
 *
 * The tab headings show collection totals, which no longer match what is loaded,
 * so those come from getCountFromServer instead — a count bills a fraction of a
 * read regardless of collection size, rather than one read per document.
 *
 * The platform-wide analytics listeners (users, businessInstances, products,
 * receipts, purchases, branches) are deliberately NOT bounded: they back
 * lifetime per-business figures — activation ("10+ products and 1+ sale ever"),
 * GMV, AOV, units sold, churn — and truncating them would quietly report wrong
 * numbers rather than fewer. Fixing those properly means reading the
 * per-business stats/overall rollup instead of every receipt; see the note on
 * ADMIN_ANALYTICS_LISTENERS below.
 */
const ADMIN_LOG_LIMIT = 250;

export default function AdminDashboardPage() {
    const firestore = useFirestore();

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('name')), [firestore]);
    const businessesQuery = useMemoFirebase(() => query(collection(firestore, 'businessInstances')), [firestore]);
    const productsQuery = useMemoFirebase(() => query(collection(firestore, 'products')), [firestore]);
    const applicationsQuery = useMemoFirebase(() => query(collection(firestore, 'job_applications'), orderBy('createdAt', 'desc'), limit(ADMIN_LOG_LIMIT)), [firestore]);
    const grantsQuery = useMemoFirebase(() => query(collection(firestore, 'grants'), orderBy('createdAt', 'desc'), limit(ADMIN_LOG_LIMIT)), [firestore]);
    const receiptsQuery = useMemoFirebase(() => query(collection(firestore, 'receipts'), orderBy('createdAt', 'desc')), [firestore]);
    const purchasesQuery = useMemoFirebase(() => query(collection(firestore, 'purchases')), [firestore]);
    // Deliberately unbounded: one doc per visitor (not per click), and it backs
    // an all-time platform breakdown, so a limit would silently change the
    // windows/macos/android split. It is also not growing — its only writer is
    // api/download/[platform], which is still a disabled .bak route.
    const downloadClicksQuery = useMemoFirebase(() => query(collection(firestore, 'download_clicks')), [firestore]);
    const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
    const checkoutAttemptsQuery = useMemoFirebase(() => query(collection(firestore, 'checkout_attempts'), orderBy('timestamp', 'desc'), limit(ADMIN_LOG_LIMIT)), [firestore]);
    const importAttemptsQuery = useMemoFirebase(() => query(collection(firestore, 'import_attempts'), orderBy('timestamp', 'desc'), limit(ADMIN_LOG_LIMIT)), [firestore]);
    const storefrontSharesQuery = useMemoFirebase(() => query(collection(firestore, 'storefront_shares'), orderBy('timestamp', 'desc'), limit(ADMIN_LOG_LIMIT)), [firestore]);
    const receiptSharesQuery = useMemoFirebase(() => query(collection(firestore, 'receipt_shares'), orderBy('timestamp', 'desc'), limit(ADMIN_LOG_LIMIT)), [firestore]);
    // NOTE: the orderBy on a collectionGroup needs a COLLECTION_GROUP-scoped
    // index on onlineOrders.createdAt — Firestore only auto-creates single-field
    // indexes at COLLECTION scope. It is declared in firestore.indexes.json, so
    // `firebase deploy --only firestore:indexes` must land BEFORE this ships or
    // this listener throws. Deploying an index first is safe: it is additive and
    // does not affect the running app.
    const onlineOrdersQuery = useMemoFirebase(() => query(collectionGroup(firestore, 'onlineOrders'), orderBy('createdAt', 'desc'), limit(ADMIN_LOG_LIMIT)), [firestore]);

    const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);
    const { data: businesses, isLoading: businessesLoading } = useCollection<BusinessInstance>(businessesQuery);
    const { data: products, isLoading: productsLoading } = useCollection<Product>(productsQuery);
    const { data: applications, isLoading: applicationsLoading } = useCollection<any>(applicationsQuery);
    const { data: grants, isLoading: grantsLoading } = useCollection<any>(grantsQuery);
    const { data: receipts, isLoading: receiptsLoading } = useCollection<Receipt>(receiptsQuery);
    const { data: purchases, isLoading: purchasesLoading } = useCollection<Purchase>(purchasesQuery);
    const { data: downloadClicks, isLoading: downloadClicksLoading } = useCollection<any>(downloadClicksQuery);
    const { data: branches, isLoading: branchesLoading } = useCollection<any>(branchesQuery);
    const { data: checkoutAttempts, isLoading: checkoutAttemptsLoading } = useCollection<any>(checkoutAttemptsQuery);
    const { data: importAttempts, isLoading: importAttemptsLoading } = useCollection<any>(importAttemptsQuery);
    const { data: storefrontShares, isLoading: storefrontSharesLoading } = useCollection<any>(storefrontSharesQuery);
    const { data: receiptShares, isLoading: receiptSharesLoading } = useCollection<any>(receiptSharesQuery);
    const { data: onlineOrders, isLoading: onlineOrdersLoading } = useCollection<any>(onlineOrdersQuery);

    const isLoading = usersLoading || businessesLoading || productsLoading || applicationsLoading || grantsLoading || receiptsLoading || purchasesLoading || downloadClicksLoading || branchesLoading || checkoutAttemptsLoading || importAttemptsLoading || storefrontSharesLoading || receiptSharesLoading || onlineOrdersLoading;

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-lg">Loading Admin Dashboard...</p>
            </div>
        );
    }

    return <AdminDashboardContent 
        users={users || []} 
        branches={branches || []} 
        businesses={businesses || []} 
        products={products || []} 
        receipts={receipts || []} 
        purchases={purchases || []} 
        applications={applications || []} 
        downloadClicks={downloadClicks || []} 
        grants={grants || []} 
        checkoutAttempts={checkoutAttempts || []} 
        importAttempts={importAttempts || []}
        storefrontShares={storefrontShares || []}
        receiptShares={receiptShares || []}
        onlineOrders={onlineOrders || []}
    />
}