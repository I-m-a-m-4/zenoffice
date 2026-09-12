/**
 * Cap table math.
 *
 * Pure: no Firestore, no React, no clock of its own — every function that
 * depends on "now" takes an `asOf` date. That is what makes this reviewable and
 * testable in isolation, which matters more here than usual, because
 * `next.config.ts` sets `typescript.ignoreBuildErrors: true` and the repo's tsc
 * baseline is ~171 pre-existing errors. The compiler will not catch a mistake in
 * this file. A wrong ownership percentage looks entirely plausible.
 *
 * Two rules hold throughout:
 *
 * - **Share counts are integers.** Every derived count is floored. Fractional
 *   shares do not exist, and allowing them makes ownership percentages that fail
 *   to sum to 100.
 * - **Percentages are derived, never accumulated.** Each percentage is computed
 *   from integer counts against a single denominator, so a rounding error in one
 *   row cannot propagate into the next.
 * - **`invested` means cash in, not shares × price.** Shares issued for IP or
 *   for services are issued at par so the certificate has a price, but no money
 *   changed hands. Counting par value as investment tells the founder who built
 *   the company from nothing that they put in ₦1,000, and it hands them a
 *   liquidation preference they never paid for. See `investedCash`.
 */

import { differenceInCalendarMonths } from 'date-fns';
import type {
  CapTableSummary,
  ClassPosition,
  ClassSummary,
  Consideration,
  Convertible,
  DateLike,
  EquityRecord,
  FundingRound,
  HolderRow,
  InvestmentOffer,
  Issuance,
  OptionGrant,
  RevenueInputs,
  RevenueValuation,
  RoundModel,
  RoundModelHolder,
  ShareClass,
  Stakeholder,
  Valuation,
  VestingTerms,
  WaterfallPayout,
  WaterfallResult,
} from './types';
import { isKind } from './types';

/** Guard against a pathological input spinning the waterfall's convergence loop forever. */
const MAX_WATERFALL_ITERATIONS = 50;

/**
 * Considerations that actually moved money into the company.
 *
 * `conversion` counts: a SAFE or note converting to shares represents cash that
 * came in earlier, at the point the instrument was signed. `ip` and `services`
 * do not — those shares are paid for with work, and the par value on the
 * certificate is a legal formality, not a cheque.
 */
const CASH_CONSIDERATIONS = new Set<Consideration>(['cash', 'conversion']);

/**
 * Cash paid for an issuance. Zero where the consideration was not money.
 *
 * Records written before `consideration` existed are treated as cash, which
 * preserves their previous value; the founding issuance is explicitly `ip`
 * (see `seedFoundingCapTable`) so it correctly contributes nothing.
 */
