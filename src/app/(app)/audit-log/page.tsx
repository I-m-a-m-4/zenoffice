'use client';

import * as React from 'react';
import Link from 'next/link'; // Import Link
import { usePOS } from '@/context/pos-context';
import { hasBusinessFeatures } from '@/lib/plan';
import { useBranch } from '@/context/branch-context';
import { collection, query, orderBy, limit, startAfter, onSnapshot, getDocs } from 'firebase/firestore';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { terminalListenerErrorHandler } from '@/firebase/retry';
import type { AuditLog } from '@/types';
import PageTitle from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, User, FileText, Package, ShieldCheck, Radar } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import FeatureGate from '@/components/shared/feature-gate';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { safeToDate } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { runForensicScan, DETECTOR_COUNT, type ForensicReport } from '@/lib/forensics';
import { ForensicReportView } from '@/components/audit/forensic-report';

/**
 * How much audit history one scan reads.
 *
 * The page itself pages through 50 at a time, which is nowhere near enough to
 * find a pattern — a void rate needs weeks of context, not the last afternoon.
 * 600 covers roughly a quarter of trading for a busy shop and the whole history
 * of a small one, and it is a single query the owner asked for by pressing the
 * button. The result is held for the session so a second press costs nothing;
 * see MEMORY: Firestore cost is a standing constraint.
 */
const SCAN_LOG_LIMIT = 600;

const actionIcons: { [key: string]: React.ElementType } = {
    'product': Package,
    'sale': FileText,
    'user': User,
    'customer': User,
};

function AuditLogRowSkeleton() {
    return (
        <TableRow>
            <TableCell>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                </div>
            </TableCell>
            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
            <TableCell><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-40" /></div></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
        </TableRow>
    )
}

function UpgradeModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="text-primary h-5 w-5" /> Upgrade to Business Plan
                    </DialogTitle>
                    <DialogDescription>
                        The forensic scan is a Business Plan feature. It runs {DETECTOR_COUNT} loss-prevention
                        checks across your sales, stock movements and audit trail to surface the patterns that
                        internal theft leaves behind.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <h4 className="font-semibold mb-2">What the scan looks for:</h4>
                    <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                        <li>Sales cancelled by the person who rang them up.</li>
                        <li>Discounts, price overrides and write-offs out of line with the rest of your team.</li>
                        <li>Prices cut, used for one sale, then quietly restored.</li>
                        <li>Trading outside your opening hours, and stock edited overnight.</li>
                        <li>A per-person risk profile, with the evidence behind every flag.</li>
                    </ul>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Maybe Later</Button>
                    <Button asChild>
                        <Link href="/billing">Upgrade Now</Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AuditLogPageContent() {
    const { business, isLoading: isPosLoading, auditLogs: cachedAuditLogs, isOnline, receipts, products, customers, users, currencySymbol } = usePOS();
    const { activeBranchId } = useBranch();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isScanning, setIsScanning] = React.useState(false);
    const [report, setReport] = React.useState<ForensicReport | null>(null);
    const [selectedLog, setSelectedLog] = React.useState<AuditLog | null>(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [actionFilter, setActionFilter] = React.useState('all');
    const [isFetchingMore, setIsFetchingMore] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(true);
    const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>(() => cachedAuditLogs && cachedAuditLogs.length > 0 ? cachedAuditLogs : []);

    // Deep history pulled for the scan, kept for the session so pressing the
    // button twice costs one read, not two. Also the lookup table behind the
    // report's evidence links - those reference logs outside the 50 on screen.
    const scanLogsRef = React.useRef<AuditLog[] | null>(null);
    const reportRef = React.useRef<HTMLDivElement | null>(null);

    // The initialiser above only sees the cache as it stood on first render, and
    // the SQLite hydration behind cachedAuditLogs resolves a tick later - so
    // offline the page would sit empty next to a populated cache. Adopt it when it
    // arrives; online the listener below overwrites this with fresher data.
    React.useEffect(() => {
        if (!cachedAuditLogs || cachedAuditLogs.length === 0) return;
        setAuditLogs(prev => (prev.length === 0 ? cachedAuditLogs : prev));
    }, [cachedAuditLogs]);

    // Fetch Initial Logs
    React.useEffect(() => {
        if (!business?.id || !firestore) return;

        const baseQuery = query(
            collection(firestore, 'businessInstances', business.id, 'auditLogs'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(baseQuery, (snap) => {
            const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) } as AuditLog));
            setAuditLogs(logs);
            if (snap.docs.length < 50) setHasMore(false);
        }, terminalListenerErrorHandler('Audit log', () => {
            unsubscribe();
            setHasMore(false);
        }));

        return () => unsubscribe();
    }, [business?.id, firestore]);

    const handleLoadMore = async () => {
        if (!business?.id || !firestore || auditLogs.length === 0) return;
        setIsFetchingMore(true);
        try {
            const lastDoc = auditLogs[auditLogs.length - 1];
            const nextQuery = query(
                collection(firestore, 'businessInstances', business.id, 'auditLogs'),
                orderBy('createdAt', 'desc'),
                startAfter(lastDoc.createdAt),
                limit(50)
            );
            const snap = await getDocs(nextQuery);
            const more = snap.docs.map(doc => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) } as AuditLog));
            if (more.length > 0) {
                setAuditLogs(prev => [...prev, ...more]);
            }
            if (snap.docs.length < 50) setHasMore(false);
        } finally {
            setIsFetchingMore(false);
        }
    };

    /**
     * The branch scope, as one predicate.
     *
     * Shared with the scan on purpose. `receipts`, `products` and `customers` come
     * out of the POS context already filtered to `activeBranchId`, so scanning
     * against unfiltered audit logs would compare one branch's sales against every
     * branch's voids and write-offs — inflating every rate and pinning them on
     * staff whose own sales had been excluded.
     */
    const inActiveBranch = React.useCallback((log: AuditLog) => {
        if (!activeBranchId || activeBranchId === 'all') return true;
        if (activeBranchId === business?.id) {
            return !log.branchId || log.branchId === business?.id || log.branchId === 'all' || log.details?.branchId === business?.id;
        }
        return log.branchId === activeBranchId || log.details?.branchId === activeBranchId;
    }, [activeBranchId, business?.id]);

    const filteredLogs = React.useMemo(() => {
        let result = auditLogs.filter(inActiveBranch);

        if (actionFilter !== 'all') {
            result = result.filter(log => log.action.startsWith(`${actionFilter}.`));
        }
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(log => 
                log.userName?.toLowerCase().includes(lower) || 
                log.userEmail?.toLowerCase().includes(lower) ||
                log.details?.entityName?.toLowerCase().includes(lower) ||
                log.id.toLowerCase().includes(lower)
            );
        }
        return result;
    }, [auditLogs, actionFilter, searchTerm, inActiveBranch]);

    /**
     * Gather the evidence and run the detectors.
     *
     * Everything except the deep audit history comes from the POS cache, which is
     * already in memory — products, receipts, customers and the staff directory
     * cost nothing to re-read here. Only the audit log needs a real query, and
     * only the first time, because the page holds 50 rows and no pattern is
     * visible in 50. See MEMORY: Firestore cost is a standing constraint.
     *
     * The detection itself is synchronous arithmetic in `src/lib/forensics.ts` —
     * no model, no network. That is deliberate: the report names people, so it has
     * to give the same answer twice.
     */
    const handleScan = async () => {
        if (!hasBusinessFeatures(business)) {
            setIsUpgradeModalOpen(true);
            return;
        }
        if (isScanning) return;

        setIsScanning(true);
        try {
            let logsForScan = scanLogsRef.current;

            if (!logsForScan) {
                if (isOnline && business?.id && firestore) {
                    try {
                        const deepQuery = query(
                            collection(firestore, 'businessInstances', business.id, 'auditLogs'),
                            orderBy('createdAt', 'desc'),
                            limit(SCAN_LOG_LIMIT)
                        );
                        const snap = await getDocs(deepQuery);
                        logsForScan = snap.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data({ serverTimestamps: 'estimate' }),
                        } as AuditLog));
                        scanLogsRef.current = logsForScan;
                    } catch (e) {
                        // A failed deep read is not a failed scan — fall back to
                        // what is on screen and let the coverage panel account for
                        // the shorter window.
                        console.warn('Deep audit history unavailable, scanning loaded logs only', e);
                    }
                }
                if (!logsForScan) logsForScan = auditLogs;
            }

            if ((!logsForScan || logsForScan.length === 0) && (!receipts || receipts.length === 0)) {
                toast({
                    variant: 'destructive',
                    title: 'Nothing to scan yet',
                    description: 'There are no sales or audit records for this business.',
                });
                return;
            }

            const result = runForensicScan({
                receipts: receipts ?? [],
                // Branch-scoped to match the receipts above. See inActiveBranch.
                auditLogs: (logsForScan ?? []).filter(inActiveBranch),
                products: products ?? [],
                users: users ?? [],
                customers: customers ?? [],
                settings: business?.settings ?? null,
                currency: currencySymbol,
                ownerId: business?.ownerId ?? null,
            });

            setReport(result);
            // Scroll after paint, or the node the ref points at has not rendered.
            requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

            toast({
                variant: result.findings.length === 0 ? 'success' : 'default',
                title: result.findings.length === 0 ? 'Scan clean' : `${result.findings.length} finding(s)`,
                description:
                    result.findings.length === 0
                        ? `${result.checksRun} checks ran and nothing matched a loss pattern.`
                        : result.level.label === 'CRITICAL' || result.level.label === 'HIGH RISK'
                            ? 'Some of this needs looking at today.'
                            : 'Report ready below.',
            });
        } catch (e: any) {
            console.error('Forensic scan failed', e);
            toast({
                variant: 'destructive',
                title: 'Scan failed',
                description: e?.message || 'The scan could not be completed.',
            });
        } finally {
            setIsScanning(false);
        }
    };

    /** Evidence links point at logs that may sit outside the 50 rows on screen. */
    const openLogById = React.useCallback((logId: string) => {
        const found =
            (scanLogsRef.current ?? []).find(l => l.id === logId) ??
            auditLogs.find(l => l.id === logId);
        if (found) setSelectedLog(found);
        else toast({ title: 'Log entry not loaded', description: 'Use Load More Events to reach it.' });
    }, [auditLogs, toast]);

    // An empty log list only means "still loading" while we are online and can
    // still fetch. Offline it is the final answer - either the cache is empty or
    // this business has no logs - so spinning forever hides the empty state.
    const isLoading = isPosLoading || (auditLogs.length === 0 && isOnline);

    return (
        <>
            <div ref={reportRef} className="scroll-mt-4">
                {report && (
                    <div className="mb-6">
                        <ForensicReportView
                            report={report}
                            onOpenLog={openLogById}
                            onDismiss={() => setReport(null)}
                        />
                    </div>
                )}
            </div>
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-2xl font-bold"><History className="text-primary" /> Audit Log</CardTitle>
                                <CardDescription>A chronological log of important events that have occurred in your business.</CardDescription>
                            </div>
                            <div className="sm:text-right">
                                <Button onClick={handleScan} disabled={isScanning} className="w-full sm:w-auto shadow-sm">
                                    {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
                                    {isScanning ? 'Scanning…' : report ? 'Re-run forensic scan' : 'Run forensic scan'}
                                </Button>
                                <p className="mt-1.5 hidden text-[11px] text-muted-foreground sm:block">
                                    {DETECTOR_COUNT} loss-prevention checks across sales, stock and staff
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <History className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search by user, email, or entity..." 
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {['all', 'sale', 'product', 'customer', 'user'].map(filter => (
                                    <Button 
                                        key={filter}
                                        variant={actionFilter === filter ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setActionFilter(filter)}
                                        className="capitalize rounded-full h-8 px-4"
                                    >
                                        {filter}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead className="text-right">Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <AuditLogRowSkeleton />
                                    <AuditLogRowSkeleton />
                                    <AuditLogRowSkeleton />
                                    <AuditLogRowSkeleton />
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>User</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Details</TableHead>
                                            <TableHead className="text-right">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLogs.length > 0 ? (
                                            filteredLogs.map(log => {
                                                const actionStr = log.action || '';
                                                const entityType = actionStr.split('.')[0] || '';
                                                const Icon = actionIcons[entityType] || History;
                                                return (
                                                    <TableRow key={log.id} onClick={() => setSelectedLog(log)} className="cursor-pointer hover:bg-muted/30">
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Avatar className="h-8 w-8 hidden sm:flex border">
                                                                    <AvatarFallback>{(log.userName || 'U').charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <div className="font-medium text-sm">{log.userName || 'Unknown User'}</div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[10px] text-muted-foreground">{log.userEmail}</span>
                                                                        {log.userRole && (
                                                                            <>
                                                                                <span className="text-[10px] text-muted-foreground/30">•</span>
                                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-primary/70">{log.userRole.replace('_', ' ')}</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className="capitalize whitespace-nowrap text-[10px] py-0 h-5 font-bold">
                                                                <Icon className="mr-1 h-2.5 w-2.5" />
                                                                {actionStr ? actionStr.replace('.', ' ') : 'Event'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="text-sm font-medium truncate max-w-[150px] sm:max-w-xs">{log.details?.entityName || log.entityType || 'N/A'}</div>
                                                            <div className="text-[10px] text-muted-foreground truncate max-w-[150px] sm:max-w-xs" title={log.entityId}>
                                                                {log.entityId}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-muted-foreground text-xs whitespace-nowrap">
                                                            {log.createdAt ? formatDistanceToNow(safeToDate(log.createdAt), { addSuffix: true }) : ''}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                                    No logs found matching your filters.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            
                            {hasMore && !searchTerm && actionFilter === 'all' && (
                                <div className="flex justify-center pt-4">
                                    <Button 
                                        variant="outline" 
                                        onClick={handleLoadMore} 
                                        disabled={isFetchingMore}
                                        className="w-full max-w-xs"
                                    >
                                        {isFetchingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Load More Events"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
            {typeof window !== 'undefined' && !!selectedLog && createPortal(
                <div 
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] transition-opacity animate-in fade-in-0" 
                    onClick={() => setSelectedLog(null)} 
                />,
                document.body
            )}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)} modal={false}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Log Event Details</DialogTitle>
                        <DialogDescription>
                            A detailed view of the recorded action.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="text-sm space-y-4">
                            <div className="space-y-1">
                                <p className="text-muted-foreground">User</p>
                                <p className="font-medium">{selectedLog.userName} ({selectedLog.userEmail})</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Action</p>
                                <p className="font-medium capitalize">{(selectedLog.action || '').replace('.', ' ')}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Date</p>
                                <p className="font-medium">{selectedLog.createdAt ? format(safeToDate(selectedLog.createdAt), 'PPP p') : 'N/A'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Target</p>
                                <p className="font-medium">{selectedLog.details?.entityName || selectedLog.entityType || 'N/A'}</p>
                                <p className="text-muted-foreground text-xs font-mono">{selectedLog.entityId}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Details</p>
                                <pre className="p-3 bg-muted rounded-md text-xs whitespace-pre-wrap font-mono">
                                    {JSON.stringify(selectedLog.details || {}, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <UpgradeModal open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen} />
        </>
    );
}

export default function AuditLogPage() {
    const { business } = usePOS();

    return (
        <div className="space-y-6">
            <PageTitle title="Audit Log" subtitle="Track important actions taken in your business." />
            <FeatureGate
                requiredPlan="business"
                currentPlan={business?.plan}
                hasLifetimeAccess={business?.accessLevel === 'lifetime'}
                featureName="Audit Log"
                featureDescription="Keep a detailed, secure record of all critical system events to enhance security and accountability."
                icon={ShieldCheck}
                featurePoints={[
                    { title: "Activity Tracking", description: "Monitor all user actions and system events seamlessly." },
                    { title: "Threat Detection", description: "Identify suspicious patterns like unauthorized access or unusual deletions." },
                    { title: "Enhanced Accountability", description: "Maintain a verifiable history of operations for compliance." }
                ]}
            >
                <AuditLogPageContent />
            </FeatureGate>
        </div>
    );
}
