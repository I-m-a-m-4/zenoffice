'use client';

/**
 * Lazy data sections for the per-user detail page.
 *
 * Every section takes an `active` flag and fetches only once it becomes true, so
 * opening a user costs two document reads and each tab adds its own queries only
 * if you actually look at it.
 *
 * READ THIS BEFORE CHANGING A QUERY. Several of these deliberately query on a
 * *different* axis than the one they filter on, because the composite index does
 * not exist (see firestore.indexes.json):
 *
 *   - `receipts` indexes all begin with `businessId`; there is none on
 *     `createdBy`. Querying `where('createdBy','==',uid)+orderBy('createdAt')`
 *     throws `failed-precondition` at call time.
 *   - `auditLogs` has only a single-field `createdAt` override, no `userId`
 *     composite.
 *   - `purchases`, `checkout_attempts`, `error_logs`, `ai_*`, `faq_search_logs`
 *     have no composites at all. Single-field equality is auto-indexed, so
 *     `where('userId','==',uid)` works — but adding an `orderBy` on any other
 *     field throws. They are sorted in memory instead.
 *   - `supportThreads` DOES have `userId + lastMessageAt`, so that one query is
 *     ordered server-side.
 *
 * Where a query is windowed by `limit()`, the UI says so. A truncated total that
 * reads as a complete one is worse than no total.
 */

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    collection,
    getDocs,
    limit as fsLimit,
    orderBy,
    query,
    where,
    type Query,
} from 'firebase/firestore';
import { format } from 'date-fns';
import {
    AlertTriangle,
    Bot,
    Bug,
    CreditCard,
    Loader,
    MessageSquare,
    Smartphone,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore } from '@/firebase';
import { withFirestoreRetry } from '@/firebase/retry';
import { toNgn } from '@/lib/platform-revenue';
import type { BusinessInstance, Receipt, UserProfile } from '@/types';
import { toDate } from './user-primitives';

/** How far back each windowed query looks. Surfaced in the UI, not hidden. */
export const SALES_WINDOW = 500;
export const AUDIT_WINDOW = 300;

type Row = Record<string, any> & { id: string };

/**
 * Run a query the first time `active` flips true, and not again.
 *
 * `resetKey` is the user id: these sections stay mounted when the page switches
 * to a different user, so without it the "already ran" latch would keep showing
 * the previous user's data.
 *
 * `makeQuery` is deliberately excluded from the dependency list — it is a new
 * closure on every render, and depending on it would re-fire the read each time,
 * which is exactly the cost this page exists to avoid. `ready` carries the one
 * thing that genuinely changes underneath it (Firestore finishing init), so a
 * section activated before Firestore is available still fires once it is.
 */
