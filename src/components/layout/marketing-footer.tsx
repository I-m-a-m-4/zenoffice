'use client';
import { Check, Linkedin, Mail, Phone, Send, Twitter, Loader2, Instagram } from "lucide-react";
import BackToTopButton from '@/components/back-to-top-button';
import Link from "next/link";
import Image from "next/image";
import React, { useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { sendContactFormEmail } from '@/lib/email';
import { AppConfig } from "@/lib/config";
import { useI18n } from '@/context/i18n-context';

export default function MarketingFooter() {
  const form = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const { t } = useI18n();

  const microsoftStoreUrl = "https://apps.microsoft.com/detail/9nvn0f8njwmj?hl=en-US&gl=NG&ocid=pdpshare";
  const googlePlayStoreUrl = "https://play.google.com/store/apps/details?id=com.zeneva.app&hl=en-US&ah=8ZdJB3DBf5hWEO6U2hBOws2DuyY";

  const sendEmail = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.current) return;
    setIsSending(true);

    sendContactFormEmail(form.current)
      .then((result) => {
        toast({ variant: 'success', title: t('footer.sentTitle'), description: t('footer.sentBody') });
        form.current?.reset();
      }, (error) => {
        toast({ variant: 'destructive', title: t('footer.sendFailedTitle'), description: error.message || t('footer.sendFailedBody') });
      })
      .finally(() => {
        setIsSending(false);
      });
  };

  return (
    <footer id="contact" className="bg-stone-950 w-full relative">
      {/* Curvy Top Border */}
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0] -translate-y-[calc(100%-2px)]">
        <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="relative block w-full h-[30px] md:h-[50px] fill-stone-950">
          <path d="M0,20 L0,11 Q6.25,3 12.5,11 Q18.75,19 25,11 Q31.25,3 37.5,11 Q43.75,19 50,11 Q56.25,3 62.5,11 Q68.75,19 75,11 Q81.25,3 87.5,11 Q93.75,19 100,11 L100,20 Z"></path>
        </svg>
      </div>

      <div className="overflow-hidden max-w-7xl mx-auto relative bg-stone-950">
        <div className="z-10 sm:p-12 md:p-16 pt-12 pr-8 pb-8 pl-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12 border-b border-white/10">
            <div className="lg:col-span-4 gap-x-2 gap-y-2">
              <div className="flex cursor-pointer mb-8 gap-x-2 gap-y-2 items-center">
                <img src={AppConfig.logoUrl} alt="Zeneva Logo" className="h-16 w-auto" />
              </div>
              <p className="max-w-3xl text-white/70">{t('footer.lead')}</p>

              <div className="sm:p-6 md:p-8 border rounded-md mt-6 pt-5 pr-5 pb-5 pl-5 bg-white/5 border-white/10" id="contact-form-section">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div className="inline-flex gap-2 text-xs ring-1 rounded-full pt-1 pr-2.5 pb-1 pl-2.5 gap-x-2 gap-y-2 items-center text-emerald-300 bg-emerald-400/10 ring-emerald-300/20">
                      <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-emerald-400"></span>
                      {t('footer.badgeGrowth')}
                    </div>
                    <h4 className="font-semibold tracking-tight text-white">{t('footer.osHeading')}</h4>
                    <ul className="space-y-2 text-sm text-neutral-300">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 mt-0.5 text-emerald-400" />
                        <span>{t('footer.bullet1')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 mt-0.5 text-emerald-400" />
                        <span>{t('footer.bullet2')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 mt-0.5 text-emerald-400" />
                        <span>{t('footer.bullet3')}</span>
                      </li>
                    </ul>
                    <div className="flex items-center gap-3 pt-2 text-sm">
                      <a href="mailto:zenevapos@gmail.com" className="inline-flex items-center gap-2 transition hover:text-primary text-white">zenevapos@gmail.com</a>
                      <span className="text-white/20">•</span>
                      <a href="https://wa.me/2349064233805" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 transition text-white hover:text-primary">
                        <Phone className="w-4 h-4" />
                        +234 906 423 3805
                      </a>
                    </div>
                  </div>

                  <form ref={form} onSubmit={sendEmail} className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 gap-x-4 gap-y-4" id="contact-form">
                    <div className="sm:col-span-1">
                      <label htmlFor="name" className="block text-xs font-medium mb-1 text-white/80">{t('footer.formName')}</label>
                      <input id="name" name="from_name" type="text" required placeholder={t('footer.formNamePlaceholder')} className="placeholder-white/40 outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition text-sm w-full border rounded pt-2.5 pr-3 pb-2.5 pl-3 text-white bg-white/10 border-white/10" />
                    </div>
                    <div className="sm:col-span-1">
                      <label htmlFor="email" className="block text-xs font-medium mb-1 text-white/80">{t('footer.formEmail')}</label>
                      <input name="from_email" type="email" required placeholder={t('footer.formEmailPlaceholder')} className="placeholder-white/40 outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition text-sm w-full border rounded pt-2.5 pr-3 pb-2.5 pl-3 text-white bg-white/10 border-white/10" id="email" />
                    </div>
                    <div className="sm:col-span-1">
                      <label htmlFor="company" className="block text-xs font-medium mb-1 text-white/80">{t('footer.formCompany')}</label>
                      <input id="company" name="company" type="text" placeholder={t('footer.formCompanyPlaceholder')} className="placeholder-white/40 outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition text-sm w-full border rounded pt-2.5 pr-3 pb-2.5 pl-3 text-white bg-white/10 border-white/10" />
                    </div>
                    <div className="sm:col-span-1">
                      <label htmlFor="project-type" className="block text-xs font-medium mb-1 text-white/80">{t('footer.formGoal')}</label>
                      <select id="project-type" name="project_type" className="appearance-none outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition text-sm w-full border rounded pt-2.5 pr-3 pb-2.5 pl-3 text-white bg-white/10 border-white/10">
                        <option className="bg-neutral-900" value="inventory">{t('footer.goalInventory')}</option>
                        <option className="bg-neutral-900" value="pos">{t('footer.goalPos')}</option>
                        <option className="bg-neutral-900" value="analytics">{t('footer.goalAnalytics')}</option>
                        <option className="bg-neutral-900" value="full-suite">{t('footer.goalFullSuite')}</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="message" className="block text-xs font-medium mb-1 text-white/80">{t('footer.formMessage')}</label>
                      <textarea name="message" rows={4} placeholder={t('footer.formMessagePlaceholder')} className="placeholder-white/40 outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition text-sm w-full border rounded pt-2.5 pr-3 pb-2.5 pl-3 text-white bg-white/10 border-white/10" id="message"></textarea>
                    </div>
                    <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex gap-2 text-xs items-center text-white/70">
                        <input id="nda" name="nda_request" type="checkbox" className="h-4 w-4 rounded focus:ring-primary/60 bg-white/10 border-white/20 text-primary" />
                        <label htmlFor="nda">{t('footer.formNda')}</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="submit" disabled={isSending} className="inline-flex transition text-sm font-medium ring-1 rounded pt-2.5 pr-4 pb-2.5 pl-4 shadow gap-x-2 gap-y-2 items-center hover:bg-amber-300 text-neutral-900 bg-stone-50 disabled:opacity-50">
                          {isSending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                          <Send className="w-4 h-4 rtl:-scale-x-100" />
                          {isSending ? t('footer.formSending') : t('footer.formSend')}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 pt-12">
            <div className="flex flex-col justify-between h-full">
              <div>
                <h4 className="text-xs uppercase tracking-[0.2em] text-white/80">{t('footer.colFeatures')}</h4>
                <ul className="mt-3 space-y-2 text-sm">
                  <li><a href="/#features" className="transition inline-flex items-center gap-2 text-neutral-300 hover:text-white">{t('footer.linkInventory')}</a></li>
                  <li><a href="/#features" className="transition inline-flex items-center gap-2 text-neutral-300 hover:text-white">{t('footer.linkPos')}</a></li>
                  {/* Zen AI has its own product page now — this used to drop
                      the visitor at the homepage feature grid. Reuses the
                      existing linkAiInsights key so no catalogue needs an edit. */}
                  <li><Link href="/zen-ai" className="transition inline-flex items-center gap-2 text-neutral-300 hover:text-white">Zen AI</Link></li>
                  <li><Link href="/terminal" className="transition inline-flex items-center gap-2 text-neutral-300 hover:text-white">{t('footer.linkTerminal')}</Link></li>
                  <li><Link href="/use-cases" className="transition inline-flex items-center gap-2 text-neutral-300 hover:text-white">{t('footer.linkUseCases')}</Link></li>
                  <li><Link href="/pricing" className="transition inline-flex items-center gap-2 text-neutral-300 hover:text-white">{t('footer.linkPricing')}</Link></li>
                </ul>
              </div>
              <div className="mt-6">
                <a href={microsoftStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block transition-transform hover:scale-[1.02] active:scale-[0.98] rounded-[2px] overflow-hidden">
                  <svg className="w-[140px] h-[42px] block" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="180" height="54" rx="2" fill="#f1dfd1" />
                    <g transform="translate(14, 11)">
                      <path d="M12 8C12 5.23858 14.2386 3 17 3C19.7614 3 22 5.23858 22 8" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
                      <rect x="8" y="7" width="18" height="19" rx="3" fill="#F2F2F2" />
                      <g transform="translate(12, 12)">
                        <rect x="1" y="1" width="4.2" height="4.2" fill="#F25022" />
                        <rect x="5.8" y="1" width="4.2" height="4.2" fill="#7FBA00" />
                        <rect x="1" y="5.8" width="4.2" height="4.2" fill="#00A4EF" />
                        <rect x="5.8" y="5.8" width="4.2" height="4.2" fill="#FFB900" />
                      </g>
                    </g>
                    <text x="48" y="21" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9.5" fontWeight="400" letterSpacing="0.1">{t('landing.downloadFrom')}</text>
                    <text x="48" y="38" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="600" letterSpacing="-0.2">{t('landing.microsoftStore')}</text>
                  </svg>
                </a>
              </div>
            </div>
            <div className="flex flex-col justify-between h-full">
              <div>
                <h4 className="text-xs uppercase tracking-[0.2em] text-white/80">{t('footer.colResources')}</h4>
                <ul className="mt-3 space-y-2 text-sm">
                  <li><Link href="/blog" className="transition text-neutral-300 hover:text-white">{t('footer.linkBlog')}</Link></li>
                  <li><a href="#faq" className="transition text-neutral-300 hover:text-white">{t('footer.linkFaq')}</a></li>
                  <li><Link href="/help-center" className="transition text-neutral-300 hover:text-white">{t('footer.linkHelpCenter')}</Link></li>
                  <li><Link href="/blog/zeneva-vs-square" className="transition text-neutral-300 hover:text-white">Zeneva vs Square</Link></li>
                  <li><Link href="/blog/zeneva-vs-clover" className="transition text-neutral-300 hover:text-white">Zeneva vs Clover</Link></li>
                </ul>
              </div>
              <div className="mt-6">
                <a href={googlePlayStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block transition-transform hover:scale-[1.02] active:scale-[0.98] rounded-[2px] overflow-hidden">
                  <svg className="w-[140px] h-[42px] block" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0.5" y="0.5" width="179" height="53" rx="2" fill="#f1dfd1" stroke="#d8c5b7" strokeWidth="1" />
                    <g transform="translate(14, 11)">
                      <path d="M2.5 1.76c-.35.37-.55.94-.55 1.66v25.16c0 .72.2 1.29.55 1.66l.08.08 13.98-13.98v-.32L3.08 1.68l-.58.08z" fill="#3bccff" />
                      <path d="M20.61 14.18l-3.52-2.01-3.52 3.52 3.52 3.52 3.52-2.01c1.01-.58 1.01-1.52 0-2.1z" fill="#ffd300" />
                      <path d="M13.57 15.69l3.52-3.52L3.08 1.68c-.69-.39-1.56-.31-2.12.25l12.61 12.61v1.15z" fill="#55ea47" />
                      <path d="M13.57 16.31l-12.61 12.61c.56.56 1.43.64 2.12.25l13.98-8.01-3.52-3.52-3.52 3.52v-4.85z" fill="#ff3349" />
                    </g>
                    <text x="48" y="21" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9.5" fontWeight="500" letterSpacing="0.05em">{t('landing.getItOn')}</text>
                    <text x="48" y="38" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="19" fontWeight="600" letterSpacing="-0.2px">{t('landing.googlePlay')}</text>
                  </svg>
                </a>
              </div>
            </div>
            <div className="">
              <h4 className="text-xs uppercase tracking-[0.2em] text-white/80">{t('footer.colCompany')}</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/about/our-mission" className="transition text-neutral-300 hover:text-white">{t('footer.linkMission')}</Link></li>
                <li><Link href="/careers" className="transition text-neutral-300 hover:text-white">{t('footer.linkCareers')}</Link></li>
                <li><Link href="/grants" className="transition text-neutral-300 hover:text-white">{t('footer.linkGrants')}</Link></li>
                <li><Link href="/contact" className="transition text-neutral-300 hover:text-white">{t('footer.linkContact')}</Link></li>
                <li><Link href="/legal/privacy-policy" className="transition text-neutral-300 hover:text-white">{t('footer.linkPrivacyPolicy')}</Link></li>
                <li><Link href="/legal/terms-of-service" className="transition text-neutral-300 hover:text-white">{t('footer.linkTerms')}</Link></li>
              </ul>
            </div>
            <div className="">
              <h4 className="uppercase text-xs tracking-[0.2em] text-white/80">{t('footer.colStayInTouch')}</h4>
              <form id="subscribe" className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
                  <input
                    type="email"
                    name="subscribeEmail"
                    id="subscribeEmail"
                    aria-label={t('footer.subscribeAria')}
                    required
                    placeholder={t('footer.subscribePlaceholder')}
                    className="placeholder-white/40 outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition text-xs w-full border rounded pt-2.5 pe-3 pb-2.5 ps-9 text-white bg-white/10 border-white/10"
                  />
                </div>
                <button type="submit" className="inline-flex gap-2 transition text-xs font-medium ring-1 rounded pt-2.5 pr-3.5 pb-2.5 pl-3.5 gap-x-2 gap-y-2 items-center hover:bg-amber-300 hover:ring-amber-200 text-neutral-900 bg-white ring-white/80">
                  {t('footer.subscribeJoin')}
                </button>
              </form>
              <div className="mt-4 flex items-center gap-3">
                <a href="https://share.google/zSJOsFEcwRPpem4A2" target="_blank" rel="noopener noreferrer" aria-label="Google Business" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition bg-white/5 ring-white/10 text-white/80 hover:text-white hover:bg-white/10">
                  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-[16px] h-[16px]" fill="currentColor"><title>Google</title><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-1.896 4.14-1.224 1.224-3.132 2.364-6.944 2.364-6.192 0-11-5.004-11-11.196s4.808-11.196 11-11.196c3.348 0 5.772 1.308 7.5 3.048l2.316-2.316C19.164 1.632 15.768 0 11.48 0 5.136 0 0 5.136 0 11.48s5.136 11.48 11.48 11.48c3.42 0 6.012-1.128 8.028-3.24 2.088-2.088 2.748-4.992 2.748-7.392 0-.708-.06-1.416-.18-2.112h-9.588z"/></svg>
                </a>
                <a href="https://x.com/zeneva_retail" aria-label="X" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition bg-white/5 ring-white/10 text-white/80 hover:text-white hover:bg-white/10">
                  <Twitter className="w-[16px] h-[16px]" style={{ color: 'rgb(255, 255, 255)' }} />
                </a>
                <a href="https://www.instagram.com/zeneva_pos/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition bg-white/5 ring-white/10 text-white/80 hover:text-white hover:bg-white/10">
                  <Instagram className="w-[16px] h-[16px]" style={{ color: 'rgb(255, 255, 255)' }} />
                </a>
                <a href="https://www.tiktok.com/@zeneva_retail" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition bg-white/5 ring-white/10 text-white/80 hover:text-white hover:bg-white/10">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" /></svg>
                </a>
                <a href="https://www.youtube.com/@ZenevaPos" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition bg-white/5 ring-white/10 text-white/80 hover:text-white hover:bg-white/10">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                </a>
                <a href="https://wa.me/2349064233805?text=Hello%2C%20I'm%20interested%20in%20Zeneva.%20I'd%20like%20to%20learn%20more%20about%20how%20it%20can%20help%20my%20business." target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition bg-white/5 ring-white/10 text-white/80 hover:text-white hover:bg-white/10">
                  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-[16px] h-[16px]" fill="currentColor"><title>WhatsApp</title><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"></path></svg>
                </a>
              </div>
              <div className="mt-5 pt-3 border-t border-white/5">
                <a 
                  href="https://apps.microsoft.com/detail/9nvn0f8njwmj?hl=en-US&gl=NG&ocid=pdpshare" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-400 transition"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open('ms-windows-store://review/?ProductId=9nvn0f8njwmj', '_blank');
                    setTimeout(() => {
                      window.open('https://apps.microsoft.com/detail/9nvn0f8njwmj?hl=en-US&gl=NG&ocid=pdpshare', '_blank');
                    }, 800);
                  }}
                >
                  <span>{t('footer.reviewMsStore')}</span>
                </a>
              </div>

            </div>
          </div>

          <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-white/10">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-white/60">{t('footer.rights')}</p>
              <p className="text-sm text-white/40">Built by Bimex</p>
            </div>

            {/* SEO-Optimized CAC Trust Badge */}
            <div 
              className="inline-flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
              itemScope 
              itemType="https://schema.org/GovernmentPermit"
            >
              {/* Visually hidden text for Google bots to index the registration authority */}
              <div className="sr-only">
                <span itemProp="name">Corporate Affairs Commission (CAC) Registration</span>
                <span itemProp="identifier">BN: 9673520</span>
                <span itemProp="issuedBy">Federal Republic of Nigeria</span>
              </div>
              <Image 
                src="/cac-badge-cropped.png" 
                alt="Corporate Affairs Commission (CAC) Registered Entity" 
                width={300} 
                height={80} 
                className="h-10 sm:h-12 w-auto object-contain drop-shadow-md"
                unoptimized
                priority
              />
            </div>

            <div className="flex items-center gap-4 text-sm text-white/60">
              <Link href="/legal/privacy-policy" className="transition hover:text-white">{t('footer.privacyShort')}</Link>
              <span className="hidden sm:block text-white/20">•</span>
              <Link href="/legal/terms-of-service" className="transition hover:text-white">{t('footer.termsShort')}</Link>
              <span className="hidden sm:block text-white/20">•</span>
              <BackToTopButton />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
