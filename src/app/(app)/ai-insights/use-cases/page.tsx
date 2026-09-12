'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Sparkles, Package, BarChart2, Users, ShieldCheck,
  ChevronRight, CheckCircle2, AlertTriangle, ReceiptText, Building2,
  ImageIcon, ArrowUpRight, LineChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * What Zen AI can do, written for the person who runs the shop.
 *
 * Grouped by the question the owner actually has ("what's running out?",
 * "how did today go?") rather than by the 40 tool names behind them — the
 * tool names are an implementation detail and reading a list of them tells
 * nobody what to type.
 *
 * Every example prompt is a link into `/ai-insights?q=…`, which sends it for
 * real. A reference page that can only be read is a page nobody comes back to.
 *
 * Keep in step with `src/app/api/chat/tools.ts`. A capability listed here that
 * no tool backs is worse than one left out: the owner asks, Zen AI can't, and
 * they stop trusting the rest of the page.
 */

type Capability = { label: string; detail: string };
type UseCase = {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  capabilities: Capability[];
  /** Prompts sent verbatim when tapped. Write them the way an owner types. */
  examples: string[];
  /** Tool whose call count stands in for how much this group gets used. */
  usageKey: string | null;
};

const USE_CASES: UseCase[] = [
  {
    id: 'inventory',
    icon: Package,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-50',
    title: 'What have I got, and what am I about to run out of?',
    description:
      'Zen AI reads your live inventory — stock on hand, thresholds, expiry dates and how fast each item actually moves.',
    capabilities: [
      { label: 'Stock on hand, in plain words', detail: 'Ask about any product, brand or category and get the current count without opening the Inventory page.' },
      { label: 'Low stock and reorder lists', detail: 'Everything below its threshold, ranked by urgency — plus a suggested reorder quantity based on how fast it sells.' },
      { label: 'Days of cover', detail: 'Not just "12 left" but "12 left, about 4 days at your current rate". That is the number that tells you whether to order today.' },
      { label: 'Dead stock and expiry', detail: 'Items that have not moved in weeks, and anything approaching its expiry date while you can still discount it.' },
      { label: 'Stock valuation', detail: 'What your shelves are worth at cost and at retail, and how much capital is tied up in slow movers.' },
      { label: 'Data health check', detail: 'Negative stock, missing cost prices, items priced below what you paid — the quiet errors that make every other report wrong.' },
    ],
    examples: [
      'What am I about to run out of?',
      'How many days of cover do I have on my top sellers?',
      "What's been sitting on the shelf for over a month?",
      'Check my inventory data for problems',
    ],
    usageKey: 'queryProducts',
  },
  {
    id: 'sales',
    icon: BarChart2,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
    title: 'How is the business actually doing?',
    description:
      'Takings, profit and trends — answered as a chart you can read at a glance, not a wall of numbers to squint at.',
    capabilities: [
      { label: 'Daily report', detail: 'One card: takings, profit, transaction count, the cash-versus-card split, your top sellers and what is still owed. Ask for it at closing.' },
      { label: 'Charts in the chat', detail: 'Sales trends draw as a line, trading hours as bars, category splits as a pie — right there in the conversation.' },
      { label: 'Period comparison', detail: 'This week against last, this month against the one before, with the change stated as a figure rather than left for you to work out.' },
      { label: 'Best and worst sellers', detail: 'What deserves more shelf space, and what is quietly taking up room it has not earned.' },
      { label: 'Peak trading hours', detail: 'When your shop is busiest, so you can staff the rush instead of guessing at it.' },
      { label: 'Margin analysis', detail: 'Which products actually make money after cost — often not the ones that sell the most.' },
    ],
    examples: [
      'How did we do today?',
      'Show me the sales trend for the last 14 days',
      'Compare this week to last week',
      'What are my busiest hours?',
    ],
    usageKey: 'getSalesMetrics',
  },
  {
    id: 'pos',
    icon: ReceiptText,
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-50',
    title: 'Record a sale without leaving the chat',
    description:
      'Zen AI can ring up a sale — but it asks first. It will not guess a quantity, a product or a payment method, because a sale moves both money and stock.',
    capabilities: [
      { label: 'It asks until it is sure', detail: 'Which exact products, how many of each, how they paid, whether there is a customer or a discount. Anything missing, it asks — it never assumes.' },
      { label: 'It reads the prices itself', detail: 'The total is recomputed from your product records, not from anything Zen AI worked out. If a price changed while you were reading the card, it refuses rather than charging a figure you did not agree to.' },
      { label: 'It will not oversell', detail: 'Every line is checked against stock on hand at the moment you approve. Not enough on the shelf and the sale is refused, with the shortfall named.' },
      { label: 'Your rules still apply', detail: 'Operating hours, tax rate, loyalty points and branch all come from your settings. A sale recorded outside trading hours is blocked or flagged exactly as it would be on the POS page.' },
      { label: 'It works offline', detail: 'Approved sales go through the same queue as the POS page, so a sale rung up with no signal syncs when you are back online.' },
      { label: 'Marked as AI-assisted', detail: "Every receipt Zen AI records is tagged, so you can always tell them apart in the audit trail." },
    ],
    examples: [
      'Record a sale: 2 Coke and 1 bread, paid cash',
      'Ring up 3 bags of rice for Amina on invoice',
      "What's the total for 5 units of my best seller?",
    ],
    usageKey: 'proposeSale',
  },
  {
    id: 'products',
    icon: ImageIcon,
    iconColor: 'text-pink-500',
    iconBg: 'bg-pink-50',
    title: 'Show me the product',
    description:
      'When a name is not enough — because two products sound alike, or you just want to see which bottle it is.',
    capabilities: [
      { label: 'Product photos', detail: 'Ask to see an item and Zen AI draws its picture, with the price, stock and margin beside it.' },
      { label: 'Similar-name picker', detail: 'Type a name that matches several products and you get a row of cards to tap rather than a wrong guess. The cards look the same as they do on the POS screen.' },
      { label: 'Full product record', detail: 'SKU, category, cost, margin, stock, units sold in the last 30 days, days of cover and expiry — one card, no page-hopping.' },
      { label: 'Never guesses between two', detail: 'If a name is ambiguous, Zen AI will not act on it. It asks you to pick first, so no change is ever applied to the wrong item.' },
    ],
    examples: [
      'Show me a picture of the Seiko watch',
      'What does my best-selling product look like?',
      'Find products similar to "coke"',
    ],
    usageKey: 'showProductImage',
  },
  {
    id: 'customers',
    icon: Users,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-50',
    title: 'Who are my customers, and who has stopped coming?',
    description:
      'Purchase history, loyalty balances and the regulars who have quietly gone quiet.',
    capabilities: [
      { label: 'Customer lookup', detail: 'Search by name, phone or email for contact details, what they have bought and their loyalty balance.' },
      { label: 'Your best customers', detail: 'Ranked by what they actually spend, not by how often they walk in.' },
      { label: 'At-risk customers', detail: 'Regulars who have not been back in a while — the ones worth a message before they become someone else’s regulars.' },
      { label: 'Purchase history', detail: 'Everything one customer has bought, so you know what to put aside for them.' },
      { label: 'Loyalty adjustments', detail: 'Add or deduct points, with the current and new balance shown before anything is applied.' },
      { label: 'Unpaid invoices', detail: 'Who owes you, how much, and how long it has been outstanding.' },
    ],
    examples: [
      'Who are my top 5 customers?',
      "Which regulars haven't been back in a while?",
      'Who owes me money?',
    ],
    usageKey: 'queryCustomer',
  },
  {
    id: 'operations',
    icon: Building2,
    iconColor: 'text-cyan-600',
    iconBg: 'bg-cyan-50',
    title: 'Branches, staff and what changed',
    description:
      'The operational view — how each branch and each person is performing, and a readable record of every change made.',
    capabilities: [
      { label: 'Branch performance', detail: 'Revenue, transactions and profit side by side across your locations.' },
      { label: 'Staff sales', detail: 'Totals per person over any period, so recognition and coaching both land on the right people.' },
      { label: 'Audit trail', detail: 'What changed, when, and who did it — in plain language rather than raw log lines.' },
      { label: 'Business overview', detail: 'A full stock-take of the business in one answer: inventory, sales, customers and the things needing attention.' },
      { label: 'Straight to the page', detail: 'Ask to open Reports, Inventory or Settings and you get a button that takes you there. Zen AI only ever links inside Zeneva — never to an outside site.' },
    ],
    examples: [
      'Give me a full overview of the business',
      'How is each branch performing this month?',
      "What changed in my inventory this week?",
      'Open my reports page',
    ],
    usageKey: 'getBusinessOverview',
  },
  {
    id: 'alerts',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    title: 'Tell me what I should be worrying about',
    description:
      'The problems you would not have thought to ask about. Zen AI raises them without being prompted.',
    capabilities: [
      { label: 'Unprompted anomalies', detail: 'Negative stock, items selling below cost, a sudden dip in takings — flagged in the answer even when you asked about something else.' },
      { label: 'Restock urgency', detail: 'Not just what is low, but what will run out first given how fast it moves.' },
      { label: 'Expiring stock', detail: 'What to discount now, while it can still be sold.' },
      { label: 'Honest about gaps', detail: 'Where a figure is understated because cost prices are missing, Zen AI says so rather than presenting a confident wrong number.' },
    ],
    examples: [
      'What should I restock before the weekend?',
      "What's expiring soon?",
      'Is anything wrong with my numbers?',
    ],
    usageKey: 'getLowStockAlerts',
  },
  {
    id: 'forecasting',
    icon: LineChart,
    iconColor: 'text-violet-500',
    iconBg: 'bg-violet-50',
    title: 'Where is this heading?',
    description:
      'Zen AI fits a trend to your real daily takings and projects it forward. It grades its own confidence and tells you when your history is too thin to project at all.',
    capabilities: [
      { label: 'Revenue projections', detail: 'Ask for next week, next month or next year. Zen AI fits a line to your actual daily sales and gives you a range, not a single flattering number.' },
      { label: 'Honest confidence', detail: 'Every projection carries how well the trend actually fits your data — from "reasonable" down to "illustrative only". A ten-year question on three months of data is told plainly what it is.' },
      { label: 'It refuses when it should', detail: 'Fewer than about a week of days with sales and there is no trend to fit. Zen AI says so rather than inventing a figure.' },
      { label: 'Growth rate', detail: 'How fast you are growing between two comparable periods, and what that rate looks like annualised.' },
      { label: 'Stockout forecasting', detail: 'Which products will run out first at their current sales velocity, and roughly how many days you have.' },
    ],
    examples: [
      'What will I make next month?',
      'How fast am I growing?',
      'What will run out in the next two weeks?',
      "Project this year's revenue",
    ],
    usageKey: 'forecastRevenue',
  },
  {
    id: 'guardrails',
    icon: ShieldCheck,
    iconColor: 'text-muted-foreground',
    iconBg: 'bg-muted',
    title: 'What Zen AI cannot do',
    description:
      'Reading your data is free. Changing it is not — every write stops at a card you have to approve, and is re-checked against live records at the moment you do.',
    capabilities: [
      { label: 'Nothing is written without approval', detail: 'Stock, prices, loyalty points, sales — all of it arrives as a proposal card. Nothing reaches your data until you tap Approve.' },
      { label: 'Re-checked at the moment you approve', detail: 'If stock or a price moved between the card being drawn and you approving it, the change is refused and explained. Approving a stale figure would silently undo a real sale.' },
      { label: 'Hallucinated records are caught', detail: 'Every product and customer id on a proposal is verified against your live records before anything is applied.' },
      { label: 'No deletions, ever', detail: 'Zen AI has no delete tool of any kind. Products, receipts and customers can only be removed by you, from their own pages.' },
      { label: 'Sane limits', detail: 'Quantities must be whole numbers, stock cannot go below zero, prices below cost are refused, and absurd figures are rejected outright rather than written.' },
      { label: 'Your business only', detail: 'Zen AI can only ever see data belonging to your business. There is no path to another business on the platform.' },
      { label: 'Injection protection', detail: 'Messages are scanned for attempts to override the rules above. Anything matching is blocked before it reaches the model.' },
      { label: 'Same permissions as you', detail: 'Approved changes go through the same queue as the rest of the app, so your role, your branch and your offline state all apply exactly as they normally would.' },
    ],
    examples: [
      'Delete all my products',
      'Change the price of Pepsi to 450',
    ],
    usageKey: null,
  },
];

