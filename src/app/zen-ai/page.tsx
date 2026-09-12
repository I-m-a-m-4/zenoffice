'use client';

/**
 * `/zen-ai` — the public marketing page for Zen AI.
 *
 * Design language: the "Zia Agents" system — dark cinematic bands alternating
 * with clean light ones, a single vibrant primary reserved for at most two
 * CTAs, a cool cyan for every secondary action, uppercase button labels and
 * soft elevation. Two slots are deliberately remapped from that spec:
 *
 *   - `primary` is Zeneva orange, not the spec's #ea0000 red. This page sits
 *     under the shared orange `MarketingHeader`; a red CTA there reads as a
 *     different product, not a bolder one.
 *   - the type family is DM Sans, already loaded in `src/app/layout.tsx`. The
 *     spec names `Zoho_Puvi`, which is proprietary — declaring it would fall
 *     back to an unpredictable system face.
 *
 *   - the dark ground is #1e293b, the deep blue this site already uses, not
 *     the spec's #080130. See the note on `--zia-hero-bg` below.
 *
 * Everything else is verbatim: #00abfb cyan, the aqua/magenta accents, the
 * type / radius / shadow / motion scales.
 *
 * Spacing uses Tailwind's default scale, which maps 1:1 onto the spec's tokens
 * (1=4 xxs, 2=8 xs, 3=12 sm, 4=16 md, 6=24 lg, 8=32 xl, 12=48 xxl, 16=64 xxxl,
 * 20=80 section) — so `py-20` *is* `{spacing.section}`. No arbitrary values.
 *
 * Copy is grounded in `docs/zen-ai.md`. Every capability named here is backed
 * by a real tool in `src/app/api/chat/tools.ts`. Do not add a claim that no
 * tool supports: an owner who asks for it, is told Zen AI cannot, and then
 * stops trusting the rest of the page is a worse outcome than a shorter list.
 *
 * The tool count appears twice below, and it is stated rather than derived —
 * importing the toolkit here would drag Firestore admin into the client
 * bundle. Re-check it after adding a tool (docs and CLAUDE.md both still say
 * 41, which is one short):
 *
 *   grep -oE "^\s+[a-zA-Z]+: tool\(\{" src/app/api/chat/tools.ts | wc -l
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  ChevronDown,
  CircleSlash,
  Eye,
  Fingerprint,
  Gauge,
  Lock,
  Minus,
  Receipt,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Check,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import MarketingHeader from '@/components/layout/marketing-header';
import MarketingFooter from '@/components/layout/marketing-footer';
import { ZenMark } from '@/components/ai-insights/zen-mark';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ tokens */

/**
 * The design tokens, scoped to `.zia` so nothing here can leak into the shared
 * header and footer that sit inside the same tree.
 *
 * Note on `--zia-hero-bg`: the source design calls for #080130, a purple-indigo
 * that appears nowhere else on this site and read as a different product sitting
 * under the shared header. It is #1e293b here — the same deep blue as the Get
 * Started button, and the dark surface the rest of the marketing pages use. It
 * is one token, so all four dark bands (hero, approval loop, privacy, closing)
 * move together if it changes again.
 *
 * Keep prose out of the string below: it is injected verbatim into the page, so
 * anything written there ships to the client as a CSS comment.
 */
