/**
 * The AI credit ledger — where a balance came from.
 *
 * `aiBonusCredits` is a single integer on the business document. It had three
 * writers: a Paystack purchase, a Dodo purchase, and a manual grant from
 * `/admin-imamshaffy/ai-usage`. Credit packs are scrapped — credits are an
 * allowance of the plan and are not sold — so **the grant is the only live writer
 * now**, and it is the reason this collection stays: "who gave this shop 10,000
 * credits" is a question about a number that keeps no history.
 *
 * The `purchase` kind, its two gateway sources and `packId` are **kept on purpose**.
 * Any row written while packs were on sale is real money that must still render in
 * the admin table; deleting the shape would turn those rows into blanks. Nothing
 * writes them any more.
 *
 * ## Shape of the thing
 *
 * Append-only, one row per movement, `credits` always **positive** — a row is a
 * grant or a purchase, and spending is not recorded here. Spending is metered per
 * day on `platform_stats/ai_usage_global/daily/{date}` and does not belong in a
 * money trail; mixing the two would make the ledger's sum meaningless as a
 * "credits ever given to this shop" figure.
 *
 * ## Rules
 *
 * A top-level collection with **no entry in `firestore.rules`**, which is exactly
 * right: the catch-all at the top of the file (`match /{allPaths=**}`) already
 * grants the platform owner read and write, and everyone else is denied by
 * default. Tenants have no business reading it, and the grant writer is super-admin
 * through that same catch-all. If a tenant-facing receipt list is ever wanted, that
 * needs a rule — do not assume this is readable client-side.
 *
 * No React and no Firestore imports in here, so the admin board and a server action
 * can share it.
 */

export const AI_CREDIT_LEDGER_COLLECTION = 'ai_credit_ledger';

/**
 * Paid for, or given. The distinction the admin board exists to show.
 *
 * `'purchase'` is historical only — see the header. Everything written from now on
 * is a `'grant'`.
 */
export type AiCreditLedgerKind = 'purchase' | 'grant';

/** Which mechanism moved the credits. The two gateways are historical only. */
export type AiCreditLedgerSource = 'paystack' | 'dodo' | 'admin';

export interface AiCreditLedgerEntry {
  id?: string;
  businessId: string;
  /** Denormalised so the admin table need not join. May be null on old rows. */
  businessName?: string | null;
  kind: AiCreditLedgerKind;
  source: AiCreditLedgerSource;
  /** Always positive. Credits added to `aiBonusCredits`. */
  credits: number;
  /** Pack id for a historical purchase; absent for a grant. */
  packId?: string | null;
  /** Money paid, in `currency`'s major units. Absent for a grant. */
  amount?: number | null;
  currency?: string | null;
  /** Paystack reference or Dodo payment id. Absent for a grant. */
  reference?: string | null;
  /**
   * Who caused it: the buyer's uid for a purchase, the platform owner's for a
   * grant. Null where the writer had no uid to hand — the Dodo webhook is
   * authenticated by signature, not by a user.
   */
  actorId?: string | null;
  /** Email or name of the actor, for a table that should not show raw uids. */
  actorLabel?: string | null;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  /** Free text on a grant — why it was given. */
  note?: string | null;
  timestamp?: any;
}

/**
 * One line describing a row, for the admin table.
 *
 * Says where the credits came from rather than restating the amount, which the
 * table shows in its own column.
 */
export function describeLedgerEntry(entry: Pick<AiCreditLedgerEntry, 'kind' | 'source' | 'note' | 'actorLabel'>): string {
  if (entry.kind === 'grant') {
    const who = entry.actorLabel ? ` by ${entry.actorLabel}` : '';
    return entry.note ? `Granted${who} — ${entry.note}` : `Granted${who}`;
  }
  return entry.source === 'dodo' ? 'Bought (Dodo, USD)' : 'Bought (Paystack)';
}
