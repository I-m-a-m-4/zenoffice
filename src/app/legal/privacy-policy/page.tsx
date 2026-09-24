'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const sections = [
  { id: 'intro', num: 'I', label: 'Introduction' },
  { id: 'collect', num: 'II', label: 'What we collect' },
  { id: 'use', num: 'III', label: 'How we use it' },
  { id: 'share', num: 'IV', label: 'Disclosure' },
  { id: 'security', num: 'V', label: 'Data Security' },
  { id: 'rights', num: 'VI', label: 'Your Rights' },
  { id: 'contact', num: 'VII', label: 'Contact Us' },
];

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState('intro');

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
            Privacy <span className="text-primary text-5xl sm:text-[70px] italic">Policy</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[640px] text-lg leading-[26px] tracking-[-0.4px] text-slate-500 dark:text-slate-400">
            What we collect, how your documents are protected, and how you stay in complete control.
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
            <div id="intro" className="scroll-mt-32">
              <h2>Introduction</h2>
              <p>
                Welcome to <strong>Zen Office</strong> ("we," "us," or "our"). We are committed to protecting your privacy and ensuring the security of your documents and workspace. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our document reading, editing, and office management platform (the "Service"). Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the service.
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

            <div id="collect" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>What we collect</h2>
              <p>
                We collect information to provide and enhance your document editing and management experience:
              </p>
              
              <h3>A. Account Data</h3>
              <p>
                Personally identifiable information, such as your <strong>name, email address, and profile preferences</strong>, provided voluntarily during registration.
              </p>
              
              <h3>B. Document Data & Files</h3>
              <p>
                Information related to the documents, spreadsheets, PDFs, and files you create, edit, or upload to the Service:
              </p>
              <ul>
                <li>Document files (PDFs, Word files, Excel spreadsheets, text notes)</li>
                <li>Document metadata (file names, sizes, creation/edit timestamps, annotations)</li>
                <li>User workspace settings and preference configurations</li>
              </ul>
              <p>
                <strong>Your Document Content is your strict confidential property. Zen Office processes your files locally on your device or via encrypted vault sync. We never read, monetize, or train external AI models on your private documents.</strong>
              </p>
              
              <h3>C. Derivative & Telemetry Data</h3>
              <p>
                System logs automatically collected when accessing the Service, including browser type, operating system, application performance metrics, and feature usage counts.
              </p>

              <h3>D. Device Permissions (Camera & Filesystem)</h3>
              <p>
                Local app features may request device camera access (e.g., to scan physical document QR codes or capture paper pages into PDF) and storage access (to open and save local files). Camera feeds and local storage processing remain entirely on your device and are never broadcast or shared.
              </p>
            </div>

            <div id="use" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>How we use it</h2>
              <p>
                We use the collected information solely to provide a reliable, high-performance workspace experience:
              </p>
              <ul>
                <li>Create and secure your account across your desktop and mobile devices.</li>
                <li>Provide core functionality: PDF viewing, Word document editing, Excel spreadsheet processing, and file management.</li>
                <li>Synchronize document edits securely across your authorized devices.</li>
                <li>Send essential operational updates, account alerts, and security notifications.</li>
                <li>Diagnose performance issues, optimize local storage caching, and improve UI responsiveness.</li>
                <li>Provide dedicated customer support and address technical inquiries.</li>
              </ul>
            </div>

            <div id="share" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Disclosure</h2>
              <p>
                We do not sell, rent, or trade your personal data or document content to third parties. We may disclose information only under the following limited circumstances:
              </p>
              <ul>
                <li><strong>By Law or Legal Process:</strong> When required to comply with valid legal obligations, subpoenas, or official court orders.</li>
                <li><strong>Infrastructure Service Providers:</strong> Trusted third-party vendors performing necessary backend services on our behalf (e.g., Google Cloud/Firebase for encrypted data storage, Resend for email delivery, and Paystack for subscription billing).</li>
                <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of company assets, subject to strict confidentiality agreements.</li>
              </ul>
            </div>

            <div id="security" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Data Security</h2>
              <p>
                We implement robust administrative, technical, and local encryption controls to protect your documents:
              </p>
              <ul>
                <li><strong>Enterprise Cloud Security:</strong> Hosted on Google Cloud and Firebase with strict international compliance certifications, including <strong>ISO/IEC 27001, 27017, 27018</strong>, and <strong>AICPA SOC 2/3</strong> audits.</li>
                <li><strong>Local-First Encryption:</strong> Offline document vaults and application credentials are stored locally with 256-bit AES encryption.</li>
                <li><strong>Encrypted Transmission:</strong> All data exchanged between client applications and cloud sync servers uses TLS 1.3/SSL encryption.</li>
                <li><strong>Multi-Tenant Isolation:</strong> Logical boundaries guarantee that your document workspace is accessible exclusively by your authenticated account.</li>
              </ul>
            </div>

            <div id="rights" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Your Rights & Data Control</h2>
              <p>
                You retain complete control over your account and files:
              </p>
              <ul>
                <li><strong>Access & Export:</strong> You can download or export your documents and data at any time in standard formats (PDF, XLSX, DOCX, JSON).</li>
                <li><strong>Account Termination & Data Deletion:</strong> You can request complete deletion of your account and hosted files by emailing <strong>zenevapos@gmail.com</strong>. Upon request, all hosted records will be permanently erased from our active servers within 30 days.</li>
              </ul>
            </div>

            <div id="contact" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Contact Us</h2>
              <p>
                If you have questions regarding this Privacy Policy or wish to submit a data request, please reach out to us at:
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

