'use client';

import React, { useState, useEffect } from 'react';
import { Check, Zap, Barcode, Package, Box, Tag, Receipt } from "lucide-react";
import { getCountryFromIP } from '@/lib/utils';
import { motion } from 'framer-motion';
import MarketingHeader from "@/components/layout/marketing-header";
import MarketingFooter from "@/components/layout/marketing-footer";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from 'next/link';
import { InteractiveGrid } from '@/components/interactive-grid';
import { useI18n } from '@/context/i18n-context';

const FAQ_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const PRO_MONTHLY_NGN = 10000;
const PRO_YEARLY_NGN = 100000;
const PRO_MONTHLY_USD = 10;
const PRO_YEARLY_USD = 100;

const BIZ_MONTHLY_NGN = 30000;
const BIZ_YEARLY_NGN = 300000;
const BIZ_MONTHLY_USD = 30;
const BIZ_YEARLY_USD = 300;

export default function PricingContent() {
    const { t } = useI18n();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [currency, setCurrency] = useState<'NGN' | 'USD'>('USD');

    useEffect(() => {
        getCountryFromIP().then((country) => {
            if (country === 'Nigeria') {
                setCurrency('NGN');
            } else {
                setCurrency('USD');
            }
        });
    }, []);

    const proSavingsNGN = (PRO_MONTHLY_NGN * 12) - PRO_YEARLY_NGN;
    const proSavingsUSD = (PRO_MONTHLY_USD * 12) - PRO_YEARLY_USD;
    const bizSavingsNGN = (BIZ_MONTHLY_NGN * 12) - BIZ_YEARLY_NGN;
    const bizSavingsUSD = (BIZ_MONTHLY_USD * 12) - BIZ_YEARLY_USD;

    return (
        <div className="min-h-screen bg-white">
            <MarketingHeader />

            <main>
                {/* Hero / Pricing Header */}
                <section className="relative pt-32 pb-20 px-6 bg-transparent border-b border-slate-100 overflow-hidden">
                    <div className="absolute inset-0 z-0">
                        <InteractiveGrid />
                        <div className="aura-background"></div>
                    </div>
                    <div className="max-w-6xl mx-auto text-center relative z-10">
                        {/* Doodle Icons */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.1]">
                            <motion.div 
                                animate={{ y: [0, -25, 0], rotate: [0, 10, 0] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -top-10 left-[10%]"
                            >
                                <Barcode className="w-16 h-16 text-slate-400" />
                            </motion.div>
                            <motion.div 
                                animate={{ y: [0, 30, 0], rotate: [0, -15, 0] }}
                                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                className="absolute top-20 right-[5%]"
                            >
                                <Package className="w-20 h-20 text-slate-400" />
                            </motion.div>
                            <motion.div 
                                animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
                                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                                className="absolute bottom-20 left-[5%]"
                            >
                                <Box className="w-14 h-14 text-slate-400" />
                            </motion.div>
                            <motion.div 
                                animate={{ y: [0, 35, 0], rotate: [0, 20, 0] }}
                                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                                className="absolute -bottom-10 right-[10%]"
                            >
                                <Tag className="w-24 h-24 text-slate-400" />
                            </motion.div>
                        </div>

                        <div className="inline-flex items-center gap-4 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 mb-8">
                            <div className="flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{t('pricing.badgePricingPlans')}</span>
                            </div>
                            <div className="w-px h-3 bg-slate-300"></div>
                            <div className="flex items-center gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{t('pricing.badgeGlobalUsd')}</span>
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-light text-slate-900 tracking-tight font-bricolage max-w-3xl mx-auto mb-6">
                            {t('pricing.pageHeading')}
                        </h1>
                        <p className="text-lg text-slate-500 max-w-2xl mx-auto font-dm-sans tracking-tight mb-12">
                            {t('pricing.pageSub')}
                        </p>

                        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-4">
                            {/* Billing Toggle */}
                            <div className="inline-flex items-center p-1 bg-neutral-100/80 border-2 border-dashed border-neutral-200 rounded-xl">
                                <button
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`px-8 py-2.5 text-sm font-semibold rounded-lg transition-all ${billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('pricing.monthly')}
                                </button>
                                <button
                                    onClick={() => setBillingCycle('yearly')}
                                    className={`px-8 py-2.5 text-sm font-semibold rounded-lg transition-all ${billingCycle === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('pricing.yearly')}
                                </button>
                            </div>

                            {/* Currency Toggle */}
                            <div className="inline-flex items-center p-1 bg-neutral-100/80 border-2 border-dashed border-neutral-200 rounded-xl">
                                <button
                                    onClick={() => setCurrency('NGN')}
                                    className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${currency === 'NGN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('pricing.currencyNaira')}
                                </button>
                                <button
                                    onClick={() => setCurrency('USD')}
                                    className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${currency === 'USD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('pricing.currencyUsd')}
                                </button>
                            </div>
                        </div>
                        {billingCycle === 'yearly' && (
                            <div className="text-sm text-emerald-600 font-bold animate-bounce h-6">{t('pricing.twoMonthsFree')}</div>
                        )}
                    </div>
                </section>

                {/* Pricing Section (Exact Replica of Homepage) */}
                <section className="py-24 px-6 bg-white">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Starter Plan */}
                            <div className="relative flex flex-col p-8 bg-white border-2 border-dashed border-slate-200 rounded-lg shadow-sm">
                                <h3 className="text-lg font-semibold leading-5 text-slate-900">{t('pricing.starterName')}</h3>
                                <p className="mt-4 text-slate-500 text-sm">{t('pricing.starterDesc')}</p>

                                <div className="mt-4">
                                    <span className="text-4xl font-bold tracking-tight text-slate-900">{t('pricing.free')}</span>
                                </div>
                                <ul className="mt-6 space-y-4 text-sm flex-1">
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.starterF1')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.starterF2')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.starterF3')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.starterF4')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.starterF5')}</li>
                                    <li className="flex items-center gap-3 text-slate-700 font-bold">{t('pricing.starterF6')}</li>
                                </ul>
                                <div className="mt-auto pt-8">
                                    <Button asChild size="lg" className="w-full">
                                        <Link href="/signup">{t('pricing.ctaStarter')}</Link>
                                    </Button>
                                </div>
                            </div>

                            {/* Pro Plan */}
                            <div className="relative flex flex-col p-8 bg-white border-2 border-dashed border-primary rounded-lg shadow-2xl shadow-primary/10">
                                <p className="absolute top-0 -translate-y-1/2 bg-primary text-white px-3 py-1 text-sm font-semibold tracking-wide rounded-full">{t('pricing.mostPopular')}</p>
                                <h3 className="text-lg font-semibold leading-5 text-slate-900">{t('pricing.proName')}</h3>
                                <p className="mt-4 text-slate-500 text-sm">{t('pricing.proDesc')}</p>

                                <div className="mt-4">
                                    <span className="text-4xl font-bold tracking-tight text-slate-900">
                                        {currency === 'NGN'
                                            ? (billingCycle === 'monthly' ? `₦${PRO_MONTHLY_NGN.toLocaleString()}` : `₦${PRO_YEARLY_NGN.toLocaleString()}`)
                                            : (billingCycle === 'monthly' ? `$${PRO_MONTHLY_USD}` : `$${PRO_YEARLY_USD}`)
                                        }
                                    </span>
                                    <span className="text-base font-medium text-slate-500">
                                        {billingCycle === 'monthly' ? t('pricing.perMoShort') : t('pricing.perYear')}
                                    </span>
                                    {billingCycle === 'yearly' && (
                                        <div className="text-xs text-emerald-600 font-bold mt-1 block animate-pulse">
                                            {t('pricing.saveAmount', { amount: currency === 'NGN' ? `₦${proSavingsNGN.toLocaleString()}` : `$${proSavingsUSD}` })}
                                        </div>
                                    )}
                                </div>
                                <ul className="mt-6 space-y-4 text-sm flex-1">
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF1')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF2')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF3')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF4')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF5')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF6')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF7')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF8')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF9')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF10')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF11')}</li>
                                    <li className="flex items-center gap-3 text-slate-700 font-semibold"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF12')}</li>
                                </ul>
                                <div className="mt-auto pt-8">
                                    <Button asChild size="lg" className="w-full">
                                        <Link href="/signup">{t('pricing.ctaPro')}</Link>
                                    </Button>
                                </div>
                            </div>

                            {/* Business Plan */}
                            <div className="relative flex flex-col p-8 bg-white border-2 border-dashed border-slate-200 rounded-lg shadow-sm">
                                <h3 className="text-lg font-semibold leading-5 text-slate-900">{t('pricing.bizName')}</h3>
                                <p className="mt-4 text-slate-500 text-sm">{t('pricing.bizDesc')}</p>

                                <div className="mt-4">
                                    <span className="text-4xl font-bold tracking-tight text-slate-900">
                                        {currency === 'NGN'
                                            ? (billingCycle === 'monthly' ? `₦${BIZ_MONTHLY_NGN.toLocaleString()}` : `₦${BIZ_YEARLY_NGN.toLocaleString()}`)
                                            : (billingCycle === 'monthly' ? `$${BIZ_MONTHLY_USD}` : `$${BIZ_YEARLY_USD}`)
                                        }
                                    </span>
                                    <span className="text-base font-medium text-slate-500">
                                        {billingCycle === 'monthly' ? t('pricing.perMoShort') : t('pricing.perYear')}
                                    </span>
                                    {billingCycle === 'yearly' && (
                                        <div className="text-xs text-emerald-600 font-bold mt-1 block">
                                            {t('pricing.saveAmount', { amount: currency === 'NGN' ? `₦${bizSavingsNGN.toLocaleString()}` : `$${bizSavingsUSD}` })}
                                        </div>
                                    )}
                                </div>
                                <ul className="mt-6 space-y-4 text-sm flex-1">
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF1')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF2')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF3')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF4')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF5')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF6')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF7')}</li>
                                    <li className="flex items-center gap-3 text-slate-700 font-semibold"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF8')}</li>
                                    <li className="flex items-center gap-3 text-slate-700 font-semibold text-primary animate-pulse"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF9')}</li>
                                    <li className="flex items-center gap-3 text-slate-700"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF10')}</li>
                                </ul>
                                <div className="mt-auto pt-8">
                                    <Button asChild size="lg" className="w-full">
                                        <Link href="/signup">{t('pricing.ctaBiz')}</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section id="faq" className="py-24 px-6 border-t bg-white border-slate-100">
                    <div className="max-w-3xl mr-auto ml-auto">
                        <h2 className="text-3xl tracking-tight mb-12 text-center font-bricolage font-light text-slate-900">{t('pricing.faqTitle')}</h2>
                        <Accordion type="multiple" className="w-full">
                            {FAQ_INDEXES.map((n) => (
                                <AccordionItem key={n} value={`item-${n}`}>
                                    <AccordionTrigger className="text-lg text-start">{t(`pricing.q${n}`)}</AccordionTrigger>
                                    <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                                        {t(`pricing.a${n}`)}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                        <div className="text-center mt-12 bg-neutral-50 p-10 rounded-2xl border border-dashed border-neutral-200">
                            <p className="mb-4 font-dm-sans tracking-tight text-slate-600 text-lg">{t('pricing.stillQuestions')}</p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button asChild size="lg" variant="outline">
                                    <Link href="/help-center">{t('pricing.browseHelp')}</Link>
                                </Button>
                                <Button asChild size="lg">
                                    <Link href="/contact">{t('pricing.contactSupport')}</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <MarketingFooter />
        </div>
    );
}
