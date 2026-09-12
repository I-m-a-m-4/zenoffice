/**
 * Cap table domain types.
 *
 * Zeneva's own equity — who owns what share of the company — not tenant data.
 *
 * Every live record lives in a single `cap_table` collection under a `kind`
 * discriminator. That is deliberate: a cap table is tens to low hundreds of
 * documents, so one listener is cheaper than eight, and the owner pays the
 * Firestore bill. The append-only audit trail is the one thing kept separate
 * (`cap_table_events`), because it grows without bound and must not be dragged
 * into memory on every page load.
 *
 * Two invariants worth stating up front, because violating either produces
 * numbers that look plausible and are wrong:
 *
 * 1. **Share counts are integers.** Fractional shares do not exist. Every
 *    computed share count goes through Math.floor, and percentages are derived
 *    from the integers rather than accumulated alongside them.
 * 2. **Money is stored unrounded, displayed rounded.** Valuations and per-share
 *    prices carry real decimals; rounding happens at the formatter, never in the
 *    stored value.
 */

/** A Firestore Timestamp, a Date, or anything with a toDate() — see toDate() in format.ts. */
export type DateLike = Date | { toDate: () => Date } | string | number | null | undefined;

export type EquityKind =
  | 'settings'
  | 'shareClass'
  | 'stakeholder'
  | 'issuance'
  | 'transfer'
  | 'cancellation'
  | 'round'
  | 'convertible'
  | 'poolReservation'
  | 'optionGrant'
  | 'valuation';

interface BaseRecord {
  id: string;
  kind: EquityKind;
  createdAt?: DateLike;
  updatedAt?: DateLike;
}

/** Cliff-then-monthly vesting. The only schedule shape in real use. */
export interface VestingTerms {
  startDate: DateLike;
  /** Nothing vests before this many months have elapsed; then the cliff amount vests at once. */
  cliffMonths: number;
  /** Total length of the schedule. 48 with a 12-month cliff is the standard founder/employee grant. */
  totalMonths: number;
}

/** Singleton, doc id `settings`. */
export interface EquitySettings extends BaseRecord {
  kind: 'settings';
  companyLegalName: string;
  /** ISO 4217. Drives every money render on the page via formatMoney's currency fallback. */
  currency: string;
  incorporationDate?: DateLike;
  /** 1-12. Cosmetic for now; kept so a future statement export can label periods. */
  fiscalYearEndMonth?: number;
}

export interface ShareClass extends BaseRecord {
  kind: 'shareClass';
  name: string;
  classType: 'common' | 'preferred';
  authorizedShares: number;
  parValue: number;
  /** Higher is paid first in a liquidation. Common is 0. */
  seniorityRank: number;
  votesPerShare: number;
  /** Preferred-to-common ratio on conversion. 1 unless there has been an anti-dilution adjustment. */
  conversionRatio: number;
  /** 1 = 1x preference. Ignored for common. */
  liquidationMultiple: number;
  /** Participating preferred takes its preference AND shares the residual. */
  participating: boolean;
  /** Total return cap as a multiple of invested, or null for uncapped participation. */
  participationCapMultiple: number | null;
}

export type StakeholderEntityType =
  | 'individual'
  | 'entity'
  | 'fund'
  | 'employee'
  | 'advisor';

export interface Stakeholder extends BaseRecord {
  kind: 'stakeholder';
  name: string;
  email?: string;
  entityType: StakeholderEntityType;
  country?: string;
  isFounder?: boolean;
  notes?: string;
}

export type Consideration = 'cash' | 'ip' | 'services' | 'conversion';

/** A share certificate. The atom of ownership. */
export interface Issuance extends BaseRecord {
  kind: 'issuance';
  stakeholderId: string;
  shareClassId: string;
  shares: number;
  /** What was paid per share. Sets the liquidation preference base for preferred. */
  pricePerShare: number;
  issueDate: DateLike;
  roundId?: string;
  certificateNo?: string;
  consideration: Consideration;
  /** Founder shares are often subject to reverse vesting. */
  vesting?: VestingTerms | null;
}

/** Secondary sale. Moves shares between holders without changing the total. */
export interface Transfer extends BaseRecord {
  kind: 'transfer';
  fromStakeholderId: string;
  toStakeholderId: string;
  shareClassId: string;
  shares: number;
  date: DateLike;
  pricePerShare?: number;
  note?: string;
}

