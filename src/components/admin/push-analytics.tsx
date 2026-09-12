'use client';

import * as React from 'react';
import {
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { format } from 'date-fns';
import {
    BellRing,
    ChevronDown,
    Loader2,
    MousePointerClick,
    Send,
    Smartphone,
    TriangleAlert,
    Users,
} from 'lucide-react';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PushCampaign, PushRecipient } from '@/types';

/** Newest campaigns shown. Lifetime totals come from the rollup doc instead, so
 *  this cap trims the list without understating the headline numbers. */
const CAMPAIGN_LIMIT = 50;
/** Rows fetched when expanding a campaign. Stated in the UI when it bites. */
const RECIPIENT_LIMIT = 200;

/** Firestore timestamps, ISO strings and Dates all arrive through here. */
function toDate(value: any): Date | null {
    if (!value) return null;
    try {
        const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    } catch {
        return null;
    }
}

function whenLabel(value: any): string {
    const date = toDate(value);
    return date ? format(date, 'd MMM yyyy, h:mm a') : '—';
}

function initialsOf(name?: string | null, email?: string | null): string {
    const source = (name || email || '').trim();
    if (!source) return '?';
    const parts = source.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function percent(numerator: number, denominator: number): string {
    if (!denominator) return '0%';
    return `${Math.round((numerator / denominator) * 100)}%`;
}

const SOURCE_LABELS: Record<string, string> = {
    broadcast: 'Broadcast',
    alert: 'Alert',
    test: 'Test',
    system: 'Automated',
};

/**
 * One headline number. Deliberately a plain div rather than a `Card` — six nested
 * cards on a phone spend most of their width on borders and padding.
 */
function Stat({
    icon: Icon,
    label,
    value,
    hint,
    tone,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    hint?: string;
    tone?: 'default' | 'good' | 'bad';
}) {
    return (
        <div className="min-w-0 rounded-xl border bg-card p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon
                    className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        tone === 'good' && 'text-emerald-600',
                        tone === 'bad' && 'text-rose-600',
                    )}
                />
                <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wide">{label}</span>
            </div>
            <p className="mt-1 truncate text-xl font-bold tabular-nums md:text-2xl">{value}</p>
            {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    );
}

/**
 * The recipient list for one campaign, fetched on demand.
 *
 * Two modes, because the cheap question and the complete question have different
 * costs. "Who opened it" is a filtered query that reads only the openers — usually
 * a handful. "Everyone it went to" reads a row per person, which on a
 * platform-wide broadcast is a row per user, so it stays behind a button.
 */
