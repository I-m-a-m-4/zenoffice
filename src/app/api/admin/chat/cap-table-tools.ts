/**
 * Cap table tools for the owner-only assistant.
 *
 * **These deliberately do not live in `src/app/api/chat/tools.ts`.**
 *
 * That file is the tenant toolkit, and `src/app/api/chat/route.ts` passes it
 * straight to the model with no whitelist — every tool there is callable by
 * every merchant on the platform. A cap table tool added to it would let any
 * shop owner ask Zen AI who owns Zeneva, what it is valued at, and what each
 * investor paid. So this toolkit is separate, and it is only ever constructed
 * behind `requireSuperAdmin` in the sibling `route.ts`.
 *
 * Everything here is read-only and computed from the same `src/lib/equity`
 * engine the page renders from, so the assistant and the screen can never
 * disagree about a number.
 *
 * ## Result shapes are a contract with `tool-renderer.tsx`
 *
 * Cards are rendered by the shared `ToolResult`, which dispatches on
 * `output.type`. The field names are not free-form:
 *
 * - `METRICS` reads **`tiles`** (not `metrics`), `currency`, `flags` for amber
 *   warnings, and `caveat` for a small grey footnote. A `note` on a METRICS
 *   result is silently dropped.
 * - `TABLE` reads `columns`, `rows`, `currency` and `note`.
 * - A result with no `type` renders as **nothing at all** — the model
 *   paraphrases it and the owner sees prose where a card belongs.
 *
 * Numeric columns must be sent as numbers, never pre-formatted strings, or the
 * table cannot right-align them or render negatives in red.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import {
  buildCapTable,
  exitWaterfall,
  investmentOffer,
  modelRound,
  valuationForStake,
  vestedShares,
} from '@/lib/equity/engine';
import { GLOSSARY_KEYS, lookupTerm } from '@/lib/equity/glossary';
import type { CapTableSummary, EquityRecord, ValuationMethod } from '@/lib/equity/types';

const CAP_TABLE_COLLECTION = 'cap_table';

const METHOD_LABELS: Record<ValuationMethod, string> = {
  priced_round: 'a priced round',
  revenue_multiple: 'a revenue multiple',
  comparable: 'comparable companies',
  dcf: 'discounted cash flow',
  founder_estimate: 'your own estimate',
};

interface Ctx {
  db: Firestore;
}

export function createCapTableTools({ db }: Ctx) {
  /**
   * Per-request cache. A single turn routinely calls three tools that each need
   * the whole cap table; without this that is three identical Firestore reads,
   * and the owner pays for every one.
   */
  let recordCache: EquityRecord[] | null = null;

  async function records(): Promise<EquityRecord[]> {
    if (recordCache) return recordCache;
    const snap = await db.collection(CAP_TABLE_COLLECTION).get();
    recordCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EquityRecord);
    return recordCache;
  }

  async function summary(): Promise<CapTableSummary> {
    return buildCapTable(await records(), new Date());
  }

  /** Shown whenever a question needs a share price and there is not one yet. */
  const noValuation = (currency: string) => ({
    type: 'METRICS' as const,
    title: 'No valuation set',
    currency,
    tiles: [],
    flags: [
      'No valuation has been recorded and no priced round has closed, so there is no share price yet.',
    ],
    caveat:
      'Set one on the Valuation tab, or tell me what valuation to assume and I will work it out from that.',
  });

  return {
    // ── Reading the current position ───────────────────────────────────────

    getCapTable: tool({
      description:
        'The current cap table: every holder, their shares, and their ownership percentage on both the outstanding and fully-diluted bases. Use for "who owns what", "what do I own", "show me the cap table".',
      inputSchema: z.object({}),
      execute: async () => {
        const s = await summary();
        if (!s.holders.length) {
          return {
            type: 'METRICS',
            title: 'Cap table',
            currency: s.currency,
            tiles: [],
            caveat: 'No shares have been issued yet.',
          };
        }
        return {
          type: 'TABLE',
          title: `${s.companyLegalName} — cap table`,
          currency: s.currency,
          note: `${s.fullyDilutedShares.toLocaleString()} shares fully diluted${
            s.pricePerShare ? `, at ${s.pricePerShare.toFixed(4)} per share` : ''
          }.`,
          columns: [
            'Holder',
            'Shares',
            '% outstanding',
            '% fully diluted',
            'Invested',
            'Consideration',
          ],
          rows: s.holders.map((h) => ({
            Holder: h.name,
            Shares: h.fullyDilutedShares,
            '% outstanding': Number(h.pctOutstanding.toFixed(2)),
            '% fully diluted': Number(h.pctFullyDiluted.toFixed(2)),
            Invested: Math.round(h.invested),
            // Without this the model sees Invested: 0 and reports it as nothing
            // having been contributed. The shares were paid for — with the
            // product, not with money.
            Consideration:
              h.nonCashConsiderations.length > 0
                ? h.nonCashConsiderations.join(' + ')
                : h.invested > 0
                  ? 'cash'
                  : '',
          })),
        };
      },
    }),

    getValuation: tool({
      description:
        'What the company is currently valued at, how that number was reached, and what one share is worth. Use for "what is Zeneva worth", "what is a share worth", "how did we get that valuation".',
      inputSchema: z.object({}),
      execute: async () => {
        const s = await summary();
        if (s.currentValuation === null) return noValuation(s.currency);

        const flags: string[] = [];
        if (s.currentValuationMethod === 'founder_estimate') {
          flags.push(
            'This is your own estimate rather than a price anyone has paid. Fine for planning; an investor will push back on it.',
          );
        }

        const largest = s.holders[0];

        return {
          type: 'METRICS',
          title: `${s.companyLegalName} valuation`,
          currency: s.currency,
          tiles: [
            { label: 'Valuation', value: Math.round(s.currentValuation), format: 'currency' },
            {
              label: 'Price per share',
              value: s.pricePerShare ? Number(s.pricePerShare.toFixed(4)) : 0,
              format: 'currency',
            },
            { label: '1% of the company', value: Math.round(s.currentValuation / 100), format: 'currency' },
            { label: 'Fully diluted shares', value: s.fullyDilutedShares },
            ...(largest && s.pricePerShare
              ? [
                  {
                    label: `${largest.name}'s stake`,
                    value: Math.round(largest.fullyDilutedShares * s.pricePerShare),
                    format: 'currency',
                    hint: `${largest.pctFullyDiluted.toFixed(2)}% of the company`,
                  },
                ]
              : []),
            ...(s.floorPricePerShare
              ? [
                  {
                    label: 'Floor price',
                    value: Number(s.floorPricePerShare.toFixed(4)),
                    format: 'currency',
                    hint: 'Your minimum sale price',
                  },
                ]
              : []),
          ],
          flags,
          caveat: [
            `Based on ${METHOD_LABELS[s.currentValuationMethod ?? 'founder_estimate']}.`,
            s.currentValuationBasis ? `Working: ${s.currentValuationBasis}` : null,
          ]
            .filter(Boolean)
            .join(' '),
        };
      },
    }),

    // ── The question that prompted all this ────────────────────────────────

    priceAnInvestment: tool({
      description:
        'Work out what a proposed investment buys: the shares, the percentage, and whether the price is too low. Use whenever someone asks "if an investor puts in X, what do they get" or "is this a good deal". Warns when a cheque buys an outsized stake.',
      inputSchema: z.object({
        amount: z.number().describe('The amount the investor would put in.'),
        valuation: z
          .number()
          .optional()
          .describe('Pre-money valuation to price against. Omit to use the current valuation.'),
      }),
      execute: async ({ amount, valuation }) => {
        const s = await summary();
        const offer = investmentOffer(s, amount, valuation ?? null);
        if (!offer) return noValuation(s.currency);

        // Same cheque at other valuations — the comparison is what makes the
        // point land, and it is cheap to compute here.
        const comparisons = [0.5, 2, 5]
          .map((mult) => {
            const alt = investmentOffer(s, amount, offer.valuation * mult);
            return alt
              ? `${Math.round(alt.valuation).toLocaleString()} valuation → ${alt.investorPct.toFixed(2)}%`
              : null;
          })
          .filter(Boolean);

        return {
          type: 'METRICS',
          title: `${Math.round(offer.amount).toLocaleString()} at a ${Math.round(
            offer.valuation,
          ).toLocaleString()} valuation`,
          currency: s.currency,
          tiles: [
            {
              label: 'They get',
              value: Number(offer.investorPct.toFixed(2)),
              format: 'percent',
            },
            { label: 'Shares issued', value: offer.sharesIssued },
            {
              label: 'Price per share',
              value: Number(offer.pricePerShare.toFixed(4)),
              format: 'currency',
            },
            {
              label: 'You drop to',
              value: Number(offer.founderPctAfter.toFixed(2)),
              format: 'percent',
            },
          ],
          flags: offer.warnings,
          caveat: `Same money elsewhere: ${comparisons.join(' · ')}. The valuation is the whole negotiation.`,
        };
      },
    }),

    valuationToSellStake: tool({
      description:
        'The reverse calculation: given an amount and the percentage you are willing to sell, what valuation does that imply? Use for "if I want to raise X and only give up Y%, what valuation do I need".',
      inputSchema: z.object({
        amount: z.number().describe('Amount to raise.'),
        percent: z.number().describe('Percentage of the company willing to sell, e.g. 10 for 10%.'),
      }),
      execute: async ({ amount, percent }) => {
        const s = await summary();
        const preMoney = valuationForStake(amount, percent);

        if (preMoney === null) {
          return {
            type: 'METRICS',
            title: 'Cannot work that out',
            currency: s.currency,
            tiles: [],
            flags: ['The percentage has to be above 0 and below 100, and the amount above zero.'],
          };
        }

        return {
          type: 'METRICS',
          title: `Raising ${Math.round(amount).toLocaleString()} for ${percent}%`,
          currency: s.currency,
          tiles: [
            { label: 'Pre-money needed', value: Math.round(preMoney), format: 'currency' },
            { label: 'Post-money', value: Math.round(preMoney + amount), format: 'currency' },
            {
              label: 'Price per share',
              value:
                s.fullyDilutedShares > 0 ? Number((preMoney / s.fullyDilutedShares).toFixed(4)) : 0,
              format: 'currency',
            },
          ],
          caveat:
            'Whether you can defend that valuation is the real question — record the working on the Valuation tab.',
        };
      },
    }),

    // ── Modelling ──────────────────────────────────────────────────────────

    modelFundingRound: tool({
      description:
        "Model a priced round and show what it does to everyone's ownership. Use for \"what happens if we raise X at Y\", \"how much would I be diluted\".",
      inputSchema: z.object({
        preMoneyValuation: z.number(),
        amountRaised: z.number(),
        targetPoolPercent: z
          .number()
          .optional()
          .describe('Option pool as a percent of post-money, if the round creates one.'),
      }),
      execute: async ({ preMoneyValuation, amountRaised, targetPoolPercent }) => {
        const recs = await records();
        const s = await summary();
        const m = modelRound(recs, { preMoneyValuation, amountRaised, targetPoolPercent });

        return {
          type: 'TABLE',
          title: `Raising ${Math.round(amountRaised).toLocaleString()} at ${Math.round(
            preMoneyValuation,
          ).toLocaleString()} pre-money`,
          currency: s.currency,
          note: [
            `Price per share ${m.pricePerShare.toFixed(4)}, ${m.newShares.toLocaleString()} new shares, investor takes ${m.investorPct.toFixed(2)}%.`,
            m.poolTopUpShares > 0
              ? `Includes a ${m.poolTopUpShares.toLocaleString()}-share pool top-up absorbed pre-money — so it dilutes you, not the new investor.`
              : null,
            ...m.warnings,
          ]
            .filter(Boolean)
            .join(' '),
          columns: ['Holder', 'Before %', 'After %', 'Change'],
          rows: [
            ...m.holders.map((h) => ({
              Holder: h.name,
              'Before %': Number(h.pctBefore.toFixed(2)),
              'After %': Number(h.pctAfter.toFixed(2)),
              // Sent as a number so a loss renders red rather than grey.
              Change: Number(h.delta.toFixed(2)),
            })),
            {
              Holder: 'New investor',
              'Before %': 0,
              'After %': Number(m.investorPct.toFixed(2)),
              Change: Number(m.investorPct.toFixed(2)),
            },
          ],
        };
      },
    }),

    modelExit: tool({
      description:
        'Model a sale of the company and show who receives what after liquidation preferences. Use for "what do I get if we sell for X", "what happens to me in an exit".',
      inputSchema: z.object({
        exitValue: z.number().describe('Sale price of the company.'),
      }),
      execute: async ({ exitValue }) => {
        const recs = await records();
        const s = await summary();
        const w = exitWaterfall(recs, exitValue);

        return {
          type: 'TABLE',
          title: `If ${s.companyLegalName} sold for ${Math.round(exitValue).toLocaleString()}`,
          currency: s.currency,
          note: [
            w.totalPreferences > 0
              ? `${Math.round(w.totalPreferences).toLocaleString()} goes to liquidation preferences before common holders see anything.`
              : 'No liquidation preferences — proceeds split by ownership.',
            ...w.warnings,
          ]
            .filter(Boolean)
            .join(' '),
          columns: ['Holder', 'Preference', 'Residual', 'Total', '% of exit'],
          rows: w.payouts.map((p) => ({
            Holder: p.name,
            Preference: Math.round(p.preference),
            Residual: Math.round(p.participation + p.optionProceeds),
            Total: Math.round(p.total),
            '% of exit': Number(p.pctOfExit.toFixed(2)),
          })),
        };
      },
    }),

    // ── Understanding ──────────────────────────────────────────────────────

    explainTerm: tool({
      description:
        'Explain a cap table or fundraising term in plain language, with why it matters and a worked example. Use whenever the owner asks what something means. Prefer this over explaining from your own knowledge, so the wording matches what the app shows.',
      inputSchema: z.object({
        term: z.string().describe(`The term to explain. Known terms: ${GLOSSARY_KEYS.join(', ')}.`),
      }),
      execute: async ({ term }) => {
        const entry = lookupTerm(term);
        if (!entry) {
          return {
            type: 'METRICS',
            title: `No entry for "${term}"`,
            tiles: [],
            caveat: `I have definitions for: ${GLOSSARY_KEYS.join(', ')}. Ask about one of those, or ask in your own words and I will explain directly.`,
          };
        }
        return {
          type: 'WALKTHROUGH',
          title: entry.term,
          steps: [
            entry.long,
            ...(entry.why ? [`Why it matters: ${entry.why}`] : []),
            ...(entry.example ? [`For example: ${entry.example}`] : []),
          ],
          tips: entry.see?.length
            ? [`Related: ${entry.see.map((k) => lookupTerm(k)?.term ?? k).join(', ')}`]
            : undefined,
        };
      },
    }),

    getVestingStatus: tool({
      description:
        'Vesting progress on option grants — how much of each grant is actually earned today. Use for "how much has X vested", "what is vested so far".',
      inputSchema: z.object({}),
      execute: async () => {
        const recs = await records();
        const s = await summary();
        const now = new Date();

        const grants = recs.filter(
          (r): r is Extract<EquityRecord, { kind: 'optionGrant' }> => r.kind === 'optionGrant',
        );
        if (!grants.length) {
          return {
            type: 'METRICS',
            title: 'No option grants',
            currency: s.currency,
            tiles: [],
            caveat: 'Nothing has been granted from the option pool yet.',
          };
        }

        const nameOf = (id: string) =>
          s.holders.find((h) => h.stakeholderId === id)?.name ?? 'Unknown';

        return {
          type: 'TABLE',
          title: 'Vesting status',
          currency: s.currency,
          columns: ['Grantee', 'Granted', 'Vested', 'Unvested', '% vested'],
          rows: grants.map((g) => {
            const vested = vestedShares(g.vesting, g.shares, now);
            return {
              Grantee: nameOf(g.stakeholderId),
              Granted: g.shares,
              Vested: vested,
              Unvested: Math.max(0, g.shares - vested),
              '% vested': g.shares > 0 ? Number(((vested / g.shares) * 100).toFixed(1)) : 0,
            };
          }),
        };
      },
    }),

    getFundingHistory: tool({
      description:
        'The funding rounds recorded so far and what each was priced at. Use for "how much have we raised", "what has each round cost me", "have we been diluted".',
      inputSchema: z.object({}),
      execute: async () => {
        const recs = await records();
        const s = await summary();

        const rounds = recs
          .filter((r): r is Extract<EquityRecord, { kind: 'round' }> => r.kind === 'round')
          .filter((r) => r.status === 'closed');

        if (!rounds.length) {
          return {
            type: 'METRICS',
            title: 'No closed rounds',
            currency: s.currency,
            tiles: s.holders.slice(0, 4).map((h) => ({
              label: h.name,
              value: Number(h.pctFullyDiluted.toFixed(2)),
              format: 'percent',
            })),
            caveat:
              'No funding round has closed, so nothing has diluted you. Ownership is exactly as issued.',
          };
        }

        return {
          type: 'TABLE',
          title: 'Rounds closed',
          currency: s.currency,
          columns: ['Round', 'Pre-money', 'Raised', 'Post-money', 'Price per share'],
          rows: rounds.map((r) => ({
            Round: r.name,
            'Pre-money': Math.round(r.preMoneyValuation),
            Raised: Math.round(r.amountRaised),
            'Post-money': Math.round(r.preMoneyValuation + r.amountRaised),
            'Price per share': Number((r.pricePerShare ?? 0).toFixed(4)),
          })),
        };
      },
    }),
  };
}
