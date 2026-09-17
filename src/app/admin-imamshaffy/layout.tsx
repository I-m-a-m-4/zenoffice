'use client';

import Link from 'next/link';
import { useUser, useFirestore } from '@/firebase';
import { terminalListenerErrorHandler } from '@/firebase/retry';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader, LogOut, LayoutDashboard, Newspaper, Bell, MessageSquare, Crown, Sun, Moon, Bug, Users, Zap, Clapperboard, PieChart, MoreHorizontal, Mail, Smartphone, Database, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAuth, signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';
import Confetti from '@/components/shared/confetti';

import Admin2FAGate from '@/components/admin/admin-2fa-gate';
import { useTheme } from 'next-themes';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useNativeNotifications } from '@/hooks/use-native-notifications';
import { playNotificationSound } from '@/lib/sound';
import { INTERNAL_ACCOUNT_EMAILS } from '@/lib/platform-revenue';

const ADMIN_EMAILS = INTERNAL_ACCOUNT_EMAILS;
const ADMIN_EMAIL = 'belloimam431@gmail.com';

/**
 * `primary` marks the four links that get a slot in the mobile bottom bar.
 * Everything else lives behind "More".
 *
 * The bar used to render all of them, which was already tight at nine and would
 * be unusable at eleven — icons shrink, labels truncate, and the tap targets
 * stop being reliably distinguishable on a phone.
 */
const navLinks = [
  { href: '/admin-imamshaffy', label: 'Dashboard', icon: LayoutDashboard, primary: true },
  { href: '/admin-imamshaffy/users', label: 'Users', icon: Users, primary: true },
  { href: '/admin-imamshaffy/investors', label: 'Cap Table', icon: PieChart },
  { href: '/admin-imamshaffy/achievements', label: 'Achievements', icon: Crown },
  { href: '/admin-imamshaffy/outreach', label: 'Email', icon: Mail },
  { href: '/admin-imamshaffy/blog', label: 'Blog', icon: Newspaper },
  { href: '/admin-imamshaffy/marketing', label: 'Studio', icon: Clapperboard },
  { href: '/admin-imamshaffy/promos', label: 'Promo Popups', icon: Sparkles },
  { href: '/admin-imamshaffy/notifications', label: 'Alerts', icon: Bell, primary: true },
  { href: '/admin-imamshaffy/support', label: 'Support', icon: MessageSquare, primary: true },
  { href: '/admin-imamshaffy/ai-usage', label: 'AI Usage', icon: Zap },
  { href: '/admin-imamshaffy/updates', label: 'App Updates', icon: Smartphone },
  { href: '/admin-imamshaffy/developer-logs', label: 'Dev Logs', icon: Bug },
  { href: '/admin-imamshaffy/backups', label: 'Backups', icon: Database },
];