function useLazyQuery(
    active: boolean,
    ready: boolean,
    resetKey: string,
    makeQuery: () => Query | null,
    label: string,
): { rows: Row[]; isLoading: boolean; error: string | null; ran: boolean } {
    const [rows, setRows] = useState<Row[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ranFor = useRef<string | null>(null);

    useEffect(() => {
        if (!active || !ready) return;
        if (ranFor.current === resetKey) return;

        const q = makeQuery();
        if (!q) return;

        let cancelled = false;
        ranFor.current = resetKey;
        setRows([]);
        setIsLoading(true);
        setError(null);

        (async () => {
            try {
                const snap = await withFirestoreRetry(() => getDocs(q), { label });
                if (cancelled) return;
                setRows(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            } catch (err: any) {
                if (cancelled) return;
                console.error(`Failed to load ${label}`, err);
                // failed-precondition means a missing composite index — surface it
                // plainly rather than as an empty section that looks like no data.
                setError(
                    err?.code === 'failed-precondition'
                        ? `${label}: this query needs a Firestore index that does not exist.`
                        : err?.message || `Could not load ${label}.`,
                );
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, ready, resetKey, label]);

    return { rows, isLoading, error, ran: ranFor.current === resetKey };
}

const SectionState = ({
    isLoading, error, empty, emptyText,
}: { isLoading: boolean; error: string | null; empty: boolean; emptyText: string }) => {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                <Loader className="h-4 w-4 animate-spin" /> Loading…
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> {error}
            </div>
        );
    }
    if (empty) {
        return <div className="py-10 text-center text-sm text-muted-foreground">{emptyText}</div>;
    }
    return null;
};

const Stat = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
    <Card className="p-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold leading-none">{value}</p>
        {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </Card>
);

const money = (n: number, currency = 'NGN') =>
    `${currency === 'USD' ? '$' : '₦'}${Math.round(n).toLocaleString()}`;

/* ────────────────────────────── Sales ────────────────────────────── */

export function SalesSection({
    user, business, active,
}: { user: UserProfile; business: BusinessInstance | null; active: boolean }) {
    const firestore = useFirestore();
    const bid = user.businessId;

    const { rows, isLoading, error } = useLazyQuery(
        active,
        !!firestore && !!bid,
        user.id,
        () => (firestore && bid
            ? query(
                collection(firestore, 'receipts'),
                where('businessId', '==', bid),
                orderBy('createdAt', 'desc'),
                fsLimit(SALES_WINDOW),
            )
            : null),
        'sales',
    );

    const currency = (business as any)?.settings?.currency || 'NGN';

    // Filtered in memory: there is no `createdBy` index, so the query above can
    // only be scoped by business.
    const mine = useMemo(
        () => (rows as Receipt[]).filter(r => (r as any).createdBy === user.id),
        [rows, user.id],
    );

    const totals = useMemo(() => {
        const gross = mine.reduce((s, r) => s + (r.total || 0), 0);
        const items = mine.reduce(
            (s, r) => s + (r.items || []).reduce((n: number, i: any) => n + (i.quantity || 0), 0),
            0,
        );
        return {
            count: mine.length,
            gross,
            items,
            avg: mine.length ? gross / mine.length : 0,
            offline: mine.filter(r => (r as any).isOffline).length,
            scanned: mine.filter(r => (r as any).wasScanned).length,
        };
    }, [mine]);

    if (!bid) {
        return <div className="py-10 text-center text-sm text-muted-foreground">This user has no business, so no sales can be attributed.</div>;
    }

    // `SectionState` returns null when there is nothing to say, but the element
    // wrapping it is always truthy — so branch on the conditions themselves.
    const settled = !isLoading && !error && mine.length > 0;

    return (
        <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
                Scanned from this business's most recent <strong>{SALES_WINDOW.toLocaleString()}</strong> sales
                {rows.length ? ` (${rows.length.toLocaleString()} found)` : ''} and matched on
                <code className="mx-1 rounded bg-muted px-1 py-0.5">createdBy</code>.
                Older sales, and sales recorded before that field existed, are not counted here.
            </p>

            {!isLoading && !error && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Stat label="Sales rung up" value={totals.count.toLocaleString()} />
                    <Stat label="Value" value={money(totals.gross, currency)} />
                    <Stat label="Avg sale" value={money(totals.avg, currency)} />
                    <Stat label="Items sold" value={totals.items.toLocaleString()} />
                </div>
            )}

            <SectionState
                isLoading={isLoading}
                error={error}
                empty={!mine.length}
                emptyText="No sales attributed to this user in the window above."
            />

            {settled && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Recent sales</CardTitle>
                        <CardDescription className="text-xs">
                            {totals.offline} offline · {totals.scanned} used a scanner
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[420px] overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background">
                                    <TableRow>
                                        <TableHead className="text-xs">Receipt</TableHead>
                                        <TableHead className="text-xs">When</TableHead>
                                        <TableHead className="text-xs">Method</TableHead>
                                        <TableHead className="text-right text-xs">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mine.slice(0, 100).map(r => {
                                        const when = toDate(r.createdAt);
                                        return (
                                            <TableRow key={r.id}>
                                                <TableCell className="font-mono text-xs">
                                                    {r.receiptNumber || r.id.slice(0, 8)}
                                                    {(r as any).isOffline && (
                                                        <Badge variant="outline" className="ml-1.5 text-[9px]">offline</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-xs">
                                                    {when ? format(when, 'PPp') : '—'}
                                                </TableCell>
                                                <TableCell className="text-xs">{r.paymentMethod || '—'}</TableCell>
                                                <TableCell className="text-right text-xs font-semibold tabular-nums">
                                                    {money(r.total || 0, currency)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/* ────────────────────────────── Audit ────────────────────────────── */

export function AuditSection({ user, active }: { user: UserProfile; active: boolean }) {
    const firestore = useFirestore();
    const bid = user.businessId;

    const { rows, isLoading, error } = useLazyQuery(
        active,
        !!firestore && !!bid,
        user.id,
        () => (firestore && bid
            ? query(
                collection(firestore, 'businessInstances', bid, 'auditLogs'),
                orderBy('createdAt', 'desc'),
                fsLimit(AUDIT_WINDOW),
            )
            : null),
        'audit log',
    );

    // No `userId` composite on auditLogs, so scope by business and match here.
    const mine = useMemo(() => rows.filter(r => r.userId === user.id), [rows, user.id]);

    if (!bid) {
        return <div className="py-10 text-center text-sm text-muted-foreground">This user has no business, so there is no audit trail to read.</div>;
    }

    return (
        <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
                This user's entries from their business's most recent{' '}
                <strong>{AUDIT_WINDOW.toLocaleString()}</strong> audit events
                {rows.length ? ` (${rows.length.toLocaleString()} scanned)` : ''}.
            </p>

            <SectionState isLoading={isLoading} error={error} empty={!mine.length} emptyText="No audit entries for this user in the window above." />

            {!isLoading && !error && mine.length > 0 && (
                <Card>
                    <CardContent className="p-0">
                        <div className="max-h-[460px] overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background">
                                    <TableRow>
                                        <TableHead className="text-xs">Action</TableHead>
                                        <TableHead className="text-xs">Entity</TableHead>
                                        <TableHead className="text-xs">When</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mine.map(r => {
                                        const when = toDate(r.createdAt);
                                        return (
                                            <TableRow key={r.id}>
                                                <TableCell>
                                                    <Badge variant="secondary" className="font-mono text-[10px]">{r.action}</Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {r.entityType}
                                                    {r.entityId && (
                                                        <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                                            {String(r.entityId).slice(0, 10)}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-xs">
                                                    {when ? format(when, 'PPp') : '—'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/* ───────────────────────────── Support ───────────────────────────── */

export function SupportSection({ user, active }: { user: UserProfile; active: boolean }) {
    const firestore = useFirestore();
    const router = useRouter();

    // The one query here with a real composite index behind it.
    const threads = useLazyQuery(
        active,
        !!firestore,
        user.id,
        () => (firestore
            ? query(
                collection(firestore, 'supportThreads'),
                where('userId', '==', user.id),
                orderBy('lastMessageAt', 'desc'),
            )
            : null),
        'support threads',
    );

    // Equality only — no composite index, so no orderBy. Sorted below.
    const aiLogs = useLazyQuery(
        active,
        !!firestore,
        user.id,
        () => (firestore ? query(collection(firestore, 'ai_support_logs'), where('userId', '==', user.id), fsLimit(100)) : null),
        'AI support history',
    );
    const faqLogs = useLazyQuery(
        active,
        !!firestore,
        user.id,
        () => (firestore ? query(collection(firestore, 'faq_search_logs'), where('userId', '==', user.id), fsLimit(100)) : null),
        'help searches',
    );

    const sortedAi = useMemo(
        () => [...aiLogs.rows].sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0)),
        [aiLogs.rows],
    );
    const sortedFaq = useMemo(
        () => [...faqLogs.rows].sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0)),
        [faqLogs.rows],
    );

    const busy = threads.isLoading || aiLogs.isLoading || faqLogs.isLoading;
    const err = threads.error || aiLogs.error || faqLogs.error;
    const nothing = !threads.rows.length && !sortedAi.length && !sortedFaq.length;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => router.push(`/admin-imamshaffy/support?userId=${user.id}`)}>
                    <MessageSquare className="h-4 w-4 mr-2" /> Message User
                </Button>
            </div>
            
            <SectionState isLoading={busy} error={err} empty={nothing} emptyText="This user has never contacted support or searched help." />

            {!busy && !nothing && (
                <>
                    {threads.rows.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <MessageSquare className="h-4 w-4 text-primary" /> Support threads
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {threads.rows.map(t => {
                                    const when = toDate(t.lastMessageAt);
                                    return (
                                        <div key={t.id} className="rounded-md border p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-sm font-medium">{t.subject || 'Support thread'}</span>
                                                <Badge variant={t.status === 'open' ? 'default' : 'secondary'} className="text-[10px] capitalize">
                                                    {t.status || 'open'}
                                                </Badge>
                                            </div>
                                            {t.lastMessageSnippet && (
                                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.lastMessageSnippet}</p>
                                            )}
                                            <p className="mt-1 text-[10px] text-muted-foreground">
                                                {when ? format(when, 'PPp') : '—'}
                                                {t.isReadByAdmin === false && ' · unread by admin'}
                                            </p>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {sortedAi.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Bot className="h-4 w-4 text-primary" /> AI support questions
                                </CardTitle>
                                <CardDescription className="text-xs">{sortedAi.length} recorded</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {sortedAi.slice(0, 25).map(l => {
                                    const when = toDate(l.createdAt);
                                    return (
                                        <div key={l.id} className="border-l-2 border-muted pl-3">
                                            <p className="text-xs font-medium">{l.query}</p>
                                            <p className="text-[10px] text-muted-foreground">{when ? format(when, 'PPp') : '—'}</p>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {sortedFaq.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Help searches</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-1.5">
                                {sortedFaq.slice(0, 40).map(l => (
                                    <Badge key={l.id} variant="outline" className="text-[10px]">{l.query}</Badge>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}

/* ───────────────────────────── Billing ───────────────────────────── */

export function BillingSection({
    user, business, active,
}: { user: UserProfile; business: BusinessInstance | null; active: boolean }) {
    const firestore = useFirestore();

    const purchases = useLazyQuery(
        active,
        !!firestore,
        user.id,
        () => (firestore ? query(collection(firestore, 'purchases'), where('userId', '==', user.id)) : null),
        'payments',
    );
    const attempts = useLazyQuery(
        active,
        !!firestore,
        user.id,
        () => (firestore ? query(collection(firestore, 'checkout_attempts'), where('userId', '==', user.id)) : null),
        'checkout attempts',
    );

    const byTime = (rows: Row[], field: string) =>
        [...rows].sort((a, b) => (toDate(b[field])?.getTime() ?? 0) - (toDate(a[field])?.getTime() ?? 0));

    const paid = useMemo(() => byTime(purchases.rows, 'timestamp'), [purchases.rows]);
    const tried = useMemo(() => byTime(attempts.rows, 'timestamp'), [attempts.rows]);
    // Normalised to NGN before summing. The rows below each render in the
    // currency they were paid in, but a total cannot: adding a $30 payment to a
    // ₦30,000 one and stamping ₦ on the result reports ₦30,030.
    const lifetimeValue = useMemo(
        () => paid.reduce((s, p) => s + toNgn(p.amount, p.currency), 0),
        [paid],
    );
    const anyUsd = useMemo(
        () => paid.some((p) => (p.currency || 'NGN').toUpperCase() === 'USD'),
        [paid],
    );

    const busy = purchases.isLoading || attempts.isLoading;
    const err = purchases.error || attempts.error;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Payments" value={busy ? '—' : paid.length} />
                <Stat
                    label="Lifetime value"
                    value={busy ? '—' : money(lifetimeValue)}
                    hint={anyUsd ? 'Dollar payments converted at ₦1,500/$1' : undefined}
                />
                <Stat label="Checkout attempts" value={busy ? '—' : tried.length} hint="Started, not necessarily paid" />
                <Stat
                    label="Current plan"
                    value={(business as any)?.accessLevel === 'lifetime' ? 'Lifetime' : ((business as any)?.plan || 'Starter')}
                    hint="From the business, not the user"
                />
            </div>

            <SectionState isLoading={busy} error={err} empty={!paid.length && !tried.length} emptyText="No payments or checkout attempts for this user." />

            {!busy && !err && paid.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CreditCard className="h-4 w-4 text-primary" /> Payments
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Plan</TableHead>
                                    <TableHead className="text-xs">Amount</TableHead>
                                    <TableHead className="text-xs">When</TableHead>
                                    <TableHead className="text-xs">Reference</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paid.map(p => {
                                    const when = toDate(p.timestamp);
                                    return (
                                        <TableRow key={p.id}>
                                            <TableCell className="text-xs capitalize">{p.plan}</TableCell>
                                            <TableCell className="text-xs font-semibold tabular-nums">
                                                {money(p.amount || 0, p.currency)}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-xs">{when ? format(when, 'PP') : '—'}</TableCell>
                                            <TableCell className="font-mono text-[10px] text-muted-foreground">
                                                {p.reference ? String(p.reference).slice(0, 18) : '—'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {!busy && !err && tried.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Checkout attempts</CardTitle>
                        <CardDescription className="text-xs">
                            Logged when checkout starts. An attempt with no matching payment above is an abandoned upgrade.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Plan</TableHead>
                                    <TableHead className="text-xs">Gateway</TableHead>
                                    <TableHead className="text-xs">Amount</TableHead>
                                    <TableHead className="text-xs">When</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tried.slice(0, 30).map(a => {
                                    const when = toDate(a.timestamp);
                                    return (
                                        <TableRow key={a.id}>
                                            <TableCell className="text-xs capitalize">{a.plan}</TableCell>
                                            <TableCell className="text-xs">{a.gateway || '—'}</TableCell>
                                            <TableCell className="text-xs tabular-nums">{money(a.amount || 0, a.currency)}</TableCell>
                                            <TableCell className="whitespace-nowrap text-xs">{when ? format(when, 'PP') : '—'}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/* ───────────────────────── Devices & errors ──────────────────────── */

export function DevicesSection({ user, active }: { user: UserProfile; active: boolean }) {
    const firestore = useFirestore();

    const tokens = useLazyQuery(
        active,
        !!firestore,
        user.id,
        () => (firestore ? query(collection(firestore, 'users', user.id, 'fcmTokens')) : null),
        'push devices',
    );
    const errors = useLazyQuery(
        active,
        !!firestore,
        user.id,
        () => (firestore ? query(collection(firestore, 'error_logs'), where('userId', '==', user.id), fsLimit(100)) : null),
        'error log',
    );

    const sortedErrors = useMemo(
        () => [...errors.rows].sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0)),
        [errors.rows],
    );

    const busy = tokens.isLoading || errors.isLoading;
    const err = tokens.error || errors.error;

    return (
        <div className="space-y-4">
            <SectionState
                isLoading={busy}
                error={err}
                empty={!tokens.rows.length && !sortedErrors.length}
                emptyText="No registered push devices and no recorded errors for this user."
            />

            {!busy && !err && tokens.rows.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Smartphone className="h-4 w-4 text-primary" /> Push devices
                        </CardTitle>
                        <CardDescription className="text-xs">
                            An <strong>uninstalled</strong> device is how the platform detects an app removal.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {tokens.rows.map(t => {
                            const used = toDate(t.lastUsed);
                            const gone = toDate(t.uninstalledAt);
                            return (
                                <div key={t.id} className="rounded-md border p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={t.status === 'uninstalled' ? 'destructive' : 'default'} className="text-[10px] capitalize">
                                            {t.status || 'active'}
                                        </Badge>
                                        {t.channel && <Badge variant="outline" className="text-[10px]">{t.channel}</Badge>}
                                        {t.isNative && <Badge variant="secondary" className="text-[10px]">native</Badge>}
                                    </div>
                                    <p className="mt-1.5 break-all text-[10px] text-muted-foreground">{t.device || '—'}</p>
                                    <p className="mt-1 text-[10px] text-muted-foreground">
                                        {used ? `Last used ${format(used, 'PPp')}` : 'Never used'}
                                        {gone ? ` · uninstalled ${format(gone, 'PP')}` : ''}
                                    </p>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {!busy && !err && sortedErrors.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Bug className="h-4 w-4 text-destructive" /> Errors this user hit
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Most recent {Math.min(sortedErrors.length, 25)} of {sortedErrors.length}. Client-side only.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {sortedErrors.slice(0, 25).map(e => {
                            const when = toDate(e.createdAt);
                            return (
                                <div key={e.id} className="rounded-md border border-destructive/20 p-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs font-medium">{e.message}</p>
                                        <Badge variant="outline" className="shrink-0 text-[9px]">{e.type}</Badge>
                                    </div>
                                    <p className="mt-1 truncate text-[10px] text-muted-foreground">{e.url}</p>
                                    <p className="text-[10px] text-muted-foreground">{when ? format(when, 'PPp') : '—'}</p>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/* ───────────────────────────── Journey ───────────────────────────── */

export function JourneySection({ user, active }: { user: UserProfile; active: boolean }) {
    const firestore = useFirestore();

    const journeys = useLazyQuery(
        active,
        !!firestore,
        user.id,
        () => (firestore ? query(collection(firestore, 'users', user.id, 'journey'), fsLimit(50)) : null),
        'page journeys',
    );

    const sorted = useMemo(
        () => [...journeys.rows].sort((a, b) => (toDate(b.startedAt)?.getTime() ?? 0) - (toDate(a.startedAt)?.getTime() ?? 0)),
        [journeys.rows],
    );

    return (
        <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
                The exact order of screens this user opened, per session. Each session records up to 400 steps.
            </p>

            <SectionState
                isLoading={journeys.isLoading}
                error={journeys.error}
                empty={!sorted.length}
                emptyText="No recorded journeys. These start once the user opens the app on a build that tracks them."
            />

            {!journeys.isLoading && sorted.length > 0 && (
                <div className="space-y-3">
                    {sorted.slice(0, 12).map(j => {
                        const started = toDate(j.startedAt);
                        const routes: { path: string; at: number }[] = j.routes || [];
                        return (
                            <Card key={j.id} className="p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-medium">
                                        {started ? format(started, 'PPp') : 'Unknown time'}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        {j.isFirstSession && <Badge className="text-[9px]">first session</Badge>}
                                        {j.deviceType && <Badge variant="outline" className="text-[9px]">{j.deviceType}</Badge>}
                                        <span className="text-[10px] text-muted-foreground">{routes.length} steps</span>
                                    </div>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-1">
                                    {routes.slice(0, 40).map((r, i) => (
                                        <React.Fragment key={i}>
                                            {i > 0 && <span className="text-[10px] text-muted-foreground">→</span>}
                                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{r.path}</span>
                                        </React.Fragment>
                                    ))}
                                    {routes.length > 40 && (
                                        <span className="text-[10px] text-muted-foreground">+{routes.length - 40} more</span>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
