'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { AuditLog } from '@/types';
import PageTitle from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, User, FileText, Settings, CreditCard, ShieldCheck } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { safeToDate } from '@/lib/utils';
import { createPortal } from 'react-dom';

const actionIcons: { [key: string]: React.ElementType } = {
    'user': User,
    'settings': Settings,
    'billing': CreditCard,
    'document': FileText,
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
    );
}

function AuditLogPageContent() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [selectedLog, setSelectedLog] = React.useState<AuditLog | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [actionFilter, setActionFilter] = React.useState('all');
    const [isLoading, setIsLoading] = React.useState(true);
    const [isFetchingMore, setIsFetchingMore] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(false);
    const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([]);

    React.useEffect(() => {
        let isMounted = true;
        async function fetchLogs() {
            if (!firestore || !user?.uid) {
                setIsLoading(false);
                return;
            }
            try {
                const logsRef = collection(firestore, 'audit_logs');
                const q = query(logsRef, orderBy('createdAt', 'desc'), limit(50));
                const snap = await getDocs(q);
                if (isMounted) {
                    const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
                    setAuditLogs(loaded);
                    setHasMore(snap.docs.length >= 50);
                    setIsLoading(false);
                }
            } catch {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        fetchLogs();
        return () => { isMounted = false; };
    }, [firestore, user?.uid]);

    const filteredLogs = React.useMemo(() => {
        return auditLogs.filter(log => {
            const matchesFilter = actionFilter === 'all' || (log.action && log.action.startsWith(actionFilter));
            if (!matchesFilter) return false;
            if (!searchTerm.trim()) return true;
            const lower = searchTerm.toLowerCase();
            return (
                log.userName?.toLowerCase().includes(lower) ||
                log.userEmail?.toLowerCase().includes(lower) ||
                log.details?.entityName?.toLowerCase().includes(lower) ||
                log.id.toLowerCase().includes(lower)
            );
        });
    }, [auditLogs, actionFilter, searchTerm]);

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-6">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                                <History className="text-primary" /> Audit Log
                            </CardTitle>
                            <CardDescription>A chronological log of important security and administrative events.</CardDescription>
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
                                {['all', 'user', 'settings', 'billing', 'document'].map(filter => (
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
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Details</TableHead>
                                            <TableHead className="text-right">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLogs.length > 0 ? (
                                            filteredLogs.map((log) => {
                                                const actionPrefix = (log.action || '').split('.')[0];
                                                const Icon = actionIcons[actionPrefix] || History;
                                                const actionStr = log.action || '';
                                                return (
                                                    <TableRow 
                                                        key={log.id}
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => setSelectedLog(log)}
                                                    >
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
                                                );
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
        </>
    );
}

export default function AuditLogPage() {
    return (
        <div className="space-y-6">
            <PageTitle title="Audit Log" subtitle="Track administrative and security events in your workspace." />
            <AuditLogPageContent />
        </div>
    );
}