function investedCash(iss: Issuance, shares: number): number {
  const consideration: Consideration = iss.consideration ?? 'cash';
  return CASH_CONSIDERATIONS.has(consideration) ? shares * num(iss.pricePerShare) : 0;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Accepts a Date, a Firestore Timestamp, an ISO string or epoch millis. */
export function toDate(input: DateLike): Date | null {
  if (input === null || input === undefined) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number' || typeof input === 'string') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof (input as { toDate?: unknown }).toDate === 'function') {
    try {
      const d = (input as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  return null;
}

/** Coerce to a finite number. Firestore will happily hand back undefined for a missing field. */
function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Share counts are integers, and never negative. */
function intShares(value: unknown): number {
  return Math.max(0, Math.floor(num(value)));
}

/** Percent of a total, guarding the zero denominator that an empty cap table produces. */
function pct(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}

// ---------------------------------------------------------------------------
// Vesting
// ---------------------------------------------------------------------------

/**
 * Shares vested under a cliff-then-monthly schedule as of a given date.
 *
 * Nothing vests before the cliff; at the cliff the whole elapsed portion vests
 * at once; thereafter it accrues monthly. A 48-month schedule with a 12-month
 * cliff therefore vests exactly 25% on the first anniversary, not 1/48th.
 *
 * Months are counted as whole calendar months, which is how grant agreements
 * are actually written — a grant dated the 15th vests on the 15th.
 */
export function vestedShares(
  vesting: VestingTerms | null | undefined,
  quantity: number,
  asOf: Date,
): number {
  const total = intShares(quantity);
  // No schedule means the shares were never subject to vesting — fully owned.
  if (!vesting) return total;

  const start = toDate(vesting.startDate);
  if (!start) return total;

  const totalMonths = Math.max(0, Math.floor(num(vesting.totalMonths)));
  const cliffMonths = Math.max(0, Math.floor(num(vesting.cliffMonths)));

  // A zero-length schedule is fully vested, not a division by zero.
  if (totalMonths <= 0) return total;

  const elapsed = differenceInCalendarMonths(asOf, start);
  if (elapsed < cliffMonths) return 0;
  if (elapsed >= totalMonths) return total;

  return Math.min(total, Math.floor((total * elapsed) / totalMonths));
}

/** Convenience for the UI: how far through a schedule we are, 0-100. */
export function vestedPercent(
  vesting: VestingTerms | null | undefined,
  quantity: number,
  asOf: Date,
): number {
  const q = intShares(quantity);
  if (!q) return 0;
  return pct(vestedShares(vesting, q, asOf), q);
}

// ---------------------------------------------------------------------------
// Convertible instruments
// ---------------------------------------------------------------------------

/**
 * Simple interest accrued on a convertible note, as of a date.
 *
 * SAFEs carry no interest; their rate is 0, so this returns the bare principal.
 */
export function accruedAmount(c: Convertible, asOf: Date): number {
  const principal = num(c.principal);
  const rate = num(c.interestRate);
  if (rate <= 0) return principal;

  const issued = toDate(c.issueDate);
  if (!issued) return principal;

  const years = Math.max(0, (asOf.getTime() - issued.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return principal + principal * (rate / 100) * years;
}

/**
 * Shares a SAFE or note converts into at a priced round.
 *
 * The holder converts at the *better* of two prices:
 *   - the discount price: the round price less their discount
 *   - the cap price: the valuation cap spread over the share base
 *
 * "Better" means cheaper, so `min`. An instrument with only one of the two set
 * uses that one; with neither, it converts at the round price itself.
 *
 * Pre- vs post-money is the subtle part. A pre-money SAFE's cap divides by the
 * pre-money fully-diluted count, so the SAFE holder is diluted by other SAFEs
 * converting alongside them. A post-money SAFE fixes the holder's percentage of
 * the post-money company, so its cap must divide by a base that already includes
 * the shares the SAFE itself creates. That is self-referential, and solving it
 * gives:
 *
 *     shares = base x amount / (cap - amount)
 *
 * which is what the post-money branch computes directly rather than iterating.
 */
export function convertibleAsConverted(
  c: Convertible,
  roundPricePerShare: number,
  preMoneyFdShares: number,
  asOf: Date,
): number {
  const amount = accruedAmount(c, asOf);
  if (amount <= 0) return 0;

  const roundPps = num(roundPricePerShare);
  const cap = c.valuationCap === null ? null : num(c.valuationCap);
  const discount = c.discountPercent === null ? null : num(c.discountPercent);

  const candidatePrices: number[] = [];

  if (discount !== null && discount > 0 && roundPps > 0) {
    candidatePrices.push(roundPps * (1 - discount / 100));
  }

  if (cap !== null && cap > 0 && preMoneyFdShares > 0) {
    if (c.safeType === 'post') {
      // Post-money: the cap is a ceiling on the post-money valuation, so the
      // holder's shares must be counted in the denominator. Solved closed-form.
      // Guard the degenerate case where the investment meets or exceeds the cap —
      // that would mean owning 100% or more, which is a data error, not a price.
      if (amount < cap) {
        const impliedShares = (preMoneyFdShares * amount) / (cap - amount);
        if (impliedShares > 0) candidatePrices.push(amount / impliedShares);
      }
    } else {
      candidatePrices.push(cap / preMoneyFdShares);
    }
  }

  // No cap and no discount: the instrument converts at the round price like any
  // other investor. Not typical, but it is a legal instrument and must not divide by zero.
  if (candidatePrices.length === 0) {
    if (roundPps <= 0) return 0;
    candidatePrices.push(roundPps);
  }

  const conversionPrice = Math.min(...candidatePrices.filter((p) => p > 0));
  if (!Number.isFinite(conversionPrice) || conversionPrice <= 0) return 0;

  return Math.floor(amount / conversionPrice);
}

// ---------------------------------------------------------------------------
// Building the cap table
// ---------------------------------------------------------------------------

interface Indexed {
  settings: Extract<EquityRecord, { kind: 'settings' }> | null;
  classes: ShareClass[];
  stakeholders: Stakeholder[];
  issuances: Issuance[];
  transfers: Extract<EquityRecord, { kind: 'transfer' }>[];
  cancellations: Extract<EquityRecord, { kind: 'cancellation' }>[];
  rounds: FundingRound[];
  convertibles: Convertible[];
  pool: Extract<EquityRecord, { kind: 'poolReservation' }>[];
  grants: OptionGrant[];
  valuations: Valuation[];
}

function index(records: EquityRecord[]): Indexed {
  return {
    settings: records.find(isKind('settings')) ?? null,
    classes: records.filter(isKind('shareClass')),
    stakeholders: records.filter(isKind('stakeholder')),
    issuances: records.filter(isKind('issuance')),
    transfers: records.filter(isKind('transfer')),
    cancellations: records.filter(isKind('cancellation')),
    rounds: records.filter(isKind('round')),
    convertibles: records.filter(isKind('convertible')),
    pool: records.filter(isKind('poolReservation')),
    grants: records.filter(isKind('optionGrant')),
    valuations: records.filter(isKind('valuation')),
  };
}

/** The newest valuation on or before `asOf`. */
function currentValuation(valuations: Valuation[], asOf: Date): Valuation | null {
  const dated = valuations
    .map((v) => ({ v, d: toDate(v.asOfDate) }))
    .filter((x): x is { v: Valuation; d: Date } => x.d !== null && x.d.getTime() <= asOf.getTime())
    .sort((a, b) => b.d.getTime() - a.d.getTime());
  return dated.length ? dated[0].v : null;
}

/** The most recent closed round, by close date. Sets the reference price per share. */
function lastClosedRound(rounds: FundingRound[]): FundingRound | null {
  const closed = rounds
    .filter((r) => r.status === 'closed')
    .map((r) => ({ r, d: toDate(r.closeDate) }))
    .filter((x): x is { r: FundingRound; d: Date } => x.d !== null)
    .sort((a, b) => b.d.getTime() - a.d.getTime());
  return closed.length ? closed[0].r : null;
}

/** Options still live: granted, not yet exercised, not cancelled. */
function outstandingOptionShares(g: OptionGrant): number {
  return Math.max(0, intShares(g.shares) - intShares(g.exercised) - intShares(g.cancelled));
}

/**
 * Build the whole cap table as of a date.
 *
 * Positions net out as: issuances - transfers out + transfers in - cancellations.
 * Only records dated on or before `asOf` count, so the same function serves the
 * "what did it look like at the last round" view without a second code path.
 */
export function buildCapTable(records: EquityRecord[], asOf: Date = new Date()): CapTableSummary {
  const ix = index(records);
  const warnings: string[] = [];

  const classById = new Map(ix.classes.map((c) => [c.id, c]));
  const stakeholderById = new Map(ix.stakeholders.map((s) => [s.id, s]));

  /** Records dated after `asOf` are in the future and do not count yet. */
  const onOrBefore = (d: DateLike): boolean => {
    const parsed = toDate(d);
    if (!parsed) return true; // undated records are treated as already in effect
    return parsed.getTime() <= asOf.getTime();
  };

  // position key is `${stakeholderId}::${shareClassId}`
  const positions = new Map<string, { shares: number; invested: number; vested: number }>();
  const bump = (
    stakeholderId: string,
    shareClassId: string,
    deltaShares: number,
    deltaInvested = 0,
    deltaVested = 0,
  ) => {
    const key = `${stakeholderId}::${shareClassId}`;
    const cur = positions.get(key) ?? { shares: 0, invested: 0, vested: 0 };
    cur.shares += deltaShares;
    cur.invested += deltaInvested;
    cur.vested += deltaVested;
    positions.set(key, cur);
  };

  // --- issuances -----------------------------------------------------------
  // Tracks how each holder paid, so the UI can say "issued for IP" where the
  // Invested column is empty. Without this the founder row is a bare dash and
  // reads as missing data rather than as the fact that no cash was ever due.
  const considerationsByHolder = new Map<string, Set<Consideration>>();

  for (const iss of ix.issuances) {
    if (!onOrBefore(iss.issueDate)) continue;
    if (!classById.has(iss.shareClassId)) {
      warnings.push(`An issuance references a share class that no longer exists.`);
      continue;
    }
    if (!stakeholderById.has(iss.stakeholderId)) {
      warnings.push(`An issuance references a stakeholder that no longer exists.`);
      continue;
    }
    const s = intShares(iss.shares);
    bump(
      iss.stakeholderId,
      iss.shareClassId,
      s,
      investedCash(iss, s),
      vestedShares(iss.vesting, s, asOf),
    );
    if (s > 0) {
      const seen = considerationsByHolder.get(iss.stakeholderId) ?? new Set<Consideration>();
      seen.add(iss.consideration ?? 'cash');
      considerationsByHolder.set(iss.stakeholderId, seen);
    }
  }

  // --- transfers -----------------------------------------------------------
  // A transfer moves shares without changing the total. Invested cost carries
  // with the shares at the original per-share cost, so the receiving holder's
  // liquidation preference base is right; without this, a secondary sale would
  // silently erase the preference attached to those shares.
  for (const t of ix.transfers) {
    if (!onOrBefore(t.date)) continue;
    const s = intShares(t.shares);
    if (!s) continue;

    const fromKey = `${t.fromStakeholderId}::${t.shareClassId}`;
    const from = positions.get(fromKey);
    const costPerShare = from && from.shares > 0 ? from.invested / from.shares : num(t.pricePerShare);

    bump(t.fromStakeholderId, t.shareClassId, -s, -s * costPerShare, 0);
    bump(t.toStakeholderId, t.shareClassId, s, s * costPerShare, s);
  }

  // --- cancellations -------------------------------------------------------
  for (const c of ix.cancellations) {
    if (!onOrBefore(c.date)) continue;
    const s = intShares(c.shares);
    if (!s) continue;

    const key = `${c.stakeholderId}::${c.shareClassId}`;
    const cur = positions.get(key);
    const costPerShare = cur && cur.shares > 0 ? cur.invested / cur.shares : 0;
    bump(c.stakeholderId, c.shareClassId, -s, -s * costPerShare, -s);
  }

  // --- options and pool ----------------------------------------------------
  const optionSharesByHolder = new Map<string, number>();
  let optionsOutstanding = 0;
  let optionsGrantedEver = 0;
  let optionsReturned = 0;

  for (const g of ix.grants) {
    if (!onOrBefore(g.grantDate)) continue;
    const live = outstandingOptionShares(g);
    optionsOutstanding += live;
    optionsGrantedEver += intShares(g.shares);
    optionsReturned += intShares(g.cancelled);
    if (live > 0) {
      optionSharesByHolder.set(
        g.stakeholderId,
        (optionSharesByHolder.get(g.stakeholderId) ?? 0) + live,
      );
    }
  }

  const poolReserved = ix.pool
    .filter((p) => onOrBefore(p.date))
    .reduce((sum, p) => sum + intShares(p.shares), 0);

  // Granted-and-then-cancelled options go back to the pool and can be regranted.
  const poolUnallocated = Math.max(0, poolReserved - optionsGrantedEver + optionsReturned);
  if (poolReserved > 0 && optionsGrantedEver - optionsReturned > poolReserved) {
    warnings.push(
      `Option grants exceed the reserved pool by ${(
        optionsGrantedEver - optionsReturned - poolReserved
      ).toLocaleString()} shares.`,
    );
  }

  // --- totals so far -------------------------------------------------------
  let outstandingShares = 0;
  for (const [, p] of positions) outstandingShares += Math.max(0, p.shares);

  // --- convertibles (estimate) --------------------------------------------
  // A SAFE has no share count until it converts. We estimate at the last closed
  // round's price so the fully-diluted column is not silently understated — but
  // the UI labels it an estimate, because it is one.
  const lastRound = lastClosedRound(ix.rounds);
  const lastRoundPps = lastRound ? num(lastRound.pricePerShare) : null;

  const convertibleSharesByHolder = new Map<string, number>();
  let convertiblesAsConverted = 0;

  if (lastRoundPps && lastRoundPps > 0) {
    // Base for cap pricing is the pre-money fully-diluted count: issued shares
    // plus the option pool, excluding the convertibles themselves.
    const preMoneyFd = outstandingShares + optionsOutstanding + poolUnallocated;
    for (const c of ix.convertibles) {
      if (c.status !== 'outstanding') continue;
      if (!onOrBefore(c.issueDate)) continue;
      const s = convertibleAsConverted(c, lastRoundPps, preMoneyFd, asOf);
      if (s > 0) {
        convertiblesAsConverted += s;
        convertibleSharesByHolder.set(
          c.stakeholderId,
          (convertibleSharesByHolder.get(c.stakeholderId) ?? 0) + s,
        );
      }
    }
  } else if (ix.convertibles.some((c) => c.status === 'outstanding')) {
    warnings.push(
      'Outstanding SAFEs or notes cannot be priced until a round closes, so they are excluded from fully-diluted totals.',
    );
  }

  const fullyDilutedShares =
    outstandingShares + optionsOutstanding + poolUnallocated + convertiblesAsConverted;

  // --- votes ---------------------------------------------------------------
  let totalVotes = 0;
  for (const [key, p] of positions) {
    const [, shareClassId] = key.split('::');
    const cls = classById.get(shareClassId);
    if (!cls) continue;
    totalVotes += Math.max(0, p.shares) * num(cls.votesPerShare, 1);
  }

  // --- holder rows ---------------------------------------------------------
  const holderIds = new Set<string>([
    ...ix.stakeholders.map((s) => s.id),
    ...optionSharesByHolder.keys(),
    ...convertibleSharesByHolder.keys(),
  ]);

  const holders: HolderRow[] = [];
  for (const id of holderIds) {
    const sh = stakeholderById.get(id);
    const holderPositions: ClassPosition[] = [];
    let outstanding = 0;
    let invested = 0;
    let votes = 0;

    for (const cls of ix.classes) {
      const p = positions.get(`${id}::${cls.id}`);
      if (!p || p.shares <= 0) continue;
      const heldShares = Math.floor(p.shares);
      holderPositions.push({
        shareClassId: cls.id,
        shareClassName: cls.name,
        shares: heldShares,
        invested: p.invested,
        // Clamped to what is actually held. A transfer moves shares out without
        // reducing the sender's vested tally, so an unclamped figure lets a
        // holder show more vested shares than they own after a secondary sale.
        vested: Math.min(heldShares, Math.max(0, Math.floor(p.vested))),
      });
      outstanding += heldShares;
      invested += p.invested;
      votes += heldShares * num(cls.votesPerShare, 1);
    }

    const optionShares = optionSharesByHolder.get(id) ?? 0;
    const convertibleShares = convertibleSharesByHolder.get(id) ?? 0;

    // Drop stakeholders holding nothing at all, so a deleted-down-to-zero holder
    // does not clutter the table with a row of zeroes.
    if (outstanding === 0 && optionShares === 0 && convertibleShares === 0) continue;

    holders.push({
      stakeholderId: id,
      name: sh?.name ?? 'Unknown holder',
      entityType: sh?.entityType ?? 'individual',
      isFounder: Boolean(sh?.isFounder),
      positions: holderPositions,
      outstandingShares: outstanding,
      optionShares,
      convertibleShares,
      fullyDilutedShares: outstanding + optionShares + convertibleShares,
      invested,
      // Only the non-cash ones: this exists to explain an empty Invested cell,
      // and 'cash' never needs explaining.
      nonCashConsiderations: [...(considerationsByHolder.get(id) ?? [])]
        .filter((c) => !CASH_CONSIDERATIONS.has(c))
        .sort(),
      votes,
      pctOutstanding: pct(outstanding, outstandingShares),
      pctFullyDiluted: pct(outstanding + optionShares + convertibleShares, fullyDilutedShares),
      pctVotes: pct(votes, totalVotes),
    });
  }

  holders.sort((a, b) => b.fullyDilutedShares - a.fullyDilutedShares || a.name.localeCompare(b.name));

  // --- class summaries -----------------------------------------------------
  const classes: ClassSummary[] = ix.classes.map((cls) => {
    let issued = 0;
    let invested = 0;
    for (const [key, p] of positions) {
      const [, shareClassId] = key.split('::');
      if (shareClassId !== cls.id) continue;
      issued += Math.max(0, Math.floor(p.shares));
      invested += Math.max(0, p.invested);
    }
    const authorized = intShares(cls.authorizedShares);
    if (authorized > 0 && issued > authorized) {
      warnings.push(
        `${cls.name}: ${issued.toLocaleString()} shares issued against ${authorized.toLocaleString()} authorised.`,
      );
    }
    return {
      shareClassId: cls.id,
      name: cls.name,
      classType: cls.classType,
      authorizedShares: authorized,
      issuedShares: issued,
      availableShares: authorized - issued,
      invested,
      seniorityRank: num(cls.seniorityRank),
      liquidationMultiple: num(cls.liquidationMultiple, 1),
      participating: Boolean(cls.participating),
      participationCapMultiple: cls.participationCapMultiple ?? null,
    };
  });

  classes.sort((a, b) => b.seniorityRank - a.seniorityRank || a.name.localeCompare(b.name));

  const totalInvested = holders.reduce((sum, h) => sum + h.invested, 0);

  const valuationView = resolveValuation(
    ix.valuations,
    asOf,
    fullyDilutedShares,
    lastRoundPps,
    warnings,
  );

  return {
    asOf,
    currency: ix.settings?.currency || 'NGN',
    companyLegalName: ix.settings?.companyLegalName || 'Zeneva',
    holders,
    classes,
    outstandingShares,
    optionsOutstanding,
    poolReserved,
    poolUnallocated,
    convertiblesAsConverted,
    fullyDilutedShares,
    totalInvested,
    totalVotes,
    lastRoundPps,
    lastRoundName: lastRound?.name ?? null,
    impliedValuation: lastRoundPps ? lastRoundPps * fullyDilutedShares : null,
    ...valuationView,
    // Duplicate warnings are noise — the same orphan reference fires per record.
    warnings: Array.from(new Set(warnings)),
  };
}

/**
 * Resolve the valuation in force and the resulting share price.
 *
 * Precedence: an explicit `valuation` record wins over a closed round, even an
 * older one. A round is evidence of what someone paid *then*; a valuation record
 * is the owner's current position. If the round is genuinely still the best
 * number, recording it as a `priced_round` valuation says so deliberately.
 */
function resolveValuation(
  valuations: Valuation[],
  asOf: Date,
  fullyDilutedShares: number,
  lastRoundPps: number | null,
  warnings: string[],
): Pick<
  CapTableSummary,
  | 'currentValuation'
  | 'currentValuationMethod'
  | 'currentValuationBasis'
  | 'currentValuationDate'
  | 'pricePerShare'
  | 'floorPricePerShare'
> {
  const v = currentValuation(valuations, asOf);

  if (v) {
    const amount = num(v.amount, 0);
    const pps = fullyDilutedShares > 0 && amount > 0 ? amount / fullyDilutedShares : null;
    const asOfDate = toDate(v.asOfDate);

    // A valuation goes stale. Six months is the conventional refresh cadence for
    // an early-stage company, and a stale number is how equity gets undersold.
    if (asOfDate) {
      const monthsOld = differenceInCalendarMonths(asOf, asOfDate);
      if (monthsOld >= 12) {
        warnings.push(
          `The valuation is ${monthsOld} months old. Anything you price off it is probably wrong by now.`,
        );
      }
    }

    return {
      currentValuation: amount > 0 ? amount : null,
      currentValuationMethod: v.method ?? null,
      currentValuationBasis: v.basis?.trim() || null,
      currentValuationDate: asOfDate,
      pricePerShare: pps,
      floorPricePerShare: num(v.floorPricePerShare, 0) > 0 ? num(v.floorPricePerShare, 0) : null,
    };
  }

  // Fall back to the last priced round.
  if (lastRoundPps && lastRoundPps > 0) {
    return {
      currentValuation: lastRoundPps * fullyDilutedShares,
      currentValuationMethod: 'priced_round',
      currentValuationBasis: null,
      currentValuationDate: null,
      pricePerShare: lastRoundPps,
      floorPricePerShare: null,
    };
  }

  return {
    currentValuation: null,
    currentValuationMethod: null,
    currentValuationBasis: null,
    currentValuationDate: null,
    pricePerShare: null,
    floorPricePerShare: null,
  };
}

// ---------------------------------------------------------------------------
// Round modelling
// ---------------------------------------------------------------------------

export interface RoundModelParams {
  preMoneyValuation: number;
  amountRaised: number;
  /**
   * Target option pool as a percent of the POST-money fully-diluted count.
   *
   * Set this and the top-up is carved out of the pre-money share base, which
   * means the existing holders absorb the dilution rather than the new investor.
   * That is the standard term, and the thing founders most often get wrong.
   */
  targetPoolPercent?: number;
  /** Convert outstanding SAFEs and notes at this round. Normally true. */
  convertInstruments?: boolean;
}

/**
 * Model a priced round: what it costs the existing holders.
 *
 * The order of operations is the whole game. Price per share is set against the
 * pre-money share base *including* the new option pool and *including* the
 * shares that converting SAFEs will create — so the new money buys its
 * percentage of a company that already reflects those, and the existing holders
 * carry that dilution. Compute it in a different order and the founder's
 * post-round percentage comes out flatteringly, and wrongly, high.
 */
export function modelRound(
  records: EquityRecord[],
  params: RoundModelParams,
  asOf: Date = new Date(),
): RoundModel {
  const before = buildCapTable(records, asOf);
  const warnings: string[] = [];

  const preMoney = Math.max(0, num(params.preMoneyValuation));
  const raised = Math.max(0, num(params.amountRaised));
  const convertInstruments = params.convertInstruments !== false;

  // Base: issued + options + unallocated pool. Excludes convertibles, which are
  // priced by this round rather than being an input to it.
  const baseFd = before.outstandingShares + before.optionsOutstanding + before.poolUnallocated;

  if (preMoney <= 0 || baseFd <= 0) {
    return {
      pricePerShare: 0,
      newShares: 0,
      preMoneyValuation: preMoney,
      postMoneyValuation: preMoney + raised,
      amountRaised: raised,
      poolTopUpShares: 0,
      convertedShares: 0,
      preMoneyFullyDiluted: baseFd,
      postMoneyFullyDiluted: baseFd,
      holders: [],
      investorPct: 0,
      warnings: ['Set a pre-money valuation and issue some shares before modelling a round.'],
    };
  }

  const ix = index(records);
  const outstandingConvertibles = ix.convertibles.filter((c) => c.status === 'outstanding');

  // The pool top-up, the SAFE conversion and the price per share are mutually
  // dependent: the pool is sized off post-money, the SAFE cap prices off
  // pre-money, and the price divides by a base that includes both. Iterating a
  // handful of times settles it — each pass feeds the previous pass's share
  // base back in, and it converges quickly because each term is monotonic.
  let pps = preMoney / baseFd;
  let poolTopUp = 0;
  let convertedShares = 0;
  let newShares = Math.floor(raised / pps);

  for (let i = 0; i < 12; i += 1) {
    const preMoneyBase = baseFd + poolTopUp;

    convertedShares = 0;
    if (convertInstruments) {
      for (const c of outstandingConvertibles) {
        convertedShares += convertibleAsConverted(c, pps, preMoneyBase, asOf);
      }
    }

    // Price is set against everything that exists pre-money, including the
    // top-up and the converting instruments.
    const pricingBase = preMoneyBase + convertedShares;
    const nextPps = preMoney / pricingBase;
    const nextNewShares = Math.floor(raised / nextPps);

    let nextPoolTopUp = poolTopUp;
    if (params.targetPoolPercent && params.targetPoolPercent > 0) {
      const target = params.targetPoolPercent / 100;
      // Pool is `target` of post-money FD. Solving for the top-up:
      //   (existingUnallocated + x) = target * (pricingBase + newShares + x)
      const postExcludingTopUp = baseFd + convertedShares + nextNewShares;
      const solved =
        (target * postExcludingTopUp - before.poolUnallocated) / (1 - target);
      nextPoolTopUp = Math.max(0, Math.floor(solved));
    }

    const settled =
      Math.abs(nextPps - pps) < 1e-9 &&
      nextNewShares === newShares &&
      nextPoolTopUp === poolTopUp;

    pps = nextPps;
    newShares = nextNewShares;
    poolTopUp = nextPoolTopUp;

    if (settled) break;
  }

  const preMoneyFullyDiluted = baseFd + poolTopUp + convertedShares;
  const postMoneyFullyDiluted = preMoneyFullyDiluted + newShares;

  if (convertInstruments && outstandingConvertibles.length > 0 && convertedShares === 0) {
    warnings.push('Outstanding instruments produced no shares — check their caps and discounts.');
  }

  // Existing holders keep their share count; only the denominator moves.
  const holders: RoundModelHolder[] = before.holders.map((h) => {
    const sharesBefore = h.outstandingShares + h.optionShares;
    const pctBefore = pct(h.fullyDilutedShares, before.fullyDilutedShares);
    const pctAfter = pct(sharesBefore, postMoneyFullyDiluted);
    return {
      stakeholderId: h.stakeholderId,
      name: h.name,
      pctBefore,
      pctAfter,
      delta: pctAfter - pctBefore,
      sharesBefore,
      sharesAfter: sharesBefore,
    };
  });

  return {
    pricePerShare: pps,
    newShares,
    preMoneyValuation: preMoney,
    postMoneyValuation: preMoney + raised,
    amountRaised: raised,
    poolTopUpShares: poolTopUp,
    convertedShares,
    preMoneyFullyDiluted,
    postMoneyFullyDiluted,
    holders,
    investorPct: pct(newShares, postMoneyFullyDiluted),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// What does this cheque buy?
// ---------------------------------------------------------------------------

/**
 * Price a proposed investment against a valuation.
 *
 * The inverse of `modelRound`. That function asks "given these terms, what
 * happens"; this one asks "someone offers me this much — what do they get, and
 * should I take it".
 *
 * The arithmetic is deliberately blunt, because the trap it exists to catch is
 * blunt: at a low valuation a small cheque buys a large share of the company,
 * and equity sold cheap cannot be bought back. ₦100,000 against a ₦10,000,000
 * valuation is one percent. The same ₦100,000 against a ₦500,000 valuation is
 * twenty percent, permanently.
 */
export function investmentOffer(
  summary: CapTableSummary,
  amount: number,
  valuationOverride?: number | null,
): InvestmentOffer | null {
  const valuation = num(valuationOverride, 0) > 0 ? num(valuationOverride) : summary.currentValuation;
  const cheque = num(amount, 0);

  // With no valuation there is no price, and guessing one here would be worse
  // than saying so — the UI prompts for one instead.
  if (!valuation || valuation <= 0 || cheque <= 0) return null;

  const fd = summary.fullyDilutedShares;
  if (fd <= 0) return null;

  const pricePerShare = valuation / fd;
  const sharesIssued = Math.floor(cheque / pricePerShare);
  const postFd = fd + sharesIssued;

  const investorPct = postFd > 0 ? (sharesIssued / postFd) * 100 : 0;
  const founderPctAfter = postFd > 0 ? (fd / postFd) * 100 : 0;

  const warnings: string[] = [];
  const floor = summary.floorPricePerShare;
  const belowFloor = floor != null && pricePerShare < floor;

  if (belowFloor) {
    warnings.push(
      `This prices shares at ${pricePerShare.toFixed(4)}, below your floor of ${floor!.toFixed(4)}. ` +
        `To hold the floor you would need a valuation of at least ${Math.ceil(floor! * fd)}.`,
    );
  }

  // The headline check. A double-digit stake for a small cheque is the shape of
  // a deal an early founder regrets, so it gets named rather than left to be
  // inferred from a percentage.
  if (investorPct >= 20) {
    warnings.push(
      `${investorPct.toFixed(2)}% for this cheque is a large stake to give up. ` +
        `Founders usually keep well above 50% until a proper priced round.`,
    );
  } else if (investorPct >= 10) {
    warnings.push(
      `${investorPct.toFixed(2)}% is a meaningful stake. Worth checking the valuation is one you can defend.`,
    );
  }

  if (summary.currentValuationMethod === 'founder_estimate' && !valuationOverride) {
    warnings.push(
      'This valuation is your own estimate, not a number the market has tested. ' +
        'It is fine for planning; be ready to justify it to an investor.',
    );
  }

  return {
    amount: cheque,
    valuation,
    pricePerShare,
    sharesIssued,
    investorPct,
    founderPctAfter,
    postMoneyValuation: valuation + cheque,
    belowFloor,
    warnings,
  };
}

/**
 * The reverse question: to sell `pct` of the company for `amount`, what
 * valuation does that imply? Used by the calculator so the owner can work from
 * the stake they are willing to part with rather than from a valuation.
 */
export function valuationForStake(amount: number, pct: number): number | null {
  const a = num(amount, 0);
  const p = num(pct, 0);
  if (a <= 0 || p <= 0 || p >= 100) return null;
  // amount / postMoney = pct  =>  postMoney = amount / pct; preMoney = postMoney - amount
  const postMoney = a / (p / 100);
  return postMoney - a;
}

/**
 * Sensible bounds for an early-stage SaaS ARR multiple.
 *
 * Public SaaS trades at roughly 5-10x ARR; private early-stage deals land wider,
 * and African SaaS generally prices below US comparables. Outside this band the
 * number is not wrong so much as undefendable, which is what the warning says.
 */
const ARR_MULTIPLE_FLOOR = 1;
const ARR_MULTIPLE_CEILING = 15;
export const DEFAULT_ARR_MULTIPLE = 5;

/**
 * Value the company from what it actually earns.
 *
 * The question this answers is "we have real revenue now — what is that worth",
 * and the trap it exists to avoid is answering it with the revenue figure
 * itself. Cumulative revenue is money that has already been spent or banked; it
 * is a record of the past, not a price for the future. What an investor prices
 * is the **run rate** — the annualised value of the subscriptions currently
 * active — against a multiple.
 *
 * So: `valuation = (MRR x 12) x multiple + cash raised`.
 *
 * Cash raised is added rather than folded into the multiple because it is an
 * asset the company holds outright, and because keeping it separate means
 * raising money visibly moves the valuation without pretending the operating
 * business grew.
 */
export function revenueValuation(
  inputs: RevenueInputs,
  multiple: number,
  fullyDilutedShares: number,
): RevenueValuation {
  const mrr = Math.max(0, num(inputs.mrr));
  const m = Math.max(0, num(multiple));
  const capitalRaised = Math.max(0, num(inputs.capitalRaised));

  const arr = mrr * 12;
  const enterpriseValue = arr * m;
  const valuation = enterpriseValue + capitalRaised;
  const shares = intShares(fullyDilutedShares);

  const warnings: string[] = [];

  if (mrr <= 0) {
    warnings.push(
      inputs.lifetimeRevenue > 0
        ? 'No subscription is currently active, so the run rate is zero. Revenue you have already collected does not carry forward into a valuation — this method has nothing to price until there is a live subscription.'
        : 'There is no recurring revenue yet, so this method cannot produce a figure. Until then any valuation is a founder estimate.',
    );
  }

  if (inputs.payingCustomers > 0 && inputs.payingCustomers < 5) {
    warnings.push(
      `The whole run rate rests on ${inputs.payingCustomers} paying ${
        inputs.payingCustomers === 1 ? 'customer' : 'customers'
      }. One cancellation moves this valuation a long way, and an investor will discount it heavily for that concentration.`,
    );
  }

  if (m > 0 && (m < ARR_MULTIPLE_FLOOR || m > ARR_MULTIPLE_CEILING)) {
    warnings.push(
      `A ${m}x multiple sits outside the ${ARR_MULTIPLE_FLOOR}-${ARR_MULTIPLE_CEILING}x range early-stage SaaS normally trades in. You can argue for it, but be ready to.`,
    );
  }

  if (inputs.lifetimeRevenue > 0 && arr > 0 && inputs.lifetimeRevenue < arr / 4) {
    warnings.push(
      'The run rate is well ahead of what has actually been collected, because it annualises subscriptions that have only just started. That is the normal way to read early growth, but it is a projection.',
    );
  }

  const parts = [
    `MRR ${Math.round(mrr).toLocaleString()} x 12 = ARR ${Math.round(arr).toLocaleString()}`,
    `x ${m} multiple = ${Math.round(enterpriseValue).toLocaleString()}`,
  ];
  if (capitalRaised > 0) {
    parts.push(`+ ${Math.round(capitalRaised).toLocaleString()} raised = ${Math.round(valuation).toLocaleString()}`);
  }
  parts.push(
    `Lifetime revenue collected to date: ${Math.round(inputs.lifetimeRevenue).toLocaleString()} (recorded for context — not part of the valuation)`,
  );

  return {
    arr,
    multiple: m,
    enterpriseValue,
    capitalRaised,
    valuation,
    pricePerShare: shares > 0 && valuation > 0 ? valuation / shares : null,
    basis: `${parts.join('; ')}. As of ${inputs.asOf.toLocaleDateString()}.`,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Exit waterfall
// ---------------------------------------------------------------------------

interface WaterfallClassState {
  cls: ShareClass;
  /** Outstanding shares in this class. */
  shares: number;
  /** Total paid in — the base for the liquidation preference. */
  invested: number;
  /** shares x conversionRatio: what it becomes if it converts to common. */
  asConvertedShares: number;
  /** invested x liquidationMultiple. */
  preferenceDue: number;
  /** Per stakeholder, for attributing the class payout back to people. */
  holders: { stakeholderId: string; shares: number; invested: number }[];
}

/**
 * Who gets what in an exit, at a given sale price.
 *
 * The hard part is that non-participating preferred takes `max(preference,
 * as-converted)` — and whether converting is better depends on whether the
 * *other* classes convert, because each conversion changes the residual and the
 * common share base. So it cannot be computed in a single pass.
 *
 * The algorithm: assume nobody converts, run the distribution, then check each
 * non-participating class to see whether converting would have paid it more. If
 * any would, mark them converted and run again. Each pass can only ever add to
 * the converted set, so it terminates; the iteration cap is a guard against a
 * pathological input, not an expected outcome.
 */
export function exitWaterfall(
  records: EquityRecord[],
  exitValue: number,
  asOf: Date = new Date(),
): WaterfallResult {
  const summary = buildCapTable(records, asOf);
  const ix = index(records);
  const warnings: string[] = [];
  const exit = Math.max(0, num(exitValue));

  const stakeholderById = new Map(ix.stakeholders.map((s) => [s.id, s]));
  const nameFor = (id: string) => stakeholderById.get(id)?.name ?? 'Unknown holder';

  // --- assemble per-class state from the built cap table -------------------
  const classStates: WaterfallClassState[] = [];
  let commonShares = 0;
  const commonHolders: { stakeholderId: string; shares: number; invested: number }[] = [];

  for (const cls of ix.classes) {
    const holders: { stakeholderId: string; shares: number; invested: number }[] = [];
    let shares = 0;
    let invested = 0;

    for (const h of summary.holders) {
      const p = h.positions.find((x) => x.shareClassId === cls.id);
      if (!p || p.shares <= 0) continue;
      holders.push({ stakeholderId: h.stakeholderId, shares: p.shares, invested: p.invested });
      shares += p.shares;
      invested += p.invested;
    }

    if (shares <= 0) continue;

    if (cls.classType === 'common') {
      commonShares += shares;
      commonHolders.push(...holders);
      continue;
    }

    const ratio = num(cls.conversionRatio, 1) || 1;
    classStates.push({
      cls,
      shares,
      invested,
      asConvertedShares: Math.floor(shares * ratio),
      preferenceDue: invested * num(cls.liquidationMultiple, 1),
      holders,
    });
  }

  // --- in-the-money options ------------------------------------------------
  // Only vested options with a strike below the per-share price will exercise.
  // Their strike payment goes into the pot, so it is both a cost to the holder
  // and value to everyone else. Whether an option is in the money depends on the
  // final price, which depends on exercise — so use a first-pass estimate of the
  // common price and hold it fixed. This is the standard simplification and the
  // UI says so rather than hiding it.
  const roughCommonBase =
    commonShares + classStates.reduce((s, c) => s + c.asConvertedShares, 0);
  const roughPerShare = roughCommonBase > 0 ? exit / roughCommonBase : 0;

  const exercisingGrants: { stakeholderId: string; shares: number; strike: number }[] = [];
  let optionExerciseProceeds = 0;

  for (const g of ix.grants) {
    const live = outstandingOptionShares(g);
    if (live <= 0) continue;
    const vested = Math.min(live, vestedShares(g.vesting, g.shares, asOf));
    if (vested <= 0) continue;
    const strike = num(g.strikePrice);
    if (strike >= roughPerShare) continue; // under water — will not exercise
    exercisingGrants.push({ stakeholderId: g.stakeholderId, shares: vested, strike });
    optionExerciseProceeds += vested * strike;
  }

  const optionShares = exercisingGrants.reduce((s, g) => s + g.shares, 0);
  const pot = exit + optionExerciseProceeds;

  // --- the convergence loop ------------------------------------------------
  let converted = new Set<string>();
  let didNotConverge = false;

  interface Distribution {
    preferenceByClass: Map<string, number>;
    participationByClass: Map<string, number>;
    /** Per-share residual paid to the common base. */
    commonPerShare: number;
    totalPreferences: number;
    residual: number;
  }

  const distribute = (convertedSet: Set<string>): Distribution => {
    const preferenceByClass = new Map<string, number>();
    const participationByClass = new Map<string, number>();
    let remaining = pot;
    let totalPreferences = 0;

    // 1. Liquidation preferences, most senior first. Converted classes have
    //    given up their preference in exchange for common treatment.
    const unconverted = classStates.filter((c) => !convertedSet.has(c.cls.id));
    const ranks = Array.from(new Set(unconverted.map((c) => num(c.cls.seniorityRank)))).sort(
      (a, b) => b - a,
    );

    for (const rank of ranks) {
      const group = unconverted.filter((c) => num(c.cls.seniorityRank) === rank);
      const due = group.reduce((s, c) => s + c.preferenceDue, 0);
      if (due <= 0) continue;

      // Short funds are split pro rata by amount due within the rank — seniority
      // is between ranks, equality within one.
      const paid = Math.min(due, remaining);
      for (const c of group) {
        const share = due > 0 ? (c.preferenceDue / due) * paid : 0;
        preferenceByClass.set(c.cls.id, share);
      }
      totalPreferences += paid;
      remaining -= paid;
      if (remaining <= 0) break;
    }

    for (const c of unconverted) {
      if (!preferenceByClass.has(c.cls.id)) preferenceByClass.set(c.cls.id, 0);
    }

    // 2. Residual to the as-converted common base: common, converted preferred,
    //    participating preferred, and exercising options.
    const participants: { id: string; shares: number }[] = [
      { id: '__common__', shares: commonShares },
      { id: '__options__', shares: optionShares },
    ];
    for (const c of classStates) {
      const isConverted = convertedSet.has(c.cls.id);
      if (isConverted || c.cls.participating) {
        participants.push({ id: c.cls.id, shares: c.asConvertedShares });
      }
    }

    const baseShares = participants.reduce((s, p) => s + p.shares, 0);
    let residual = Math.max(0, remaining);
    let commonPerShare = baseShares > 0 ? residual / baseShares : 0;

    // 3. Participation caps. A capped participating class stops taking residual
    //    once its total hits cap x invested; the excess flows to everyone else,
    //    which can push another class over its own cap — hence the loop.
    const capped = new Set<string>();
    for (let i = 0; i < classStates.length + 1; i += 1) {
      let changed = false;
      let distributable = residual;
      let uncappedShares = 0;

      for (const p of participants) {
        if (capped.has(p.id)) continue;
        uncappedShares += p.shares;
      }

      // Capped classes take exactly their cap and no more.
      for (const c of classStates) {
        if (!capped.has(c.cls.id)) continue;
        const cap = num(c.cls.participationCapMultiple) * c.invested;
        const pref = preferenceByClass.get(c.cls.id) ?? 0;
        const allowed = Math.max(0, cap - pref);
        participationByClass.set(c.cls.id, allowed);
        distributable -= allowed;
      }

      const perShare = uncappedShares > 0 ? Math.max(0, distributable) / uncappedShares : 0;

      for (const c of classStates) {
        if (capped.has(c.cls.id)) continue;
        const isParticipant = convertedSet.has(c.cls.id) || c.cls.participating;
        if (!isParticipant) {
          participationByClass.set(c.cls.id, 0);
          continue;
        }
        const take = perShare * c.asConvertedShares;
        participationByClass.set(c.cls.id, take);

        // Only a *participating* class has a cap; a converted class is common now.
        const capMultiple = c.cls.participationCapMultiple;
        if (!convertedSet.has(c.cls.id) && capMultiple !== null && capMultiple > 0) {
          const cap = capMultiple * c.invested;
          const pref = preferenceByClass.get(c.cls.id) ?? 0;
          if (pref + take > cap + 1e-6) {
            capped.add(c.cls.id);
            changed = true;
          }
        }
      }

      commonPerShare = perShare;
      if (!changed) break;
    }

    return { preferenceByClass, participationByClass, commonPerShare, totalPreferences, residual };
  };

  let dist = distribute(converted);

  for (let i = 0; i < MAX_WATERFALL_ITERATIONS; i += 1) {
    const next = new Set(converted);
    let changed = false;

    for (const c of classStates) {
      if (converted.has(c.cls.id)) continue;
      // A participating class already shares the residual; converting only ever
      // loses it the preference, so it never elects to convert.
      if (c.cls.participating) continue;

      const currentPayout =
        (dist.preferenceByClass.get(c.cls.id) ?? 0) + (dist.participationByClass.get(c.cls.id) ?? 0);

      // What it would take as common, holding everyone else's election fixed.
      const trial = distribute(new Set([...next, c.cls.id]));
      const convertedPayout = trial.commonPerShare * c.asConvertedShares;

      if (convertedPayout > currentPayout + 1e-6) {
        next.add(c.cls.id);
        changed = true;
      }
    }

    if (!changed) break;
    converted = next;
    dist = distribute(converted);

    if (i === MAX_WATERFALL_ITERATIONS - 1) {
      didNotConverge = true;
      warnings.push('The waterfall did not settle; treat these figures as indicative.');
    }
  }

  // --- attribute class payouts back to people ------------------------------
  const byStakeholder = new Map<string, WaterfallPayout>();
  const ensure = (id: string): WaterfallPayout => {
    let row = byStakeholder.get(id);
    if (!row) {
      row = {
        stakeholderId: id,
        name: nameFor(id),
        preference: 0,
        participation: 0,
        optionProceeds: 0,
        total: 0,
        pctOfExit: 0,
        multiple: null,
      };
      byStakeholder.set(id, row);
    }
    return row;
  };

  for (const c of classStates) {
    const pref = dist.preferenceByClass.get(c.cls.id) ?? 0;
    const part = dist.participationByClass.get(c.cls.id) ?? 0;
    for (const h of c.holders) {
      const weight = c.shares > 0 ? h.shares / c.shares : 0;
      const row = ensure(h.stakeholderId);
      row.preference += pref * weight;
      row.participation += part * weight;
    }
  }

  for (const h of commonHolders) {
    const row = ensure(h.stakeholderId);
    row.participation += dist.commonPerShare * h.shares;
  }

  for (const g of exercisingGrants) {
    const row = ensure(g.stakeholderId);
    // Net of the strike they had to pay to exercise.
    row.optionProceeds += g.shares * (dist.commonPerShare - g.strike);
  }

  const investedByStakeholder = new Map<string, number>();
  for (const h of summary.holders) investedByStakeholder.set(h.stakeholderId, h.invested);

  const payouts = Array.from(byStakeholder.values()).map((row) => {
    const total = row.preference + row.participation + row.optionProceeds;
    const invested = investedByStakeholder.get(row.stakeholderId) ?? 0;
    return {
      ...row,
      total,
      pctOfExit: pct(total, exit),
      multiple: invested > 0 ? total / invested : null,
    };
  });

  payouts.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  if (exit > 0 && dist.totalPreferences >= exit - 1e-6 && commonShares > 0) {
    warnings.push('Liquidation preferences absorb the entire exit — common holders receive nothing.');
  }

  return {
    exitValue: exit,
    payouts,
    convertedClassIds: Array.from(converted),
    totalPreferences: dist.totalPreferences,
    residual: dist.residual,
    optionExerciseProceeds,
    didNotConverge,
    warnings: Array.from(new Set([...warnings, ...summary.warnings])),
  };
}
