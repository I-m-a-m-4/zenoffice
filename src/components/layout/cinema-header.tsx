
'use client';

import { useUser } from '@/firebase';
import Link from "next/link";
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Menu, X, LogOut, Download, Home, User, CreditCard, Newspaper, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AppConfig } from '@/lib/config';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';

export default function CinemaHeader({ threshold = 50 }: { threshold?: number }) {
  const { user } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > threshold) {
        setScrolled(true);
    } else {
        setScrolled(false);
    }
  });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => {
        toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
        router.push('/');
      })
      .catch(() => {
        toast({ variant: 'destructive', title: 'Logout Failed' });
      });
  };

  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/download", label: "Download", icon: Download },
    { href: "/about/our-mission", label: "Our Mission", icon: User },
    { href: "/pricing", label: "Pricing", icon: CreditCard },
    { href: "/blog", label: "Blog", icon: Newspaper },
    { href: "/contact", label: "Contact", icon: Mail },
  ];

  return (
    <>
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-[100] transition-all duration-500",
          scrolled ? "h-16 bg-white border-b border-slate-200 shadow-md" : "h-24 bg-transparent"
        )}
      >
        <nav className="max-w-[1400px] mx-auto h-full px-6 md:px-12 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <div className="transition-all duration-300">
                <img 
                    src={AppConfig.logoUrl} 
                    alt="Zeneva Logo" 
                    className={cn(
                        "w-auto transition-all duration-300",
                        scrolled ? "h-14" : "h-16",
                        !scrolled && "[filter:invert(41%)_sepia(85%)_saturate(3062%)_hue-rotate(4deg)_brightness(101%)_contrast(101%)]"
                    )} 
                />
            </div>
          </Link>

          {/* Trigger Button (The Grid icon from image) */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
                "w-12 h-12 flex items-center justify-center rounded-md transition-all duration-300 shadow-sm border border-slate-200",
                isMenuOpen ? "bg-orange-600 text-white border-transparent" : 
                scrolled ? "bg-slate-950 text-white border-transparent" : "bg-white text-slate-950 hover:scale-110"
            )}
          >
            {isMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </nav>
      </motion.header>

      {/* Android-style Slide Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-[90] bg-slate-950/40 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-[100] w-full max-w-sm bg-white shadow-2xl flex flex-col"
            >
                {/* Header of Drawer */}
                <div className="p-6 flex items-center justify-between border-b border-dashed border-slate-200">
                    <img 
                        src={AppConfig.logoUrl} 
                        alt="Zeneva Logo" 
                        className="h-8 w-auto [filter:invert(41%)_sepia(85%)_saturate(3062%)_hue-rotate(4deg)_brightness(101%)_contrast(101%)]" 
                    />
                    <button 
                        onClick={() => setIsMenuOpen(false)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-950 hover:bg-slate-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation Links List (Dashed) */}
                <div className="flex-grow overflow-y-auto px-6 py-8">
                    <div className="flex flex-col gap-0 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden">
                        {navLinks.map((link, idx) => (
                            <Link 
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsMenuOpen(false)}
                                className="group flex items-center gap-4 p-5 hover:bg-slate-50 transition-all border-b last:border-b-0 border-dashed border-slate-200"
                            >
                                <div className="w-10 h-10 rounded-lg bg-orange-600/10 flex items-center justify-center group-hover:bg-orange-600 transition-all">
                                    <link.icon className="w-4 h-4 text-orange-600 group-hover:text-white" />
                                </div>
                                <span className="text-sm font-display font-medium text-slate-950 tracking-tight uppercase">{link.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-8 border-t-2 border-dashed border-slate-200 bg-slate-50/50">
                    <div className="flex flex-col gap-4">
                        {mounted && user ? (
                            <>
                                <Link 
                                    href="/sales/pos/select-products"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="w-full text-center hover:bg-[#0f172a] transition-colors text-xs font-bold text-white tracking-[0.2em] font-dm-sans bg-[#1e293b] rounded-md py-4 shadow-sm uppercase"
                                >
                                    Dashboard
                                </Link>
                                <button 
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-center transition-colors text-xs font-bold bg-white border rounded-md py-4 font-dm-sans tracking-[0.2em] hover:text-slate-600 text-slate-950 border-slate-200 uppercase"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link 
                                    href="/signup"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="w-full text-center hover:bg-[#0f172a] transition-colors text-xs font-bold text-white tracking-[0.2em] font-dm-sans bg-[#1e293b] rounded-md py-4 shadow-sm uppercase"
                                >
                                    Get Started
                                </Link>
                                <Link 
                                    href="/login"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="w-full text-center transition-colors text-xs font-bold bg-white border rounded-md py-4 font-dm-sans tracking-[0.2em] hover:text-slate-600 text-slate-950 border-slate-200 uppercase"
                                >
                                    Login
                                </Link>
                            </>
                        )}
                    </div>
                    
                    <div className="mt-8 text-center">
                        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em] mb-1">Architecture: V1.7.0</div>
                        <div className="text-[9px] font-mono text-slate-950/30 uppercase">Secure Transmission Protocol</div>
                    </div>
                </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