/** Send an example straight to the chat rather than making them retype it. */
function ExamplePrompt({ text }: { text: string }) {
  return (
    <Link
      href={`/ai-insights?q=${encodeURIComponent(text)}`}
      className="group flex items-start gap-2 w-full text-left bg-muted hover:bg-orange-500/10 rounded-lg px-3.5 py-2.5 border border-border hover:border-orange-500/40 transition-colors"
    >
      <span className="flex-1 text-xs text-foreground/80 font-medium leading-relaxed group-hover:text-orange-700 dark:group-hover:text-orange-300">
        {text}
      </span>
      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-orange-500 flex-shrink-0 mt-px transition-colors" />
    </Link>
  );
}

export default function ZenAIUseCasesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user || !firestore) return;
    getDoc(doc(firestore, `users/${user.uid}`)).then(snap => {
      if (!snap.exists()) return;
      const bizId = snap.data().businessId;
      if (!bizId) return;
      getDoc(doc(firestore, 'businessInstances', bizId)).then(bizSnap => {
        if (bizSnap.exists()) {
          setUsageCounts(bizSnap.data().aiToolUsageCounts || {});
        }
      });
    });
  }, [user, firestore]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-muted/40 flex flex-col">
      {/* Header */}
      <div className="max-w-3xl mx-auto w-full px-5 pt-7 pb-6">
        <Link href="/ai-insights" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Chat
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Zen AI
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">What can Zen AI do?</h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-lg leading-relaxed">
              Everything it can read, everything it can propose, and everything it is not allowed to
              touch. Tap any example to ask it for real.
            </p>
          </div>
          <Button asChild size="sm" className="flex-shrink-0 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold">
            <Link href="/ai-insights">Open Chat <ChevronRight className="w-3.5 h-3.5 ml-1" /></Link>
          </Button>
        </div>
      </div>

      {/* Use Cases List */}
      <div className="max-w-3xl mx-auto w-full px-5 pb-20 flex flex-col gap-4">
        {USE_CASES.map((uc, idx) => {
          const Icon = uc.icon;
          const count = uc.usageKey ? (usageCounts[uc.usageKey] ?? 0) : null;

          return (
            <motion.div
              key={uc.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx, 6) * 0.06, type: 'spring', stiffness: 280, damping: 24 }}
              className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
            >
              {/* Card Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${uc.iconBg}`}>
                  <Icon className={`w-5 h-5 ${uc.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">{uc.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{uc.description}</p>
                </div>
                {count !== null && (
                  <div className="flex-shrink-0 flex flex-col items-center text-center px-3 py-1.5 bg-muted rounded-lg border border-border min-w-[52px]">
                    <span className="text-base font-bold text-foreground leading-none">{count.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">uses</span>
                  </div>
                )}
              </div>

              {/* Capabilities */}
              <div className="px-5 py-4 space-y-3">
                {uc.capabilities.map((cap, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-foreground">{cap.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{cap.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Example prompts — tappable, they open the chat with the question asked */}
              <div className="px-5 pb-4">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  {uc.id === 'guardrails' ? 'Try it — Zen AI will refuse or ask first' : 'Try asking'}
                </span>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {uc.examples.map((ex, i) => (
                    <ExamplePrompt key={i} text={ex} />
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-6 mt-2">
          Zen AI reads your live business data. Answers reflect what is in Zeneva at the moment you
          ask — if something looks wrong, it is usually the data rather than the answer, and the
          data health check will say so.
        </p>
      </div>
    </div>
  );
}
