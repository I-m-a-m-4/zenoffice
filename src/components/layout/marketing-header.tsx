
'use client';

import { useUser } from '@/firebase';
import Link from "next/link";
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Menu, X, LogOut, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '../ui/button';
import { AppConfig } from '@/lib/config';
import { useI18n } from '@/context/i18n-context';
import { LanguageSwitcherCompact } from '@/components/settings/language-switcher';

export default function MarketingHeader() {
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useI18n();
  const [mounted, setMounted] = React.useState(false);
  const [showBanner, setShowBanner] = useState(true);


  React.useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => {
        toast({ title: t('toast.loggedOut'), description: t('toast.loggedOutDescription') });
        router.push('/');
      })
      .catch(() => {
        toast({ variant: 'destructive', title: t('toast.logoutFailed') });
      });
  };

  const navLinks = [
    { href: "/zen-ai", labelKey: "home.navZenAi" },
    { href: "/#features", labelKey: "home.navFeatures" },
    { href: "/download", labelKey: "home.navDownload" },
    { href: "/about/our-mission", labelKey: "home.navMission" },
    { href: "/pricing", labelKey: "home.navPricing" },
    { href: "/blog", labelKey: "home.navBlog" },
    { href: "/contact", labelKey: "home.navContact" },
  ];

  return (
    <>
      <header className={cn(
        "fixed top-[var(--tauri-title-height,0)] z-50 w-full transition-all duration-300 shadow-sm border-b border-slate-100 flex flex-col"
      )}>
        {/* Promotional Banner */}
        {showBanner && (
          <div className="w-full bg-[#f1dfd1] text-black h-12 flex items-center justify-between px-4 z-50">
             {/* Left placeholder for symmetry */}
             <div className="w-6 hidden sm:block" />

             {/* Centered content */}
             <div className="flex-1 flex items-center justify-center gap-2 sm:gap-3 text-sm min-w-0 px-1">
                <span className="hidden md:inline-flex bg-transparent text-primary px-2 py-0.5 font-bold rounded text-[10px] uppercase tracking-wider border border-primary/30 shrink-0">
                  {t('landing.flashSale')}
                </span>
                <span className="font-medium tracking-tight text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
                  <span className="truncate">{t('landing.premiumFor')} <span className="font-bold text-black">₦300,000/yr</span></span>
                  <span className="text-black/50 line-through text-[10px] sm:text-xs shrink-0 hidden sm:inline">₦360,000</span>
                  <span className="text-emerald-600 font-bold text-[10px] sm:text-xs tracking-tight shrink-0 hidden lg:inline">{t('landing.save', { amount: '₦60,000' })}</span>
                </span>
                <Link href="/pricing" onClick={() => setShowBanner(false)} className="bg-[#1e293b] text-white px-2 sm:px-4 py-1.5 rounded-md font-semibold hover:bg-[#0f172a] transition-all hover:scale-105 active:scale-95 text-[10px] sm:text-xs whitespace-nowrap ml-auto sm:ml-1 shadow-sm shrink-0">
                  {t('landing.claimOffer')}
                </Link>
             </div>

             {/* Close button */}
             <button onClick={() => setShowBanner(false)} className="text-black/50 hover:text-black transition-colors p-1 flex-shrink-0" aria-label="Close banner">
               <X className="h-4 w-4" />
             </button>
          </div>
        )}

        <div className="w-full h-20 bg-white">
          <nav className="flex max-w-7xl mr-auto ml-auto h-full px-6 items-center justify-between">
            {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center justify-center" prefetch={false} onClick={() => setIsMobileMenuOpen(false)}>
              <img src={AppConfig.logoUrl} alt="Zeneva Logo" className="h-16 w-auto" />
            </Link>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex gap-8 items-center">
            {navLinks.map((link) => {
              const isActive = (pathname === link.href) || (link.href === '/blog' && pathname.startsWith('/blog')) || (link.href === '/about/our-mission' && pathname.startsWith('/about'));
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "transition-colors text-base font-medium tracking-tight font-dm-sans hover:text-black",
                    isActive ? "text-black font-semibold" : "text-slate-700"
                  )}
                >
                  {t(link.labelKey)}
                </a>
              )
            })}
          </div>

          {/* Actions & Mobile Toggle */}
          <div className="flex items-center gap-2">
            {/* Visitors switch language before they ever sign up, so this sits in the public header. */}
            <LanguageSwitcherCompact className="h-9 w-auto min-w-[6.5rem] justify-between font-normal bg-white hover:bg-slate-50 hover:text-slate-900 border-stone-200 px-2.5 text-sm rounded-md text-slate-900" />
            <div className="hidden sm:flex items-center gap-4">
              {mounted && user ? (
                <>
                  <Link href="/sales/pos/select-products" className="hover:bg-[#0f172a] transition-colors text-sm font-medium text-white tracking-tight font-dm-sans bg-[#1e293b] rounded-md pt-2.5 pr-5 pb-2.5 pl-5 shadow-sm">{t('nav.dashboard')}</Link>
                  <Button onClick={handleLogout} variant="outline" size="sm">
                    <LogOut className="me-2 h-4 w-4" />
                    {t('common.signOut')}
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login" className="transition-colors text-sm font-medium bg-[#ffffff] border rounded-md px-3 py-2 font-dm-sans tracking-tight hover:text-slate-600 text-slate-900 border-stone-200">{t('common.signIn')}</Link>
                  <Link href="/signup" className="hover:bg-[#0f172a] transition-colors text-sm font-medium text-white tracking-tight font-dm-sans bg-[#1e293b] rounded-md pt-2.5 pr-5 pb-2.5 pl-5 shadow-sm">{t('common.getStarted')}</Link>
                </>
              )}
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-900 hover:text-black transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6 transition-transform duration-300 ease-in-out hover:rotate-90" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
          </nav>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      <div className={cn(
        "md:hidden fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur-sm overflow-y-auto transition-all duration-300 ease-in-out",
        showBanner ? "top-[calc(128px+var(--tauri-title-height,0px))]" : "top-[calc(80px+var(--tauri-title-height,0px))]",
        isMobileMenuOpen ? "translate-y-0 opacity-100 visible" : "-translate-y-full opacity-0 invisible"
      )}>
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col items-center">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-4 text-lg font-medium text-slate-700 tracking-tight font-dm-sans hover:text-black border-b-2 border-dashed border-slate-200"
              >
                {t(link.labelKey)}
              </a>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-4">
            {mounted && user ? (
              <>
                <Link href="/sales/pos/select-products" onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center hover:bg-[#0f172a] transition-colors text-base font-medium text-white tracking-tight font-dm-sans bg-[#1e293b] rounded-md py-3 px-5 shadow-sm">{t('nav.dashboard')}</Link>
                <Button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} variant="outline" size="lg">
                  <LogOut className="me-2 h-4 w-4" />
                  {t('common.signOut')}
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center transition-colors text-base font-medium bg-[#ffffff] border rounded-md py-3 px-5 font-dm-sans tracking-tight hover:text-slate-600 text-slate-900 border-stone-200">{t('common.signIn')}</Link>
                <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center hover:bg-[#0f172a] transition-colors text-base font-medium text-white tracking-tight font-dm-sans bg-[#1e293b] rounded-md py-3 px-5 shadow-sm">{t('common.getStarted')}</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
