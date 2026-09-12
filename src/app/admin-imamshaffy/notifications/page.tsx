
'use client';

import * as React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, query, orderBy, deleteDoc, doc, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { BarChart3, Loader2, Send, Smartphone, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { format } from 'date-fns';
import type { AdminNotification } from '@/types';
import { Badge } from '@/components/ui/badge';
import { updateDoc } from 'firebase/firestore';
import { PushAnalytics } from '@/components/admin/push-analytics';
import { pushAlertToPhones } from '@/actions/notifications';
import { idToken } from '@/lib/id-token';
import { NOTIFICATION_FETCH_LIMIT } from '@/lib/lifecycle-notifications';
import { notificationDetailLink } from '@/lib/notification-links';
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

const notificationSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  body: z.string().min(5, "Message body is too short."),
  link: z.string().optional(),
  targetEmail: z.string().email("Invalid email format").or(z.literal("")).optional(),
  /**
   * On by default.
   *
   * It was off, and that is the whole reason a broadcast never reached a phone: the
   * form wrote an in-app document, reported "Notification Sent", and never pushed.
   * It was defaulted off out of caution when the push was added, on the reasoning
   * that turning it on silently would convert an existing draft-and-send habit into
   * a platform-wide buzz. In practice the opposite happened — the cautious default
   * became a send button that quietly did half the job. It is still a switch, so a
   * genuinely in-app-only notice is one tap away.
   */
  pushToPhones: z.boolean().optional(),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;

const PlayStoreIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.4 43.1C7.2 42.9 7 42.6 7 42.1V5.9C7 5.4 7.2 5.1 7.4 4.9L24.8 22.3L7.4 43.1Z" fill="#3BCEFF"/>
    <path d="M29.5 27L24.8 22.3L7.4 43.1L27.6 31.8C28.5 31.3 29.2 30.2 29.5 29V27Z" fill="#EA323C"/>
    <path d="M29.5 21L24.8 22.3L7.4 4.9L27.6 16.2C28.7 16.8 29.3 17.9 29.5 19V21Z" fill="#00D779"/>
    <path d="M29.5 21L29.5 27C30.1 26.6 30.7 26.1 31.1 25.5L40.7 20.1C42.2 19.3 42.2 17.1 40.7 16.3L31.1 10.9C30.6 10.6 30 10.4 29.5 10.4V21Z" fill="#FFC90F"/>
  </svg>
);

const MicrosoftIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.4 11.4H0V0H11.4V11.4Z" fill="#F25022"/>
    <path d="M24 11.4H12.6V0H24V11.4Z" fill="#7FBA00"/>
    <path d="M11.4 24H0V12.6H11.4V24Z" fill="#00A4EF"/>
    <path d="M24 24H12.6V12.6H24V24Z" fill="#FFB900"/>
  </svg>
);


/**
 * Where a notification sends people, short enough to sit on a phone.
 *
 * The store links are ~90 characters of tracking query string. Printed raw they
 * pushed the template cards and the history table wider than the screen, which
 * is the overflow that made this page unusable on a phone. The host answers
 * "where does this go" on its own; for an in-app route the path already is the
 * short form.
 */
function destinationLabel(link?: string | null): string {
  const raw = (link || '').trim();
  if (!raw) return '/support';
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return raw;
  }
}

