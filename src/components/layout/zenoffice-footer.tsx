'use client';

import React from 'react';
import Link from 'next/link';
import { AppConfig } from '@/lib/config';

export default function ZenOfficeFooter() {
  return (
    <footer className="bg-stone-950 w-full max-w-none text-stone-300" id="contact">
      <div className="overflow-hidden max-w-7xl mx-auto pt-14 pr-8 pb-10 pl-8">
        {/* Top brand summary */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12 border-b border-white/10">
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex cursor-pointer mb-5 gap-x-2.5 items-center">
              <div className="flex w-8 h-8 rounded-lg items-center justify-center text-slate-50 bg-orange-600 shadow-xs">
                <img src={AppConfig.logoIconUrl || '/zenoffice-icon.svg'} alt="ZenOffice" className="w-5 h-5 brightness-0 invert" />
              </div>
              <span className="text-xl font-semibold tracking-tight font-dm-sans text-slate-50">
                ZenOffice
              </span>
            </Link>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-400">
              ZenOffice is the modern AI document workspace designed for speed, privacy, and effortless document management. Read, edit, annotate, and analyze PDFs, Word documents, and Excel spreadsheets in one unified application.
            </p>
          </div>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 pt-12">
          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] font-semibold text-white/80">Product</h4>
            <ul className="mt-3.5 space-y-2.5 text-sm">
              <li>
                <Link href="/editor/pdf" className="transition text-neutral-400 hover:text-white">
                  PDF Editor &amp; Tools
                </Link>
              </li>
              <li>
                <Link href="/editor/document" className="transition text-neutral-400 hover:text-white">
                  Word &amp; Document Reader
                </Link>
              </li>
              <li>
                <Link href="/editor/excel" className="transition text-neutral-400 hover:text-white">
                  Excel &amp; Spreadsheet Viewer
                </Link>
              </li>
              <li>
                <Link href="/zen-ai" className="transition text-neutral-400 hover:text-white">
                  Zen AI Academic Assistant
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] font-semibold text-white/80">Security &amp; Legal</h4>
            <ul className="mt-3.5 space-y-2.5 text-sm">
              <li>
                <Link href="/#customers" className="transition text-neutral-400 hover:text-white">
                  Local-First Encryption
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy-policy" className="transition text-neutral-400 hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms-of-service" className="transition text-neutral-400 hover:text-white">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] font-semibold text-white/80">Navigation</h4>
            <ul className="mt-3.5 space-y-2.5 text-sm">
              <li>
                <Link href="/#platform" className="transition text-neutral-400 hover:text-white">
                  About ZenOffice
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="transition text-neutral-400 hover:text-white">
                  Plans &amp; Pricing
                </Link>
              </li>
              <li>
                <Link href="/#contact" className="transition text-neutral-400 hover:text-white">
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="uppercase text-xs tracking-[0.2em] font-semibold text-white/80">Support</h4>
            <p className="mt-3.5 text-xs text-neutral-400 leading-relaxed">
              Have questions, feedback, or need help with ZenOffice? Our support team is here for you.
            </p>
            <div className="mt-3">
              <a href="mailto:support@usezenoffice.app" className="text-xs text-orange-400 hover:underline font-mono">
                support@usezenoffice.app
              </a>
            </div>
          </div>
        </div>

        {/* Bottom copyright bar */}
        <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-white/10 text-xs text-white/60">
          <p>© {new Date().getFullYear()} ZenOffice by Bimex. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy-policy" className="transition hover:text-white">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/legal/terms-of-service" className="transition hover:text-white">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
