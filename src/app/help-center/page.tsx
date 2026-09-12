'use client';

import React from 'react';
import Link from 'next/link';
import {
  Search, Book, CreditCard, Activity, Cpu, Users, Shield, ArrowRight, LifeBuoy,
  FileText, ChevronDown, X, WifiOff, Laptop, Tablet, Globe, Mail, MessageCircle,
  Lock, CheckCircle2, Info,
} from 'lucide-react';
import { InteractiveGrid } from '@/components/interactive-grid';

import MarketingHeader from '@/components/layout/marketing-header';
import MarketingFooter from '@/components/layout/marketing-footer';

type CategoryId =
  | 'getting-started'
  | 'inventory'
  | 'pos'
  | 'ai-reports'
  | 'team'
  | 'billing';

const CATEGORIES: {
  id: CategoryId;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'What you need to run Zeneva, setting up your shop, and importing an existing catalogue.',
    icon: <Book className="h-6 w-6" />,
  },
  {
    id: 'inventory',
    title: 'Inventory & stock',
    description: 'Variants, bundles, expiry dates, per-branch counts, supplier debts, and fixing bad data.',
    icon: <Activity className="h-6 w-6" />,
  },
  {
    id: 'pos',
    title: 'Point of sale',
    description: 'The four-step checkout, parked sales, discounts, receipts, and selling with no internet.',
    icon: <CreditCard className="h-6 w-6" />,
  },
  {
    id: 'ai-reports',
    title: 'Zen AI & reports',
    description: 'What the assistant can do, the two things it never does, and the reports available to you.',
    icon: <Cpu className="h-6 w-6" />,
  },
  {
    id: 'team',
    title: 'Team & permissions',
    description: 'The three roles, the eight granular permissions, and how the audit log records changes.',
    icon: <Users className="h-6 w-6" />,
  },
  {
    id: 'billing',
    title: 'Billing & plans',
    description: 'Plan limits, what a lapsed subscription does, and how lifetime access behaves.',
    icon: <Shield className="h-6 w-6" />,
  },
];

type Article = {
  id: string;
  category: CategoryId;
  q: string;
  a: string;
  bullets?: string[];
  note?: string;
  link?: { href: string; label: string };
  keywords?: string[];
};

/**
 * Every answer here is checked against what the app actually ships. Where a
 * feature is not built yet it is left out rather than described optimistically —
 * a help centre that documents a feature the reader cannot find is worse than
 * one that stays quiet about it.
 */