const TOKENS = `
.zia {
  /* colors */
  --zia-primary: #f47125;
  --zia-primary-bright: #ff8236;
  --zia-primary-deep: #cc5200;
  --zia-on-primary: #ffffff;
  --zia-ink: #05001d;
  --zia-ink-soft: #404040;
  --zia-on-ink: #ffffff;
  --zia-canvas: #ffffff;
  --zia-paper: #ffffff;
  --zia-cloud: #f3f3f3;
  --zia-hairline: #e0e0e0;
  --zia-hairline-strong: #b0b0b0;
  --zia-link: #005ad6;
  --zia-link-pressed: #0047ff;
  /* the site's deep blue — see the note above this string */
  --zia-hero-bg: #1e293b;
  --zia-cyan: #00abfb;
  --zia-magenta: #eb3e49;
  --zia-aqua: #3bffe8;
  --zia-hero-hairline: rgba(255, 255, 255, 0.3);

  /* rounded */
  --zia-r-sm: 5px;
  --zia-r-md: 8px;
  --zia-r-lg: 18px;

  /* shadows */
  --zia-shadow-soft-lift: rgba(0, 0, 0, 0.05) 0px 4px 20px 0px;
  --zia-shadow-card: rgba(65, 67, 132, 0.1) 0px 10px 32px 0px;
  --zia-shadow-cta-glow: rgba(244, 113, 37, 0.28) 0px 20px 40px 0px;
  --zia-shadow-modal: rgba(0, 0, 0, 0.3) 0px 0px 20px 0px;

  /* motion */
  --zia-fast: 200ms;
  --zia-base: 300ms;
  --zia-slow: 500ms;
  --zia-ease: ease-in-out;
  --zia-ease-emphasized: cubic-bezier(0.25, 0.1, 0.17, 1.01);

  font-family: "DM Sans", "Plus Jakarta Sans", sans-serif;
  color: var(--zia-ink);
  background: var(--zia-canvas);
}

/*
 * Type scale. The spec's sizes are desktop values; the display roles clamp
 * down rather than wrapping a 76px headline into five lines on a 360px phone.
 * Body roles keep their fixed size — 16px is already the mobile size.
 */
.zia-display-xl { font-size: clamp(40px, 7.4vw, 76px); font-weight: 400; line-height: 1.1;  letter-spacing: -0.02em; }
.zia-display-lg { font-size: clamp(32px, 5.2vw, 56px); font-weight: 400; line-height: 1.15; letter-spacing: -0.02em; }
.zia-display-md { font-size: clamp(24px, 3.2vw, 32px); font-weight: 400; line-height: 1.25; letter-spacing: -0.01em; }
.zia-display-sm { font-size: clamp(21px, 2.4vw, 28px); font-weight: 500; line-height: 1.3;  letter-spacing: -0.01em; }
.zia-body-lg    { font-size: clamp(18px, 1.7vw, 22px); font-weight: 500; line-height: 1.4; }
.zia-body-md    { font-size: 16px; font-weight: 400; line-height: 1.6; }
.zia-body-emph  { font-size: 16px; font-weight: 700; line-height: 1.6; }
.zia-caption    { font-size: 14px; font-weight: 400; line-height: 1.5; }
.zia-btn-lg     { font-size: 16px; font-weight: 700; line-height: 1; text-transform: uppercase; letter-spacing: 0.02em; }
.zia-btn-md     { font-size: 12px; font-weight: 700; line-height: 1; text-transform: uppercase; letter-spacing: 0.06em; }
.zia-link-md    { font-size: 15px; font-weight: 500; line-height: 1.5; letter-spacing: -0.15px; }

/* Body copy sits at 45-75 characters. 68ch is inside that on every role. */
.zia-measure { max-width: 68ch; }

/* button-primary + button-primary-hover */
.zia-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 12px;
  background: var(--zia-primary); color: var(--zia-on-primary);
  padding: 20px 35px; border-radius: var(--zia-r-sm); min-height: 56px;
  box-shadow: var(--zia-shadow-cta-glow); cursor: pointer;
  transition: all var(--zia-base) var(--zia-ease);
}
.zia-cta:hover { background: var(--zia-primary-bright); box-shadow: var(--zia-shadow-soft-lift); }
.zia-cta:active { background: var(--zia-primary-deep); }
.zia-cta:focus-visible { outline: 2px solid var(--zia-on-ink); outline-offset: 3px; }

/* button-secondary + button-secondary-hover. min-height keeps the 44px touch target. */
.zia-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: transparent; color: var(--zia-cyan);
  border: 1px solid var(--zia-cyan); padding: 8px 22px; min-height: 44px;
  border-radius: var(--zia-r-sm); cursor: pointer;
  transition: all var(--zia-fast) var(--zia-ease);
}
.zia-ghost:hover { background: var(--zia-cyan); color: var(--zia-on-primary); }
.zia-ghost:focus-visible { outline: 2px solid var(--zia-cyan); outline-offset: 3px; }

/* card */
.zia-card {
  background: var(--zia-paper); border-radius: var(--zia-r-md);
  box-shadow: var(--zia-shadow-card);
  transition: box-shadow var(--zia-base) var(--zia-ease), transform var(--zia-base) var(--zia-ease);
}
.zia-card-link:hover { box-shadow: var(--zia-shadow-soft-lift); transform: translateY(-2px); }

/* input-text-dark */
.zia-input {
  width: 100%; background: transparent; color: var(--zia-on-ink);
  border: 1px solid var(--zia-hero-hairline); border-radius: var(--zia-r-lg);
  padding: 24px 32px; cursor: text; font-size: 16px; line-height: 1.6;
  transition: border-color var(--zia-base) var(--zia-ease);
}
.zia-input::placeholder { color: rgba(255, 255, 255, 0.5); }
.zia-input:focus { outline: none; border-color: var(--zia-cyan); }

.zia-a { color: var(--zia-link); cursor: pointer; transition: color var(--zia-fast) var(--zia-ease); }
.zia-a:hover { color: var(--zia-link-pressed); text-decoration: underline; }

/* The starfield behind the hero — pure CSS so no particle library is needed. */
@keyframes zia-drift { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(0, -120px, 0); } }
@keyframes zia-breathe { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.75; } }
.zia-stars {
  position: absolute; inset: -20% 0; pointer-events: none;
  background-image:
    radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,.9), transparent),
    radial-gradient(1px 1px   at 32% 62%, rgba(0,171,251,.9), transparent),
    radial-gradient(1.5px 1.5px at 58% 24%, rgba(255,255,255,.75), transparent),
    radial-gradient(1px 1px   at 74% 71%, rgba(59,255,232,.8), transparent),
    radial-gradient(1.5px 1.5px at 88% 34%, rgba(255,255,255,.85), transparent),
    radial-gradient(1px 1px   at 21% 84%, rgba(255,255,255,.6), transparent),
    radial-gradient(1px 1px   at 46% 91%, rgba(0,171,251,.7), transparent),
    radial-gradient(1.5px 1.5px at 66% 8%,  rgba(255,255,255,.7), transparent);
  animation: zia-drift 26s linear infinite alternate, zia-breathe 9s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .zia-stars { animation: none; }
}
`;

