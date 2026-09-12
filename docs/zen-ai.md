# Zen AI (`/ai-insights`)

The AI copilot. Next.js route `src/app/api/chat/route.ts` streams from Gemini
via the Vercel AI SDK; the client is `src/app/(app)/ai-insights/page.tsx`.

Where this sits in the wider system — and why the stack is what it is — is in
[`technology.md`](technology.md) §4. This file is the depth.

## The 401 that cost a session — read this before touching the chat client

Symptom: every prompt returned `POST /api/chat 401 (Unauthorized)`, with the
browser stack trace pinned to a line number that no longer matched the source.

**Two independent causes stacked, and fixing only the first changes nothing.**

### Cause 1 — `useChat` was still on the v4 API

`package.json` pins `ai@7` + `@ai-sdk/react@4` (these are the matching pair —
`@ai-sdk/react` v4 depends on `ai` v7, the version numbers are *not* meant to
line up). The page was still written for v3/v4:

```js
// BROKEN on ai@7 — both options are silently ignored
useChat({ api: '/api/chat', body: { businessId, userId } })
```

In v7 `ChatInit` accepts **neither `api` nor `body`** (confirmed in
`node_modules/ai/dist/index.d.ts`). They are transport concerns now. The
request still reached `/api/chat` because that is `DefaultChatTransport`'s
default path, but `businessId`/`userId` never left the browser — so the auth
check in `route.ts` rejected every call.

The fix is a transport whose `prepareSendMessagesRequest` re-reads the ids on
every send (a ref, not a closure — `businessId` resolves after first paint):

```js
const transport = useMemo(() => new DefaultChatTransport({
  api: '/api/chat',
  prepareSendMessagesRequest: ({ messages, body }) => ({
    body: { ...body, messages, ...authRef.current },
  }),
}), []);
useChat({ id: sessionId, transport, onError });
```

Verify the server half with curl — no browser needed:

```bash
# missing ids -> 401
curl -s -XPOST localhost:9007/api/chat -H 'Content-Type: application/json' \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"hi"}]}]}'
# with ids -> gets past auth (404 "Business not found" for a fake id is a PASS)
curl -s -XPOST localhost:9007/api/chat -H 'Content-Type: application/json' \
  -d '{"messages":[...],"businessId":"x","userId":"y"}'
```

Other v7 renames that bit at the same time, all in the same file:

| v3/v4 | v7 |
|---|---|
| `useChat().append(...)` | `sendMessage({ text })` — `append` no longer exists |
| `message.content` | `message.parts[]` (filter `type === 'text'`) |
| `message.toolInvocations` | `tool-*` parts, read via `isToolUIPart` / `getToolName` |
| `tool.result` | `part.output` |
| `state === 'result'` | `state === 'output-available'` (also `output-error`) |
| `tool({ parameters })` | `tool({ inputSchema })` |
| `maxSteps: 10` | `stopWhen: stepCountIs(10)` |
| `toDataStreamResponse()` | `toUIMessageStreamResponse()` |

### Cause 2 — a stale service worker served the old bundle

This is the one that makes the fix look like it did nothing.

`next.config.ts` sets next-pwa `disable: NODE_ENV === 'development'`, which
stops it *generating* a worker in dev — but Next still **serves any leftover
`public/sw.js` as a static file**. So every `npm run build` plants a production
service worker that then hijacks the dev server on the next visit.

That worker precaches the built chunks, e.g.
`/_next/static/chunks/app/(app)/ai-insights/page-<hash>.js`. The browser kept
serving the *compiled old* page, so source edits had no effect and the stack
trace kept pointing at line numbers from the pre-fix build. A normal refresh
does not help — it goes through the worker.

**The tell:** a stack trace line number that does not match the current source.
If you see that, suspect the service worker before you suspect your edit.

Two guards are now in place:

- `public/sw.js` and `public/workbox-*.js` are gitignored build artifacts; they
  were deleted. They will reappear after any local `npm run build`.
- `src/components/shared/client-initializer.tsx` unregisters non-FCM service
  workers when `NODE_ENV === 'development'`. It deliberately **skips**
  `firebase-messaging-sw.js`, which `src/hooks/use-fcm.ts` registers on purpose
  — a blanket unregister breaks push notifications in dev.

The guard cannot rescue a tab that a worker already controls (an unregistered
worker keeps controlling open pages until reload). To break out once:

```js
navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())))
  .then(() => caches.keys()).then(ks => Promise.all(ks.map(k => caches.delete(k))))
  .then(() => location.reload());
```

## Session persistence

Transcripts are written to Firestore `ai_sessions/{sessionId}`. Sessions saved
by pre-v5 builds hold `{role, content}` and `toolInvocations`; both the client
(`normaliseMessage`) and the server normalise `content` → `parts` on load.
Tool cards from those old sessions do not survive — only their text does.
`convertToModelMessages` is wrapped in a try/catch that returns a friendly
"start a new chat" 400 rather than a 500.

### `convertToModelMessages` is async — the missing `await` is invisible

Its signature is `Promise<ModelMessage[]>`, not `ModelMessage[]`. Drop the
`await` and nothing complains at the call site: `streamText` accepts the Promise,
carries it two layers down, and the provider dies on

```
TypeError: messages.some is not a function
```

The trace points at the `streamText({...})` call — the line *after* the real
mistake — and because `toUIMessageStreamResponse`'s `onError` turns a stream
failure into assistant text, the owner sees `messages.some is not a function`
rendered as Zen's reply in the chat bubble. It looks like a provider or model
problem. It is a missing keyword.

`typescript.ignoreBuildErrors: true` in `next.config.ts` means the build will not
catch this either. Both routes now `await` it; keep it that way when adding a
third.

## Quotas

Two caps, on **two different periods**, and the doc used to get both wrong:

- **Platform-wide, daily.** `GLOBAL_LIMIT = 1500` turns against
  `platform_stats/ai_usage_global`, reset by comparing the doc's `date` to today.
  This one is a spend circuit-breaker, not a per-tenant allowance.