const ARTICLES: Article[] = [
  // --- Getting started ---
  {
    id: 'what-you-need',
    category: 'getting-started',
    q: 'What do I need to run Zeneva?',
    a: 'A computer or phone, and nothing else. There is no server to install and no hardware you have to buy from us.',
    bullets: [
      'Windows or macOS — the native desktop app',
      'Android or iOS — for the shop floor',
      'Any modern browser — the web portal',
    ],
    note: 'A thermal receipt printer and a barcode scanner are both optional. The desktop app prints to any printer your operating system already knows about.',
    keywords: ['install', 'requirements', 'hardware', 'download', 'platform'],
  },
  {
    id: 'setting-up',
    category: 'getting-started',
    q: 'How do I set my shop up the first time?',
    a: 'Signing up walks you through a short onboarding: your business name, your industry, and your address. Pick the industry closest to what you sell — it shapes some of the defaults, and you can change it later in Settings.',
    bullets: [
      'Retail & E-commerce',
      'Fashion & Apparel',
      'Electronics',
      'Food & Beverage',
      'Health & Beauty',
      'Home & Furniture',
    ],
    link: { href: '/signup', label: 'Create an account' },
    keywords: ['onboarding', 'signup', 'first time', 'industry', 'setup'],
  },
  {
    id: 'offline-first',
    category: 'getting-started',
    q: 'Does Zeneva really work with no internet?',
    a: 'Yes, and this is the part the whole product is designed around. Your catalogue and customers are mirrored to a local database on the device, so searching and selling read from your own drive rather than from the network. Sales, stock changes and customer edits are written to an ordered queue and uploaded when a connection returns, in the same order you made them.',
    note: 'What you lose offline is only the things that genuinely need the network — Zen AI, and seeing changes another till made in the last few minutes.',
    keywords: ['offline', 'internet', 'sync', 'network', 'data', 'nepa', 'power'],
  },
  {
    id: 'import-catalogue',
    category: 'getting-started',
    q: 'Can I bring in the catalogue I already have in a spreadsheet?',
    a: 'Yes. Inventory supports bulk CSV import and export. Export once to see the exact column layout, paste your existing rows into that shape, and import it back. The same route works for bulk price changes later — export, edit in a spreadsheet, re-import.',
    keywords: ['csv', 'import', 'export', 'excel', 'spreadsheet', 'bulk', 'migrate'],
  },

  // --- Inventory & stock ---
  {
    id: 'variants',
    category: 'inventory',
    q: 'How do product variants work?',
    a: 'A variant is a real product row that points at a parent. One shirt style can hold a row per size and colour, and each of those rows carries its own SKU, its own price and its own stock count. In the catalogue they group under the single style name instead of cluttering the list.',
    note: 'Because each variant keeps its own price, a large can cost more than a small without you having to create an unrelated product.',
    keywords: ['variant', 'size', 'colour', 'color', 'sku', 'options', 'style'],
  },
  {
    id: 'composite',
    category: 'inventory',
    q: 'Can I sell a bundle as one item?',
    a: 'Yes. A product can be marked composite, which lets you sell a set — a phone with a case and a screen guard, for instance — as a single priced line at the till rather than three separate scans.',
    keywords: ['bundle', 'composite', 'kit', 'combo', 'set', 'package'],
  },
  {
    id: 'expiry',
    category: 'inventory',
    q: 'How do I keep track of expiry dates?',
    a: 'Any product can carry an expiry date. That makes short-dated stock visible while there is still time to discount it, move it or send it back, which matters most for pharmacy, grocery and cosmetics.',
    keywords: ['expiry', 'expiration', 'shelf life', 'perishable', 'batch', 'waste'],
  },
  {
    id: 'troubleshoot',
    category: 'inventory',
    q: 'My inventory numbers look wrong. Where do I start?',
    a: 'Inventory > Troubleshoot is a data-health scanner built for exactly this. It sweeps your whole catalogue and reports the four faults that cause most bad numbers, so you are fixing a named list instead of hunting.',
    bullets: [
      'Products with no price set',
      'Products with no category',
      'Probable duplicates of the same product',
      'Negative stock counts',
    ],
    keywords: ['troubleshoot', 'wrong', 'duplicate', 'negative stock', 'data', 'audit', 'clean'],
  },
  {
    id: 'supplier-debts',
    category: 'inventory',
    q: 'Can I track what I owe my suppliers?',
    a: 'Yes. Inventory > Debts records money owed upstream, which is deliberately separate from the customer invoice ledger. Cash planning needs both directions — what is owed to you and what you owe — and keeping them apart stops one from flattering the other.',
    keywords: ['supplier', 'debt', 'owe', 'creditor', 'payable', 'credit'],
  },
  {
    id: 'branch-stock',
    category: 'inventory',
    q: 'How does stock work across several branches?',
    a: 'Each branch keeps its own counts, and the app shell has an active-branch switcher so you always know which location you are looking at. Reports roll every branch up into one view when you want the whole picture.',
    keywords: ['branch', 'location', 'multi-store', 'transfer', 'chain', 'outlet'],
  },

  // --- Point of sale ---
  {
    id: 'checkout-flow',
    category: 'pos',
    q: 'What are the steps of a sale?',
    a: 'Checkout is four screens in a fixed order, so there is nothing to hunt for during a rush and a new cashier can be trained in a minute.',
    bullets: [
      'Select products — scan or search into the cart',
      'Customer — attach one, or skip for a walk-in',
      'Payment — take the money',
      'Review — confirm, then print or send the receipt',
    ],
    keywords: ['pos', 'checkout', 'sale', 'till', 'cart', 'flow', 'register'],
  },
  {
    id: 'held-sales',
    category: 'pos',
    q: 'A customer left mid-sale. Can I park the cart?',
    a: 'Yes. Hold the sale, serve the next person, and recall it from the held-sales drawer when they come back. Nothing is lost and the till is not blocked by one indecisive basket.',
    keywords: ['hold', 'park', 'suspend', 'save cart', 'recall', 'later'],
  },
  {
    id: 'discounts',
    category: 'pos',
    q: 'How do discounts and coupons work, and can I stop staff using them?',
    a: 'Discounts and coupons are applied at checkout. Both are gated behind permissions you control per staff member, so a cashier can be allowed to ring up sales without being allowed to change what things cost.',
    bullets: [
      'Apply Discounts — apply a manual discount to an order',
      'Override Prices — change a product price during a transaction',
    ],
    keywords: ['discount', 'coupon', 'promo', 'price override', 'markdown'],
  },
  {
    id: 'receipts',
    category: 'pos',
    q: 'What can I do with a receipt?',
    a: 'Print it, export it, or send it. On desktop, Zeneva prints through your operating system, so any receipt printer already installed there works — including thermal printers. You can also export a PDF or email the customer a digital copy.',
    keywords: ['receipt', 'print', 'thermal', 'pdf', 'email', 'printer', 'invoice'],
  },
  {
    id: 'unpaid',
    category: 'pos',
    q: 'Someone paid part now and will pay the rest later. Where does that live?',
    a: 'In the invoice ledger, which tracks outstanding balances separately from completed receipts. An invoice keeps its remaining balance until it is settled, however many instalments that takes — so part-payment on a large item is a normal case rather than a workaround.',
    keywords: ['credit', 'balance', 'instalment', 'installment', 'unpaid', 'owing', 'deposit'],
  },
  {
    id: 'offline-branch',
    category: 'pos',
    q: 'If I sell offline, does the sale land on the right branch?',
    a: 'Yes. The active branch is attached to the sale at the moment it is queued, not when it finally uploads. That is why a day of offline takings still reports against the branch that earned it, even if it syncs from a different location hours later.',
    keywords: ['offline', 'branch', 'attribution', 'sync', 'wrong branch'],
  },

  // --- Zen AI & reports ---
  {
    id: 'zen-ai-what',
    category: 'ai-reports',
    q: 'What can Zen AI actually do?',
    a: 'It answers questions about your own business data through 41 typed tools, rather than guessing from general knowledge. You ask in plain language and it reads the same records you can see.',
    bullets: [
      'Sales velocity — what is actually moving, and how fast',
      'Trapped cash — how much money is sitting in slow stock',
      'Replenishment — what to reorder next',
      'Margin analysis — where the profit really comes from',
      'Walkthroughs — how to do a thing in the app',
    ],
    keywords: ['ai', 'zen', 'assistant', 'chat', 'insights', 'analytics'],
  },
  {
    id: 'zen-ai-writes',
    category: 'ai-reports',
    q: 'Can Zen AI change my data on its own?',
    a: 'No, and this is a hard boundary rather than a setting. When the assistant suggests a change it returns a proposal card. Nothing is written until you approve it, and at that point the change is re-checked against live data before it is applied — so a proposal that went stale while you were reading it cannot quietly land.',
    note: 'The assistant proposes. The owner approves. There is no configuration that reverses this.',
    keywords: ['ai', 'write', 'safe', 'approve', 'proposal', 'permission', 'change'],
  },
  {
    id: 'zen-ai-privacy',
    category: 'ai-reports',
    q: 'Does Zeneva store what I type into Zen AI?',
    a: 'No. Prompt text is never stored. What gets recorded for usage reporting is an intent label plus matches against a fixed keyword list — never the words you wrote. This is a deliberate privacy boundary, not a gap waiting to be filled.',
    keywords: ['privacy', 'ai', 'prompt', 'stored', 'data', 'confidential', 'security'],
  },
  {
    id: 'zen-ai-limits',
    category: 'ai-reports',
    q: 'How many Zen AI credits do I get?',
    a: 'A monthly credit allowance that depends on your plan: 3 a month on Starter, 150 on Pro, and 600 on Business. Credits, not messages — a quick question costs one, while a deep report that reads your whole sales history costs several. The allowance resets at the start of each month, and if you need more every month, a higher plan is the way to get it.',
    keywords: ['ai', 'limit', 'quota', 'credits', 'messages', 'monthly', 'allowance', 'upgrade'],
  },
  {
    id: 'reports',
    category: 'ai-reports',
    q: 'What reports do I get?',
    a: 'The dashboard and reports cover the numbers a shop owner asks for at close of business, without you having to build anything.',
    bullets: [
      'Takings and profit',
      'Outstanding debt',
      'Peak hours — when your rush actually happens',
      'Best sellers',
      'Category splits',
      'A daily end-of-day report',
    ],
    keywords: ['report', 'dashboard', 'profit', 'analytics', 'peak hours', 'best sellers'],
  },

  // --- Team & permissions ---
  {
    id: 'roles',
    category: 'team',
    q: 'What staff roles exist?',
    a: 'Three, and each one is a starting point rather than a cage — you can adjust the individual permissions on any account afterwards.',
    bullets: [
      'Admin — full access, including settings and financials',
      'Manager — inventory, sales and customers, without owner-level settings',
      'Vendor operator — the till: record sales and see customers',
    ],
    keywords: ['role', 'staff', 'admin', 'manager', 'cashier', 'operator', 'team'],
  },
  {
    id: 'permissions',
    category: 'team',
    q: 'Which permissions can I set individually?',
    a: 'Eight, each switchable per staff member regardless of their role. This is how you let someone run the till without letting them see your margins.',
    bullets: [
      'Record Sales (POS)',
      'View Reports',
      'Manage Inventory',
      'Manage Customers',
      'Apply Discounts',
      'Override Prices',
      'View Audit Logs',
      'Manage Online Orders',
    ],
    keywords: ['permission', 'access', 'restrict', 'granular', 'rbac', 'control'],
  },
  {
    id: 'permissions-enforced',
    category: 'team',
    q: 'Are permissions actually enforced, or just hidden in the interface?',
    a: 'Enforced. Every write goes through one path that checks the acting user permissions before anything is saved, and the check is repeated on the server rather than trusted from the browser. Hiding a button is a convenience; it is not the control.',
    keywords: ['security', 'enforce', 'permission', 'server', 'bypass', 'rules'],
  },
  {
    id: 'audit-log',
    category: 'team',
    q: 'Can I see who changed something?',
    a: 'Yes. The audit log records every change with who made it and when. Nothing is edited anonymously, which is what makes it possible to settle a disagreement about a price change or a stock adjustment after the fact.',
    keywords: ['audit', 'log', 'history', 'who', 'accountability', 'track', 'changes'],
  },

  // --- Billing & plans ---
  {
    id: 'plan-limits',
    category: 'billing',
    q: 'What are the plan limits?',
    a: 'Plans differ by scale, not by capability — the features are the same on all three. Starter is free forever, with no trial and no card required.',
    bullets: [
      'Starter — free: 50 products, 1 staff account, 3 Zen AI credits a month',
      'Pro — NGN 10,000 or $10 a month: 1,500 products, 5 staff accounts, 150 Zen AI credits a month',
      'Business — NGN 30,000 or $30 a month: unlimited products, unlimited staff, 600 Zen AI credits a month',
    ],
    link: { href: '/pricing', label: 'See full pricing' },
    keywords: ['plan', 'price', 'limit', 'products', 'staff', 'cost', 'free', 'starter', 'pro'],
  },
  {
    id: 'lapsed-plan',
    category: 'billing',
    q: 'What happens if my subscription lapses?',
    a: 'You drop back to the Starter plan. You are never locked out of your own register, and a sale in progress is never interrupted — expiry downgrades your plan, it does not revoke your access. Your data stays yours.',
    note: 'Entitlements gate features. They never brick the shop.',
    keywords: ['expire', 'lapsed', 'downgrade', 'renew', 'locked out', 'cancel'],
  },
  {
    id: 'lifetime',
    category: 'billing',
    q: 'What does lifetime access mean?',
    a: 'A lifetime account never expires and is always treated as Business, with every Business limit. There is nothing to renew.',
    keywords: ['lifetime', 'forever', 'perpetual', 'one time'],
  },
];