/* -------------------------------------------------------------- primitives */

function Eyebrow({ children, tone = 'dark' }: { children: React.ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <span
      className="zia-btn-md inline-flex items-center gap-2 rounded-full px-4 py-2"
      style={
        tone === 'dark'
          ? { color: 'var(--zia-cyan)', border: '1px solid var(--zia-hero-hairline)' }
          : { color: 'var(--zia-ink-soft)', border: '1px solid var(--zia-hairline)' }
      }
    >
      {children}
    </span>
  );
}

/** The single primary action. Used exactly twice on this page, per the spec. */
function Cta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="zia-cta zia-btn-lg">
      {children}
      <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
    </Link>
  );
}

function Ghost({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="zia-ghost zia-btn-md">
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
    </Link>
  );
}

/* ------------------------------------------------------------------ content */

/**
 * The eight capability groups, in the same order and with the same framing as
 * `/ai-insights/use-cases` — grouped by the question an owner actually has,
 * not by tool name. A list of 44 camelCase identifiers tells nobody what to
 * type.
 *
 * `accent` is only ever cyan / aqua / magenta. The primary is deliberately
 * absent: the spec reserves it for the CTA, and tinting eight icons with it
 * would dilute the two buttons that need to win.
 */
const CAPABILITIES: {
  icon: React.ElementType;
  accent: string;
  title: string;
  blurb: string;
  points: string[];
}[] = [
  {
    icon: Boxes,
    accent: 'var(--zia-cyan)',
    title: 'What am I about to run out of?',
    blurb: 'Stock on hand in plain words, and the number that actually decides whether you order today.',
    points: [
      'Days of cover — not "12 left" but "12 left, about 4 days at your rate"',
      'Low stock ranked by urgency, with a reorder quantity',
      'Dead stock, and anything nearing expiry while it can still be discounted',
      'Shelf value at cost and at retail',
    ],
  },
  {
    icon: BarChart3,
    accent: 'var(--zia-aqua)',
    title: 'How is the business actually doing?',
    blurb: 'One question at closing gets you the whole day. Charts draw inside the conversation.',
    points: [
      'Takings, profit, transaction count, cash-versus-card, top sellers, what is owed',
      'Sales trends as a line, trading hours as bars, categories as a pie',
      'This week against last, with the change stated as a figure',
      'Margin analysis — often not the products that sell the most',
    ],
  },
  {
    icon: Receipt,
    accent: 'var(--zia-magenta)',
    title: 'Record a sale without leaving the chat',
    blurb: 'It asks until it is sure, then recomputes every figure from your own product records.',
    points: [
      'Prices, tax and totals come from your master records, never from the model',
      'Every line checked against stock at the moment you approve — it will not oversell',
      'Operating hours, tax rate, loyalty and branch all still apply',
      'Goes through the same offline queue as the POS page',
    ],
  },
  {
    icon: Eye,
    accent: 'var(--zia-cyan)',
    title: 'Show me the product',
    blurb: 'Ask to see an item and it draws the picture, with price, stock and margin beside it.',
    points: [
      'Full record: SKU, category, cost, margin, units sold in 30 days, days of cover',
      'A name that matches several products returns cards to tap, not a wrong guess',
      'It never picks between two similar names on your behalf',
    ],
  },
  {
    icon: Users,
    accent: 'var(--zia-aqua)',
    title: 'Who has stopped coming?',
    blurb: 'Your regulars, ranked by what they spend — and the ones worth a message this week.',
    points: [
      'At-risk customers who have not been back in a while',
      'Purchase history, so you know what to put aside for someone',
      'Loyalty points adjusted with the current and new balance shown first',
      'Who owes you, how much, and for how long',
    ],
  },
  {
    icon: Store,
    accent: 'var(--zia-magenta)',
    title: 'Branches, staff and what changed',
    blurb: 'Revenue side by side across locations, and a plain-language read of the audit trail.',
    points: [
      'Branch performance: revenue, transactions and profit together',
      'Totals per staff member over any period',
      'What changed, when, and who did it',
      'Ask for Reports or Inventory and get a button — only ever inside Zeneva',
    ],
  },
  {
    icon: Gauge,
    accent: 'var(--zia-magenta)',
    title: 'Tell me what to worry about',
    blurb: 'Problems surface in the answer even when you asked about something else.',
    points: [
      'Negative stock, items selling below cost, a sudden dip in takings',
      'What will run out first, given how fast it moves',
      'Where a figure is understated by missing cost prices, it says so',
    ],
  },
  {
    icon: TrendingUp,
    accent: 'var(--zia-cyan)',
    title: 'Where is this heading?',
    blurb: 'A range fitted to your real daily sales, carrying how well it actually fits.',
    points: [
      'Next week, next month or next year — as a range, not one flattering number',
      'Confidence stated plainly, down to "illustrative only"',
      'Under about a week of sales days it refuses rather than inventing a trend',
      'Which products run out first, and roughly how many days you have',
    ],
  },
];

