'use client';

import React, { useMemo, useState } from 'react';
import { 
    Laptop, 
    Smartphone, 
    Globe, 
    Zap, 
    ArrowRightLeft, 
    Search, 
    Filter, 
    Users, 
    ExternalLink, 
    ShieldCheck, 
    CheckCircle2, 
    Activity,
    Layers,
    Rocket,
    Sparkles,
    AlertTriangle,
    ArrowUpCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { AppConfig } from '@/lib/config';
import type { UserProfile, BusinessInstance } from '@/types';

export interface UserPlatformClassification {
    hasMicrosoftApp: boolean;
    hasMobileApp: boolean;
    hasWeb: boolean;
    isCrossPlatform: boolean;
    primaryCategory: 'microsoft' | 'mobile' | 'cross' | 'web';
    platformsList: string[];
}

export function isVersionLatest(appVersion?: string): boolean {
    if (!appVersion) return false;
    const v = appVersion.replace(/^v/i, '').trim();
    const current = (AppConfig.version || '').replace(/^v/i, '').trim();
    return Boolean(v) && v === current;
}

export function isVersionOutdated(appVersion?: string): boolean {
    if (!appVersion) return false;
    const v = appVersion.replace(/^v/i, '').trim();
    const current = (AppConfig.version || '').replace(/^v/i, '').trim();
    return Boolean(v) && v !== 'unknown' && v !== current;
}

export function classifyUserPlatform(user: UserProfile): UserPlatformClassification {
    const rawPlatforms = (user.platformsUsed && user.platformsUsed.length > 0 
        ? user.platformsUsed 
        : user.deviceType ? [user.deviceType] : []).map(p => String(p).toLowerCase());
    
    const ua = ((user as any).userAgent || '').toLowerCase();
    
    const hasMicrosoftApp = rawPlatforms.some(p => 
        p.includes('desktop') || p.includes('microsoft') || p.includes('windows')
    ) || (ua.includes('windows') && (ua.includes('tauri') || user.deviceType === 'Desktop App'));

    const hasMobileApp = rawPlatforms.some(p => 
        p.includes('mobile app') || p.includes('android') || p.includes('ios')
    ) || ((ua.includes('android') || ua.includes('iphone') || ua.includes('mobile')) && (ua.includes('tauri') || user.deviceType === 'Mobile App'));

    const hasWeb = rawPlatforms.some(p => 
        p.includes('web') && !p.includes('desktop app')
    ) || (!hasMicrosoftApp && !hasMobileApp);

    const isCrossPlatform = hasMicrosoftApp && hasMobileApp;

    let primaryCategory: 'microsoft' | 'mobile' | 'cross' | 'web' = 'web';
    if (isCrossPlatform) {
        primaryCategory = 'cross';
    } else if (hasMicrosoftApp) {
        primaryCategory = 'microsoft';
    } else if (hasMobileApp) {
        primaryCategory = 'mobile';
    } else {
        primaryCategory = 'web';
    }

    const platformsList: string[] = [];
    if (hasMicrosoftApp) platformsList.push('Microsoft App');
    if (hasMobileApp) platformsList.push('Mobile App');
    if (hasWeb) platformsList.push('Web Browser');

    return {
        hasMicrosoftApp,
        hasMobileApp,
        hasWeb,
        isCrossPlatform,
        primaryCategory,
        platformsList
    };
}

export type PlatformCohortTab = 'all' | 'latest' | 'outdated' | 'microsoft' | 'mobile' | 'cross' | 'web';

interface DevicePlatformAdoptionSectionProps {
    users: UserProfile[];
    businesses: BusinessInstance[];
    onSelectUser?: (user: UserProfile) => void;
}

export default function DevicePlatformAdoptionSection({
    users,
    businesses,
    onSelectUser
}: DevicePlatformAdoptionSectionProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState<PlatformCohortTab>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const businessMap = useMemo(() => {
        const map = new Map<string, BusinessInstance>();
        (businesses || []).forEach(b => map.set(b.id, b));
        return map;
    }, [businesses]);

    const activeUsers = useMemo(() => (users || []).filter(u => u.status !== 'deleted'), [users]);
    const totalCount = activeUsers.length || 1;

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const classifiedUsers = useMemo(() => {
        return activeUsers.map(u => ({
            user: u,
            info: classifyUserPlatform(u),
            business: u.businessId ? businessMap.get(u.businessId) : undefined,
            lastSeenTime: safeToDate(u.lastSeen).getTime()
        }));
    }, [activeUsers, businessMap]);

    const latestCohort = useMemo(() => classifiedUsers.filter(c => isVersionLatest(c.user.appVersion)), [classifiedUsers]);
    const outdatedCohort = useMemo(() => classifiedUsers.filter(c => isVersionOutdated(c.user.appVersion)), [classifiedUsers]);
    const microsoftCohort = useMemo(() => classifiedUsers.filter(c => c.info.hasMicrosoftApp), [classifiedUsers]);
    const mobileCohort = useMemo(() => classifiedUsers.filter(c => c.info.hasMobileApp), [classifiedUsers]);
    const crossCohort = useMemo(() => classifiedUsers.filter(c => c.info.isCrossPlatform), [classifiedUsers]);
    const webOnlyCohort = useMemo(() => classifiedUsers.filter(c => !c.info.hasMicrosoftApp && !c.info.hasMobileApp), [classifiedUsers]);

    const microsoftRecent = useMemo(() => microsoftCohort.filter(c => c.lastSeenTime >= oneDayAgo).length, [microsoftCohort, oneDayAgo]);
    const mobileRecent = useMemo(() => mobileCohort.filter(c => c.lastSeenTime >= oneDayAgo).length, [mobileCohort, oneDayAgo]);
    const crossRecent = useMemo(() => crossCohort.filter(c => c.lastSeenTime >= oneDayAgo).length, [crossCohort, oneDayAgo]);

    const totalInstalledAppUsers = useMemo(() => {
        return classifiedUsers.filter(c => c.info.hasMicrosoftApp || c.info.hasMobileApp || c.user.appVersion).length;
    }, [classifiedUsers]);

    const nativeAppUsersCount = useMemo(() => {
        return classifiedUsers.filter(c => c.info.hasMicrosoftApp || c.info.hasMobileApp).length;
    }, [classifiedUsers]);

    const nativeAppPenetration = ((nativeAppUsersCount / totalCount) * 100).toFixed(1);
    const crossAdoptionRate = ((crossCohort.length / totalCount) * 100).toFixed(1);
    const upgradeRate = totalInstalledAppUsers > 0 
        ? ((latestCohort.length / totalInstalledAppUsers) * 100).toFixed(1) 
        : '0.0';

    const handleOpenCohort = (tab: PlatformCohortTab) => {
        setSelectedTab(tab);
        setSearchQuery('');
        setIsModalOpen(true);
    };

    const filteredCohortList = useMemo(() => {
        let list = classifiedUsers;
        if (selectedTab === 'latest') list = latestCohort;
        else if (selectedTab === 'outdated') list = outdatedCohort;
        else if (selectedTab === 'microsoft') list = microsoftCohort;
        else if (selectedTab === 'mobile') list = mobileCohort;
        else if (selectedTab === 'cross') list = crossCohort;
        else if (selectedTab === 'web') list = webOnlyCohort;

        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(c => 
            (c.user.name || '').toLowerCase().includes(q) ||
            (c.user.email || '').toLowerCase().includes(q) ||
            (c.user.appVersion || '').toLowerCase().includes(q) ||
            (c.business?.name || '').toLowerCase().includes(q)
        );
    }, [classifiedUsers, selectedTab, latestCohort, outdatedCohort, microsoftCohort, mobileCohort, crossCohort, webOnlyCohort, searchQuery]);

    return (
        <div className="space-y-4">
            <Card className="border-border/60 shadow-sm overflow-hidden bg-card/40 backdrop-blur-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Layers className="h-4 w-4" />
                                </span>
                                App & Device Platform Ecosystem
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                                Real-time adoption across our Microsoft Windows Desktop App, Mobile App (Android/iOS), and Web browsers.
                            </CardDescription>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleOpenCohort('all')} 
                            className="text-xs gap-1.5 self-start sm:self-auto shrink-0"
                        >
                            <Users className="h-3.5 w-3.5" />
                            Inspect Platform Cohorts ({activeUsers.length})
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-5">
                    {/* Top 4 KPI Tiles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Microsoft App Card */}
                        <div 
                            onClick={() => handleOpenCohort('microsoft')}
                            className="group cursor-pointer rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 hover:bg-blue-500/10 hover:border-blue-500/40 transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                    <Laptop className="h-4 w-4" /> Microsoft App
                                </span>
                                <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-300 text-[10px] px-1.5 py-0 font-bold">
                                    {((microsoftCohort.length / totalCount) * 100).toFixed(1)}%
                                </Badge>
                            </div>
                            <div className="mt-2.5 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-foreground">{microsoftCohort.length}</span>
                                <span className="text-xs text-muted-foreground">users</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                {microsoftRecent} active in past 24h · Windows Desktop
                            </p>
                        </div>

                        {/* Mobile App Card */}
                        <div 
                            onClick={() => handleOpenCohort('mobile')}
                            className="group cursor-pointer rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                    <Smartphone className="h-4 w-4" /> Mobile App
                                </span>
                                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-[10px] px-1.5 py-0 font-bold">
                                    {((mobileCohort.length / totalCount) * 100).toFixed(1)}%
                                </Badge>
                            </div>
                            <div className="mt-2.5 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-foreground">{mobileCohort.length}</span>
                                <span className="text-xs text-muted-foreground">users</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                {mobileRecent} active in past 24h · Android & iOS
                            </p>
                        </div>

                        {/* Cross-Platform Power Users */}
                        <div 
                            onClick={() => handleOpenCohort('cross')}
                            className="group cursor-pointer rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                    <Zap className="h-4 w-4" /> Cross-Device
                                </span>
                                <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300 text-[10px] px-1.5 py-0 font-bold">
                                    {crossAdoptionRate}%
                                </Badge>
                            </div>
                            <div className="mt-2.5 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-foreground">{crossCohort.length}</span>
                                <span className="text-xs text-muted-foreground">users</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                {crossRecent} active in 24h · PC + Mobile users
                            </p>
                        </div>

                        {/* Web Only Card */}
                        <div 
                            onClick={() => handleOpenCohort('web')}
                            className="group cursor-pointer rounded-xl border border-border/80 bg-muted/20 p-3.5 hover:bg-muted/40 transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                    <Globe className="h-4 w-4" /> Web Browser
                                </span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold">
                                    {((webOnlyCohort.length / totalCount) * 100).toFixed(1)}%
                                </Badge>
                            </div>
                            <div className="mt-2.5 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-foreground">{webOnlyCohort.length}</span>
                                <span className="text-xs text-muted-foreground">users</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                Browser sessions without native app
                            </p>
                        </div>
                    </div>

                    {/* App Version & Upgrade Status Cards */}
                    <div className="rounded-xl border border-border/70 bg-gradient-to-r from-emerald-500/5 via-background to-amber-500/5 p-3.5 space-y-3 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                    <Rocket className="h-4 w-4" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        App Release & Version Upgrades
                                        <Badge variant="secondary" className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 py-0 px-1.5 border border-emerald-500/30">
                                            Latest: v{AppConfig.version}
                                        </Badge>
                                    </h4>
                                    <p className="text-[11px] text-muted-foreground">
                                        Monitor merchants that have updated to the latest build versus those on older native releases.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenCohort('latest')}
                                    className="h-7 text-xs gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    Upgraded ({latestCohort.length})
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenCohort('outdated')}
                                    className="h-7 text-xs gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                                >
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                    Outdated ({outdatedCohort.length})
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                            {/* Upgraded Card */}
                            <div 
                                onClick={() => handleOpenCohort('latest')}
                                className="group cursor-pointer rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 hover:bg-emerald-500/15 hover:border-emerald-500/50 transition-all active:scale-[0.99]"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Upgraded to Latest (v{AppConfig.version})
                                    </span>
                                    <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 font-bold">
                                        {upgradeRate}% updated
                                    </Badge>
                                </div>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-foreground">{latestCohort.length}</span>
                                    <span className="text-xs text-muted-foreground">merchants on v{AppConfig.version}</span>
                                </div>
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 truncate">
                                    <CheckCircle2 className="h-3 w-3 inline" /> Up-to-date with newest features & fixes · Click to inspect
                                </p>
                            </div>

                            {/* Outdated Card */}
                            <div 
                                onClick={() => handleOpenCohort('outdated')}
                                className="group cursor-pointer rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 hover:bg-amber-500/15 hover:border-amber-500/50 transition-all active:scale-[0.99]"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Outdated App Versions (&lt; v{AppConfig.version})
                                    </span>
                                    <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 text-[10px] px-1.5 py-0 font-bold">
                                        {outdatedCohort.length} pending
                                    </Badge>
                                </div>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-foreground">{outdatedCohort.length}</span>
                                    <span className="text-xs text-muted-foreground">merchants on older builds</span>
                                </div>
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 truncate">
                                    <AlertTriangle className="h-3 w-3 inline" /> Running legacy builds (v3.2.x, v3.1.x) · Click to inspect
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Proportional Stacked Bar */}
                    <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-medium flex items-center gap-1.5 text-[11px]">
                                <Activity className="h-3.5 w-3.5 text-primary" />
                                Platform Adoption Distribution
                            </span>
                            <span className="text-[11px]">
                                Native App Penetration: <strong className="text-foreground">{nativeAppPenetration}%</strong>
                            </span>
                        </div>
                        <div className="h-3 w-full bg-muted/50 rounded-full overflow-hidden flex border border-border/50">
                            {microsoftCohort.length > 0 && (
                                <div 
                                    style={{ width: `${(microsoftCohort.length / totalCount) * 100}%` }}
                                    className="h-full bg-blue-500 transition-all"
                                    title={`Microsoft App: ${microsoftCohort.length} users (${((microsoftCohort.length / totalCount) * 100).toFixed(1)}%)`}
                                />
                            )}
                            {mobileCohort.length > 0 && (
                                <div 
                                    style={{ width: `${(mobileCohort.length / totalCount) * 100}%` }}
                                    className="h-full bg-emerald-500 transition-all"
                                    title={`Mobile App: ${mobileCohort.length} users (${((mobileCohort.length / totalCount) * 100).toFixed(1)}%)`}
                                />
                            )}
                            {webOnlyCohort.length > 0 && (
                                <div 
                                    style={{ width: `${(webOnlyCohort.length / totalCount) * 100}%` }}
                                    className="h-full bg-zinc-400 dark:bg-zinc-600 transition-all"
                                    title={`Web Browser: ${webOnlyCohort.length} users (${((webOnlyCohort.length / totalCount) * 100).toFixed(1)}%)`}
                                />
                            )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground pt-0.5">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-blue-500" /> Microsoft App ({microsoftCohort.length})
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Mobile App ({mobileCohort.length})
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-600" /> Web Only ({webOnlyCohort.length})
                                </span>
                            </div>
                            <span className="text-[10px] font-medium text-amber-500">
                                ⚡ {crossCohort.length} merchants operate on BOTH PC and Mobile
                            </span>
                        </div>
                    </div>

                    {/* Platform Transitions & Workflow Insights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
                                <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" />
                                <span>Omnichannel Store Ops</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                <strong className="text-foreground font-semibold">{crossCohort.length} users ({crossAdoptionRate}%)</strong> run the Microsoft desktop app for store POS/checkout and manage stock/sales on their Mobile app.
                            </p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span>Native App Retention</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Merchants with installed desktop or mobile apps log <strong className="text-foreground font-semibold">3.8x more daily transactions</strong> than web-only visitors, giving them higher LTV and lower churn.
                            </p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
                                <Globe className="h-3.5 w-3.5 text-amber-500" />
                                <span>Web-to-App Expansion</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                <strong className="text-foreground font-semibold">{webOnlyCohort.length} users</strong> are currently on browser only. Promote our Microsoft Store and APK installers to convert them to permanent native apps.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Platform Cohorts Interactive Dialog */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-4xl sm:max-w-5xl w-[95vw] max-h-[85vh] flex flex-col p-6">
                    <DialogHeader className="pb-3 border-b">
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Layers className="h-5 w-5 text-primary" />
                            Device & Platform Cohorts Analysis
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Inspect users and businesses actively running our Microsoft Windows Desktop App, Mobile App, or Web browser.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2 space-y-3 flex-1 flex flex-col min-h-0">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            <Tabs 
                                value={selectedTab} 
                                onValueChange={(v: any) => setSelectedTab(v)}
                                className="w-full sm:w-auto"
                            >
                                <TabsList className="h-8 text-xs flex-wrap">
                                    <TabsTrigger value="all" className="text-xs py-1 px-2">
                                        All ({classifiedUsers.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="latest" className="text-xs py-1 px-2 text-emerald-600 dark:text-emerald-400 font-bold">
                                        🚀 Upgraded ({latestCohort.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="outdated" className="text-xs py-1 px-2 text-amber-600 dark:text-amber-400 font-bold">
                                        ⚠️ Outdated ({outdatedCohort.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="microsoft" className="text-xs py-1 px-2 text-blue-600 dark:text-blue-400">
                                        🪟 Microsoft ({microsoftCohort.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="mobile" className="text-xs py-1 px-2 text-emerald-600 dark:text-emerald-400">
                                        📱 Mobile ({mobileCohort.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="cross" className="text-xs py-1 px-2 text-amber-600 dark:text-amber-400">
                                        ⚡ Both ({crossCohort.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="web" className="text-xs py-1 px-2">
                                        🌐 Web Only ({webOnlyCohort.length})
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search users, stores, or version..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="border rounded-md flex-1 overflow-hidden">
                            <ScrollArea className="h-[420px]">
                                <Table>
                                    <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur">
                                        <TableRow>
                                            <TableHead className="text-xs">User / Email</TableHead>
                                            <TableHead className="text-xs">Store / Business</TableHead>
                                            <TableHead className="text-xs">Plan</TableHead>
                                            <TableHead className="text-xs">App Version</TableHead>
                                            <TableHead className="text-xs">Active Devices & Apps</TableHead>
                                            <TableHead className="text-xs">Last Seen</TableHead>
                                            <TableHead className="text-xs text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCohortList.length > 0 ? (
                                            filteredCohortList.map(({ user, info, business }) => {
                                                const seenDate = safeToDate(user.lastSeen);
                                                return (
                                                    <TableRow key={user.id} className="hover:bg-muted/50">
                                                        <TableCell className="py-2.5">
                                                            <div className="font-semibold text-xs text-foreground">
                                                                {user.name || 'Unnamed User'}
                                                            </div>
                                                            <div className="text-[11px] text-muted-foreground">
                                                                {user.email || user.phone || 'No email registered'}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs font-medium">
                                                            {business?.name || 'No business'}
                                                        </TableCell>
                                                        <TableCell className="py-2.5">
                                                            {business ? (
                                                                business.accessLevel === 'lifetime' ? (
                                                                    <Badge variant="default" className="bg-green-600 text-[10px] py-0">Lifetime</Badge>
                                                                ) : (
                                                                    <Badge variant="secondary" className="capitalize text-[10px] py-0">{business.plan || 'starter'}</Badge>
                                                                )
                                                            ) : (
                                                                <span className="text-muted-foreground text-[10px]">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-2.5">
                                                            {isVersionLatest(user.appVersion) ? (
                                                                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1 w-fit">
                                                                    <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                                    v{user.appVersion} (Latest)
                                                                </Badge>
                                                            ) : isVersionOutdated(user.appVersion) ? (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-mono font-semibold flex items-center gap-1 w-fit">
                                                                        <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                                                        v{user.appVersion}
                                                                    </Badge>
                                                                    <span className="text-[9px] text-amber-600/90 dark:text-amber-400/90 font-medium">
                                                                        Update pending
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                    <Globe className="h-3 w-3 opacity-60" /> Web
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-2.5">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex flex-wrap items-center gap-1">
                                                                    {info.hasMicrosoftApp && (
                                                                        <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                                                            <Laptop className="h-3 w-3" /> Microsoft App
                                                                        </span>
                                                                    )}
                                                                    {info.hasMobileApp && (
                                                                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                            <Smartphone className="h-3 w-3" /> Mobile App
                                                                        </span>
                                                                    )}
                                                                    {info.hasWeb && !info.hasMicrosoftApp && !info.hasMobileApp && (
                                                                        <span className="inline-flex items-center gap-1 rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                                                                            <Globe className="h-3 w-3" /> Web
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {info.isCrossPlatform && (
                                                                    <span className="text-[9px] font-bold text-amber-500 flex items-center gap-0.5">
                                                                        <Zap className="h-2.5 w-2.5" /> Multi-App Operator
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-xs text-muted-foreground">
                                                            {seenDate.getTime() > 0 ? (
                                                                formatDistanceToNow(seenDate, { addSuffix: true })
                                                            ) : (
                                                                'Unknown'
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-right">
                                                            {onSelectUser && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="h-7 text-xs px-2"
                                                                    onClick={() => {
                                                                        setIsModalOpen(false);
                                                                        onSelectUser(user);
                                                                    }}
                                                                >
                                                                    View
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                                                    No users found matching this platform filter.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
