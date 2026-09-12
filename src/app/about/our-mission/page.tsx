'use client';

/**
 * `/about/our-mission` — built in the Avelis Health design language.
 *
 * Ten bands, alternating cream canvas and ink:
 *
 *   1  Hero .................. canvas, animated backdrop
 *   2  Trade marquee ......... canvas
 *   3  Why we built Zeneva ... canvas    (new)
 *   4  Proactive Intelligence  ink
 *   5  How it works .......... canvas    (new)
 *   6  What we hold to ....... ink       (new)
 *   7  Voices of Victory ..... canvas
 *   8  Talk to us ............ ink       (new, wired to EmailJS)
 *   9  From the journal ...... canvas    (new)
 *  10  Closing CTA ........... ink
 *
 * The styling system, in one place so it is not re-derived per section:
 *
 *   - #f1dfd1 canvas and #161513 ink, alternating light and dark bands. The
 *     canvas is not the source design's #e9e5d6: it is lifted from the promo
 *     banner strip in `MarketingHeader` (`bg-[#f1dfd1]`), which sits directly
 *     above this page and made the two creams read as a mismatch rather than a
 *     pair. Changing the token is the whole change — no section names a cream
 *     of its own.
 *   - Lora for every heading, a sans for every piece of body and UI text. That
 *     duality is the defining characteristic — see the note on FONTS below.
 *   - Strictly FLAT. No shadow anywhere, no gradient fills, no rotation on the
 *     testimonial cards. Depth comes only from layering #ffffff paper on the
 *     cream canvas, and from typographic scale.
 *   - 140px section rhythm, ~1100px centred column.
 *
 * MOTION. The page had an animated hero once — `InteractiveGrid`, the
 * `.aura-background` blur and four infinitely floating lucide icons. Those are
 * blue-glow depth effects and they fight a flat cream page rather than express
 * it, so the backdrop was rebuilt from scratch instead of restored: concentric
 * hairline rings that breathe, with a single accent dot orbiting each one. Every
 * part of it is a 1px hairline outline or a 7px solid dot in a palette token —
 * nothing that could read as a shadow or a glow. `HERO_RINGS` is the whole
 * composition; change a number there and the backdrop changes.
 *
 * Scroll animation is one shared `<Reveal>`, never a hand-rolled `whileInView`
 * per section, so the timing curve stays identical down the page. Both it and
 * the backdrop check `prefers-reduced-motion` — the rings then sit still, which
 * is a composition in its own right rather than a blank space.
 *
 * `.codepen-button-aura` in globals.css is left without a caller by this file.
 * `InteractiveGrid` and `.aura-background` are still used by other pages.
 *
 * FONTS: the source design pairs Lora with Satoshi. Lora is real here, loaded
 * in `layout.tsx`. Satoshi is a Fontshare face, not a Google one, so it cannot
 * go through `next/font` without vendoring the woff2 files — and a CDN <link>
 * would break in the offline Tauri shells. DM Sans stands in for it: already
 * self-hosted by the root layout, and a geometric sans of much the same
 * character. To swap real Satoshi in later, vendor the files and change
 * `--av-sans` in one place.
 */

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bolt,
  CheckCheck,
  Download,
  EyeOff,
  Loader2,
  Lock,
  PlayCircle,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Send,
  WifiOff,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { sendContactFormEmail } from '@/lib/email';

/**
 * Kept even though this page no longer renders an `<iconify-icon>`: the element
 * is used on other marketing pages, and this is the declaration that makes it
 * known to the compiler.
 */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': any;
    }
  }
}

/* ------------------------------------------------------------------ tokens */

/**
 * Scoped to `.av` so none of it reaches the shared `MarketingHeader` and
 * `MarketingFooter`, which `about/layout.tsx` renders around this page.
 *
 * Shadow tokens are deliberately absent rather than set to `none`: there is no
 * token to reach for, so there is nothing to accidentally apply.
 *
 * Keep prose out of the string below — `dangerouslySetInnerHTML` ships every
 * byte of it to the browser. Explanations belong in comments like this one.
 */