- **Per business, monthly.** `AI_MONTHLY_LIMITS` in `src/lib/plan.ts` — starter 3,
  pro 150, business 600 — resolved through `aiMonthlyLimit(business)` so a
  lapsed subscription drops back to the free tier. The counter is
  `aiUsageCount`, and `aiUsageCurrentDate` holds **`YYYY-MM`**, not a day. Read the
  field name as "the month this count belongs to".

  **Do not restate these numbers in prose without checking the constant.** They have
  been revised twice while this doc was being written, and the trap is not the eleven
  i18n catalogs (which carry only the pro and business figures, under `plans.proF5`
  and `plans.bizF3`) — it is the **Starter** number, which has no catalog key at all
  and so escapes the usual parity grep. It sat at 15 in `use-cases/page.tsx` and
  `help-center/page.tsx` against a real 3 until 20 August 2026: a free-tier user was
  promised five times what the server would grant, on the public pricing table.

**`aiUsageCount` counts credits, not turns.** It kept its name because renaming means
migrating every live document plus the `entitlementFieldsLocked()` entry plus the admin
board, for no user-visible gain — the same reasoning that keeps `trialExpiresAt` its
historic name in `plan.ts`. `aiBonusCredits` is historic in the same way: "bonus" now
means *purchased or granted*.

Past the monthly allowance the turn falls back to `aiBonusCredits`, a non-expiring
balance. Allowance first, then balance, and **one turn can straddle both** — see
`Reservation.fromAllowance` / `fromBalance`.

**The allowance is stated in six places and only two of them follow the constant.**
`subscription-section.tsx` imports `AI_MONTHLY_LIMITS`, and `/ai-insights` calls
`aiMonthlyLimit(businessData)` — both track a change automatically. Four do not:
the i18n keys `plans.proF5` and `plans.bizF3` spell the numbers out in prose
(`'Zen AI — 400 credits/month'`) **in every locale catalog**, and `src/app/use-cases/page.tsx`
(`PLANS`) and `src/app/help-center/page.tsx` (the `zen-ai-limits` and `plan-limits`
entries) each carry their own hand-typed copy. Changing an allowance is therefore one
constant, two keys across all eleven catalogs in `src/lib/i18n/messages/`, and those two
pages — or a marketing surface quotes a figure the server no longer honours. It has
already happened once: both of those pages advertised a **daily** allowance of 20/100/500
that no code path ever implemented.

There is a **seventh** copy, and it is the reason to grep rather than work from this list:
`src/app/home-client.tsx` carries its own hand-written plan cards and still said
"Zen AI — 3,000 messages/month". Nothing imports that file — the live homepage renders
`src/components/home/pricing-plans.tsx`, which is i18n-driven — so the figure was invisible
rather than wrong on screen. It was corrected anyway, because a dead file is one restore
away from being a live one and it is a price claim. Grep for the *number* when you change an
allowance; a file nobody imports will not show up any other way.

**Say "credits", never "messages".** A shop promised 400 messages and cut off after 90
heavy ones has been lied to, and the wording is the only thing standing between the
weighted debit and a support ticket that is entirely our fault.

### A turn is not a unit of cost

`stopWhen: stepCountIs(24)` means one turn is anywhere between one model round-trip
and twenty-four, and a `runLossPreventionScan` turn drives a 119 KB forensics engine
over the shop's whole audit log. So **the turn counter above prices nothing** — it is
a rate limit that happens to be denominated in the wrong unit for the bill.

What makes the real figure answerable is per-tenant token attribution in `onFinish`:
`businessTokensIn` and `businessTokensOut` on each day document
(`AiDailyStats` in `src/lib/ai-analytics.ts`), keyed by businessId, priced through
`estimateCostUsd` in `src/lib/ai-cost.ts` and shown as the **Cost ceiling** column on
`/admin-imamshaffy/ai-usage`.

Three things about that pair worth keeping:

- **They are parallel maps, not fields inside `businesses`.** That map is
  `Record<string, number>` by contract — it is the only source of distinct-actives per
  day, and `mergeCountMaps` skips any value that is not already a number, so nesting
  tokens inside it would have zeroed the existing charts silently rather than failing.
- **They live on the day document, not the business doc.** A new *top-level* field on
  `businessInstances` is writable by the owner unless it is added to
  `entitlementFieldsLocked()` — `fieldsUnchanged()` denies only what it lists — and a
  tenant who can edit their own cost record is worse than no record. The day documents
  are Admin-SDK-only, so this needed no rules change.
- **Absent is not zero.** Days before August 2026 have turns and no tokens. The column
  shows an em-dash there, because "cost us nothing" and "was never measured" are
  different answers and only one of them is safe to price against.

Every money figure is a **ceiling for the chat route**, and that qualifier is not
pedantry. It is list price with no context-caching discount and no free-tier allowance,
which is the useful direction for a bill you are trying not to be surprised by — but it
covers only what the route measures. The five Genkit flows bill the same Gemini key and
are priced in **credits from `FLOW_CREDITS` floors**, not in tokens, because Genkit
surfaces no usage object; their spend therefore appears nowhere in this column. On the
first invoice checked against it (20 August 2026) the account came in about **6% above**
the board's ceiling, and that is the whole of the gap. If it ever widens further, look
for a Gemini call site that does not go through `src/lib/server/ai-credits.ts` at all —
that one would be invisible to both the column and the credit balance.

### Where the money actually goes — input, not output

Reconciled against a real invoice on 20 August 2026, over 28 turns and 14 days:

| | Per turn | Share of tokens | Share of cost |
|---|---|---|---|
| Input | ~12,400 | 98% | **85%** |
| Output | ~260 | 2% | 15% |

Output is priced 8× higher per token and still barely registers, because there is 48×
less of it. **So shortening replies saves nothing.** Anyone sent to cut this bill by
telling the model to be terser is optimising the 15%.

Of that input, roughly **8,100 tokens is fixed overhead resent verbatim on every single
turn** — the tool schemas (~4,500) plus the system prompt (~3,600). That is about 65% of
input before the shop has asked anything.

