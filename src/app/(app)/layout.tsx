'use client';

import *as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProductTour } from '@/components/ProductTour';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Bell, LogOut, Package, Search as SearchIcon, Home, ShoppingCart, Users, FileText, Settings, LifeBuoy, ShieldAlert, CreditCard, Bot, Calculator as CalculatorIcon, Globe, Loader, BarChart2, UserCog, FileDigit, ShieldQuestion, Truck, Building, History as HistoryIcon, Paintbrush, Award, UserRound, X, Trash, AlertTriangle, CheckCircle2, ChevronRight, Zap, ArrowRight, ShieldCheck, Bug, Wallet
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, query, collection, orderBy, writeBatch, serverTimestamp, getDoc, addDoc, onSnapshot, where, limit } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import MobileBottomNav from '@/components/layout/mobile-bottom-nav';
import type { UserNotification, BusinessInstance, AdminNotification, UserProfile } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import Calculator from '@/components/shared/calculator';
import ZenAIWidget from '@/components/shared/zen-ai-widget';
import { FeatureUpdateModal } from '@/components/shared/feature-update-modal';
import { usePOS } from '@/context/pos-context';
import { Badge } from '@/components/ui/badge';
import { cn, safeToDate, getCountryFromIP } from '@/lib/utils';
import { isPaidPlan, getTrialDaysRemaining, isPaidPlanExpired } from '@/lib/plan';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import NetworkStatusIndicator from '@/components/shared/network-status-indicator';
import { useToast } from '@/hooks/use-toast';
import Confetti from '@/components/shared/confetti';
import { AppConfig } from '@/lib/config';
import { signedOutLandingRoute, openExternal } from '@/lib/platform';
import {
  selectDueLifecycleMessage,
  lifecycleNotificationId,
  toDateOrNull,
  collapseDuplicateNotifications,
  NOTIFICATION_FETCH_LIMIT,
} from '@/lib/lifecycle-notifications';
import { resolveNotificationLink, isExternalNotificationLink, filterVisibleAnnouncements } from '@/lib/notification-links';
import { selectDueNotifications } from '@/lib/notification-rules';
import BusinessHealthIndicator from '@/components/dashboard/business-health-indicator';
import QueueStatus from '@/components/layout/queue-status';
import { Skeleton } from '@/components/ui/skeleton';
import { CachedImage } from '@/components/shared/cached-image';
import PageTracker from '@/components/support/page-tracker';
import { useNativeNotifications } from '@/hooks/use-native-notifications';
import { useFCM } from '@/hooks/use-fcm';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { terminalListenerErrorHandler } from '@/firebase/retry';
import HeldSalesDrawer from '@/components/pos/held-sales-drawer';
import { History } from 'lucide-react';
import { BranchSwitcher } from '@/components/layout/branch-switcher';
import { useSessionTracker } from '@/hooks/use-session-tracker';
import { logErrorToFirestore } from '@/lib/error-logger';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { UpdateRequiredModal } from '@/components/layout/update-required-modal';
import AchievementCelebration from '@/components/achievements/achievement-celebration';
import { useI18n } from '@/context/i18n-context';
import { trackFeature } from '@/lib/product-telemetry';
const AiInsightsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="10" r="6" />
    <path d="M5 16a10 10 0 0 0 14 0" />
  </svg>
);

/**
 * `label` stays English on purpose: it is what builds the `tour-nav-*` DOM ids
 * that ProductTour targets by selector. `labelKey` is what the user reads.
 */
const navItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard', labelKey: 'nav.dashboard', roles: ['admin', 'manager', 'vendor_operator'] },
  { href: '/inventory', icon: Package, label: 'Inventory', labelKey: 'nav.inventory', roles: ['admin', 'manager', 'vendor_operator'] },
  { href: '/sales/pos/select-products', icon: ShoppingCart, label: 'POS', labelKey: 'nav.pos', roles: ['admin', 'manager', 'vendor_operator'] },
  { href: '/storefront', icon: Paintbrush, label: 'Storefront', labelKey: 'nav.storefront', roles: ['admin'] },
  { href: '/online-orders', icon: Globe, label: 'Online Orders', labelKey: 'nav.onlineOrders', roles: ['admin', 'manager'] },
  { href: '/receipts', icon: FileText, label: 'Receipts', labelKey: 'nav.receipts', roles: ['admin', 'manager', 'vendor_operator'] },
  { href: '/invoices', icon: FileDigit, label: 'Invoices', labelKey: 'nav.invoices', roles: ['admin', 'manager'] },
  { href: '/expenses', icon: Wallet, label: 'Expenses & Purchases', labelKey: 'nav.expensesPurchases', roles: ['admin', 'manager', 'vendor_operator', 'owner'] },
  { href: '/reports', icon: BarChart2, label: 'Reports', labelKey: 'nav.reports', roles: ['admin', 'owner'] },
  { href: '/ai-insights', icon: AiInsightsIcon, label: 'Zen AI', labelKey: 'nav.zenAi', roles: ['admin', 'manager'] },
  { href: '/customers', icon: Users, label: 'Customers', labelKey: 'nav.customers', roles: ['admin', 'manager', 'vendor_operator'] },
  { href: '/terminal-alerts', icon: Bell, label: 'Terminal Alerts', labelKey: 'nav.terminalAlerts', roles: ['admin', 'manager', 'vendor_operator', 'owner'], isNew: true },
  { href: '/users', icon: UserRound, label: 'Users', labelKey: 'nav.users', roles: ['admin'] },
  { href: '/audit-log', icon: HistoryIcon, label: 'Audit Log', labelKey: 'nav.auditLog', roles: ['admin'] },
];