/** Buyback, forfeiture or plain cancellation. Reduces the total. */
export interface Cancellation extends BaseRecord {
  kind: 'cancellation';
  stakeholderId: string;
  shareClassId: string;
  shares: number;
  date: DateLike;
  reason: 'buyback' | 'forfeiture' | 'cancellation';
  note?: string;
}

export interface FundingRound extends BaseRecord {
  kind: 'round';
  name: string;
  closeDate: DateLike;
  preMoneyValuation: number;
  amountRaised: number;
  pricePerShare: number;
  shareClassId: string;
  status: 'planned' | 'closed';
  note?: string;
}

/**
 * SAFE or convertible note.
 *
 * Holds no shares until it converts — which is why it shows on the cap table as
 * an *estimate* and is labelled as one.
 */
export interface Convertible extends BaseRecord {
  kind: 'convertible';
  stakeholderId: string;
  instrument: 'safe' | 'note';
  principal: number;
  issueDate: DateLike;
  valuationCap: number | null;
  /** Percent off the round price, e.g. 20 for a 20% discount. */
  discountPercent: number | null;
  /** Simple annual interest, percent. Notes only; 0 for SAFEs. */
  interestRate: number;
  maturityDate?: DateLike;
  /**
   * Pre-money SAFE: cap divides by pre-money fully-diluted shares.
   * Post-money SAFE: the holder's percentage is fixed against post-money, so the
   * cap divides by a share base that includes the SAFE's own converted shares.
   */
  safeType: 'pre' | 'post';
  status: 'outstanding' | 'converted' | 'cancelled';
  convertedRoundId?: string;
}

/** An ESOP top-up. Summed to give the total reserved pool. */
export interface PoolReservation extends BaseRecord {
  kind: 'poolReservation';
  shares: number;
  date: DateLike;
  note?: string;
}

/**
 * How a share price was arrived at.
 *
 * `priced_round` is the only one the market has actually tested — someone paid
 * that number. Everything else is an opinion, well-founded or otherwise, which
 * is why `Valuation` records carry the method rather than just the figure.
 */
export type ValuationMethod =
  | 'priced_round'
  | 'revenue_multiple'
  | 'comparable'
  | 'dcf'
  | 'founder_estimate';

/**
 * A point-in-time view of what the whole company is worth.
 *
 * Needed because a cap table with no priced round has no share price at all —
 * shares net out fine, but "what is 1% worth" has no answer until someone names
 * a valuation. The newest record by `asOfDate` sets the current price.
 */
export interface Valuation extends BaseRecord {
  kind: 'valuation';
  /** Pre-money enterprise value, in the settings currency. */
  amount: number;
  asOfDate: DateLike;
  method: ValuationMethod;
  /**
   * The inputs behind the number — ARR and the multiple applied, the comparable
   * used, whatever it was. A valuation without its basis cannot be defended to
   * an investor or revisited in six months.
   */
  basis?: string;
  /**
   * Lowest price per share the owner is willing to sell at, if set. Guards
   * against underselling: the investment calculator warns when a proposed
   * cheque implies a price below this.
   */
  floorPricePerShare?: number | null;
  notes?: string;
}

export interface OptionGrant extends BaseRecord {
  kind: 'optionGrant';
  stakeholderId: string;
  shares: number;
  strikePrice: number;
  grantDate: DateLike;
  vesting: VestingTerms;
  /** Shares already exercised into real stock. */
  exercised: number;
  /** Shares cancelled/forfeited — these return to the pool. */
  cancelled: number;
  status: 'outstanding' | 'exercised' | 'cancelled';
}

export type EquityRecord =
  | EquitySettings
  | ShareClass
  | Stakeholder
  | Issuance
  | Transfer
  | Cancellation
  | FundingRound
  | Convertible
  | PoolReservation
  | OptionGrant
  | Valuation;

// ---------------------------------------------------------------------------
// Audit trail — separate collection, append-only, lazily loaded.
// ---------------------------------------------------------------------------