**Caching does not rescue this at Zeneva's volume.** Implicit caching is free but needs
traffic dense enough to keep a prefix warm; at roughly two turns a day the prefix is
cold every time, which is why actual spend landed *on* the ceiling rather than under it.
Explicit caching is worse than useless here — storage runs about $1.00 per 1M tokens per
hour, so holding an 8k-token prefix for a day costs around $0.19 against a whole-month
bill of $0.13, roughly 22× the thing it is meant to reduce. Revisit only if turns-per-day
rises by orders of magnitude. The prefix itself is already stable per shop (only a short
`## Active Session Context` block is appended), so the obstacle is traffic density, not
prompt design.

#### What was done instead: send less in

Three changes in `src/app/api/chat/tools.ts`, measured by `npm run test:zen-cost`:

- **`slimForModel`** strips what the model cannot use from every tool result: `imageUrl`
  (a ~300-character Firebase Storage URL it cannot see), every `null`/`undefined` key,
  the duplicate `columns`/`rows` half of a `PRODUCT_TABLE` when `products` is populated,
  and `LOSS_SCAN.report` when `summary` is present — the summary already states every
  conclusion, and `src/lib/forensics.ts` is arithmetic, so there is nothing left for the
  model to work out from the raw findings. Measured: **74% off tool payloads overall**,
  98% off a loss scan.
- **`slimHistory`** applies the same function to historical tool results and then digests
  anything older than the newest 8 results down to `{note, type, title}`. A result is
  charged *again* on every later step of the same turn and again on every later turn, so
  the twentieth question was paying for the previous nineteen answers. Measured: **64% off
  a short conversation, 84% off a 40-turn one** — growth is now bounded rather than linear.
- **`createZenTools` drops `getBusinessRating`** when the shop never opted into the
  rating (~157 tokens of schema, on most shops, every turn).

Two properties of `slimForModel` are load-bearing and the harness asserts both:

1. **It only ever removes.** Never rewrites, reorders or rounds. The *full* payload still
   streams to the UI card, so any rewrite here means the card and the model disagree about
   the shop's own numbers — the model reading out a figure the owner cannot find on screen.
2. **The two structural removals are guarded.** An empty `PRODUCT_TABLE` keeps `rows` (or
   the model gets a card with nothing in it) and a summary-less `LOSS_SCAN` keeps `report`.

**`toModelOutput` is attached set-wide, not per tool.** One hand-written hook per tool
would be one chance per tool to forget, and forgetting is invisible — it costs money
silently and breaks nothing. `createZenTools` wraps the whole set in one loop, and check
3a in the harness proves the wrapper reached every tool.

**History is slimmed separately, and that is deliberate.** `toModelOutput` fires inside the
SDK's multi-step loop and inside `convertToModelMessages` — but only if the tool set is
passed to the conversion, and `route.ts` converts *before* the credit reservation on
purpose: a turn rejected for unreadable history must not reserve anything, and does not
need the business document. Rather than reorder that, `slimHistory` runs on the messages
and calls the same exported `slimForModel`, so there is one definition of "what the model
reads".

#### Two optimisations measured and rejected

Both are recorded because the numbers are the argument, and someone will propose them again:

- **Rewriting the system prompt.** Worth ~800–1,200 tokens (6–10% of input, ~5–8% of the
  bill). Rejected: all fourteen sections carry live behavioural guidance — proposal-vs-relay
  rules, projection rules, the money-figure contradiction rules, the staff-accusation relay
  rules — against a board showing a 0% refusal and error rate. Trading that for 8% of input
  is a worse deal than what was already banked at zero risk.
- **`activeTools` gating of the eight `propose*` tools.** Worth a measured **1,062 tokens
  (8.5% of input)**, and the board showed zero proposal turns in fourteen days. Rejected: a
  missed write-intent signal makes the model answer "I can't do that" instead of prompting a
  rephrase, which is a real capability regression in a paid product for a saving smaller than
  the one already taken.

Two flows do run cheaper: `zenevaSupportChat` and `productTroubleshoot` override the model
to **`gemini-2.5-flash-lite`** ($0.10/1M input against $0.30). Both answer shallow questions
over pasted context with no arithmetic in the output, so a weaker model yields a duller
suggestion rather than a wrong number. `visualCount` stays on Flash because vision precision
*is* the product, and `businessAnalysis` stays because it emits long structured output over
real figures.

### Credits — the unit, and the rule that every Gemini call meters

`src/lib/server/ai-credits.ts` is the only place that prices AI work or moves a
balance. **If a new Gemini call site does not call `reserveCredits`, it is free** — and
free is the entire problem this module exists to close. Before this landed, the five
`src/ai/flows/*` server actions read no quota field at all, so `visualCount` billed an
unbounded multimodal call on the platform key for anyone who replayed the action id out
of the client bundle.

The derivation, in three constants:

- `weighted = tokensIn + tokensOut × OUTPUT_TOKEN_WEIGHT`, with
  **`OUTPUT_TOKEN_WEIGHT = 8`**. Gemini 2.5 Flash bills output at $2.50/1M against
  input at $0.30/1M — a ratio near 8.3, rounded **down** so the weighting can never
  charge more than the cost ratio justifies. It is a literal on purpose: deriving it
  from `ZEN_MODEL` would silently reprice balances already sold the day Google changes
  a rate. When `ZEN_MODEL` changes, check this in the same commit.
- `credits = max(1, ceil(weighted / TOKENS_PER_CREDIT))`, with
  **`TOKENS_PER_CREDIT = 20_000`** — set so an ordinary turn (a system prompt, the tool
  schemas, a short history, a short answer ≈ 15k weighted) costs exactly 1, with
  headroom so a long history does not push a normal question to 2. Never zero: an empty
  or errored-but-completed response has to cost something.
