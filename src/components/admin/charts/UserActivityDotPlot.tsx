'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserProfile, BusinessInstance } from '@/types';
import { Grid, Loader, ZoomIn } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { getDocs, query, collectionGroup, collection, limit, orderBy } from 'firebase/firestore';
import { withFirestoreRetry } from '@/firebase/retry';

interface UserActivityDotPlotProps {
    users: UserProfile[];
    businesses: BusinessInstance[];
}

export default function UserActivityDotPlot({ users, businesses }: UserActivityDotPlotProps) {
    const firestore = useFirestore();
    const [journeys, setJourneys] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [rangeDays, setRangeDays] = useState(90);

    useEffect(() => {
        if (!firestore || !users.length) return;
        let cancelled = false;
        setLoading(true);

        // Fetch recent journeys only for the top 50 most active users to guarantee we get their latest data
        const topUsers = [...users]
            .sort((a, b) => (b.totalUsageSeconds || 0) - (a.totalUsageSeconds || 0))
            .slice(0, 50);

        const fetchPromises = topUsers.map(u => {
            const q = query(
                collection(firestore, `users/${u.id}/journey`),
                orderBy('startedAt', 'desc'),
                limit(150)
            );
            return getDocs(q).then(snap => snap.docs.map(d => ({ 
                id: d.id, 
                uid: u.id, 
                ...(d.data() as any) 
            })));
        });

        Promise.all(fetchPromises)
            .then(results => {
                if (cancelled) return;
                setJourneys(results.flat());
            })
            .catch(err => console.error('Failed to load journeys for dot plot', err))
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [firestore, users]);

    const { columns, activeUsers, usersByBucket } = useMemo(() => {
        const now = Date.now();
        const bucketCount = rangeDays;
        const step = 24 * 60 * 60 * 1000;
        const windowStart = now - rangeDays * 24 * 60 * 60 * 1000;

        const bucketKeyFormat = 'yyyy-MM-dd';
        const displayFormat = 'MMM d';

        const uByBucket = new Map<string, Set<string>>();
        const allActiveUids = new Set<string>();

        // Build usersByBucket from journeys
        for (const j of journeys) {
            const started = (j.startedAt && typeof j.startedAt.toDate === 'function' 
                ? j.startedAt.toDate().getTime() 
                : (j.routes?.[0]?.at ?? 0));
                
            if (started >= windowStart && j.uid) {
                const key = format(new Date(started), bucketKeyFormat);
                if (!uByBucket.has(key)) uByBucket.set(key, new Set());
                uByBucket.get(key)!.add(j.uid);
                allActiveUids.add(j.uid);
            }
        }

        const cols: { key: string; label: string; fullDate: string }[] = [];
        for (let i = bucketCount - 1; i >= 0; i--) {
            const ms = now - i * step;
            const dateObj = new Date(ms);
            const key = format(dateObj, bucketKeyFormat);
            cols.push({
                key,
                label: format(dateObj, displayFormat),
                fullDate: format(dateObj, 'PPP')
            });
        }

        const relevantUsers = users
            .filter(u => allActiveUids.has(u.id))
            .sort((a, b) => {
                const usageA = a.totalUsageSeconds || 0;
                const usageB = b.totalUsageSeconds || 0;
                if (usageA !== usageB) return usageB - usageA;
                return (a.name || '').localeCompare(b.name || '');
            })
            .slice(0, 50);

        return { columns: cols, activeUsers: relevantUsers, usersByBucket: uByBucket };
    }, [users, journeys]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Grid className="h-5 w-5 text-primary" />
                        Individual User Activity (Dot Plot)
                    </CardTitle>
                    <CardDescription>Loading activity data...</CardDescription>
                </CardHeader>
                <CardContent className="h-[200px] flex items-center justify-center">
                    <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (activeUsers.length === 0) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Grid className="h-5 w-5 text-primary" />
                            Individual User Activity (Dot Plot)
                        </CardTitle>
                        <CardDescription className="mt-1">
                            No user activity recorded in the last {rangeDays} days.
                        </CardDescription>
                    </div>
                    <Select value={rangeDays.toString()} onValueChange={(v) => setRangeDays(parseInt(v))}>
                        <SelectTrigger className="w-[130px] h-8 text-xs shrink-0">
                            <SelectValue placeholder="Timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="14">Last 14 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="60">Last 60 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
            </Card>
        );
    }

    const cellMinWidth = rangeDays > 60 ? 'min-w-[16px]' : rangeDays > 30 ? 'min-w-[24px]' : 'min-w-[32px]';
    const dotSize = rangeDays > 60 ? 'w-1.5 h-1.5' : rangeDays > 30 ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
    const emptyDotSize = rangeDays > 60 ? 'w-0.5 h-0.5' : rangeDays > 30 ? 'w-1 h-1' : 'w-1.5 h-1.5';

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Grid className="h-5 w-5 text-primary" />
                        Individual User Activity (Dot Plot)
                    </CardTitle>
                    <CardDescription className="mt-1">
                        Tracks behavior and retention at the individual level. Each row is a user, and a dot represents a value-adding event (app usage/session) on that day. Showing top {activeUsers.length} active users over the last {rangeDays} days.
                    </CardDescription>
                </div>
                <Select value={rangeDays.toString()} onValueChange={(v) => setRangeDays(parseInt(v))}>
                    <SelectTrigger className="w-[130px] h-8 text-xs shrink-0">
                        <SelectValue placeholder="Timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="14">Last 14 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="60">Last 60 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap rounded-md border pb-4">
                    <div className="flex w-max min-w-full flex-col">
                        {/* Header Row (Columns) */}
                        <div className="flex border-b bg-muted/30">
                            <div className="w-56 shrink-0 p-3 text-xs font-semibold text-muted-foreground border-r sticky left-0 bg-background z-10">
                                User / Business
                            </div>
                            <div className="flex flex-1">
                                {columns.map(col => (
                                    <div key={col.key} className={`flex-1 ${cellMinWidth} p-2 text-center flex flex-col justify-end`}>
                                        <span className="text-[10px] text-muted-foreground -rotate-45 origin-bottom-left block w-full mb-1">
                                            {col.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* User Rows */}
                        <TooltipProvider delayDuration={100}>
                            {activeUsers.map((user) => {
                                const bizName = businesses.find(b => b.id === user.businessId)?.name;
                                const displayName = bizName || user.name || 'Unknown User';
                                
                                return (
                                    <div key={user.id} className="flex border-b last:border-0 hover:bg-muted/10 transition-colors">
                                        <div className="w-56 shrink-0 p-2 text-xs border-r sticky left-0 bg-background z-10 flex flex-col justify-center truncate">
                                            <span className="font-medium truncate" title={displayName}>{displayName}</span>
                                            <span className="text-[10px] text-muted-foreground truncate" title={user.email}>{user.email || 'No email'}</span>
                                        </div>
                                        <div className="flex flex-1">
                                            {columns.map(col => {
                                                const isActive = usersByBucket.get(col.key)?.has(user.id);
                                                return (
                                                    <div key={col.key} className={`flex-1 ${cellMinWidth} flex items-center justify-center p-1 border-r border-dashed border-muted last:border-0`}>
                                                        {isActive ? (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className={`${dotSize} rounded-full bg-primary/80 shadow-[0_0_8px_rgba(var(--primary),0.5)] cursor-pointer hover:bg-primary transition-colors hover:scale-125`}></div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p className="font-bold text-xs">{displayName}</p>
                                                                    <p className="text-[10px]">Active on {col.fullDate}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                            <div className={`${emptyDotSize} rounded-full bg-muted/20`}></div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </TooltipProvider>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-primary/80"></div> Active
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted/20"></div> Inactive
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
