
'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { UserProfile } from '@/types';
import { Loader2, Shield, FileText, Trash2, Download, HardDrive, Building, Users, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PermissionItem {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const PERMISSIONS: PermissionItem[] = [
    {
        id: 'edit_documents',
        label: 'Create & Edit Documents',
        description: 'Ability to create, edit, and collaborate on Word, Excel, and PDF files.',
        icon: <FileText className="h-4 w-4" />
    },
    {
        id: 'delete_documents',
        label: 'Delete Documents',
        description: 'Permission to delete documents or purge items from the workspace trash.',
        icon: <Trash2 className="h-4 w-4" />
    },
    {
        id: 'export_documents',
        label: 'Export & Convert (OCR)',
        description: 'Export files, run AI document conversion, and OCR processing.',
        icon: <Download className="h-4 w-4" />
    },
    {
        id: 'manage_drive',
        label: 'Manage ZenDrive Storage',
        description: 'Upload, organize, and manage shared cloud workspace files.',
        icon: <HardDrive className="h-4 w-4" />
    },
    {
        id: 'manage_workspace',
        label: 'Manage Workspace Settings',
        description: 'Configure workspace branding, localization, and system preferences.',
        icon: <Building className="h-4 w-4" />
    },
    {
        id: 'manage_users',
        label: 'Manage Team Members',
        description: 'Invite new collaborators, update roles, and manage permissions.',
        icon: <Users className="h-4 w-4" />
    },
    {
        id: 'view_audit_logs',
        label: 'View Audit Logs',
        description: 'Inspect full audit trails of document modifications and security events.',
        icon: <History className="h-4 w-4" />
    },
];

interface UserPermissionsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    user: UserProfile | null;
    onSuccess?: () => void;
}

export default function UserPermissionsDialog({ isOpen, onOpenChange, user, onSuccess }: UserPermissionsDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    const [permissions, setPermissions] = React.useState<Record<string, boolean>>({});

    const getInitialValue = (permissionId: string, role: string) => {
        // Define default capabilities based on role
        const defaults: Record<string, string[]> = {
            edit_documents: ['admin', 'manager', 'vendor_operator', 'staff'],
            delete_documents: ['admin', 'manager'],
            export_documents: ['admin', 'manager', 'vendor_operator', 'staff'],
            manage_drive: ['admin', 'manager', 'vendor_operator'],
            manage_workspace: ['admin', 'owner'],
            manage_users: ['admin', 'owner'],
            view_audit_logs: ['admin', 'owner'],
        };
        
        return (defaults[permissionId] || []).includes(role);
    };

    React.useEffect(() => {
        if (user) {
            const current = user.permissions || {};
            const initial: Record<string, boolean> = {};
            
            PERMISSIONS.forEach(p => {
                // Use saved value if it exists, otherwise fall back to role default
                if (current[p.id] !== undefined) {
                    initial[p.id] = current[p.id];
                } else {
                    initial[p.id] = getInitialValue(p.id, user.role);
                }
            });
            
            setPermissions(initial);
        }
    }, [user]);

    const handleToggle = (id: string) => {
        setPermissions(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleSave = async () => {
        if (!user || !firestore) return;

        setIsSaving(true);
        const userRef = doc(firestore, 'users', user.id);

        try {
            await updateDoc(userRef, {
                permissions: permissions
            });
            
            // Determine which permissions were granted or revoked compared to original
            const originalPermissions: Record<string, boolean> = {};
            const currentSaved = user.permissions || {};
            PERMISSIONS.forEach(p => {
                if (currentSaved[p.id] !== undefined) {
                    originalPermissions[p.id] = currentSaved[p.id];
                } else {
                    originalPermissions[p.id] = getInitialValue(p.id, user.role);
                }
            });

            const granted: string[] = [];
            const revoked: string[] = [];

            for (const key in permissions) {
                const originalVal = !!originalPermissions[key];
                const newVal = !!permissions[key];

                if (newVal !== originalVal) {
                    const permDef = PERMISSIONS.find(p => p.id === key);
                    if (permDef) {
                        if (newVal) {
                            granted.push(permDef.label);
                        } else {
                            revoked.push(permDef.label);
                        }
                    }
                }
            }

            if (granted.length > 0 || revoked.length > 0) {
                const boldList = (items: string[]) => items.map(item => `**${item}**`).join(', ');
                let notifBody = "Your permissions have been updated.";
                if (granted.length > 0 && revoked.length > 0) {
                    notifBody = `Your permissions have been updated. Granted: ${boldList(granted)}. Revoked: ${boldList(revoked)}.`;
                } else if (granted.length > 0) {
                    notifBody = `Your permissions have been updated. You now have access to: ${boldList(granted)}.`;
                } else if (revoked.length > 0) {
                    notifBody = `Your permissions have been updated. Your access has been restricted for: ${boldList(revoked)}.`;
                }

                const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
                const notifRef = collection(firestore, `users/${user.id}/notifications`);
                await addDoc(notifRef, {
                    title: "Access Permissions Updated",
                    body: notifBody,
                    createdAt: serverTimestamp(),
                    read: false,
                    type: 'permission_update'
                });
            }

            toast({
                title: "Permissions Updated",
                description: `${user.name}'s access settings have been saved.`,
                variant: "success"
            });
            
            onSuccess?.();
            onOpenChange(false);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Could not save permissions.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle>Access Control</DialogTitle>
                    </div>
                    <DialogDescription asChild>
                        <div className="text-sm text-muted-foreground">
                            Grant or restrict specific functions for <strong>{user.name}</strong>.
                            <Badge variant="outline" className="ml-2 capitalize text-[10px] py-0 h-4">
                                Role: {user.role.replace('_', ' ')}
                            </Badge>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    {PERMISSIONS.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-4">
                            <div className="flex gap-3">
                                <div className="mt-1 p-1.5 bg-muted rounded-md text-muted-foreground">
                                    {item.icon}
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor={item.id} className="text-sm font-semibold cursor-pointer">
                                        {item.label}
                                    </Label>
                                    <p className="text-xs text-muted-foreground leading-normal max-w-[240px]">
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                            <Switch 
                                id={item.id} 
                                checked={!!permissions[item.id]} 
                                onCheckedChange={() => handleToggle(item.id)}
                            />
                        </div>
                    ))}
                </div>

                <DialogFooter className="pt-4 border-t">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Permissions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