- **`FLOW_CREDITS`** is the one unavoidable hand-maintained table. The Genkit flows
  surface no usage object, so they are priced as floors — `visualCount` 8,
  `businessAnalysis` 4, `getCustomerInsights` 3, `productTroubleshoot` 2,
  `zenevaSupportChat` 1. If a flow is ever moved onto the AI SDK and reports usage,
  delete its entry and settle on real tokens instead.

**`TOKENS_PER_CREDIT` is a labelled estimate, not a measurement.** The Cost ceiling
column only started collecting per-tenant tokens in August 2026. Calibrate against the
board before repricing anything, and treat every pack price as provisional until then.

#### Reserve, then settle

`reserveCredits` takes `RESERVATION_CREDITS` inside `runTransaction` **before** the
model is called; `settleCredits` adjusts to the true cost in `onFinish`;
`releaseCredits` refunds on error. Five things about that are load-bearing:

- **The transaction is the point.** The old code read the cap before streaming and
  incremented in `onFinish` with nothing joining them, so two concurrent turns could
  both pass a check with one credit left.
- **`onFinish` and the stream's `onError` are separate callbacks and nothing promises
  only one fires.** A `creditsResolved` boolean latch in `route.ts` gives the
  reservation to whichever arrives first — settling *and* releasing the same
  reservation would either double-charge or hand back a spent credit. A plain boolean
  is enough: both run on the same single-threaded event loop.
- **History normalisation sits ahead of the reservation** in `route.ts`, so a turn
  rejected for an unreadable history reserves nothing and does not even read the
  business document.
- **`reserveCredits` returns the business document** it already had in hand, and the
  route uses it for `settings.currency` and `settings.ratingEnabled`. Reading it twice
  would double the per-turn read cost for nothing.
- **`settleCredits` returns early with no write when the delta is zero**, which is the
  common case.

#### Two policies that are decisions, not accidents

- **A shortfall is written off, not overdrawn.** If the true cost exceeds what the
  balance can cover, the turn has already been answered and cannot be un-answered. So
  the charge clamps at zero and the remainder comes back as `unbilled`, which the route
  records as `unbilledCredits` on the day document. The now-zero balance blocks the
  *next* turn, which is the correct enforcement point, and the write-off is visible to
  the platform owner rather than silent. Persistently non-zero means
  `RESERVATION_CREDITS` reserves too little or `TOKENS_PER_CREDIT` is set too high.
- **Refunds go to the purchased balance first**, because it does not expire while an
  allowance resets in days — a credit returned there is worth more to the shop. And
  `aiUsageCount` is only unwound when `aiUsageCurrentDate` still matches the month the
  charge was made in, or a refund across a month boundary would hand out a credit
  against the new allowance.

#### Nothing new at the document root

The reservation is expressed by moving the two fields that are **already** in
`entitlementFieldsLocked()` — `aiUsageCount` and `aiBonusCredits` — rather than by
adding an `aiReserved` field. `fieldsUnchanged()` is a **deny-list**: any new top-level
field on `businessInstances` is owner-writable with one `updateDoc`, which for a credit
balance means free AI forever. Credit telemetry therefore lives on the Admin-SDK-only
day documents, and `firestore.rules` was not touched. If you do add a top-level field,
add its exact name to `entitlementFieldsLocked()` in the same commit.

`withUserCredits(uid, flow, fn)` resolves the business from the **caller's own user
doc**, never from the request, matching `activateSubscription` — and the reserve sits
*after* each flow's `requireUser`, so an unauthenticated replay cannot drain a
stranger's balance. `businessAnalysis` additionally re-throws `AiCreditsExhaustedError`
as the first line of its own catch, or that catch flattens an exhausted balance into
"Zen AI is currently over-leveraged, try again in a few seconds" and the owner retries
forever against a wall.

`generateContentPlan` and `api/admin/chat` stay free: platform-owner tooling, not
tenant usage.

### Credits are not sold — the allowance is the product

**A shop that needs more Zen AI upgrades a tier.** There are no packs, no top-ups and no
"pick your own amount" range. The allowance in `AI_MONTHLY_LIMITS` is the whole of the AI
product, which is why those three numbers carry the weight they do: an allowance too small
to work with can no longer be topped up, only upgraded past.

`aiBonusCredits` still exists on the business document and is still spent **after** the
monthly allowance, so a shop holding a balance is never refused a turn it can pay for.
It has exactly one writer left:

| Writer | Authenticated by |
|---|---|
| The grant control on `/admin-imamshaffy/ai-usage` | super-admin, through the rules catch-all |

The field is in `entitlementFieldsLocked()`, so a tenant cannot write its own balance with
an `updateDoc`. The grant moves it with **`FieldValue.increment` inside a
`runTransaction`**, never `previous + credits` — a chat turn is debiting the same field and
a read-then-write hands those credits back — and it appends a row to **`ai_credit_ledger`**
(`src/lib/ai-credit-ledger.ts`) in the same commit: append-only, `credits` always positive,
`balanceBefore`/`balanceAfter`. Spending is deliberately *not* in it — that is metered per
day on the rollups — so the collection's sum stays "credits ever given to this shop". It
needs **no `firestore.rules` entry**: the catch-all at the top of the file already grants
the platform owner read and write, and everyone else is denied by default. That also means
it is **not** readable client-side by a tenant; a customer-facing receipt list would need a
rule.

#### What was scrapped, and what to know before proposing it again

Credit packs shipped and were removed. Deleted: `src/lib/credit-packs.ts` (a
250/1,000/5,000 price list at ₦2,500/₦8,000/₦35,000), `src/actions/ai-credits.ts`
(`purchaseAiCredits`, the Paystack/NGN rail), and
`src/components/settings/ai-credits-section.tsx` (the `/billing` rail). Also gone: the Dodo
checkout route's `packId` branch with its three `DODO_CREDITS_*_PRODUCT_ID` env vars, and
the webhook's credit-grant branch.

Four things to carry forward, because they are the reasons rather than the mechanics:

