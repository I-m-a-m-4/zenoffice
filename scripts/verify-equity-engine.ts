/**
 * Fixture verification for the cap table engine.
 *
 * Run with: npx tsx scripts/verify-equity-engine.ts
 *
 * The cases here are the plan's verification list, chosen because together they
 * exercise every branch that could fail silently:
 *
 *  1. A two-holder common split must sum to exactly 100.
 *  2. A seed round must dilute founders by exactly the standard formula.
 *  3. A SAFE must convert at the cap when the cap beats the discount.
 *  4. A non-participating preferred must CONVERT when conversion pays more.
 *  5. Preferences must absorb the whole exit below them (common gets nothing).
 *  6. Vesting must respect the cliff exactly (0 at month 11, 25% at month 12).
 */

import {
  buildCapTable,
  convertibleAsConverted,
  exitWaterfall,
  modelRound,
  vestedShares,
} from '../src/lib/equity/engine';
import type { EquityRecord } from '../src/lib/equity/types';

const base = {
  createdAt: null,
  updatedAt: null,
} as const;

function settings(): EquityRecord {
  return { ...base, id: 'settings', kind: 'settings', companyLegalName: 'Zeneva', currency: 'USD' };
}

function commonClass(id: string, authorized = 10_000_000): EquityRecord {
  return {
    ...base,
    id,
    kind: 'shareClass',
    name: 'Common',
    classType: 'common',
    authorizedShares: authorized,
    parValue: 0.0001,
    seniorityRank: 0,
    votesPerShare: 1,
    conversionRatio: 1,
    liquidationMultiple: 1,
    participating: false,
    participationCapMultiple: null,
  };
}

function preferredClass(id: string, overrides: Partial<Extract<EquityRecord, { kind: 'shareClass' }>> = {}): EquityRecord {
  return {
    ...base,
    id,
    kind: 'shareClass',
    name: 'Series A',
    classType: 'preferred',
    authorizedShares: 5_000_000,
    parValue: 0.0001,
    seniorityRank: 1,
    votesPerShare: 1,
    conversionRatio: 1,
    liquidationMultiple: 1,
    participating: false,
    participationCapMultiple: null,
    ...overrides,
  };
}

function holder(id: string, name: string, overrides: Partial<Extract<EquityRecord, { kind: 'stakeholder' }>> = {}): EquityRecord {
  return { ...base, id, kind: 'stakeholder', name, entityType: 'individual', isFounder: false, ...overrides };
}

function issuance(stakeholderId: string, shareClassId: string, shares: number, overrides: Partial<Extract<EquityRecord, { kind: 'issuance' }>> = {}): EquityRecord {
  return {
    ...base,
    id: `iss-${stakeholderId}-${shareClassId}-${shares}`,
    kind: 'issuance',
    stakeholderId,
    shareClassId,
    shares,
    pricePerShare: 0.0001,
    issueDate: new Date(2023, 0, 1),
    consideration: 'cash',
    ...overrides,
  };
}

let failures = 0;
let assertions = 0;

function approx(actual: number, expected: number, label: string, tolerance = 1e-6): void {
  assertions += 1;
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) {
    failures += 1;
    console.error(`  FAIL ${label}: expected ${expected}, got ${actual}`);
  }
}

