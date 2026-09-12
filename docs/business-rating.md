# The business rating

The number in the top bar, the Reports → Business Rating tab, the badges on
`/achievements`, the focus card on the dashboard, and Zen AI's answer to "how is
my business doing". One score, five surfaces, one scorer.

**It is off until the owner asks for it** — see [Opt-in](#opt-in-the-rating-is-off-by-default)
below before touching any surface.

Read this before touching any of:

| File | What it is |
|---|---|
| `src/lib/business-rating.ts` | The scorer. Pure, no clock, no network. |
| `src/hooks/use-business-rating.ts` | Adds the memory of yesterday: delta, movers, streak, level-up. Owns `enabled`. |
| `src/hooks/use-rating-opt-in.ts` | Writes the flag from the Reports invitation card. |
| `src/components/reports/business-rating-panel.tsx` | The Reports tab, and the invitation card. |
| `src/components/dashboard/business-health-indicator.tsx` | The top-bar badge. |
| `src/components/dashboard/todays-focus.tsx` | Dashboard card — one action. |
| `src/components/achievements/rating-badges.tsx` | The badge grid. |
| `src/lib/rating-benchmark.ts` | Peer medians, shared by the writer and the reader. |
| `src/lib/server/analytics-cache.ts` | Where the benchmark is computed and published. |
| `getBusinessRating` in `src/app/api/chat/tools.ts` | Zen AI's read of it. |
| `RATING_SECTION_*` in `src/app/api/chat/route.ts` | The prompt half of Zen's gate. |

## Opt-in: the rating is off by default

A score out of 100 on a person's livelihood, in the chrome of every page, is not
something to hand somebody who never asked. So `settings.ratingEnabled` on
`businessInstances/{id}` gates every surface, and it has **three** states:

| Value | Meaning | What shows |
|---|---|---|
| `undefined` | never asked | the invitation card on the Reports tab, and nothing anywhere else |
| `false` | asked, declined | nothing, except a two-line pointer to Settings on that tab |
| `true` | opted in | everything, as before |

**Collapsing `undefined` into `false` is the mistake to avoid.** It re-pitches the
score to somebody who deliberately declined, every time they open Reports — which is
the original offence on a loop. That is why the hook exposes `neverAsked` separately
from `enabled`.

**`enabled === false` is not `score === null`.** `score === null` already means *not
enough sales to score yet*, and it makes the pillars render as unmeasured rather than
hidden. Conflating the two makes "why is my score blank" unanswerable.

**Gating the components is not enough — the hook writes to localStorage.** Two effects
in `use-business-rating.ts` are guarded on `enabled` as well:

- the 30-day history write, or an opted-out shop accrues an invisible per-device trail;
- the **tier high-water seeding**, which is the subtle one. It is a one-shot guarded on
  the key being absent, so if it ran while the rating was off, that single silent seed
  is spent on a reading nobody saw — and the day the owner opts in, their first genuine
  level-up is already marked as claimed.

**Zen AI takes two edits, not one.** Removing the tool is not enough, because the
system prompt *asks* for the rating by name: a model told the tool is off would keep
offering the score in prose. `RATING_SECTION_ON` / `RATING_SECTION_OFF` in
`src/app/api/chat/route.ts` are spliced in at `RATING_SECTION_TOKEN` per request, and
`getBusinessRating` refuses with an untagged result (no card) rather than being dropped
from the tool set. The route already loads the business doc for the AI quota check, so
the flag costs no read.

**`useRatingBenchmark(enabled)` takes the flag too.** Hooks cannot be called
conditionally, so an opted-out shop opening Reports would otherwise pay one Firestore
read per 12 hours for a benchmark it never sees.

**Opting out is display-only — the peer cohort still counts them.** The benchmark is
computed server-side in `analytics-cache.ts` across every business, it is anonymous
aggregate, it costs the shop nothing, and the cohort floors need volume. Opting out
means not being graded to your face, not being excluded from a median.

**No Firestore rules change.** The update rule on `businessInstances` is a deny-list
(`entitlementFieldsLocked()`) and `settings` is not on it, so the owner can already
write this. And it is written with the **dotted path** `'settings.ratingEnabled'`,
which merges into the existing map — never with `set()`, which does not parse dots.

## What it measures, and what it deliberately does not

**This is the money view.** Inventory condition — stockouts, missing photos,
reorder points — already has its own score on the Inventory page's Health tab.
Scoring it twice would tell a shop that tidying product records is how it grows,
which is false. So the rating scores only the four things that multiply revenue:

```
revenue = buyers × how often they return × basket size × margin
```

Each pillar is one of those terms. A shop can be perfectly stocked and score
badly here, and that is the point.

**Do not add a fifth pillar for inventory condition.** That is the one change
that would quietly undo the whole design.

## Three rules the scorer holds to

1. **It has to move.** The old rating came from
   `business.settings.businessAnalysis.businessHealth.score`, written only when
   somebody ran an AI report, so it sat frozen for weeks while the shop changed
   underneath it. This is arithmetic over rows the caller already holds.
2. **`now` is an input**, as in `src/lib/forensics.ts`. "Why did I drop four
   points" has to have an answer, and it cannot if the function reads the clock.
3. **Every figure is a count of real rows.** An unmeasurable pillar reports
   `measured: false` and drops out of the weighted average rather than scoring
   zero — a shop with no cost prices has an *unknown* margin, not a bad one.

## The dormant-buyer trap

This one shipped wrong once and is the easiest to reintroduce.

The receipt listener holds **200** receipts (`pos-context.tsx`) while customers
sync in **full**. So "customers on file with no receipt in the 60-day window" is
mostly *people whose receipt fell off the end of the listener*, not lapsed
customers. Valuing all of them at the shop's average basket produced
*"Win back 2,900 quiet buyers · ₦14.5M"* — a headline that measured the listener
cap rather than the shop, and the kind of number that makes an owner distrust the
whole page.

The split that replaced it:

- **`lapsedBuyers`** — bought inside the window, nothing in the last 30 days.
  Observed rows, each with a real basket history. This is the only group that
  gets a money figure, and it is valued at **each buyer's own average basket**,
  never the shop-wide average. A quiet ₦2,000 buyer is worth ₦2,000.
- **`neverSeenCustomers`** — on file, no receipt in the window. **Counted, never
  priced.** Surfaced only as the `repeat` pillar's `fix` label, and only when
  `facts.truncated` is false, because that is the only time it means what it says.

`customers: null` means *the caller has no customer list* — which is not the same
as an empty one. It sets `customersKnown: false` so the never-seen count reads as
unknown instead of a confident zero. The Zen tool passes `null` on purpose rather
than paying thousands of document reads for one clause of a chat answer.

## Points versus money

- **Money** on an `Opportunity`. A shop does not care that winning back its
  lapsed buyers is worth six points; it cares that it is worth ₦480,000.
- **Points** on a `RatingPillar` (`headroom`). A pillar meter *is* the score, so
  "+6 pts" is the literal arithmetic. `headroom` is computed against the weights
  as actually renormalised over the measured pillars, so the four figures sum to
  the gap between the current score and 100 and cannot over-promise.

Never convert one into the other in either direction. The system prompt for
`getBusinessRating` tells the model the same thing.

## What makes it worth reopening

- **`movers`** — the per-pillar attribution behind `delta`. This is rule 2 paid:
  the score never moves without saying which pillar moved it. Requires the pillar
  scores in each snapshot, which is why `RatingSnapshot` carries `p`. Entries
  written before that existed have no `p` and must read as *no attribution
  available* — never as four zeros, which renders as a crash that never happened.
- **`fix`** on every pillar — the one action, derived from the figures rather than
  chosen from a table of retail advice. The panel opens the highest-`headroom`
  pillar on arrival so the page always shows a next step without a click.
- **`streakAtRisk`** — a live streak that yesterday earned and today has not yet
  renewed. Honest (it is a fact about today) and it expires at midnight, which is
  why it out-ranks a money opportunity on the dashboard card from three days up.
- **`leveledUpTo`** — a tier crossed for the first time, against a stored
  high-water mark so the same ground is never celebrated twice.

## Insight of the day — the *why*, and the line it must not cross

`src/lib/rating-insights.ts` supplies one card a day explaining why a shop like
theirs leaves money on the table. It is the only part of this feature that makes a
general claim, so the split between claim and evidence is enforced by the shape of
`RatingInsight` itself:

| Field | What it is | Rule |
|---|---|---|
| `principle`, `because` | how retail works | written here in advance, **no figures** |
| `yours` | their own arithmetic | always from `RatingFacts` or a summed `Opportunity` |
| `peer` | the median shop | a real median over a real cohort, or **absent** |

**A statistic nobody measured may never appear.** "83% of small businesses fail
because…" is banned outright: a principle asserts a mechanism the owner can check
against their own number on the same card, where a fabricated percentage asks them
to take it on faith. If a new insight needs a number to be persuasive, that number
has to come out of `RatingFacts`.

**`peer` carries both sides itself, and both are pillar scores.** It does not pair
with `yours`, because those are different quantities — `yours` is a business figure
(a share of single-item sales, a margin) and the only peer figure that exists is a
score out of 100. Drawing "58%" beside "42/100" as two bars compares a share of
sales against a score. The card draws both peer bars against **100, not against
each other**: scaling to the larger turns 37 against 42 into 88% beside 100%, a
rout over a five-point gap. The delta chip carries the precision true scale gives up.

Two ranking rules that are load-bearing:

- **`margin-blind` outranks `margin-thin`** by a `+1_000_000` weight and the two are
  mutually exclusive. Advising a price rise to a shop that has never recorded a cost
  price is advice it cannot act on or verify.
- **Praise requires a cohort.** `ahead-{pillar}` only exists when a real median
  exists to be ahead of — the same rule the rest of the feature follows about
  invented comparisons. Its headline figure is the *gap*, not the score, because the
  score is already the left-hand bar directly beneath it.

**`ceilingInsight` is the floor, not a filler.** A shop scoring in the nineties with
no cohort qualifies for nothing at all, and the card used to vanish for exactly the
owners most likely to keep the daily habit. The fallback names the weakest measured
pillar and reuses **that pillar's own `fix`** rather than inventing new advice. It is
reached only when nothing else qualified, so it never competes with a real problem.

The rotation is `dayNumber(now) % min(ROTATION, candidates.length)`, so the card is
the same at 9am and 5pm — a card that reshuffles per render is a slot machine, not
advice — and `now` is an input here too, so *"why did it change"* has an answer.

### Animation conventions

The movement is the reward, so it is deliberately cheap and deliberately finite:

- **Nothing loops except the flame.** `StreakFlame`'s flicker and embers loop
  because a fire that holds still is not a fire; everything else — the sheen, the
  count-ups, the bars — runs **once on reveal**. A card that keeps moving stops
  being read.
- **Every animation is gated on `useReducedMotion`**, and `useCountUp(value,
  enabled)` takes that gate as its `enabled` argument so the figure lands on its
  final value rather than animating invisibly.
- `useCountUp` **re-targets rather than restarts**: the rating recomputes when a sale
  lands, and a figure that snapped back to zero in front of the owner would read as
  a reset.
- **At-risk is cool and desaturated, never red.** A streak that today can still
  save is not an error state.
- `StreakFlame`'s gradient ids come from `React.useId()`. Hardcoding them makes two
  flames on one page share a gradient — the same trap documented for `ZenMark`.

### Only the Reports panel fires the confetti

The hook must never call `triggerConfetti`. Two components consume it and the top
bar is mounted on **every page**, so celebrating in the hook fires twice and fires
over whatever the owner was doing. The hook reports `leveledUpTo` and hands back
`acknowledgeLevelUp()`; the panel is the single caller that celebrates and then
acknowledges. Until it does, the level-up stays pending — so an owner who never
opens the tab still gets the moment the first time they do. The badge shows a dot.

### History is per-device, on purpose

30 entries in `localStorage` via `secureStorage`. The owner pays per Firestore
read and a rating history is not worth a document write a day. The cost is that
the trend starts empty on a second device, which is why the panel captions how
many days it actually has, and why **badges must not depend on stored history**:
`longestStreak` is derived from the receipts themselves so a badge earned on the
desktop does not appear unearned on the phone.

### `today` has to roll over

The hook holds `today` in state and re-arms a timer at local midnight. This is a
desktop till that stays open for days — a `today` frozen at mount freezes the
score, the streak, and the day key written to history with it, and the shop comes
back on Thursday to Monday's number.

## The peer benchmark

Real medians over real shops, or nothing. Never a percentile derived from the
shop's own score.

**It costs no extra Firestore reads.** `getCachedPlatformAnalytics`
(`src/lib/server/analytics-cache.ts`) already reads every receipt and product on
the platform every six hours to fill the admin overview. The benchmark is
arithmetic over rows already in memory, plus one document write.

Published to `platform_stats/rating_benchmark`, which under the existing
`platform_stats/{docId}` rule is already readable by any signed-in user and
writable only by the Admin SDK (which bypasses rules). **No `firestore.rules`
change was needed to ship this**, which also keeps it clear of the
deploy-app-before-rules ordering trap.

Three things that must not be relaxed:

- **`BENCHMARK_MIN_SALES` (20)** — a business joins the cohort only once it has
  traded. Without it the median is set by abandoned trials and every real shop is
  told it is above average.
- **`BENCHMARK_MIN_COHORT` (5)** — suppresses the whole document, *and each pillar
  separately*. The per-pillar floor matters more than the overall one: margin is
  only measurable where cost prices exist, so its cohort can be far smaller than
  the score's. A median over three shops is close to naming one.
- **A too-small cohort leaves the old document standing** rather than clearing it.
  Blanking the panel for every shop because one scan caught a thin slice is the
  worse failure.

Write it with a **plain nested object**. `set()` does not parse dots as field
paths — the same trap that once wrote a field literally named `pageViews.route`
and read back nothing.

Two limits the UI states rather than hides: the 50k scan caps are unordered
slices, and the recompute is opportunistic (it happens when something triggers the
six-hourly cache). So the panel captions the comparison with `updatedAt`, never
implying it is live.

The client reads it through `src/hooks/use-rating-benchmark.ts`, cached 12h in
`secureStorage`. **`null` is the normal state, not an error** — the document does
not exist until a cohort qualifies. Callers render nothing rather than an
em-dash.

## Zen AI's reading is the more accurate one

`getBusinessRating` calls the same pure scorer, so it cannot quote a different
number from the page. Two deliberate differences, both in its favour:

- `receiptsSince(60)` is a real query, so there is **no 200-receipt cap** and
  `facts.truncated` comes back false.
- `customers: null` — see above.

Receipts are **not** filtered through `isPaid`, matching the client: a void
deletes the receipt outright, so anything still present was a sale.

Adding any tool means a `TOOL_LINES` entry in
`src/components/ai-insights/zen-status.tsx` — that map is also what
`ZEN_TOOL_COUNT` and the admin board count from — and a check that
`groupForTool` in `src/lib/ai-analytics.ts` actually matches the new name.
`getBusinessRating` needed a `Rating` rule added there or it would have been
filed under Inventory.

## Verifying a change

There is no test runner in this repo. For the scorer, drive
`computeBusinessRating` from a throwaway `npx tsx` script with synthetic receipts
— it is pure and takes `now`, which is exactly what makes that possible. Check at
minimum: a 3,000-customer / 200-receipt shop reports no four-figure buyer counts;
`customers: null` omits rather than zeroes; `headroom` sums to `100 − score`; an
unmeasured pillar stays out of the total and claims no headroom; and an empty shop
scores `null`, not `F`.

`rating-insights.ts` and `rating-benchmark.ts` are pure in the same way and worth
driving the same way. Check: no `peer` clause exists without a benchmark; every
`principle` and `because` is free of digits (`!/\d/.test(...)`); both sides of every
`peer` are pillar scores in `0..100` and `mine` equals that pillar's own `score`;
the card is identical at 08:00 and 20:00 but differs across days; `margin-blind`
never coexists with `margin-thin`; a flawless shop still gets a `ceiling-*` card and
a troubled one never does; and the benchmark returns `null` both below
`BENCHMARK_MIN_COHORT` shops and when every shop is under `BENCHMARK_MIN_SALES`.

**A harness must be `.ts`, not `.mts`.** The repo has no `"type": "module"`, so tsx
compiles `src/**` to CJS; a true-ESM `.mts` importer then fails named-import interop
and reports `does not provide an export named 'RATING_WINDOW_DAYS'` for a constant
that is plainly exported. The export is fine — the extension is not.

**Never run a second `next dev` in this directory.** Two servers share `.next`, which
corrupts `cache/webpack/server-development.pack.gz` (`invalid code lengths set`) and
then fails unrelated modules with `Cannot read properties of undefined (reading
'call')` — the reported stack points at whatever imported them, e.g. `ui/tabs.tsx`,
which sends you looking in the wrong file. Recovery is to stop every dev server,
`rm -rf .next/cache/webpack/*-development*`, and restart one. Use the server that is
already running instead, on `127.0.0.1:9007` — not `localhost`, which resolves to
`::1` where a stale server can answer.

Curl can only prove the module graph compiles; the rating surfaces sit behind auth
and a hydrated POS context, so a `200` is not a rendered panel. What is worth
checking without credentials: every new module appears in
`.next/server/app/(app)/reports/`, and each `animate-*` utility plus its `@keyframes`
is emitted into `.next/static/css` — Tailwind only emits classes it can find, and
these live in new files.