/** Rotating in the hero, so the input never looks like it wants a command. */
const EXAMPLE_PROMPTS = [
  'What did I sell today?',
  'What am I about to run out of?',
  'Who are my best customers this month?',
  'Which products lose me money?',
  'Show me Peak Milk 400g',
  'Compare this week to last week',
  'Which branch is doing best?',
  'What will I run out of first?',
];

/**
 * The guardrails. These are the strongest thing on the page for an owner
 * deciding whether to let an assistant near their books, so they get a band of
 * their own rather than a footnote.
 */
const GUARDRAILS: { icon: React.ElementType; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Nothing is written without approval',
    body: 'Stock, prices, loyalty points, sales — all of it arrives as a proposal card. Nothing reaches your data until you tap Approve.',
  },
  {
    icon: Fingerprint,
    title: 'Re-checked the moment you approve',
    body: 'If stock or a price moved between the card being drawn and you approving it, the change is refused and explained. Approving a stale figure would silently undo a real sale.',
  },
  {
    icon: Check,
    title: 'Invented records are caught',
    body: 'Every product and customer id on a proposal is verified against your live records before anything is applied.',
  },
  {
    icon: CircleSlash,
    title: 'No deletions, ever',
    body: 'Zen AI has no delete tool of any kind. Products, receipts and customers can only be removed by you, from their own pages.',
  },
  {
    icon: Minus,
    title: 'Sane limits',
    body: 'Quantities must be whole numbers, stock cannot go below zero, prices below cost are refused, and absurd figures are rejected outright.',
  },
  {
    icon: Lock,
    title: 'Your business only',
    body: 'Zen AI can only ever see data belonging to your business. There is no path to another business on the platform.',
  },
  {
    icon: X,
    title: 'Injection protection',
    body: 'Messages are scanned for attempts to override the rules above, and anything matching is blocked before it reaches the model.',
  },
  {
    icon: Users,
    title: 'The same permissions as you',
    body: 'Approved changes go through the same queue as the rest of the app, so your role, your branch and your offline state all apply as they normally would.',
  },
];

const PLAN_LIMITS: { plan: string; perDay: string; note: string }[] = [
  { plan: 'Starter', perDay: '20', note: 'Enough to ask at open and at close.' },
  { plan: 'Pro', perDay: '100', note: 'For a shop that checks in through the day.' },
  { plan: 'Business', perDay: '500', note: 'Multi-branch, several people asking.' },
  { plan: 'Lifetime', perDay: '500', note: 'Same ceiling as Business, for good.' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Do I have to learn special commands?',
    a: 'No. Type the way you would ask a shop assistant — "what did I sell today", "am I running out of anything". There is no syntax, and nothing to memorise. If a question is ambiguous, Zen AI asks rather than guessing.',
  },
  {
    q: 'Can it change my data by mistake?',
    a: 'It cannot change anything on its own. Every change arrives as a card showing exactly what would happen, and nothing is written until you approve it. At the instant you approve, the change is re-checked against your live data — if a cashier sold three of that item while you were reading the card, the change is refused and the real figure is named rather than quietly applied.',
  },
  {
    q: 'Does it work offline?',
    a: 'Asking a question needs a connection, because the answer is generated in the cloud. Anything you approve does not: approved sales and stock changes go into the same queue as the POS page and sync when you are back online.',
  },
  {
    q: 'Are my conversations private?',
    a: 'Your chats are saved to your own business so you can pick one back up later. What leaves your business for platform reporting is a category label — "asked about stock", "asked about sales" — and never the words you typed. There is no archive of merchant prompts, by design.',
  },
  {
    q: 'Can my staff use it?',
    a: 'Yes, and it respects their role. Zen AI proposes; the approval goes through the same permission checks as the rest of the app, so a staff member cannot approve something their role does not allow them to do on the normal pages.',
  },
  {
    q: 'What about product names in Hausa, Yoruba, Igbo or Pidgin?',
    a: 'They are safe. The filter that blocks attempts to manipulate the assistant was tuned against real Nigerian catalogues specifically so that ordinary product names — and the shorthand you actually use on the shelf label — are never mistaken for something suspicious.',
  },
  {
    q: 'Is it an extra subscription?',
    a: 'No. Zen AI is included in every Zeneva plan. Plans differ only in how many questions a day they carry, and you can top up with bonus credits if you run out on a busy day.',
  },
  {
    q: 'What happens if it does not know?',
    a: 'It says so. Where a figure would be misleading — a forecast on three days of sales, a margin with cost prices missing — Zen AI names the gap instead of presenting a confident wrong number. Walkthroughs for "how do I…" questions are hand-written from the real screens, so it never sends you hunting for a button that is not there.',
  },
];

