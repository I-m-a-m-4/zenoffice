'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppConfig } from '@/lib/config';
import { Menu, X } from 'lucide-react';

export default function ZenOfficeHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#F9F8F6]/95 dark:bg-stone-950/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-600 text-white shadow-sm transition-transform group-hover:scale-105">
            <img src={AppConfig.logoIconUrl || '/zenoffice-icon.svg'} alt="ZenOffice" className="w-5 h-5 brightness-0 invert" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-dm-sans">
            ZenOffice
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300 font-dm-sans">
          <Link href="/#product" className="transition-colors hover:text-orange-600 dark:hover:text-orange-400">
            Features
          </Link>
          <Link href="/#platform" className="transition-colors hover:text-orange-600 dark:hover:text-orange-400">
            Platform
          </Link>
          <Link href="/#customers" className="transition-colors hover:text-orange-600 dark:hover:text-orange-400">
            Security &amp; Privacy
          </Link>
          <Link href="/#pricing" className="transition-colors hover:text-orange-600 dark:hover:text-orange-400">
            Pricing
          </Link>
          <Link href="/legal/privacy-policy" className="transition-colors hover:text-orange-600 dark:hover:text-orange-400">
            Privacy Policy
          </Link>
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/login"
            className="transition-colors text-sm font-medium bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-md px-3.5 py-2 font-dm-sans tracking-tight hover:text-slate-900 dark:hover:text-white text-slate-700 dark:text-slate-300 shadow-xs"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="hover:bg-[#C2410C] transition-colors text-sm font-medium text-white tracking-tight font-dm-sans bg-[#EA580C] rounded-md px-4 py-2 shadow-xs"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-stone-200 dark:border-stone-800 bg-[#F9F8F6] dark:bg-stone-950 px-6 py-4 space-y-3 font-dm-sans">
          <Link
            href="/#product"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-orange-600"
          >
            Features
          </Link>
          <Link
            href="/#platform"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-orange-600"
          >
            Platform
          </Link>
          <Link
            href="/#customers"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-orange-600"
          >
            Security &amp; Privacy
          </Link>
          <Link
            href="/#pricing"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-orange-600"
          >
            Pricing
          </Link>
          <Link
            href="/legal/privacy-policy"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-orange-600"
          >
            Privacy Policy
          </Link>
          <Link
            href="/legal/terms-of-service"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-orange-600"
          >
            Terms of Service
          </Link>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-center py-2 text-sm font-medium border border-stone-300 dark:border-stone-700 rounded-md bg-white dark:bg-stone-900 text-slate-800 dark:text-slate-200"
            >
              Login
            </Link>
            <Link
              href="/signup"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-center py-2 text-sm font-medium bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-md shadow-xs"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