const primaryNavLinks = navLinks.filter((link) => link.primary);
const overflowNavLinks = navLinks.filter((link) => !link.primary);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { isConfettiActive, setIsConfettiActive } = ({} as any);
  const router = useRouter();
  const pathname = usePathname();

  const { setTheme, resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const [unreadErrorCount, setUnreadErrorCount] = useState(0);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { notify } = useNativeNotifications();

  useEffect(() => {
    if (!firestore || !user || user.email !== ADMIN_EMAIL) return;

    const q = query(
      collection(firestore, 'error_logs'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (typeof window === 'undefined') return;
      const lastViewedTimeStr = localStorage.getItem('zeneva_last_viewed_errors');
      const lastViewedTime = lastViewedTimeStr ? parseInt(lastViewedTimeStr) : 0;

      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.createdAt) {
          const date = typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate()
            : new Date(data.createdAt);
          const time = date.getTime();
          if (!isNaN(time) && time > lastViewedTime) {
            count++;
          }
        }
      });
      setUnreadErrorCount(count);

      // Trigger native notification for newly added error logs
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.createdAt) {
            const date = typeof data.createdAt.toDate === 'function'
              ? data.createdAt.toDate()
              : new Date(data.createdAt);
            const time = date.getTime();
            // Only notify if it's a completely new error (added recently)
            // and wasn't already viewed
            if (!isNaN(time) && time > lastViewedTime && (Date.now() - time) < 60000) {
              // `message` is the field the logger actually writes — `errorMessage`
              // was never written by anything, so every one of these popups used
              // to read "A new system error was just logged." and say nothing.
              notify(
                data.type === 'anomaly' ? 'Zeneva Anomaly Detected' : 'New Developer Log',
                data.message || data.errorMessage || 'A new system error was just logged.',
                '/admin-imamshaffy/developer-logs'
              );
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [firestore, user, pathname, notify]);

  // Support Messages Notifications
  useEffect(() => {
    if (!firestore || !user || !user.email || !ADMIN_EMAILS.includes(user.email)) return;

    const q = query(
      collection(firestore, 'supportThreads'),
      orderBy('lastMessageAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (typeof window === 'undefined') return;
      
      const lastViewedTimeStr = localStorage.getItem('zeneva_last_viewed_support');
      const lastViewedTime = lastViewedTimeStr ? parseInt(lastViewedTimeStr) : 0;

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          // Avoid notifying for messages sent by the admin themselves
          if (data.lastMessageSender === 'admin' || data.lastMessageSenderId === 'admin' || data.isReadByAdmin === true) return;
          
          if (data.lastMessageAt) {
            const date = typeof data.lastMessageAt.toDate === 'function'
              ? data.lastMessageAt.toDate()
              : new Date(data.lastMessageAt);
            const time = date.getTime();
            
            // Only notify if it's new and within the last 60 seconds
            if (!isNaN(time) && time > lastViewedTime && (Date.now() - time) < 60000) {
              playNotificationSound();
              const sender = data.userName || 'A user';
              const text = data.lastMessageSnippet || data.lastMessage || 'Sent a new support message.';
              notify(
                `Support: ${sender}`, 
                text,
                '/admin-imamshaffy/support'
              );
              // Update last viewed so we don't double-notify
              localStorage.setItem('zeneva_last_viewed_support', Date.now().toString());
            }
          }
        }
      });
    }, terminalListenerErrorHandler('Admin support notifications', () => unsubscribe()));

    return () => unsubscribe();
  }, [firestore, user, notify]);

  // Support unread badge
  useEffect(() => {
    if (!firestore || !user || !user.email || !ADMIN_EMAILS.includes(user.email)) return;

    const q = query(
      collection(firestore, 'supportThreads'),
      orderBy('lastMessageAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.isReadByAdmin === false && data.lastMessageSenderId !== 'admin') {
          count++;
        }
      });
      setUnreadSupportCount(count);
    }, terminalListenerErrorHandler('Support unread badge', () => unsubscribe()));

    return () => unsubscribe();
  }, [firestore, user]);

  useEffect(() => {
    if (typeof window !== 'undefined' && pathname === '/admin-imamshaffy/developer-logs') {
      localStorage.setItem('zeneva_last_viewed_errors', Date.now().toString());
      setUnreadErrorCount(0);
    }
    if (typeof window !== 'undefined' && pathname === '/admin-imamshaffy/support') {
      localStorage.setItem('zeneva_last_viewed_support', Date.now().toString());
      setUnreadSupportCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    if (isUserLoading) return;

    const isLoginPage = pathname === '/admin-imamshaffy/login';

    if (!user) {
      if (!isLoginPage) router.replace('/admin-imamshaffy/login');
      return;
    }

    const isAuthorizedAdmin = user.email === ADMIN_EMAIL;

    if (!isAuthorizedAdmin && !isLoginPage) {
      router.replace('/dashboard');
    }

    if (isAuthorizedAdmin && isLoginPage) {
      router.replace('/admin-imamshaffy');
    }
  }, [user, isUserLoading, router, pathname]);

  const handleLogout = () => {
    const auth = getAuth();
    router.push('/admin-imamshaffy/login');
    signOut(auth).catch((err) => console.error('Sign out error:', err));
  };

  const isLinkActive = (href: string) => {
    if (href === '/admin-imamshaffy') return pathname === href;
    return pathname.startsWith(href);
  };

  // Highlights the "More" trigger when the current page is one of the links
  // hidden behind it, so the mobile bar still shows where you are.
  const isOverflowActive = overflowNavLinks.some((link) => isLinkActive(link.href));

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-0 h-full bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader className="size-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Authenticating Admin...</p>
        </div>
      </div>
    );
  }

  if (pathname === '/admin-imamshaffy/login') {
    return <div className="h-full overflow-y-auto w-full">{children}</div>;
  }

  if (user && user.email === ADMIN_EMAIL) {
    return (
      <div className="flex h-full w-full flex-col relative overflow-hidden">
        <Confetti trigger={isConfettiActive} onComplete={() => setIsConfettiActive(false)} />

        {/* Top Header */}
        <header className="sticky top-0 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 z-10">
          {/* Brand */}
          <Link
            href="/admin-imamshaffy"
            className="flex items-center gap-2 text-base font-black tracking-tight whitespace-nowrap shrink-0 mr-2"
          >
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Zeneva Admin
            </span>
          </Link>

          {/* Desktop nav links — hidden on mobile */}
          <nav className="hidden md:flex flex-row items-center gap-5 text-sm font-medium overflow-x-auto scrollbar-none">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap py-1 transition-colors hover:text-foreground',
                  isLinkActive(link.href)
                    ? 'text-foreground font-bold border-b-2 border-primary'
                    : 'text-muted-foreground'
                )}
              >
                <span>{link.label}</span>
                {link.label === 'Dev Logs' && unreadErrorCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-5 px-1.5 py-0 flex items-center justify-center text-[10px] font-black rounded-full animate-pulse bg-red-600 text-white border-0"
                  >
                    {unreadErrorCount}
                  </Badge>
                )}
                {link.label === 'Support' && unreadSupportCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-5 px-1.5 py-0 flex items-center justify-center text-[10px] font-black rounded-full animate-pulse bg-orange-500 text-white border-0"
                  >
                    {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
                  </Badge>
                )}
              </Link>
            ))}
          </nav>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
              className="rounded-full w-9 h-9 border-muted hover:bg-accent shrink-0"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode
                ? <Sun className="h-4 w-4 text-yellow-500" />
                : <Moon className="h-4 w-4 text-slate-700" />}
            </Button>
            {/* Logout — text on desktop, icon on mobile */}
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="shrink-0 hidden md:flex"
            >
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden w-9 h-9"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page content — extra bottom padding on mobile to clear the bottom nav */}
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 overflow-y-auto pb-24 md:pb-8">
          <Admin2FAGate>
            {children}
          </Admin2FAGate>
        </main>

        {/* Mobile Bottom Navigation — four primary links plus a "More" sheet.
            Rendering all ten here would leave each one about 10% of the screen. */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-border bg-background/95 backdrop-blur-md h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-around items-center h-16">
            {primaryNavLinks.map((link) => {
              const active = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex flex-col items-center justify-center flex-1 h-full"
                >
                  <div className="relative mb-0.5">
                    <link.icon
                      className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')}
                    />
                    {link.label === 'Support' && unreadSupportCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] text-white font-bold">
                        {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] leading-none',
                      active ? 'text-primary font-semibold' : 'text-muted-foreground'
                    )}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}

            <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="flex flex-col items-center justify-center flex-1 h-full"
                  aria-label="More admin sections"
                >
                  <div className="relative mb-0.5">
                    <MoreHorizontal
                      className={cn(
                        'h-5 w-5',
                        isOverflowActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    {/* Dev Logs lives inside the sheet now, so its unread count has
                        to surface on the trigger or it becomes invisible on mobile. */}
                    {unreadErrorCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] text-white font-bold">
                        {unreadErrorCount > 9 ? '9+' : unreadErrorCount}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] leading-none',
                      isOverflowActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                    )}
                  >
                    More
                  </span>
                </button>
              </SheetTrigger>

              <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
                <SheetHeader className="text-left">
                  <SheetTitle>More sections</SheetTitle>
                </SheetHeader>
                <div className="mt-4 grid grid-cols-3 gap-3 pb-4">
                  {overflowNavLinks.map((link) => {
                    const active = isLinkActive(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsMoreOpen(false)}
                        className={cn(
                          'flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors',
                          active ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                        )}
                      >
                        <div className="relative">
                          <link.icon
                            className={cn(
                              'h-5 w-5',
                              active ? 'text-primary' : 'text-muted-foreground'
                            )}
                          />
                          {link.label === 'Dev Logs' && unreadErrorCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] text-white font-bold">
                              {unreadErrorCount > 9 ? '9+' : unreadErrorCount}
                            </span>
                          )}
                        </div>
                        <span
                          className={cn(
                            'text-center text-[11px] leading-tight',
                            active ? 'font-semibold text-primary' : 'text-muted-foreground'
                          )}
                        >
                          {link.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    );
  }

  // Fallback for unauthorized users while useEffect redirects them
  return (
    <div className="flex items-center justify-center min-h-0 h-full bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader className="size-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
