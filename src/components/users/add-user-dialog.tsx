'use client';

import * as React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { sendInvitationEmail } from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';
import { usePOS } from '@/context/pos-context';
import { useBranch } from '@/context/branch-context';

interface AddUserDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    businessId: string;
    businessName: string;
    inviterName: string;
    onSuccess?: () => void;
    currentUserCount: number;
    pendingInvitationCount: number;
}

const inviteUserSchema = z.object({
    name: z.string().min(2, "Name is required."),
    email: z.string().email("Please enter a valid email."),
    role: z.enum(['manager', 'vendor_operator'], {
        required_error: "Please select a role."
    }),
});

type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

const PLAN_USER_LIMITS: Record<string, number> = {
    'starter': 1,
    'pro': 5,
    'business': 1000000, // Effectively unlimited
};

export default function AddUserDialog({ isOpen, onOpenChange, businessId, businessName, inviterName, onSuccess, currentUserCount, pendingInvitationCount }: AddUserDialogProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { business } = usePOS();
    const { activeBranchId } = useBranch();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const plan = business?.plan || 'starter';
    const limit = PLAN_USER_LIMITS[plan] || 1;
    const totalCurrentSlots = currentUserCount + pendingInvitationCount;
    const isLimitReached = totalCurrentSlots >= limit;

    const form = useForm<InviteUserFormValues>({
        resolver: zodResolver(inviteUserSchema),
        defaultValues: {
            name: "",
            email: "",
            role: undefined,
        },
    });

    const handleInvite = async (values: InviteUserFormValues) => {
        if (!firestore) return;

        if (isLimitReached) {
            toast({
                variant: 'destructive',
                title: 'Limit Reached',
                description: `Your ${plan} plan is limited to ${limit} user${limit === 1 ? '' : 's'}. Please upgrade your subscription to add more staff.`,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const invitationCode = uuidv4();
            const invitationRef = doc(firestore, 'invitations', invitationCode);

            // Check for existing users or invitations
            const existingUserQuery = query(collection(firestore, 'users'), where('email', '==', values.email), where('businessId', '==', businessId));
            const existingUserSnapshot = await getDocs(existingUserQuery);

            if (!existingUserSnapshot.empty) {
                toast({
                    variant: 'destructive',
                    title: 'User Exists',
                    description: 'This user is already a member of your business.',
                });
                setIsSubmitting(false);
                return;
            }

            const existingInviteQuery = query(collection(firestore, 'invitations'), where('email', '==', values.email), where('businessId', '==', businessId));
            const existingInviteSnapshot = await getDocs(existingInviteQuery);

            if (!existingInviteSnapshot.empty) {
                toast({
                    variant: 'warning',
                    title: 'Already Invited',
                    description: 'An invitation has already been sent to this email.',
                });
                setIsSubmitting(false);
                return;
            }

            await setDoc(invitationRef, {
                ...values,
                businessId,
                branchId: (activeBranchId && activeBranchId !== 'all') ? activeBranchId : undefined,
                createdAt: serverTimestamp(),
            });

            const isDesktopOrLocal = window.location.origin.includes('localhost') || window.location.origin.includes('tauri.localhost') || window.location.origin.includes('127.0.0.1');
            const baseUrl = isDesktopOrLocal ? 'https://zeneva.space' : window.location.origin;
            const invitationLink = `${baseUrl}/signup?invitationCode=${invitationCode}`;

            try {
                await sendInvitationEmail({
                    to_email: values.email,
                    to_name: values.name,
                    business_name: businessName,
                    inviter_name: inviterName,
                    invitation_link: invitationLink,
                });
                toast({
                    variant: 'success',
                    title: 'Invitation Sent!',
                    description: `${values.name} has been invited. They will be added to your business upon signing up with their email.`,
                });
            } catch (emailError: any) {
                toast({
                    variant: 'warning',
                    title: 'Invitation Saved, Email Failed',
                    description: emailError?.message || 'The email could not be sent. Please check your EmailJS configuration.',
                    duration: 10000
                });
            }

            if (onSuccess) {
                onSuccess();
            }
            form.reset();
            onOpenChange(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Invitation Failed',
                description: 'Could not save invitation record. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-40 pointer-events-auto animate-in fade-in duration-200" 
                    onClick={() => onOpenChange(false)} 
                />
            )}
            <Dialog open={isOpen} onOpenChange={onOpenChange} modal={false}>
                <DialogContent className="sm:max-w-md z-50">
                <DialogHeader>
                    <DialogTitle>Invite New User</DialogTitle>
                    <DialogDescription>
                        Enter the user's details. They will receive an email with a secure link to join your business.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleInvite)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="user@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <Button type="button" variant="outline" className="w-full justify-between font-normal h-10 px-3 bg-background border-input">
                                                {field.value === 'manager' ? 'Manager' : field.value === 'vendor_operator' ? 'Vendor Operator' : 'Select a role'}
                                                <ChevronDown className="h-4 w-4 opacity-50" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                                            <DropdownMenuItem onClick={() => field.onChange('manager')}>Manager</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => field.onChange('vendor_operator')}>Vendor Operator</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className='mt-6'>
                            <Button variant="outline" size="lg" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" size="lg" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Send Invitation
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    </>
    );
}
