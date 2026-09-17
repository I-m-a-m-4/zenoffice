'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, Crown, Sparkles, Download, ArrowRight, Check,
  GraduationCap, Zap, Rocket, Globe, Shield, FileText, Brain,
  BookOpen, Table2, ScanText, Users, Headphones
} from 'lucide-react';
import { useUser } from '@/firebase';
import Script from 'next/script';

type Currency = 'USD' | 'NGN';
type PlanId = 'student' | 'pro' | 'max';

const PRICES: Record<PlanId, Record<Currency, number>> = {
  student: { USD: 1.99, NGN: 2999 },
  pro:     { USD: 4.99, NGN: 7499 },
  max:     { USD: 7.99, NGN: 11999 },
};

const CURRENCY_SYMBOLS: Record<Currency, string> = { USD: '$', NGN: '₦' };

export default function BillingPage() {
  const { user } = useUser();
  const [activePlan, setActivePlan] = useState<'free' | PlanId>('free');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>('USD');

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('zenoffice_subscription_plan');
      if (stored === 'student' || stored === 'pro' || stored === 'max') {
        setActivePlan(stored as PlanId);
      }
    }
  }, []);

  const launchFlutterwave = (planId: PlanId, amount: number, curr: Currency) => {
    const userEmail = user?.email || 'user@example.com';
    (window as any).FlutterwaveCheckout({
      public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK-33162c3bb2bb347a6606f3e44645f1c9-X',
      tx_ref: `zenoffice_${planId}_${Date.now()}`,
      amount,
      currency: curr,
      payment_options: curr === 'NGN' ? 'card,banktransfer,ussd' : 'card',
      customer: {
        email: userEmail,
        name: user?.displayName || userEmail.split('@')[0],
      },
      customizations: {
        title: 'ZenOffice',
        description: `ZenOffice ${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
      },
      callback: (data: any) => {
        setIsProcessing(false);
        if (data.status === 'successful' || data.status === 'completed') {
          setActivePlan(planId);
          localStorage.setItem('zenoffice_subscription_plan', planId);
          localStorage.setItem('zenoffice_subscription_date', new Date().toISOString());
          showToast(`🎉 Payment successful! Welcome to ${planId.toUpperCase()}. Ref: ${data.transaction_id}`);
        }
      },
      onclose: () => setIsProcessing(false),
    });
  };

  const handleCheckout = (planId: PlanId) => {
    setIsProcessing(true);
    const amount = PRICES[planId][currency];
    
    // Safety timeout in case Flutterwave modal fails to load or close properly
    setTimeout(() => {
      setIsProcessing(false);
    }, 15000);

    // Slight delay to ensure UI updates and script is ready
    setTimeout(() => {
      try {
        if (typeof (window as any).FlutterwaveCheckout !== 'undefined') {
          launchFlutterwave(planId, amount, currency);
        } else {
          setIsProcessing(false);
          showToast('Payment gateway is blocked or loading. Try disabling adblockers.');
        }
      } catch(e) {
        setIsProcessing(false);
        showToast('Error launching checkout gateway');
      }
    }, 200);
  };

  const handleDownloadInvoice = () => {
    const invoiceText = [
      `ZENOFFICE RECEIPT`,
      `==================`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Account: ${user?.email || 'User'}`,
      `Plan: ${activePlan.toUpperCase()} PASS`,
      `Amount: ${CURRENCY_SYMBOLS[currency]}${PRICES[activePlan as PlanId]?.[currency] ?? 0} ${currency}/mo`,
      `Payment: Flutterwave`,
      `Status: Active`,
      ``,
      `Thank you for choosing ZenOffice.`,
    ].join('\n');
    const blob = new Blob([invoiceText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZenOffice_Receipt_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Receipt downloaded.');
  };

  const sym = CURRENCY_SYMBOLS[currency];

  const plans = [
    {
      id: 'student' as PlanId,
      name: 'Student',
      tagline: 'Perfect for academics & learners',
      icon: GraduationCap,
      gradient: 'from-amber-400 to-orange-500',
      borderColor: 'border-amber-200 dark:border-amber-800',
      checkColor: 'text-amber-500',
      btnClass: 'border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      popular: false,
      features: [
        { icon: FileText, text: 'Word, Excel & PDF editors — fully offline' },
        { icon: Brain, text: '50 Zen AI queries per day' },
        { icon: BookOpen, text: 'AI study tools: quiz, summarize, cite' },
        { icon: ScanText, text: 'PDF OCR & text extraction' },
        { icon: Shield, text: 'Local-first — your data stays on your device' },
      ],
    },
    {
      id: 'pro' as PlanId,
      name: 'Pro',
      tagline: 'For power users & creators',
      icon: Zap,
      gradient: 'from-orange-500 to-rose-500',
      borderColor: 'border-orange-500',
      checkColor: 'text-orange-200',
      btnClass: 'bg-white/20 hover:bg-white/30 text-white border-2 border-white/30',
      popular: true,
      features: [
        { icon: Check, text: 'Everything in Student' },
        { icon: Brain, text: '250 Zen AI queries per day' },
        { icon: Table2, text: 'Advanced Excel formula generation' },
        { icon: Globe, text: 'Multi-currency billing (NGN & USD)' },
        { icon: Headphones, text: 'Priority email support' },
      ],
    },
    {
      id: 'max' as PlanId,
      name: 'Max',
      tagline: 'Unlimited power, for teams',
      icon: Rocket,
      gradient: 'from-violet-500 to-purple-700',
      borderColor: 'border-violet-200 dark:border-violet-800',
      checkColor: 'text-violet-400',
      btnClass: 'border-2 border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-900 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
      popular: false,
      features: [
        { icon: Check, text: 'Everything in Pro' },
        { icon: Brain, text: 'Unlimited Zen AI queries' },
        { icon: Users, text: 'Team workspace & collaboration' },
        { icon: Globe, text: 'Custom API integrations' },
        { icon: Headphones, text: 'Dedicated account manager' },
      ],
    },
  ];

  return (
    <>
      <Script src="https://checkout.flutterwave.com/v3.js" strategy="beforeInteractive" />
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-orange-50/20 to-zinc-100 dark:from-[#0a0a0a] dark:via-[#0d0900] dark:to-[#0a0a0a] text-zinc-900 dark:text-zinc-100 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:px-8">

        {/* HEADER */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 text-xs font-semibold mb-4">
            <Crown className="w-3.5 h-3.5" />
            <span>ZenOffice Premium</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950 dark:text-white mb-3">
            Simple, Honest <span className="text-orange-600">Pricing</span>
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Write, edit, analyse, and create — all offline, all yours. Upgrade for more AI power and premium tools.
          </p>
        </div>

        {/* CURRENCY TOGGLE */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="inline-flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full p-1 shadow-sm">
            <button
              onClick={() => setCurrency('USD')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                currency === 'USD'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              🌍 USD
            </button>
            <button
              onClick={() => setCurrency('NGN')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                currency === 'NGN'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              🇳🇬 NGN
            </button>
          </div>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {currency === 'NGN' ? 'Card, bank transfer or USSD' : 'International card'}
          </span>
        </div>

        {/* ACTIVE PLAN BANNER */}
        {activePlan !== 'free' && (
          <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-orange-600 to-rose-500 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-orange-500/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-extrabold">You&apos;re on the {activePlan.toUpperCase()} Plan 🎉</p>
                <p className="text-xs text-orange-100">All premium features are active.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadInvoice}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/20 hover:bg-white/30 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Receipt
              </button>
              <Link href="/dashboard" className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-orange-700 hover:bg-orange-50 transition-colors flex items-center gap-1.5">
                Open Workspace <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* PRICING CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const price = PRICES[plan.id][currency];
            const isActive = activePlan === plan.id;
            const isPro = plan.popular;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl overflow-hidden border-2 ${plan.borderColor} shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
              >
                {/* Gradient header */}
                <div className={`bg-gradient-to-br ${plan.gradient} p-6 ${isPro ? 'pt-8' : ''}`}>
                  {isPro && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2">
                      <div className="bg-white/25 backdrop-blur-sm text-white text-[10px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/30">
                        <Sparkles className="w-2.5 h-2.5" /> MOST POPULAR
                      </div>
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-extrabold text-white">{plan.name}</h3>
                  <p className="text-xs text-white/70 mt-0.5 mb-3">{plan.tagline}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">{sym}{price.toLocaleString()}</span>
                    <span className="text-sm text-white/60 font-medium">/ mo</span>
                  </div>
                </div>

                {/* Feature list */}
                <div className="flex-1 p-5 bg-white dark:bg-[#111113] space-y-3">
                  {plan.features.map((f, i) => {
                    const FIcon = f.icon;
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <FIcon className={`w-4 h-4 mt-0.5 shrink-0 ${plan.checkColor}`} />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug">{f.text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* CTA */}
                <div className="p-5 pt-0 bg-white dark:bg-[#111113]">
                  <button
                    onClick={() => !isActive && !isProcessing && handleCheckout(plan.id)}
                    disabled={isProcessing || isActive}
                    className={`w-full h-11 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                      isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border-2 border-zinc-200 dark:border-zinc-700'
                        : isPro
                          ? `bg-gradient-to-r ${plan.gradient} text-white shadow-lg hover:shadow-xl hover:scale-[1.01]`
                          : plan.btnClass
                    }`}
                  >
                    {isProcessing ? (
                      <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Processing…</>
                    ) : isActive ? (
                      <><CheckCircle2 className="w-4 h-4" /> Current Plan</>
                    ) : (
                      <>Get {plan.name} <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* TRUST BADGES */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-10">
          {[
            { icon: Shield, text: 'Local-first privacy', sub: 'Your files never leave your device' },
            { icon: Globe, text: 'Pay in any currency', sub: 'NGN, USD & more via Flutterwave' },
            { icon: Zap, text: 'Instant activation', sub: 'Access unlocks immediately' },
            { icon: Headphones, text: 'Human support', sub: 'Real help, no bots' },
          ].map((b, i) => {
            const BIcon = b.icon;
            return (
              <div key={i} className="flex flex-col items-center text-center p-4 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800 gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-orange-600">
                  <BIcon className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{b.text}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">{b.sub}</p>
              </div>
            );
          })}
        </div>

        {/* FOOTER NOTE */}
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>Not ready? <Link href="/dashboard" className="text-orange-600 hover:underline font-semibold">Continue with the free plan →</Link></p>
          <p className="text-xs mt-1 text-zinc-400">Payments secured by Flutterwave. Cancel anytime.</p>
        </div>
      </div>

      {/* TOAST */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2.5 border border-zinc-700 dark:border-zinc-200 animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-sm">
          <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
          <span>{notification}</span>
        </div>
      )}
    </div>
    </>
  );
}