- **The USD rail was never live.** `DODO_CREDITS_*_PRODUCT_ID` was never configured, so the
  dollar button always answered "not available yet". Any future credit product has the same
  obstacle: **Dodo needs a real product per price**, so an arbitrary amount needs either a
  pay-what-you-want product (unverified — the docs were unreachable) or `quantity` over a
  fixed unit, which forces a flat rate.
- **The price question is what killed it.** A single flat rate reprices both ends (250
  credits gets cheaper, 5,000 gets dearer); a volume curve that preserves today's three
  prices needs the arbitrary-amount mechanism above. Neither is a coding problem, and
  neither should be chosen inside a refactor.
- **The Dodo webhook now refuses a credit delivery** rather than ignoring it. Falling
  through would reach `if (businessId && planId)`, where a $2.50 payment carrying a
  `planId` could buy a plan. It logs the payment id and says to grant manually.
- **Historical rows are kept and must keep rendering.** `kind: 'credits'` on a `purchases`
  row and `kind: 'purchase'` on a ledger row are money that was actually taken.
  `src/lib/platform-revenue.ts` still owns the discriminator — `purchaseKind` reads a
  **missing** `kind` as `'subscription'` (every other row), `billingCurrencyByBusiness`
  skips credit rows so a USD pack cannot flip a naira subscriber onto the dollar price
  list, and lifetime/TTM totals deliberately keep them because those are totals, not rates.

#### Where a shop is told it is out

Nothing on `/ai-insights` takes money, and nothing quotes a price. The chat page shows an
**Upgrade** link beside the balance pill once the balance is under a tenth of the allowance
(floored at three — "5 left" is a warning on Starter's 3 and noise on Business's 600), and
on exhaustion the 429's `code: 'credits_exhausted'` raises a banner **instead of** a toast:
a toast disappears and leaves the shop staring at a composer that will keep refusing. The
banner names the allowance, says it resets at the start of next month, and offers one
button to `/billing`. It clears on `status === 'streaming'`, which is proof the server
accepted the balance, because a 429 never streams a token.

`code: 'credits_exhausted'` is matched on the string by the client and by the importer's
`AiCreditsError` — keep it stable even though the prose around it changed.

## Usage analytics — what is recorded, and what must never be

The admin board at `/admin-imamshaffy/ai-usage` reads three things:

- **`platform_stats/ai_usage_global/daily/{YYYY-MM-DD}`** — one platform-wide
  rollup per UTC day, written by `route.ts`. Everything time-based on the board
  comes from here.
- **`businessInstances.aiToolUsageCounts`** — per-tenant *lifetime* tool counts,
  which is also what the `uses` figure on `/ai-insights/use-cases` reads.
- **`ai_credit_ledger`**, newest 40 rows — the Credit ledger card. Ordering on one
  field needs no composite index, and this read is `.catch(() => null)`-tolerated on
  purpose: the ledger is newer than the rest of the board, so a rules or deployment
  mismatch should cost the page its ledger card and not every chart on it.

The **Cost ceiling** column is per-tenant, from `businessTokensIn`/`businessTokensOut` on
the day documents priced through `estimateCostUsd`. It is a ceiling rather than an invoice,
and a tenant with turns but no tokens reads `—` rather than `$0.00`: those day documents
predate per-tenant attribution (August 2026), and "cost nothing" and "was not measured" are
different answers. This column is the only thing that can tell you whether the credit
prices clear their marginal cost.

The **grant** control writes through a `runTransaction` — the increment plus a ledger row
in one commit — and takes an optional reason that ends up on the row. It validates the
amount first: `Number('')` is `NaN`, which Firestore rejects at the SDK boundary with a
message about unsupported field values that says nothing about credits, while `0` and
negatives commit happily and write a ledger row asserting a movement that never happened.

The shared vocabulary — intent rules, keyword allow-list, tool grouping — lives
in `src/lib/ai-analytics.ts`, which is imported by **both** the route and the
admin page. That module must stay free of `firebase-admin`; importing the Admin
SDK into it breaks the admin page's client bundle.

**Prompt text is never stored, and this is not an oversight to correct.** The
board is platform-wide, so an archive of raw prompts would put every tenant's
customer names, phone numbers and order details under the platform owner's eye
with no way for them to know. What gets written instead is derived and lossy:
one intent label per turn, plus matches against the fixed `KEYWORD_VOCAB`.

That allow-list direction is the whole safety property. A stop-word *filter*
would have to anticipate every word worth suppressing and leaks whatever it
failed to think of; an allow-list can only ever emit retail vocabulary decided
in advance, so a customer's surname has no path into the rollup even when it is
typed into the chat. Adding raw prompt samples is a policy decision to take
deliberately, not a line to slip into `onFinish`.

Three things that will bite:

- **The day rollup is written with nested maps, not the dotted keys used on
  `businessRef` in the same batch.** `update()` reads `'tools.queryProducts'` as
  a field path; `set()` does not, and would create a field *literally named*
  `tools.queryProducts` that nothing reads. The day document does not exist
  until the first turn of the day, so it has to be `set(..., {merge: true})` —
  which means nested maps are the only correct form there.
- **`latencyMsTotal` is a sum, not an average.** Divide by `count` at read time.
  Averages cannot be added, so storing one per day makes the multi-day figure
  wrong in a way that looks plausible.
- **History starts the day the recorder shipped.** Earlier days have no document
  rather than a zero, and the board says so instead of drawing a flat line —
  a flat line reads as "nobody used it", which is a different conclusion.

Blocked turns (`plan_limit`, `global_limit`, `injection`, `bad_history`) are
recorded on the same document *before* the model is reached, and never awaited:
analytics must not be able to turn a clean 429 into a 500. They are the most
useful numbers on the board — a day where a tenth of turns hit `plan_limit` is a
pricing signal, and repeated `injection` hits are a security one — and they are
invisible in the success count by design, because a blocked turn deliberately
never increments it.

Adding a signal to the rollup means adding it to `AiDailyStats` in
`ai-analytics.ts` too, or the admin page cannot see a field the route is
faithfully writing.

## The toolkit lives in `tools.ts`, not `route.ts`

