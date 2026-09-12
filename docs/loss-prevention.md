# Loss prevention — the forensic scan

The engine is `src/lib/forensics.ts`. Two callers, one engine:

- **Audit Log page** → "Run forensic scan" (`src/app/(app)/audit-log/page.tsx`),
  rendered by `src/components/audit/forensic-report.tsx`.
- **Zen AI** → the `runLossPreventionScan` tool in `src/app/api/chat/tools.ts`,
  rendered by the `LOSS_SCAN` case in `tool-renderer.tsx` (which reuses the same
  report component, so a scan looks identical from either entry point).

Read this before changing a detector, "tidying" an audit-log write, or making the
scan use a model.

## Why it is not AI

The report names a member of staff and says their numbers look like theft. An
owner may act on that against a real employee. So every conclusion is arithmetic
over the shop's own rows, `now` is an input, and the same data gives the same
answer tomorrow. `src/ai/flows/audit-log-analysis-flow.ts` is a stub that returns
`anomalies: []` and is not used by any of this.

The Zen AI tool exists so the owner can *ask* for the scan in chat — the model
calls the tool and relays `summary`. The system prompt in
`src/app/api/chat/route.ts` ("Theft, shrinkage and staff") forbids it from
reaching a verdict of its own about a named person, and from upgrading or
downgrading what the report concluded.

## Detectors compare peers, not thresholds

"More than 5 voids is suspicious" is wrong for a kiosk and wrong for a
supermarket. Almost every detector takes the median of the subject's
**colleagues** — `peerMedian` deliberately *excludes* the subject, because in a
three-cashier shop a thief's own numbers drag the median toward themselves far
enough to hide behind it.

Volume floors matter as much: `sellers` is staff with ≥6 sales in the window, so
a cashier's first shift cannot read as a crime wave. Where no peer group exists
the detector stays silent and pushes a `CoverageGap` instead of guessing.

## Audit detail the detectors cannot work without

Several checks are only possible because the app records something extra *at the
time of the action*. None of it can be backfilled. Do not remove these:

| Written by | Field | Without it |
|---|---|---|
| `receipts/page.tsx` void handlers | `details.saleCreatedAt`, `details.soldBy` | V1/V3 die. A void **deletes the receipt**, so the log is the only surviving record — and `soldBy` is the only way to tell a cashier voiding their *own* sale from a manager fixing someone else's. |
| `quick-edit-dialog.tsx`, `inventory/details/page.tsx` | `product.update` with `details.changes.{price,costPrice}.{from,to}` | S7 (price-swap) and S8 (cost inflation) die. A cut-then-restore leaves the catalogue looking untouched; the pair of logs is the only trace. |
| `inventory/page.tsx`, `inventory/details/page.tsx` | `product.delete` with `details.stockAtDeletion` | S6 dies. Deleting a product erases the item *and* its outstanding count in one action — the cleanest way to make missing stock disappear with no adjustment left to question. |
| `sales/pos/review/page.tsx` | receipt items carry `priceOverridden` + `listPrice` | D4 falls back to comparing against each product's *current* price, where an honest price rise is indistinguishable from an override. That fallback is marked `signal` on purpose. |

Rows written before these existed come back as coverage gaps, never as a clean
result. That is the point: silence has to mean "checked and clear".

## Coverage gaps are load-bearing

`report.coverage` is rendered as its own section, not a footnote. A check that
could not run reads as innocence otherwise. `checksRun`/`checksTotal` come from
the `DETECTORS` array, so a detector cannot be added without the report admitting
it exists.

## Two traps

- **Timezone.** Off-hours checks use `hourInZone` with `settings.timezone`. Node
  defaults to UTC, which in Lagos moves a 9am stock edit to 8am and turns an
  ordinary morning into a finding. Off-hours *sales* prefer
  `receipt.flagged.reason === 'outside_operating_hours'`, computed on the till
  itself and therefore authoritative.
- **T5's `gap > 0`.** Several receipts committed in one batch — an offline queue
  flushing after an outage — carry the *same* server timestamp, so they sit at a
  gap of exactly zero. Counting those made every cashier who had ever worked
  offline look like they were generating sales. A synthetic-data harness caught
  this; `gap >= 0` is not a harmless simplification.

## Receipt numbers are not sequential

`rec-${uuidv4().split('-')[0]}`. There is no such thing as a receipt-number gap
in this app, so no detector may look for one.

## Cost

The page scan reads products, receipts, customers and users from the POS cache
(free — already in memory) and issues **one** query for `SCAN_LOG_LIMIT` (600)
audit rows, held in a ref for the session so a second press costs nothing. The
Zen AI tool reads server-side and caps customers at 1000. See MEMORY: Firestore
cost is a standing constraint.

## What it cannot see

Cash for goods that never reached the till at all. Nothing in a database finds an
item handed over without being rung up — that is what a camera and a physical
count are for. What this finds is the paper trail people leave *making the system
agree with the shortfall*: the void, the discount, the write-off, the price edit
and the timestamp.
