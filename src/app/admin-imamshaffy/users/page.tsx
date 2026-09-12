'use client';

/**
 * Platform user directory.
 *
 * Despite living beside the tenant staff screens, this page has always listed
 * *every* user on Zeneva — its users query is unscoped and the page is gated to
 * the platform owner. It is now built for that job: search, segment filters and
 * a row-click through to the per-user detail page.
 *
 * Read cost: two collection reads for the whole page (`users` +
 * `businessInstances`), joined in memory. Everything deeper is deferred to the
 * detail page, so browsing the directory costs the same whether the platform has
 * ten users or ten thousand.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PlusCircle,
  User,
  MoreHorizontal,
  AlertCircle,
  Trash2,
  Mail,
  UserCheck,
  UserX,
  Search,
  Download,
  ChevronRight,
  Laptop,
  Smartphone,
  Globe,
} from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, query, where, deleteDoc, runTransaction } from 'firebase/firestore';
import type { UserProfile, Invitation, BusinessInstance } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AddUserDialog from '@/components/users/add-user-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppConfig } from '@/lib/config';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
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
import { downloadCsv } from '@/lib/csv';
import { UserPresence, formatDuration, toDate } from '@/components/admin/user-detail/user-primitives';
import {
  businessIndex,
  planOf,
  segmentOf,
  segmentCounts,
  SEGMENT_LABELS,
  SEGMENT_BADGE_CLASS,
  type UserSegment,
} from '@/components/admin/user-detail/user-segments';
import { useDeferredMobileRender } from '@/hooks/use-deferred-render';

function useCurrentUserProfile() {
  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading } = useDoc<UserProfile>(userDocRef);

  return { profile: userProfile, isLoading };
}

const UserPlatformsBadges = ({ user }: { user: UserProfile }) => {
  const platforms = user.platformsUsed && user.platformsUsed.length > 0
    ? user.platformsUsed
    : user.deviceType ? [user.deviceType] : [];

  if (!platforms.length) return <span className="text-muted-foreground">—</span>;

  const ua = (user.userAgent || '').toLowerCase();
  const hasDesktop = platforms.some(p => {
    const s = String(p).toLowerCase();
    return s.includes('desktop') || s.includes('microsoft') || s.includes('windows');
  }) || (ua.includes('windows') && (ua.includes('tauri') || user.deviceType === 'Desktop App'));

  const hasMobile = platforms.some(p => {
    const s = String(p).toLowerCase();
    return s.includes('mobile app') || s.includes('android') || s.includes('ios');
  }) || ((ua.includes('android') || ua.includes('iphone') || ua.includes('mobile')) && (ua.includes('tauri') || user.deviceType === 'Mobile App'));

  const hasWeb = platforms.some(p => {
    const s = String(p).toLowerCase();
    return s.includes('web') && !s.includes('desktop app');
  }) || (!hasDesktop && !hasMobile);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-1">
        {hasDesktop && (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400" title="Microsoft / Windows App">
            <Laptop className="h-3 w-3" /> Microsoft App
          </span>
        )}
        {hasMobile && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400" title="Mobile App (Android/iOS)">
            <Smartphone className="h-3 w-3" /> Mobile App
          </span>
        )}
        {hasWeb && (
          <span className="inline-flex items-center gap-1 rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400" title="Web Browser">
            <Globe className="h-3 w-3" /> Web
          </span>
        )}
      </div>
      {hasDesktop && hasMobile && (
        <span className="text-[9px] font-bold text-amber-500">⚡ Cross-Device (PC + Mobile)</span>
      )}
    </div>
  );
};

const DeviceIcon = ({ device }: { device?: string | null }) => {
  const d = (device || '').toLowerCase();
  const Icon = d.includes('desktop')
    ? Laptop
    : d.includes('mobile')
    ? Smartphone
    : Globe;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={device || 'Web'}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{device || 'Web'}</span>
    </span>
  );
};

const StatTile = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <Card className="p-3">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
    {hint && <p className="mt-1 truncate text-[10px] text-muted-foreground">{hint}</p>}
  </Card>
);

// Kept in one place so the skeleton and the loaded table cannot drift apart —
// they had, which is what made the loading state's columns misalign.
const COLUMNS = [
  { key: 'user', label: 'User', className: 'min-w-[200px]' },
  { key: 'business', label: 'Business', className: 'hidden md:table-cell min-w-[160px]' },
  { key: 'role', label: 'Role', className: 'min-w-[100px]' },
  { key: 'plan', label: 'Plan', className: 'hidden lg:table-cell min-w-[90px]' },
  { key: 'usage', label: 'Usage', className: 'hidden xl:table-cell min-w-[90px]' },
  { key: 'seen', label: 'Last active', className: 'hidden sm:table-cell min-w-[140px]' },
  { key: 'segment', label: 'Segment', className: 'hidden lg:table-cell min-w-[100px]' },
  { key: 'status', label: 'Status', className: 'min-w-[90px]' },
  { key: 'device', label: 'Device', className: 'hidden xl:table-cell min-w-[130px]' },
  { key: 'version', label: 'Version', className: 'hidden lg:table-cell min-w-[120px]' },
  { key: 'actions', label: '', className: 'w-[80px] text-right' },
];

function UserTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        {COLUMNS.map(c => (
          <TableHead key={c.key} className={c.className}>
            {c.label || <span className="sr-only">Actions</span>}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function UserRowSkeleton() {
  return (
    <TableRow>
      {COLUMNS.map(c => (
        <TableCell key={c.key} className={c.className}>
          <Skeleton className="h-5 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export default function UsersPage() {
  const { profile: currentUser, isLoading: isProfileLoading } = useCurrentUserProfile();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = React.useState(false);
  const shouldRenderRows = useDeferredMobileRender(80);
  const [invitationToRevoke, setInvitationToRevoke] = React.useState<Invitation | null>(null);
  const [userToUpdate, setUserToUpdate] = React.useState<{ user: UserProfile; action: 'activate' | 'deactivate' } | null>(null);

  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [planFilter, setPlanFilter] = React.useState('all');
  const [segmentFilter, setSegmentFilter] = React.useState('all');
  const [platformFilter, setPlatformFilter] = React.useState('all');
  const [sortBy, setSortBy] = React.useState<'active' | 'joined' | 'name' | 'usage'>('active');

  // UI gate only; src/actions/admin-guard.ts is the real one, and firestore.rules
  // is what actually stops a non-owner reading this collection.
  const canManageUsers = currentUser?.id === 'jzQgCHzaObeUbeYklTLtQQh03G53' ||
                         currentUser?.email === 'belloimam431@gmail.com';

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !canManageUsers) return null;
    return query(collection(firestore, 'users'));
  }, [canManageUsers, firestore]);
  // `useCollection` is a live onSnapshot listener, so status writes below reflect
  // themselves — there is no refetch to call.
  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  // One read for every business, joined in memory below. A per-user lookup would
  // be one read per row, which is exactly what this page must not do.
  const businessesQuery = useMemoFirebase(() => {
    if (!firestore || !canManageUsers) return null;
    return query(collection(firestore, 'businessInstances'));
  }, [canManageUsers, firestore]);
  const { data: businesses, isLoading: areBusinessesLoading } = useCollection<BusinessInstance>(businessesQuery);

  const invitationsQuery = useMemoFirebase(() => {
    if (!currentUser?.businessId || !firestore) return null;
    return query(collection(firestore, 'invitations'), where('businessId', '==', currentUser.businessId));
  }, [currentUser?.businessId, firestore]);
  const { data: invitations, isLoading: areInvitationsLoading } = useCollection<Invitation>(invitationsQuery);

  const isLoading = isProfileLoading || areUsersLoading || areBusinessesLoading || areInvitationsLoading;

  const bizIndex = React.useMemo(() => businessIndex(businesses), [businesses]);

  const [accountTypeFilter, setAccountTypeFilter] = React.useState<'all' | 'registered' | 'incomplete'>('all');

  const summary = React.useMemo(() => {
    const all = users ?? [];
    const registered = all.filter(u => Boolean(u.email || u.name || u.phone));
    const incomplete = all.filter(u => !u.email && !u.name && !u.phone);
    const counts = segmentCounts(registered);
    const curVersion = (AppConfig.version || '').replace(/^v/i, '').trim();
    const upgraded = all.filter(u => {
      const v = (u.appVersion || '').replace(/^v/i, '').trim();
      return Boolean(v) && v === curVersion;
    }).length;
    const outdated = all.filter(u => {
      const v = (u.appVersion || '').replace(/^v/i, '').trim();
      return Boolean(v) && v !== 'unknown' && v !== curVersion;
    }).length;
    const blocked = all.filter(u => u.status === 'inactive' || u.status === 'suspended').length;
    
    const conversionRate = all.length > 0 ? (registered.length / all.length) * 100 : 0;
    const abandonmentRate = all.length > 0 ? (incomplete.length / all.length) * 100 : 0;

    const microsoftCount = all.filter(u => {
      const p = (u.platformsUsed || []).map(x => String(x).toLowerCase());
      const ua = (u.userAgent || '').toLowerCase();
      return p.some(x => x.includes('desktop') || x.includes('microsoft') || x.includes('windows')) || u.deviceType === 'Desktop App' || (ua.includes('windows') && ua.includes('tauri'));
    }).length;

    const mobileCount = all.filter(u => {
      const p = (u.platformsUsed || []).map(x => String(x).toLowerCase());
      const ua = (u.userAgent || '').toLowerCase();
      return p.some(x => x.includes('mobile app') || x.includes('android') || x.includes('ios')) || u.deviceType === 'Mobile App' || ((ua.includes('android') || ua.includes('iphone')) && ua.includes('tauri'));
    }).length;

    const multiCount = all.filter(u => {
      const p = (u.platformsUsed || []).map(x => String(x).toLowerCase());
      const ua = (u.userAgent || '').toLowerCase();
      const hasD = p.some(x => x.includes('desktop') || x.includes('microsoft') || x.includes('windows')) || u.deviceType === 'Desktop App' || (ua.includes('windows') && ua.includes('tauri'));
      const hasM = p.some(x => x.includes('mobile app') || x.includes('android') || x.includes('ios')) || u.deviceType === 'Mobile App' || ((ua.includes('android') || ua.includes('iphone')) && ua.includes('tauri'));
      return hasD && hasM;
    }).length;

    const webCount = all.length - (all.filter(u => {
      const p = (u.platformsUsed || []).map(x => String(x).toLowerCase());
      const ua = (u.userAgent || '').toLowerCase();
      return p.some(x => x.includes('desktop') || x.includes('microsoft') || x.includes('windows') || x.includes('mobile app')) || u.deviceType === 'Desktop App' || u.deviceType === 'Mobile App';
    }).length);
    
    return { 
      total: all.length, 
      registeredCount: registered.length, 
      incompleteCount: incomplete.length, 
      conversionRate,
      abandonmentRate,
      counts, 
      upgraded,
      outdated, 
      blocked,
      microsoftCount,
      mobileCount,
      multiCount,
      webCount
    };
  }, [users]);

  const visibleUsers = React.useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = (users ?? []).filter(u => {
      const isRegistered = Boolean(u.email || u.name || u.phone);
      if (accountTypeFilter === 'registered' && !isRegistered) return false;
      if (accountTypeFilter === 'incomplete' && isRegistered) return false;

      if (roleFilter !== 'all' && (u.role || 'vendor_operator') !== roleFilter) return false;
      if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false;
      if (planFilter !== 'all' && planOf(u, bizIndex).toLowerCase() !== planFilter) return false;
      if (segmentFilter !== 'all' && segmentOf(u) !== segmentFilter) return false;

      if (platformFilter !== 'all') {
        const v = (u.appVersion || '').replace(/^v/i, '').trim();
        const cur = (AppConfig.version || '').replace(/^v/i, '').trim();
        if (platformFilter === 'latest') {
          if (!v || v !== cur) return false;
        } else if (platformFilter === 'outdated') {
          if (!v || v === 'unknown' || v === cur) return false;
        } else {
          const platforms = (u.platformsUsed && u.platformsUsed.length > 0 ? u.platformsUsed : u.deviceType ? [u.deviceType] : []).map(p => String(p).toLowerCase());
          const ua = (u.userAgent || '').toLowerCase();
          const hasDesktop = platforms.some(p => p.includes('desktop') || p.includes('microsoft') || p.includes('windows')) || (ua.includes('windows') && (ua.includes('tauri') || u.deviceType === 'Desktop App'));
          const hasMobile = platforms.some(p => p.includes('mobile app') || p.includes('android') || p.includes('ios')) || ((ua.includes('android') || ua.includes('iphone') || ua.includes('mobile')) && (ua.includes('tauri') || u.deviceType === 'Mobile App'));
          const hasWeb = platforms.some(p => p.includes('web') && !p.includes('desktop app')) || (!hasDesktop && !hasMobile);

          if (platformFilter === 'microsoft' && !hasDesktop) return false;
          if (platformFilter === 'mobile' && !hasMobile) return false;
          if (platformFilter === 'multi' && (!hasDesktop || !hasMobile)) return false;
          if (platformFilter === 'web' && (!hasWeb || hasDesktop || hasMobile)) return false;
        }
      }

      if (!term) return true;
      const business = u.businessId ? bizIndex.get(u.businessId) : undefined;
      return (
        (u.name || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term) ||
        (u.phone || '').toLowerCase().includes(term) ||
        (business?.name || '').toLowerCase().includes(term) ||
        (!isRegistered && 'incomplete signup'.includes(term))
      );
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'usage') return (b.totalUsageSeconds ?? 0) - (a.totalUsageSeconds ?? 0);
      if (sortBy === 'name') return (a.name || 'Incomplete Signup').localeCompare(b.name || 'Incomplete Signup');
      const key = sortBy === 'joined' ? 'createdAt' : 'lastSeen';
      return (toDate((b as any)[key])?.getTime() ?? 0) - (toDate((a as any)[key])?.getTime() ?? 0);
    });
  }, [users, accountTypeFilter, bizIndex, search, roleFilter, statusFilter, planFilter, segmentFilter, platformFilter, sortBy]);

  const handleExport = () => {
    const rows = [
      ['Name', 'Email', 'Phone', 'Business', 'Role', 'Plan', 'Status', 'Segment',
       'Total usage (s)', 'Page views', 'Last seen', 'Joined', 'Device', 'Country', 'Language', 'App version', 'User ID'],
      ...visibleUsers.map(u => {
        const business = u.businessId ? bizIndex.get(u.businessId) : undefined;
        const seen = toDate(u.lastSeen);
        const joined = toDate(u.createdAt);
        return [
          u.name, u.email, u.phone, business?.name, u.role, planOf(u, bizIndex),
          u.status || 'active', SEGMENT_LABELS[segmentOf(u)],
          u.totalUsageSeconds ?? 0, u.pagesVisited ?? 0,
          seen ? seen.toISOString() : '', joined ? joined.toISOString() : '',
          u.deviceType, u.country, u.language, u.appVersion, u.id,
        ];
      }),
    ];
    downloadCsv(`zeneva-users-${format(new Date(), 'yyyy-MM-dd')}.csv`, rows);
    toast({ title: 'Export started', description: `${visibleUsers.length} users written to CSV.` });
  };

  const handleRevokeInvitation = async () => {
    if (!invitationToRevoke || !firestore) return;
    const invitationRef = doc(firestore, 'invitations', invitationToRevoke.id);
    try {
      await deleteDoc(invitationRef);
      toast({ title: 'Invitation Revoked', description: `The invitation for ${invitationToRevoke.email} has been revoked.`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not revoke invitation.', variant: 'destructive' });
    } finally {
      setInvitationToRevoke(null);
    }
  };

  const handleUpdateUserStatus = async () => {
    if (!userToUpdate || !firestore) return;
    const userRef = doc(firestore, 'users', userToUpdate.user.id);
    const newStatus = userToUpdate.action === 'activate' ? 'active' : 'inactive';

    try {
      await runTransaction(firestore, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error('User does not exist.');
        transaction.update(userRef, { status: newStatus });
      });
      toast({ title: `User ${userToUpdate.action}d`, description: `${userToUpdate.user.name}'s account has been ${userToUpdate.action}d.`, variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Could not update user status.', variant: 'destructive' });
    } finally {
      setUserToUpdate(null);
    }
  };

  const openUser = (id: string) => router.push(`/admin-imamshaffy/users/detail?id=${encodeURIComponent(id)}`);

  return (
    <>
      <div className="grid gap-6">
        <Card className="w-full">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Platform Users</CardTitle>
                <CardDescription>
                  Every account on Zeneva. Select a user to see their full history.
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={handleExport} disabled={!visibleUsers.length}>
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden whitespace-nowrap sm:inline">Export CSV</span>
                </Button>
                <Button size="sm" className="h-9 gap-1" disabled={!canManageUsers} onClick={() => setIsAddUserDialogOpen(true)}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">Invite User</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {!canManageUsers && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Permission Denied</AlertTitle>
                <AlertDescription>
                  You do not have permission to manage users. Please contact your business administrator.
                </AlertDescription>
              </Alert>
            )}

            {canManageUsers && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  <StatTile label="Total accounts" value={summary.total.toLocaleString()} hint={`${summary.registeredCount} registered · ${summary.incompleteCount} visitors`} />
                  <StatTile label="Registered" value={`${summary.registeredCount.toLocaleString()} (${summary.conversionRate.toFixed(1)}%)`} hint="Completion rate" />
                  <StatTile label={`Upgraded (v${AppConfig.version})`} value={summary.upgraded.toLocaleString()} hint={`${summary.outdated} on older builds`} />
                  <StatTile label="Incomplete" value={`${summary.incompleteCount.toLocaleString()} (${summary.abandonmentRate.toFixed(1)}%)`} hint="Drop-off rate" />
                  <StatTile label="Power users" value={summary.counts.power} hint="Active 7d, 5h+ total" />
                  <StatTile label="Active" value={summary.counts.active} hint="Seen in last 7 days" />
                  <StatTile label="At risk" value={summary.counts.at_risk} hint="Quiet 8–30 days" />
                  <StatTile label="Dormant" value={summary.counts.dormant} hint="Quiet 30+ days" />
                </div>

                {/* One filter row, scoping the table and the export below it. */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search name, email, phone or business…"
                      className="h-9 pl-8 text-sm"
                      aria-label="Search users"
                    />
                  </div>
                  <Select value={accountTypeFilter} onValueChange={(v) => setAccountTypeFilter(v as any)}>
                    <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Account Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All accounts ({summary.total})</SelectItem>
                      <SelectItem value="registered">Registered ({summary.registeredCount})</SelectItem>
                      <SelectItem value="incomplete">Incomplete ({summary.incompleteCount})</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                    <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Segment" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All segments</SelectItem>
                      {(Object.keys(SEGMENT_LABELS) as UserSegment[]).map(s => (
                        <SelectItem key={s} value={s}>{SEGMENT_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="vendor_operator">Operator</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      {/* Written by the Cyber Shield hard-kill. */}
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="deleted">Deleted</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue placeholder="Plan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All plans</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue placeholder="Platform / Version" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Devices & Versions</SelectItem>
                      <SelectItem value="latest">🚀 Upgraded to v{AppConfig.version} ({summary.upgraded})</SelectItem>
                      <SelectItem value="outdated">⚠️ Outdated App ({summary.outdated})</SelectItem>
                      <SelectItem value="microsoft">🪟 Microsoft App ({summary.microsoftCount})</SelectItem>
                      <SelectItem value="mobile">📱 Mobile App ({summary.mobileCount})</SelectItem>
                      <SelectItem value="multi">⚡ Cross-Device ({summary.multiCount})</SelectItem>
                      <SelectItem value="web">🌐 Web Browser</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Last active</SelectItem>
                      <SelectItem value="joined">Date joined</SelectItem>
                      <SelectItem value="usage">Most usage</SelectItem>
                      <SelectItem value="name">Name A–Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-xs text-muted-foreground">
                  Showing {visibleUsers.length.toLocaleString()} of {summary.total.toLocaleString()} users
                  {summary.outdated > 0 && ` · ${summary.outdated} on an outdated app version`}
                </p>
              </>
            )}

            {isLoading ? (
              <div className="w-full overflow-x-auto">
                <Table>
                  <UserTableHeader />
                  <TableBody>
                    <UserRowSkeleton />
                    <UserRowSkeleton />
                    <UserRowSkeleton />
                  </TableBody>
                </Table>
              </div>
            ) : visibleUsers.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <Table>
                  <UserTableHeader />
                  <TableBody>
                    {shouldRenderRows ? (
                      visibleUsers.map((user) => {
                      const business = user.businessId ? bizIndex.get(user.businessId) : undefined;
                      const segment = segmentOf(user);
                      const outdated = !!user.appVersion && user.appVersion !== AppConfig.version;
                      return (
                        <TableRow
                          key={user.id}
                          className="cursor-pointer"
                          onClick={() => openUser(user.id)}
                          tabIndex={0}
                          role="link"
                          aria-label={`Open ${user.name}'s profile`}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openUser(user.id); }
                          }}
                        >
                          <TableCell>
                            <div className="font-medium flex items-center gap-1.5">
                              {user.name || business?.name || <span className="text-amber-600 dark:text-amber-400 font-semibold">Incomplete Signup</span>}
                              {!user.name && !business?.name && !user.email && (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200">
                                  Visitor
                                </Badge>
                              )}
                            </div>
                            <div className="break-all text-xs text-muted-foreground flex items-center gap-1.5">
                              {user.email || <span className="italic opacity-60">No email provided</span>}
                              {user.authProvider === 'google' && (
                                <span title="Signed up with Google" className="inline-flex items-center gap-0.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-zinc-600 dark:text-zinc-300 shrink-0">
                                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 shrink-0" aria-hidden><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.53z"/></svg>
                                  Google
                                </span>
                              )}
                            </div>
                            {/* Columns that drop out by breakpoint are restated
                                here so nothing is lost on a narrow screen. */}
                            <div className="mt-0.5 text-xs text-muted-foreground md:hidden">
                              {business?.name || (user.onboardingStep ? `Onboarding (Step ${user.onboardingStep})` : (user.email ? 'No business' : 'Pending Signup'))}
                              <span className="sm:hidden">
                                {' · '}
                                {toDate(user.lastSeen)
                                  ? formatDistanceToNow(toDate(user.lastSeen)!, { addSuffix: true })
                                  : 'Never'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm">{business?.name || <span className="text-muted-foreground">{user.onboardingStep ? `Onboarding (Step ${user.onboardingStep})` : (user.email ? '—' : 'Pending Signup')}</span>}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={(user.role || 'vendor_operator') === 'admin' ? 'default' : 'secondary'} className="whitespace-nowrap capitalize">
                              {(user.role || 'operator').replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs capitalize">{planOf(user, bizIndex)}</span>
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-xs tabular-nums xl:table-cell">
                            {formatDuration(user.totalUsageSeconds ?? 0)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <UserPresence lastSeen={user.lastSeen} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="outline" className={`whitespace-nowrap text-[10px] ${SEGMENT_BADGE_CLASS[segment]}`}>
                              {SEGMENT_LABELS[segment]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.status === 'inactive' || user.status === 'suspended' ? 'destructive' : 'outline'}
                              className="capitalize"
                            >
                              {user.status || 'active'}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <DeviceIcon device={user.deviceType} />
                            {user.country && <div className="text-[10px] text-muted-foreground">{user.country}</div>}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {user.appVersion ? (
                              <Badge 
                                variant="outline" 
                                className={
                                  outdated 
                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono text-[10px] whitespace-nowrap font-semibold" 
                                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] whitespace-nowrap font-bold"
                                }
                              >
                                {outdated ? '⚠️' : '✓'} v{user.appVersion} {outdated ? '· Outdated' : '· Latest'}
                              </Badge>
                            ) : (
                              <span className="text-xs italic text-muted-foreground">Web</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    aria-haspopup="true"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    disabled={!canManageUsers || currentUser?.id === user.id}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions for {user.name}</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem className="cursor-pointer" onSelect={() => openUser(user.id)}>
                                    <User className="mr-2 h-4 w-4" /> View full profile
                                  </DropdownMenuItem>
                                  {user.status === 'inactive' || user.status === 'suspended' ? (
                                    <DropdownMenuItem className="cursor-pointer" onSelect={(e) => { e.preventDefault(); setUserToUpdate({ user, action: 'activate' }); }}>
                                      <UserCheck className="mr-2 h-4 w-4" /> Activate user
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem className="cursor-pointer" onSelect={(e) => { e.preventDefault(); setUserToUpdate({ user, action: 'deactivate' }); }}>
                                      <UserX className="mr-2 h-4 w-4" /> Deactivate user
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <>
                      <UserRowSkeleton />
                      <UserRowSkeleton />
                      <UserRowSkeleton />
                    </>
                  )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
                <User className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold">
                  {summary.total > 0 ? 'No users match these filters' : 'No users found'}
                </h3>
                <p className="mb-4 mt-2 text-muted-foreground">
                  {summary.total > 0
                    ? 'Try clearing the search or widening a filter.'
                    : 'Invite your first team member to get started.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {canManageUsers && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                Invited to your own business and not yet signed up. This card is scoped to your
                business, not the whole platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {areInvitationsLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading invitations...</div>
              ) : invitations && invitations.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Email</TableHead>
                        <TableHead className="min-w-[110px]">Role</TableHead>
                        <TableHead className="hidden min-w-[130px] sm:table-cell">Invited</TableHead>
                        <TableHead className="w-[60px] text-right"><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map(invitation => (
                        <TableRow key={invitation.id}>
                          <TableCell className="break-all font-medium">
                            {invitation.email}
                            <div className="text-xs font-normal text-muted-foreground sm:hidden">
                              {toDate(invitation.createdAt)
                                ? formatDistanceToNow(toDate(invitation.createdAt)!, { addSuffix: true })
                                : 'Just now'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="whitespace-nowrap capitalize">{invitation.role.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                            {toDate(invitation.createdAt)
                              ? formatDistanceToNow(toDate(invitation.createdAt)!, { addSuffix: true })
                              : 'Just now'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="destructive" size="sm" onClick={() => setInvitationToRevoke(invitation)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Revoke invitation for {invitation.email}</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Mail className="mx-auto h-12 w-12 opacity-50" />
                  <p className="mt-4">No pending invitations.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {currentUser?.businessId && (
        <AddUserDialog
          isOpen={isAddUserDialogOpen}
          onOpenChange={setIsAddUserDialogOpen}
          businessId={currentUser.businessId}
          businessName={bizIndex.get(currentUser.businessId)?.name || ''}
          inviterName={currentUser.name}
          // `users` is the platform-wide collection, so count this business's own
          // members rather than every user on Zeneva — otherwise the plan seat
          // limit trips for everyone.
          currentUserCount={(users || []).filter(u => u.businessId === currentUser.businessId).length}
          pendingInvitationCount={invitations?.length || 0}
        />
      )}

      <AlertDialog open={!!invitationToRevoke} onOpenChange={(open) => !open && setInvitationToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke the invitation for <strong>{invitationToRevoke?.email}</strong>. They will not be able to join your business unless you invite them again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeInvitation} className="bg-destructive hover:bg-destructive/90">Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToUpdate} onOpenChange={(open) => !open && setUserToUpdate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              {userToUpdate?.action === 'deactivate'
                ? <>This will mark <strong>{userToUpdate?.user.name}</strong> as inactive, and they will not be able to log in. Their data will be preserved.</>
                : <>This will reactivate <strong>{userToUpdate?.user.name}</strong>'s account, allowing them to log in again.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdateUserStatus} className={userToUpdate?.action === 'deactivate' ? 'bg-destructive hover:bg-destructive/90' : ''}>
              {userToUpdate?.action === 'deactivate' ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