`src/app/api/chat/tools.ts` exports `createZenTools({ db, businessId, currency, ratingEnabled })`
and returns the whole toolkit. `route.ts` is now only auth, quotas, the system prompt
and streaming. Add tools there, not in the route.

The count is deliberately not written down here. It is derived from `TOOL_LINES` in
`zen-status.tsx` (`ZEN_TOOL_COUNT`), which is the one list that *has* to stay in sync
because the status line renders raw camelCase without an entry — every number this doc
used to carry had gone stale by one or two. `npm run test:zen-cost` asserts the two
lists match in both directions.

`route.ts` passes the whole toolkit through with no whitelist, so a tool added to
`tools.ts` is live on the next request. The three places that still need a manual
entry are `TOOL_LINES` in `zen-status.tsx`, a `case` in `tool-renderer.tsx` if it
returns a new `type`, and the system prompt if the model needs telling *when* to
reach for it.

### That no-whitelist pass-through is also a security boundary

Because the toolkit goes to the model unfiltered, **every tool in `tools.ts` is
callable by every merchant on the platform.** The context it closes over is a
single `businessId`, so anything a tool reads outside that tenant's data is a
cross-tenant leak by construction.

This is why Zeneva's own cap table has a **separate route and toolkit**:

- `src/app/api/admin/chat/route.ts` — gated by `requireSuperAdmin(req)` from
  `../_guard`, exactly like the other `api/admin/*` routes.
- `src/app/api/admin/chat/cap-table-tools.ts` — read-only tools over the
  `cap_table` collection, computed through `src/lib/equity/engine.ts` so the
  assistant and the page cannot disagree about a number.

Putting a cap table tool in `tools.ts` instead would let any shop owner ask Zen
AI who owns Zeneva, what it is valued at, and what each investor paid. There is
no per-tool gate to add it behind — the whitelist does not exist.

The admin assistant has **no write tools at all**, not even `propose*`. Equity is
edited through the forms on `/admin-imamshaffy/investors`, which validate and
write to the append-only `cap_table_events` audit trail.

Its client is `src/components/admin/equity/cap-table-assistant.tsx`, which reuses
`ToolResult`, `Markdown` and `ZenMark` from `src/components/ai-insights/`. It
follows the same `ai@7` transport rule as the merchant page — `useChat` accepts
neither `api` nor `body` — except the credential is a Bearer ID token rather than
`businessId`/`userId` in the body.

Two Firestore constraints shape how these tools query — both cost real debugging
time, so do not "clean them up" into idiomatic queries:

- **`receipts` has no `(businessId, status, createdAt)` composite index.** Any
  tool that needs completed receipts over a date range filters `status` **in
  memory** after the range query. Adding `.where('status', ...)` alongside the
  `createdAt` range makes the tool throw at runtime, not at build time.
- **`auditLogs` has no `(businessId, createdAt)` composite index** — only
  single-field overrides. `getAuditTrail` fetches by `businessId`, then sorts
  and slices in memory.

Check `firestore.indexes.json` before adding a query with more than one
constraint. A missing index fails only when the tool is actually called, which
looks like the model malfunctioning rather than a query problem.

### "How do I…" answers come from `WORKFLOWS`, never from the model

`explainHowTo` returns one of ten hand-written walkthroughs (`bulkImport`,
`recordSale`, `addProduct`, `lowStockThreshold`, `addBranch`, `refund`,
`addStaff`, `invoice`, `stocktake`, `loyalty`) as a numbered `WALKTHROUGH` card.
The model picks a topic; it never writes the steps.

That split is the whole point. Asked to teach bulk import, the model first
answered "you'll find the import function on the Inventory page, look for an
Import or Bulk Upload option" — a shrug dressed as help — and then leaked two
copies of `linkToPage`'s rejection string into the reply. Steps it invents are
worse than none, because an owner hunting for a button that isn't on the screen
concludes the app is broken.

So the walkthroughs are written from the real UI. `bulkImport`'s CSV headers are
copied from `HEADER_MAPPINGS` in
`src/components/inventory/import-dialog.tsx` — **update both together**, or the
card documents a column the importer will not accept.

The topic list is a `z.enum`, and an unknown topic returns an error string
rather than a card. Adding a workflow means adding it in both places; the keys
and the enum must stay in step:

```bash
# both lists should match, and note the keys are camelCase — a [a-z_]+ pattern
# silently matches only 4 of the 10 and the check passes vacuously
grep -oE "^  [a-zA-Z]+: \{" src/app/api/chat/tools.ts   # WORKFLOWS keys
```

## The chat UI

Four components in `src/components/ai-insights/`. The page composes them; none
of them fetch.

### `zen-mark.tsx` — the brand glyph, animatable

The ring and crescent from `AppConfig.logoIconUrl`. The `d` attributes and the
`#ff9933 → #cc5200` gradient are copied verbatim from that data-URI, because a
data-URI `<img>` cannot be animated per-path — which is the whole point. If the
brand mark changes, re-decode `logoIconUrl` and copy the paths again rather than
redrawing by hand.

`viewBox` is `42 47 116 116`, not the logo's `0 0 200 200`. The glyph only
occupies x 60–140, y 55–154 inside the original box; at 32px avatar size that
padding shrinks the mark to a third of the space. The crop is centred on the
glyph's centroid and the paths are untouched.

`animated` sweeps a silver sheen across the mark — a narrow white band on a
horizontal gradient, painted over the orange fill and clipped to the glyph, so
it reads as light travelling *through* the mark rather than a rectangle sliding
past it.

**Gradient ids are per-instance** (`zen-mark-1`, `zen-mark-2`, …). SVG ids are
document-global; a shared id makes every mark after the first render wrong.

**Reduced motion is handled in JS, not CSS.** The sheen is SMIL
(`<animateTransform>`), which ignores `prefers-reduced-motion`, so `ZenMark`
reads `useReducedMotion()` and drops the sheen element entirely. The CSS
animations in `globals.css` are separately guarded by a media query.

