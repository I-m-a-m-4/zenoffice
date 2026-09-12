/**
 * Presentation helpers for the cap table.
 *
 * Thin wrappers over `src/lib/i18n/format.ts` so the page has one place that
 * knows the company's currency. `formatMoney` already falls back to a bare number
 * on an unrecognised ISO code rather than throwing, which is what makes the
 * switchable-currency setting safe to expose in a form.
 *
 * The rest of the admin panel hardcodes `₦{n.toLocaleString()}` inline. That is
 * fine where the value is always naira; it is not fine here, because equity may
 * be denominated in dollars while the same panel reports GMV in naira.
 */

import { formatMoney, formatNumber } from '@/lib/i18n/format';
import type { Consideration } from './types';

/** Money in the company's equity currency. Whole units by default — cap tables deal in big numbers. */
export function money(amount: number, currency: string, opts?: Intl.NumberFormatOptions): string {
  return formatMoney(amount, currency, undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...opts,
  });
}

/**
 * A per-share price, which is often a fraction of a currency unit.
 *
 * Shown to 4 decimal places, because a founder's shares issued at par are
 * routinely priced at 0.0001 and rounding that to 0 makes the invested column
 * read as zero.
 */
export function pricePerShare(amount: number, currency: string): string {
  return formatMoney(amount, currency, undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/** Compact money for chart axes and tight tiles: ₦2.5M, $940K. */
export function moneyCompact(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return money(amount / 1_000_000_000, currency, { maximumFractionDigits: 2 }) + 'B';
  if (abs >= 1_000_000) return money(amount / 1_000_000, currency, { maximumFractionDigits: 2 }) + 'M';
  if (abs >= 1_000) return money(amount / 1_000, currency, { maximumFractionDigits: 1 }) + 'K';
  return money(amount, currency);
}

/** Share counts. Always integers, always grouped. */
export function shares(count: number): string {
  return formatNumber(Math.round(count), undefined, { maximumFractionDigits: 0 });
}

/** Compact share counts for axes: 10.0M, 250.0K. */
export function sharesCompact(count: number): string {
  const abs = Math.abs(count);
  if (abs >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return shares(count);
}

/**
 * A percentage, already in percent units (58.31, not 0.5831).
 *
 * Two decimals by default: ownership disputes are fought over basis points, and
 * "58%" hides the difference between 58.0 and 58.4.
 */
export function percent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

/** A signed delta, for dilution columns. Positive gets an explicit +. */
export function percentDelta(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

/** A return multiple: 3.42x. */
export function multiple(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}x`;
}

/**
 * What an empty Invested cell means.
 *
 * Shares can be paid for with something other than money — the founding issuance
 * here was paid for with the product itself. The engine correctly counts that as
 * zero cash in, so wherever Invested is rendered it needs to say *why* it is
 * zero, or a bootstrapped cap table reads as one somebody forgot to fill in.
 *
 * Lives here rather than in a component because three places render the same
 * column and they must not word it differently.
 */
const CONSIDERATION_LABELS: Record<Consideration, string> = {
  cash: 'cash',
  ip: 'for IP',
  services: 'for services',
  conversion: 'on conversion',
};

/**
 * The Invested cell for one holder: an amount where cash was paid, otherwise what
 * the shares were issued for.
 */
export function investedLabel(
  invested: number,
  nonCashConsiderations: Consideration[],
  currency: string,
): string {
  if (invested > 0) return money(invested, currency);
  if (nonCashConsiderations.length > 0) {
    return nonCashConsiderations.map((c) => CONSIDERATION_LABELS[c]).join(', ');
  }
  return '—';
}
