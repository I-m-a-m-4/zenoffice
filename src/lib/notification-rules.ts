/**
 * The rules that decide when Zeneva interrupts a business owner.
 *
 * This is arithmetic, not AI, and `now` is an input rather than a call to
 * `Date.now()` — the same convention `src/lib/forensics.ts` follows, and for the same
 * reason: a rule that reads the clock itself cannot be tested, and every one of these
 * is time-dependent. See `docs/notifications.md` for how the results are delivered.
 *
 * Three properties every rule must hold:
 *
 * 1. **A deterministic id.** The id *is* the idempotency guarantee. Writing
 *    `trg-lowstock-abc-20260818` twice is an overwrite, not a duplicate, and the
 *    document-to-popup bridge only reacts to `added` — so a repeat write is silent.
 *    Never mint a random id here.
 *
 * 2. **A day (or hour) component on anything recurring.** Without it, a low-stock
 *    alert either fires once and never again after a restock, or fires on every
 *    single pass. With it, "once per product per day" falls out of the id.
 *
 * 3. **A cap.** A shop with 200 items below their reorder point must not receive 200
 *    notifications. Each rule emits at most {@link RULE_EMIT_CAP} named alerts and
 *    collapses to a single digest beyond that; the whole pass is bounded by
 *    {@link TRIGGER_BATCH_CAP}. Anything held back is picked up on a later pass, so
 *    the cap delays rather than drops.
 *
 * Ordering matters because of that cap: rules are evaluated worst-consequence first,
 * so an unflushed sales queue (silent data loss) outranks a milestone badge.
 */

import type {
  AuditLog,
  BusinessStats,
  Customer,
  Product,
  QueuedAction,
  Receipt,
} from '@/types';
import {
  CUSTOMER_MILESTONES,
  PRODUCT_MILESTONES,
  SALES_MILESTONES,
  highestMilestoneReached,
} from '@/lib/business-milestones';
import { safeToDate } from '@/lib/utils';

/** Who a triggered notification is written to. */
export type TriggerTarget = 'self' | 'owner';

export type TriggeredNotification = {
  /** Deterministic Firestore document id. See rule 1 in the module header. */
  id: string;
  target: TriggerTarget;
  title: string;
  body: string;
  /** Drives the icon, the badge and the fallback link. */
  type: string;
  link?: string;
};

export type NotificationRuleInput = {
  now: Date;
  /** From `usePOS().currencySymbol`, so figures read in the shop's own money. */
  currencySymbol: string;
  /** True when the signed-in user is the business owner. Gates `owner` rules. */
  isViewerOwner: boolean;
  products: Product[] | null;
  receipts: Receipt[] | null;
  customers: Customer[] | null;
  auditLogs: AuditLog[];
  stats: BusinessStats | null;
  queuedActions: QueuedAction[];
  isOnline: boolean;
  /** Paid plans only; null when there is nothing that can lapse. */
  subscriptionExpiresAt: Date | null;
  /** Ids already written, so a rule can be skipped before it does any work. */
  alreadySent: Set<string>;
};

/** Named alerts one rule may emit before it collapses to a digest. */
export const RULE_EMIT_CAP = 3;

/** Documents one pass may write. Keeps a first run from firing a burst. */
export const TRIGGER_BATCH_CAP = 5;

/** How long a queued sale may sit unflushed while online before it is a problem. */
const QUEUE_STUCK_MS = 15 * 60 * 1000;

/** Audit events older than this are history, not something to interrupt anyone about. */
const AUDIT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** Hour (local) after which the close-of-day summary becomes due. */
const DAILY_SUMMARY_HOUR = 20;

/**
 * Expiry horizon, matching `getExpiringProducts` in `src/app/api/chat/tools.ts` so the
 * trigger and Zen AI never disagree about what "expiring soon" means.
 */