### `zen-status.tsx` — what "working" says

"Thinking…" says nothing about a retail system. Before the first tool call the
status rotates through POS vocabulary every 2.4s ("Reading the shelves",
"Pulling the day book", "Reconciling the till"). Once a tool is actually running
the rotation freezes and the exact action shows instead ("Scanning inventory",
"Totalling the takings", "Ranking best sellers").

`TOOL_LINES` must have an entry per tool — its keys are matched against the tool
names in `tools.ts`, and an unlisted tool falls back to its raw camelCase name,
which looks unfinished. Both lists are currently 41 and in sync; if you add a
tool, add its line. To check:

```bash
grep -oE "^    [a-zA-Z]+: tool\(" src/app/api/chat/tools.ts | sed 's/[ :]//g;s/tool(//' | sort > /tmp/a
grep -oE "^  [a-zA-Z]+: '" src/components/ai-insights/zen-status.tsx | sed "s/[ :']//g" | sort > /tmp/b
comm -3 /tmp/a /tmp/b   # empty means in sync
```

### `markdown.tsx` — why replies were showing raw `**bold**`

The model emits `**bold**`, `-` bullets and occasional tables. The old page
rendered message text in a `whitespace-pre-wrap` div, so all of that markup
showed literally — that is the unformatted output the revamp was for.

Text now goes through `react-markdown` + `remark-gfm`. Element styles are
written out rather than using `@tailwindcss/typography`'s `prose`: prose imposes
its own font sizes and vertical rhythm, which fights the narrow chat column.

### `tool-renderer.tsx` — generative UI

`ToolResult` dispatches on `output.type`, so a tool controls its own rendering
by what it returns:

| `type` | renders |
|---|---|
| `PRODUCT_LIST` | product card grid, with totals when the tool supplies them |
| `PRODUCT_DETAIL` | one product large, with its photo at a size worth looking at |
| `PRODUCT_PICKER` | "Which one did you mean?" — cards with a % match badge |
| `METRICS` | stat tiles |
| `TABLE` | scrollable table |
| `CHART` | line / bar / pie, plus highlight tiles, a note and deep-links |
| `LINK` | a single tap-through button into an app page, with the walk-up `note` |
| `CUSTOMER_LIST` | customer cards — initials, spend, loyalty points, last-seen |
| `WALKTHROUGH` | numbered steps for a screen, tips, and the page link at the end |
| `PROPOSAL` | approve / reject card |
| anything else | nothing — the model summarises it in prose |

That last row is the failure mode to watch. A tool that returns a bare object
with no `type` renders as **nothing at all** — the model paraphrases it and the
owner sees prose where a card belongs. `queryCustomer` shipped that way. Every
tool now emits a type; check it stays that way:

```bash
grep -oE "type: '[A-Z_]+'" src/app/api/chat/tools.ts | sort -u        # emitted
grep -oE "case '[A-Z_]+':" src/components/ai-insights/tool-renderer.tsx | sort -u
```

The same silent-discard trap applies one level down, to *fields*: a tool can
send `sellingAtALoss` or `lifetimeValue` and the card will drop it without a
word if there is no line rendering it. Three separate fields were being
discarded that way. When you add a summary field to a tool, add the line that
shows it.

A negative number in a `TABLE` renders red. That is load-bearing rather than
decorative — an item selling below cost is exactly what "which products are
quietly losing me money" is asking for, and it used to render in the same grey
as everything else. It also means percent and money columns must be sent as
**numbers**, not pre-formatted `"${n}%"` strings; `getMarginAnalysis` sent
`Margin` as a string and its losses could not be highlighted.

`ChartCard` is one component for every chart: the **tool** owns the shape via
`chartKind`, `xKey` and a `series[]` of numeric keys with labels and formats.
That is why sales trends, peak hours, category splits and the daily report all
render from one place. Its optional `highlights`, `note` and `links` fields are
what make `getDailyReport` a report rather than just a bar chart — its takings,
profit and debt figures ride in `highlights`, so dropping that block silently
loses the numbers the owner asked for.

`ProductCard` mirrors the POS product card: same 96px contained image area,
`Package` placeholder, tinted stock badges, price bottom-left and stock
bottom-right. It adds a **Negative stock** badge, because the AI surfaces
oversold items that the POS grid never shows.

Cards render extra per-tool facts (`daysOfCover`, `capitalTiedUp`,
`daysRemaining`) only when the tool attached them, so one card component serves
valuation, coverage and expiry results without branching per tool.

## The injection filter has to survive a Nigerian product catalogue

`INJECTION_PATTERNS` in `route.ts` scans the latest user message and returns a
hard 400 on a match. There is no soft path — a false positive accuses a
shopkeeper of hacking mid-sale and gives them no way round it. So every pattern
has to be checked in **both** directions, and two shipped wrong:

- `/DAN/` — unanchored and case-sensitive, so it blocked every owner stocking
  **DANGOTE** cement, sugar, flour or salt. That is not an edge case in this
  market; it is the biggest FMCG brand in the country. Now `/\bDAN\s+mode\b/i`.
- `/ignore (all |previous |above |prior )?instructions/` — the alternation
  permitted exactly **one** adjective, so "ignore all previous instructions",
  the single most common injection string there is, sailed straight through.
  Adjectives stack; the pattern now allows a bounded run of them.

Also fixed: `/forget (what|everything|all|your|the)/` matched "forget the
discount, record it as cash" — ordinary POS correction phrasing.

Before changing a pattern, run it against both lists — brand names and real
correction phrasing on one side, actual attack strings on the other. Extract the
patterns from the file rather than retyping them, or the test proves nothing
about what ships:

```bash
node -e "
const src=require('fs').readFileSync('src/app/api/chat/route.ts','utf8');
const body=src.match(/const INJECTION_PATTERNS = \[([\s\S]*?)\n\];/)[1];
const P=body.split('\n').map(l=>l.trim())
  .filter(l=>l.startsWith('/') && !l.startsWith('//') && l.endsWith(','))
  .map(l=>l.replace(/,\$/,''))
  .map(s=>{const i=s.lastIndexOf('/');return new RegExp(s.slice(1,i),s.slice(i+1));});
console.log('patterns:',P.length);   // sanity-check this is ~13, not 0
"
```