/* ----------------------------------------------------------------- sections */

/** Dark cinematic hero. The one place `display-xl` is used. */
function Hero() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [value, setValue] = useState('');
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPromptIndex((i) => (i + 1) % EXAMPLE_PROMPTS.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  // `/ai-insights?q=…` opens the chat with the question already asked — the
  // documented deep link, the same one the in-app use-cases page uses. A
  // visitor who is not signed in gets the normal auth redirect.
  const ask = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      router.push('/ai-insights?q=' + encodeURIComponent(q));
    },
    [router]
  );

  return (
    <header
      className="relative overflow-hidden"
      style={{ background: 'var(--zia-hero-bg)', color: 'var(--zia-on-ink)' }}
    >
      <div className="zia-stars" aria-hidden="true" />

      {/*
       * Two soft glows, warm from the mark and cool from the accent. The
       * opacities are tuned for the #1e293b ground: an orange wash calibrated
       * for near-black turns muddy brown on a lighter slate, so the warm side
       * is held back and the cool side carries a little more.
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/3 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(244,113,37,.17) 0%, transparent 68%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 bottom-0 h-[420px] w-[620px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(0,171,251,.18) 0%, transparent 70%)' }}
      />

      {/*
       * `MarketingHeader` is fixed: 80px on its own, 128px while its promo
       * banner is showing. The top padding has to clear the taller case, or
       * the eyebrow sits behind the banner on a phone.
       */}
      <div className="relative mx-auto max-w-[1200px] px-4 pb-20 pt-40 sm:px-6 sm:pt-48 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.17, 1.01] }}
          >
            <Eyebrow>
              <Sparkles className="h-3.5 w-3.5" />
              Zen AI · built into Zeneva
            </Eyebrow>
          </motion.div>

          {/* The glyph, at the size it earns above the fold. */}
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.05, ease: [0.25, 0.1, 0.17, 1.01] }}
            className="mt-8 flex h-20 w-20 items-center justify-center rounded-full sm:h-24 sm:w-24"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--zia-hero-hairline)',
              boxShadow: '0 0 60px rgba(244,113,37,.35)',
            }}
          >
            <ZenMark className="h-12 w-12 sm:h-14 sm:w-14" animated />
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.1, 0.17, 1.01] }}
            className="zia-display-xl mt-8 max-w-4xl"
          >
            Got a shop?
            <br />
            <span
              style={{
                background: 'linear-gradient(90deg, #ff9933 0%, #f47125 45%, #00abfb 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Just ask.
            </span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: [0.25, 0.1, 0.17, 1.01] }}
            className="zia-body-lg zia-measure mt-6"
            style={{ color: 'rgba(255,255,255,.8)' }}
          >
            Zen AI reads your live stock, sales and customers and answers in
            plain words. It proposes changes as cards. Nothing touches your data
            until you approve it.
          </motion.p>

          {/* input-text-dark */}
          <motion.form
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22, ease: [0.25, 0.1, 0.17, 1.01] }}
            onSubmit={(e) => {
              e.preventDefault();
              ask(value || EXAMPLE_PROMPTS[promptIndex]);
            }}
            className="mt-12 w-full max-w-2xl"
          >
            <label htmlFor="zia-ask" className="sr-only">
              Ask Zen AI a question about your shop
            </label>
            <div className="relative">
              <input
                id="zia-ask"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={EXAMPLE_PROMPTS[promptIndex]}
                className="zia-input pr-16 text-left"
                autoComplete="off"
              />
              <button
                type="submit"
                aria-label="Ask Zen AI"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
                style={{ background: 'var(--zia-primary)', color: 'var(--zia-on-primary)', cursor: 'pointer' }}
              >
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
            <p className="zia-caption mt-4" style={{ color: 'rgba(255,255,255,.55)' }}>
              Opens the chat with your question already asked. Sign in first if
              you are not already.
            </p>
          </motion.form>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 flex flex-col items-center gap-4 sm:flex-row"
          >
            <Cta href="/signup">Start free</Cta>
            <Ghost href="/pricing">See plans</Ghost>
          </motion.div>

          <p className="zia-caption mt-8" style={{ color: 'rgba(255,255,255,.5)' }}>
            44 tools over your own data · included in every plan · no card to try
          </p>
        </div>
      </div>
    </header>
  );
}

