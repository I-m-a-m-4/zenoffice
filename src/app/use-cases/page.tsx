'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShoppingBag, Pill, Shirt, Smartphone, MapPin, Search, ArrowRight, Zap, Truck,
  Sofa, Sparkles, Store, Sandwich, WifiOff, CheckCircle2, Star, Compass,
  ChevronDown, Laptop, Tablet, Globe, Boxes, ShieldCheck, X,
} from 'lucide-react';

import MarketingHeader from '@/components/layout/marketing-header';
import MarketingFooter from '@/components/layout/marketing-footer';
import { TOKENS, CANVAS_CSS, CARD, BADGE, BTN_PRIMARY, BTN_SECONDARY } from '@/components/use-cases/canvas-theme';
import { TradeFlow, type FlowNodeSpec } from '@/components/use-cases/trade-flow';
import { Reveal, stagger } from '@/components/use-cases/reveal';

/**
 * `/use-cases`, in the n8n design language.
 *
 * The borrowed idea is that a workflow canvas explains a product better than a
 * feature list does: a trade goes in one side, Zen AI sits in the middle, and the
 * capabilities that answer that trade's bottleneck come out the other. Picking a
 * trade in the rail re-routes the canvas. Everything visual — palette, node boxes,
 * hairline edges, mono chrome, the dot grid — comes from
 * `src/components/use-cases/canvas-theme.ts`, inverted to a light ground; see that
 * file's header for why it is light when n8n's own is dark.
 *
 * The copy is unchanged from the previous version of this page. It is accurate
 * about shipped behaviour and the plan numbers are kept in step with
 * `src/lib/plan.ts`, so this was a re-skin and a re-structure, not a rewrite of
 * the claims.
 */

/** A lucide icon, as a component rather than an element, so it can be re-rendered at several sizes. */
type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

/**
 * Industry taxonomy. These six sectors are the ones a business actually picks
 * from during onboarding (`industries` in src/app/(app)/onboarding/page.tsx), so
 * a visitor who recognises their shop here lands on the same label they will be
 * asked for on signup. The cards below are sub-verticals of those six.
 */
const SECTORS = [
  'Food & Beverage',
  'Health & Beauty',
  'Fashion & Apparel',
  'Electronics',
  'Home & Furniture',
  'Retail & E-commerce',
] as const;

type Sector = (typeof SECTORS)[number];

type UseCase = {
  slug: string;
  title: string;
  sector: Sector;
  /**
   * Held as a component, not an element. The same icon is drawn at three sizes on
   * this page — card chip, rail chip, and the flow canvas's source node — and an
   * element baked with one `className` cannot do that.
   */
  icon: IconType;
  /** The operational bottleneck, in the shop owner's words. */
  pain: string;
  /** Three capabilities that address it. Every one of these is shipped today. */
  solves: { label: string; detail: string }[];
  /** What keeps working when the connection drops. */
  offline: string;
  /** Extra search terms so someone can find their trade by the word they use. */
  keywords: string[];
};

