# Zeneva — product blueprint

What the product is, what it does, and the design language it is built in.
This is the *product* view; `docs/technology.md` is the architecture view and
explains why each technology is there.

Checked against the tree in August 2026 (version 3.1.7). The original version of
this file described a blue-and-purple app in Space Grotesk — none of which is
true any more, so the palette and type sections below are read from
`src/app/globals.css` and `tailwind.config.ts` rather than from intent.

---

## What Zeneva is

A local-first retail POS and ERP for shops that cannot afford to stop selling
when the internet stops working. One Next.js codebase ships as a Tauri desktop
app (Windows/macOS), an Android app, and a web portal.

Multi-tenant throughout: every document is bound by `businessId`, and tenant
isolation is enforced in `firestore.rules`, not only in application code.

---

## Core features

**Inventory** — product catalogues bound by `businessId`, with variants grouped
by name over separate SKU/price rows, CSV bulk import/export via `papaparse`,
supplier debts, and per-branch stock. `/inventory/troubleshoot` is an
algorithmic data-health scanner: missing prices, uncategorised products,
probable duplicates, negative stock.

**Point of sale** — a guided four-screen flow (`select-products` → `customer` →
`payment` → `review`) with cart editing, discounts and coupons, customer
association, parked sales, and receipt generation. Sales are queued actions, so
the register keeps working offline.

**Receipts and invoices** — printable, exportable and shareable receipts
(`html2canvas` + `jspdf`), thermal-printer support on desktop, emailed digital
receipts, and a separate invoice ledger for outstanding balances.

**Customers** — directory, spend history, loyalty points, last-seen.

**Branches** — multiple locations per business, with an active-branch switcher.
`addToQueue` injects `activeBranchId` on every write, which is why branch
attribution is correct even for sales recorded offline.

**Zen AI** (`/ai-insights`) — a chat with 41 typed tools over the business's own
data: sales velocity, trapped cash in slow-moving stock, replenishment
suggestions, margin analysis, walkthroughs. Two boundaries it never crosses:
it never writes on the server, and it never stores prompt text. Full detail in
`docs/zen-ai.md`.

**Reports and dashboard** — takings, profit, debt, peak hours, best sellers,
category splits, and a daily report.

**Storefront** — a customer-facing catalogue with online orders.

**Users and RBAC** — `admin`, `manager` and `vendor_operator` roles with a
fine-grained permission map per profile (`record_sales`, `manage_inventory`,
`view_customers`, …). Enforced on writes by `addToQueue` and re-verified
server-side, because server actions are public endpoints.

**Audit log** — every change, by whom, when.

**Admin console** (`/admin-imamshaffy`) — platform-wide GMV/MRR/ARR, AI usage,
support, achievements, cap table, and the Marketing Studio recorder. Aggregates
are computed server-side and cached in Redis, never read from Firestore by the
browser.

Thirty pages under `src/app/(app)`, of which 29 are linkable by Zen AI —
`/onboarding` is deliberately excluded as a pre-setup flow.

---

## Design language

### Colour

Zeneva is **orange**, not blue. One accent carries the whole product; the
neutrals do the rest of the work.

| token | light | dark | role |
|---|---|---|---|
| `--primary` / `--accent` / `--ring` | `#F47125` | `#F47125` | the single accent — actions, focus, active state |
| `--background` | `#FFFCFA` | `#09090B` | page ground (warm white, not pure white) |
| `--foreground` | `#030711` | `#FAFAFA` | body text |
| `--muted-foreground` | `#64748B` | `#A1A1AA` | secondary text |
| `--destructive` | `#EF4444` | `#7F1D1D` | refunds, deletions, negative figures |

`--destructive` is the one token that genuinely changes character between
themes: a bright red on white, a deep oxblood on near-black. Both read as
"stop" against their own ground, which a single value would not.

The accent is identical in both themes; only the neutrals invert. That is what
keeps a dark-mode screenshot recognisably the same product.

The brand mark is a ring and crescent on a `#ff9933 → #cc5200` vertical
gradient, stored as a data-URI in `AppConfig.logoIconUrl` (`src/lib/config.ts`).
`ZenMark` re-draws those exact paths as inline SVG so they can be animated per
path — see `docs/zen-ai.md`.

Charts use five ramps (`--chart-1` … `--chart-5`), and the two themes do **not**
agree. Light mode is five oranges off the brand hue (22/25/15/35/10). Dark mode
is the stock shadcn ramp — blue, green, orange, purple, pink — which is the one
place in the app where dark mode introduces colours the brand does not use. It
is inherited from the starter theme rather than chosen; if charts ever look
off-brand in dark mode, that is why, and the fix is to port the light ramp's
hues across at dark-appropriate lightness.

### Type

Loaded in `src/app/layout.tsx`, mapped in `tailwind.config.ts`:

| class | family | used for |
|---|---|---|
| `font-headline` / `font-display` | Bricolage Grotesque | headings |
| `font-body` | DM Sans | body copy |
| `font-instrument-serif` | Instrument Serif | marketing display type (one component) |
| `font-code` | Source Code Pro | code and SKUs |

Inter and Plus Jakarta Sans are also loaded, and are used by the blog, terminal
and marketing-site layouts rather than by the app shell.

### Shape and motion

`--radius: 0.5rem`. Hairline borders (`--border`, `--input`) rather than heavy
shadows. Lucide icons, in 190 components. Framer Motion for card lifts and panel
transitions — subtle enough that a POS still feels like a tool, not a toy.

Every CSS animation is guarded by `prefers-reduced-motion`; the one SMIL
animation (`ZenMark`'s sheen) is guarded in JS instead, because SMIL ignores the
media query.

---

## Rules that shape the product

These are product decisions, not implementation details — they are why the app
behaves the way it does:

- **Entitlements gate features; they never brick the shop.** A lapsed paid plan
  downgrades to free rather than locking the register mid-sale.
- **One write path.** Sales, stock changes and customer edits all go through
  `addToQueue`, which is what makes RBAC, branch attribution, offline survival
  and the SQLite mirror work at all.
- **Firestore bills per read**, so the app caches locally and the admin
  dashboards read a cached aggregate instead of raw collections.
- **The AI proposes; the owner approves.** Zen AI cannot change data on its own.

---

Related: `docs/technology.md` (architecture and stack), `docs/zen-ai.md` (the
chat in depth), `docs/android-signing.md` (release signing),
`radix_layout_gap_fix.md` (the overlay layout-shift fix),
`scripts/record/README.md` (the marketing recorder).