That count check matters: a comment line starting with `//` parses as a regex
with junk flags, and a filter that silently extracts zero patterns passes every
test.

## Writes: why the server never writes

Zen AI has no write path on the server. A `propose*` tool returns a `PROPOSAL`
card and nothing else; the write happens on the client, through
`addToQueue`, only after the owner taps Approve.

That is deliberate. `addToQueue` in `pos-context.tsx` is the **single** write
path in the app, and it is the only thing that enforces RBAC, injects
`activeBranchId`, survives offline, and keeps the SQLite mirror in step. A
direct `updateDoc` from the chat page — which is what was there before — skips
all four. If you are tempted to have a tool write directly, that is the reason
not to.

### `proposal-guard.ts` — the model's output is untrusted input

Every proposal is re-validated on the client at the moment Approve is tapped,
against live POS-context records. The system prompt is a request, not a
constraint; an injected instruction inside a product name or a hallucinated
`productId` produces a card that looks perfectly ordinary.

Two things this catches that the server cannot:

- **Staleness.** The model read stock a minute ago; a cashier has sold three
  since. Approving "set stock to 12" on stale data silently reverses that sale.
  Drift tolerance is **zero** — a mismatch is refused with the live figure named,
  not quietly applied.
- **Existence.** A hallucinated id is refused rather than written.

`buildSaleFromProposal` mirrors `sales/pos/review/page.tsx` rather than trusting
the model's arithmetic. **Prices, tax and totals are all recomputed from the
master product records** — the model's figures decide *what* to sell, never *for
how much*. It also re-checks stock per line (overselling is refused), validates
the payment method against the same four the POS page accepts, and enforces
operating hours: `preventSalesOutsideHours` is a hard stop for non-admins, and
otherwise the receipt carries `flagged` so the sale still surfaces in reports.

Two traps worth naming, because both fail silently rather than loudly:

- **`businessId` must be passed in separately.** `businessData` comes from
  `docSnap.data()`, which carries no `id`. Reading `business.id` writes the
  receipt with `businessId: undefined`, and it then vanishes from every list
  that filters on it.
- **The queue payload keys are not uniform.** `update-customer` reads
  `payload.id`; `update-product` reads `payload.productId` and `payload.values`.
  Getting this wrong throws at *sync* time, not at approval time, so the card
  says it worked.

Anything refused returns plain-language text that goes straight into a toast, so
the owner learns why rather than watching a silent no-op.

## Deep links are allow-listed server-side

`linkToPage` refuses anything not starting with a single `/` (so no `//host`
protocol-relative escape and no external URLs) and then checks the path against
`APP_ROUTES` — a 29-entry table of the real pages under `src/app/(app)`. The
model supplies the label; it does not get to supply an arbitrary destination.

`/onboarding` is deliberately **not** in the table. It exists, but it is a
pre-setup flow, not somewhere to send an owner who is already trading.

**A near miss walks up rather than failing.** The model will hallucinate routes
that sound right — `/inventory/import` is the one that shipped broken — so an
unknown path drops its last segment until it finds a real page, and returns
`{ href, note, redirectedFrom }`. The `note` explains the swap ("bulk import is
a dialog on Inventory, not its own page") and `LinkCard` renders it. It used to
return an error string, which the model then read out loud, twice, and followed
with a working button — the whole answer read as a malfunction.

If you add a page under `src/app/(app)`, add it to `APP_ROUTES` or the model
cannot link to it. To find gaps:

```bash
find "src/app/(app)" -name page.tsx | sed 's|src/app/(app)||;s|/page.tsx||' \
  | grep -v '\[' | sort -u    # compare against the APP_ROUTES Set
```

`/ai-insights?q=...` opens the chat with that question already asked — the
use-cases page links its examples that way. The param is stripped with
`router.replace` immediately after sending, or a refresh re-asks the question
and burns another quota unit.

## The use-cases page

`/ai-insights/use-cases` is grouped by the question the owner has ("what am I
about to run out of?"), not by tool name — a list of 41 camelCase identifiers
tells nobody what to type. Every example is a link into `/ai-insights?q=…`, so
it asks for real.

The "uses" tile reads `aiToolUsageCounts` on the business document, which
`onFinish` in `route.ts` increments per tool call via dotted field paths. Tool
names are matched against `/^[A-Za-z]+$/` first — a dot in a key would write a
nested field instead of the counter.

Keep the page honest. A capability listed there that no tool backs is worse than
one left out: the owner asks, Zen AI cannot, and they stop trusting the rest of
the page.

## Disambiguation is a UI loop, not a prompt trick

The system prompt tells the model to call `findSimilarProducts` when it is not
certain which product the owner means, and **not** to guess between similar
names. That tool returns `PRODUCT_PICKER`, the page renders tappable cards, and
`handlePick` auto-submits `I mean "<name>" (SKU <sku>).` on the owner's behalf.

The SKU matters — it is what makes the model's next lookup exact instead of
another fuzzy match. Do not drop it to make the message read more naturally.

## Message layout

- **User prompts**: right-aligned, warm gray bubble (`bg-stone-100`, stone
  border), `text-sm`, no avatar. Deliberately smaller than the reply.
- **Replies**: left-aligned, no bubble, markdown-rendered, with the `ZenMark`
  avatar in a white circle.
- The mark animates **only on the reply currently streaming** — `streaming` is
  `isLoading && !isUser && i === messages.length - 1`. Animating every mark in
  the transcript makes the whole thread look busy.
- A `.zen-caret` block sits at the end of streaming text.

The system prompt tells the model **not to re-list rows that a tool already
rendered** — the cards are on screen, so repeating them as prose duplicates
everything. It should interpret instead: what stands out, what to do about it.
If replies start echoing table contents, that instruction is what regressed.