const bottomLinks = [
  { href: '/billing', icon: CreditCard, label: 'Billing', labelKey: 'nav.billing', roles: ['admin', 'owner'] },
  { href: '/settings', icon: Settings, label: 'Settings', labelKey: 'nav.settings', roles: ['admin', 'owner'] },
  { href: '/support', icon: LifeBuoy, label: 'Support', labelKey: 'nav.support', roles: ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'] },
];

const moreNavLinks: { href: string; icon: React.ElementType; label: string; labelKey: string; roles: string[]; }[] = [
  // This is intentionally left empty as items are now in the main nav.
];

// Helper component for full-screen loading
function AppLoader({ text }: { text: string }) {
  const [mounted, setMounted] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    setMounted(true);
    // Simulated progress for secondary loaders
    const interval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + (Math.random() * 15) : prev));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div
      suppressHydrationWarning
      className="fixed inset-0 top-[var(--tauri-title-height,0)] z-[100] flex h-full w-full items-center justify-center overflow-hidden bg-background"
    >
      {/* Ambient Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />

      {/* Content Container */}
      <div className="relative flex flex-col items-center justify-center max-w-xs w-full p-8 z-10 text-center">
        <div className="relative mb-8">
           <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
           <Loader className="h-10 w-10 animate-spin text-primary relative" />
        </div>
        
        <div className="w-full space-y-4">
          <div className="relative h-1 w-full bg-muted rounded-full overflow-hidden">
             <div 
               className="absolute inset-y-0 start-0 bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(249,115,22,0.3)]"
               style={{ width: `${progress}%` }}
             />
          </div>
          <p className="text-xs font-semibold text-foreground/70 uppercase tracking-[0.2em] animate-pulse">
            {text}
          </p>
        </div>
      </div>
      
      {/* Texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}

export default function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = rawPathname ? (rawPathname.endsWith('/') && rawPathname !== '/' ? rawPathname.slice(0, -1) : rawPathname) : '';
  const { toast } = useToast();
  const firestore = useFirestore();
  const { t } = useI18n();

  const {
    isLoading,
    isUserLoading,
    currentUserProfile,
    user,
    business: businessInstance,
    isConfettiActive,
    triggerConfetti,
    setIsConfettiActive,
    products,
    receipts,
    customers,
    auditLogs,
    stats,
    currencySymbol,
    isOnline,
    queuedActions,
    isSubscriptionActive,
    onlineOrders,
    isImpersonating,
    stopImpersonation
  } = usePOS();

  // Track how long this user is actively using the app
  useSessionTracker(user?.uid);

  const [ipCountry, setIpCountry] = React.useState<string | null>(null);

  const [showCeoMessage, setShowCeoMessage] = React.useState(false);
  const [hasUnreadAdminMessage, setHasUnreadAdminMessage] = React.useState(false);
  const [unreadAdminMessageText, setUnreadAdminMessageText] = React.useState<string | null>(null);
  const [showSupportPopup, setShowSupportPopup] = React.useState(false);
  
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname === '/onboarding') return; // Wait until they finish onboarding
    
    const seenCeoMessage = sessionStorage.getItem('zeneva_seen_ceo_msg');
    if (!seenCeoMessage) {
      const timer = setTimeout(() => {
        setShowCeoMessage(true);
        sessionStorage.setItem('zeneva_seen_ceo_msg', 'true');
        setTimeout(() => {
          setShowCeoMessage(false);
        }, 45000); // Hide after 45s
      }, 3000); // Show 3s after load
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const isPremium = businessInstance?.plan === 'pro' || businessInstance?.plan === 'business';
  
  const trialDaysRemaining = businessInstance ? getTrialDaysRemaining(businessInstance) : null;
  const showTrialWarning = !isPremium && !isPaidPlanExpired(businessInstance) && trialDaysRemaining !== null && (trialDaysRemaining <= 7);

  React.useEffect(() => {
    getCountryFromIP().then(country => {
      setIpCountry(country);
    });
  }, []);

  const { notify } = useNativeNotifications();
  
  // CEO Broadcast Listener
  const [ceoBroadcastOpen, setCeoBroadcastOpen] = React.useState(false);
  const [activeBroadcast, setActiveBroadcast] = React.useState<any>(null);

  React.useEffect(() => {
    if (!firestore || !user) return;
    const broadcastsRef = collection(firestore, 'ceo_broadcasts');
    // limit(1): only `snapshot.docs[0]` is ever read below, but without the
    // limit the listener downloaded — and billed — every broadcast ever sent,
    // on every session.
    const q = query(broadcastsRef, orderBy('createdAt', 'desc'), limit(1));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;
      
      // Look at the latest broadcast doc
      const latestDoc = snapshot.docs[0];
      const broadcastData = { id: latestDoc.id, ...latestDoc.data() } as any;
      
      // Check if this notification has been processed locally
      const seenIds = JSON.parse(localStorage.getItem('zeneva_seen_broadcasts') || '[]');
      if (!seenIds.includes(broadcastData.id)) {
        setActiveBroadcast(broadcastData);
        setCeoBroadcastOpen(true);
        
        // Save to seen list
        seenIds.push(broadcastData.id);
        localStorage.setItem('zeneva_seen_broadcasts', JSON.stringify(seenIds));
        
        // Native notification alert.
        //
        // This is the object call shape that used to throw inside `notify` —
        // `title.toLowerCase()` on an object — with the TypeError swallowed by the
        // hook's own catch, so this notification had never once appeared. `url` is
        // explicit now so tapping it opens the chat it is telling them about.
        try {
          notify({
            title: broadcastData.title || "Direct CEO Line",
            body: broadcastData.message || "Bello Imam is online! Click to chat directly.",
            url: '/support',
          });
        } catch (e) {
          console.warn("Failed to show native notification:", e);
        }
      }
    }, terminalListenerErrorHandler('CEO broadcasts', () => unsubscribe()));

    return () => unsubscribe();
  }, [firestore, user, notify]);

  const { requestPermission: handleRequestFcmPermission } = useFCM();

  React.useEffect(() => {
    if (isUserLoading || !user) return;

    // Silently refresh the FCM token for ANY platform where permission is
    // already granted. This is the signal the uninstall tracker uses: if the
    // user has previously said "yes" to notifications, we want a live token on
    // file so the dry-run scan can tell us whether the app is still installed.
    // No UI prompt is shown (showToast = false). If permission is 'default' or
    // 'denied', requestPermission will simply no-op after checking the state.
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      // Token is already granted — silently refresh / ensure it's in Firestore.
      const timer = setTimeout(() => {
        handleRequestFcmPermission(false);
      }, 4000);
      return () => clearTimeout(timer);
    }

    // For Tauri native apps, also prompt (with a delay) if permission hasn't
    // been decided yet, since native apps own their own notification dialog.
    const isNative = (window as any).__TAURI_INTERNALS__;
    if (isNative && Notification.permission === 'default') {
      const timer = setTimeout(() => {
        handleRequestFcmPermission(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [user, isUserLoading, handleRequestFcmPermission]);


  const [hasPermissionError, setHasPermissionError] = React.useState(false);
  const [permissionErrorDetails, setPermissionErrorDetails] = React.useState<FirestorePermissionError | null>(null);

  React.useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      console.warn("Global Permission Error Caught:", error);
      
      // If the error is related to the current business, we might need to block access
      if (error.message?.includes('businessInstances') || error.message?.includes('onlineOrders')) {
        setHasPermissionError(true);
        setPermissionErrorDetails(error);
      } else {
        // Suppress non-critical permission toasts right after signup
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        if (path.includes('/onboarding') || path.includes('/sales/pos/select-products')) {
          return;
        }

        toast({
          variant: "destructive",
          title: "Permission Error",
          description: "You don't have permission to perform this action.",
        });
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => errorEmitter.off('permission-error', handlePermissionError);
  }, [toast]);

  React.useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      logErrorToFirestore(event.error || new Error(event.message), 'window', { userId: user?.uid, businessId: businessInstance?.id });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logErrorToFirestore(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), 'unhandled_rejection', { userId: user?.uid, businessId: businessInstance?.id });
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [user?.uid, businessInstance?.id]);

  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = React.useState(false);
  const [isZenAIOpen, setIsZenAIOpen] = React.useState(false);
  const [dictationTrigger, setDictationTrigger] = React.useState(0);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Trigger Zen AI with dictation when Control key is pressed
      if (e.key === 'Control') {
        // Prevent default browser hotkey triggers if any
        setIsZenAIOpen(true);
        setDictationTrigger(prev => prev + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- Helpers & Hooks (Above early returns to avoid Rule of Hooks violations) ---
  
  const handleLogout = () => {
    // Navigate immediately — Firebase clears the local auth token synchronously,
    // so the UI can transition to the welcome page right away without waiting
    // for the network round-trip. The signOut() call completes in the background.
    
    // Explicitly clear cross-tenant caches to prevent data leakage on next login
    if (typeof window !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('zeneva_cached_') || key.startsWith('pos_offline_') || key === 'zeneva_is_impersonating' || key === 'zeneva_impersonated_user_id')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
    
    router.replace(signedOutLandingRoute());
    signOut(getAuth()).catch(() => {
      // Rare: if sign-out fails (e.g. no network), the auth listener will
      // detect the user is still signed in and bring them back to /dashboard.
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An unexpected error occurred. Please try again.",
      });
    });
  };


  const getInitials = (name?: string) => {
    if (!name?.trim()) return "";
    const names = name.trim().split(' ').filter(Boolean);
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    if (names.length === 1) {
      return names[0][0].toUpperCase();
    }
    return "";
  };
  const resolvedUserName = React.useMemo(() => {
    const rawName = 
      (currentUserProfile as any)?.name?.trim() ||
      (currentUserProfile as any)?.displayName?.trim() ||
      (currentUserProfile as any)?.fullName?.trim() ||
      user?.displayName?.trim() ||
      (businessInstance as any)?.ownerName?.trim();
    
    if (rawName) return rawName;

    const email = currentUserProfile?.email || user?.email || '';
    if (!email) return 'User';
    
    const username = email.split('@')[0] || '';
    return username
      .replace(/[\._\-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'User';
  }, [currentUserProfile, user, businessInstance]);

  const fallbackInitials = getInitials(resolvedUserName) || (currentUserProfile?.email || user?.email || 'U').charAt(0).toUpperCase();

  // Helper: resolve a navigation link for each notification.
  //
  // The resolver lives in src/lib/notification-links.ts because this page and
  // /notifications had two copies of it, and both fell through to `/support` for a
  // global announcement — so tapping a broadcast opened the support chat instead of
  // the announcement. It now falls back to the notification's own detail view.
  const getNotificationLink = React.useCallback(
    (notif: any): string => resolveNotificationLink(notif),
    []
  );

  // Both listeners are bounded on the server, not just in the `.slice(0, 20)`
  // below. This layout is persistent, so an unbounded query here re-downloaded
  // — and re-billed — the whole collection on every attach, for every session.
  // `notifications` is the platform-wide collection, so that cost was
  // (every announcement ever sent) × (every tenant), growing permanently.
  const userNotificationsQuery = useMemoFirebase(
    () => (currentUserProfile ? query(collection(firestore, `users/${currentUserProfile.id}/notifications`), orderBy('createdAt', 'desc'), limit(NOTIFICATION_FETCH_LIMIT)) : null),
    [firestore, currentUserProfile?.id]
  );
  const { data: userNotifications, isLoading: isLoadingUserNotifications } = useCollection<UserNotification>(userNotificationsQuery);

  const adminNotificationsQuery = useMemoFirebase(
    () => (currentUserProfile ? query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'), limit(NOTIFICATION_FETCH_LIMIT)) : null),
    [currentUserProfile, firestore]
  );
  const { data: adminNotifications, isLoading: isLoadingAdminNotifications } = useCollection<AdminNotification>(adminNotificationsQuery);

  // Soft-deleted announcements, and announcements addressed to somebody else, are
  // not this viewer's — see filterVisibleAnnouncements. Shared with the native
  // bridge below so the bell and the phone always agree on what was sent.
  const visibleAnnouncements = React.useMemo(
    () => filterVisibleAnnouncements(adminNotifications as any[], currentUserProfile?.email),
    [adminNotifications, currentUserProfile?.email]
  );

  const allNotifications = React.useMemo(() => {
    if (isLoadingUserNotifications || isLoadingAdminNotifications) return [];
    const combined = [
      ...(userNotifications || []).map(n => ({ ...n, isGlobal: false })),
      ...visibleAnnouncements.map(n => ({ ...n, read: true, isGlobal: true }))
    ];
    combined.sort((a, b) => {
      const dateA = safeToDate(a.createdAt);
      const dateB = safeToDate(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    // Accounts created under the old localStorage-guarded schedule have
    // repeats of the same announcement in Firestore; fold them to the newest
    // copy. Operational alerts are never folded.
    return collapseDuplicateNotifications(combined as any[]).slice(0, 20);
  }, [userNotifications, visibleAnnouncements, isLoadingUserNotifications, isLoadingAdminNotifications]);

  // Counted off the collapsed list so the bell badge matches the list the user
  // opens. Mark-all-read and clear-all still act on every raw document.
  const unreadCount = React.useMemo(
    () => allNotifications.filter((n: any) => !n.isGlobal && !n.read).length,
    [allNotifications]
  );

  const handleMarkAsRead = React.useCallback(async () => {
    if (!currentUserProfile || unreadCount === 0 || !userNotifications || !firestore) return;
    // Counted here rather than on the button so a no-op click (nothing unread)
    // does not read as "wiped the badge" — the guard above has already returned.
    trackFeature('notif_bell_cleared');
    const batch = writeBatch(firestore);
    userNotifications.forEach(notif => {
      if (!notif.read) {
        const notifRef = doc(firestore, `users/${currentUserProfile.id}/notifications`, notif.id);
        batch.update(notifRef, { read: true });
      }
    });
    await batch.commit().catch(console.error);
  }, [currentUserProfile, unreadCount, userNotifications, firestore]);

  const handleDeleteNotification = React.useCallback(async (notifId: string, isGlobal: boolean) => {
    if (!currentUserProfile || isGlobal || !firestore) return;
    try {
      const notifRef = doc(firestore, `users/${currentUserProfile.id}/notifications`, notifId);
      const batch = writeBatch(firestore);
      batch.delete(notifRef);
      await batch.commit();
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  }, [currentUserProfile, firestore]);

  const handleClearAll = React.useCallback(async () => {
    if (!currentUserProfile || !userNotifications || !firestore) return;
    try {
      const batch = writeBatch(firestore);
      userNotifications.forEach(notif => {
        const notifRef = doc(firestore, `users/${currentUserProfile.id}/notifications`, notif.id);
        batch.delete(notifRef);
      });
      await batch.commit();
      toast({ title: "Notifications cleared" });
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  }, [currentUserProfile, userNotifications, firestore, toast]);

  const handleNotificationClick = React.useCallback(async (notif: any) => {
    if (!currentUserProfile || !firestore) return;

    // Every tap, read or unread, global or per-user: the question is whether the
    // bell leads anywhere, not whether this particular row was new.
    trackFeature('notif_tapped');

    // Mark as read if user notification
    if (!notif.isGlobal && !notif.read) {
      try {
        const notifRef = doc(firestore, `users/${currentUserProfile.id}/notifications`, notif.id);
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(notifRef, { read: true });
      } catch (e) {
        console.error("Error marking notification as read:", e);
      }
    }

    // A third copy of the link heuristics used to sit here, and it was the worst of
    // the three: its final fallback was `/support` for *everything*, so an
    // announcement, a milestone and an audit alert all opened the support chat.
    const targetLink = getNotificationLink(notif);

    // window.open is a no-op in the Tauri webview, so store links opened from the
    // bell need the shell hand-off too.
    if (isExternalNotificationLink(targetLink)) {
      await openExternal(targetLink);
    } else {
      router.push(targetLink);
    }
  }, [currentUserProfile, firestore, router, getNotificationLink]);

  const handleConfettiComplete = React.useCallback(() => setIsConfettiActive(false), [setIsConfettiActive]);

  React.useEffect(() => {
    // If auth checking is complete and there's no authenticated user, send them out.
    // Mobile lands on /welcome, desktop and web on /login.
    if (!isUserLoading && !user) {
      router.replace(signedOutLandingRoute());
    }
  }, [isUserLoading, user, router]);

  React.useEffect(() => {
    // If the Firebase user is logged in, but their Firestore 'users' document doesn't exist
    // and we are fully loaded, it means the account was deleted by an admin.
    if (!isUserLoading && !isLoading && user && currentUserProfile === null && !isLoggingOut) {
      setIsLoggingOut(true);
      signOut(getAuth()).catch(() => setIsLoggingOut(false));
    }
  }, [isUserLoading, isLoading, user, currentUserProfile, isLoggingOut]);

  React.useEffect(() => {
    const isSuperAdmin = currentUserProfile?.email === 'belloimam431@gmail.com';
    const justCompletedOnboarding = typeof window !== 'undefined' && sessionStorage.getItem('zeneva_onboarding_complete') === 'true';
    // Clear the bypass flag once Firestore has caught up and surveyCompleted is true
    if (justCompletedOnboarding && currentUserProfile?.surveyCompleted) {
      sessionStorage.removeItem('zeneva_onboarding_complete');
    }
    if (!isLoading && currentUserProfile && !currentUserProfile.surveyCompleted && pathname !== '/onboarding' && !isSuperAdmin && !justCompletedOnboarding) {
      router.replace('/onboarding');
    }
  }, [isLoading, currentUserProfile, pathname, router]);

  // RBAC Route Guard
  React.useEffect(() => {
    if (isLoading || isUserLoading || !currentUserProfile) return;

    const userRole = currentUserProfile.role;
    const isSuperAdmin = currentUserProfile.email === 'belloimam431@gmail.com';

    if (isSuperAdmin) return; // Super admin has access to everything

    const ROUTE_PERMISSIONS: Record<string, string[]> = {
      '/dashboard': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
      '/inventory/debts': ['admin', 'manager', 'owner', 'super-admin'],
      '/inventory/troubleshoot': ['admin', 'manager', 'owner', 'super-admin'],
      '/inventory/add': ['admin', 'manager', 'owner', 'super-admin'],
      '/inventory': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
      '/sales': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
      '/storefront': ['admin', 'owner', 'super-admin'],
      '/online-orders': ['admin', 'manager', 'owner', 'super-admin'],
      '/receipts': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
      '/invoices': ['admin', 'manager', 'owner', 'super-admin'],
      '/expenses': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
      '/purchases': ['admin', 'manager', 'owner', 'super-admin'],
      '/reports': ['admin', 'owner', 'super-admin'],
      '/ai-insights': ['admin', 'manager', 'owner', 'super-admin'],
      '/customers': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
      '/users': ['admin', 'owner', 'super-admin'],
      '/audit-log': ['admin', 'owner', 'super-admin'],
      '/billing': ['admin', 'owner', 'super-admin'],
      '/settings': ['admin', 'owner', 'super-admin'],
      '/support': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
      '/terminal-alerts': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
      '/achievements': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
    };

    const protectedRoute = Object.keys(ROUTE_PERMISSIONS)
      .sort((a, b) => b.length - a.length)
      .find(route => pathname.startsWith(route));

    if (protectedRoute) {
      const allowedRoles = ROUTE_PERMISSIONS[protectedRoute];
      const permissions = currentUserProfile.permissions || {};
      
      // 1. Check for explicit granular DENIAL (Highest Priority)
      const isExplicitlyDenied = 
        (protectedRoute.startsWith('/sales') && permissions.record_sales === false) ||
        (protectedRoute === '/reports' && permissions.view_reports === false) ||
        (protectedRoute.startsWith('/inventory') && permissions.manage_inventory === false) ||
        (protectedRoute === '/customers' && permissions.view_customers === false) ||
        (protectedRoute === '/audit-log' && permissions.view_audit_logs === false) ||
        (protectedRoute === '/online-orders' && permissions.manage_online_orders === false);

      // 2. Check for explicit granular ALLOWANCE
      const isExplicitlyAllowed = 
        (protectedRoute === '/reports' && permissions.view_reports === true) ||
        (protectedRoute.startsWith('/inventory') && permissions.manage_inventory === true) ||
        (protectedRoute === '/customers' && permissions.view_customers === true) ||
        (protectedRoute === '/audit-log' && permissions.view_audit_logs === true) ||
        (protectedRoute === '/online-orders' && permissions.manage_online_orders === true) ||
        (protectedRoute.startsWith('/sales') && permissions.record_sales === true);

      // Final decision logic
      const hasAccess = isSuperAdmin || (allowedRoles.includes(userRole) && !isExplicitlyDenied) || isExplicitlyAllowed;

      if (!hasAccess) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You do not have permission to view this page.",
        });
        
        // If they can't access POS, send them to dashboard. Otherwise send to POS.
        const canAccessPos = permissions.record_sales !== false && (userRole === 'admin' || userRole === 'manager' || userRole === 'vendor_operator');
        router.replace(canAccessPos ? '/sales/pos/select-products' : '/dashboard');
      }
    }
  }, [pathname, currentUserProfile, isLoading, isUserLoading, router, toast]);

  // --- End of Hooks ---
  
  const [permissionPopup, setPermissionPopup] = React.useState<{ id: string, title: string, body: string } | null>(null);

  const handleClosePermissionPopup = React.useCallback(async () => {
    if (permissionPopup && firestore && currentUserProfile) {
      try {
        const docRef = doc(firestore, `users/${currentUserProfile.id}/notifications`, permissionPopup.id);
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(docRef, { read: true });
      } catch (e) {
        console.error('Error marking permission notification as read:', e);
      }
    }
    setPermissionPopup(null);
  }, [permissionPopup, firestore, currentUserProfile]);

  React.useEffect(() => {
    // Permission update popups are only meaningful in the native Tauri app — the
    // browser manages its own notification prompt via the OS chrome. Showing this
    // modal on the web just confuses users who clicked "Allow" or "Block" and
    // never expected a second dialog.
    const isNative = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
    if (!isNative) return;

    if (userNotifications && userNotifications.length > 0) {
      // Check for unread permission updates to show as a popup
      const unreadPermissionNotifs = userNotifications.filter(n => !n.read && (n as any).type === 'permission_update');
      if (unreadPermissionNotifs.length > 0 && !permissionPopup) {
        // Show the oldest unread one first
        const notif = unreadPermissionNotifs[unreadPermissionNotifs.length - 1];
        setPermissionPopup({ id: notif.id, title: notif.title, body: notif.body });
      }
    }
  }, [userNotifications, permissionPopup]);

  /**
   * The bridge from a platform-wide announcement to an operating-system notification.
   *
   * This is the half that was broken. An admin broadcast lands in the shared
   * `notifications` collection, which no other bridge watches — so the announcement
   * reached the bell and never a phone. The old version of this effect was the only
   * thing that covered it, and it only ever looked at `allNotifications[0]`: one
   * newer per-user alert, or two announcements arriving together, and the broadcast
   * was dropped silently.
   *
   * Now every newly-seen announcement is dispatched, tracked by id. The listener it
   * reads is the one the bell already pays for (`adminNotificationsQuery` above), so
   * this costs no extra Firestore reads. Per-user documents are bridged separately in
   * `NativeNotificationListener`; the dispatcher de-duplicates, so the two cannot
   * double-pop.
   *
   * `notifiedAnnouncementsRef` starts populated from the first non-empty render
   * rather than empty, so opening the app does not replay a backlog. The age check is
   * the second guard, for a session that has been open across a long offline stretch.
   */
  const notifiedAnnouncementsRef = React.useRef<Set<string> | null>(null);
  React.useEffect(() => {
    if (isLoadingAdminNotifications || visibleAnnouncements.length === 0) return;

    if (notifiedAnnouncementsRef.current === null) {
      notifiedAnnouncementsRef.current = new Set(visibleAnnouncements.map((n: any) => n.id));
      return;
    }

    const seen = notifiedAnnouncementsRef.current;
    const ANNOUNCEMENT_FRESHNESS_MS = 10 * 60 * 1000;

    visibleAnnouncements.forEach((announcement: any) => {
      if (seen.has(announcement.id)) return;
      seen.add(announcement.id);

      const createdAt = announcement.createdAt ? safeToDate(announcement.createdAt).getTime() : Date.now();
      if (Number.isFinite(createdAt) && Date.now() - createdAt > ANNOUNCEMENT_FRESHNESS_MS) return;

      notify({
        title: announcement.title,
        body: announcement.body,
        url: getNotificationLink({ ...announcement, isGlobal: true }),
      });
    });
  }, [visibleAnnouncements, isLoadingAdminNotifications, notify, getNotificationLink]);

  // Support Messages Notifications for User
  React.useEffect(() => {
    if (!firestore || !currentUserProfile?.id) return;
    if (typeof window !== 'undefined' && pathname === '/support') {
      localStorage.setItem('zeneva_last_viewed_support_user', Date.now().toString());
    }

    const q = query(
      collection(firestore, 'supportThreads'),
      where('userId', '==', currentUserProfile.id),
      orderBy('lastMessageAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (typeof window === 'undefined') return;

      // Clear badge when user is actively on the support page.
      if (pathname === '/support') {
        setHasUnreadAdminMessage(false);
        localStorage.setItem('zeneva_last_viewed_support_user', Date.now().toString());
      }
      
      const lastViewedTimeStr = localStorage.getItem('zeneva_last_viewed_support_user');
      const lastViewedTime = lastViewedTimeStr ? parseInt(lastViewedTimeStr) : 0;

      let anyUnread = false;
      let unreadMsg = null;

      snapshot.docs.forEach((snapDoc) => {
        const data = snapDoc.data();
        // Any thread whose last message was from admin and is unread by the user
        // should keep the badge lit — regardless of when it arrived.
        if (data.lastMessageSender === 'admin' && !data.isReadByUser) {
          anyUnread = true;
          unreadMsg = data.lastMessage;
        }
      });
      setUnreadAdminMessageText(unreadMsg);

      // Also handle real-time arrivals for the OS notification.
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          if (data.lastMessageSender === 'user') return;
          
          if (data.lastMessageAt) {
            const date = typeof data.lastMessageAt.toDate === 'function'
              ? data.lastMessageAt.toDate()
              : new Date(data.lastMessageAt);
            const time = date.getTime();
            
            // Only pop OS notification for messages < 60 s old and not on /support
            if (!isNaN(time) && time > lastViewedTime && (Date.now() - time) < 60000 && pathname !== '/support') {
              notify(
                'New Message from Zeneva Support', 
                data.lastMessage || 'You have a new message from our team.',
                '/support'
              );
              setShowSupportPopup(true);
              setTimeout(() => setShowSupportPopup(false), 45000); // 45 seconds auto-hide
              localStorage.setItem('zeneva_last_viewed_support_user', Date.now().toString());
            }
          }
        }
      });

      setHasUnreadAdminMessage(anyUnread);
    }, terminalListenerErrorHandler('Support notifications', () => unsubscribe()));

    return () => unsubscribe();
  }, [firestore, currentUserProfile?.id, pathname, notify]);

  // --- Automated Notification Triggers ---

  // 1. Subscription Reminders (3 days before expiry)
  React.useEffect(() => {
    // Only paying customers have something that can lapse. On the free plan
    // the date is a leftover trial marker and nothing interrupts, so warning
    // them about "service interruption" would simply be untrue.
    if (businessInstance && businessInstance.trialExpiresAt && currentUserProfile && isPaidPlan(businessInstance)) {
      const expiryDate = safeToDate(businessInstance.trialExpiresAt);
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 3 && diffDays > 0) {
        const lastReminded = localStorage.getItem(`reminded_expiry_${businessInstance.id}`);
        const todayStr = now.toISOString().split('T')[0];
        
        if (lastReminded !== todayStr) {
          addDoc(collection(firestore, `users/${currentUserProfile.id}/notifications`), {
            title: "Subscription Reminder",
            body: `Your Zeneva subscription will expire in ${diffDays} day${diffDays === 1 ? '' : 's'}. Renew now to avoid any service interruption.`,
            createdAt: serverTimestamp(),
            read: false,
            type: 'billing'
          }).then(() => {
            localStorage.setItem(`reminded_expiry_${businessInstance.id}`, todayStr);
          }).catch(console.error);
        }
      }
    }
  }, [businessInstance, currentUserProfile, firestore]);

  // 2. New Online Orders Alerts
  const [lastOnlineOrderId, setLastOnlineOrderId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (onlineOrders && onlineOrders.length > 0 && currentUserProfile) {
      // Find the latest pending order
      const latestPendingOrder = [...onlineOrders]
        .sort((a, b) => {
          const dateA = safeToDate(a.createdAt).getTime();
          const dateB = safeToDate(b.createdAt).getTime();
          return dateB - dateA;
        })
        .find(o => o.status === 'pending');

      if (latestPendingOrder && latestPendingOrder.id !== lastOnlineOrderId) {
        const orderDate = safeToDate(latestPendingOrder.createdAt);
        const now = new Date();
        const diffSeconds = (now.getTime() - orderDate.getTime()) / 1000;

        // Only notify if it's a "fresh" order (less than 10 mins old) to avoid back-notifying
        if (diffSeconds < 600) {
          addDoc(collection(firestore, `users/${currentUserProfile.id}/notifications`), {
            title: "New Online Order!",
            body: `You received a new order for ${businessInstance?.settings?.currency || 'NGN'} ${latestPendingOrder.total}.`,
            createdAt: serverTimestamp(),
            read: false,
            type: 'order',
            orderId: latestPendingOrder.id
          }).catch(console.error);
        }
        setLastOnlineOrderId(latestPendingOrder.id);
      }
    }
  }, [onlineOrders, lastOnlineOrderId, currentUserProfile, businessInstance, firestore]);

  // 3. Lifecycle ("drip") notifications — CEO Direct Line, companion app.
  //
  // The schedule and the eligibility rules live in
  // src/lib/lifecycle-notifications.ts; this effect only performs the write.
  // At most ONE message is sent per pass and the delivery record is kept on the
  // user document rather than in localStorage — that record is what makes the
  // send idempotent across devices, reinstalls and cleared caches. See the
  // module header for why the previous localStorage version duplicated.
  const lifecycleWriteInFlight = React.useRef(false);
  React.useEffect(() => {
    if (!currentUserProfile || !firestore) return;
    // A single in-flight write at a time. Guards React Strict Mode's double
    // effect invocation and the re-render that the write itself triggers.
    if (lifecycleWriteInFlight.current) return;

    const due = selectDueLifecycleMessage({
      accountCreatedAt: toDateOrNull(currentUserProfile.createdAt),
      delivered: (currentUserProfile as any).lifecycleNotifications,
      now: new Date(),
      context: {
        isNative: typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__,
        isMobileUA: typeof navigator !== 'undefined' && /mobile|android|iphone|ipad/i.test(navigator.userAgent),
      },
    });
    if (!due) return;

    lifecycleWriteInFlight.current = true;
    const userId = currentUserProfile.id;
    const { stage, message } = due;

    // One batch: the notification and the marker that says it was sent commit
    // together, so a partial failure cannot leave a delivered message unmarked
    // (which is what would let it send again on the next mount).
    const batch = writeBatch(firestore);
    batch.set(
      doc(firestore, `users/${userId}/notifications`, lifecycleNotificationId(stage.id)),
      {
        title: message.title,
        body: message.body,
        createdAt: serverTimestamp(),
        read: false,
        type: message.type,
        link: message.link,
        ...(message.openExternal ? { openExternal: true } : {}),
      }
    );
    batch.set(
      doc(firestore, 'users', userId),
      { lifecycleNotifications: { [stage.id]: serverTimestamp() } },
      { merge: true }
    );

    batch
      .commit()
      // No notify() here on purpose. The batch above writes the notification
      // document, and NativeNotificationListener raises the popup from that — this
      // used to fire a second one alongside it.
      .catch((err) => {
        lifecycleWriteInFlight.current = false;
        console.error('Lifecycle notification failed:', err);
      });
  }, [currentUserProfile, firestore]);

  // 4. Operational triggers — low stock, milestones, audit risk, close of day.
  //
  // The rules live in src/lib/notification-rules.ts and are pure; this effect only
  // supplies the inputs and performs the write. Everything it reads is already in the
  // POS context, so the whole feature costs writes and no reads — see the note on
  // Firestore cost at the top of the notification queries above.
  //
  // Two guards that matter:
  //
  // - **Never while impersonating.** These write into the tenant's own notification
  //   feed, and an admin looking around a shop must not leave alerts behind in it.
  // - **Owner-targeted rules only run for the owner.** Firestore rules do not let a
  //   staff member write into the owner's notifications, so `selectDueNotifications`
  //   drops them rather than silently redirecting them to the wrong person.
  const triggerPassInFlight = React.useRef(false);
  const triggerSentRef = React.useRef<Set<string> | null>(null);
  React.useEffect(() => {
    if (!currentUserProfile || !firestore || !businessInstance || isImpersonating) return;
    if (triggerPassInFlight.current) return;

    const businessId = businessInstance.id;
    const storageKey = `zeneva_trg_sent_${businessId}`;

    // Loaded once per business. The deterministic document ids are the durable
    // backstop — this cache only avoids re-writing the same document on every pass,
    // and a cleared browser store costs one redundant overwrite, not a duplicate.
    if (triggerSentRef.current === null) {
      try {
        const raw = localStorage.getItem(storageKey);
        triggerSentRef.current = new Set<string>(raw ? JSON.parse(raw) : []);
      } catch {
        triggerSentRef.current = new Set<string>();
      }
    }
    const alreadySent = triggerSentRef.current;

    const ownerId = businessInstance.ownerId;
    const isViewerOwner = ownerId
      ? currentUserProfile.id === ownerId
      : currentUserProfile.role === 'admin';

    const expiresAt = isPaidPlan(businessInstance) && (businessInstance as any).trialExpiresAt
      ? safeToDate((businessInstance as any).trialExpiresAt)
      : null;

    const due = selectDueNotifications({
      now: new Date(),
      currencySymbol: currencySymbol || '₦',
      isViewerOwner,
      products,
      receipts,
      customers,
      auditLogs: auditLogs || [],
      stats,
      queuedActions: queuedActions || [],
      isOnline,
      subscriptionExpiresAt: expiresAt && Number.isFinite(expiresAt.getTime()) ? expiresAt : null,
      alreadySent,
    });

    if (due.length === 0) return;

    triggerPassInFlight.current = true;

    // One batch, so the pass either lands or does not. The ids are deterministic, so
    // a retry after a failure is an overwrite rather than a second copy.
    const batch = writeBatch(firestore);
    due.forEach((notification) => {
      batch.set(
        doc(firestore, `users/${currentUserProfile.id}/notifications`, notification.id),
        {
          title: notification.title,
          body: notification.body,
          type: notification.type,
          link: notification.link || null,
          createdAt: serverTimestamp(),
          read: false,
        }
      );
    });

    batch
      .commit()
      .then(() => {
        due.forEach((notification) => alreadySent.add(notification.id));
        try {
          // Bounded: a year of daily digests plus a catalogue's worth of per-product
          // ids would otherwise grow this string without limit.
          const recent = Array.from(alreadySent).slice(-400);
          triggerSentRef.current = new Set(recent);
          localStorage.setItem(storageKey, JSON.stringify(recent));
        } catch {
          // Quota or private mode. The document ids still make the write idempotent.
        }
      })
      .catch((err) => {
        // A staff member without permission for their own feed is not worth a toast;
        // the sale they were making is what matters.
        console.warn('Notification triggers could not be written:', err);
      })
      .finally(() => {
        triggerPassInFlight.current = false;
      });
  }, [
    currentUserProfile,
    firestore,
    businessInstance,
    isImpersonating,
    products,
    receipts,
    customers,
    auditLogs,
    stats,
    queuedActions,
    isOnline,
    currencySymbol,
  ]);

  if (isLoggingOut) {
    return <AppLoader text="Logging out..." />;
  }

  // If loading is complete and no user, we redirect (handled by useEffect).
  // While loading, we now show the shell instead of a full-screen loader to improve perceived speed.
  // We only show the loader if we are explicitly not logged in AND not loading (which shouldn't happen due to redirect)
  // or if we want to provide a tiny bit of buffer.
  const isInitialAuthCheck = isUserLoading && !user;

  // --- Start of Checks for Active/Valid Accounts ---

  const justCompletedOnboarding = typeof window !== 'undefined' && sessionStorage.getItem('zeneva_onboarding_complete') === 'true';
  if (currentUserProfile && currentUserProfile.surveyCompleted === false && pathname !== '/onboarding' && !justCompletedOnboarding) {
    // Don't block indefinitely — redirect immediately so the user can complete onboarding
    router.replace('/onboarding');
    return <AppLoader text="Finalizing your setup..." />;
  }

  if (currentUserProfile && currentUserProfile.status === 'inactive') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <UserCog className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">Account Inactive</CardTitle>
            <CardDescription>
              Your account is currently inactive. Please contact an administrator to have it reinstated.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleLogout} className="w-full">
              <LogOut className="me-2 h-4 w-4" />
              Logout & Return Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (businessInstance?.status === 'deleted' || (hasPermissionError && !isLoading)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {businessInstance?.status === 'deleted' ? "Business Deleted" : "Access Revoked"}
            </CardTitle>
            <CardDescription>
              {businessInstance?.status === 'deleted' 
                ? "The business associated with this account has been deleted by the owner."
                : "Your access to this business or resource has been revoked or expired."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {hasPermissionError && permissionErrorDetails 
                ? `Details: ${permissionErrorDetails.operation} on ${permissionErrorDetails.path}`
                : "For security, please log out and contact your administrator if you believe this is an error."}
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleLogout} className="w-full">
              <LogOut className="me-2 h-4 w-4" />
              Logout & Return Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  // --- End of Checks ---

  // Allow the full layout to render behind the onboarding modal
  if (pathname === '/onboarding') {
    return <main className="min-h-screen bg-background">{children}</main>;
  }


  // --- Subscription Guard Configuration ---
  // Deliberately never triggers on an expired date. Free plans do not expire
  // and a lapsed paid plan falls back to Starter with the shop still trading,
  // so `isSubscriptionActive` is only false for a business that has been
  // removed outright. The card below is that last-resort case.
  const restrictedRoutes = ['/sales', '/storefront', '/ai-insights', '/customers', '/inventory', '/reports', '/receipts', '/online-orders', '/audit-log'];
  const isRestrictedRoute = restrictedRoutes.some(route => pathname.startsWith(route));
  const showSubscriptionBlock = !isSubscriptionActive && isRestrictedRoute && !isLoading;
  // --- End of Subscription Guard Config ---

  // Pages that fill the viewport and manage their own internal scrolling, so the
  // page frame must not scroll or pad. The Zen AI chat is one: its transcript
  // and history rail scroll independently and its composer stays pinned.
  // /ai-insights/use-cases is a normal long page, so it is not full-bleed.
  const isFullBleedRoute = pathname === '/ai-insights';

  const userRole = currentUserProfile?.role;
  const plan = businessInstance?.plan || 'starter';
  const hasLifetimeAccess = businessInstance?.accessLevel === 'lifetime';

  const getAvatarRingClass = (userPlan: string) => {
    switch (userPlan) {
      case 'business':
        return 'bg-[linear-gradient(45deg,#10b981,#06b6d4,#3b82f6,#8b5cf6)] bg-[length:200%_200%] p-[2px] animate-gradient';
      case 'pro':
        return 'bg-gradient-to-tr from-blue-400 via-indigo-500 to-purple-600 p-[2px] animate-gradient';
      case 'starter':
      default:
        return 'bg-gradient-to-tr from-amber-400 via-orange-500 to-pink-600 p-[2px] animate-gradient';
    }
  };

  const filterNavByRole = (items: any[]) => {
    if (!userRole) return [];
    const permissions = currentUserProfile?.permissions || {};
    
    return items.filter(item => {
      // 1. Explicitly Enabled Override
      if (item.href.startsWith('/sales') && permissions.record_sales === true) return true;
      if (item.href === '/reports' && permissions.view_reports === true) return true;
      if (item.href.startsWith('/inventory') && permissions.manage_inventory === true) return true;
      if (item.href === '/customers' && permissions.view_customers === true) return true;
      if (item.href === '/audit-log' && permissions.view_audit_logs === true) return true;
      if (item.href === '/online-orders' && permissions.manage_online_orders === true) return true;

      // 2. Role Match
      const roleMatch = !item.roles || (item.roles as string[]).includes(userRole);
      if (!roleMatch) return false;

      // 3. Explicitly Disabled Override (for roles that have it by default)
      if (item.href.startsWith('/sales') && permissions.record_sales === false) return false;
      if (item.href === '/reports' && permissions.view_reports === false) return false;
      if (item.href.startsWith('/inventory') && permissions.manage_inventory === false) return false;
      if (item.href === '/customers' && permissions.view_customers === false) return false;
      if (item.href === '/audit-log' && permissions.view_audit_logs === false) return false;
      if (item.href === '/online-orders' && permissions.manage_online_orders === false) return false;

      // 4. Zeneva Terminal Feature Availability (Only for Nigeria)
      if (item.href === '/terminal-alerts') {
        const isForeign = ipCountry !== null && ipCountry !== 'Unknown' && ipCountry !== 'Nigeria';
        if (isForeign) return false;
      }

      // 5. RBAC settings
      if (item.href === '/expenses' && userRole === 'vendor_operator') {
          if (businessInstance?.settings?.allowCashierExpenseLogging !== true) return false;
      }

      return true;
    });
  };

  const visibleNavItems = filterNavByRole(navItems);
  const visibleBottomLinks = filterNavByRole(bottomLinks);
  const visibleMoreNavLinks = filterNavByRole(moreNavLinks);

  const mainMobileNavItems = visibleNavItems.filter(item => ['/dashboard', '/inventory', '/sales/pos/select-products'].includes(item.href));
  const extraMobileNavItems = visibleNavItems.filter(item => !mainMobileNavItems.some(main => main.href === item.href));
  const allMoreNavItems = [...extraMobileNavItems, ...visibleBottomLinks, ...visibleMoreNavLinks];

  const isLinkActive = (linkHref: string, currentPathname: string) => {
    if (linkHref === '/dashboard') return currentPathname === linkHref;
    if (linkHref === '/inventory') return currentPathname.startsWith('/inventory');
    if (linkHref === '/storefront') return currentPathname.startsWith('/storefront');
    if (linkHref === '/ai-insights') return currentPathname.startsWith('/ai-insights');
    return currentPathname.startsWith(linkHref);
  };

  const ROUTE_PERMISSIONS: Record<string, string[]> = {
    '/dashboard': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
    '/inventory/debts': ['admin', 'manager', 'owner', 'super-admin'],
    '/inventory/troubleshoot': ['admin', 'manager', 'owner', 'super-admin'],
    '/inventory/add': ['admin', 'manager', 'owner', 'super-admin'],
    '/inventory': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
    '/sales': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
    '/storefront': ['admin', 'owner', 'super-admin'],
    '/online-orders': ['admin', 'manager', 'owner', 'super-admin'],
    '/receipts': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
    '/invoices': ['admin', 'manager', 'owner', 'super-admin'],
    '/expenses': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
    '/purchases': ['admin', 'manager', 'owner', 'super-admin'],
    '/reports': ['admin', 'owner', 'super-admin'],
    '/ai-insights': ['admin', 'manager', 'owner', 'super-admin'],
    '/customers': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
    '/users': ['admin', 'owner', 'super-admin'],
    '/audit-log': ['admin', 'owner', 'super-admin'],
    '/billing': ['admin', 'owner', 'super-admin'],
    '/settings': ['admin', 'owner', 'super-admin'],
    '/support': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
    '/terminal-alerts': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
    '/achievements': ['admin', 'manager', 'vendor_operator', 'owner', 'super-admin'],
  };

  const protectedRoute = Object.keys(ROUTE_PERMISSIONS)
    .sort((a, b) => b.length - a.length)
    .find(route => pathname.startsWith(route));

  let hasRouteAccess = true;
  if (protectedRoute && currentUserProfile && !isLoading && !isUserLoading) {
    const userRole = currentUserProfile.role;
    const isSuperAdmin = currentUserProfile.email === 'belloimam431@gmail.com';
    const allowedRoles = ROUTE_PERMISSIONS[protectedRoute];
    const permissions = currentUserProfile.permissions || {};

    const isExplicitlyDenied = 
      (protectedRoute.startsWith('/sales') && permissions.record_sales === false) ||
      (protectedRoute === '/reports' && permissions.view_reports === false) ||
      (protectedRoute.startsWith('/inventory') && permissions.manage_inventory === false) ||
      (protectedRoute === '/customers' && permissions.view_customers === false) ||
      (protectedRoute === '/audit-log' && permissions.view_audit_logs === false) ||
      (protectedRoute === '/online-orders' && permissions.manage_online_orders === false) ||
      (protectedRoute === '/expenses' && userRole === 'vendor_operator' && businessInstance?.settings?.allowCashierExpenseLogging !== true);

    const isExplicitlyAllowed = 
      (protectedRoute === '/reports' && permissions.view_reports === true) ||
      (protectedRoute.startsWith('/inventory') && permissions.manage_inventory === true) ||
      (protectedRoute === '/customers' && permissions.view_customers === true) ||
      (protectedRoute === '/audit-log' && permissions.view_audit_logs === true) ||
      (protectedRoute === '/online-orders' && permissions.manage_online_orders === true) ||
      (protectedRoute.startsWith('/sales') && permissions.record_sales === true);

    hasRouteAccess = isSuperAdmin || (allowedRoles.includes(userRole) && !isExplicitlyDenied) || isExplicitlyAllowed;
    
    // Extra Route Guard for Terminal Alerts
    if (protectedRoute === '/terminal-alerts') {
      const isForeign = ipCountry !== null && ipCountry !== 'Unknown' && ipCountry !== 'Nigeria';
      if (isForeign) hasRouteAccess = false;
    }
  }

  const formatBodyText = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };
  const isBusinessHalted = isMounted && (businessInstance?.status === 'halted' || (businessInstance as any)?.isHalted === true) && currentUserProfile?.email !== 'belloimam431@gmail.com';

  if (isBusinessHalted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-destructive/5 blur-3xl rounded-full scale-150 animate-pulse pointer-events-none" />
        <Card className="w-full max-w-lg border border-destructive/20 shadow-xl bg-background/95 backdrop-blur-md overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-8 duration-500">
          <CardHeader className="pt-12 pb-6 text-center">
            <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <ShieldAlert className="h-10 w-10 animate-pulse" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-foreground">
              Account Suspended
            </CardTitle>
            <CardDescription className="text-base mt-3 px-4">
              Your business instance <span className="font-bold text-foreground">{businessInstance?.name || 'Zeneva Store'}</span> has been temporarily locked by system administrators.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              To protect your business data and security, we have halted all operations for this business.
            </p>
            <div className="rounded-xl bg-muted/50 p-4 border text-start text-xs font-mono space-y-1">
              <div className="text-muted-foreground">Reason: Security Hold / Suspicious Activity</div>
              <div className="text-muted-foreground">Reference ID: H-{businessInstance?.id?.substring(0, 8).toUpperCase()}</div>
            </div>
          </CardContent>
          <CardFooter className="px-8 pb-10 flex flex-col sm:flex-row gap-3">
            <Button asChild className="w-full h-11 bg-primary hover:bg-primary/90 font-bold">
              <a href="https://wa.me/2349064233805" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">Contact Support</a>
            </Button>
            <Button variant="outline" onClick={handleLogout} className="w-full h-11 border-destructive text-destructive hover:bg-destructive/5 font-semibold">
              Log Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <>
      <TooltipProvider>
        <SidebarProvider defaultOpen={true} className="h-full">
          <div
            className="relative flex h-full w-full overflow-hidden high-fidelity-shell"
          >
            <PageTracker />
            <Confetti trigger={isConfettiActive} onComplete={handleConfettiComplete} />
            <Sidebar collapsible="icon" className="flex-col bg-sidebar border-r no-print overflow-hidden">
              <SidebarHeader className="p-2 flex items-center gap-2 justify-center">
                <Link href="/dashboard" className="flex items-center justify-center h-10 w-full">
                  {/* Expanded state logo */}
                  <CachedImage 
                    src={AppConfig.logoUrl} 
                    alt="Zeneva Logo" 
                    className="w-28 h-auto group-data-[state=expanded]:block hidden" 
                  />
                  {/* Collapsed state logo */}
                  <div className="w-12 h-12 group-data-[state=collapsed]:block hidden">
                    <CachedImage 
                      src={AppConfig.logoIconUrl} 
                      alt="Zeneva Icon" 
                      className="w-10 h-10 mx-auto" 
                    />
                  </div>
                </Link>
                <BranchSwitcher />
              </SidebarHeader>
              <SidebarContent className="flex-1 p-2">
                <div className="flex-1 overflow-y-auto scrollbar-none hover:scrollbar-thin scrollbar-thumb-muted-foreground/20">
                  <SidebarMenu>
                    {!isMounted || isUserLoading ? (
                      // Show skeletons for the top 5 nav items while loading or before mounting
                      Array.from({ length: 6 }).map((_, i) => (
                        <SidebarMenuItem key={`skeleton-nav-${i}`}>
                          <SidebarMenuButton disabled>
                            <Skeleton className="h-5 w-5 rounded-md" />
                            <Skeleton className="h-4 w-24 group-data-[state=collapsed]:hidden" />
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))
                    ) : (
                      visibleNavItems.map((link) => (
                        <SidebarMenuItem key={link.href} id={`tour-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}>
                          <SidebarMenuButton
                            asChild
                            tooltip={{ children: t(link.labelKey), side: 'right', sideOffset: 10 }}
                            isActive={isLinkActive(link.href, pathname)}
                          >
                            <Link href={link.href} className="flex items-center w-full">
                              <link.icon className="h-5 w-5 shrink-0" />
                              <span className="group-data-[state=collapsed]:hidden flex items-center justify-between flex-1 min-w-0">
                                <span className="truncate">{t(link.labelKey)}</span>
                                {(link as any).isNew && (
                                  <Badge className="ms-2 h-[18px] px-1.5 bg-orange-500 hover:bg-orange-600 text-[9px] font-bold text-white border-0 shadow-none leading-none rounded">{t('nav.newBadge')}</Badge>
                                )}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))
                    )}
                  </SidebarMenu>
                </div>
              </SidebarContent>
              <SidebarFooter className="p-2 pb-12 md:pb-8">
                <SidebarMenu>
                  {isMounted && visibleBottomLinks.map((link) => {
                    const isSupport = link.href === '/support';
                    const content = (
                      <SidebarMenuItem key={link.href} id={`tour-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}>
                        <SidebarMenuButton
                          asChild
                          tooltip={{ children: t(link.labelKey), side: 'right', sideOffset: 10 }}
                          isActive={pathname.startsWith(link.href)}
                        >
                          <Link href={link.href} className="relative">
                            <link.icon className="h-5 w-5" />
                            <span className="group-data-[state=collapsed]:hidden">{t(link.labelKey)}</span>
                            {isSupport && (showCeoMessage || hasUnreadAdminMessage) && (
                              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );

                    if (isSupport) {
                      return (
                        <Popover key={link.href} open={showCeoMessage || showSupportPopup} onOpenChange={(v) => { setShowCeoMessage(v); if (!v) setShowSupportPopup(false); }}>
                          <PopoverTrigger asChild>
                            {content}
                          </PopoverTrigger>
                          <PopoverContent side="right" align="end" sideOffset={15} className="w-64 p-0 overflow-hidden shadow-xl border-orange-500/20 z-50">
                            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 text-white flex items-center gap-2">
                                <Avatar className="h-6 w-6 border border-white/20">
                                    <AvatarImage src="/images/bello.jpg" />
                                    <AvatarFallback className="text-[9px] text-orange-600">BI</AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-bold">Bello Imam, CEO</span>
                            </div>
                            <div className="p-3 text-xs text-muted-foreground bg-background">
                                <p className="line-clamp-2">{
                                  showCeoMessage
                                    ? (activeBroadcast?.message || "Hey! I'm Bello Imam, CEO of Zeneva. I read all messages in this direct line personally...")
                                    : (unreadAdminMessageText || "Hey! I'm Bello Imam, CEO of Zeneva. I read all messages in this direct line personally...")
                                }</p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    }

                    return content;
                  })}
                </SidebarMenu>
                <Separator className="my-2 bg-sidebar-border" />
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start p-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
                      <div className="flex items-center gap-2 w-full">
                        {isUserLoading ? (
                          <Skeleton className="h-8 w-8 rounded-full" />
                        ) : (
                          <div className={cn("rounded-full shrink-0", getAvatarRingClass(plan))}>
                            <Avatar className="h-8 w-8 border-2 border-background">
                              <AvatarFallback className="bg-muted text-foreground font-semibold">
                                {fallbackInitials}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        )}
                        <div className="flex flex-col items-start group-data-[state=collapsed]:hidden truncate">
                          {isUserLoading ? (
                            <>
                              <Skeleton className="h-4 w-24 mb-1" />
                              <Skeleton className="h-3 w-12" />
                            </>
                          ) : (
                            <>
                              <span className="truncate text-sm font-medium" title={resolvedUserName}>{resolvedUserName}</span>
                              {hasLifetimeAccess && <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 shadow-sm animate-pulse-slow">Lifetime</Badge>}
                              {!hasLifetimeAccess && plan && <Badge variant={plan === 'pro' ? 'secondary' : 'default'} className={cn('capitalize text-xs px-1.5 py-0.5 mt-1', (plan === 'starter' || plan === 'business') && 'bg-orange-500 hover:bg-orange-300 border-orange-600 text-white')}>{plan}</Badge>}
                            </>
                          )}
                        </div>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link href="/achievements"><Award className="me-2 h-4 w-4" />Achievements</Link></DropdownMenuItem>
                    {userRole === 'admin' && (
                      <DropdownMenuItem asChild><Link href="/settings">Settings</Link></DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild><Link href="/support"><LifeBuoy className="me-2 h-4 w-4" />Support</Link></DropdownMenuItem>
                    {user?.email === 'belloimam431@gmail.com' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin-imamshaffy" className="text-orange-600 dark:text-orange-400 font-semibold">
                            <Bug className="me-2 h-4 w-4" />
                            Admin Panel
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="me-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarFooter>
            </Sidebar>
            <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
              {showTrialWarning && (
                <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center justify-between z-20">
                  <div className="flex items-center gap-2 text-orange-800 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Your trial expires in {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'}. Upgrade your plan to continue using Zeneva.</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs bg-orange-100 border-orange-200 text-orange-800 hover:bg-orange-200" asChild>
                    <Link href="/settings/billing">Upgrade Now</Link>
                  </Button>
                </div>
              )}
              <header className="no-print flex h-16 shrink-0 items-center gap-2 sm:gap-4 border-b bg-background px-2 sm:px-6 z-10">
                <SidebarTrigger className="hidden md:flex" />
                <BusinessHealthIndicator />
                {isMounted && <Badge variant="outline" className="hidden md:inline-flex text-[10px] h-5 bg-muted/50 font-mono opacity-60 hover:opacity-100 transition-opacity">v{AppConfig.version}</Badge>}
                <BranchSwitcher variant="header" className="md:hidden shrink min-w-0" />
                <div className="flex-1" />
                <div className="flex items-center gap-1 md:gap-2 ml-auto">
                  <QueueStatus />
                  <NetworkStatusIndicator />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HeldSalesDrawer />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Parked Sales</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Zen AI" onClick={() => setIsZenAIOpen(true)}>
                        <Bot className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Zen AI</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Calculator" onClick={() => setIsCalculatorOpen(true)}>
                        <CalculatorIcon className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Calculator</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenu
                    modal={false}
                    onOpenChange={(open) => {
                      // Open transition only. Radix fires this on close too, and
                      // counting both would double every visit. `forceMount` on the
                      // content below rules out inferring this from a mount effect.
                      if (open) trackFeature('notif_bell_opened');
                    }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                            <Bell className="h-5 w-5" />
                            {unreadCount > 0 && <span className="absolute top-1 end-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">{unreadCount}</span>}
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Notifications</p>
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="w-80 sm:w-96" align="end" forceMount>
                      <DropdownMenuLabel className="flex items-center justify-between font-normal">
                        <span className="text-sm font-medium">Notifications</span>
                        {unreadCount > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.preventDefault(); handleMarkAsRead(); }}
                          >
                            Mark all read
                          </Button>
                        )}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {allNotifications.length === 0 ? (
                        <div className="px-3 py-8 text-center">
                          <Bell className="mx-auto h-6 w-6 text-muted-foreground/40" />
                          <p className="mt-2 text-xs text-muted-foreground">You're all caught up</p>
                        </div>
                      ) : (
                        <ScrollArea className="max-h-[320px]">
                          {allNotifications.slice(0, 6).map((notif: any) => (
                            <DropdownMenuItem
                              key={`${notif.isGlobal ? 'g' : 'u'}-${notif.id}`}
                              className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 focus:bg-muted focus:text-foreground hover:bg-muted"
                              onSelect={() => handleNotificationClick(notif)}
                            >
                              <span
                                className={cn(
                                  'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                                  notif.read ? 'bg-transparent' : 'bg-primary'
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <p className={cn('truncate text-xs', !notif.read && 'font-semibold')}>
                                  {notif.title || 'Notification'}
                                </p>
                                {notif.body && (
                                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                                    {notif.body}
                                  </p>
                                )}
                                <p className="mt-1 text-[10px] text-muted-foreground/70">
                                  {formatDistanceToNow(safeToDate(notif.createdAt), { addSuffix: true })}
                                </p>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </ScrollArea>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="cursor-pointer justify-center">
                        <Link href="/notifications" className="text-xs font-medium">
                          View all
                          <ChevronRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-9 w-9 rounded-full flex justify-center items-center p-0">
                        {isUserLoading ? (
                          <Skeleton className="h-8 w-8 rounded-full" />
                        ) : (
                          <div className={cn("rounded-full", getAvatarRingClass(plan))}>
                            <Avatar className="h-8 w-8 border-2 border-background">
                              <AvatarFallback className="bg-muted text-foreground font-semibold">
                                {fallbackInitials}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-medium leading-none truncate">{resolvedUserName}</p>
                            {plan && <Badge variant={plan === 'pro' ? 'secondary' : 'default'} className={cn('capitalize text-xs', (plan === 'starter' || plan === 'business') && 'bg-orange-500 hover:bg-orange-300 border-orange-600 text-white')}>{plan}</Badge>}
                          </div>
                          <p className="text-xs leading-none text-muted-foreground">
                            {currentUserProfile?.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild><Link href="/achievements"><Award className="me-2 h-4 w-4" />Achievements</Link></DropdownMenuItem>
                      {userRole === 'admin' && (
                        <DropdownMenuItem asChild>
                          <Link href="/settings">
                            <Settings className="me-2 h-4 w-4" />
                            <span>Settings</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {user?.email === 'belloimam431@gmail.com' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href="/admin-imamshaffy" className="text-orange-600 dark:text-orange-400 font-semibold">
                              <Bug className="me-2 h-4 w-4" />
                              <span>Admin Panel</span>
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="me-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>
              {/*
                Impersonation banner. Sits between the header and <main> rather than
                after it: MobileBottomNav is `fixed bottom-0 z-40`, so anything below
                <main> is hidden behind the nav on phones — which is exactly how the
                exit affordance went missing on mobile. Sticky so it survives scrolling.
              */}
              {isImpersonating && (
                <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] no-print animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="shadow-[0_4px_20px_rgba(239,68,68,0.4)] hover:shadow-[0_6px_25px_rgba(239,68,68,0.6)] font-semibold border border-destructive-foreground/10 h-9 px-4 rounded-full flex items-center gap-1.5 transition-all"
                    aria-label="Exit impersonation and return to the admin panel"
                    onClick={async () => {
                      // Must clear the impersonation state BEFORE navigating. The old
                      // handler only did window.location.href, which left
                      // sessionStorage set — so the reload dropped straight back into
                      // the impersonated account.
                      try {
                        await stopImpersonation();
                      } finally {
                        window.location.href = '/admin-imamshaffy';
                      }
                    }}
                  >
                    <X className="h-4 w-4" />
                    <span>Exit View</span>
                  </Button>
                </div>
              )}
              <main
                id="app-main-content"
                className={cn(
                  "flex-1 min-w-0 font-body bg-background relative",
                  // Full-bleed pages own their own scrolling: the chat transcript
                  // and its history rail scroll, the page frame does not.
                  isFullBleedRoute
                    ? "overflow-hidden"
                    : "overflow-y-auto p-4 sm:p-6 md:pb-6 smooth-scroll"
                )}
              >
                <div className={cn("w-full transition-all duration-700", isFullBleedRoute ? "h-full" : "min-h-full pb-32 md:pb-0", showSubscriptionBlock && "blur-md pointer-events-none select-none opacity-40 scale-[0.98]")}>
                  {hasRouteAccess ? children : (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 bg-card rounded-2xl border shadow-sm animate-in fade-in duration-300">
                      <div className="p-4 bg-destructive/10 rounded-full text-destructive mb-4">
                        <ShieldAlert className="h-10 w-10" />
                      </div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">Access Denied</h3>
                      <p className="text-muted-foreground max-w-sm mb-6">
                        You do not have the required permissions to view this page. Redirecting you...
                      </p>
                      <Loader className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                {showSubscriptionBlock && (
                   <div className="absolute inset-0 z-[30] overflow-y-auto p-4 bg-background/5 backdrop-blur-[2px] animate-in fade-in duration-500">
                     <div className="min-h-full w-full flex items-center justify-center pb-20 sm:pb-4">
                       <Card className="w-full max-w-lg border-2 border-dashed border-orange-500/20 shadow-md bg-background/95 backdrop-blur-md overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-8 duration-700">
                        <CardHeader className="pt-10 pb-6 text-center">
                          <div className="mx-auto mb-8 relative">
                             <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-28 w-28 text-orange-500 relative z-10 animate-float"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <style>{`
                                  @keyframes sandFlow {
                                    to {
                                      stroke-dashoffset: -6;
                                    }
                                  }
                                  .sand-stream {
                                    stroke-dasharray: 3 3;
                                    animation: sandFlow 0.5s linear infinite;
                                  }
                                `}</style>
                                <line x1="4" y1="2" x2="20" y2="2" strokeWidth="2" />
                                <line x1="4" y1="22" x2="20" y2="22" strokeWidth="2" />
                                <path d="M5 2 C5 2 5 9 10 12 C5 15 5 22 5 22" />
                                <path d="M19 2 C19 2 19 9 14 12 C19 15 19 22 19 22" />
                                <path d="M6 5 H18 L15 10 H9 Z" fill="currentColor" fillOpacity="0.8" stroke="none" />
                                <line x1="12" y1="10" x2="12" y2="21" className="sand-stream" stroke="currentColor" strokeWidth="1" />
                                <path d="M8 21 H16 L14 18 H10 Z" fill="currentColor" fillOpacity="0.9" stroke="none" />
                              </svg>
                          </div>
                          <CardTitle className="text-4xl font-extrabold tracking-tight text-foreground">
                            Account Inactive
                          </CardTitle>
                          <CardDescription className="text-lg mt-3 px-4">
                            <span className="font-bold text-foreground">{(businessInstance?.name || 'your business').toLowerCase()}</span> is no longer active. Please contact support to restore access.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="px-8 pb-10">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="p-5 rounded-2xl bg-muted/30 border border-border/50 shadow-sm">
                              <h4 className="text-xs font-bold text-primary mb-4 uppercase tracking-wider">Restricted Features</h4>
                              <ul className="text-sm space-y-3 text-muted-foreground font-medium">
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-orange-500" /> POS & Sales</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-orange-500" /> Storefront</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-orange-500" /> Zen AI</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-orange-500" /> Customers</li>
                              </ul>
                            </div>
                             <div className="p-5 rounded-2xl bg-orange-500/5 border border-orange-500/10 flex flex-col justify-center text-center">
                               <p className="text-xs text-muted-foreground mb-5 leading-relaxed">Unlock all features instantly with our business-ready plans.</p>
                               <Button asChild className="w-full h-12 shadow-md hover:scale-[1.05] active:scale-95 transition-all duration-300 bg-orange-500 hover:bg-orange-600 font-bold">
                                 <Link href="/billing">
                                   <ArrowRight className="me-2 h-4 w-4" />
                                   Review Plans
                                 </Link>
                               </Button>
                               <Button variant="ghost" onClick={handleLogout} className="mt-3 text-xs text-muted-foreground hover:text-foreground font-semibold hover:bg-muted/50 h-9 transition-colors">
                                 Log Out
                               </Button>
                             </div>
                          </div>
                        </CardContent>
                      </Card>
                     </div>
                  </div>
                )}
              </main>
               <ZenAIWidget isOpen={isZenAIOpen} onClose={() => setIsZenAIOpen(false)} dictationTrigger={dictationTrigger} />
               <FeatureUpdateModal />
             </div>
          </div>
          <MobileBottomNav 
            navItems={isUserLoading ? [] : mainMobileNavItems} 
            moreNavItems={isUserLoading ? [] : allMoreNavItems} 
            isLoading={isUserLoading}
            userEmail={user?.email ?? undefined}
          />
          <Calculator isOpen={isCalculatorOpen} onOpenChange={setIsCalculatorOpen} />
        </SidebarProvider>
        <ProductTour />
      </TooltipProvider>

      {/* Permission Update Popup */}
      <Dialog open={!!permissionPopup} onOpenChange={(open) => {
        if (!open) {
          handleClosePermissionPopup();
        }
      }}>
        <DialogContent className="max-w-md sm:max-w-lg border-2 border-primary/20 bg-background shadow-2xl">
          <DialogHeader className="mb-4">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-primary shadow-sm border border-primary/20">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <DialogTitle className="text-center text-2xl font-bold">{permissionPopup?.title}</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              {formatBodyText(permissionPopup?.body || '')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-2">
            <Button onClick={handleClosePermissionPopup} className="w-full sm:w-1/2" size="lg">
              Got it, thanks!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CEO Invite Broadcast Popup */}
      <Dialog open={ceoBroadcastOpen} onOpenChange={setCeoBroadcastOpen}>
        <DialogContent className="max-w-md border-2 border-orange-500/20 bg-background shadow-2xl rounded-xl">
          <DialogHeader className="mb-4">
            <div className="mx-auto bg-orange-100 dark:bg-orange-950/30 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-orange-500 shadow-sm border border-orange-500/20">
              <LifeBuoy className="h-8 w-8 text-orange-600" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-orange-600">
              {activeBroadcast?.title || "Direct CEO Line"}
            </DialogTitle>
            <DialogDescription className="text-center text-sm pt-2 text-foreground/80 leading-relaxed">
              {activeBroadcast?.message || "Bello Imam (CEO of Zeneva) is online! You can chat directly for feature requests, feedback, or custom support."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setCeoBroadcastOpen(false)} className="flex-1 rounded-lg">
              Later
            </Button>
            <Button onClick={() => {
              setCeoBroadcastOpen(false);
              router.push('/support');
            }} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg">
              Start Chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <UpdateRequiredModal />
      {/* Owner-only milestone card. Mounted here, not on /achievements, because the
          moment worth celebrating is the sale that crosses the line — and one mount
          is what keeps it from firing twice. All guards are in `useAchievements`. */}
      <AchievementCelebration />
    </>
    </ErrorBoundary>
  );
}