const USE_CASES: UseCase[] = [
  {
    slug: 'supermarkets',
    title: 'Supermarkets & Grocery',
    sector: 'Food & Beverage',
    icon: ShoppingBag,
    pain: 'Thousands of SKUs, short shelf lives, and a queue that cannot wait for a page to load.',
    solves: [
      { label: 'Expiry dates per product', detail: 'Set an expiry on any product and see what is about to turn before it becomes waste.' },
      { label: 'Data-health scanner', detail: 'Inventory > Troubleshoot sweeps the catalogue for missing prices, uncategorised products, probable duplicates and negative stock.' },
      { label: 'Bulk CSV import & export', detail: 'Load an existing spreadsheet catalogue in one pass instead of typing several thousand rows.' },
    ],
    offline: 'Full register and instant product search, read straight from the local mirror.',
    keywords: ['grocery', 'supermarket', 'mart', 'provisions', 'food', 'store'],
  },
  {
    slug: 'pharmacies',
    title: 'Pharmacies & Health Stores',
    sector: 'Health & Beauty',
    icon: Pill,
    pain: 'Expiry is a compliance matter, not a nuisance, and every price change needs to be attributable.',
    solves: [
      { label: 'Expiry tracking', detail: 'Products carry an expiry date, so short-dated stock surfaces while it can still be moved or returned.' },
      { label: 'Audit log', detail: 'Every change is recorded with who made it and when. Nothing is edited anonymously.' },
      { label: 'Locked-down pricing', detail: 'Override Prices and Apply Discounts are separate permissions you can withhold from counter staff.' },
    ],
    offline: 'Dispensing and receipt printing continue; the log syncs in order once you reconnect.',
    keywords: ['pharmacy', 'chemist', 'drugs', 'medication', 'health', 'clinic'],
  },
  {
    slug: 'fashion',
    title: 'Fashion & Boutiques',
    sector: 'Fashion & Apparel',
    icon: Shirt,
    pain: 'One style becomes twenty rows once you account for size and colour, and last season quietly eats your cash.',
    solves: [
      { label: 'Real variant products', detail: 'A parent style holds its variants, each with its own SKU, price and stock count, grouped under one name in the catalogue.' },
      { label: 'Trapped-cash analysis', detail: 'Ask Zen AI what is not moving and it reports the money sitting in slow stock, per product.' },
      { label: 'Category splits', detail: 'Reports break takings down by category so you can see which rail actually pays.' },
    ],
    offline: 'Sales, variant lookup and stock edits all work with no connection.',
    keywords: ['fashion', 'boutique', 'clothing', 'apparel', 'shoes', 'thrift', 'tailor'],
  },
  {
    slug: 'electronics',
    title: 'Phone & Electronics Shops',
    sector: 'Electronics',
    icon: Smartphone,
    pain: 'High-value units, customers who pay a deposit now and the balance later, and bundles priced as one item.',
    solves: [
      { label: 'Composite bundles', detail: 'A product can be a bundle, so a phone plus case plus screen guard sells as a single priced line.' },
      { label: 'Invoice ledger', detail: 'Outstanding balances live in their own ledger instead of a notebook under the counter.' },
      { label: 'Held sales', detail: 'Park a cart mid-transaction, serve the next customer, and recall it when they come back with the balance.' },
    ],
    offline: 'Deposits, held carts and receipts are all recorded locally first.',
    keywords: ['electronics', 'phones', 'gadgets', 'computers', 'accessories', 'repair'],
  },
  {
    slug: 'multi-branch',
    title: 'Multi-Branch Chains',
    sector: 'Retail & E-commerce',
    icon: MapPin,
    pain: 'Nobody can say which branch actually holds the stock, and a sale made offline lands against the wrong shop.',
    solves: [
      { label: 'Per-branch stock', detail: 'Every location keeps its own counts, with an active-branch switcher in the shell.' },
      { label: 'Correct offline attribution', detail: 'The active branch is attached to a sale at the moment it is queued, not when it uploads, so offline takings land on the right branch.' },
      { label: 'Consolidated reporting', detail: 'Takings, profit and best sellers roll up across every location in one view.' },
    ],
    offline: 'Each branch keeps selling independently and reconciles in order on reconnect.',
    keywords: ['chain', 'branches', 'locations', 'multi-store', 'franchise', 'outlets'],
  },
  {
    slug: 'wholesale',
    title: 'Wholesale & Distribution',
    sector: 'Retail & E-commerce',
    icon: Truck,
    pain: 'Everybody pays later. Money is owed to you and by you, and both sides need to be visible at once.',
    solves: [
      { label: 'Customer invoice ledger', detail: 'Track what each buyer still owes, separately from completed receipts.' },
      { label: 'Supplier debts', detail: 'Inventory > Debts records what you owe upstream, so cash planning uses both directions.' },
      { label: 'Bulk price updates', detail: 'Export the catalogue, reprice in a spreadsheet, import it back.' },
    ],
    offline: 'Order taking and invoice creation do not need a connection.',
    keywords: ['wholesale', 'distribution', 'bulk', 'supplier', 'trade', 'depot', 'b2b'],
  },
  {
    slug: 'furniture',
    title: 'Home & Furniture',
    sector: 'Home & Furniture',
    icon: Sofa,
    pain: 'Few sales, large tickets, part-payment, and weeks between the order and the delivery.',
    solves: [
      { label: 'Part-payment on invoice', detail: 'An invoice carries its outstanding balance until it is settled, however many instalments that takes.' },
      { label: 'Held sales', detail: 'A quote can sit parked while the customer measures the room.' },
      { label: 'Customer history', detail: 'Spend history and last-seen on every customer, so a follow-up call has context.' },
    ],
    offline: 'Quotes, invoices and payments are all recorded locally first.',
    keywords: ['furniture', 'home', 'interior', 'appliances', 'decor', 'mattress'],
  },
  {
    slug: 'beauty',
    title: 'Beauty & Cosmetics Counters',
    sector: 'Health & Beauty',
    icon: Sparkles,
    pain: 'Small baskets, the same faces every month, and promotions that need to stay controlled.',
    solves: [
      { label: 'Loyalty points', detail: 'Customers accrue points against a reward threshold you set yourself.' },
      { label: 'Discounts and coupons', detail: 'Apply either at checkout, gated behind a permission so not every till can do it.' },
      { label: 'Spend history', detail: 'See what a regular actually buys before you recommend anything.' },
    ],
    offline: 'Points and discounts are calculated locally, so the queue never stalls.',
    keywords: ['beauty', 'cosmetics', 'salon', 'skincare', 'perfume', 'hair'],
  },
  {
    slug: 'mini-marts',
    title: 'Neighbourhood Shops & Mini-marts',
    sector: 'Retail & E-commerce',
    icon: Store,
    pain: 'One person runs the whole shop, the power and the data are both unreliable, and there is no software budget.',
    solves: [
      { label: 'Free forever on Starter', detail: 'Up to 50 products, one staff account and 3 Zen AI credits a month at no cost. No trial, no card.' },
      { label: 'Runs on what you own', detail: 'Windows and macOS desktop, Android, iOS, or just the browser.' },
      { label: 'A lapsed plan never locks the till', detail: 'If a paid plan expires you drop back to Starter. The register does not stop mid-sale.' },
    ],
    offline: 'Everything a single-till shop does day to day works with no internet at all.',
    keywords: ['kiosk', 'mini-mart', 'corner shop', 'small business', 'free', 'single till'],
  },
  {
    slug: 'food-counters',
    title: 'Food Counters & Takeaways',
    sector: 'Food & Beverage',
    icon: Sandwich,
    pain: 'A rush that lasts ninety minutes, then a stock-take on what did not sell before close.',
    solves: [
      { label: 'Four-step checkout', detail: 'Products, customer, payment, review. Nothing to hunt for during a rush.' },
      { label: 'Peak-hours report', detail: 'See exactly when your rush starts so you can staff for it rather than guess.' },
      { label: 'Daily report', detail: 'One end-of-day summary of takings, profit and what moved.' },
    ],
    offline: 'The whole rush can be served offline and uploaded afterwards.',
    keywords: ['restaurant', 'takeaway', 'cafe', 'fast food', 'bakery', 'drinks', 'bar'],
  },
];

