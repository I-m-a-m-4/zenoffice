/**
 * Plain-language definitions for the terms on the cap table page.
 *
 * One source of truth, read by two consumers: the `<Term>` tooltips in the UI
 * and the `explainTerm` tool the admin assistant calls. If those drifted apart,
 * the assistant would confidently explain something the page does not do.
 *
 * House style for every entry:
 *   - `short` fits in a tooltip. No jargon, no nested terms.
 *   - `long` may use a second term, but only one already defined here.
 *   - `why` says what changes if you get it wrong. This is the part a founder
 *     actually needs; a definition without consequence does not stick.
 */

export interface GlossaryEntry {
  term: string;
  /** One sentence, tooltip-sized. */
  short: string;
  /** A fuller explanation, two or three sentences. */
  long: string;
  /** What it costs you to misunderstand this. */
  why?: string;
  /** Worked example using round numbers. */
  example?: string;
  /** Other keys in this glossary. */
  see?: string[];
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  share: {
    term: 'Share',
    short: 'One unit of ownership in the company.',
    long:
      'A share is a slice of the company. What matters is never the number of shares you hold but the fraction: 600,000 shares out of 1,000,000 is 60% of the company, and so is 6 out of 10.',
    why:
      'Share counts on their own tell you nothing. Always read them against the total — a company can issue more shares tomorrow and your count would not change while your percentage would.',
    see: ['fully-diluted', 'dilution'],
  },

  'share-class': {
    term: 'Share class',
    short: 'A group of shares that carry the same rights.',
    long:
      'Companies issue different classes so different holders can have different rights. Founders and employees normally hold Common. Investors normally hold Preferred, which carries extra protection — most importantly a liquidation preference.',
    why:
      'Two people can hold the same number of shares and get very different amounts in a sale, because their classes rank differently.',
    see: ['common', 'preferred', 'liquidation-preference'],
  },

  common: {
    term: 'Common shares',
    short: 'Ordinary ownership, no special protection. What founders and staff hold.',
    long:
      'Common shares get paid last in a sale, after every preferred class has taken what it is owed. In exchange they are simple and carry no strings.',
    see: ['preferred', 'waterfall'],
  },

  preferred: {
    term: 'Preferred shares',
    short: 'Investor shares that get paid before common in a sale.',
    long:
      'Preferred shares sit ahead of common. In a sale, the preferred holders take their liquidation preference off the top, and only what remains is split with common holders.',
    why:
      'Issuing preferred is normal and expected in a funding round. Just know that a sale can leave common holders with far less than their percentage suggests.',
    see: ['liquidation-preference', 'waterfall'],
  },

  'authorized-shares': {
    term: 'Authorised shares',
    short: 'The ceiling on how many shares you are allowed to issue.',
    long:
      'A number set in the company documents. You can issue up to it, not past it. Issued shares are the ones that actually exist in someone\'s hands; the rest is headroom.',
    why:
      'Running out of headroom mid-round means paperwork to raise the ceiling before you can close. Keep spare capacity.',
  },

  outstanding: {
    term: 'Outstanding shares',
    short: 'Shares that actually exist and are held by someone today.',
    long:
      'The sum of everything issued, minus anything cancelled. It excludes options that have not been exercised and SAFEs that have not converted — so it flatters your percentage compared with the fully diluted figure.',
    see: ['fully-diluted'],
  },

  'fully-diluted': {
    term: 'Fully diluted',
    short: 'Every share that could exist if all options were exercised and all SAFEs converted.',
    long:
      'Outstanding shares plus the unexercised option pool plus everything convertible. It is the honest denominator, and the one investors use.',
    why:
      'This is the number to quote your own ownership against. Reading your stake off outstanding shares overstates it — sometimes by ten points or more.',
    example:
      '800,000 issued shares plus a 200,000 option pool is 1,000,000 fully diluted. A founder with 800,000 shares owns 100% outstanding but 80% fully diluted.',
    see: ['outstanding', 'option-pool'],
  },

  dilution: {
    term: 'Dilution',
    short: 'Your percentage falling because the company issued new shares.',
    long:
      'You keep every share you had; there are simply more shares in total, so your slice is a smaller fraction of the whole. Dilution is the normal cost of raising money.',
    why:
      'Dilution is not automatically bad — owning 80% of a company worth ten times more leaves you far better off. It is only bad when you gave up the percentage too cheaply.',
    example:
      'You own 1,000,000 of 1,000,000 shares (100%). An investor buys 250,000 new shares. You still hold 1,000,000, but of 1,250,000 — so 80%.',
    see: ['pre-money', 'price-per-share'],
  },