function RecipientList({ campaign }: { campaign: PushCampaign }) {
    const firestore = useFirestore();
    const [rows, setRows] = React.useState<PushRecipient[] | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [showAll, setShowAll] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!firestore) return;
        let cancelled = false;

        (async () => {
            setIsLoading(true);
            setError(null);
            try {
                const base = collection(firestore, 'push_campaigns', campaign.id, 'recipients');
                const q = showAll
                    ? query(base, limit(RECIPIENT_LIMIT))
                    : query(base, where('clickCount', '>', 0), orderBy('clickCount', 'desc'), limit(RECIPIENT_LIMIT));
                const snap = await getDocs(q);
                if (cancelled) return;
                const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PushRecipient[];
                // Openers first, then most recent — the list is short enough that
                // sorting here beats a composite index for a rarely-opened panel.
                list.sort((a, b) => {
                    const aClicked = toDate(a.clickedAt)?.getTime() || 0;
                    const bClicked = toDate(b.clickedAt)?.getTime() || 0;
                    if (aClicked !== bClicked) return bClicked - aClicked;
                    return (a.userName || a.userEmail || '').localeCompare(b.userName || b.userEmail || '');
                });
                setRows(list);
            } catch (err: any) {
                if (!cancelled) setError(err?.message || 'Could not load recipients.');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [firestore, campaign.id, showAll]);

    return (
        <div className="border-t bg-muted/30 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {showAll ? 'Everyone it reached' : 'Opened by'}
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-[11px]"
                    onClick={() => setShowAll((prev) => !prev)}
                >
                    {showAll ? 'Openers only' : 'Show everyone'}
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading recipients…
                </div>
            ) : error ? (
                <p className="py-2 text-xs text-destructive">{error}</p>
            ) : !rows || rows.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">
                    {showAll
                        ? 'No recipient rows were recorded for this send.'
                        : 'Nobody has opened this notification yet.'}
                </p>
            ) : (
                <>
                    <ul className="space-y-1.5">
                        {rows.map((row) => {
                            const opened = toDate(row.clickedAt);
                            return (
                                <li
                                    key={row.id}
                                    className="flex items-start gap-2.5 rounded-lg border bg-card px-2.5 py-2"
                                >
                                    <span
                                        className={cn(
                                            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase',
                                            opened ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
                                        )}
                                    >
                                        {initialsOf(row.userName, row.userEmail)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold">
                                            {row.userName || row.userEmail || row.userId}
                                        </p>
                                        {row.userEmail && row.userName && (
                                            <p className="truncate text-[11px] text-muted-foreground">{row.userEmail}</p>
                                        )}
                                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                            {row.successCount ?? 0}/{row.deviceCount ?? 0} device
                                            {(row.deviceCount ?? 0) === 1 ? '' : 's'} delivered
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        {opened ? (
                                            <>
                                                <Badge className="h-5 border-0 bg-emerald-600 px-1.5 text-[9px] uppercase text-white shadow-none">
                                                    Opened
                                                </Badge>
                                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                                    {format(opened, 'd MMM, h:mm a')}
                                                </p>
                                                {(row.clickCount ?? 0) > 1 && (
                                                    <p className="text-[10px] text-muted-foreground">×{row.clickCount}</p>
                                                )}
                                            </>
                                        ) : (
                                            <Badge variant="secondary" className="h-5 px-1.5 text-[9px] uppercase shadow-none">
                                                Not opened
                                            </Badge>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {rows.length >= RECIPIENT_LIMIT && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                            Showing the first {RECIPIENT_LIMIT} of {campaign.recipientCount?.toLocaleString() || '?'} recipients.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

/**
 * Delivery and open reporting for every phone push the platform has sent.
 *
 * Sends were fire-and-forget before this: the success count went into a toast and
 * nowhere else. Now each one writes a `push_campaigns` doc plus a row per person,
 * and a tapped notification marks its own row through the service worker — see
 * `push-click-tracker.tsx` for why attribution happens in the page rather than in
 * the worker.
 *
 * Cards rather than a table on purpose. This page's history table already had to
 * hide a column and restate it inside another cell to survive a phone; a six-column
 * analytics table would lose that fight outright.
 */
export function PushAnalytics() {
    const firestore = useFirestore();
    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    const rollupRef = useMemoFirebase(
        () => (firestore ? doc(firestore, 'admin_analytics', 'push_usage_global') : null),
        [firestore],
    );
    const { data: rollup } = useDoc<any>(rollupRef);

    const campaignsQuery = useMemoFirebase(
        () =>
            firestore
                ? query(collection(firestore, 'push_campaigns'), orderBy('sentAt', 'desc'), limit(CAMPAIGN_LIMIT))
                : null,
        [firestore],
    );
    const { data: campaigns, isLoading } = useCollection<PushCampaign>(campaignsQuery);

    /**
     * Lifetime figures come from the rollup doc when it exists, so they survive
     * past the {CAMPAIGN_LIMIT} newest sends. Opens are summed from the listed
     * campaigns because the rollup is written at send time, before anyone has had
     * the chance to open anything.
     */
    const totals = React.useMemo(() => {
        const listed = campaigns || [];
        const sum = (pick: (c: PushCampaign) => number) => listed.reduce((acc, c) => acc + (pick(c) || 0), 0);

        const listedDevices = sum((c) => c.deviceCount);
        const listedDelivered = sum((c) => c.successCount);
        const listedFailed = sum((c) => c.failureCount);

        return {
            campaigns: rollup?.totalCampaigns ?? listed.length,
            devices: rollup?.totalDevices ?? listedDevices,
            delivered: rollup?.totalDelivered ?? listedDelivered,
            failed: rollup?.totalFailed ?? listedFailed,
            opens: sum((c) => c.clickCount || 0),
            // Denominator for the open rate: what was actually delivered in the
            // window the opens were counted over, not the lifetime figure.
            deliveredInWindow: listedDelivered,
            isPartial: (rollup?.totalCampaigns ?? 0) > listed.length,
        };
    }, [campaigns, rollup]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Stat
                    icon={BellRing}
                    label="Pushes sent"
                    value={totals.campaigns.toLocaleString()}
                    hint="Notification sends"
                />
                <Stat
                    icon={Smartphone}
                    label="Devices"
                    value={totals.devices.toLocaleString()}
                    hint="Attempted deliveries"
                />
                <Stat
                    icon={Send}
                    label="Delivered"
                    value={totals.delivered.toLocaleString()}
                    hint={percent(totals.delivered, totals.devices) + ' of attempts'}
                    tone="good"
                />
                <Stat
                    icon={TriangleAlert}
                    label="Failed"
                    value={totals.failed.toLocaleString()}
                    hint="Stale or revoked tokens"
                    tone="bad"
                />
                <Stat
                    icon={MousePointerClick}
                    label="Opened"
                    value={totals.opens.toLocaleString()}
                    hint={percent(totals.opens, totals.deliveredInWindow) + ' open rate'}
                />
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg">Push history</CardTitle>
                    <CardDescription>
                        Tap a send to see who received it and who opened it.
                        {totals.isPartial && ` Showing the ${CAMPAIGN_LIMIT} most recent of ${totals.campaigns.toLocaleString()}.`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground sm:px-0">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading push history…
                        </div>
                    ) : !campaigns || campaigns.length === 0 ? (
                        <div className="px-3 py-6 text-sm text-muted-foreground sm:px-0">
                            <p className="font-medium text-foreground">No phone pushes recorded yet.</p>
                            <p className="mt-1">
                                Tick <strong>Also push to phones</strong> when sending an alert, or use the system
                                broadcast on the dashboard. Sends made before this board existed were not recorded.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y border-y sm:rounded-xl sm:border">
                            {campaigns.map((campaign) => {
                                const isOpen = expandedId === campaign.id;
                                const opens = campaign.clickCount || 0;
                                return (
                                    <li key={campaign.id} className={cn(isOpen && 'bg-muted/20')}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedId(isOpen ? null : campaign.id)}
                                            className="flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted/40"
                                            aria-expanded={isOpen}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start gap-2">
                                                    <p className="min-w-0 flex-1 break-words text-sm font-semibold">
                                                        {campaign.title}
                                                    </p>
                                                    <ChevronDown
                                                        className={cn(
                                                            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                                            isOpen && 'rotate-180',
                                                        )}
                                                    />
                                                </div>
                                                <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                                                    {campaign.body}
                                                </p>

                                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                    <Badge variant="outline" className="h-5 px-1.5 text-[9px] uppercase shadow-none">
                                                        {SOURCE_LABELS[campaign.source] || campaign.source}
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        className="h-5 max-w-[160px] truncate px-1.5 text-[9px] shadow-none"
                                                    >
                                                        {campaign.audience === 'all'
                                                            ? 'Everyone'
                                                            : campaign.audienceLabel || 'One user'}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {whenLabel(campaign.sentAt)}
                                                    </span>
                                                </div>

                                                {/* Wraps rather than truncating: these five numbers are the
                                                    point of the row, and dropping one on a narrow screen
                                                    would hide the failure count. */}
                                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums">
                                                    <span className="flex items-center gap-1 text-muted-foreground">
                                                        <Users className="h-3 w-3 shrink-0" />
                                                        {(campaign.recipientCount || 0).toLocaleString()} people
                                                    </span>
                                                    <span className="text-emerald-700 dark:text-emerald-400">
                                                        {(campaign.successCount || 0).toLocaleString()}/
                                                        {(campaign.deviceCount || 0).toLocaleString()} delivered
                                                    </span>
                                                    {(campaign.failureCount || 0) > 0 && (
                                                        <span className="text-rose-600 dark:text-rose-400">
                                                            {campaign.failureCount.toLocaleString()} failed
                                                        </span>
                                                    )}
                                                    <span className={cn('font-semibold', opens > 0 ? 'text-primary' : 'text-muted-foreground')}>
                                                        {opens.toLocaleString()} opened ·{' '}
                                                        {percent(opens, campaign.successCount || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>

                                        {isOpen && <RecipientList campaign={campaign} />}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