/** Shipped in every plan, including the free one. */
const UNIVERSAL: { icon: IconType; title: string; detail: string }[] = [
  { icon: WifiOff, title: 'Offline-first register', detail: 'Sales queue locally in order and upload when the connection returns. The till never waits for the internet.' },
  { icon: Boxes, title: 'One write path', detail: 'Every sale, stock change and customer edit goes through the same queue, which is why offline survival and branch attribution are consistent.' },
  { icon: Zap, title: 'Zen AI over your own data', detail: '41 typed tools covering sales velocity, margins, replenishment and slow stock. It proposes; you approve.' },
  { icon: ShieldCheck, title: 'Roles and granular permissions', detail: 'Three roles plus eight individual permissions, re-verified server-side rather than hidden in the UI.' },
  { icon: CheckCircle2, title: 'Audit log', detail: 'Every change, by whom, when.' },
  { icon: Star, title: 'Receipts and invoices', detail: 'Print to a thermal printer, export a PDF, email a digital copy, or track an unpaid balance in the ledger.' },
];

const PLATFORMS: { icon: IconType; label: string; detail: string }[] = [
  { icon: Laptop, label: 'Windows & macOS', detail: 'Native desktop app' },
  { icon: Tablet, label: 'Android & iOS', detail: 'On the shop floor' },
  { icon: Globe, label: 'Web', detail: 'Any browser' },
];

/**
 * Plan limits, kept identical to `src/lib/plan.ts`. That file's comment is
 * explicit that the marketing pages carry the same numbers rather than an
 * approximation of them, so change both together or neither.
 */
const PLANS = [
  { name: 'Starter', price: 'Free', products: '50 products', staff: '1 staff account', ai: '3 Zen AI credits a month' },
  { name: 'Pro', price: 'NGN 10,000 / $10 a month', products: '1,500 products', staff: '5 staff accounts', ai: '150 Zen AI credits a month', featured: true },
  { name: 'Business', price: 'NGN 30,000 / $30 a month', products: 'Unlimited products', staff: 'Unlimited staff', ai: '600 Zen AI credits a month' },
];

/**
 * A trade's three capabilities plus its offline guarantee, as canvas nodes.
 *
 * The capabilities carry mono indices rather than icons: the data has no icon per
 * capability and inventing one would assign each a meaning the copy never made.
 * The offline node is the exception — it is a different *kind* of claim, so it gets
 * both the real icon and the tinted `offline` tone.
 */
function flowNodes(uc: UseCase): FlowNodeSpec[] {
  return [
    ...uc.solves.map((s, i) => ({
      id: `s${i}`,
      label: s.label,
      detail: s.detail,
      badge: String(i + 1).padStart(2, '0'),
      tone: 'capability' as const,
    })),
    {
      id: 'offline',
      label: 'With no internet',
      detail: uc.offline,
      icon: WifiOff,
      tone: 'offline' as const,
    },
  ];
}

