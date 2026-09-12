'use client';

/**
 * Per-user usage drill-down: session history, daily pattern, streaks, device mix
 * and page mix.
 *
 * Extracted from `admin-imamshaffy/page.tsx`, where it was a module-private
 * dialog. Split into a `UserUsagePanel` (the content) and a thin
 * `UserUsageDetailDialog` wrapper, so the dashboard keeps its dialog while the
 * user detail page can embed the same content as a tab.
 *
 * Self-fetching: reads `users/{uid}/sessions` when it first becomes visible, so
 * the caller pays that read only for users actually inspected.
 */

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import {
    ResponsiveContainer,
    BarChart as ReBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ReTooltip,
} from 'recharts';
import { AlertTriangle, Loader, Timer } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore } from '@/firebase';
import { withFirestoreRetry } from '@/firebase/retry';
import type { BusinessInstance, UserProfile } from '@/types';
import { formatDuration, toDate } from './user-primitives';

/**
 * A document in `users/{uid}/sessions`. Two writers merge into the same doc ids:
 * use-session-tracker adds `startedAt`/`endedAt`/`durationSeconds`/`date`, while
 * UserActivityTracker's heartbeat adds `sessionId`/`userAgent`/`deviceInfo`. Most
 * live docs are the union; every field stays optional for that reason.
 */
export interface UsageSession {
    id: string;
    startedAt?: any;
    endedAt?: any;
    lastSeen?: any;
    createdAt?: any;
    durationSeconds?: number;
    date?: string;
    userAgent?: string;
    revoked?: boolean;
    deviceInfo?: { platform?: string; vendor?: string; language?: string };
}

