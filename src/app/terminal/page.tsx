'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronDown, 
  Star, 
  Globe, 
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Workflow,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import MarketingHeader from '@/components/layout/marketing-header';
import MarketingFooter from '@/components/layout/marketing-footer';
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

export default function TerminalPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs: FAQItem[] = [
    {
      question: "What is the transaction charge on my terminal Account?",
      answer: "₦50 - For transactions below ₦1000, ₦75 - For transactions below ₦5000, ₦100 - For transactions from ₦5000 & above."
    },
    {
      question: "What would my Zeneva Terminal account name be?",
      answer: "It will have your business name and Zeneva."
    },
    {
      question: "How many staff can I add to my terminal?",
      answer: "You can add up to 5 staff."
    },
    {
      question: "Will my staff be able to see my account balance?",
      answer: "No. They will only be able to see the amount sent per time."
    },
    {
      question: "Can I remove a staff I have added before?",
      answer: "Yes and they will stop receiving payment alerts for your business."
    },
    {
      question: "How long does it take for payments to reflect in my account?",
      answer: "Payments reflect in your Terminal account immediately. You receive the settlement automatically in your business bank account the next business day (T+1). Weekend transactions (Friday – Sunday) are settled on Monday morning."
    },
    {
      question: "Do I have to use Zeneva Terminal?",
      answer: "No, Zeneva Terminal is completely optional. You can use Zeneva POS for standard cash, card, and manual bank transfer sales. However, if you want automated confirmation and to protect your business from employee theft or fake alerts, you can choose to activate it anytime."
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-inter antialiased selection:bg-primary/30 selection:text-slate-900">
      {/* Inject custom styling to enforce Inter font family across all elements of this page */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        .font-inter {
          font-family: 'Inter', sans-serif !important;
        }
      `}} />

      <div className="font-inter">
        {/* MARKETING HEADER */}
        <MarketingHeader />

        {/* HERO SECTION - FURTHER INCREASED HEIGHT */}
        <header className="relative pt-24 overflow-hidden bg-slate-900 min-h-[800px] lg:min-h-[900px] flex items-center">
          <div className="absolute inset-0 z-0">
            <img 
              src="/images/herobg.png" 
              alt="Cashier Background" 
              className="w-full h-full object-cover object-center opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-slate-950/15 to-transparent" />
          </div>

          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10 pt-48 pb-56 lg:pt-60 lg:pb-72 flex flex-col items-center text-center space-y-6">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-white leading-tight max-w-4xl">
              Enable multiple staff receive bank <br className="hidden md:block" /> alerts & confirm payments faster.
            </h1>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl font-light">
              Reduce wait time in your physical store when staff can confirm payments without calling you or seeing your account balance.
            </p>
            <div className="pt-4">
              <Link href="/login">
                <Button size="lg" className="bg-primary hover:bg-primary/95 text-white px-8 h-14 text-base font-semibold shadow-lg shadow-primary/20 rounded-xl transition-all">
                  Get Zeneva Terminal
                </Button>
              </Link>
            </div>

            {/* Floating Desk Card Visual overlay at bottom left for larger screens */}
            <div className="hidden lg:block absolute bottom-6 left-12 w-64 p-3 bg-white rounded-xl border border-slate-200 shadow-2xl text-left">
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800">Zeneva Terminal</span>
                <span className="text-[10px] bg-orange-50 text-primary px-1.5 py-0.5 rounded font-bold">Wema Bank</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-400 block">Account Number</span>
                <span className="text-base font-black text-slate-950 tracking-wider">9013535932</span>
              </div>
            </div>
          </div>
        </header>

        {/* SECOND SECTION (2 CARDS: GREEN & BLUE) */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Orange Card */}
            <div className="p-8 sm:p-10 rounded-3xl bg-primary text-white space-y-6 flex flex-col justify-between overflow-hidden shadow-xl min-h-[350px] relative">
              <div className="space-y-3 z-10">
                <h3 className="text-xl sm:text-2xl font-medium leading-snug">Keep payments going even when you’re not available.</h3>
                <p className="text-white/90 text-sm font-light leading-relaxed max-w-md">
                  Connect your staff to Terminal so they can get immediate confirmation of payments on WhatsApp & process orders without delay.
                </p>
              </div>
              <div className="flex justify-end pt-4 -mr-10 -mb-10">
                <img 
                  src="/images/sally-sm.png" 
                  alt="WhatsApp Notification on Phone" 
                  className="w-48 h-auto object-contain transform rotate-6"
                />
              </div>
            </div>

            {/* Blue Card */}
            <div className="p-8 sm:p-10 rounded-3xl bg-[#0D46A0] text-white space-y-6 flex flex-col justify-between overflow-hidden shadow-xl min-h-[350px]">
              <div className="space-y-3">
                <h3 className="text-xl sm:text-2xl font-medium leading-snug">Open your business to local & international payments.</h3>
                <p className="text-white/90 text-sm font-light leading-relaxed max-w-md">
                  Your Zeneva Terminal account accepts payment through Bank Transfer, USSD, QR Code, Apple Pay, & Card payments (Verve, Visa, Mastercard & American Express)
                </p>
              </div>
              <div className="flex justify-center pt-4">
                <div className="flex gap-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm text-xs font-semibold">
                  <span>Verve</span> • <span>Visa</span> • <span>Mastercard</span> • <span>Apple Pay</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THIRD SECTION (DESK CARD HIGHLIGHT) */}
        <section className="py-20 bg-slate-50 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-medium text-slate-900">
              Powered by <span className="text-primary">Zeneva</span>, Supported by <span className="text-primary">Paystack.</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-light">
              Match Terminal payments to specific orders for efficient inventory tracking with the Zeneva app.
            </p>
            
            <div className="relative max-w-4xl mx-auto py-8 flex justify-center">
              <div className="relative w-full max-w-2xl aspect-video rounded-2xl border-2 border-slate-200/80 bg-white p-2 overflow-hidden shadow-xl">
                <img src="/images/kimberly.png" alt="Zeneva Account Desk Stand" className="w-full h-full object-cover rounded-xl" />
              </div>
            </div>

            <div className="pt-4">
              <Link href="/login">
                <Button size="lg" className="bg-primary hover:bg-primary/95 text-white px-8 h-14 rounded-xl font-semibold transition-all">
                  Get Zeneva Terminal
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FOURTH SECTION (ANTI-THEFT ROWS) - REDUCED HEADING BOLDNESS AND SIZES */}
        <section className="py-24 bg-white space-y-24">
          {/* Row 1 */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <h3 className="text-2xl sm:text-3xl font-medium text-slate-900 leading-tight">
                Protect your business <br className="hidden sm:block"/> from theft
              </h3>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-light">
                Zeneva Terminal is completely optional. If you want to take your business security a step further, you can activate it to prevent staff fraud, fake bank alerts, or staff using their personal accounts. Funds are settled automatically to your bank account next business day (T+1).
              </p>
              <div className="pt-2">
                <Link href="/login">
                  <Button size="lg" className="bg-primary hover:bg-primary/95 text-white rounded-xl transition-all">
                    Get Zeneva Terminal
                  </Button>
                </Link>
              </div>
            </div>
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-lg aspect-[4/3.2] bg-[#FDF2F4] rounded-[2.5rem] p-6 flex justify-center items-center overflow-hidden shadow-sm">
                <img 
                  src="/images/lefttrf.png" 
                  alt="Theft Verification Illustration" 
                  className="w-[90%] h-auto max-h-[90%] object-contain" 
                />
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 lg:order-2 space-y-6 text-center lg:text-left">
              <h3 className="text-2xl sm:text-3xl font-medium text-slate-900 leading-tight">
                Track how money <br /> comes in & out of your <br className="hidden sm:block" /> business.
              </h3>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-light">
                View your revenue flow, spendings and withdrawals on your Zeneva Terminal dashboard.
              </p>
              <div className="pt-2">
                <Link href="/login">
                  <Button size="lg" className="bg-primary hover:bg-primary/95 text-white rounded-xl transition-all">
                    Get Zeneva Terminal
                  </Button>
                </Link>
              </div>
            </div>
            <div className="lg:col-span-6 lg:order-1 flex justify-center">
              <div className="relative w-full max-w-lg aspect-[4/4.5] bg-[#EEF4FC] rounded-[2.5rem] p-6 flex justify-center items-end overflow-hidden shadow-sm">
                <img 
                  src="/images/bottom.png" 
                  alt="Revenue Flow Illustration" 
                  className="w-[85%] sm:w-[75%] h-auto max-h-[102%] object-contain object-bottom translate-y-3" 
                />
              </div>
            </div>
          </div>
        </section>

        {/* FIFTH SECTION (BANNER & STEPS) */}
        <section className="py-20 bg-slate-50 border-t border-slate-100" id="how-it-works">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
            
            {/* Banner */}
            <div className="bg-[#FFF6F3] rounded-3xl p-8 sm:p-10 border border-orange-100 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="space-y-2">
                <h5 className="text-lg sm:text-xl font-medium text-slate-950">
                  The Zeneva app will help you manage inventory and sales from your physical store & online sales platforms seamlessly.
                </h5>
              </div>
              <Link href="/" className="flex-shrink-0">
                <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold h-12 px-6">
                  Learn More
                </Button>
              </Link>
            </div>

            {/* Steps Container matching the image */}
            <div className="bg-[#EEF4FC]/60 rounded-[2.5rem] p-8 sm:p-12 lg:p-16 shadow-sm border border-slate-100/50">
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 text-center mb-12">How To Get Started</h2>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 space-y-4">
                  {/* Step 1 */}
                  <div className="bg-white rounded-2xl sm:rounded-full p-4 sm:py-5 sm:px-8 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-[#EBF3FE] flex items-center justify-center font-bold text-primary flex-shrink-0 text-sm">1</div>
                    <p className="text-slate-700 text-sm sm:text-base font-normal">Sign up to get a Zeneva Terminal account.</p>
                  </div>
                  
                  {/* Arrow */}
                  <div className="pl-8 sm:pl-12">
                    <svg width="12" height="24" viewBox="0 0 12 24" fill="none" className="text-primary/70">
                      <path d="M6 0V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3"/>
                      <path d="M3 15L6 20L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-white rounded-2xl sm:rounded-full p-4 sm:py-5 sm:px-8 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-[#EBF3FE] flex items-center justify-center font-bold text-primary flex-shrink-0 text-sm">2</div>
                    <p className="text-slate-700 text-sm sm:text-base font-normal">Wait for your confirmation email with your Zeneva Terminal account details.</p>
                  </div>
                  
                  {/* Arrow */}
                  <div className="pl-8 sm:pl-12">
                    <svg width="12" height="24" viewBox="0 0 12 24" fill="none" className="text-primary/70">
                      <path d="M6 0V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3"/>
                      <path d="M3 15L6 20L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-white rounded-2xl sm:rounded-full p-4 sm:py-5 sm:px-8 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-[#EBF3FE] flex items-center justify-center font-bold text-primary flex-shrink-0 text-sm">3</div>
                    <p className="text-slate-700 text-sm sm:text-base font-normal">Log into your Terminal dashboard.</p>
                  </div>
                  
                  {/* Arrow */}
                  <div className="pl-8 sm:pl-12">
                    <svg width="12" height="24" viewBox="0 0 12 24" fill="none" className="text-primary/70">
                      <path d="M6 0V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3"/>
                      <path d="M3 15L6 20L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-white rounded-2xl sm:rounded-full p-4 sm:py-5 sm:px-8 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-[#EBF3FE] flex items-center justify-center font-bold text-primary flex-shrink-0 text-sm">4</div>
                    <p className="text-slate-700 text-sm sm:text-base font-normal">Add the staff you want to receive payment alerts on your Zeneva Terminal dashboard.</p>
                  </div>
                  
                  {/* Arrow */}
                  <div className="pl-8 sm:pl-12">
                    <svg width="12" height="24" viewBox="0 0 12 24" fill="none" className="text-primary/70">
                      <path d="M6 0V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3"/>
                      <path d="M3 15L6 20L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Step 5 */}
                  <div className="bg-white rounded-2xl sm:rounded-full p-4 sm:py-5 sm:px-8 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-[#EBF3FE] flex items-center justify-center font-bold text-primary flex-shrink-0 text-sm">5</div>
                    <p className="text-slate-700 text-sm sm:text-base font-normal">Put up your Terminal account number in your physical store and start receiving payments notifications for you and your staff seamlessly!</p>
                  </div>
                </div>
                <div className="lg:col-span-5 flex justify-center">
                  <div className="relative w-full max-w-sm aspect-[3.8/5] rounded-[2rem] overflow-hidden shadow-md">
                    <img src="/images/howitworks.png" alt="Smiling Retailer" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* SIXTH SECTION (TESTIMONIALS) */}
        <section className="py-24 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            <h2 className="text-2xl sm:text-3xl font-medium text-slate-900 text-center">
              These Businesses Use and <br /> Love Zeneva Terminal
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Card 1 */}
              <div className="p-8 rounded-2xl border-2 border-orange-100 bg-white hover:shadow-md transition-all flex flex-col justify-between h-full shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-lg">SK</div>
                    <div>
                      <div className="flex items-center text-amber-500 gap-0.5 mb-1">
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                      </div>
                      <h4 className="font-semibold text-slate-900">Serahkassim</h4>
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-sm font-light">
                    "I’ve created many bank accounts because of payment confirmation issues which I’ve been able to stop now because of Zeneva Terminal. What I love the most is that all my staff and even me, get bank alerts at the same time. This saves me so much stress."
                  </p>
                </div>
                <div className="pt-6 flex items-center gap-2 text-xs text-primary hover:text-primary/90 font-medium">
                  <Globe className="h-3.5 w-3.5" />
                  <a href="https://www.serahkassim.com.ng/" target="_blank" rel="noopener noreferrer">www.serahkassim.com.ng</a>
                </div>
              </div>

              {/* Card 2 */}
              <div className="p-8 rounded-2xl border-2 border-orange-100 bg-white hover:shadow-md transition-all flex flex-col justify-between h-full shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-lg">FS</div>
                    <div>
                      <div className="flex items-center text-amber-500 gap-0.5 mb-1">
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                      </div>
                      <h4 className="font-semibold text-slate-900">247 Fragrance Store</h4>
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-sm font-light">
                    "The fact that I don’t need to be present to close transactions is what I love the most about Zeneva Terminal. Thank you so much Zeneva for this solution. It is really helpful for my business."
                  </p>
                </div>
                <div className="pt-6 flex items-center gap-2 text-xs text-primary hover:text-primary/90 font-medium">
                  <Globe className="h-3.5 w-3.5" />
                  <a href="https://247fragrancestore.ng/" target="_blank" rel="noopener noreferrer">www.247fragrancestore.ng</a>
                </div>
              </div>

              {/* Card 3 */}
              <div className="p-8 rounded-2xl border-2 border-orange-100 bg-white hover:shadow-md transition-all flex flex-col justify-between h-full shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-lg">TC</div>
                    <div>
                      <div className="flex items-center text-amber-500 gap-0.5 mb-1">
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                        <Star className="h-4 w-4 fill-amber-500" />
                      </div>
                      <h4 className="font-semibold text-slate-900">Tots and Cuddles</h4>
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-sm font-light">
                    "I have always envisaged my business running without reliance on me & now I’m able to achieve that with Zeneva Terminal. I love that my staff can carry on without reaching out to me, I love that the alert is received instantly, I love that we get it in our account within 24 hours."
                  </p>
                </div>
                <div className="pt-6 flex items-center gap-2 text-xs text-primary hover:text-primary/90 font-medium">
                  <Globe className="h-3.5 w-3.5" />
                  <a href="https://www.totsandcuddles.com.ng/" target="_blank" rel="noopener noreferrer">www.totsandcuddles.com.ng</a>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* FAQS */}
        <section className="py-24 bg-slate-50 border-t border-slate-100" id="faq">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            <h2 className="text-2xl sm:text-3xl font-medium text-slate-900 text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden bg-white hover:border-slate-300 transition-all shadow-sm">
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-6 text-left flex justify-between items-center gap-4 text-slate-900 font-semibold text-lg"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={cn(
                      "h-5 w-5 text-slate-500 transition-transform duration-300 flex-shrink-0",
                      openFaq === idx ? "transform rotate-180" : ""
                    )} />
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-100 pt-4 text-sm font-light">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MARKETING FOOTER */}
        <MarketingFooter />
      </div>
    </div>
  );
}
