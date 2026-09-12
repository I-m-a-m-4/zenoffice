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
            What we collect, why we collect it, and how you stay in control.
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
                Welcome to Zeneva ("we," "us," or "our"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our software-as-a-service platform (the "Service"). Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the service.
              </p>

              <div className="not-prose my-8 p-5 rounded-2xl border bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-3 font-medium text-slate-800 dark:text-slate-200">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <div>
                    Zeneva Retail OS is operated by <strong className="text-primary">ZENEVATECH SOLUTIONS</strong>
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
                We may collect information about you in a variety of ways. The information we may collect via the Service includes:
              </p>
              
              <h3>A. Personal Data</h3>
              <p>
                Personally identifiable information, such as your <strong>name, email address, and telephone number</strong>, that you voluntarily give to us when you register with the Service or when you choose to participate in various activities related to the Service.
              </p>
              
              <h3>B. Business Data</h3>
              <p>
                Information related to your business that you provide or generate, including but not limited to:
              </p>
              <ul>
                <li>Product details (names, SKUs, prices, stock levels, images)</li>
                <li>Sales transaction records (receipts, items sold, totals)</li>
                <li>Customer information (names, emails, phone numbers, purchase history)</li>
                <li>Business settings and configurations</li>
              </ul>
              <p>
                <strong>This Business Data is considered your confidential property. We will not use it for any purpose other than providing and improving the Service.</strong>
              </p>
              
              <h3>C. Derivative Data</h3>
              <p>
                Information our servers automatically collect when you access the Service, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the Service.
              </p>

              <h3>D. Device Permissions (Camera)</h3>
              <p>
                We may request access or permission to certain features from your mobile device, including your device's camera. The camera is used solely to scan barcodes and product QR codes during checkout and inventory actions. Image frames processed by the camera are analyzed locally on your device in real-time and are never uploaded, stored, or shared on our servers.
              </p>
            </div>

            <div id="use" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>How we use it</h2>
              <p>
                Having accurate information permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Service to:
              </p>
              <ul>
                <li>Create and manage your account.</li>
                <li>Process your transactions and subscriptions.</li>
                <li>Provide you with the core functionality of inventory management, POS, and CRM.</li>
                <li>Email you regarding your account or order.</li>
                <li>Monitor and analyze usage and trends to improve your experience with the Service.</li>
                <li>Notify you of updates to the Service.</li>
                <li>Provide customer support and respond to your requests.</li>
              </ul>
            </div>

            <div id="share" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Disclosure</h2>
              <p>
                We do not share, sell, rent, or trade your Personal Data or Business Data with third parties for their commercial purposes. We may share information we have collected about you in certain situations:
              </p>
              <ul>
                <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others.</li>
                <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us, including local and international payment processing (Paystack), data analysis, email delivery, and hosting services.</li>
                <li><strong>Business Transfers:</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
              </ul>
            </div>

            <div id="security" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Data Security</h2>
              <p>
                We use administrative, technical, and physical security measures to protect your personal information and Business Data. This includes:
              </p>
              <ul>
                <li><strong>Enterprise-Grade Cloud Infrastructure:</strong> Zeneva is securely hosted on Google Cloud and Firebase. Our infrastructure complies with rigorous international security standards, including <strong>ISO/IEC 27001, 27017, and 27018</strong> certifications, and undergoes regular <strong>AICPA SOC 2 and SOC 3</strong> audits.</li>
                <li><strong>GDPR & HIPAA Readiness:</strong> Our backend architecture provides the data controls necessary to help your business meet stringent privacy regulations like GDPR (General Data Protection Regulation) and HIPAA (Health Insurance Portability and Accountability Act), including comprehensive data export and erasure capabilities.</li>
                <li><strong>Encryption at Rest:</strong> Sensitive business and transaction data is protected using 256-bit AES bank-grade encryption to ensure information remains confidential even when stored locally.</li>
                <li><strong>Secure Transmission:</strong> All data transmitted between your device and our servers is encrypted using industry-standard SSL/TLS protocols.</li>
                <li><strong>Multi-Tenant Isolation:</strong> We use strict logical boundaries to ensure your data is accessible only by you and your authorized staff.</li>
              </ul>
            </div>

            <div id="rights" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Your Rights</h2>
              <p>
                You have the right to:
              </p>
              <ul>
                <li>Review or change the information in your account by logging into your account settings and updating your account.</li>
                <li>Terminate your account, which will result in the deletion of your Personal Data and the archiving or deletion of your Business Data according to our data retention policies.</li>
                <li><strong>Request Data Deletion:</strong> You can request the complete deletion of your account and all associated personal and business data at any time by emailing us at <strong>zenevapos@gmail.com</strong>. Upon receiving your request, we will verify your identity and delete all your hosted data from our active databases within 30 days.</li>
              </ul>
            </div>

            <div id="contact" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Contact Us</h2>
              <p>
                If you have questions or comments about this Privacy Policy, or if you need to request data deletion, please contact us at:
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