const PLATFORMS = [
  { icon: <Laptop className="h-5 w-5" />, label: 'Windows & macOS', detail: 'Native desktop app' },
  { icon: <Tablet className="h-5 w-5" />, label: 'Android & iOS', detail: 'On the shop floor' },
  { icon: <Globe className="h-5 w-5" />, label: 'Web', detail: 'Any browser' },
];

const GUARANTEES = [
  {
    icon: <WifiOff className="h-5 w-5" />,
    title: 'The till outlives the connection',
    detail: 'Sales queue locally in order and upload when the network returns. Losing internet does not stop you trading.',
  },
  {
    icon: <Lock className="h-5 w-5" />,
    title: 'Your data is isolated from other businesses',
    detail: 'Every record is bound to your business, and that isolation is enforced by database rules rather than by application code alone.',
  },
  {
    icon: <Cpu className="h-5 w-5" />,
    title: 'Zen AI cannot write, and does not keep your prompts',
    detail: 'It proposes changes for you to approve, and prompt text is never stored.',
  },
  {
    icon: <CheckCircle2 className="h-5 w-5" />,
    title: 'A lapsed plan never locks the register',
    detail: 'Expiry downgrades you to Starter. It does not take your shop offline or hold your records hostage.',
  },
];

export default function HelpCenterPage() {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<CategoryId | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const countFor = React.useCallback(
    (id: CategoryId) => ARTICLES.filter((a) => a.category === id).length,
    [],
  );

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTICLES.filter((a) => {
      if (category && a.category !== category) return false;
      if (!q) return true;
      const haystack = [a.q, a.a, a.note ?? '', ...(a.bullets ?? []), ...(a.keywords ?? [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, category]);

  const filtered = Boolean(query.trim() || category);

  /** Group the visible articles under their category heading. */
  const grouped = React.useMemo(
    () =>
      CATEGORIES.map((c) => ({
        category: c,
        articles: results.filter((a) => a.category === c.id),
      })).filter((g) => g.articles.length > 0),
    [results],
  );

  const openArticles = React.useCallback((id: CategoryId) => {
    setCategory(id);
    setQuery('');
    document.getElementById('articles')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative flex items-center justify-center overflow-hidden bg-transparent px-6 pb-16 pt-28 md:py-32">
        <div className="absolute inset-0 z-0">
          <InteractiveGrid />
          <div className="aura-background" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <LifeBuoy className="h-4 w-4" />
            <span>Support &amp; Resources</span>
          </div>
          <h1 className="mb-6 font-headline text-3xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            How can we help?
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            {ARTICLES.length} answers about running Zeneva — searchable, and written against
            what the app actually does today.
          </p>
        </div>
      </section>

      {/* Search */}
      <section className="bg-primary/5 px-6 py-12">
        <div className="mx-auto -mt-20 max-w-3xl">
          <div className="flex items-center rounded-xl border border-border/60 bg-card p-2 shadow-lg transition-all focus-within:ring-2 focus-within:ring-primary/30">
            <Search className="mx-3 h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCategory(null);
              }}
              placeholder="Search — offline, variants, permissions, expiry, refunds..."
              aria-label="Search help articles"
              className="flex-1 border-none bg-transparent py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="mr-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Popular:</span>
            {['offline', 'variants', 'permissions', 'expiry'].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setQuery(term);
                  setCategory(null);
                }}
                className="rounded-md px-1.5 py-0.5 transition-colors hover:text-primary hover:underline"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-headline text-3xl font-bold">Browse by category</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Six areas, every one of them backed by real answers rather than a placeholder.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openArticles(c.id)}
                  className={`group flex flex-col rounded-2xl border bg-card p-6 text-left shadow-sm transition-all hover:shadow-md ${
                    active ? 'border-primary shadow-md' : 'border-border/60 hover:border-primary/40'
                  }`}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                      {c.icon}
                    </div>
                    <span className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {countFor(c.id)} articles
                    </span>
                  </div>
                  <h3 className="mb-2 font-headline text-xl font-semibold transition-colors group-hover:text-primary">
                    {c.title}
                  </h3>
                  <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {c.description}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Read answers
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section id="articles" className="scroll-mt-24 border-t border-border/60 bg-secondary/40 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-headline text-3xl font-bold">
                {category ? CATEGORIES.find((c) => c.id === category)?.title : 'All answers'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
                {filtered
                  ? `${results.length} of ${ARTICLES.length} articles`
                  : `${ARTICLES.length} articles`}
              </p>
            </div>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory(null);
                }}
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Show everything
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card p-10 text-center">
              <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="mb-2 font-headline text-lg font-semibold">Nothing matched that</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Try a plainer word, or ask us directly — a question nobody can find an answer to
                is a gap in this page, and we would like to know about it.
              </p>
              <Link
                href="/contact"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Ask us
              </Link>
            </div>
          ) : (
            <div className="space-y-12">
              {grouped.map(({ category: c, articles }) => (
                <div key={c.id}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {React.isValidElement(c.icon)
                        ? React.cloneElement(c.icon as React.ReactElement, {
                            className: 'h-4 w-4',
                          })
                        : c.icon}
                    </div>
                    <h3 className="font-headline text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      {c.title}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {articles.map((a) => {
                      const isOpen = openId === a.id;
                      return (
                        <div
                          key={a.id}
                          className={`overflow-hidden rounded-2xl border bg-card transition-all ${
                            isOpen
                              ? 'border-primary/40 shadow-md'
                              : 'border-border/60 shadow-sm hover:border-primary/30'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenId(isOpen ? null : a.id)}
                            aria-expanded={isOpen}
                            className="flex w-full items-center justify-between gap-4 p-5 text-left"
                          >
                            <span className="font-semibold">{a.q}</span>
                            <ChevronDown
                              className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${
                                isOpen ? 'rotate-180 text-primary' : ''
                              }`}
                            />
                          </button>

                          {isOpen && (
                            <div className="space-y-4 border-t border-border/60 px-5 pb-5 pt-4">
                              <p className="text-sm leading-relaxed text-muted-foreground">
                                {a.a}
                              </p>

                              {a.bullets && (
                                <ul className="space-y-2">
                                  {a.bullets.map((b) => (
                                    <li key={b} className="flex items-start gap-2.5 text-sm">
                                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                      <span>{b}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {a.note && (
                                <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
                                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <p className="text-sm leading-relaxed">{a.note}</p>
                                </div>
                              )}

                              {a.link && (
                                <Link
                                  href={a.link.href}
                                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                >
                                  {a.link.label}
                                  <ArrowRight className="h-4 w-4" />
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Reference: guarantees, platforms, guides */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                What we guarantee
              </span>
            </div>
            <h2 className="mb-4 font-headline text-3xl font-bold md:text-4xl">
              The four rules the product is built on
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              These are not settings you can misconfigure. They are decisions baked into how
              Zeneva works, and they are the reason the rest of it behaves predictably.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {GUARANTEES.map((g) => (
              <div
                key={g.title}
                className="rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/30"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {g.icon}
                </div>
                <h3 className="mb-1.5 font-semibold">{g.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{g.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {PLATFORMS.map((p) => (
              <div
                key={p.label}
                className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {p.icon}
                </div>
                <div>
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-sm text-muted-foreground">{p.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-6 rounded-2xl border border-border/60 bg-secondary p-8 md:flex-row md:items-center">
            <div>
              <h3 className="mb-1.5 font-headline text-xl font-semibold">
                Longer walkthroughs
              </h3>
              <p className="text-sm text-muted-foreground">
                Step-by-step guides for offline sync, staff permissions, barcode scanners and
                low-stock alerts.
              </p>
            </div>
            <Link
              href="/help-center/guides"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Open the guides
            </Link>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="border-t border-border/60 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <LifeBuoy className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mb-4 font-headline text-2xl font-bold">Still need help?</h2>
          <p className="mx-auto mb-10 max-w-xl text-muted-foreground">
            If the answer is not above, reach a person. Signed-in users can also open a support
            thread from inside the app, which carries your shop details with it.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="https://wa.me/2349064233805"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </div>
              <span className="font-semibold group-hover:text-primary">WhatsApp</span>
              <span className="text-sm text-muted-foreground">Fastest for a quick question</span>
            </Link>

            <Link
              href="mailto:zenevapos@gmail.com"
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <span className="font-semibold group-hover:text-primary">Email</span>
              <span className="text-sm text-muted-foreground">Best for anything detailed</span>
            </Link>

            <Link
              href="/contact"
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <span className="font-semibold group-hover:text-primary">Contact form</span>
              <span className="text-sm text-muted-foreground">Tell us about your shop</span>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