/** Section eyebrow: mono, uppercase, with the blinking status dot n8n puts on live things. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-code text-[11px] uppercase tracking-[0.14em] text-[var(--uc-primary-ink)]">
      <span className="uc-blink h-1.5 w-1.5 rounded-full bg-[var(--uc-primary)]" />
      {children}
    </span>
  );
}

export default function UseCasesPage() {
  const [query, setQuery] = React.useState('');
  const [sector, setSector] = React.useState<Sector | null>(null);
  const [activeSlug, setActiveSlug] = React.useState<string>(USE_CASES[0].slug);
  const [openSlug, setOpenSlug] = React.useState<string | null>(null);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return USE_CASES.filter((uc) => {
      if (sector && uc.sector !== sector) return false;
      if (!q) return true;
      const haystack = [uc.title, uc.sector, uc.pain, ...uc.keywords, ...uc.solves.map((s) => s.label)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, sector]);

  const filtered = Boolean(query.trim() || sector);

  /**
   * The canvas always shows something that is actually in the rail.
   *
   * Derived rather than synced in an effect: filtering can remove the active trade
   * from the rail, and an effect that corrected that afterwards would render one
   * frame of a canvas whose tab is no longer on screen.
   */
  const active = results.find((uc) => uc.slug === activeSlug) ?? results[0] ?? null;

  const railRef = React.useRef<HTMLDivElement | null>(null);

  /**
   * Which way the rail actually runs, for `aria-orientation`.
   *
   * The rail is a horizontal scroller until `lg`, where it becomes a column — and
   * ARIA has no responsive form, so a hardcoded value is wrong on one of the two.
   * `false` on the server and on first paint matches the mobile-first CSS, so the
   * correction after mount only ever happens on desktop.
   */
  const [railVertical, setRailVertical] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setRailVertical(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /**
   * Arrow-key navigation for the trade rail.
   *
   * `role="tablist"` is a promise to a screen-reader user that the arrow keys move
   * between tabs and that Tab leaves the group — the roving `tabIndex` below is the
   * other half of it. Declaring the role without this is worse than using plain
   * toggle buttons, because it advertises a keyboard model that is not there.
   *
   * Activation follows focus, which is the correct variant here: switching trade
   * only re-routes a diagram, so there is nothing expensive to defer.
   */
  const onRailKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const nav = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!nav.includes(e.key)) return;

    const tabs = Array.from(
      railRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    if (tabs.length === 0) return;

    const focused = tabs.findIndex((t) => t === document.activeElement);
    const from = focused === -1 ? tabs.findIndex((t) => t.dataset.slug === active?.slug) : focused;
    const last = tabs.length - 1;

    let next: number;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = from >= last ? 0 : from + 1;
    else next = from <= 0 ? last : from - 1;

    const target = tabs[next];
    if (!target?.dataset.slug) return;
    e.preventDefault();
    target.focus();
    setActiveSlug(target.dataset.slug);
  };

  return (
    <main className="uc-root min-h-screen bg-[var(--uc-canvas)] font-dm-sans text-[var(--uc-ink)]" style={TOKENS}>
      <style>{CANVAS_CSS}</style>
      {/* The reveal starts at opacity 0 and is switched on by IntersectionObserver.
          `Reveal` falls back to visible when the API is missing, but that is a JS
          fallback and does nothing if JS never runs at all — the page is server-
          rendered, so without this every section below the hero ships as invisible
          text. A reveal animation must never be able to hide its own content. */}
      <noscript>
        <style>{'.uc-root .uc-rise{opacity:1!important;transform:none!important}'}</style>
      </noscript>
      <MarketingHeader />

      {/* ================================================================== Hero */}
      {/* `pt-32 md:pt-40` matches the other marketing heroes (blog, our-mission).
          MarketingHeader is `fixed`, and with the promo banner stacked above it the
          chrome is ~128px tall on a phone — anything less clips the eyebrow line. */}
      <section className="relative isolate overflow-hidden px-6 pb-16 pt-32 md:pb-20 md:pt-40">
        {/* The canvas ground: dot grid, faded out at the edges so it reads as a
            surface the page sits on rather than a tiled background image. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="uc-grid absolute inset-0"
            style={{
              maskImage: 'radial-gradient(ellipse 90% 70% at 50% 35%, #000 30%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 35%, #000 30%, transparent 100%)',
            }}
          />
          <div className="uc-bloom-a absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-[var(--uc-primary)]/10 blur-3xl" />
          <div className="uc-bloom-b absolute -right-20 top-24 h-[360px] w-[360px] rounded-full bg-[var(--uc-glow)]/10 blur-3xl" />
        </div>

        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="uc-rise" style={stagger(0)}>
            <Eyebrow>Who is Zeneva for?</Eyebrow>
          </div>
          <h1
            className="uc-rise mt-5 font-bricolage text-4xl font-bold leading-[1.05] tracking-[-0.02em] sm:text-5xl md:text-6xl"
            style={stagger(1)}
          >
            Built for shops that
            <br className="hidden sm:block" />{' '}
            <span className="text-[var(--uc-primary)]">cannot stop selling</span>
          </h1>
          <p
            className="uc-rise mx-auto mt-6 max-w-2xl text-lg leading-[1.7] text-[var(--uc-ink-soft)]"
            style={stagger(2)}
          >
            Ten trades, one register. Pick the way your shop actually works and watch which
            parts of Zeneva route to it.
          </p>
          <div className="uc-rise mt-9 flex flex-col justify-center gap-3 sm:flex-row" style={stagger(3)}>
            <Link href="/signup" className={BTN_PRIMARY}>
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#flow" className={BTN_SECONDARY}>
              Open the canvas
            </a>
          </div>
        </Reveal>
      </section>

      {/* ========================================================= The flow studio */}
      <section id="flow" className="scroll-mt-24 px-6 pb-20 md:pb-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-10 max-w-2xl">
            <div className="uc-rise" style={stagger(0)}>
              <Eyebrow>zeneva.flow</Eyebrow>
            </div>
            <h2
              className="uc-rise mt-4 font-bricolage text-3xl font-bold tracking-[-0.01em] md:text-4xl"
              style={stagger(1)}
            >
              Pick your trade. Watch it route.
            </h2>
            {/* No direction named on purpose: the canvas runs left-to-right on
                desktop and top-to-bottom once it stacks, so "on the left" was
                wrong on every phone. "Pick" likewise covers hover, tap and
                keyboard focus, all three of which select a node. */}
            <p className="uc-rise mt-4 leading-[1.7] text-[var(--uc-ink-soft)]" style={stagger(2)}>
              Your bottleneck goes in one end. Zen AI sits in the middle. What comes out is
              the specific set of capabilities built for it — pick a node to read what it does.
            </p>
          </Reveal>

          {/* Search. n8n's input: hairline box on paper, accent border on focus. */}
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-[var(--uc-hairline)] bg-[var(--uc-paper)] px-3 transition-colors duration-300 focus-within:border-[var(--uc-primary)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--uc-ink-soft)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your trade — pharmacy, boutique, wholesale, kiosk..."
              aria-label="Search industries"
              className="min-w-0 flex-1 border-none bg-transparent py-3 font-dm-sans text-sm text-[var(--uc-ink)] placeholder:text-[var(--uc-ink-soft)] focus:outline-none focus:ring-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="shrink-0 rounded-md p-1.5 text-[var(--uc-ink-soft)] transition-colors hover:bg-[var(--uc-cloud)] hover:text-[var(--uc-ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sector filter */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSector(null)}
              aria-pressed={sector === null}
              className={`rounded-full border px-3 py-1.5 font-dm-sans text-xs transition-colors duration-300 ${
                sector === null
                  ? 'border-[var(--uc-primary)] bg-[var(--uc-primary)] text-white'
                  : 'border-[var(--uc-hairline)] bg-[var(--uc-cloud)] text-[var(--uc-ink-soft)] hover:border-[var(--uc-primary)]/60 hover:text-[var(--uc-ink)]'
              }`}
            >
              All sectors
            </button>
            {SECTORS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSector(sector === s ? null : s)}
                aria-pressed={sector === s}
                className={`rounded-full border px-3 py-1.5 font-dm-sans text-xs transition-colors duration-300 ${
                  sector === s
                    ? 'border-[var(--uc-primary)] bg-[var(--uc-primary)] text-white'
                    : 'border-[var(--uc-hairline)] bg-[var(--uc-cloud)] text-[var(--uc-ink-soft)] hover:border-[var(--uc-primary)]/60 hover:text-[var(--uc-ink)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {active ? (
            <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              {/* The rail. A node palette: every trade in scope, the active one lit.
                  `aria-selected` + `role=tab` because this genuinely is a tab set —
                  one panel, ten selectors. */}
              <div
                ref={railRef}
                role="tablist"
                aria-label="Trades"
                aria-orientation={railVertical ? 'vertical' : 'horizontal'}
                onKeyDown={onRailKeyDown}
                className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0"
              >
                {results.map((uc, i) => {
                  const isActive = uc.slug === active.slug;
                  const Icon = uc.icon;
                  return (
                    <button
                      key={uc.slug}
                      type="button"
                      role="tab"
                      id={`trade-tab-${uc.slug}`}
                      data-slug={uc.slug}
                      aria-selected={isActive}
                      aria-controls="trade-panel"
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => setActiveSlug(uc.slug)}
                      className={`group relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-lg border px-3 py-2.5 text-start transition-colors duration-300 lg:w-full lg:shrink ${
                        isActive
                          ? 'border-[var(--uc-primary)] bg-[var(--uc-cloud)]'
                          : 'border-[var(--uc-hairline)] bg-[var(--uc-paper)] hover:border-[var(--uc-primary)]/50 hover:bg-[var(--uc-cloud)]'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-300 ${
                          isActive
                            ? 'bg-[var(--uc-primary)] text-white'
                            : 'bg-[var(--uc-primary)]/10 text-[var(--uc-primary-ink)]'
                        }`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className="block whitespace-nowrap font-bricolage text-[13px] font-semibold leading-tight lg:whitespace-normal lg:line-clamp-2">
                          {uc.title}
                        </span>
                        <span className="hidden font-code text-[9px] uppercase tracking-[0.1em] text-[var(--uc-ink-soft)] lg:block">
                          {uc.sector}
                        </span>
                      </span>
                      <span className="ms-auto hidden font-code text-[10px] text-[var(--uc-ink-soft)] lg:block">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {/* Routing cue: a beam that fills the tab's bottom edge once,
                          keyed by slug so re-picking the same trade replays it. */}
                      {isActive && (
                        <span
                          key={uc.slug}
                          aria-hidden
                          className="uc-progress absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[var(--uc-primary)]"
                          style={{ animationDuration: '620ms' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* The panel. Sticky on desktop: the rail is ten tabs tall and the
                  canvas is not, so without it the diagram scrolls away while you
                  are still choosing which trade to send through it. `items-start`
                  on the grid is the other half — a stretched card would pad the
                  footer out with dead space to match the rail's height. */}
              <div
                role="tabpanel"
                id="trade-panel"
                aria-labelledby={`trade-tab-${active.slug}`}
                className={`overflow-hidden lg:sticky lg:top-24 ${CARD}`}
              >
                <TradeFlow
                  seed={active.slug}
                  source={{ label: active.title, meta: active.sector, icon: active.icon }}
                  nodes={flowNodes(active)}
                  summary={active.pain}
                />
              </div>
            </div>
          ) : (
            <div className={`mx-auto max-w-md p-10 text-center ${CARD}`}>
              <Compass className="mx-auto mb-4 h-10 w-10 text-[var(--uc-ink-soft)]" />
              <h3 className="mb-2 font-bricolage text-lg font-semibold">No match for that trade</h3>
              <p className="mb-6 text-sm leading-[1.7] text-[var(--uc-ink-soft)]">
                Zeneva is not limited to the ten here — these are just the ones we have written
                up. Tell us what you sell and we will walk you through the fit.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSector(null);
                  }}
                  className={BTN_SECONDARY}
                >
                  Clear filters
                </button>
                <Link href="/contact" className={BTN_PRIMARY}>
                  Ask us
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================== Use-case cards */}
      <section className="border-t border-[var(--uc-hairline)] bg-[var(--uc-paper)] px-6 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-12 text-center">
            <div className="uc-rise" style={stagger(0)}>
              <Eyebrow>Every trade, in full</Eyebrow>
            </div>
            <h2
              className="uc-rise mt-4 font-bricolage text-3xl font-bold tracking-[-0.01em] md:text-4xl"
              style={stagger(1)}
            >
              The bottleneck first, then the fix
            </h2>
            <p
              className="uc-rise mx-auto mt-4 max-w-2xl leading-[1.7] text-[var(--uc-ink-soft)]"
              style={stagger(2)}
            >
              Each card names the problem in the shop owner&apos;s words, then the specific
              features that deal with it. Open one for the detail.
            </p>
            <p
              className="uc-rise mt-4 font-code text-[11px] uppercase tracking-[0.1em] text-[var(--uc-ink-soft)]"
              style={stagger(3)}
              aria-live="polite"
            >
              {filtered
                ? `${results.length} / ${USE_CASES.length} use cases`
                : `${USE_CASES.length} use cases`}
            </p>
          </Reveal>

          {results.length > 0 && (
            <Reveal className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {results.map((uc, i) => {
                const isOpen = openSlug === uc.slug;
                const Icon = uc.icon;
                return (
                  <article
                    key={uc.slug}
                    style={stagger(i)}
                    className={`group uc-rise relative flex flex-col overflow-hidden p-6 transition-colors duration-300 hover:border-[var(--uc-primary)]/55 ${CARD}`}
                  >
                    {/* Hover sweep — the one thing on the page that is pure n8n
                        canvas flavour: a scan passing over the node you are on. */}
                    <span
                      aria-hidden
                      className="uc-scanline pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-[var(--uc-primary)]/10 to-transparent"
                    />

                    <div className="mb-4 flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--uc-primary)]/10 text-[var(--uc-primary-ink)] transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none">
                        <Icon className="h-5 w-5" strokeWidth={1.9} />
                      </span>
                      <span className={BADGE}>{uc.sector}</span>
                    </div>

                    <h3 className="mb-2 font-bricolage text-lg font-semibold leading-tight transition-colors duration-300 group-hover:text-[var(--uc-primary-ink)]">
                      {uc.title}
                    </h3>
                    <p className="mb-5 text-sm leading-[1.7] text-[var(--uc-ink-soft)]">{uc.pain}</p>

                    <ul className="mb-5 space-y-2">
                      {uc.solves.map((s) => (
                        <li key={s.label} className="flex items-start gap-2.5 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--uc-primary)]" />
                          <span className="font-medium">{s.label}</span>
                        </li>
                      ))}
                    </ul>

                    {isOpen && (
                      <div className="uc-expand mb-5 space-y-4 rounded-xl border border-[var(--uc-hairline)] bg-[var(--uc-cloud)] p-4">
                        {uc.solves.map((s) => (
                          <div key={s.label}>
                            <p className="font-code text-[10px] uppercase tracking-[0.1em] text-[var(--uc-primary-ink)]">
                              {s.label}
                            </p>
                            <p className="mt-1.5 text-sm leading-[1.7] text-[var(--uc-ink-soft)]">
                              {s.detail}
                            </p>
                          </div>
                        ))}
                        <div className="flex items-start gap-2.5 border-t border-[var(--uc-hairline)] pt-3">
                          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-[var(--uc-primary)]" />
                          <div>
                            <p className="font-code text-[10px] uppercase tracking-[0.1em] text-[var(--uc-primary-ink)]">
                              With no internet
                            </p>
                            <p className="mt-1.5 text-sm leading-[1.7] text-[var(--uc-ink-soft)]">
                              {uc.offline}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--uc-hairline)] pt-4">
                      <button
                        type="button"
                        onClick={() => setOpenSlug(isOpen ? null : uc.slug)}
                        aria-expanded={isOpen}
                        className="inline-flex items-center gap-1 font-code text-[11px] uppercase tracking-[0.08em] text-[var(--uc-primary-ink)] transition-colors hover:text-[var(--uc-primary)]"
                      >
                        {isOpen ? 'Show less' : 'How it works'}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSlug(uc.slug);
                          document.getElementById('flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="inline-flex items-center gap-1 font-code text-[11px] uppercase tracking-[0.08em] text-[var(--uc-ink-soft)] transition-colors hover:text-[var(--uc-ink)]"
                      >
                        Route it <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </Reveal>
          )}
        </div>
      </section>

      {/* ================================================= Universal capabilities */}
      <section className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-10 max-w-2xl">
            <div className="uc-rise" style={stagger(0)}>
              <Eyebrow>Not industry-specific</Eyebrow>
            </div>
            <h2
              className="uc-rise mt-4 font-bricolage text-3xl font-bold tracking-[-0.01em] md:text-4xl"
              style={stagger(1)}
            >
              In every plan, including the free one
            </h2>
            <p className="uc-rise mt-4 leading-[1.7] text-[var(--uc-ink-soft)]" style={stagger(2)}>
              Whatever you sell, these are the parts that do not vary by trade. Setup for each is
              covered in the{' '}
              <Link href="/help-center" className="text-[var(--uc-primary-ink)] underline decoration-[var(--uc-primary)]/40 underline-offset-4 hover:decoration-[var(--uc-primary)]">
                Help Center
              </Link>
              .
            </p>
          </Reveal>

          <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {UNIVERSAL.map((c, i) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  style={stagger(i)}
                  className={`group uc-rise p-5 transition-colors duration-300 hover:border-[var(--uc-primary)]/55 ${CARD}`}
                >
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--uc-primary)]/10 text-[var(--uc-primary-ink)] transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none">
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <h3 className="mb-1.5 font-bricolage text-[15px] font-semibold">{c.title}</h3>
                  <p className="text-sm leading-[1.7] text-[var(--uc-ink-soft)]">{c.detail}</p>
                </div>
              );
            })}
          </Reveal>

          {/* Where it runs */}
          <Reveal className="mt-4 grid gap-4 sm:grid-cols-3">
            {PLATFORMS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.label}
                  style={stagger(i)}
                  className={`uc-rise flex items-center gap-4 p-5 ${CARD}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--uc-cloud)] text-[var(--uc-primary-ink)]">
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bricolage text-sm font-semibold">{p.label}</p>
                    <p className="font-code text-[10px] uppercase tracking-[0.1em] text-[var(--uc-ink-soft)]">
                      {p.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* ================================================================== Plans */}
      <section className="border-t border-[var(--uc-hairline)] bg-[var(--uc-paper)] px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mb-10 text-center">
            <div className="uc-rise" style={stagger(0)}>
              <Eyebrow>Scale, not capability</Eyebrow>
            </div>
            <h2
              className="uc-rise mt-4 font-bricolage text-3xl font-bold tracking-[-0.01em] md:text-4xl"
              style={stagger(1)}
            >
              Which plan fits
            </h2>
            <p
              className="uc-rise mx-auto mt-4 max-w-2xl leading-[1.7] text-[var(--uc-ink-soft)]"
              style={stagger(2)}
            >
              Every feature above is on every plan. What changes is how much of it you get.
            </p>
          </Reveal>

          <Reveal className="grid gap-5 md:grid-cols-3">
            {PLANS.map((p, i) => (
              <div
                key={p.name}
                style={stagger(i)}
                className={`uc-rise relative p-6 ${
                  p.featured
                    ? 'rounded-2xl border border-[var(--uc-primary)] bg-[var(--uc-cloud)] shadow-[0_16px_40px_-24px_rgba(238,79,39,0.5)]'
                    : CARD
                }`}
              >
                {/* The featured plan gets the hub's rotating rim, so the eye lands on
                    it without a louder colour doing the work. */}
                {p.featured && <span aria-hidden className="uc-rim absolute inset-[-1px] rounded-2xl" />}

                <div className="relative mb-4 flex items-center justify-between gap-2">
                  <h3 className="font-bricolage text-lg font-semibold">{p.name}</h3>
                  {p.featured && (
                    <span className="rounded-full bg-[var(--uc-primary)] px-2.5 py-1 font-code text-[9px] font-bold uppercase tracking-[0.1em] text-white">
                      Most shops
                    </span>
                  )}
                </div>
                <p className="relative mb-5 font-code text-xs uppercase tracking-[0.08em] text-[var(--uc-ink-soft)]">
                  {p.price}
                </p>
                <ul className="relative space-y-2.5 text-sm">
                  {[p.products, p.staff, p.ai].map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--uc-primary)]" />
                      <span className="text-[var(--uc-ink-soft)]">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Reveal>

          <p className="mt-6 text-center text-sm leading-[1.7] text-[var(--uc-ink-soft)]">
            A paid plan that lapses downgrades to Starter. It never locks you out of your own
            register.{' '}
            <Link href="/pricing" className="text-[var(--uc-primary-ink)] underline decoration-[var(--uc-primary)]/40 underline-offset-4 hover:decoration-[var(--uc-primary)]">
              Full pricing
            </Link>
          </p>
        </div>
      </section>

      {/* ==================================================================== CTA */}
      <section className="relative isolate overflow-hidden px-6 py-20 md:py-28">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="uc-grid absolute inset-0"
            style={{
              maskImage: 'radial-gradient(ellipse 70% 80% at 50% 50%, #000 20%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at 50% 50%, #000 20%, transparent 100%)',
            }}
          />
          <div className="uc-bloom-b absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--uc-primary)]/10 blur-3xl" />
        </div>

        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="uc-rise relative mx-auto mb-6 h-16 w-16" style={stagger(0)}>
            <span aria-hidden className="uc-halo absolute -inset-2 rounded-full blur-xl" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[var(--uc-primary)]/50 bg-[var(--uc-paper)]">
              <Zap className="h-7 w-7 text-[var(--uc-primary)]" strokeWidth={1.9} />
            </span>
          </div>
          <h2
            className="uc-rise font-bricolage text-3xl font-bold tracking-[-0.01em] md:text-4xl"
            style={stagger(1)}
          >
            Start on the plan that costs nothing
          </h2>
          <p
            className="uc-rise mx-auto mt-4 max-w-xl leading-[1.7] text-[var(--uc-ink-soft)]"
            style={stagger(2)}
          >
            Starter is free forever — no trial, no card. Add products, ring up a sale, then pull
            the plug and see what still works.
          </p>
          <div className="uc-rise mt-9 flex flex-col justify-center gap-3 sm:flex-row" style={stagger(3)}>
            <Link href="/signup" className={BTN_PRIMARY}>
              Get started for free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className={BTN_SECONDARY}>
              Talk to us
            </Link>
          </div>
        </Reveal>
      </section>

      <MarketingFooter />
    </main>
  );
}
