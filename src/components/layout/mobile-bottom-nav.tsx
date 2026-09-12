
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Package, ShoppingCart, Users, Menu, FileText, LifeBuoy, Settings, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BranchSwitcher } from '@/components/layout/branch-switcher';
import { useI18n } from '@/context/i18n-context';

interface NavItem {
    href: string;
    icon: LucideIcon;
    /** English, and the source of the `tour-nav-mobile-*` ids ProductTour targets. */
    label: string;
    /** Translation key for what the user actually reads. */
    labelKey?: string;
}

interface MobileBottomNavProps {
    navItems: NavItem[];
    moreNavItems: NavItem[];
    isLoading?: boolean;
    userEmail?: string;
}

export default function MobileBottomNav({ navItems, moreNavItems, isLoading, userEmail }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Eagerly prefetch all navigation routes on mount for instant switching
  React.useEffect(() => {
    navItems.forEach((item) => router.prefetch(item.href));
    moreNavItems.forEach((item) => router.prefetch(item.href));
  }, [navItems, moreNavItems, router]);

  const labelFor = (item: NavItem) => (item.labelKey ? t(item.labelKey) : item.label);

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-background/95 backdrop-blur-md border-t border-border z-40 md:hidden no-print">
      <div className="flex justify-around items-center h-16">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center justify-center flex-1 h-full">
              <Skeleton className="h-6 w-6 mb-1 rounded-md" />
              <Skeleton className="h-3 w-12 rounded-sm" />
            </div>
          ))
        ) : (
          navItems.map((item) => {
            const isActive = (item.href === '/dashboard' && pathname === item.href) || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                prefetch={true}
                id={`tour-nav-mobile-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex flex-col items-center justify-center flex-1 h-full touch-manipulation active:opacity-70"
              >
                <item.icon className={cn('h-6 w-6 mb-1', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-xs', isActive ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                  {labelFor(item)}
                </span>
              </Link>
            );
          })
        )}

        {!isLoading && (
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center flex-1 h-full">
                <Menu className='h-6 w-6 mb-1 text-muted-foreground' />
                <span className='text-xs text-muted-foreground'>{t('nav.more')}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[65%] flex flex-col p-4 sm:p-6">
              <SheetHeader className="pb-2 text-start">
                <SheetTitle>More Options</SheetTitle>
              </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                    <BranchSwitcher variant="sheet" className="mb-2 border-b border-border/60 pb-3" />
                    <ul className="space-y-1 py-2">
                        {moreNavItems.map(item => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={() => setIsSheetOpen(false)}
                                        className={cn(
                                            "flex items-center gap-4 p-3 rounded-lg text-base",
                                            isActive ? "bg-muted text-primary font-semibold" : "text-foreground"
                                        )}
                                    >
                                        <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                                        <span>{labelFor(item)}</span>
                                    </Link>
                                </li>
                            )
                        })}
                        {userEmail === 'belloimam431@gmail.com' && (
                          <li>
                            <Link
                              href="/admin-imamshaffy"
                              onClick={() => setIsSheetOpen(false)}
                              className="flex items-center gap-4 p-3 rounded-lg text-base text-orange-600 dark:text-orange-400 font-semibold"
                            >
                              <Bug className="h-5 w-5" />
                              <span>Admin Panel</span>
                            </Link>
                          </li>
                        )}
                    </ul>
                </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  );
}