  'pre-money': {
    term: 'Pre-money valuation',
    short: 'What the company is worth before the new money arrives.',
    long:
      'The figure you and the investor agree on as the value of the business as it stands. The share price for the round is the pre-money valuation divided by the fully diluted share count.',
    why:
      'Pre-money is the number that sets the price and therefore the dilution. Post-money is just pre-money plus the cheque.',
    see: ['post-money', 'price-per-share'],
  },

  'post-money': {
    term: 'Post-money valuation',
    short: 'Pre-money valuation plus the money raised.',
    long:
      'What the company is worth the moment the round closes. The investor\'s percentage is their cheque divided by the post-money valuation.',
    example: '₦8,000,000 pre-money plus a ₦2,000,000 cheque is ₦10,000,000 post-money, and the investor owns 20%.',
    see: ['pre-money'],
  },

  'price-per-share': {
    term: 'Price per share',
    short: 'What one share is worth: valuation divided by fully diluted shares.',
    long:
      'The single most useful number on this page once you start selling equity. It converts a cheque into a share count and a share count back into money.',
    why:
      'Until a round is priced, no one has tested this number — it is only as good as the valuation behind it.',
    see: ['valuation', 'fully-diluted'],
  },

  valuation: {
    term: 'Valuation',
    short: 'What the whole company is worth.',
    long:
      'There is no formula that returns a company\'s true value. In practice a valuation is set one of a few ways: what someone last paid for shares, a multiple of revenue, what comparable companies fetch, or the founder\'s own reasoned estimate.',
    why:
      'An early valuation you set casually becomes the price of your equity. Set it too low and a small cheque buys a large piece of the company, permanently.',
    see: ['pre-money', 'revenue-multiple', 'price-per-share'],
  },

  'revenue-multiple': {
    term: 'Revenue multiple',
    short: 'Valuation estimated as annual recurring revenue times a multiple.',
    long:
      'The common shorthand for software businesses. Take annual recurring revenue and multiply — the multiple depends on growth rate, retention, and market appetite. Slow-growing software might fetch 3x; fast-growing SaaS has gone for 10x or more.',
    why:
      'It is defensible because it is anchored to something real. Record the ARR and the multiple you used, or in six months you will not be able to reconstruct the number.',
    example: '₦20,000,000 ARR at a 6x multiple is a ₦120,000,000 valuation.',
    see: ['valuation'],
  },

  'liquidation-preference': {
    term: 'Liquidation preference',
    short: 'The amount preferred holders take off the top when the company is sold.',
    long:
      'Usually 1x their investment — they get their money back before common holders see anything. A 2x preference means twice their money first.',
    why:
      'On a modest exit the preference can absorb the entire sale price, leaving founders and staff with nothing despite holding most of the shares.',
    example:
      'An investor puts in ₦2,000,000 at a 1x preference. The company sells for ₦2,000,000. They take all of it; common holders get zero.',
    see: ['preferred', 'waterfall', 'participating'],
  },

  participating: {
    term: 'Participating preferred',
    short: 'Preferred that takes its money back and then also shares the rest.',
    long:
      'Non-participating preferred must choose: take the preference, or convert to common and take a percentage. Participating preferred does both — money back first, then a pro-rata cut of the remainder.',
    why:
      'Participation is expensive for founders and worth resisting. A cap on it ("1x participating capped at 3x") limits the damage.',
    see: ['liquidation-preference', 'waterfall'],
  },

  waterfall: {
    term: 'Exit waterfall',
    short: 'Who gets paid what, in what order, when the company is sold.',
    long:
      'Sale proceeds flow down a series of steps: senior preferred first, then junior preferred, then whatever remains is split among common holders. Each non-participating preferred class picks whichever is better for it — the preference or converting to common.',
    why:
      'Percentages on the cap table are not what you receive in a sale. The waterfall is. Run it before agreeing to any preference terms.',
    see: ['liquidation-preference', 'participating'],
  },

