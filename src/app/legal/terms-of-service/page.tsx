'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const sections = [
  { id: 'acceptance', num: 'I', label: 'Acceptance of Terms' },
  { id: 'description', num: 'II', label: 'Description of Service' },
  { id: 'accounts', num: 'III', label: 'User Accounts' },
  { id: 'billing', num: 'IV', label: 'Subscriptions and Billing' },
  { id: 'conduct', num: 'V', label: 'User Conduct & Content' },
  { id: 'intellectual', num: 'VI', label: 'Intellectual Property' },
  { id: 'termination', num: 'VII', label: 'Termination' },
  { id: 'disclaimer', num: 'VIII', label: 'Disclaimer of Warranties' },
  { id: 'liability', num: 'IX', label: 'Limitation of Liability' },
  { id: 'governing', num: 'X', label: 'Governing Law' },
  { id: 'changes', num: 'XI', label: 'Changes to Terms' },
  { id: 'contact', num: 'XII', label: 'Contact Us' },
];

export default function TermsOfServicePage() {
  const [activeSection, setActiveSection] = useState('acceptance');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -80% 0px' }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 pb-12 pt-24 md:pb-16 md:pt-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
          <div 
            aria-hidden="true" 
            className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-20" 
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(21,17,14,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(21,17,14,0.1) 1px, transparent 1px)',
              backgroundSize: '44px 44px'
            }}
          />
        </div>
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-4 py-1.5 font-medium lowercase tracking-[0.14em] text-slate-500 dark:text-slate-400 backdrop-blur-sm text-[19px]">
              legal
            </span>
          </div>
          <h1 className="mx-auto mt-6 max-w-[680px] text-4xl font-bold tracking-[-0.04em] sm:text-[54px] sm:leading-[1.15]">
            Terms of <span className="text-primary text-5xl sm:text-[70px] italic">Service</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[640px] text-lg leading-[26px] tracking-[-0.4px] text-slate-500 dark:text-slate-400">
            The rules and guidelines for using the Zen Office document platform.
          </p>
          <p className="mt-5 text-sm tracking-[-0.3px] text-slate-500 dark:text-slate-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
          
          {/* Sidebar Navigation */}
          <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            {/* Mobile Horizontal Nav */}
            <nav aria-label="Page sections" className="-mx-6 max-w-[calc(100%+3rem)] overflow-x-auto px-6 pb-4 lg:hidden no-scrollbar">
              <div className="flex min-w-max gap-2">
                {sections.map(({ id, num, label }) => (
                  <Link
                    key={id}
                    href={`#${id}`}
                    className={`rounded-full border px-3.5 py-1.5 text-sm tracking-[-0.2px] transition-colors whitespace-nowrap ${
                      activeSection === id 
                        ? 'border-primary bg-primary/5 text-primary font-medium' 
                        : 'border-dashed border-slate-200 dark:border-slate-800 bg-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="me-1.5 opacity-60 font-mono text-xs">{num}</span>
                    {label}
                  </Link>
                ))}
              </div>
            </nav>

            {/* Desktop Vertical Nav */}
            <nav aria-label="Page sections" className="hidden lg:flex flex-col border-l-2 border-slate-100 dark:border-slate-800/50">
              {sections.map(({ id, num, label }) => (
                <Link
                  key={id}
                  href={`#${id}`}
                  className={`group relative py-2.5 pl-4 pr-3 text-sm transition-colors ${
                    activeSection === id 
                      ? 'text-primary font-medium' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {/* Active Indicator Line */}
                  <span 
                    className={`absolute inset-y-0 left-[-2px] w-[2px] transition-all ${
                      activeSection === id ? 'bg-primary' : 'bg-transparent group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                    }`} 
                  />
                  <span className="me-2 inline-block w-4 opacity-50 font-mono text-xs">{num}</span>
                  {label}
                </Link>
              ))}
            </nav>
          </aside>

          {/* Content Area */}
          <div className="min-w-0 prose prose-slate dark:prose-invert max-w-none lg:prose-lg prose-headings:scroll-mt-28">
            <div id="acceptance" className="scroll-mt-32">
              <h2>Acceptance of Terms</h2>
              <p>
                By accessing or using the <strong>Zen Office</strong> platform (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. These Terms apply to all users of the Service, including account holders, workspace members, and administrators.
              </p>

              <div className="not-prose my-8 p-5 rounded-2xl border bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-3 font-medium text-slate-800 dark:text-slate-200">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <div>
                    Zen Office is operated by <strong className="text-primary">ZENEVATECH SOLUTIONS</strong>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">CAC Registered Entity — BN: 9673520</div>
                  </div>
                </div>
                <div className="text-slate-500 dark:text-slate-400 font-mono text-xs bg-white dark:bg-slate-950 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-800">
                  zenevapos@gmail.com
                </div>
              </div>
            </div>

            <div id="description" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Description of Service</h2>
              <p>
                Zen Office provides an integrated, local-first document workspace application featuring PDF viewing and editing, Word document processing, Excel spreadsheet editing, document annotation, and optional encrypted cloud backup.
              </p>
              <p>
                <strong>Security and Infrastructure:</strong> The Service is hosted on enterprise-grade cloud infrastructure meeting international security benchmarks, including <strong>ISO/IEC 27001</strong> and <strong>AICPA SOC 2/3</strong> audits.
              </p>
            </div>
            
            <div id="accounts" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>User Accounts</h2>
              <p>
                To access cloud sync and advanced workspace features, you must register for an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You agree to:
              </p>
              <ul>
                <li>Provide accurate information during account registration.</li>
                <li>Keep your account information current and secure.</li>
                <li>Notify us immediately of any unauthorized account access or security breach.</li>
              </ul>
            </div>

            <div id="billing" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Subscriptions and Billing</h2>
              <p>
                Zen Office is offered under tiered service options:
              </p>
              <ul>
                <li><strong>Free Starter Tier:</strong> Free of charge and non-expiring. Includes full local document viewing, PDF reading, and basic document tools with zero payment required.</li>
                <li><strong>Paid Tiers:</strong> Premium subscriptions (monthly or annual) unlock advanced cloud vault sync, AI document insights, and expanded export features.</li>
                <li><strong>Payment & Cancellation:</strong> Subscription payments are processed via Paystack. You may cancel subscription renewals at any time from your billing settings.</li>
              </ul>
            </div>

            <div id="conduct" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>User Conduct & Document Ownership</h2>
              <p>
                You retain 100% full ownership rights to all documents, files, data, and content you create, view, or upload via Zen Office ("Your Content"). Zen Office makes no claim of ownership over your private documents.
              </p>
              <p>
                You agree not to use the Service to:
              </p>
              <ul>
                <li>Distribute illegal, harmful, or malicious files.</li>
                <li>Attempt to bypass local encryption controls or compromise platform servers.</li>
                <li>Interfere with network connectivity or cloud synchronization services.</li>
              </ul>
            </div>

            <div id="intellectual" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Intellectual Property</h2>
              <p>
                The Zen Office application software, branding, UI components, code, and trademarks are the exclusive property of ZENEVATECH SOLUTIONS and its licensors.
              </p>
            </div>

            <div id="termination" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Termination</h2>
              <p>
                You may terminate your account at any time. We reserve the right to suspend or terminate accounts that breach these Terms or engage in illegal software manipulation.
              </p>
            </div>

            <div id="disclaimer" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Disclaimer of Warranties</h2>
              <p>
                The Service is provided "AS IS" and "AS AVAILABLE." While we prioritize data safety and offline reliability, users are advised to maintain independent backups of critical files.
              </p>
            </div>

            <div id="liability" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Zen Office and ZENEVATECH SOLUTIONS shall not be liable for indirect, incidental, or consequential damages resulting from platform use or file handling.
              </p>
            </div>

            <div id="governing" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Governing Law</h2>
              <p>
                These Terms are governed by the laws of the Federal Republic of Nigeria.
              </p>
            </div>

            <div id="changes" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Changes to Terms</h2>
              <p>
                We may revise these Terms from time to time. Continued use of the platform after updates take effect constitutes acceptance of revised terms.
              </p>
            </div>

            <div id="contact" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Contact Us</h2>
              <p>
                If you have questions about these Terms of Service, please contact us at:
              </p>
              <div className="not-prose mt-6 flex items-center gap-3 text-primary font-medium bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 w-fit">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                zenevapos@gmail.com
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

