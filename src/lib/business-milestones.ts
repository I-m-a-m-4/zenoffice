/**
 * The business milestones Zeneva recognises.
 *
 * Lifted out of `src/app/(app)/achievements/page.tsx` so the page that displays a
 * badge and the rule that raises a notification about it read the same table. They
 * were about to diverge: a milestone added to one and not the other produces either
 * a badge nobody is told about, or a notification for an achievement the page does
 * not show.
 *
 * The thresholds are naira figures. They are not localised on purpose — a shop
 * trading in cedis crossing "₦1 Million in Sales" is wrong, and fixing it properly
 * means per-currency tables rather than a symbol swap. Tracked, not solved here.
 */

export type Milestone = {
  value: number;
  label: string;
  image: string;
};

export const SALES_MILESTONES: Milestone[] = [
  { value: 100000, label: '₦100k in Sales', image: '/badges/sales-pioneer.png' },
  { value: 500000, label: '₦500k in Sales', image: '/badges/sales-pioneer.png' },
  { value: 1000000, label: '₦1 Million in Sales', image: '/badges/millionaire-milestone.png' },
  { value: 5000000, label: '₦5 Million in Sales', image: '/badges/millionaire-milestone.png' },
  { value: 10000000, label: '₦10 Million in Sales', image: '/badges/five-figure-club.png' },
  { value: 30000000, label: '₦30 Million in Sales', image: '/badges/five-figure-club.png' },
  { value: 50000000, label: '₦50 Million in Sales', image: '/badges/high-roller.png' },
  { value: 100000000, label: '₦100 Million in Sales', image: '/badges/high-roller.png' },
];

export const PRODUCT_MILESTONES: Milestone[] = [
  { value: 100, label: '100 Products Added', image: '/badges/inventory-architect.png' },
  { value: 500, label: '500 Products Added', image: '/badges/inventory-architect.png' },
  { value: 1000, label: '1,000 Products Added', image: '/badges/inventory-architect.png' },
];

export const CUSTOMER_MILESTONES: Milestone[] = [
  { value: 50, label: '50 Customers', image: '/badges/community-cultivator.png' },
  { value: 100, label: '100 Customers', image: '/badges/community-cultivator.png' },
  { value: 500, label: '500 Customers', image: '/badges/community-cultivator.png' },
];

/**
 * The highest milestone a value has reached, or null.
 *
 * Only the top one matters for a notification: crossing ₦1m in a single busy day
 * from a standing start would otherwise fire ₦100k, ₦500k *and* ₦1m at once, which
 * reads as a glitch rather than a celebration. The achievements page still lists
 * every badge earned — this is about what is worth interrupting someone for.
 */
export function highestMilestoneReached(value: number, table: Milestone[]): Milestone | null {
  let best: Milestone | null = null;
  for (const milestone of table) {
    if (value >= milestone.value && (!best || milestone.value > best.value)) best = milestone;
  }
  return best;
}
