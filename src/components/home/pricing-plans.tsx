'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { track } from '@vercel/analytics';
import { useI18n } from '@/context/i18n-context';

export function PricingPlans() {
    const { t } = useI18n();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    const handlePlanClick = (planName: string) => {
        try {
            track('pricing_plan_clicked', {
                plan: planName,
                cycle: billingCycle,
            });
        } catch (err) {
            console.error('Tracking failed:', err);
        }
    };

    return (
        <div className="w-full">
            <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-12">
                {/* Billing Toggle */}
                <div className="inline-flex items-center p-1 bg-neutral-100/80 border-2 border-dashed border-neutral-200 rounded-xl">
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`px-8 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {t('pricing.monthly')}
                    </button>
                    <button
                        onClick={() => setBillingCycle('yearly')}
                        className={`px-8 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${billingCycle === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {t('pricing.yearly')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Starter Plan */}
                <div className="relative flex flex-col p-8 bg-white border-2 border-dashed border-slate-200 rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold leading-5">{t('pricing.starterName')}</h3>
                    <p className="mt-4 text-slate-600 text-sm">{t('pricing.starterDesc')}</p>

                    <div className="mt-4">
                        <span className="text-4xl font-bold tracking-tight">{t('pricing.free')}</span>
                    </div>
                    <ul className="mt-6 space-y-4 text-sm text-slate-700">
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.starterF1')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.starterF2')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.starterF3')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.starterF4')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.starterF5')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> <b>{t('pricing.starterF6')}</b></li>
                    </ul>
                    <div className="mt-auto pt-6">
                        <Button asChild size="lg" className="w-full">
                            <Link href="/signup" onClick={() => handlePlanClick('Starter')}>{t('pricing.ctaStarter')}</Link>
                        </Button>
                    </div>
                </div>

                {/* Pro Plan */}
                <div className="relative flex flex-col p-8 bg-white border-2 border-dashed border-primary rounded-lg shadow-2xl shadow-primary/10">
                    <p className="absolute top-0 -translate-y-1/2 bg-primary text-white px-3 py-1 text-sm font-semibold tracking-wide rounded-full">{t('pricing.mostPopular')}</p>
                    <h3 className="text-lg font-semibold leading-5">{t('pricing.proName')}</h3>
                    <p className="mt-4 text-slate-600 text-sm">{t('pricing.proDesc')}</p>

                    <div className="mt-4">
                        <span className="text-4xl font-bold tracking-tight text-slate-900">
                            {billingCycle === 'monthly' ? '₦10,000' : '₦100,000'}
                        </span>
                        <span className="text-base font-medium text-slate-500">
                            {billingCycle === 'monthly' ? t('pricing.perMoShort') : t('pricing.perYear')}
                        </span>
                        {billingCycle === 'yearly' && (
                            <div className="text-xs text-emerald-600 font-bold mt-1 block animate-pulse">{t('pricing.saveAmount', { amount: '₦20,000' })}</div>
                        )}
                    </div>
                    <ul className="mt-6 space-y-4 text-sm text-slate-700">
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF1')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF2')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF3')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF4')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF5')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF6')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF7')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF8')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF9')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF11')}</li>
                        <li className="flex items-center gap-3 font-semibold"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF12')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF13')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.proF14')}</li>
                    </ul>
                    <div className="mt-auto pt-6">
                        <Button asChild size="lg" className="w-full">
                            <Link href="/signup" onClick={() => handlePlanClick('Pro')}>{t('pricing.ctaPro')}</Link>
                        </Button>
                    </div>
                </div>

                {/* Business Plan */}
                <div className="relative flex flex-col p-8 bg-white border-2 border-dashed border-slate-200 rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold leading-5 text-slate-900">{t('pricing.bizName')}</h3>
                    <p className="mt-4 text-slate-600 text-sm">{t('pricing.bizDesc')}</p>

                    <div className="mt-4">
                        <span className="text-4xl font-bold tracking-tight text-slate-900">
                            {billingCycle === 'monthly' ? '₦30,000' : '₦300,000'}
                        </span>
                        <span className="text-base font-medium text-slate-500">
                            {billingCycle === 'monthly' ? t('pricing.perMoShort') : t('pricing.perYear')}
                        </span>
                        {billingCycle === 'yearly' && (
                            <div className="text-xs text-emerald-600 font-bold mt-1 block">{t('pricing.saveAmount', { amount: '₦60,000' })}</div>
                        )}
                    </div>
                    <ul className="mt-6 space-y-4 text-sm text-slate-700">
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF1')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF2')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF3')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF4')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF5')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF6')}</li>
                        <li className="flex items-center gap-3 font-semibold"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF8')}</li>
                        <li className="flex items-center gap-3 font-semibold text-primary animate-pulse"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF9')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF10')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF11')}</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> {t('pricing.bizF12')}</li>
                    </ul>
                    <div className="mt-auto pt-6">
                        <Button asChild size="lg" className="w-full">
                            <Link href="/signup" onClick={() => handlePlanClick('Business')}>{t('pricing.ctaBiz')}</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