export function UserUsagePanel({
    user,
    active = true,
}: {
    user: UserProfile | null;
    /** Fetch only once this is true — lets a tab defer its read until opened. */
    active?: boolean;
}) {
    const firestore = useFirestore();
    const [sessions, setSessions] = useState<UsageSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!active || !user || !firestore) return;

        let cancelled = false;
        setIsLoading(true);
        setLoadError(null);

        (async () => {
            try {
                // No orderBy on purpose: heartbeat docs carry no `startedAt`, and
                // Firestore omits documents missing the ordered field — adding one
                // here silently drops sessions rather than sorting them.
                const snap = await withFirestoreRetry(
                    () => getDocs(query(
                        collection(firestore, 'users', user.id, 'sessions'),
                        limit(500),
                    )),
                    { label: `Usage sessions for ${user.name}` },
                );
                if (cancelled) return;
                setSessions(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            } catch (err: any) {
                if (cancelled) return;
                console.error('Failed to load usage sessions', err);
                setLoadError(err?.message || 'Could not load session history.');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [active, user, firestore]);

    const stats = useMemo(() => {
        const withDuration = sessions.filter(s => (s.durationSeconds ?? 0) > 0);

        // Group into days using the session's own `date` when present, falling
        // back to the start time. Heartbeat docs carry neither and are ignored.
        const byDay = new Map<string, number>();
        for (const s of withDuration) {
            const started = toDate(s.startedAt) || toDate(s.createdAt);
            const key = s.date || (started ? format(started, 'yyyy-MM-dd') : null);
            if (!key) continue;
            byDay.set(key, (byDay.get(key) || 0) + (s.durationSeconds ?? 0));
        }

        const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        const longest = withDuration.reduce(
            (best, s) => ((s.durationSeconds ?? 0) > (best?.durationSeconds ?? 0) ? s : best),
            null as UsageSession | null,
        );

        // Current streak: consecutive days with any usage, counting back from
        // the most recent active day (today or yesterday still counts as live).
        let streak = 0;
        if (days.length) {
            const active = new Set(days.map(d => d[0]));
            const cursor = new Date();
            if (!active.has(format(cursor, 'yyyy-MM-dd'))) cursor.setDate(cursor.getDate() - 1);
            while (active.has(format(cursor, 'yyyy-MM-dd'))) {
                streak++;
                cursor.setDate(cursor.getDate() - 1);
            }
        }

        const last30 = days.slice(-30);
        const activeDays = days.length;
        const avgPerActiveDay = activeDays
            ? Math.round(days.reduce((s, d) => s + d[1], 0) / activeDays)
            : 0;

        // Busiest hour of day, so support knows when this user is actually working.
        const byHour = new Array(24).fill(0);
        for (const s of withDuration) {
            const started = toDate(s.startedAt) || toDate(s.createdAt);
            if (started) byHour[started.getHours()] += s.durationSeconds ?? 0;
        }
        const peakHour = byHour.some(v => v > 0) ? byHour.indexOf(Math.max(...byHour)) : null;

        const devices = new Map<string, number>();
        for (const s of sessions) {
            const platform = s.deviceInfo?.platform || 'Unknown';
            devices.set(platform, (devices.get(platform) || 0) + 1);
        }

        return {
            sessionCount: withDuration.length,
            activeDays,
            avgPerActiveDay,
            longest,
            streak,
            peakHour,
            chartData: last30.map(([date, seconds]) => ({
                date: format(new Date(`${date}T00:00:00`), 'MMM d'),
                minutes: Math.round(seconds / 60),
            })),
            devices: [...devices.entries()].sort((a, b) => b[1] - a[1]),
            recent: [...sessions]
                .sort((a, b) => {
                    const at = toDate(a.startedAt) || toDate(a.createdAt) || toDate(a.lastSeen);
                    const bt = toDate(b.startedAt) || toDate(b.createdAt) || toDate(b.lastSeen);
                    return (bt?.getTime() ?? 0) - (at?.getTime() ?? 0);
                })
                .slice(0, 15),
        };
    }, [sessions]);

    // Top routes for this user, as a share of their single busiest page.
    const topUserPages = useMemo(() => {
        const entries = Object.entries(user?.pageViews ?? {});
        if (!entries.length) return [];
        const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 8);
        const max = sorted[0][1] || 1;
        return sorted.map(([key, views]) => ({
            // Keys are stored underscore-joined by routeKey(); render as paths.
            page: key === 'root' ? '/' : '/' + key.split('_').join('/'),
            views,
            pct: Math.round((views / max) * 100),
        }));
    }, [user?.pageViews]);

    if (!user) return null;

    const lastSeenDate = toDate(user.lastSeen);

    return (
        <div className="space-y-4">
            {/* Headline numbers come from the user doc, so they render even
                while the session history is still loading. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-3">
                    <p className="text-xs text-muted-foreground font-bold">Total Usage</p>
                    <p className="text-xl font-bold mt-1">{formatDuration(user.totalUsageSeconds ?? 0)}</p>
                </Card>
                <Card className="p-3">
                    <p className="text-xs text-muted-foreground font-bold">Active Days</p>
                    <p className="text-xl font-bold mt-1">{isLoading ? '—' : stats.activeDays}</p>
                </Card>
                <Card className="p-3">
                    <p className="text-xs text-muted-foreground font-bold">Current Streak</p>
                    <p className="text-xl font-bold mt-1">
                        {isLoading ? '—' : `${stats.streak} day${stats.streak === 1 ? '' : 's'}`}
                    </p>
                </Card>
                <Card className="p-3">
                    <p className="text-xs text-muted-foreground font-bold">Avg / Active Day</p>
                    <p className="text-xl font-bold mt-1">
                        {isLoading ? '—' : formatDuration(stats.avgPerActiveDay)}
                    </p>
                </Card>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                    <Label className="text-xs text-muted-foreground font-bold">Last Seen</Label>
                    <p className="font-medium mt-1">
                        {lastSeenDate ? formatDistanceToNow(lastSeenDate, { addSuffix: true }) : 'Never'}
                    </p>
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground font-bold">Device</Label>
                    <p className="font-medium mt-1">{user.deviceType || 'Unknown'}</p>
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground font-bold">App Version</Label>
                    <p className="font-medium mt-1">{user.appVersion || 'Unknown'}</p>
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground font-bold">Peak Hour</Label>
                    <p className="font-medium mt-1">
                        {isLoading || stats.peakHour === null
                            ? '—'
                            : `${String(stats.peakHour).padStart(2, '0')}:00`}
                    </p>
                </div>
            </div>

            {/* Page mix comes off the user doc's pageViews map, so it does not
                depend on the session query above and shows up immediately. */}
            {topUserPages.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Where They Spend Their Time</CardTitle>
                        <CardDescription className="text-xs">
                            {(user.pagesVisited ?? 0).toLocaleString()} page views tracked
                            {user.lastPage ? ` · last on ${user.lastPage}` : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {topUserPages.map(({ page, views, pct }) => (
                            <div key={page} className="space-y-1">
                                <div className="flex items-baseline justify-between gap-2 text-xs">
                                    <span className="truncate font-mono">{page}</span>
                                    <span className="shrink-0 font-semibold tabular-nums">
                                        {views.toLocaleString()}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                    <Loader className="h-5 w-5 animate-spin" />
                    Loading session history…
                </div>
            ) : loadError ? (
                <div className="flex items-center gap-2 py-8 text-sm text-destructive justify-center">
                    <AlertTriangle className="h-4 w-4" />
                    {loadError}
                </div>
            ) : stats.sessionCount === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                    No completed sessions recorded yet. Per-session history starts once the user
                    closes the app at least once on v3.0.0 or later.
                </div>
            ) : (
                <>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Daily Usage (last 30 active days)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[220px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ReBarChart data={stats.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            label={{ value: 'min', angle: -90, position: 'insideLeft', fontSize: 11 }}
                                        />
                                        <ReTooltip
                                            formatter={(v: any) => [`${v} min`, 'Usage']}
                                            contentStyle={{ fontSize: 12 }}
                                        />
                                        <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                    </ReBarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Session Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Recorded sessions</span>
                                    <span className="font-semibold">{stats.sessionCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Longest session</span>
                                    <span className="font-semibold">
                                        {formatDuration(stats.longest?.durationSeconds ?? 0)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Avg session length</span>
                                    <span className="font-semibold">
                                        {formatDuration(Math.round(
                                            sessions.reduce((s, x) => s + (x.durationSeconds ?? 0), 0) /
                                            Math.max(stats.sessionCount, 1),
                                        ))}
                                    </span>
                                </div>
                                {stats.devices.map(([platform, count]) => (
                                    <div key={platform} className="flex justify-between">
                                        <span className="text-muted-foreground">{platform}</span>
                                        <span className="font-semibold">{count} session{count === 1 ? '' : 's'}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Recent Sessions</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[260px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background">
                                            <TableRow>
                                                <TableHead className="text-xs">When</TableHead>
                                                <TableHead className="text-xs">Duration</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {stats.recent.map(s => {
                                                const when = toDate(s.startedAt) || toDate(s.createdAt) || toDate(s.lastSeen);
                                                return (
                                                    <TableRow key={s.id}>
                                                        <TableCell className="text-xs">
                                                            {when ? format(when, 'PPp') : '—'}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-mono">
                                                            {s.durationSeconds
                                                                ? formatDuration(s.durationSeconds)
                                                                : <span className="text-muted-foreground">active</span>}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * Dialog wrapper, kept so the admin dashboard's existing call site is unchanged.
 */
export function UserUsageDetailDialog({
    user, business, open, onOpenChange,
}: {
    user: UserProfile | null;
    business: BusinessInstance | undefined;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    if (!user) return null;

    const joinedDate = toDate(user.createdAt);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Timer className="h-5 w-5 text-primary" />
                        {user.name} — Usage Insights
                    </DialogTitle>
                    <DialogDescription>
                        {user.email}
                        {business?.name ? ` · ${business.name}` : ''}
                        {joinedDate ? ` · Joined ${format(joinedDate, 'PP')}` : ''}
                    </DialogDescription>
                </DialogHeader>

                {/* Fetch keyed to `open` so a closed dialog costs no reads. */}
                <UserUsagePanel user={user} active={open} />
            </DialogContent>
        </Dialog>
    );
}

export default UserUsageDetailDialog;