export interface EquityEvent {
  id: string;
  at: DateLike;
  actorEmail: string;
  /** Dotted verb, e.g. `issuance.create`, `stakeholder.delete`. */
  action: string;
  /** A human sentence. This is what the History tab actually renders. */
  summary: string;
  recordId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Derived / computed shapes — produced by engine.ts, consumed by the UI.
// ---------------------------------------------------------------------------

/** One holder's position in one share class. */
export interface ClassPosition {
  shareClassId: string;
  shareClassName: string;
  shares: number;
  /**
   * Cash actually paid in for this position, and the liquidation preference
   * base. Shares issued for IP or services contribute nothing here — they are
   * issued at par for legal form, not bought.
   */
  invested: number;
  /** Vested portion, where the underlying issuances carry vesting terms. */
  vested: number;
}

/** One row of the cap table: everything one stakeholder holds. */
export interface HolderRow {
  stakeholderId: string;
  name: string;
  entityType: StakeholderEntityType;
  isFounder: boolean;
  positions: ClassPosition[];
  /** Issued shares actually held. */
  outstandingShares: number;
  /** Unexercised, uncancelled options. */
  optionShares: number;
  /** Estimated shares from unconverted SAFEs/notes. */
  convertibleShares: number;
  /** outstandingShares + optionShares + convertibleShares. */
  fullyDilutedShares: number;
  invested: number;
  /**
   * Distinct non-cash considerations behind this holder's shares — `['ip']` for
   * a founder who assigned the product they built. Present so an empty Invested
   * cell can say *why* it is empty instead of reading as missing data.
   */
  nonCashConsiderations: Consideration[];
  votes: number;
  /** Percent of issued & outstanding. */
  pctOutstanding: number;
  /** Percent of fully diluted. */
  pctFullyDiluted: number;
  pctVotes: number;
}

export interface ClassSummary {
  shareClassId: string;
  name: string;
  classType: 'common' | 'preferred';
  authorizedShares: number;
  issuedShares: number;
  /** authorizedShares - issuedShares. Negative means over-issuance — a real error. */
  availableShares: number;
  invested: number;
  seniorityRank: number;
  liquidationMultiple: number;
  participating: boolean;
  participationCapMultiple: number | null;
}

export interface CapTableSummary {
  asOf: Date;
  currency: string;
  companyLegalName: string;

  holders: HolderRow[];
  classes: ClassSummary[];

  /** Issued and outstanding — the denominator for the "outstanding" basis. */
  outstandingShares: number;
  optionsOutstanding: number;
  poolReserved: number;
  /** Reserved minus granted, plus anything returned by cancellation. */
  poolUnallocated: number;
  /** Estimated, from unconverted instruments. */
  convertiblesAsConverted: number;
  fullyDilutedShares: number;

  /** Cash paid in across every holder. Zero for a bootstrapped company. */
  totalInvested: number;
  totalVotes: number;

  /** Price per share of the most recent closed round, if any. */
  lastRoundPps: number | null;
  lastRoundName: string | null;
  /** lastRoundPps x fullyDilutedShares. Null when there has been no priced round. */
  impliedValuation: number | null;

  /**
   * The company valuation in force — the newest `valuation` record, or the last
   * closed round if no valuation has been recorded. Null when neither exists.
   */
  currentValuation: number | null;
  currentValuationMethod: ValuationMethod | null;
  currentValuationBasis: string | null;
  currentValuationDate: Date | null;
  /**
   * currentValuation / fullyDilutedShares — what one share is worth today.
   * This is the number the whole page hangs on once you start selling equity.
   */
  pricePerShare: number | null;
  /** Owner-set minimum sale price, if one has been recorded. */
  floorPricePerShare: number | null;