const TOKENS = `
.av {
  --av-primary: #161513;
  --av-primary-bright: #262626;
  --av-primary-deep: #0f0e0e;
  --av-on-primary: #ffffff;
  --av-ink: #161513;
  --av-ink-soft: #a09c9b;
  --av-on-ink: #ffffff;
  --av-canvas: #ffffff;
  --av-paper: #ffffff;
  --av-cloud: #f1f1ee;
  --av-hairline: #a09c9b;
  --av-hairline-strong: #4e5255;
  --av-link: #f17f3f;
  --av-link-pressed: #d48f31;
  --av-blue: #0f62b6;
  --av-gold: #d48f31;

  --av-r-sm: 8px;
  --av-r-lg: 16px;

  --av-fast: 150ms;
  --av-base: 250ms;
  --av-ease: ease-out;

  --av-serif: var(--font-lora), Lora, Georgia, serif;
  --av-sans: "DM Sans", "Plus Jakarta Sans", sans-serif;

  font-family: var(--av-sans);
  background: var(--av-canvas);
  color: var(--av-ink);
}

/*
 * Type scale. Display roles clamp down for the mobile breakpoints, which the
 * design calls for explicitly ("hero text scales down significantly"); the
 * desktop end of every clamp is the token's own value.
 */
.av-display-xl { font-family: var(--av-serif); font-size: clamp(34px, 5.6vw, 58px); font-weight: 500; line-height: 1.1; }
.av-display-lg { font-family: var(--av-serif); font-size: clamp(30px, 4.6vw, 48px); font-weight: 500; line-height: 1.2; }
.av-display-md { font-family: var(--av-serif); font-size: clamp(20px, 2.2vw, 24px); font-weight: 600; line-height: 1.3; }
.av-body-lg    { font-size: clamp(17px, 1.6vw, 20px); font-weight: 500; line-height: 1.5; }
.av-body-md    { font-size: 16px; font-weight: 400; line-height: 1.6; }
.av-caption    { font-size: 14px; font-weight: 500; line-height: 1.4; }
.av-btn        { font-size: 16px; font-weight: 700; line-height: 1; }
.av-link       { font-size: 16px; font-weight: 500; line-height: 1; }

/* Keeps body copy off the full 1100px column. */
.av-measure { max-width: 62ch; }

/*
 * button-primary. Padding is spacing.md / spacing.lg; min-height lifts the
 * 48px box to the 44px touch-target floor with room to spare.
 */
.av-btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--av-primary); color: var(--av-on-primary);
  border-radius: var(--av-r-sm); padding: 16px 24px; min-height: 48px;
  cursor: pointer;
  transition: background-color var(--av-base) var(--av-ease), color var(--av-base) var(--av-ease), border-color var(--av-base) var(--av-ease);
}
.av-btn-primary:hover  { background: var(--av-primary-bright); color: var(--av-on-primary); }
.av-btn-primary:active { background: var(--av-primary-deep); }
.av-btn-primary:focus-visible { outline: 2px solid var(--av-blue); outline-offset: 2px; }
.av-btn-primary:disabled { cursor: not-allowed; }

/* button-secondary */
.av-btn-secondary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--av-cloud); color: var(--av-ink);
  border-radius: var(--av-r-sm); padding: 16px 24px; min-height: 48px;
  cursor: pointer;
  transition: background-color var(--av-base) var(--av-ease), color var(--av-base) var(--av-ease), border-color var(--av-base) var(--av-ease);
}
.av-btn-secondary:hover { background: var(--av-hairline); color: var(--av-ink); }
.av-btn-secondary:focus-visible { outline: 2px solid var(--av-blue); outline-offset: 2px; }

/*
 * button-accent. This is the CTA on the dark bands — button-primary is ink on
 * ink there, which would be invisible.
 */
.av-btn-accent {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--av-gold); color: var(--av-on-ink);
  border-radius: var(--av-r-sm); padding: 12px 32px; min-height: 48px;
  cursor: pointer;
  transition: background-color var(--av-base) var(--av-ease), color var(--av-base) var(--av-ease), border-color var(--av-base) var(--av-ease);
}
.av-btn-accent:hover { background: var(--av-link); color: var(--av-on-ink); }
.av-btn-accent:focus-visible { outline: 2px solid var(--av-on-ink); outline-offset: 2px; }
.av-btn-accent:disabled { cursor: not-allowed; }

/* card — paper, 16px corners, spacing.xl padding, and no shadow at all. */
.av-card {
  background: var(--av-paper);
  border-radius: var(--av-r-lg);
  padding: 32px;
}

/*
 * A card that has to sit on the paper-white band. Hairline outline instead of a
 * fill change, because paper-on-paper needs an edge and flat design has no
 * shadow to give it one.
 */
.av-card-outline {
  background: transparent;
  border: 1px solid var(--av-hairline);
  border-radius: var(--av-r-lg);
  padding: 32px;
  transition: border-color var(--av-base) var(--av-ease), background-color var(--av-base) var(--av-ease);
}
.av-card-outline:hover { border-color: var(--av-ink); }
.av-card-outline:focus-visible { outline: 2px solid var(--av-blue); outline-offset: 2px; }

.av-a {
  color: var(--av-link); cursor: pointer;
  transition: color var(--av-base) var(--av-ease);
}
.av-a:hover { color: var(--av-link-pressed); }

/* Pill badge — a hairline outline, no fill, no shadow. */
.av-badge {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1px solid var(--av-hairline); border-radius: 9999px;
  padding: 8px 16px;
}

.av-rail::-webkit-scrollbar { display: none; }
.av-rail { -ms-overflow-style: none; scrollbar-width: none; }

/* input / input-focus. The focus border is the one place blue appears. */
.av-input {
  width: 100%;
  background: var(--av-paper); color: var(--av-ink);
  border: 1px solid var(--av-hairline);
  border-radius: var(--av-r-sm);
  padding: 12px 16px; min-height: 48px;
  font-family: var(--av-sans); font-size: 16px; font-weight: 400; line-height: 1.5;
  cursor: text;
  transition: border-color var(--av-base) var(--av-ease);
}
.av-input::placeholder { color: var(--av-ink-soft); }
.av-input:focus { outline: none; border-color: var(--av-blue); }

/* ------------------------------------------------- animated hero backdrop */

.av-stage { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.av-stage-inner { position: absolute; inset: 0; animation: av-float 26s ease-in-out infinite; }

.av-ring {
  position: absolute; top: 50%; left: 50%;
  border: 1px solid var(--av-hairline);
  border-radius: 9999px;
  transform: translate(-50%, -50%);
  animation-name: av-breathe;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

.av-orbit {
  position: absolute; top: 50%; left: 50%;
  border-radius: 9999px;
  transform: translate(-50%, -50%);
  animation-name: av-orbit;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.av-orbit-dot {
  position: absolute; top: -4px; left: 50%; margin-left: -4px;
  width: 8px; height: 8px; border-radius: 9999px;
}

@keyframes av-breathe {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50%      { transform: translate(-50%, -50%) scale(1.04); }
}
@keyframes av-orbit {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
}
@keyframes av-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-14px); }
}

/*
 * Reduced motion stops every loop on this page, including the trade marquee,
 * whose animation is declared in globals.css. The rings keep their geometry —
 * a still composition, not an empty band.
 */
@media (prefers-reduced-motion: reduce) {
  .av .av-ring,
  .av .av-orbit,
  .av .av-stage-inner,
  .av .animate-marquee-left { animation: none !important; }
}
`;