  safe: {
    term: 'SAFE',
    short: 'Money now, shares later, at a price set by your next round.',
    long:
      'A Simple Agreement for Future Equity. The investor pays today and receives shares when you next raise a priced round. It avoids having to agree a valuation while the company is too early to value.',
    why:
      'SAFEs feel free because nothing shows on the cap table yet — but they are real dilution, waiting. Stack several with low caps and the next round can dilute you far more than expected.',
    see: ['valuation-cap', 'discount', 'convertible-note'],
  },

  'convertible-note': {
    term: 'Convertible note',
    short: 'A loan that turns into shares instead of being repaid.',
    long:
      'Like a SAFE, but legally debt: it accrues interest and has a maturity date. The principal plus accrued interest converts to shares at the next round.',
    see: ['safe', 'valuation-cap'],
  },

  'valuation-cap': {
    term: 'Valuation cap',
    short: 'The highest valuation at which a SAFE will convert.',
    long:
      'A ceiling that protects the early investor. If your next round prices the company above the cap, the SAFE still converts as though the valuation were the cap — so the investor gets more shares for their money than the new investors do.',
    why:
      'The cap, not the cheque size, determines how much of the company a SAFE ends up owning. A low cap on a big raise is very expensive.',
    example:
      '₦100,000 on a ₦4,000,000 cap converts at ₦4,000,000 even if the round is priced at ₦8,000,000 — twice the shares.',
    see: ['safe', 'discount'],
  },

  discount: {
    term: 'Discount',
    short: 'A percentage off the round price, for having come in early.',
    long:
      'A 20% discount converts the SAFE at 80% of what new investors pay. When a SAFE has both a cap and a discount, whichever gives the investor the better price wins.',
    see: ['safe', 'valuation-cap'],
  },

  'option-pool': {
    term: 'Option pool (ESOP)',
    short: 'Shares set aside to grant to employees.',
    long:
      'A reserve you carve out of the cap table so you can hire with equity. Unallocated pool shares still count in the fully diluted total, so the pool dilutes you the day you create it, not the day you grant from it.',
    why:
      'Investors typically require the pool to be created pre-money, meaning existing holders absorb the dilution rather than the new investor. It is negotiable, and it matters.',
    see: ['fully-diluted', 'vesting'],
  },

  vesting: {
    term: 'Vesting',
    short: 'Earning your shares gradually by staying, rather than all at once.',
    long:
      'The standard is four years with a one-year cliff. Nothing vests until month twelve, when a full quarter lands at once; the rest accrues monthly after that.',
    why:
      'Vesting protects the company from someone leaving early with a large stake. Founders should vest too — investors will ask.',
    see: ['cliff', 'option-pool'],
  },

  cliff: {
    term: 'Cliff',
    short: 'A waiting period before any shares vest at all.',
    long:
      'With a one-year cliff, someone who leaves at month eleven takes nothing. At month twelve, twelve months\' worth vests in a single step.',
    see: ['vesting'],
  },

  'strike-price': {
    term: 'Strike price',
    short: 'What an option holder pays to turn each option into a share.',
    long:
      'Set at the share price on the grant date. The holder profits on the difference between the strike and what the share is worth later.',
    why:
      'A grant made when shares were cheap is worth far more than the same grant made after a big round. Early employees should be granted early.',
    see: ['option-pool', 'price-per-share'],
  },

  'pro-rata': {
    term: 'Pro rata',
    short: 'In proportion to what you already hold.',
    long:
      'Splitting something by existing ownership. If you hold 60% and ₦1,000,000 is distributed pro rata, you get ₦600,000.',
  },

  'cap-table': {
    term: 'Cap table',
    short: 'The record of who owns what part of the company.',
    long:
      'Short for capitalisation table. Every holder, every share class, every option and convertible, and the percentage each represents.',
    why:
      'A cap table that lives in a spreadsheet goes stale the moment anything changes — and every change moves everyone\'s percentage at once.',
  },
};

/** Case- and format-insensitive lookup. Accepts "Pre-money", "pre money", "premoney". */
export function lookupTerm(query: string): GlossaryEntry | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const target = norm(query);
  if (!target) return null;

  for (const [key, entry] of Object.entries(GLOSSARY)) {
    if (norm(key) === target || norm(entry.term) === target) return entry;
  }
  // Fall back to a prefix match so "liquidation" finds "liquidation preference".
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    if (norm(key).startsWith(target) || norm(entry.term).startsWith(target)) return entry;
  }
  return null;
}

export const GLOSSARY_KEYS = Object.keys(GLOSSARY);