// Titles here carry no emoji on purpose. These render in the in-app
// notification centre, in the OS notification tray and in the push payload —
// a picture character in the title line is what makes a business tool read
// like a mailing list. The type icon already carries that signal.
const PREDEFINED_TEMPLATES = [
  {
    id: 'ceo_chat',
    title: 'Message the founder directly',
    body: 'Questions, feedback, or a feature your shop needs? The CEO Direct Line goes straight to Bello Imam — not a ticket queue.',
    link: '/support',
    iconName: 'MessageSquare',
    badge: 'Onboarding / Day 3'
  },
  {
    id: 'playstore_app',
    title: 'Zeneva on Android',
    body: 'Check stock and take sales away from the counter. Available on Google Play.',
    link: 'https://play.google.com/store/apps/details?id=com.zeneva.app&hl=en-US&ah=8ZdJB3DBf5hWEO6U2hBOws2DuyY',
    iconName: 'Smartphone',
    badge: 'Google Play App'
  },
  {
    id: 'msstore_app',
    title: 'Zeneva on Windows',
    body: 'Faster receipts and offline printing on the shop PC. Available on the Microsoft Store.',
    link: 'https://apps.microsoft.com/detail/9nvn0f8njwmj?hl=en-US&gl=NG&ocid=pdpshare',
    iconName: 'Monitor',
    badge: 'Microsoft Store App'
  },
  {
    id: 'feature_update',
    title: 'New platform upgrade available',
    body: "Zeneva has been upgraded with faster offline sync, enhanced sales reports, and instant audio terminal alerts. Tap to explore.",
    link: '/dashboard',
    iconName: 'Sparkles',
    badge: 'Product Release'
  },
  {
    id: 'terminal_alerts',
    title: 'Instant bank payment alerts',
    body: 'Never miss a customer bank transfer. Receive instant audio alerts right in your physical store.',
    link: '/terminal-alerts',
    iconName: 'Bell',
    badge: 'Terminal / POS'
  },
  {
    id: 'inventory_audit',
    title: 'Low stock and inventory audit',
    body: 'Keep your business healthy. Review your low stock products and reorder points now.',
    link: '/inventory',
    iconName: 'Package',
    badge: 'Inventory'
  }
];

