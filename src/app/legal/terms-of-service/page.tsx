'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const sections = [
  { id: 'acceptance', num: 'I', label: 'Acceptance of Terms' },
  { id: 'description', num: 'II', label: 'Description of Service' },
  { id: 'accounts', num: 'III', label: 'User Accounts' },
  { id: 'billing', num: 'IV', label: 'Subscriptions and Billing' },
  { id: 'conduct', num: 'V', label: 'User Conduct' },
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
            The rules and guidelines for using the Zeneva Retail OS platform.
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
                By accessing or using the Zeneva software-as-a-service platform (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. These Terms apply to all users of the Service, including administrators, managers, and operators ("Users").
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

            <div id="description" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Description of Service</h2>
              <p>
                Zeneva provides a comprehensive business management platform that includes inventory management, a Point of Sale (POS) system, customer relationship management (CRM), sales analytics, and an optional public-facing e-commerce storefront.
              </p>
              <p>
                <strong>Security and Compliance:</strong> We are committed to providing a highly secure environment for your business data. The Service is hosted on enterprise-grade infrastructure that maintains strict international security certifications, including <strong>ISO/IEC 27001</strong>, and undergoes regular <strong>AICPA SOC 2</strong> and <strong>SOC 3</strong> audits. The platform also provides the necessary administrative and technical safeguards to support <strong>GDPR</strong> and <strong>HIPAA</strong> compliance requirements.
              </p>
            </div>
            
            <div id="accounts" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>User Accounts</h2>
              <p>
                To use the Service, you must register for an account. You are responsible for maintaining the confidentiality of your account password and for all activities that occur under your account. You agree to:
              </p>
              <ul>
                <li>Provide true, accurate, current, and complete information about yourself as prompted by the registration form.</li>
                <li>Promptly update your registration data to keep it true, accurate, current, and complete.</li>
                <li>Immediately notify us of any unauthorized use of your password or account or any other breach of security.</li>
              </ul>
            </div>

            <div id="billing" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Subscriptions and Billing</h2>
              <p>
                The Service is offered under various subscription plans.
              </p>
              <ul>
                <li><strong>Free Starter Plan:</strong> The 'Starter' tier is free of charge and does not expire. No trial period applies and no payment details are required to use it. If a paid subscription ('Pro' or 'Business') is not renewed, the business instance reverts to the free 'Starter' tier — access to your existing data, including products, sales history and receipts, is retained, and only paid-tier features become unavailable until the subscription is renewed.</li>
                <li><strong>Billing:</strong> Fees for paid plans are billed on a subscription basis (e.g., monthly, annually). You will be billed in advance on a recurring, periodic basis.</li>
                <li><strong>Payment:</strong> We use a third-party payment processor (Paystack) to handle payments. By subscribing, you agree to their terms and conditions.</li>
                <li><strong>Cancellation:</strong> You may cancel your subscription at any time through your account's billing page. The cancellation will take effect at the end of the current billing cycle.</li>
              </ul>
            </div>

            <div id="conduct" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>User Conduct and Responsibilities</h2>
              <p>
                You are solely responsible for all data, information, and content that you upload, post, or otherwise transmit via the Service ("Your Content"). You agree not to use the Service to:
              </p>
              <ul>
                <li>Upload or transmit any content that is unlawful, harmful, or infringes on the rights of others.</li>
                <li>Impersonate any person or entity or falsely state or otherwise misrepresent your affiliation with a person or entity.</li>
                <li>Interfere with or disrupt the Service or servers or networks connected to the Service.</li>
              </ul>
              <p>
                You retain all ownership rights to Your Content. We do not claim any ownership rights over Your Content.
              </p>
            </div>

            <div id="intellectual" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Intellectual Property</h2>
              <p>
                The Service and its original content (excluding Your Content), features, and functionality are and will remain the exclusive property of Zeneva and its licensors. The Service is protected by copyright, trademark, and other laws of both Nigeria and foreign countries.
              </p>
            </div>

            <div id="termination" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Termination</h2>
              <p>
                We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. If you wish to terminate your account, you may do so from the "Danger Zone" section in your settings page.
              </p>
            </div>

            <div id="disclaimer" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Disclaimer of Warranties</h2>
              <p>
                The Service is provided on an "AS IS" and "AS AVAILABLE" basis. Your use of the Service is at your sole risk. We expressly disclaim all warranties of any kind, whether express or implied, including, but not limited to, the implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
              </p>
            </div>

            <div id="liability" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Limitation of Liability</h2>
              <p>
                In no event shall Zeneva, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage.
              </p>
            </div>

            <div id="governing" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Governing Law</h2>
              <p>
                These Terms shall be governed and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to its conflict of law provisions.
              </p>
            </div>

            <div id="changes" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Changes to Terms</h2>
              <p>
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide at least 30 days' notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
              </p>
            </div>

            <div id="contact" className="scroll-mt-28 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800/50">
              <h2>Contact Us</h2>
              <p>
                If you have any questions about these Terms, please contact us at:
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