/** Light band: the capability grid. */
function Capabilities() {
  return (
    <section className="py-20" style={{ background: 'var(--zia-canvas)' }}>
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <div className="max-w-3xl">
          <Eyebrow tone="light">What you can ask</Eyebrow>
          <h2 className="zia-display-lg mt-6">One assistant. Forty-four tools.</h2>
          <p className="zia-body-md zia-measure mt-6" style={{ color: 'var(--zia-ink-soft)' }}>
            Grouped by the question you actually have, not by what the tools are
            called. Every line below is backed by something Zen AI can really
            do — if it is not on this page, it is not a claim we make.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map(({ icon: Icon, accent, title, blurb, points }) => (
            <article key={title} className="zia-card flex flex-col p-8">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-[var(--zia-r-md)]"
                style={{ background: 'var(--zia-cloud)', color: accent }}
              >
                <Icon className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <h3 className="zia-display-sm mt-6">{title}</h3>
              <p className="zia-body-md mt-3" style={{ color: 'var(--zia-ink-soft)' }}>
                {blurb}
              </p>
              <ul className="mt-6 space-y-3 border-t pt-6" style={{ borderColor: 'var(--zia-hairline)' }}>
                {points.map((p) => (
                  <li key={p} className="zia-caption flex gap-3" style={{ color: 'var(--zia-ink-soft)' }}>
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: accent }} strokeWidth={2.5} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-16 flex justify-center">
          <Ghost href="/ai-insights/use-cases">Browse every example</Ghost>
        </div>
      </div>
    </section>
  );
}

/**
 * Dark band: the approval loop, with a rendered proposal card. This is the
 * differentiator, so it gets the cinematic treatment rather than a bullet list.
 */
function ApprovalLoop() {
  const reduce = useReducedMotion();

  const steps = [
    {
      n: '01',
      title: 'You ask',
      body: 'In the words you would use at the counter. If two products have similar names, Zen AI shows you both to tap rather than picking one.',
    },
    {
      n: '02',
      title: 'It proposes',
      body: 'A card with the exact before and after. No write has happened yet — the server has no path to your data at all.',
    },
    {
      n: '03',
      title: 'You approve',
      body: 'The change is re-checked against live data at that instant, then goes through the same queue as the POS page. Offline included.',
    },
  ];

  return (
    <section
      className="relative overflow-hidden py-20"
      style={{ background: 'var(--zia-hero-bg)', color: 'var(--zia-on-ink)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(0,171,251,.16) 0%, transparent 70%)' }}
      />

      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <Eyebrow>The approval loop</Eyebrow>
            <h2 className="zia-display-lg mt-6">Zen AI proposes. You decide.</h2>
            <p className="zia-body-md zia-measure mt-6" style={{ color: 'rgba(255,255,255,.75)' }}>
              An assistant that can quietly edit your stock is not a feature,
              it is a liability. So Zen AI has no write path of its own. What it
              produces is a proposal, and a proposal is just a card until you
              act on it.
            </p>

            <ol className="mt-12 space-y-8">
              {steps.map((s) => (
                <li key={s.n} className="flex gap-6">
                  <span
                    className="zia-btn-md flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ border: '1px solid var(--zia-hero-hairline)', color: 'var(--zia-cyan)' }}
                  >
                    {s.n}
                  </span>
                  <div>
                    <h3 className="zia-body-emph">{s.title}</h3>
                    <p className="zia-body-md mt-2" style={{ color: 'rgba(255,255,255,.7)' }}>
                      {s.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* A proposal card, drawn the way it appears in the chat. */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.17, 1.01] }}
            className="relative"
          >
            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white">
                <ZenMark className="h-5 w-5" />
              </span>
              <p className="zia-body-md" style={{ color: 'rgba(255,255,255,.85)' }}>
                Peak Milk 400g is down to 6, which is under your threshold of 20.
                At about 9 a day that is under a day of cover. Here is the change:
              </p>
            </div>

            {/*
             * The two uses of the primary inside this card are deliberate and
             * are the only ones on the page outside the two CTAs. This block
             * depicts in-app UI rather than page chrome, and there the warm
             * accent carries one meaning: your attention is required. Do not
             * spread it to the surrounding marketing copy.
             */}
            <div className="zia-card overflow-hidden" style={{ boxShadow: 'var(--zia-shadow-modal)' }}>
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ background: 'var(--zia-cloud)', borderBottom: '1px solid var(--zia-hairline)' }}
              >
                <span className="zia-btn-md" style={{ color: 'var(--zia-ink-soft)' }}>
                  Proposed change
                </span>
                <span className="zia-btn-md" style={{ color: 'var(--zia-primary)' }}>
                  Needs approval
                </span>
              </div>

              <div className="p-8">
                <p className="zia-caption" style={{ color: 'var(--zia-ink-soft)' }}>
                  Update stock · Peak Milk 400g · SKU PM-400
                </p>

                <div className="mt-6 flex items-center gap-6">
                  <div>
                    <p className="zia-caption" style={{ color: 'var(--zia-ink-soft)' }}>
                      Now
                    </p>
                    <p className="zia-display-md mt-1">6</p>
                  </div>
                  <ArrowRight className="mt-6 h-5 w-5" style={{ color: 'var(--zia-hairline-strong)' }} />
                  <div>
                    <p className="zia-caption" style={{ color: 'var(--zia-ink-soft)' }}>
                      After
                    </p>
                    <p className="zia-display-md mt-1" style={{ color: 'var(--zia-primary)' }}>
                      54
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="zia-caption" style={{ color: 'var(--zia-ink-soft)' }}>
                      Days of cover
                    </p>
                    <p className="zia-display-md mt-1">6</p>
                  </div>
                </div>

                <p
                  className="zia-caption mt-8 rounded-[var(--zia-r-md)] p-4"
                  style={{ background: 'var(--zia-cloud)', color: 'var(--zia-ink-soft)' }}
                >
                  Re-checked against live stock when you approve. If a sale lands
                  first, this is refused and the real figure is named.
                </p>

                <div className="mt-8 flex items-center gap-3">
                  <span
                    className="zia-btn-md inline-flex min-h-[44px] items-center gap-2 rounded-[var(--zia-r-sm)] px-6"
                    style={{ background: 'var(--zia-ink)', color: 'var(--zia-on-ink)' }}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    Approve
                  </span>
                  <span
                    className="zia-btn-md inline-flex min-h-[44px] items-center rounded-[var(--zia-r-sm)] px-6"
                    style={{ border: '1px solid var(--zia-hairline)', color: 'var(--zia-ink-soft)' }}
                  >
                    Discard
                  </span>
                </div>
              </div>
            </div>

            <p className="zia-caption mt-6 text-center" style={{ color: 'rgba(255,255,255,.5)' }}>
              Illustration of the card as it appears in the chat.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/** Cloud band: the guardrails. */
function Guardrails() {
  return (
    <section className="py-20" style={{ background: 'var(--zia-cloud)' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Eyebrow tone="light">Limits, on purpose</Eyebrow>
          <h2 className="zia-display-lg mt-6">What Zen AI cannot do</h2>
          <p className="zia-body-md zia-measure mt-6" style={{ color: 'var(--zia-ink-soft)' }}>
            The useful half of an assistant is what it refuses. These are not
            settings you have to find and switch on — they are how it is built,
            and they cannot be turned off.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {GUARDRAILS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="zia-card p-8">
              <Icon className="h-6 w-6" style={{ color: 'var(--zia-ink)' }} strokeWidth={1.75} />
              <h3 className="zia-body-emph mt-6">{title}</h3>
              <p className="zia-caption mt-3" style={{ color: 'var(--zia-ink-soft)' }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Dark band: the privacy boundary. */
function Privacy() {
  return (
    <section className="py-20" style={{ background: 'var(--zia-hero-bg)', color: 'var(--zia-on-ink)' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Eyebrow>Privacy</Eyebrow>
            <h2 className="zia-display-lg mt-6">We do not keep what you typed.</h2>
          </div>

          <div className="lg:col-span-7">
            <p className="zia-body-lg" style={{ color: 'rgba(255,255,255,.85)' }}>
              Your chats are saved to your own business, so you can pick a
              conversation back up tomorrow. Nothing beyond that leaves.
            </p>
            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div className="border-t pt-6" style={{ borderColor: 'var(--zia-hero-hairline)' }}>
                <h3 className="zia-body-emph" style={{ color: 'var(--zia-cyan)' }}>
                  What we report on
                </h3>
                <p className="zia-body-md mt-3" style={{ color: 'rgba(255,255,255,.7)' }}>
                  A category label — asked about stock, asked about sales — and
                  a count. That is the whole record, written once a day.
                </p>
              </div>
              <div className="border-t pt-6" style={{ borderColor: 'var(--zia-hero-hairline)' }}>
                <h3 className="zia-body-emph" style={{ color: 'var(--zia-cyan)' }}>
                  What we never store
                </h3>
                <p className="zia-body-md mt-3" style={{ color: 'rgba(255,255,255,.7)' }}>
                  The words. There is no archive of merchant prompts to search,
                  because a shop’s questions name its customers and its margins.
                </p>
              </div>
            </div>
            <p className="zia-caption mt-12" style={{ color: 'rgba(255,255,255,.55)' }}>
              Read the detail in our{' '}
              <Link href="/legal/privacy-policy" className="zia-link-md" style={{ color: 'var(--zia-cyan)' }}>
                privacy policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Light band: what each plan carries. */
function Plans() {
  return (
    <section className="py-20" style={{ background: 'var(--zia-canvas)' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Eyebrow tone="light">Included</Eyebrow>
          <h2 className="zia-display-lg mt-6">Not a separate subscription.</h2>
          <p className="zia-body-md zia-measure mt-6" style={{ color: 'var(--zia-ink-soft)' }}>
            Zen AI comes with every Zeneva plan. Plans differ only in how many
            questions a day they carry — and a busy day can be topped up with
            bonus credits rather than an upgrade.
          </p>
        </div>

        {/* Wide content scrolls in its own container rather than the page body. */}
        <div className="mt-16 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--zia-hairline-strong)' }}>
                <th className="zia-btn-md pb-4 pr-6" style={{ color: 'var(--zia-ink-soft)' }}>
                  Plan
                </th>
                <th className="zia-btn-md pb-4 pr-6" style={{ color: 'var(--zia-ink-soft)' }}>
                  Questions per day
                </th>
                <th className="zia-btn-md pb-4" style={{ color: 'var(--zia-ink-soft)' }}>
                  Who it suits
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_LIMITS.map(({ plan, perDay, note }) => (
                <tr key={plan} style={{ borderBottom: '1px solid var(--zia-hairline)' }}>
                  <td className="zia-body-emph py-6 pr-6">{plan}</td>
                  {/* Weight and scale carry this, not colour — the spec keeps
                      the primary for the CTA and off body text entirely. */}
                  <td className="zia-display-sm py-6 pr-6">{perDay}</td>
                  <td className="zia-body-md py-6" style={{ color: 'var(--zia-ink-soft)' }}>
                    {note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Ghost href="/pricing">Compare plans</Ghost>
          <p className="zia-caption" style={{ color: 'var(--zia-ink-soft)' }}>
            A question that fails is never counted against your day.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Light band: FAQ. */
function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-20" style={{ background: 'var(--zia-cloud)' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Eyebrow tone="light">Questions</Eyebrow>
            <h2 className="zia-display-lg mt-6">Before you ask it anything.</h2>
            <p className="zia-body-md mt-6" style={{ color: 'var(--zia-ink-soft)' }}>
              Still unsure?{' '}
              <Link href="/contact" className="zia-a zia-link-md">
                Talk to us
              </Link>
              .
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="zia-card divide-y" style={{ borderColor: 'var(--zia-hairline)' }}>
              {FAQS.map(({ q, a }, i) => {
                const isOpen = open === i;
                return (
                  <div key={q} style={{ borderColor: 'var(--zia-hairline)' }}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-6 px-8 py-6 text-left"
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="zia-body-emph">{q}</span>
                      <ChevronDown
                        className={cn('h-5 w-5 flex-shrink-0 transition-transform duration-300', isOpen && 'rotate-180')}
                        style={{ color: isOpen ? 'var(--zia-ink)' : 'var(--zia-hairline-strong)' }}
                      />
                    </button>
                    {isOpen && (
                      <p className="zia-body-md zia-measure px-8 pb-8" style={{ color: 'var(--zia-ink-soft)' }}>
                        {a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Dark band: the closing CTA — the second and last use of the primary. */
function Closing() {
  return (
    <section
      className="relative overflow-hidden py-20"
      style={{ background: 'var(--zia-hero-bg)', color: 'var(--zia-on-ink)' }}
    >
      <div className="zia-stars" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(244,113,37,.17) 0%, transparent 68%)' }}
      />

      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-4 text-center sm:px-6 lg:px-8">
        <ZenMark className="h-14 w-14" />
        <h2 className="zia-display-lg mt-8 max-w-3xl">
          Stop reading reports. Ask the shop.
        </h2>
        <p className="zia-body-lg zia-measure mt-6" style={{ color: 'rgba(255,255,255,.8)' }}>
          Zen AI is waiting inside Zeneva on desktop, Android and iOS. Nothing
          to set up, and nothing it can change without you.
        </p>
        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
          <Cta href="/signup">Start free</Cta>
          <Ghost href="/download">Download Zeneva</Ghost>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- page */

export default function ZenAiPage() {
  return (
    <div className="zia min-h-screen antialiased">
      <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
      <MarketingHeader />
      <main>
        <Hero />
        <Capabilities />
        <ApprovalLoop />
        <Guardrails />
        <Privacy />
        <Plans />
        <Faq />
        <Closing />
      </main>
      <MarketingFooter />
    </div>
  );
}