  /** Non-fatal data problems worth surfacing (over-issuance, orphan references). */
  warnings: string[];
}

/**
 * What a given cheque buys.
 *
 * The inverse of `modelRound`: instead of "here are the terms, what happens",
 * this answers "someone offers me X — what do they get, and is that a good
 * idea". Built because the intuitive move at an early stage is to name a low
 * valuation, and a low valuation makes a small cheque buy an alarming share of
 * the company.
 */
export interface InvestmentOffer {
  amount: number;
  valuation: number;
  pricePerShare: number;
  sharesIssued: number;
  /** Investor's stake after the money goes in. */
  investorPct: number;
  /** What every existing holder drops to. */
  founderPctAfter: number;
  postMoneyValuation: number;
  /** True when the implied price is below the owner's recorded floor. */
  belowFloor: boolean;
  /**
   * Plain-language flags — an outsized stake for the money, a price under the
   * floor, a valuation that has not been updated in a long time.
   */
  warnings: string[];
}

/**
 * Live trading figures fed in from the platform's own books.
 *
 * Kept as a plain input struct rather than read from Firestore inside the engine
 * so this file stays pure and the caller decides what a "purchase" is and how a
 * foreign-currency one converts.
 */
export interface RevenueInputs {
  /** Every subscription payment Zeneva has ever collected, in the settings currency. */
  lifetimeRevenue: number;
  /** The trailing twelve months of it. */
  trailingTwelveMonthRevenue: number;
  /** Monthly recurring revenue from currently-active subscriptions. */
  mrr: number;
  /** Number of paying customers behind the MRR. */
  payingCustomers: number;
  /** Cash raised from closed funding rounds — sits on the balance sheet. */
  capitalRaised: number;
  /** When the underlying figures were read. */
  asOf: Date;
}

/**
 * A revenue-multiple valuation, with every term of the arithmetic exposed.
 *
 * Deliberately not a single number. The whole failure mode this guards against
 * is treating cumulative revenue as a valuation — so the shape forces the
 * caller to render `arr`, `multiple` and `capitalRaised` separately rather than
 * showing one figure whose derivation is invisible.
 */
export interface RevenueValuation {
  /** mrr x 12 — the run rate investors price on. */
  arr: number;
  /** The multiple applied to ARR. */
  multiple: number;
  /** arr x multiple. The operating business's worth on this method. */
  enterpriseValue: number;
  /** Cash from closed rounds, added because it is an asset the company holds. */
  capitalRaised: number;
  /** enterpriseValue + capitalRaised. */
  valuation: number;
  /** valuation / fullyDilutedShares, or null with no shares issued. */
  pricePerShare: number | null;
  /** A sentence recording the arithmetic, ready to store as `Valuation.basis`. */
  basis: string;
  /**
   * Why this figure should be treated with caution — no revenue at all, a run
   * rate built on one customer, a multiple outside any defensible range.
   */
  warnings: string[];
}

export interface RoundModelHolder {
  stakeholderId: string;
  name: string;
  pctBefore: number;
  pctAfter: number;
  /** pctAfter - pctBefore. Negative for everyone not participating. */
  delta: number;
  sharesBefore: number;
  sharesAfter: number;
}

export interface RoundModel {
  pricePerShare: number;
  newShares: number;
  preMoneyValuation: number;
  postMoneyValuation: number;
  amountRaised: number;
  /** Shares added to the option pool as part of the round, absorbed pre-money. */
  poolTopUpShares: number;
  /** Shares issued to converting SAFEs/notes at this round. */
  convertedShares: number;
  preMoneyFullyDiluted: number;
  postMoneyFullyDiluted: number;
  holders: RoundModelHolder[];
  /** The new investor's resulting stake. */
  investorPct: number;
  warnings: string[];
}

export interface WaterfallPayout {
  stakeholderId: string;
  name: string;
  /** Paid out on liquidation preference. */
  preference: number;
  /** Paid out by participating in the residual. */
  participation: number;
  /** Proceeds from exercising in-the-money options, net of strike paid. */
  optionProceeds: number;
  total: number;
  pctOfExit: number;
  /** Multiple on invested capital. Null where nothing was invested (e.g. founder IP). */
  multiple: number | null;
}

export interface WaterfallResult {
  exitValue: number;
  payouts: WaterfallPayout[];
  /** Classes that elected to convert to common because it paid better. */
  convertedClassIds: string[];
  totalPreferences: number;
  residual: number;
  /** Aggregate strike paid by option holders, added to the distributable pot. */
  optionExerciseProceeds: number;
  /** True when the loop hit its iteration cap without settling. Shown in the UI. */
  didNotConverge: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Narrowing helpers. `records.filter(isKind('issuance'))` keeps the union tidy.
// ---------------------------------------------------------------------------

type RecordOfKind<K extends EquityKind> = Extract<EquityRecord, { kind: K }>;

export function isKind<K extends EquityKind>(kind: K) {
  return (r: EquityRecord): r is RecordOfKind<K> => r.kind === kind;
}