/* -------------------------------------------------------------- behaviour */

function useAnimatedCounter(targetValue: number, duration: number = 2000, trigger: boolean = true) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!trigger || targetValue <= 0) return;

    let startTimestamp: number | null = null;
    const startValue = 0;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Ease-out cubic: progress = 1 - (1 - x)^3 (starts fast, slows down at the end)
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);

      setCount(Math.floor(easeOutProgress * (targetValue - startValue) + startValue));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(targetValue);
      }
    };

    window.requestAnimationFrame(step);
  }, [targetValue, duration, trigger]);

  return count;
}

/**
 * One reveal for the whole page, so every band enters on the same curve.
 *
 * `once: true` matters as much as the easing: a section that re-animates each
 * time it scrolls back into view turns a long page into a flicker. `amount`
 * fires the reveal when a quarter of the block is showing, which lands before
 * the reader's eye reaches it rather than under it.
 */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ content */

const MARQUEE_TRADES = ['Boutiques', 'Supermarkets', 'Pharmacies', 'Gadget Stores', 'Luxury Retail'];

/**
 * The hero backdrop, in full.
 *
 * Sizes are `min(vw, px)` rather than plain pixels, and that is load-bearing: a
 * ring only looks deliberate when its arcs frame the text column instead of
 * cutting through it. The vw term keeps the innermost ring just wider than a
 * phone screen; the px ceiling keeps it just wider than the 62ch paragraph on a
 * desktop. A fixed 520px ring satisfies neither and draws two hairlines straight
 * down the middle of the body copy.
 *
 * Orbit periods are deliberately not multiples of each other, so the three dots
 * never settle into a visible formation.
 */
const HERO_RINGS: {
  size: string;
  opacity: number;
  breathe: number;
  orbit: number;
  dot: string;
  reverse?: boolean;
}[] = [
  { size: 'min(92vw, 900px)', opacity: 0.45, breathe: 16, orbit: 27, dot: 'var(--av-link)' },
  { size: 'min(128vw, 1240px)', opacity: 0.3, breathe: 21, orbit: 41, dot: 'var(--av-gold)', reverse: true },
  { size: 'min(168vw, 1620px)', opacity: 0.18, breathe: 27, orbit: 59, dot: 'var(--av-blue)' },
];

/** Section 3. The left column is the shop today; the right is the shop on Zeneva. */
const FROM_TO: { from: string; to: string }[] = [
  {
    from: 'A screenshot of a bank alert that never cleared.',
    to: 'Zeneva Terminal confirms the transfer against the bank and announces it at the counter, before the goods leave the shop.',
  },
  {
    from: 'A stock count done by hand after closing, and wrong again by morning.',
    to: 'Every sale moves the count as it happens, on every till, in every branch.',
  },
  {
    from: 'A report that explains what already went wrong.',
    to: 'Zen AI reads your own numbers and tells you what to do next, in a sentence.',
  },
  {
    from: 'A shop that stops selling the moment the network does.',
    to: 'The till keeps taking money offline and reconciles itself when the line comes back.',
  },
];

/** Section 5. */
const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: '01',
    title: 'Bring your shop in',
    body: 'Import a product list, or scan items in as you go. Branches, staff roles and price lists follow. Nothing has to be perfect on day one — the catalogue is meant to be edited from behind the counter.',
  },
  {
    n: '02',
    title: 'Sell, network or no network',
    body: 'The till writes locally first and syncs when it can. A blackout becomes a delay in reporting instead of a stopped sale, and the queue drains itself the moment the line returns.',
  },
  {
    n: '03',
    title: 'Let the Terminal keep the money honest',
    body: 'Transfers are confirmed against the bank and called out on the shop floor, so a cashier cannot wave through an alert that never arrived. This is the part owners who cannot stand in the shop all day ask for first.',
  },
  {
    n: '04',
    title: 'Ask, instead of digging',
    body: 'Zen AI has forty-two tools pointed at your own data. Ask it which line is dead capital or why last week dipped, and it answers in plain language — then asks your permission before it changes anything.',
  },
];

/** Section 6. Each of these is a decision already made in the code, not an aspiration. */
const PRINCIPLES: { icon: React.ElementType; title: string; body: string }[] = [
  {
    icon: WifiOff,
    title: 'Offline is the default, not the fallback',
    body: 'Every part of the till assumes the connection will drop, because in the markets we serve it does. Sync is a background chore, never a precondition for trading.',
  },
  {
    icon: CheckCheck,
    title: 'Nothing writes itself',
    body: 'Zen AI proposes; you approve. An approved change then goes through the same queue a person uses, so it inherits the same permissions, the same branch and the same offline behaviour.',
  },
  {
    icon: EyeOff,
    title: 'We do not keep what you type',
    body: 'Prompt text is never stored. The usage board we look at counts intent labels and nothing else, so there is no archive of your questions — or your customers — for anyone here to read.',
  },
  {
    icon: Download,
    title: 'Your data leaves with you',
    body: 'One request exports everything we hold for your business. Staying should be a decision you keep making, not a door that quietly locked behind you.',
  },
];

