'use client';

/**
 * Per-user deep detail.
 *
 * Reached as `/admin-imamshaffy/users/detail?id=<uid>` rather than a `[id]`
 * dynamic segment on purpose: `next.config.ts` builds with `output: 'export'`
 * for Tauri and `scripts/prepare-tauri.mjs` deliberately keeps this admin
 * directory, so a dynamic route would need `generateStaticParams()` over a
 * build-time list of user ids — which cannot exist. Every other runtime-entity
 * screen in the app (inventory, customers, receipts, invoices) uses this same
 * `?id=` + `<Suspense>` pattern.
 *
 * Read cost: two document reads on mount. Each tab loads its own data the first
 * time it is opened and never again — see `sections.tsx`.
 */

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, runTransaction } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import {
    ArrowLeft,
    Ban,
    Building,
    CreditCard,
    Fingerprint,
    Gauge,
    Globe,
    KeyRound,
    Laptop,
    Route,
    ScrollText,
    ShieldAlert,
    ShoppingCart,
    Smartphone,
    UserCheck,
    LifeBuoy,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { BusinessInstance, UserProfile } from '@/types';
import { AppConfig } from '@/lib/config';
import { idToken } from '@/lib/id-token';
import { revokeUserSessions } from '@/actions/admin-actions';
import {
    UserPresence,
    formatDuration,
    toDate,
    userLanguage,
} from '@/components/admin/user-detail/user-primitives';
import { UserUsagePanel } from '@/components/admin/user-detail/usage-insights';
import {
    SEGMENT_BADGE_CLASS,
    SEGMENT_LABELS,
    segmentOf,
    planOf,
} from '@/components/admin/user-detail/user-segments';
import {
    AuditSection,
    BillingSection,
    DevicesSection,
    JourneySection,
    SalesSection,
    SupportSection,
} from '@/components/admin/user-detail/sections';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="min-w-0">
        <Label className="text-xs font-bold text-muted-foreground">{label}</Label>
        <div className="mt-1 break-words text-sm font-medium">{children || <span className="text-muted-foreground">—</span>}</div>
    </div>
);

function UserDetailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user: authUser } = useUser();
    const { toast } = useToast();

    const userId = searchParams.get('id');

    const [tab, setTab] = React.useState('overview');
    // Once a tab has been opened it stays mounted, so its query is not re-run
    // when the reader flips back and forth.
    const [visited, setVisited] = React.useState<Set<string>>(new Set(['overview']));
    const openTab = (next: string) => {
        setTab(next);
        setVisited(prev => (prev.has(next) ? prev : new Set(prev).add(next)));
    };

    // Switching to a different user keeps this component mounted, so the tab
    // state has to be reset explicitly or the new user opens on the old user's
    // tab with the old user's rows still on screen.
    React.useEffect(() => {
        setTab('overview');
        setVisited(new Set(['overview']));
    }, [userId]);

    const [confirm, setConfirm] = React.useState<null | 'activate' | 'deactivate' | 'revoke'>(null);
    const [busy, setBusy] = React.useState(false);

    const userRef = useMemoFirebase(
        () => (firestore && userId ? doc(firestore, 'users', userId) : null),
        [firestore, userId],
    );
    const { data: user, isLoading: userLoading } = useDoc<UserProfile>(userRef);

    const businessRef = useMemoFirebase(
        () => (firestore && user?.businessId ? doc(firestore, 'businessInstances', user.businessId) : null),
        [firestore, user?.businessId],
    );
    const { data: business, isLoading: businessLoading } = useDoc<BusinessInstance>(businessRef);

    const isSelf = authUser?.uid === userId;

    const handleStatus = async (action: 'activate' | 'deactivate') => {
        if (!firestore || !user) return;
        setBusy(true);
        try {
            const ref = doc(firestore, 'users', user.id);
            await runTransaction(firestore, async (tx) => {
                const snap = await tx.get(ref);
                if (!snap.exists()) throw new Error('User does not exist.');
                tx.update(ref, { status: action === 'activate' ? 'active' : 'inactive' });
            });
            toast({ title: `User ${action}d`, description: `${user.name}'s account has been ${action}d.`, variant: 'success' });
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message || 'Could not update status.', variant: 'destructive' });
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    const handleRevoke = async () => {
        if (!user) return;
        setBusy(true);
        try {
            await revokeUserSessions(user.id, await idToken());
            toast({
                title: 'Sessions revoked',
                description: `${user.name} must sign in again on every device.`,
                variant: 'success',
            });
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message || 'Could not revoke sessions.', variant: 'destructive' });
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    if (!userId) {
        return (
            <Card className="p-12 text-center">
                <h2 className="text-lg font-semibold">No user selected</h2>
                <p className="mt-1 text-sm text-muted-foreground">This page needs a user id in the address.</p>
                <Button className="mt-4" onClick={() => router.push('/admin-imamshaffy/users')}>
                    Back to all users
                </Button>
            </Card>
        );
    }

    if (userLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-9 w-40" />
                <Card className="p-6">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="mt-2 h-4 w-80" />
                    <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                </Card>
            </div>
        );
    }

    if (!user) {
        return (
            <Card className="p-12 text-center">
                <h2 className="text-lg font-semibold">User not found</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    No account with id <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{userId}</code>.
                    It may have been deleted.
                </p>
                <Button className="mt-4" onClick={() => router.push('/admin-imamshaffy/users')}>
                    Back to all users
                </Button>
            </Card>
        );
    }

    const segment = segmentOf(user);
    const joined = toDate(user.createdAt);
    const suspendedAt = toDate(user.suspendedAt);
    const trialEnds = toDate((business as any)?.trialExpiresAt);
    const language = userLanguage(user.language);
    const blocked = user.status === 'inactive' || user.status === 'suspended';
    const outdated = !!user.appVersion && user.appVersion !== AppConfig.version;
    const permissions = Object.entries(user.permissions ?? {});

    const DeviceIcon = user.deviceType?.includes('Desktop')
        ? Laptop
        : user.deviceType?.includes('Mobile') ? Smartphone : Globe;

    return (
        <div className="space-y-4">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.push('/admin-imamshaffy/users')}>
                <ArrowLeft className="h-4 w-4" /> All users
            </Button>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
                                {user.name}
                                <Badge variant={blocked ? 'destructive' : 'outline'} className="capitalize">
                                    {user.status || 'active'}
                                </Badge>
                                <Badge variant="outline" className={`text-[10px] ${SEGMENT_BADGE_CLASS[segment]}`}>
                                    {SEGMENT_LABELS[segment]}
                                </Badge>
                            </CardTitle>
                            <CardDescription className="mt-1 break-all">
                                {user.email}
                                {business?.name ? ` · ${business.name}` : ''}
                                {joined ? ` · joined ${format(joined, 'PP')}` : ''}
                            </CardDescription>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {blocked ? (
                                <Button size="sm" variant="outline" className="gap-1.5" disabled={busy || isSelf} onClick={() => setConfirm('activate')}>
                                    <UserCheck className="h-3.5 w-3.5" /> Activate
                                </Button>
                            ) : (
                                <Button size="sm" variant="outline" className="gap-1.5" disabled={busy || isSelf} onClick={() => setConfirm('deactivate')}>
                                    <Ban className="h-3.5 w-3.5" /> Deactivate
                                </Button>
                            )}
                            <Button size="sm" variant="destructive" className="gap-1.5" disabled={busy} onClick={() => setConfirm('revoke')}>
                                <KeyRound className="h-3.5 w-3.5" /> Revoke sessions
                            </Button>
                        </div>
                    </div>

                    {isSelf && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            This is your own account, so the status controls are disabled.
                        </p>
                    )}
                </CardHeader>

                <CardContent>
                    <Tabs value={tab} onValueChange={openTab}>
                        <div className="overflow-x-auto">
                            <TabsList className="inline-flex w-auto">
                                <TabsTrigger value="overview" className="gap-1.5 text-xs"><Fingerprint className="h-3.5 w-3.5" /> Overview</TabsTrigger>
                                <TabsTrigger value="activity" className="gap-1.5 text-xs"><Gauge className="h-3.5 w-3.5" /> Activity</TabsTrigger>
                                <TabsTrigger value="journey" className="gap-1.5 text-xs"><Route className="h-3.5 w-3.5" /> Journey</TabsTrigger>
                                <TabsTrigger value="sales" className="gap-1.5 text-xs"><ShoppingCart className="h-3.5 w-3.5" /> Sales</TabsTrigger>
                                <TabsTrigger value="audit" className="gap-1.5 text-xs"><ScrollText className="h-3.5 w-3.5" /> Audit</TabsTrigger>
                                <TabsTrigger value="support" className="gap-1.5 text-xs"><LifeBuoy className="h-3.5 w-3.5" /> Support</TabsTrigger>
                                <TabsTrigger value="billing" className="gap-1.5 text-xs"><CreditCard className="h-3.5 w-3.5" /> Billing</TabsTrigger>
                                <TabsTrigger value="devices" className="gap-1.5 text-xs"><Smartphone className="h-3.5 w-3.5" /> Devices</TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Renders entirely from the two documents fetched on mount. */}
                        <TabsContent value="overview" className="mt-4 space-y-4">
                            {blocked && (
                                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                    <div className="text-xs">
                                        <p className="font-medium text-destructive">
                                            This account is {user.status}.
                                        </p>
                                        <p className="mt-0.5 text-muted-foreground">
                                            {suspendedAt ? `Since ${format(suspendedAt, 'PPp')}. ` : ''}
                                            {user.suspendedBy ? `Actioned by ${user.suspendedBy}. ` : ''}
                                            A status change alone does not end an active session — use Revoke sessions for that.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <Card className="p-4">
                                <h3 className="mb-3 text-sm font-semibold">Identity</h3>
                                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                    <Field label="Full name">{user.name}</Field>
                                    <Field label="Email">{user.email}</Field>
                                    <Field label="Phone">{user.phone}</Field>
                                    <Field label="Role">
                                        <span className="capitalize">{(user.role || 'operator').replace('_', ' ')}</span>
                                    </Field>
                                    <Field label="User ID">
                                        <code className="font-mono text-[10px]">{user.id}</code>
                                    </Field>
                                    <Field label="Branch">{user.branchId}</Field>
                                    <Field label="Onboarding survey">
                                        {user.surveyCompleted ? 'Completed' : 'Not completed'}
                                    </Field>
                                    <Field label="Last seen"><UserPresence lastSeen={user.lastSeen} status={(user as any).status} /></Field>
                                </div>
                            </Card>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <Card className="p-4">
                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                        <Building className="h-4 w-4 text-primary" /> Business &amp; plan
                                    </h3>
                                    {businessLoading ? (
                                        <Skeleton className="h-24 w-full" />
                                    ) : business ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <Field label="Business">{business.name}</Field>
                                            <Field label="Industry">{(business as any).settings?.industry}</Field>
                                            <Field label="Plan">
                                                <span className="capitalize">{planOf(user, new Map([[business.id, business]]))}</span>
                                            </Field>
                                            <Field label="Currency">{(business as any).settings?.currency || 'NGN'}</Field>
                                            <Field label="Trial ends">
                                                {trialEnds
                                                    ? `${format(trialEnds, 'PP')} (${formatDistanceToNow(trialEnds, { addSuffix: true })})`
                                                    : 'No trial'}
                                            </Field>
                                            <Field label="Business status">
                                                <span className="capitalize">{(business as any).status || 'active'}</span>
                                            </Field>
                                            <Field label="Location">
                                                {[(business as any).settings?.state, (business as any).settings?.country]
                                                    .filter(Boolean).join(', ')}
                                            </Field>
                                            <Field label="Owner">
                                                {business.ownerId === user.id ? 'This user' : 'Someone else'}
                                            </Field>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            No business resolves for this user
                                            {user.businessId ? ` (id ${user.businessId})` : ''}.
                                        </p>
                                    )}
                                </Card>

                                <Card className="p-4">
                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                        <DeviceIcon className="h-4 w-4 text-primary" /> Device &amp; app
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Device">{user.deviceType}</Field>
                                        <Field label="Country">{user.country}</Field>
                                        <Field label="Language">
                                            {language ? `${language.label} (${language.nativeLabel})` : 'Unknown'}
                                        </Field>
                                        <Field label="App version">
                                            {user.appVersion ? (
                                                <Badge variant={outdated ? 'destructive' : 'default'} className="font-mono text-[10px]">
                                                    v{user.appVersion}{outdated ? ' · outdated' : ''}
                                                </Badge>
                                            ) : 'Unknown'}
                                        </Field>
                                        <Field label="Total usage">{formatDuration(user.totalUsageSeconds ?? 0)}</Field>
                                        <Field label="Page views">{(user.pagesVisited ?? 0).toLocaleString()}</Field>
                                        <Field label="Last page">
                                            {user.lastPage ? <code className="font-mono text-[10px]">{user.lastPage}</code> : null}
                                        </Field>
                                        <Field label="Joined">{joined ? format(joined, 'PP') : null}</Field>
                                    </div>
                                </Card>
                            </div>

                            <Card className="p-4">
                                <h3 className="mb-1 text-sm font-semibold">Permissions</h3>
                                <p className="mb-3 text-xs text-muted-foreground">
                                    Only overrides are stored. Anything not listed falls back to the default for this
                                    user's role.
                                </p>
                                {permissions.length ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {permissions.map(([key, allowed]) => (
                                            <Badge key={key} variant={allowed ? 'secondary' : 'destructive'} className="text-[10px]">
                                                {allowed ? '' : 'no '}{key}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No overrides — full role defaults apply.</p>
                                )}
                            </Card>
                        </TabsContent>

                        <TabsContent value="activity" className="mt-4">
                            <UserUsagePanel user={user} active={visited.has('activity')} />
                        </TabsContent>
                        <TabsContent value="journey" className="mt-4">
                            <JourneySection user={user} active={visited.has('journey')} />
                        </TabsContent>
                        <TabsContent value="sales" className="mt-4">
                            <SalesSection user={user} business={business} active={visited.has('sales')} />
                        </TabsContent>
                        <TabsContent value="audit" className="mt-4">
                            <AuditSection user={user} active={visited.has('audit')} />
                        </TabsContent>
                        <TabsContent value="support" className="mt-4">
                            <SupportSection user={user} active={visited.has('support')} />
                        </TabsContent>
                        <TabsContent value="billing" className="mt-4">
                            <BillingSection user={user} business={business} active={visited.has('billing')} />
                        </TabsContent>
                        <TabsContent value="devices" className="mt-4">
                            <DevicesSection user={user} active={visited.has('devices')} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirm === 'revoke' ? 'Revoke every session?' : 'Confirm action'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirm === 'deactivate' && (
                                <>This marks <strong>{user.name}</strong> inactive so they cannot log in again. Their data is preserved. Any session they already have open stays valid until it expires — revoke sessions to end those now.</>
                            )}
                            {confirm === 'activate' && (
                                <>This reactivates <strong>{user.name}</strong>'s account and lets them log in again.</>
                            )}
                            {confirm === 'revoke' && (
                                <>This signs <strong>{user.name}</strong> out of every device immediately. They can sign back in unless the account is also deactivated.</>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy}
                            className={confirm === 'activate' ? '' : 'bg-destructive hover:bg-destructive/90'}
                            onClick={(e) => {
                                e.preventDefault();
                                if (confirm === 'revoke') handleRevoke();
                                else if (confirm) handleStatus(confirm);
                            }}
                        >
                            {busy ? 'Working…' : confirm === 'revoke' ? 'Revoke' : confirm === 'activate' ? 'Activate' : 'Deactivate'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function UserDetailPage() {
    // useSearchParams needs a Suspense boundary in Next 15, same as every other
    // `?id=` detail page in this app.
    return (
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <UserDetailContent />
        </Suspense>
    );
}
