
'use client';

import * as React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, User, Users, MoreHorizontal, AlertCircle, Trash2, Mail, UserCheck, UserX, Loader2, Globe, Lock } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, deleteDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import type { UserProfile, Invitation } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FeatureGateUpgradeCard } from '@/components/shared/feature-gate';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import AddUserDialog from '@/components/users/add-user-dialog';
import UserPermissionsDialog from '@/components/users/user-permissions-dialog';
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
    Shield,
    ShieldCheck,
    ShieldAlert,
} from "lucide-react";
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
import PageTitle from '@/components/shared/page-title';
import { usePOS } from '@/context/pos-context';
import { staffLimit } from '@/lib/plan';
import { useBranch } from '@/context/branch-context';


/**
 * The per-user actions menu.
 *
 * Extracted so the table (sm and up) and the mobile card list render exactly
 * the same menu — the two layouts show the same data in different shapes, and
 * duplicating this block is how they drift apart.
 */
function UserActionsMenu({
    user,
    currentUserId,
    currentUserProfile,
    openMenuUserId,
    setOpenMenuUserId,
    setUserToUpdate,
    setUserRoleToUpdate,
    setUserPermissionsToUpdate,
}: any) {
    return (
        <DropdownMenu modal={false} open={openMenuUserId === user.id} onOpenChange={(open: boolean) => setOpenMenuUserId(open ? user.id : null)}>
            <DropdownMenuTrigger asChild>
                <Button
                    aria-haspopup="true"
                    size="icon"
                    variant="ghost"
                    disabled={currentUserId === user.id}
                >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {user.status === 'inactive' ? (
                    <DropdownMenuItem className="cursor-pointer" onSelect={() => setUserToUpdate({ user, action: 'activate' })}>
                        <UserCheck className="mr-2 h-4 w-4" /> Activate User
                    </DropdownMenuItem>
                ) : (
                    <>
                        {currentUserProfile?.role === 'admin' && user.role !== 'admin' && (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="cursor-pointer">
                                    <Shield className="mr-2 h-4 w-4" /> Change Role
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuItem
                                            disabled={user.role === 'manager'}
                                            onSelect={() => setUserRoleToUpdate({ user, newRole: 'manager' })}
                                        >
                                            <ShieldCheck className="mr-2 h-4 w-4" /> Manager
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            disabled={user.role === 'vendor_operator'}
                                            onSelect={() => setUserRoleToUpdate({ user, newRole: 'vendor_operator' })}
                                        >
                                            <ShieldAlert className="mr-2 h-4 w-4" /> Vendor Operator
                                        </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                        )}
                        {currentUserProfile?.role === 'admin' && (
                            <DropdownMenuItem className="cursor-pointer" onSelect={() => setUserPermissionsToUpdate(user)}>
                                <Shield className="mr-2 h-4 w-4" /> Manage Permissions
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="cursor-pointer text-destructive" onSelect={() => setUserToUpdate({ user, action: 'deactivate' })}>
                            <UserX className="mr-2 h-4 w-4" /> Deactivate User
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function UserCardSkeleton() {
    return (
        <div className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-8 w-8 shrink-0" />
            </div>
            <div className="mt-2 flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-16" />
            </div>
        </div>
    );
}

function UserRowSkeleton() {
    return (
        <TableRow>
            <TableCell>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 w-full">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-5 w-full" />
            </TableCell>
            <TableCell>
                <Skeleton className="h-6 w-24" />
            </TableCell>
            <TableCell>
                <Skeleton className="h-6 w-24" />
            </TableCell>
            <TableCell className="text-right">
                <Skeleton className="h-8 w-8 ml-auto" />
            </TableCell>
        </TableRow>
    )
}

function UsersPageSkeleton() {
    return (
        <>
            <PageTitle title="User & Staff Management" subtitle="Invite and manage roles for your business." />
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="w-full md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <Skeleton className="h-7 w-64" />
                                <Skeleton className="h-4 w-80 mt-2" />
                            </div>
                            <Skeleton className="h-9 w-28" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 sm:hidden">
                            <UserCardSkeleton />
                            <UserCardSkeleton />
                        </div>
                        <div className="hidden sm:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <UserRowSkeleton />
                                <UserRowSkeleton />
                            </TableBody>
                        </Table>
                        </div>
                    </CardContent>
                </Card>
                <Card className="md:col-span-2">
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-72 mt-2" />
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground p-8">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                        <p className="mt-4">Loading invitations...</p>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function UserManagementDashboard({ businessId, currentUserId, inviterName }: { businessId: string, currentUserId: string, inviterName: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { triggerRefresh } = usePOS();
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = React.useState(false);
    const [invitationToRevoke, setInvitationToRevoke] = React.useState<Invitation | null>(null);
    const [userToUpdate, setUserToUpdate] = React.useState<{ user: UserProfile, action: 'activate' | 'deactivate' } | null>(null);
    const [userRoleToUpdate, setUserRoleToUpdate] = React.useState<{ user: UserProfile, newRole: UserRole } | null>(null);
    const [userPermissionsToUpdate, setUserPermissionsToUpdate] = React.useState<UserProfile | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
    const [isUpdatingRole, setIsUpdatingRole] = React.useState(false);
    const [openMenuUserId, setOpenMenuUserId] = React.useState<string | null>(null);
    const [showProModal, setShowProModal] = React.useState(false);
    const router = useRouter();

    const { business: businessInstance, currentUserProfile, isLoading: isPosLoading, users } = usePOS();
    const { activeBranchId } = useBranch();
    const areUsersLoading = false; // Handled by root lifecycle

    const invitationsQuery = useMemoFirebase(() => {
        if (!businessId || !firestore) return null;
        return query(collection(firestore, 'invitations'), where('businessId', '==', businessId));
    }, [businessId, firestore]);
    const { data: invitations, isLoading: areInvitationsLoading } = useCollection<Invitation>(invitationsQuery);
    const forceRefresh = triggerRefresh; // Bind locally

    const displayInvitations = React.useMemo(() => {
        if (!invitations) return [];
        if (!activeBranchId || activeBranchId === 'all') return invitations;
        return invitations.filter(inv => {
            if (activeBranchId === businessId) {
                return !inv.branchId || inv.branchId === businessId || inv.branchId === 'all';
            }
            return inv.branchId === activeBranchId;
        });
    }, [invitations, activeBranchId, businessId]);

    const isLoading = isPosLoading || areUsersLoading || areInvitationsLoading;

    const staffUsers = React.useMemo(() => {
        if (!users) return [];
        let filtered = users;
        if (activeBranchId && activeBranchId !== 'all') {
            filtered = users.filter(u => {
                if (activeBranchId === businessId) {
                    return !u.branchId || u.branchId === businessId || u.branchId === 'all';
                }
                return u.branchId === activeBranchId;
            });
        }
        // Sort current logged-in user to the top of the list, then sort others alphabetically by name
        return [...filtered].sort((a, b) => {
            if (a.id === currentUserId) return -1;
            if (b.id === currentUserId) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [users, currentUserId, activeBranchId, businessId]);

    const totalUsers = (users?.length || 0) + (invitations?.length || 0);
    const planLimit = staffLimit(businessInstance);
    const isLimitReached = totalUsers >= planLimit;

    const handleRevokeInvitation = async () => {
        if (!invitationToRevoke || !firestore) return;
        const invitationRef = doc(firestore, 'invitations', invitationToRevoke.id);
        try {
            await deleteDoc(invitationRef);
            toast({ title: 'Invitation Revoked', description: `The invitation for ${invitationToRevoke.email} has been revoked.`, variant: 'success' });
            forceRefresh();
        } catch (e) {
            toast({ title: 'Error', description: 'Could not revoke invitation.', variant: 'destructive' });
        } finally {
            setInvitationToRevoke(null);
        }
    };

    const handleUpdateUserStatus = async () => {
        if (!userToUpdate || !firestore) return;
        
        if (!navigator.onLine) {
            toast({
                title: 'Offline',
                description: 'Updating user status requires an internet connection.',
                variant: 'destructive'
            });
            return;
        }

        setIsUpdatingStatus(true);
        const userRef = doc(firestore, 'users', userToUpdate.user.id);
        const newStatus = userToUpdate.action === 'activate' ? 'active' : 'inactive';

        try {
            await updateDoc(userRef, { status: newStatus });
            toast({ title: `User ${userToUpdate.action}d`, description: `${userToUpdate.user.name}'s account has been ${userToUpdate.action}d.`, variant: 'success' });
            triggerRefresh();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message || 'Could not update user status.', variant: 'destructive' });
        } finally {
            setUserToUpdate(null);
            setIsUpdatingStatus(false);
        }
    }

    const handleUpdateUserRole = async () => {
        if (!userRoleToUpdate || !firestore) return;

        if (!navigator.onLine) {
            toast({
                title: 'Offline',
                description: 'Changing user roles requires an internet connection.',
                variant: 'destructive'
            });
            return;
        }

        setIsUpdatingRole(true);
        const userRef = doc(firestore, 'users', userRoleToUpdate.user.id);

        try {
            await updateDoc(userRef, { role: userRoleToUpdate.newRole });
            
            // Send notification to the updated user
            const notifRef = collection(firestore, `users/${userRoleToUpdate.user.id}/notifications`);
            await addDoc(notifRef, {
                title: "Role Access Updated",
                body: `Your access level has been changed to ${userRoleToUpdate.newRole.replace('_', ' ')}. Please refresh your dashboard to see new features.`,
                createdAt: serverTimestamp(),
                read: false,
                type: 'system'
            });

            toast({ 
                title: 'Role Updated', 
                description: `${userRoleToUpdate.user.name}'s role has been changed to ${userRoleToUpdate.newRole.replace('_', ' ')}.`, 
                variant: 'success' 
            });
            triggerRefresh();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message || 'Could not update user role.', variant: 'destructive' });
        } finally {
            setUserRoleToUpdate(null);
            setIsUpdatingRole(false);
        }
    }

    return (
        <>
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="md:col-span-2 border-primary/10 bg-primary/5 shadow-none overflow-hidden">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-semibold">Role Permissions Guide</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            Understand the capabilities and access levels assigned to each role.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <Badge variant="default" className="text-[10px] h-4.5 px-1.5">Admin / Owner</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                <strong>Full Authority:</strong> Can manage business settings, invite staff, change roles, and handle all inventory and financial records.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5">Manager</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                <strong>Operations Lead:</strong> Full inventory management (create, update, delete) and customer records. Restricted from high-level financial reporting and revenue analytics.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 bg-background">Vendor Operator</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                <strong>Store Staff:</strong> Strictly authorized to record sales and manage POS transactions. No access to product creation, stock adjustments, or financial reports.
                            </p>
                        </div>
                        <Separator className="my-2" />
                        <p className="text-[10px] text-muted-foreground italic leading-tight">
                            * Baseline capabilities can be customized or extended for individual staff members using the <strong>Manage Permissions</strong> action in the staff list.
                        </p>
                    </CardContent>
                </Card>

                <Card className="w-full md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Your Staff</CardTitle>
                                <CardDescription>
                                    A list of all users in your business.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                {businessInstance && (
                                    <div className="hidden lg:flex flex-col items-end text-sm">
                                        <span className="font-medium">
                                            {totalUsers} / {planLimit === Infinity ? '∞' : planLimit} Users
                                        </span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-tight">Plan: {businessInstance.plan || 'starter'}</span>
                                    </div>
                                )}
                                <Button 
                                    size="lg" 
                                    className="h-9 gap-1" 
                                    onClick={() => {
                                        if (!businessInstance?.plan || businessInstance?.plan === 'starter') {
                                            setShowProModal(true);
                                        } else {
                                            setIsAddUserDialogOpen(true);
                                        }
                                    }} 
                                    disabled={businessInstance?.plan && businessInstance?.plan !== 'starter' && isLimitReached}
                                >
                                    {(!businessInstance?.plan || businessInstance?.plan === 'starter') ? <Lock className="h-3.5 w-3.5" /> : <PlusCircle className="h-3.5 w-3.5" />}
                                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                        Invite User
                                    </span>
                                    {(!businessInstance?.plan || businessInstance?.plan === 'starter') && (
                                        <div className="ml-1 flex items-center gap-1 bg-primary/20 text-primary text-[9px] uppercase px-1.5 py-0.5 rounded-sm font-bold">
                                            Pro
                                        </div>
                                    )}
                                </Button>
                            </div>
                        </div>
                        {isLimitReached && businessInstance?.plan !== 'starter' && (
                            <Alert variant="warning" className="mt-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Plan Limit Reached</AlertTitle>
                                <AlertDescription>
                                    You have reached the maximum number of users for your current plan. Please upgrade to invite more team members.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <>
                            <div className="grid gap-3 sm:hidden">
                                <UserCardSkeleton />
                                <UserCardSkeleton />
                            </div>
                            <div className="hidden sm:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead className="hidden sm:table-cell">Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <UserRowSkeleton />
                                    <UserRowSkeleton />
                                </TableBody>
                            </Table>
                            </div>
                            </>
                        ) : staffUsers && staffUsers.length > 0 ? (
                            <>
                            {/* Mobile: a card per user. The table below has five
                                columns and cannot fit a phone without scrolling
                                sideways, which hides the Actions column exactly
                                where it is most needed. */}
                            <div className="grid gap-3 sm:hidden">
                                {staffUsers.map((user) => (
                                    <div key={user.id} className="rounded-lg border p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium truncate">{user.name}</p>
                                                {user.email && (
                                                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                                                )}
                                            </div>
                                            <div className="shrink-0 -mr-2 -mt-1">
                                                <UserActionsMenu
                                                    user={user}
                                                    currentUserId={currentUserId}
                                                    currentUserProfile={currentUserProfile}
                                                    openMenuUserId={openMenuUserId}
                                                    setOpenMenuUserId={setOpenMenuUserId}
                                                    setUserToUpdate={setUserToUpdate}
                                                    setUserRoleToUpdate={setUserRoleToUpdate}
                                                    setUserPermissionsToUpdate={setUserPermissionsToUpdate}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                                                {user.role.replace('_', ' ')}
                                            </Badge>
                                            <Badge variant={user.status === 'inactive' ? 'destructive' : 'outline'} className="capitalize">
                                                {user.status || 'active'}
                                            </Badge>
                                            {currentUserId === user.id && (
                                                <span className="text-xs text-muted-foreground">You</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="hidden sm:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead className="hidden sm:table-cell">Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead><span className='sr-only'>Actions</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {staffUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="font-medium">{user.name}</div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                                                    {user.role.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={user.status === 'inactive' ? 'destructive' : 'outline'} className="capitalize">
                                                    {user.status || 'active'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <UserActionsMenu
                                                    user={user}
                                                    currentUserId={currentUserId}
                                                    currentUserProfile={currentUserProfile}
                                                    openMenuUserId={openMenuUserId}
                                                    setOpenMenuUserId={setOpenMenuUserId}
                                                    setUserToUpdate={setUserToUpdate}
                                                    setUserRoleToUpdate={setUserRoleToUpdate}
                                                    setUserPermissionsToUpdate={setUserPermissionsToUpdate}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center p-12 border-2 border-dashed rounded-lg">
                                <User className="h-12 w-12 text-muted-foreground" />
                                <h3 className="text-xl font-semibold mt-4">No Staff Found</h3>
                                <p className="text-muted-foreground mt-2 mb-4">Invite your first team member to get started.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Pending Invitations</CardTitle>
                        <CardDescription>These users have been invited but have not yet signed up.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="p-4 text-center text-muted-foreground">Loading invitations...</div>
                        ) : displayInvitations && displayInvitations.length > 0 ? (
                            <>
                            {/* Mobile: card per invitation, same reasoning as the staff list. */}
                            <div className="grid gap-3 sm:hidden">
                                {displayInvitations.map(invitation => (
                                    <div key={invitation.id} className="rounded-lg border p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium truncate">{invitation.email}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Invited {invitation.createdAt ? formatDistanceToNow(invitation.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                                                </p>
                                            </div>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="shrink-0"
                                                onClick={() => setInvitationToRevoke(invitation)}
                                                aria-label={`Revoke invitation for ${invitation.email}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="mt-2">
                                            <Badge variant="outline" className="capitalize">{invitation.role.replace('_', ' ')}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="hidden sm:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Invited</TableHead>
                                        <TableHead><span className="sr-only">Actions</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayInvitations.map(invitation => (
                                        <TableRow key={invitation.id}>
                                            <TableCell className="font-medium">{invitation.email}</TableCell>
                                            <TableCell><Badge variant="outline" className="capitalize">{invitation.role.replace('_', ' ')}</Badge></TableCell>
                                            <TableCell className="text-muted-foreground">{invitation.createdAt ? formatDistanceToNow(invitation.createdAt.toDate(), { addSuffix: true }) : 'Just now'}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="destructive" size="sm" onClick={() => setInvitationToRevoke(invitation)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                            </>
                        ) : (
                            <div className="text-center text-muted-foreground p-8">
                                <Mail className="mx-auto h-12 w-12 opacity-50" />
                                <p className="mt-4">No pending invitations.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {businessId && (
                <AddUserDialog
                    isOpen={isAddUserDialogOpen}
                    onOpenChange={setIsAddUserDialogOpen}
                    businessId={businessId}
                    businessName={businessInstance?.name || ''}
                    inviterName={inviterName}
                    onSuccess={forceRefresh}
                    currentUserCount={users?.length || 0}
                    pendingInvitationCount={invitations?.length || 0}
                />
            )}

            <UserPermissionsDialog
                isOpen={!!userPermissionsToUpdate}
                onOpenChange={(open) => !open && setUserPermissionsToUpdate(null)}
                user={userPermissionsToUpdate}
                onSuccess={forceRefresh}
            />

            <AlertDialog open={!!invitationToRevoke} onOpenChange={(open) => !open && setInvitationToRevoke(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will revoke the invitation for <strong>{invitationToRevoke?.email}</strong>. They will not be able to join your business unless you invite them again.</AlertDialogDescription>
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
                                ? <>This will mark <strong>{userToUpdate?.user?.name}</strong> as inactive, and they will not be able to log in. Their data will be preserved.</>
                                : <>This will reactivate <strong>{userToUpdate?.user?.name}</strong>'s account, allowing them to log in again.</>
                            }
                            <span className="mt-4 text-amber-600 font-medium flex items-center gap-1.5 text-xs">
                                <Globe className="h-3.5 w-3.5" />
                                This action requires an active internet connection.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isUpdatingStatus}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUpdateUserStatus} disabled={isUpdatingStatus} className={userToUpdate?.action === 'deactivate' ? 'bg-destructive hover:bg-destructive/90' : ''}>
                            {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {userToUpdate?.action === 'deactivate' ? 'Deactivate' : 'Activate'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!userRoleToUpdate} onOpenChange={(open) => !open && setUserRoleToUpdate(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change User Role</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to change <strong>{userRoleToUpdate?.user?.name}</strong>&apos;s role to <strong>{userRoleToUpdate?.newRole.replace('_', ' ')}</strong>?
                            <br /><br />
                            <span className="text-amber-600 font-medium flex items-center gap-1.5 text-xs">
                                <Globe className="h-3.5 w-3.5" />
                                This action requires an active internet connection.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isUpdatingRole}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUpdateUserRole} disabled={isUpdatingRole}>
                            {isUpdatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Change Role
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={showProModal} onOpenChange={setShowProModal}>
                <DialogContent className="max-w-lg p-0 bg-transparent border-none shadow-none">
                    <FeatureGateUpgradeCard
                        featureName="Staff Management"
                        featureDescription="Invite team members and manage role-based access control for your business."
                        requiredPlan="pro"
                        icon={Users}
                        featurePoints={[
                            { title: "Team Collaboration", description: "Invite staff to help manage your business operations." },
                            { title: "Role-Based Access", description: "Assign specific permissions (Cashier, Manager, Admin) to control access." },
                            { title: "Audit Accountability", description: "Track which staff member performed specific actions in the POS." }
                        ]}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

export default function UsersPage() {
    const { currentUserProfile: currentUser, business, isLoading: isPosLoading } = usePOS();
    const isLoading = isPosLoading || !currentUser?.businessId;

    if (isLoading) {
        return <UsersPageSkeleton />;
    }

    if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
        return (
            <>
                <PageTitle title="User & Staff Management" subtitle="Invite and manage roles for your business." />
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>
                        You do not have the required permissions to manage users. Please contact your business administrator.
                    </AlertDescription>
                </Alert>
            </>
        );
    }

    return (
        <>
            <PageTitle title="User & Staff Management" subtitle="Invite and manage roles for your business." />
            <UserManagementDashboard businessId={currentUser.businessId} currentUserId={currentUser.id} inviterName={currentUser.name} />
        </>
    );
}