function check(cond: boolean, label: string): void {
  assertions += 1;
  if (!cond) {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Two-holder common split
// ---------------------------------------------------------------------------
{
  const records = [
    settings(),
    commonClass('common'),
    holder('a', 'Bello Imam', { isFounder: true }),
    holder('b', 'Angel Investor'),
    issuance('a', 'common', 600_000),
    issuance('b', 'common', 400_000),
  ];
  const t = buildCapTable(records, new Date(2024, 0, 1));
  const a = t.holders.find((h) => h.stakeholderId === 'a');
  const b = t.holders.find((h) => h.stakeholderId === 'b');

  console.log('1. Two-holder common split');
  approx(t.outstandingShares, 1_000_000, 'total shares');
  approx(a?.pctOutstanding ?? -1, 60, 'founder pct');
  approx(b?.pctOutstanding ?? -1, 40, 'investor pct');
  approx((a?.pctOutstanding ?? 0) + (b?.pctOutstanding ?? 0), 100, 'percentages sum to 100');
}

// ---------------------------------------------------------------------------
// 2. Seed round dilution
// ---------------------------------------------------------------------------
{
  const records = [
    settings(),
    commonClass('common'),
    holder('f', 'Founder', { isFounder: true }),
    issuance('f', 'common', 1_000_000),
  ];
  const model = modelRound(
    records,
    { preMoneyValuation: 2_000_000, amountRaised: 500_000 },
    new Date(2024, 0, 1),
  );
  const founder = model.holders.find((h) => h.stakeholderId === 'f');

  console.log('2. Seed round dilution');
  approx(model.pricePerShare, 2, 'PPS = pre-money / pre-money FD');
  approx(model.newShares, 250_000, 'new shares = raised / PPS');
  approx(founder?.pctAfter ?? -1, 80, 'founder diluted 100% -> 80%');
  approx(model.investorPct, 20, 'investor owns 20%');
  approx(
    model.newShares / model.postMoneyFullyDiluted * 100,
    20,
    'new shares are exactly 20% of post-money',
  );
}

// ---------------------------------------------------------------------------
// 3. SAFE conversion: cap beats discount
// ---------------------------------------------------------------------------
{
  const preMoneyFd = 1_000_000;
  const safe: Extract<EquityRecord, { kind: 'convertible' }> = {
    ...base,
    id: 'safe-1',
    kind: 'convertible',
    stakeholderId: 'investor',
    instrument: 'safe',
    principal: 100_000,
    issueDate: new Date(2023, 0, 1),
    valuationCap: 4_000_000,
    discountPercent: 20,
    interestRate: 0,
    safeType: 'pre',
    status: 'outstanding',
  };
  const pps = 8; // $8M pre on 1M shares
  const shares = convertibleAsConverted(safe, pps, preMoneyFd, new Date(2024, 0, 1));

  console.log('3. SAFE conversion — cap beats discount');
  // cap price = 4,000,000 / 1,000,000 = $4.00
  // discount price = 8 * 0.8 = $6.40
  // conversion price = min(4.00, 6.40) = $4.00
  // shares = 100,000 / 4.00 = 25,000
  approx(shares, 25_000, 'converts at the $4 cap price, not the $6.40 discount');
}

// ---------------------------------------------------------------------------
// 4. Waterfall conversion: non-participating preferred converts when it pays
// ---------------------------------------------------------------------------
{
  const records = [
    settings(),
    commonClass('common'),
    preferredClass('pref'),
    holder('f', 'Founder', { isFounder: true }),
    holder('v', 'VC'),
    issuance('f', 'common', 800_000),
    // 1x non-participating preferred: 200,000 shares at $10 = $2M invested,
    // which is 20% of the 1,000,000 shares outstanding.
    issuance('v', 'pref', 200_000, { pricePerShare: 10, consideration: 'cash' }),
  ];
  const asOf = new Date(2024, 0, 1);

  // --- $10M exit ---
  // Preference = 200,000 x $10 x 1 = $2M.
  // As-converted = 20% of $10M = $2M.
  // They tie exactly, so conversion is not elected (strictly-greater test).
  const w10 = exitWaterfall(records, 10_000_000, asOf);
  const vc10 = w10.payouts.find((p) => p.stakeholderId === 'v');
  const f10 = w10.payouts.find((p) => p.stakeholderId === 'f');

  console.log('4a. Waterfall at $10M — preference equals as-converted, no conversion');
  check(w10.convertedClassIds.length === 0, 'no class converts at the breakeven exit');
  approx(vc10?.total ?? -1, 2_000_000, 'VC takes $2M preference');
  approx(f10?.total ?? -1, 8_000_000, 'founder takes the rest');

  // --- $20M exit: as-converted of $4M beats the $2M preference ---
  const w20 = exitWaterfall(records, 20_000_000, asOf);
  const vc20 = w20.payouts.find((p) => p.stakeholderId === 'v');
  const f20 = w20.payouts.find((p) => p.stakeholderId === 'f');

  console.log('4b. Waterfall at $20M — the class must convert to common');
  check(w20.convertedClassIds.includes('pref'), 'preferred converts at the higher exit');
  approx(vc20?.total ?? -1, 4_000_000, 'VC takes 20% as-converted: $4M');
  approx(f20?.total ?? -1, 16_000_000, 'founder takes the remaining $16M');
}

// ---------------------------------------------------------------------------
// 5. Waterfall below preferences: common gets nothing
// ---------------------------------------------------------------------------
{
  const records = [
    settings(),
    commonClass('common'),
    preferredClass('pref'),
    holder('f', 'Founder', { isFounder: true }),
    holder('v', 'VC'),
    issuance('f', 'common', 800_000),
    issuance('v', 'pref', 200_000, { pricePerShare: 10, consideration: 'cash' }),
  ];
  const w = exitWaterfall(records, 1_000_000, new Date(2024, 0, 1));
  const vc = w.payouts.find((p) => p.stakeholderId === 'v');
  const f = w.payouts.find((p) => p.stakeholderId === 'f');

  console.log('5. Waterfall below preferences');
  approx(vc?.total ?? -1, 1_000_000, 'VC takes the whole $1M exit');
  approx(f?.total ?? 1, 0, 'common receives nothing');
}

// ---------------------------------------------------------------------------
// 6. Vesting: 4-year monthly with 1-year cliff
// ---------------------------------------------------------------------------
{
  const vesting = {
    startDate: new Date(2023, 0, 15),
    cliffMonths: 12,
    totalMonths: 48,
  };
  // months-since-start directly: `asOf(m)` = start + m months, where m is the
  // elapsed calendar months the fixture means. (Previously it built "the m-th
  // month of 2024", so asOf(24) was really month 35 of the schedule and the
  // assertion was testing the wrong point in the curve.)
  const asOf = (m: number) => new Date(2023, 0 + m, 15);

  console.log('6. Vesting schedule');
  approx(vestedShares(vesting, 120_000, asOf(11)), 0, 'nothing at month 11, one month before the cliff');
  approx(vestedShares(vesting, 120_000, asOf(12)), 30_000, 'exactly 25% the day the cliff lands');
  approx(vestedShares(vesting, 120_000, asOf(24)), 60_000, '50% at month 24');
  approx(vestedShares(vesting, 120_000, asOf(47)), 117_500, 'not yet complete at month 47');
  approx(vestedShares(vesting, 120_000, asOf(48)), 120_000, 'fully vested at month 48');
  approx(vestedShares(vesting, 120_000, asOf(72)), 120_000, 'stays capped long after the end');
}

// ---------------------------------------------------------------------------
console.log('');
if (failures === 0) {
  console.log(`All ${assertions} assertions passed.`);
  process.exit(0);
} else {
  console.error(`${failures}/${assertions} assertions FAILED.`);
  process.exit(1);
}