export default function AdminNotificationsPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [isSaving, setIsSaving] = React.useState(false);
    const [notificationToDelete, setNotificationToDelete] = React.useState<AdminNotification | null>(null);

    const form = useForm<NotificationFormValues>({
        // `link` starts blank so the default destination is the announcement's own
        // detail view. It used to default to `/support`, which sent every recipient
        // to the support chat — a page with nothing to say about what was announced.
        resolver: zodResolver(notificationSchema),
        defaultValues: { title: "", body: "", link: "", targetEmail: "", pushToPhones: true },
    });

    const notificationsQuery = useMemoFirebase(
        // Bounded. This was unbounded, so opening the admin page downloaded every
        // announcement ever sent — a cost that only ever grows.
        () => query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'), limit(NOTIFICATION_FETCH_LIMIT)),
        [firestore]
    );
    const { data: notifications, isLoading } = useCollection<AdminNotification>(notificationsQuery);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: usersData } = useCollection<any>(usersQuery);
    const userOptions = React.useMemo(() => {
        if (!usersData) return [];
        return usersData.map(u => ({ label: `${u.name || 'Unknown'} (${u.email})`, value: u.email || '' })).filter(u => u.value);
    }, [usersData]);

    const onSubmit = async (values: NotificationFormValues) => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to send notifications.' });
            return;
        }
        setIsSaving(true);
        try {
            // `pushToPhones` is a delivery option, not a property of the alert —
            // spreading it into the doc would put a stray field on every record.
            const { pushToPhones, ...notification } = values;

            const created = await addDoc(collection(firestore, 'notifications'), {
                ...notification,
                link: values.link?.trim() || null,
                targetEmail: values.targetEmail || null,
                sentBy: user.uid,
                createdAt: serverTimestamp(),
                deleted: false,
                /** Recorded so the history row can say whether phones were reached. */
                pushedToPhones: !!pushToPhones,
            });

            const audience = values.targetEmail ? `Notification targeted to ${values.targetEmail}` : 'Your notification has been sent to all users.';

            if (!pushToPhones) {
                toast({ variant: 'success', title: 'Notification Sent', description: `${audience} No phone push — that switch was off.` });
            } else {
                // The in-app document is already saved at this point. A failed push
                // therefore has to be reported as a partial success, not as a failure —
                // telling the owner "send failed" would invite a duplicate alert.
                //
                // The inner try/catch is what makes that true for *every* way the push
                // can fail, not just the ones `pushAlertToPhones` returns. It threw
                // synchronously in native builds — the stub in scripts/prepare-tauri.mjs
                // was missing this export, so the call was `undefined(...)` — and that
                // TypeError sailed past the check below into the outer catch, which
                // toasted "Send Failed" over an alert that had already been delivered.
                let result: { success: boolean; message?: string; error?: string };
                try {
                    result = await pushAlertToPhones({
                        title: values.title,
                        body: values.body,
                        // With no explicit link, the push points at the announcement's own
                        // detail view rather than at `/notifications` generally, so a tap
                        // opens the thing that was sent. The document id only exists after
                        // the write above, which is why this cannot be baked into the form.
                        link: values.link?.trim() || notificationDetailLink({ id: created.id, isGlobal: true }),
                        targetEmail: values.targetEmail || null,
                        idToken: await idToken(),
                    });
                } catch (pushError: any) {
                    result = { success: false, error: pushError?.message || 'The push could not be sent.' };
                }

                if (result.success) {
                    toast({ variant: 'success', title: 'Notification sent and pushed', description: result.message || audience });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Saved, but the phone push failed',
                        description: `${result.error} The in-app alert was still delivered.`,
                    });
                }
            }

            form.reset({ title: "", body: "", link: "", targetEmail: "", pushToPhones: true });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Send Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyTemplate = (tpl: typeof PREDEFINED_TEMPLATES[0]) => {
        form.setValue('title', tpl.title);
        form.setValue('body', tpl.body);
        form.setValue('link', tpl.link);
        toast({ title: 'Template Applied', description: `Loaded "${tpl.title}" template.` });
    };
    
    const handleDeleteNotification = async () => {
        if (!notificationToDelete || !firestore) return;
        try {
            await updateDoc(doc(firestore, 'notifications', notificationToDelete.id), {
                deleted: true,
                deletedAt: serverTimestamp(),
            });
            toast({ variant: 'success', title: 'Notification Deleted', description: 'The notification has been marked as deleted.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete notification.' });
        } finally {
            setNotificationToDelete(null);
        }
    };

    return (
        <>
            {/* Two tabs rather than one long scroll: the compose form and the
                delivery report are separate jobs, and stacking a five-KPI board
                under the templates grid would push the send button off a phone. */}
            <Tabs defaultValue="send" className="space-y-4">
                <TabsList className="h-9 md:h-10">
                    <TabsTrigger value="send" className="flex items-center gap-1.5 text-xs md:text-sm">
                        <Send className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Compose &amp; send</span>
                        <span className="sm:hidden">Send</span>
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center gap-1.5 text-xs md:text-sm">
                        <BarChart3 className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Push analytics</span>
                        <span className="sm:hidden">Analytics</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="send" className="mt-0">
            <div className="space-y-6">
                {/* Predefined Templates Section */}
                <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">Templates</CardTitle>
                        <CardDescription>Tap one to fill the form below.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {PREDEFINED_TEMPLATES.map((tpl) => (
                                <div
                                    key={tpl.id}
                                    className="p-4 rounded-xl border bg-card hover:bg-muted/40 transition-all cursor-pointer flex flex-col justify-between space-y-3 shadow-sm hover:shadow-md hover:border-primary/40 group"
                                    onClick={() => handleApplyTemplate(tpl)}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="min-w-0 truncate text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{tpl.badge}</span>
                                            <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground font-mono">{destinationLabel(tpl.link)}</span>
                                        </div>
                                        <h4 className="font-bold text-sm group-hover:text-primary transition-colors flex items-center gap-1.5">
                                            {tpl.id === 'playstore_app' && <PlayStoreIcon className="w-4 h-4 shrink-0" />}
                                            {tpl.id === 'msstore_app' && <MicrosoftIcon className="w-4 h-4 shrink-0" />}
                                            <span className="min-w-0 break-words">{tpl.title}</span>
                                        </h4>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{tpl.body}</p>
                                    </div>
                                    <Button size="sm" variant="secondary" className="w-full text-xs h-8 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        Use Template
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base sm:text-lg">Send Notification</CardTitle>
                                <CardDescription>Send a platform-wide notification or direct it to a specific user.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                        <FormField control={form.control} name="title" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Title</FormLabel>
                                                <FormControl><Input placeholder="e.g., Message the founder directly" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                        <FormField control={form.control} name="body" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Message</FormLabel>
                                                <FormControl><Textarea placeholder="Enter your notification message here." {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                        <FormField control={form.control} name="link" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Target link (optional)</FormLabel>
                                                <FormControl><Input placeholder="e.g., /terminal-alerts" {...field} /></FormControl>
                                                <FormDescription>
                                                    Leave blank to open the announcement itself.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                        <FormField control={form.control} name="targetEmail" render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Target user (optional)</FormLabel>
                                                {/* The trigger is a `whitespace-nowrap` button, so a
                                                    `Name (email)` label runs straight out of the card on a
                                                    phone. Truncating the selected value is the fix; the
                                                    placeholder is short enough not to need it, and blank
                                                    genuinely does mean everyone. */}
                                                <Combobox
                                                    options={userOptions}
                                                    value={field.value || ""}
                                                    onChange={field.onChange}
                                                    placeholder="All users"
                                                    emptyPlaceholder="No users found"
                                                    itemClassName="whitespace-normal break-words"
                                                    renderSelected={(option) => (
                                                        <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
                                                    )}
                                                />
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                        <FormField control={form.control} name="pushToPhones" render={({ field }) => (
                                            <FormItem className="flex flex-row items-start justify-between gap-3 rounded-xl border bg-muted/30 p-3">
                                                <div className="min-w-0 space-y-0.5">
                                                    <FormLabel className="flex items-center gap-1.5 text-sm">
                                                        <Smartphone className="h-4 w-4 shrink-0 text-primary" />
                                                        Also push to phones
                                                    </FormLabel>
                                                    <FormDescription className="text-xs">
                                                        Sends a real device notification on top of the in-app alert, and
                                                        records who opens it under Analytics. Turn it off for an
                                                        in-app-only notice.
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={!!field.value}
                                                        onCheckedChange={field.onChange}
                                                        className="mt-0.5 shrink-0"
                                                        aria-label="Also push to phones"
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}/>
                                        <Button type="submit" disabled={isSaving}>
                                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            <Send className="mr-2 h-4 w-4" /> Send Notification
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base sm:text-lg">Sent notifications</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        {/* Target drops out below md and is restated inside the
                                            Title cell — three columns do not fit a phone. */}
                                        <TableHead className="hidden md:table-cell">Target</TableHead>
                                        {/* No visible label: "Actions" is wider than the icon
                                            button beneath it, and on a phone that header text
                                            costs ~50px of the ~290px the card actually has. */}
                                        <TableHead className="w-[56px] text-right"><span className="sr-only">Actions</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={3} className="text-center">Loading history...</TableCell></TableRow>
                                    ) : notifications && notifications.length > 0 ? (
                                        notifications.map(notif => {
                                            const audience = notif.targetEmail ? `To: ${notif.targetEmail}` : 'All users';
                                            return (
                                            <TableRow key={notif.id} className={notif.deleted ? 'opacity-80 bg-muted/20' : ''}>
                                                <TableCell className="align-top font-medium">
                                                    {/* One width cap for the whole cell. A table column cannot
                                                        shrink below its content, so without this the body text
                                                        sets the table's width and the card scrolls sideways. */}
                                                    <div className="max-w-[180px] space-y-1 sm:max-w-md">
                                                        <div className="flex items-start gap-2">
                                                            <p className={`min-w-0 break-words font-semibold text-sm ${notif.deleted ? 'line-through text-muted-foreground' : ''}`}>{notif.title}</p>
                                                            {notif.deleted && (
                                                                <Badge variant="destructive" className="mt-0.5 h-5 shrink-0 px-1.5 text-[10px] uppercase gap-1 flex items-center shadow-none">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                                                    Deleted
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className={`break-words text-xs ${notif.deleted ? 'line-through text-muted-foreground/70' : 'text-muted-foreground'}`}>{notif.body}</p>
                                                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 md:hidden">
                                                            <Badge variant="outline" className="max-w-full truncate px-1 text-[10px] font-sans">
                                                                {audience}
                                                            </Badge>
                                                            <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">{destinationLabel(notif.link)}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden align-top text-xs font-mono text-muted-foreground md:table-cell">
                                                    <div className="max-w-[220px] break-all">{notif.link || '/support'}</div>
                                                    <Badge
                                                        variant="outline"
                                                        className={`mt-1 block max-w-[220px] truncate px-1 text-[10px] font-sans ${notif.targetEmail ? 'border-primary/20 text-primary bg-primary/5' : 'text-muted-foreground'}`}
                                                    >
                                                        {audience}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="align-top text-right">
                                                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => setNotificationToDelete(notif)} disabled={notif.deleted}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow><TableCell colSpan={3} className="text-center">No notifications sent yet.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
                </TabsContent>

                <TabsContent value="analytics" className="mt-0">
                    <PushAnalytics />
                </TabsContent>
            </Tabs>
            <AlertDialog open={!!notificationToDelete} onOpenChange={(open) => !open && setNotificationToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription className="break-words">
                            This action cannot be undone. This will permanently delete the notification titled "<strong>{notificationToDelete?.title}</strong>".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteNotification} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