const EXPIRY_HORIZON_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * How long an unpaid sale may sit before it is a collection problem.
 *
 * A credit sale is not overdue on the day it is made — that is the whole point of
 * selling on credit. Seven days is the line at which "they will pay next time they
 * come in" stops being true on its own.
 */
const DEBT_OVERDUE_MS = 7 * 24 * 60 * 60 * 1000;

/** `YYYYMMDD` in the *device's* timezone — a trading day is local, not UTC. */
function dayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function money(symbol: string, value: number): string {
  return `${symbol}${Math.round(value).toLocaleString()}`;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * A product's expiry as epoch milliseconds, or null when it has none.
 *
 * `Product.expiryDate` is typed `any` because it arrives as a Firestore `Timestamp` from
 * the network and as a `Date` from the local mirror, so it goes through `safeToDate`
 * rather than being compared directly. An unparseable value returns null and drops the
 * product from both expiry rules — a bad date must not be reported as expired.
 */
function expiryMs(product: Product): number | null {
  if (!product?.expiryDate) return null;
  const at = safeToDate(product.expiryDate).getTime();
  return Number.isFinite(at) && at > 0 ? at : null;
}

/** Cost of the stock on hand, matching `valueAtRisk` in `src/app/api/chat/tools.ts`. */
function valueAtRisk(product: Product): number {
  return (product.stock || 0) * (product.costPrice ?? product.price ?? 0);
}

/** "today", "yesterday", or "N days ago" — read out loud in a notification body. */
function daysAgo(then: number, nowMs: number): string {
  const days = Math.floor((nowMs - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/**
 * Emit one notification per item, or a single digest when there are too many.
 *
 * The digest id carries the count, so a shop that goes from 6 low items to 9 gets a
 * second, updated digest rather than silence — but going 6 → 6 does not.
 */
function emitOrDigest<T>(
  items: T[],
  named: (item: T) => TriggeredNotification,
  digest: (items: T[]) => TriggeredNotification,
): TriggeredNotification[] {
  if (items.length === 0) return [];
  if (items.length <= RULE_EMIT_CAP) return items.map(named);
  return [digest(items)];
}

/* ------------------------------------------------------------------------- */
/* Rules, worst consequence first                                            */
/* ------------------------------------------------------------------------- */

/**
 * Sales sitting in the offline queue that should have flushed by now.
 *
 * First in the list because it is the only failure here that loses money silently.
 * A till that keeps taking payments into a queue nothing drains looks completely
 * normal to the person using it, and nothing else in the app says a word.
 *
 * Targets `self`, not the owner: the device holding the stuck queue is the one that
 * has to be online for it to drain, so the person standing at that till is who can
 * act.
 */
function queueStuck(input: NotificationRuleInput): TriggeredNotification[] {
  if (!input.isOnline) return [];

  const cutoff = input.now.getTime() - QUEUE_STUCK_MS;
  const stuck = input.queuedActions.filter(
    (action) => (action.status === 'pending' || action.status === 'failed') && action.timestamp < cutoff,
  );
  if (stuck.length === 0) return [];

  const failed = stuck.filter((a) => a.status === 'failed').length;
  // Hour-scoped so a queue that stays stuck keeps saying so, without saying it on
  // every pass.
  const hour = String(input.now.getHours()).padStart(2, '0');

  return [
    {
      id: `trg-queue-${dayKey(input.now)}-${hour}`,
      target: 'self',
      type: 'sync',
      title: 'Sales are waiting to sync',
      body:
        `${stuck.length} ${stuck.length === 1 ? 'action has' : 'actions have'} been queued for over 15 minutes ` +
        `while this device is online${failed > 0 ? `, and ${failed} failed` : ''}. ` +
        `Tap the cloud icon at the top of the screen and retry, so nothing is lost.`,
      // The queue is a top-bar popover (src/components/layout/queue-status.tsx), not a
      // page, so this only has to land anywhere inside the app for it to be reachable.
      link: '/dashboard',
    },
  ];
}

/**
 * The subscription has lapsed, not "is about to".
 *
 * The layout already warns three days out. This is the other side of that line, and
 * it is the one that matters — `addToQueue` refuses to record a sale once the plan is
 * inactive, so an owner who missed the warning finds out when a customer is standing
 * in front of them.
 */
function subscriptionLapsed(input: NotificationRuleInput): TriggeredNotification[] {
  const expiry = input.subscriptionExpiresAt;
  if (!expiry || expiry.getTime() > input.now.getTime()) return [];

  return [
    {
      id: `trg-lapsed-${dayKey(input.now)}`,
      target: 'owner',
      type: 'billing',
      title: 'Your subscription has expired',
      body:
        'New sales cannot be recorded until the plan is renewed. Renew now to get the till working again.',
      link: '/billing',
    },
  ];
}

/**
 * Stock on the shelf that is already past its expiry date.
 *
 * Ranked above a wrong stock count on purpose: everything else here costs money, this
 * one can harm a customer and is the only rule in the file with a legal edge to it. A
 * shop selling expired medication or food is not making a bookkeeping error.
 *
 * Targets `self` — whoever is standing at the till is the person who can stop it being
 * sold in the next five minutes. The owner receives the same alert on their own device
 * and can decide about the write-off.
 *
 * `stock > 0` is the whole point of the filter: an expired product with nothing on hand
 * is a catalogue entry, not a risk, and alerting on it would bury the real ones.
 */
function expiredStock(input: NotificationRuleInput): TriggeredNotification[] {
  const day = dayKey(input.now);
  const nowMs = input.now.getTime();

  const expired = (input.products || [])
    .map((product) => ({ product, at: expiryMs(product) }))
    .filter((row) => row.at !== null && (row.at as number) < nowMs && (row.product.stock || 0) > 0)
    .sort((a, b) => (a.at as number) - (b.at as number));

  return emitOrDigest(
    expired,
    ({ product, at }) => ({
      // Day-scoped: expired stock stays expired, and it needs to keep saying so until
      // someone pulls it off the shelf.
      id: `trg-expired-${product.id}-${day}`,
      target: 'self',
      type: 'inventory',
      title: 'Expired stock on the shelf',
      body:
        `${product.name} expired ${daysAgo(at as number, nowMs)} and still shows ${product.stock} on hand. ` +
        `Pull it before it is sold.`,
      link: '/inventory',
    }),
    (rows) => ({
      id: `trg-expired-digest-${day}-${rows.length}`,
      target: 'self',
      type: 'inventory',
      title: `${rows.length} expired products still in stock`,
      body:
        `${rows.slice(0, 3).map((r) => r.product.name).join(', ')}, and ${rows.length - 3} more are past their ` +
        `expiry date with stock on hand — ${money(input.currencySymbol, rows.reduce((sum, r) => sum + valueAtRisk(r.product), 0))} ` +
        `to write off. Pull them before they are sold.`,
      link: '/inventory',
    }),
  );
}

/**
 * Stock that has gone below zero.
 *
 * Never legitimate: it means stock left the shelf without a sale behind it, or two
 * devices sold the same unit. Either way the count is now wrong and every margin
 * figure computed from it is wrong too.
 */
function negativeStock(input: NotificationRuleInput): TriggeredNotification[] {
  const negatives = (input.products || []).filter((p) => typeof p.stock === 'number' && p.stock < 0);
  if (negatives.length === 0) return [];

  const names = negatives.slice(0, 3).map((p) => p.name).join(', ');

  return [
    {
      id: `trg-negstock-${dayKey(input.now)}-${negatives.length}`,
      target: 'owner',
      type: 'inventory',
      title: 'Stock count has gone negative',
      body:
        `${negatives.length} ${negatives.length === 1 ? 'product shows' : 'products show'} less than zero on hand ` +
        `(${names}${negatives.length > 3 ? ', and more' : ''}). That cannot happen from selling alone — ` +
        `recount and adjust, then check the audit log.`,
      link: '/inventory',
    },
  ];
}

/**
 * High-risk actions recorded in the audit log.
 *
 * Deliberately **not** an accusation. `src/lib/forensics.ts` is the tool that names a
 * person and says their numbers look like theft, and it runs only when the owner asks
 * for it — see `docs/loss-prevention.md`. This rule says "this happened, look at it",
 * which is the most a background trigger should ever do.
 *
 * The four actions checked are the ones that move money without a sale behind them.
 * The detail fields they read (`stockAtDeletion`, `changes.{price,costPrice}`) are the
 * ones documented as unbackfillable in `docs/loss-prevention.md`.
 */
function auditRisk(input: NotificationRuleInput): TriggeredNotification[] {
  const cutoff = input.now.getTime() - AUDIT_LOOKBACK_MS;

  const risky = input.auditLogs.filter((log) => {
    if (!log?.action) return false;
    const at = log.createdAt ? safeToDate(log.createdAt).getTime() : NaN;
    if (!Number.isFinite(at) || at < cutoff) return false;

    if (log.action === 'sale.void') return true;
    if (log.action === 'product.delete') return (log.details?.stockAtDeletion || 0) > 0;
    if (log.action === 'product.update') {
      const changes = log.details?.changes || {};
      return 'price' in changes || 'costPrice' in changes;
    }
    if (log.action === 'user.impersonate' || log.action === 'billing.grant_lifetime') return true;
    return false;
  });

  const describe = (log: AuditLog): string => {
    const who = log.userName || log.userEmail || 'someone';
    switch (log.action) {
      case 'sale.void':
        return `${who} voided a sale`;
      case 'product.delete':
        return `${who} deleted a product still holding ${log.details?.stockAtDeletion} in stock`;
      case 'product.update':
        return `${who} changed the price or cost of ${log.details?.name || 'a product'}`;
      default:
        return `${who} performed ${log.action}`;
    }
  };

  return emitOrDigest(
    risky,
    (log) => ({
      id: `trg-audit-${log.id}`,
      target: 'owner',
      type: 'audit',
      title: 'Worth a look in the audit log',
      body: `${describe(log)}. Open the audit log to see the full record.`,
      link: '/audit-log',
    }),
    (logs) => ({
      id: `trg-audit-digest-${dayKey(input.now)}-${logs.length}`,
      target: 'owner',
      type: 'audit',
      title: `${logs.length} actions worth reviewing`,
      body:
        `${logs.slice(0, 3).map(describe).join('; ')}; and ${logs.length - 3} more in the last day. ` +
        `Open the audit log, or run a loss-prevention scan.`,
      link: '/audit-log',
    }),
  );
}

/**
 * Money the shop is owed on sales it has already handed over.
 *
 * Credit sales are how a great deal of informal retail actually works, and they are the
 * easiest money in the business to lose track of — the goods left the shelf, the stock
 * count is correct, the sale is in the reports, and nothing anywhere says nobody paid.
 *
 * **The figure is a floor, not a total, and the wording has to stay honest about that.**
 * The receipt listener holds the most recent 200 receipts (`src/context/pos-context.tsx`,
 * the `limit(200)` query), so an older unpaid sale is simply not in memory to be counted.
 * This is the same capped-window trap documented for the business rating's dormant
 * buyers in `docs/business-rating.md`. Do not "fix" this into an authoritative total by
 * quoting it as the shop's full debt — `/invoices` queries properly and is where the
 * link goes.
 *
 * There is deliberately no minimum amount. A money floor cannot be currency-neutral
 * (₦1,000 and $1,000 are not the same reminder) and the rule is capped to once a day
 * anyway, so a shop that never sells on credit never hears from it.
 */
function outstandingDebt(input: NotificationRuleInput): TriggeredNotification[] {
  const cutoff = input.now.getTime() - DEBT_OVERDUE_MS;

  const overdue = (input.receipts || []).filter((receipt) => {
    if (receipt?.status !== 'unpaid' && receipt?.status !== 'pending') return false;
    const at = receipt.createdAt ? safeToDate(receipt.createdAt).getTime() : NaN;
    return Number.isFinite(at) && at < cutoff;
  });
  if (overdue.length === 0) return [];

  const total = overdue.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

  // Named customers make the alert actionable; walk-in credit is the part that hurts,
  // so it is worth saying how much of the balance has nobody attached to it.
  const named = new Map<string, number>();
  let anonymous = 0;
  overdue.forEach((receipt) => {
    const name = receipt.customer?.name;
    if (name) named.set(name, (named.get(name) || 0) + (Number(receipt.total) || 0));
    else anonymous += Number(receipt.total) || 0;
  });
  const worst = Array.from(named.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2);

  return [
    {
      // Once a day. Including the amount would mint a fresh id on every credit sale and
      // turn a collection reminder into a running commentary.
      id: `trg-debt-${dayKey(input.now)}`,
      target: 'owner',
      type: 'payment',
      title: `${money(input.currencySymbol, total)} owed to you`,
      body:
        `${overdue.length} ${overdue.length === 1 ? 'sale has' : 'sales have'} been unpaid for over a week` +
        (worst.length
          ? ` — ${worst.map(([name, owed]) => `${name} (${money(input.currencySymbol, owed)})`).join(', ')}`
          : '') +
        (anonymous > 0
          ? `${worst.length ? ', plus' : ' —'} ${money(input.currencySymbol, anonymous)} with no customer recorded`
          : '') +
        `. Open Invoices for the full list.`,
      link: '/invoices',
    },
  ];
}

/**
 * Stock with an expiry date close enough to do something about.
 *
 * Separate from {@link expiredStock} because the action is different and so is the
 * audience: this is a pricing and purchasing decision — discount it, push it, do not
 * reorder — which belongs to the owner, not to whoever is on the till. Once it is past
 * the date it becomes everybody's problem and moves to that rule.
 */
function expiringSoon(input: NotificationRuleInput): TriggeredNotification[] {
  const day = dayKey(input.now);
  const nowMs = input.now.getTime();
  const horizon = nowMs + EXPIRY_HORIZON_MS;

  const soon = (input.products || [])
    .map((product) => ({ product, at: expiryMs(product) }))
    .filter(
      (row) =>
        row.at !== null &&
        (row.at as number) >= nowMs &&
        (row.at as number) <= horizon &&
        (row.product.stock || 0) > 0,
    )
    .sort((a, b) => (a.at as number) - (b.at as number));

  const inDays = (at: number) => {
    const days = Math.ceil((at - nowMs) / (24 * 60 * 60 * 1000));
    return days <= 1 ? 'tomorrow' : `in ${days} days`;
  };

  return emitOrDigest(
    soon,
    ({ product, at }) => ({
      id: `trg-expiring-${product.id}-${day}`,
      target: 'owner',
      type: 'inventory',
      title: 'Expiring soon',
      body:
        `${product.name} expires ${inDays(at as number)} with ${product.stock} on hand ` +
        `(${money(input.currencySymbol, valueAtRisk(product))} at cost). Discount it now or lose it.`,
      link: '/inventory',
    }),
    (rows) => ({
      id: `trg-expiring-digest-${day}-${rows.length}`,
      target: 'owner',
      type: 'inventory',
      title: `${rows.length} products expire within a month`,
      body:
        `${money(input.currencySymbol, rows.reduce((sum, r) => sum + valueAtRisk(r.product), 0))} of stock at cost, ` +
        `starting with ${rows.slice(0, 3).map((r) => r.product.name).join(', ')}. Discount them now or lose it.`,
      link: '/inventory',
    }),
  );
}

/**
 * Products that have run out entirely.
 *
 * Targets `self` rather than the owner so that whoever is standing at the till hears
 * it too — they are the one about to be asked for the thing that is gone. The owner
 * gets the same alert on their own device.
 */
function outOfStock(input: NotificationRuleInput): TriggeredNotification[] {
  const day = dayKey(input.now);
  // A product with no reorder point set has never been stock-managed; treating a
  // zero there as "sold out" would alert on every placeholder in the catalogue.
  const empty = (input.products || []).filter(
    (p) => typeof p.stock === 'number' && p.stock === 0 && (p.lowStockThreshold || 0) > 0,
  );

  return emitOrDigest(
    empty,
    (product) => ({
      id: `trg-oos-${product.id}-${day}`,
      target: 'self',
      type: 'inventory',
      title: 'Out of stock',
      body: `${product.name} has sold out. Reorder before the next customer asks for it.`,
      link: '/inventory',
    }),
    (products) => ({
      id: `trg-oos-digest-${day}-${products.length}`,
      target: 'self',
      type: 'inventory',
      title: `${products.length} products have sold out`,
      body: `${products.slice(0, 3).map((p) => p.name).join(', ')}, and ${products.length - 3} more are at zero.`,
      link: '/inventory',
    }),
  );
}

/**
 * Products at or below their reorder point.
 *
 * Targets `self`, which is what preserves the behaviour this replaces: the low-stock
 * alert used to be written by the POS queue to whoever rang the sale up. It now also
 * reaches the owner, on the owner's own device.
 */
function lowStock(input: NotificationRuleInput): TriggeredNotification[] {
  const day = dayKey(input.now);
  const low = (input.products || []).filter(
    (p) =>
      typeof p.stock === 'number' &&
      p.stock > 0 &&
      (p.lowStockThreshold || 0) > 0 &&
      p.stock <= (p.lowStockThreshold as number),
  );

  return emitOrDigest(
    low,
    (product) => ({
      id: `trg-lowstock-${product.id}-${day}`,
      target: 'self',
      type: 'inventory',
      title: 'Running low',
      body: `${product.name} is down to ${product.stock} left (reorder point ${product.lowStockThreshold}).`,
      link: '/inventory',
    }),
    (products) => ({
      id: `trg-lowstock-digest-${day}-${products.length}`,
      target: 'self',
      type: 'inventory',
      title: `${products.length} products are running low`,
      body: `${products.slice(0, 3).map((p) => `${p.name} (${p.stock})`).join(', ')}, and ${products.length - 3} more are at or below their reorder point.`,
      link: '/inventory',
    }),
  );
}

/** Today's trading, once the shop has had its day. */
function dailySummary(input: NotificationRuleInput): TriggeredNotification[] {
  if (input.now.getHours() < DAILY_SUMMARY_HOUR) return [];

  const today = (input.receipts || []).filter((r) => {
    if (!r?.createdAt) return false;
    const at = safeToDate(r.createdAt);
    return Number.isFinite(at.getTime()) && isSameLocalDay(at, input.now);
  });

  // Nothing sold is a legitimate day, but it is not worth a notification — and on a
  // device whose receipt cache has not hydrated it would be a lie.
  if (today.length === 0) return [];

  const revenue = today.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

  const unitsByName = new Map<string, number>();
  today.forEach((receipt) => {
    (receipt.items || []).forEach((item: any) => {
      const name = item?.name || item?.productName;
      if (!name) return;
      unitsByName.set(name, (unitsByName.get(name) || 0) + (Number(item.quantity) || 0));
    });
  });
  const best = Array.from(unitsByName.entries()).sort((a, b) => b[1] - a[1])[0];

  return [
    {
      id: `trg-daily-${dayKey(input.now)}`,
      target: 'owner',
      type: 'summary',
      title: "Today's close of day",
      body:
        `${today.length} ${today.length === 1 ? 'sale' : 'sales'} totalling ${money(input.currencySymbol, revenue)}` +
        (best ? `. Best seller: ${best[0]} (${best[1]} sold).` : '.'),
      link: '/reports',
    },
  ];
}

/**
 * A milestone the business has just crossed.
 *
 * Only the highest one reached, and only once ever — see
 * {@link highestMilestoneReached} for why firing the whole ladder at once reads as a
 * glitch. The figure is lifetime revenue from the `stats/overall` counter, which is
 * the only total that is authoritative on a device whose receipt cache is capped.
 *
 * `/achievements` reads the same lifetime figure through `src/lib/achievements.ts`,
 * so the badge and this notification can never disagree. That used to be false: the
 * page summed the held receipts and filtered them to the current year, so a shop
 * could be told it had crossed ₦1 million and find no badge for it.
 *
 * This rule and {@link useAchievements} are separate on purpose — one is a
 * notification document, the other an owner-facing card — but they must stay on the
 * same ladder tables (`src/lib/business-milestones.ts`) and the same figure.
 */
function milestones(input: NotificationRuleInput): TriggeredNotification[] {
  const out: TriggeredNotification[] = [];

  const revenue =
    input.stats?.totalRevenue ??
    (input.receipts || []).reduce((sum, r) => sum + (Number(r.total) || 0), 0);

  const checks: Array<{ key: string; value: number; table: typeof SALES_MILESTONES; verb: string }> = [
    { key: 'sales', value: revenue, table: SALES_MILESTONES, verb: 'crossed' },
    { key: 'products', value: (input.products || []).length, table: PRODUCT_MILESTONES, verb: 'reached' },
    { key: 'customers', value: (input.customers || []).length, table: CUSTOMER_MILESTONES, verb: 'reached' },
  ];

  checks.forEach(({ key, value, table, verb }) => {
    if (value <= 0) return;
    const reached = highestMilestoneReached(value, table);
    if (!reached) return;
    out.push({
      id: `trg-milestone-${key}-${reached.value}`,
      target: 'owner',
      type: 'achievement',
      title: `Milestone: ${reached.label}`,
      body: `Your business has ${verb} ${reached.label}. Open Achievements to see the badge.`,
      link: '/achievements',
    });
  });

  return out;
}

/**
 * Every rule, in the order they get to claim the pass budget.
 *
 * Adding a trigger means adding one entry here and one function above. Nothing else
 * in the app needs to change.
 */
const RULES: Array<(input: NotificationRuleInput) => TriggeredNotification[]> = [
  queueStuck,
  subscriptionLapsed,
  expiredStock,
  negativeStock,
  auditRisk,
  outstandingDebt,
  expiringSoon,
  outOfStock,
  lowStock,
  dailySummary,
  milestones,
];

/**
 * Everything due right now that has not already been sent, capped.
 *
 * `owner`-targeted results are dropped for anyone who is not the owner rather than
 * rewritten to `self`: Firestore rules do not let a cashier write into the owner's
 * notifications (`firestore.rules`, `users/{userId}/notifications`), and quietly
 * redirecting the alert to the cashier would mean the person who can act never hears
 * about it while the app believes it was delivered. The owner picks these up on their
 * own device — see `docs/notifications.md`.
 */
export function selectDueNotifications(input: NotificationRuleInput): TriggeredNotification[] {
  const due: TriggeredNotification[] = [];
  const claimed = new Set<string>();

  for (const rule of RULES) {
    if (due.length >= TRIGGER_BATCH_CAP) break;

    let produced: TriggeredNotification[];
    try {
      produced = rule(input);
    } catch (err) {
      // One malformed product or receipt must not silence every other rule.
      console.warn('[notifications] Rule threw, skipping it this pass:', err);
      continue;
    }

    for (const notification of produced) {
      if (due.length >= TRIGGER_BATCH_CAP) break;
      if (notification.target === 'owner' && !input.isViewerOwner) continue;
      if (input.alreadySent.has(notification.id) || claimed.has(notification.id)) continue;
      claimed.add(notification.id);
      due.push(notification);
    }
  }

  return due;
}