const PILLARS: { icon: React.ElementType; title: string; body: string }[] = [
  {
    icon: Bolt,
    title: 'Instant Visibility',
    body: 'See your entire business health across all locations in one beautiful, real-time dashboard.',
  },
  {
    icon: ShieldCheck,
    title: 'Offline Resilience',
    body: "Market conditions aren't perfect. Your POS should be. Zeneva works 100% offline and syncs when back online.",
  },
  {
    icon: Lock,
    title: 'Anti-Theft Terminal',
    body: 'Eliminate staff cash-pocketing and fake bank alerts. Zeneva Terminal confirms customer transfers instantly and alerts cashiers on-site.',
  },
];

const TESTIMONIALS: { quote: string; initials: string; name: string; role: string }[] = [
  {
    quote:
      'Zeneva stopped being just a POS and started being a partner. It told me exactly which luxury silks to stop ordering and where I was losing money on belts.',
    initials: 'AB',
    name: 'Dr. Amina Bolanle',
    role: 'Director, Safeway Dermatology & Laser Center',
  },
  {
    quote:
      "The offline first approach saved us during network blackouts. We didn't lose a single sale, and everything synced perfectly the moment we got back online.",
    initials: 'OA',
    name: 'Olumide Adebayo',
    role: 'Operations Lead, Lag Retail Ops',
  },
  {
    quote:
      'I used to spend 4 hours a night reconcilling numbers. Now, Zeneva does it in real-time. My business is finally operating with clarity.',
    initials: 'CO',
    name: 'Chisom Okafor',
    role: 'Founder, The Retail Hub',
  },
];

/** Section 9. Real posts — slugs verified against `src/lib/blog-data.ts`. */
const JOURNAL: { slug: string; category: string; title: string; blurb: string }[] = [
  {
    slug: 'zen-ai-copilot-business-insights',
    category: 'AI Features',
    title: 'Zen AI Copilot: What It Does and What It Cannot',
    blurb: 'The honest boundary of the assistant — the questions it answers well, and the ones it will refuse rather than guess at.',
  },
  {
    slug: 'the-power-of-zeneva-terminal',
    category: 'Product Updates',
    title: 'Say Goodbye to Fake Alerts: Introducing the Zeneva Terminal',
    blurb: 'How a transfer actually gets confirmed at the counter, and why a screenshot was never proof of anything.',
  },
  {
    slug: '5-things-you-will-not-miss-about-manual-stock-taking',
    category: 'Productivity',
    title: "5 Things You Won't Miss About Manual Stock-taking",
    blurb: 'Shutting the shop to count, and the four other rituals that quietly stop once the count keeps itself.',
  },
];

/* --------------------------------------------------------------------- page */

export default function OurMissionPage() {
  const { toast } = useToast();
  const railRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({ totalSalesCount: 2141, platformGmv: 92100000, overallArpu: 2090000 });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const reduce = useReducedMotion();

  const checkScroll = () => {
    if (railRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = railRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    setMounted(true);
    checkScroll();
    window.addEventListener('resize', checkScroll);

    // Fetch live cached stats from our API
    fetch('/api/platform-stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setStatsLoaded(true);
      })
      .catch(err => {
        console.error("Failed to load platform stats:", err);
        setStatsLoaded(true); // fall back to defaults
      });

    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const animatedSales = useAnimatedCounter(stats.totalSalesCount, 2500, statsLoaded || mounted);
  const animatedGmv = useAnimatedCounter(stats.platformGmv, 2500, statsLoaded || mounted);
  const animatedArpu = useAnimatedCounter(stats.overallArpu, 2500, statsLoaded || mounted);

  const formatGMV = (val: number) => {
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(1)}M+`;
    }
    return `₦${val.toLocaleString()}+`;
  };

  const formatARPU = (val: number) => {
    if (val >= 1000000) {
      return `₦${(val / 1000000).toFixed(2)}M`;
    }
    return `₦${val.toLocaleString()}`;
  };

  const scroll = (direction: number) => {
    if (railRef.current) {
      railRef.current.scrollBy({ left: direction * 540, behavior: 'smooth' });
    }
  };

  /**
   * Same EmailJS path the /contact page uses — `sendContactFormEmail` reads the
   * form element directly, so the `name` attributes below have to keep matching
   * the template's variables (`from_name`, `from_email`, `project_type`,
   * `message`). If the contact keys are missing from the environment the helper
   * throws with the exact variable names, and that message is what the toast
   * shows.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;

    setIsSubmitting(true);
    try {
      await sendContactFormEmail(formRef.current);
      toast({
        variant: 'success',
        title: 'Message sent',
        description: "We've received it and will get back to you shortly.",
      });
      formRef.current.reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Submission failed',
        description: error?.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const STATS = [
    { value: `${animatedSales.toLocaleString()}+`, label: 'Total Sales Count', hideOnMobile: false },
    { value: formatGMV(animatedGmv), label: 'Platform GMV', hideOnMobile: false },
    { value: formatARPU(animatedArpu), label: 'Overall ARPU', hideOnMobile: true },
  ];

  return (
    <div className="av min-h-screen overflow-x-hidden antialiased relative">
      <style dangerouslySetInnerHTML={{ __html: TOKENS }} />

      {/* ---------------------------------------------------------- HERO --- */}
      {/* pt clears the fixed MarketingHeader (80px, 128px with its banner). */}
      <section className="relative overflow-hidden px-6 pb-24 pt-40 sm:pt-44 bg-[#F9F8F6]">
        <div className="absolute inset-0 grid-lines opacity-[0.15] pointer-events-none z-0"></div>
        {/*
         * The backdrop. Masked to nothing at the edges so the outer ring never
         * collides with the section boundary — a mask softens an edge, which is
         * a different job from a gradient standing in for depth.
         */}
        <div
          className="av-stage"
          aria-hidden="true"
          style={{
            maskImage: 'radial-gradient(circle at 50% 50%, black 55%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 55%, transparent 78%)',
          }}
        >
          <div className="av-stage-inner">
            {HERO_RINGS.map(({ size, opacity, breathe, orbit, dot, reverse }) => (
              <React.Fragment key={size}>
                <span
                  className="av-ring"
                  style={{ width: size, height: size, opacity, animationDuration: `${breathe}s` }}
                />
                <span
                  className="av-orbit"
                  style={{
                    width: size,
                    height: size,
                    animationDuration: `${orbit}s`,
                    animationDirection: reverse ? 'reverse' : 'normal',
                  }}
                >
                  <span className="av-orbit-dot" style={{ background: dot }} />
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-[1100px] text-center">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex justify-center"
          >
            <span
              className="av-badge av-caption"
              style={{ color: 'var(--av-ink)', background: 'var(--av-canvas)' }}
            >
              <Sparkles className="h-4 w-4" style={{ color: 'var(--av-link)' }} strokeWidth={1.75} />
              AI-Powered Retail Intelligence
              <span className="h-1 w-1 rounded-full" style={{ background: 'var(--av-hairline)' }} />
              <span style={{ color: 'var(--av-ink-soft)' }}>Decisions, Not Dashboards</span>
            </span>
          </motion.div>

          {/*
           * The old headline carried a diagonal mask-image gradient that faded
           * its own first and last words to nothing. Flat design has no use for
           * it, and the headline is legible end to end without it.
           */}
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: 'easeOut' }}
            className="av-display-xl mx-auto mt-8 max-w-3xl"
          >
            Preventing Theft &amp; Empowering Retailers
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: 'easeOut' }}
            className="av-body-lg av-measure mx-auto mt-6"
            style={{ color: 'var(--av-ink-soft)' }}
          >
            Our biggest mission is to prevent theft and losses, especially for
            large retailers who cannot always be physically present at their
            stores. Zeneva unifies your operations into a single, proactive AI
            intelligence layer.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href="/signup" className="av-btn-primary av-btn w-full sm:w-auto">
              <UserPlus className="h-4 w-4" strokeWidth={2.25} />
              Join the Mission
            </Link>
            <Link href="/download" className="av-btn-secondary av-btn w-full sm:w-auto">
              <PlayCircle className="h-4 w-4" strokeWidth={2.25} />
              Watch Video
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------- MARQUEE --- */}
      <section className="px-6 pb-16 pt-8">
        <div className="mx-auto max-w-[1100px]">
          <p
            className="av-caption text-center uppercase tracking-[0.18em]"
            style={{ color: 'var(--av-ink-soft)' }}
          >
            Empowering fast-growing retail businesses
          </p>

          {/* The edge fade is a mask, not a gradient fill — the flat rule is
              about depth cues, and a marquee still needs its ends softened. */}
          <div
            className="mt-12 overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
            }}
          >
            <div className="animate-marquee-left flex gap-12 will-change-transform">
              {/* Two identical runs, so the loop has no visible seam. */}
              {[0, 1].map((run) => (
                <div key={run} className="flex shrink-0 items-center gap-12">
                  {MARQUEE_TRADES.map((trade) => (
                    <span
                      key={trade}
                      className="av-display-md whitespace-nowrap"
                      style={{ color: 'var(--av-hairline)' }}
                    >
                      {trade}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------- WHY WE BUILT THIS --- */}
      {/*
       * This band used a `cloud` fill to separate itself from the marquee above.
       * Now that every light band is the header's cream, the separation is a
       * full-bleed hairline instead — which is the flat way to do it anyway, and
       * leaves `cloud` for the button and chip surfaces it was meant for.
       */}
      <section className="border-t px-6 py-[140px]" style={{ borderColor: 'var(--av-hairline)' }}>
        <div className="mx-auto max-w-[1100px]">
          <Reveal className="max-w-2xl">
            <p className="av-caption uppercase tracking-[0.18em]" style={{ color: 'var(--av-ink-soft)' }}>
              Origin
            </p>
            <h2 className="av-display-lg mt-4">Why we built Zeneva</h2>
            <p className="av-body-lg mt-6" style={{ color: 'var(--av-ink-soft)' }}>
              Not from a whiteboard. From four things that kept happening in real
              shops, to owners who had done nothing wrong.
            </p>
          </Reveal>

          {/*
           * Two columns, hairline-ruled. On mobile they stack, so each pair is
           * labelled — "Today" above "On Zeneva" is the only thing keeping the
           * comparison readable once the columns are gone.
           */}
          <div className="mt-16 border-t" style={{ borderColor: 'var(--av-hairline)' }}>
            {FROM_TO.map(({ from, to }, i) => (
              <Reveal key={from} delay={i * 0.06}>
                <div
                  className="grid gap-6 border-b py-10 md:grid-cols-2 md:gap-16"
                  style={{ borderColor: 'var(--av-hairline)' }}
                >
                  <div>
                    <p
                      className="av-caption uppercase tracking-[0.18em]"
                      style={{ color: 'var(--av-ink-soft)' }}
                    >
                      Today
                    </p>
                    <p className="av-body-lg mt-3" style={{ color: 'var(--av-ink-soft)' }}>
                      {from}
                    </p>
                  </div>
                  <div>
                    <p
                      className="av-caption uppercase tracking-[0.18em]"
                      style={{ color: 'var(--av-link)' }}
                    >
                      On Zeneva
                    </p>
                    <p className="av-body-lg mt-3" style={{ color: 'var(--av-ink)' }}>
                      {to}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------- PROACTIVE RETAIL INTELLIGENCE (dark) --- */}
      <section
        className="px-6 py-[140px] relative z-10"
        style={{ background: 'var(--av-primary)', color: 'var(--av-on-ink)' }}
      >
        <div className="mx-auto max-w-[1100px]">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
            {/* Copy, pillars and stats */}
            <Reveal>
              <h2 className="av-display-lg">Proactive Retail Intelligence</h2>
              <p className="av-body-lg av-measure mt-6" style={{ color: 'var(--av-ink-soft)' }}>
                Retail businesses generate massive amounts of data, but almost
                none of it turns into usable judgment. Zeneva changes that
                balance.
              </p>

              <div className="mt-12 border-t pt-12" style={{ borderColor: 'var(--av-hairline-strong)' }}>
                <div className="grid gap-8">
                  {PILLARS.map(({ icon: Icon, title, body }) => (
                    <div key={title} className="flex items-start gap-4">
                      <Icon
                        className="mt-1 h-5 w-5 flex-shrink-0"
                        style={{ color: 'var(--av-gold)' }}
                        strokeWidth={1.75}
                      />
                      <div>
                        <h3 className="av-display-md">{title}</h3>
                        <p className="av-body-md mt-2" style={{ color: 'var(--av-ink-soft)' }}>
                          {body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="mt-12 grid grid-cols-2 gap-8 border-t pt-12 md:grid-cols-3"
                style={{ borderColor: 'var(--av-hairline-strong)' }}
              >
                {STATS.map(({ value, label, hideOnMobile }) => (
                  <div key={label} className={hideOnMobile ? 'hidden md:block' : undefined}>
                    <p className="av-display-lg" style={{ fontSize: 'clamp(28px, 3vw, 36px)' }}>
                      {value}
                    </p>
                    <p
                      className="av-caption mt-2 uppercase tracking-[0.18em]"
                      style={{ color: 'var(--av-ink-soft)' }}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* The Intelligent Inventory card — paper on ink, and flat. */}
            <Reveal delay={0.08} className="av-card">
              <div className="mb-8 flex items-center justify-between gap-4">
                <h3 className="av-display-md" style={{ color: 'var(--av-ink)' }}>
                  Intelligent Inventory
                </h3>
                <span className="av-badge av-caption" style={{ color: 'var(--av-ink)' }}>
                  <Sparkles className="h-4 w-4" style={{ color: 'var(--av-link)' }} strokeWidth={1.75} />
                  Zen AI Engine
                </span>
              </div>

              {/* Illustration: cloud ground, hairline rows, no shadows. */}
              <div
                className="flex flex-col gap-3 rounded-[var(--av-r-lg)] p-4"
                style={{ background: 'var(--av-cloud)' }}
              >
                <div
                  className="flex items-center justify-between gap-4 rounded-[var(--av-r-sm)] p-4"
                  style={{ background: 'var(--av-paper)', border: '1px solid var(--av-hairline)' }}
                >
                  <span className="av-body-md" style={{ color: 'var(--av-ink)' }}>
                    Automatic Restock Alert
                  </span>
                  <span className="av-caption" style={{ color: 'var(--av-link)' }}>
                    Recommended
                  </span>
                </div>

                <div
                  className="flex items-center gap-4 rounded-[var(--av-r-sm)] p-4"
                  style={{ background: 'var(--av-paper)', border: '1px solid var(--av-hairline)' }}
                >
                  <TrendingUp className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--av-blue)' }} strokeWidth={1.75} />
                  <div className="flex-1">
                    <p className="av-body-md" style={{ color: 'var(--av-ink)' }}>
                      Top Performer: Luxury Silk Scarf
                    </p>
                    <p className="av-caption mt-1" style={{ color: 'var(--av-ink-soft)' }}>
                      Sell rate: +45% this week
                    </p>
                  </div>
                </div>

                <div
                  className="flex items-center gap-4 rounded-[var(--av-r-sm)] p-4"
                  style={{ background: 'var(--av-paper)', border: '1px solid var(--av-hairline)' }}
                >
                  <Send className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--av-gold)' }} strokeWidth={1.75} />
                  <div className="flex-1">
                    <p className="av-body-md" style={{ color: 'var(--av-ink)' }}>
                      Dead Capital: Vintage Belt
                    </p>
                    <p className="av-caption mt-1" style={{ color: 'var(--av-ink-soft)' }}>
                      Suggestion: Bundle or Discount
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <h4 className="av-display-md" style={{ color: 'var(--av-ink)' }}>
                    Foresight, Not Hindsight
                  </h4>
                  <p className="av-body-md mt-2" style={{ color: 'var(--av-ink-soft)' }}>
                    Predict potential stockouts before they happen, ensuring you
                    never lose a sale due to empty shelves.
                  </p>
                </div>
                <div>
                  <h4 className="av-display-md" style={{ color: 'var(--av-ink)' }}>
                    Capital Optimization
                  </h4>
                  <p className="av-body-md mt-2" style={{ color: 'var(--av-ink-soft)' }}>
                    Automatically identify dead stock and convert trapped capital
                    back into cash flow with smart exit strategies.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- HOW IT WORKS --- */}
      <section className="px-6 py-[140px] bg-[#F9F8F6]">
        <div className="mx-auto max-w-[1100px]">
          <Reveal className="max-w-2xl">
            <p className="av-caption uppercase tracking-[0.18em]" style={{ color: 'var(--av-ink-soft)' }}>
              How it works
            </p>
            <h2 className="av-display-lg mt-4">Four steps, in the order they happen</h2>
            <p className="av-body-lg mt-6" style={{ color: 'var(--av-ink-soft)' }}>
              No migration project, no consultant. Most shops are selling on
              Zeneva the same day they start.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-8 md:grid-cols-2">
            {STEPS.map(({ n, title, body }, i) => (
              <Reveal key={n} delay={i * 0.07} className="av-card">
                {/* Lora numeral at hairline weight — the number is a mark, not
                    a heading, so it stays quiet enough to scan past. */}
                <span
                  className="av-display-lg block"
                  style={{ color: 'var(--av-hairline)', fontSize: 'clamp(36px, 4vw, 44px)' }}
                >
                  {n}
                </span>
                <h3 className="av-display-md mt-6" style={{ color: 'var(--av-ink)' }}>
                  {title}
                </h3>
                <p className="av-body-md mt-3" style={{ color: 'var(--av-ink-soft)' }}>
                  {body}
                </p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="mt-16 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <Link href="/zen-ai" className="av-btn-primary av-btn w-full sm:w-auto">
                <Sparkles className="h-4 w-4" strokeWidth={2.25} />
                See what Zen AI can answer
              </Link>
              <Link href="/terminal" className="av-a av-link inline-flex items-center gap-2">
                How the Terminal confirms a transfer
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------- WHAT WE HOLD TO (dark) */}
      <section
        className="px-6 py-[140px] relative z-10"
        style={{ background: 'var(--av-primary)', color: 'var(--av-on-ink)' }}
      >
        <div className="mx-auto max-w-[1100px]">
          <Reveal className="max-w-2xl">
            <p className="av-caption uppercase tracking-[0.18em]" style={{ color: 'var(--av-ink-soft)' }}>
              Principles
            </p>
            <h2 className="av-display-lg mt-4">What we hold to</h2>
            <p className="av-body-lg mt-6" style={{ color: 'var(--av-ink-soft)' }}>
              Four commitments that are already decisions in the code, not
              intentions for a later release.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-px md:grid-cols-2" style={{ background: 'var(--av-hairline-strong)' }}>
            {/*
             * A one-pixel gap over a hairline-coloured ground draws the dividing
             * rules between cells — a flat alternative to bordering each tile,
             * which would double up on every shared edge.
             */}
            {PRINCIPLES.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.06} className="h-full">
                <div className="h-full p-10" style={{ background: 'var(--av-primary)' }}>
                  <Icon className="h-6 w-6" style={{ color: 'var(--av-gold)' }} strokeWidth={1.5} />
                  <h3 className="av-display-md mt-6">{title}</h3>
                  <p className="av-body-md mt-3" style={{ color: 'var(--av-ink-soft)' }}>
                    {body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- TESTIMONIALS --- */}
      <section className="px-6 py-[140px]">
        <div className="mx-auto max-w-[1100px]">
          <Reveal>
            <div className="mb-12 flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p
                  className="av-caption uppercase tracking-[0.18em]"
                  style={{ color: 'var(--av-ink-soft)' }}
                >
                  Social Proof
                </p>
                <h2 className="av-display-lg mt-4">Voices of Victory</h2>
                <p className="av-body-lg mt-4" style={{ color: 'var(--av-ink-soft)' }}>
                  Real stories from the frontlines of retail revolution.
                </p>
              </div>

              <Link href="/blog" className="av-a av-link inline-flex items-center gap-2">
                Read all stories
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
              </Link>
            </div>
          </Reveal>

          {/* The rail. Cards sit flat and square — the old ±1-2deg rotation and
              drop shadows are exactly what this design language rules out. */}
          <div
            className="overflow-hidden"
            style={{
              maskImage: 'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)',
              WebkitMaskImage: 'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)',
            }}
          >
            <div
              className="av-rail flex snap-x snap-mandatory gap-8 overflow-x-auto scroll-smooth px-2 pb-2"
              ref={railRef}
              onScroll={checkScroll}
            >
              {TESTIMONIALS.map(({ quote, initials, name, role }) => (
                <article
                  key={name}
                  className="av-card flex min-w-[300px] flex-shrink-0 snap-start flex-col justify-between sm:min-w-[420px] md:min-w-[480px]"
                >
                  {/* Lora for the pull-quote: it reads as display, not body. */}
                  <p className="av-display-md" style={{ color: 'var(--av-ink)' }}>
                    &ldquo;{quote}&rdquo;
                  </p>
                  <div className="mt-8 flex items-center gap-4">
                    <span
                      className="av-caption flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[var(--av-r-sm)]"
                      style={{ background: 'var(--av-cloud)', color: 'var(--av-ink)' }}
                    >
                      {initials}
                    </span>
                    <div>
                      <p className="av-body-md" style={{ color: 'var(--av-ink)', fontWeight: 700 }}>
                        {name}
                      </p>
                      <p className="av-caption mt-1" style={{ color: 'var(--av-ink-soft)' }}>
                        {role}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-4">
            <button
              type="button"
              aria-label="Previous testimonial"
              className="av-btn-secondary"
              onClick={() => scroll(-1)}
              disabled={!canScrollLeft}
              style={{ opacity: canScrollLeft ? 1 : 0.3, padding: 12, minWidth: 48 }}
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next testimonial"
              className="av-btn-primary"
              onClick={() => scroll(1)}
              disabled={!canScrollRight}
              style={{ opacity: canScrollRight ? 1 : 0.3, padding: 12, minWidth: 48 }}
            >
              <ArrowRight className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- TALK TO US (dark) --- */}
      <section
        className="px-6 py-[140px] relative z-10"
        style={{ background: 'var(--av-primary)', color: 'var(--av-on-ink)' }}
      >
        <div className="mx-auto max-w-[1100px]">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
            <Reveal>
              <p className="av-caption uppercase tracking-[0.18em]" style={{ color: 'var(--av-ink-soft)' }}>
                Talk to us
              </p>
              <h2 className="av-display-lg mt-4">Tell us what your shop needs</h2>
              <p className="av-body-lg av-measure mt-6" style={{ color: 'var(--av-ink-soft)' }}>
                Most of what is on this page started as a message like the one
                you are about to write. Tell us what you sell and what keeps
                going wrong, and we will tell you honestly whether Zeneva
                already handles it.
              </p>

              <div className="mt-12 border-t pt-12" style={{ borderColor: 'var(--av-hairline-strong)' }}>
                <p className="av-body-md" style={{ color: 'var(--av-ink-soft)' }}>
                  Would rather read first?
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <Link href="/help-center" className="av-a av-link inline-flex items-center gap-2">
                    Help centre
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                  </Link>
                  <Link href="/pricing" className="av-a av-link inline-flex items-center gap-2">
                    Pricing, in full
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="av-card">
              <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div>
                  <label
                    htmlFor="av-name"
                    className="av-caption block"
                    style={{ color: 'var(--av-ink)' }}
                  >
                    Your name
                  </label>
                  <input
                    id="av-name"
                    name="from_name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Amina Bolanle"
                    className="av-input mt-3"
                  />
                </div>

                <div>
                  <label
                    htmlFor="av-email"
                    className="av-caption block"
                    style={{ color: 'var(--av-ink)' }}
                  >
                    Email
                  </label>
                  <input
                    id="av-email"
                    name="from_email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@yourshop.com"
                    className="av-input mt-3"
                  />
                </div>

                <div>
                  <label
                    htmlFor="av-trade"
                    className="av-caption block"
                    style={{ color: 'var(--av-ink)' }}
                  >
                    What do you sell?
                  </label>
                  {/* name="project_type" — the EmailJS template variable is
                      shared with /contact and cannot be renamed here alone. */}
                  <input
                    id="av-trade"
                    name="project_type"
                    type="text"
                    placeholder="Pharmacy, two branches"
                    className="av-input mt-3"
                  />
                </div>

                <div>
                  <label
                    htmlFor="av-message"
                    className="av-caption block"
                    style={{ color: 'var(--av-ink)' }}
                  >
                    What keeps going wrong?
                  </label>
                  <textarea
                    id="av-message"
                    name="message"
                    required
                    rows={4}
                    placeholder="Stock never matches the shelf by Friday..."
                    className="av-input mt-3"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <button type="submit" className="av-btn-primary av-btn" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
                      Sending
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" strokeWidth={2.25} />
                      Send message
                    </>
                  )}
                </button>

                <p className="av-caption" style={{ color: 'var(--av-ink-soft)' }}>
                  Goes to a person, not a queue. We reply within a working day.
                </p>
              </form>
            </Reveal>
          </div>
        </div>
      </section>

      {/* --------------------------------------------- FROM THE JOURNAL --- */}
      <section className="px-6 py-[140px] bg-[#F9F8F6]">
        <div className="mx-auto max-w-[1100px]">
          <Reveal>
            <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p
                  className="av-caption uppercase tracking-[0.18em]"
                  style={{ color: 'var(--av-ink-soft)' }}
                >
                  Journal
                </p>
                <h2 className="av-display-lg mt-4">The thinking behind the build</h2>
                <p className="av-body-lg mt-4" style={{ color: 'var(--av-ink-soft)' }}>
                  Longer pieces on the parts of this page that deserve more than
                  a paragraph.
                </p>
              </div>

              <Link href="/blog" className="av-a av-link inline-flex items-center gap-2">
                All posts
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
              </Link>
            </div>
          </Reveal>

          <div className="grid gap-8 md:grid-cols-3">
            {JOURNAL.map(({ slug, category, title, blurb }, i) => (
              <Reveal key={slug} delay={i * 0.07}>
                <Link
                  href={`/blog/${slug}`}
                  className="av-card-outline flex h-full flex-col"
                  style={{ background: 'var(--av-paper)' }}
                >
                  <p
                    className="av-caption uppercase tracking-[0.18em]"
                    style={{ color: 'var(--av-link)' }}
                  >
                    {category}
                  </p>
                  <h3 className="av-display-md mt-4" style={{ color: 'var(--av-ink)' }}>
                    {title}
                  </h3>
                  <p className="av-body-md mt-3 flex-1" style={{ color: 'var(--av-ink-soft)' }}>
                    {blurb}
                  </p>
                  <span
                    className="av-link mt-8 inline-flex items-center gap-2"
                    style={{ color: 'var(--av-link)' }}
                  >
                    Read it
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- CLOSING CTA (dark) */}
      <section
        className="px-6 py-[140px] relative z-10"
        style={{ background: 'var(--av-primary)', color: 'var(--av-on-ink)' }}
      >
        <Reveal>
          <div className="mx-auto max-w-[1100px] text-center">
            <span className="av-badge av-caption" style={{ borderColor: 'var(--av-hairline-strong)' }}>
              <Rocket className="h-4 w-4" style={{ color: 'var(--av-gold)' }} strokeWidth={1.75} />
              Join 30+ Forward-Thinking Retailers
            </span>

            <h2 className="av-display-lg mx-auto mt-8 max-w-3xl">
              Ready to see your business clearly?
            </h2>
            <p className="av-body-lg av-measure mx-auto mt-6" style={{ color: 'var(--av-ink-soft)' }}>
              Stop firefighting and start leading. Experience the future of retail
              management today with Zeneva.
            </p>

            <div className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-8">
              <Link href="/signup" className="av-btn-accent av-btn w-full sm:w-auto">
                Join the Mission
              </Link>
              <Link href="/careers" className="av-a av-link inline-flex items-center gap-2">
                Join the Team
                <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
