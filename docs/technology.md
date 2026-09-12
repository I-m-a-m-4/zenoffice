# Zeneva — the technology stack, end to end

What Zeneva is built from, why each piece is there, and what the less obvious
parts actually do. This is the "explain the whole thing" document: the README
sells the product, the docs in this folder debug specific subsystems, and this
one maps the territory — so it is written as *why*, not *how to run*.

Everything below was checked against the tree in August 2026 (version 3.1.7).

---

## 1. The shape of the system

Zeneva is a **local-first retail POS/ERP** that ships as a **desktop app**
(Windows/macOS), an **Android app**, and a **web portal** — all sharing one
Next.js codebase, with the native shells provided by Tauri.

The load-bearing idea is that a shop's point of sale must keep working when the
internet does not. That pushes everything about the architecture:

```
                 ┌──────────────────────────────┐
                 │     Next.js 15 + React 19     │  one codebase
                 │  (App Router, Turbopack)      │
                 └──────────────┬───────────────┘
              ┌─────────────────┼──────────────────┐
        ┌─────▼─────┐     ┌─────▼─────┐      ┌─────▼─────┐
        │  Tauri 2  │     │   PWA     │      │   Web     │
        │  desktop  │     │  Android  │      │  portal   │
        └─────┬─────┘     └─────┬─────┘      └───────────┘
   ┌──────────┼──────────┐      │
   │ SQLite   │Stronghold│      │  Service Worker
   │ offline  │ key vault│      │  (offline cache)
   └──────────┴──────────┘      │
                                │
              ┌─────────────────┴─────────────────┐
              │           Firestore               │  source of truth,
              │        (multi-tenant)             │  synced, not copied
              └───────────────┬───────────────────┘
                              │
              ┌───────────────┼───────────────────┐
              │  Zen AI route  │  server actions   │  all gated by
              │  (typed tools) │  (RBAC-checked)   │  ID-token auth
              └───────────────┴───────────────────┘
```

The three platforms are not three front-ends. `scripts/prepare-tauri.mjs`
**deletes `src/app/api` for native builds** — the desktop and mobile shells have
no API of their own and call the hosted one by absolute URL, which is why every
route handler carries `OPTIONS` + CORS headers (a JSON body triggers a
preflight).

---

## 2. Desktop shell — Tauri 2.0

**Why Tauri and not Electron.** A POS sits on a shop counter with other
software running; a 250MB Electron runtime is the wrong resident. Tauri 2.0 is a
Rust core with the OS webview as the rendering engine — the app ships at a
fraction of the memory and disk footprint, and the JS bundle talks to the Rust
core through `@tauri-apps/api`.

The desktop-specific pieces:

- **SQLite via `@tauri-apps/plugin-sql`** — the local-first engine.
  `src/lib/sqlite-sync.ts` mirrors critical business data (business, products,
  customers, receipts) into `zeneva.db` so a shop keeps operating if the
  machine goes offline or IndexedDB is cleared. Sales and inventory writes land
  against the local mirror and are queued for sync.
- **Stronghold (`@tauri-apps/plugin-stronghold`)** — a Rust-implemented,
  encrypted key-value vault for secrets that should never touch the filesystem
  in plaintext: enterprise API credentials, offline session keys, DB secrets.
- **Peripherals** — thermal receipt printers and barcode scanners plug in at
  the native layer, which is the other reason the desktop shell exists at all.
  `html5-qrcode` drives the camera for barcode scanning, `react-barcode` and
  `qrcode.react` generate the physical barcodes and payment/receipt QR codes,
  and `html2canvas` + `jspdf` render receipts client-side and compile them to
  PDF for thermal or system printers.
- **Native notifications** — `@tauri-apps/plugin-notification` on desktop;
  Firebase Cloud Messaging (`firebase-messaging-sw.js`) on Android/web.

The web side of the same local-first story is the **PWA** (`@ducanh2912/next-pwa`),
whose service worker precaches the app shell so the portal works offline too —
and whose precached bundle occasionally causes the classic "stale build served
over my source changes" bug documented in `docs/zen-ai.md`.

---

## 3. Data — Firestore as the source of truth, synced not copied

**Firebase v11** (`firebase`), with **`firebase-admin` v13** for the server
side. Firestore is the multi-tenant source of truth: every document is bound by
`businessId`, and the security rules in `firestore.rules` enforce tenant
isolation and the ownership boundary on entitlement fields (plan, access level,
trial expiry are rule-locked and can only be changed by server writes).

Three properties that shape everything else:

1. **Firestore bills per read.** This is a standing constraint on the whole
   app — gate unconditional fetches behind an empty local cache, keep the admin
   dashboards off raw collections, and never "just add a realtime listener"
   to something that used to fetch once. (More in §6.)
2. **Client writes go through one choke point.** A sale, stock change or
   customer edit is a *queued action* (`src/context/pos-context.tsx`,
   `addToQueue`), which is what enforces RBAC, injects the active `branchId`,
   survives offline, and mirrors into SQLite. A direct `updateDoc` skips all
   four. This is a deliberate architecture: one place that knows how to write.
3. **Entitlements gate features, they never brick the shop.** A lapsed paid
   plan downgrades to the free tier rather than locking the register
   mid-sale; paid features are gated individually via `effectivePlan` in
   `src/lib/plan.ts`.

**IndexedDB** (`src/lib/idb.ts`) holds the client-side cache that makes reads
cheap and offline work; the SQLite mirror is the deeper safety net. The data
layers, in order of desperation: Firestore → IndexedDB cache → SQLite mirror.

---

## 4. Zen AI — the chat, the tools, and the boundary it never crosses

Zen AI (`/ai-insights`) is the generative part: a chat that can act on the
business's own data. The deep dive lives in `docs/zen-ai.md`; the stack-level
facts are:

- **`ai` v7 + `@ai-sdk/react` v4** — the SDK pair for streaming chat. The
  version numbers are not meant to line up. The model is **Gemini** via
  `@ai-sdk/google`; Genkit (`genkit` + `@genkit-ai/google-genai`) powers the
  deterministic analysis side (sales velocity, trapped cash in slow-moving
  stock, replenishment suggestions).
- **The tools live in `src/app/api/chat/tools.ts`** — not in the route. Each is a
  typed capability (look up a product, analyse a trend, draft a reply). Two of
  their query shapes deliberately have **no Firestore composite index** and
  filter in memory, because a "proper" indexed query would throw at call time.
  The count is not written down anywhere but `TOOL_LINES` in `zen-status.tsx`,
  which derives `ZEN_TOOL_COUNT`; every doc that hardcoded it had drifted.
- **The route is a security boundary first.** `src/app/api/chat/route.ts`
  opens with a prompt-injection/jailbreak filter, and the docs are candid that
  the filter has to survive a Nigerian product catalogue (a keyword like "DAN"
  matching a cement brand would block a legitimate query). `convertToModelMessages`
  is async and a missing `await` there is invisible — it was a real bug.
- **Zen AI never writes on the server, and never stores prompt text.**
  - Writes: a `propose*` tool returns a *card*; the actual write happens on the
    client through `addToQueue` after the owner approves, re-validated by
    `proposal-guard.ts` against live data. The server has no write path, which
    is what makes the model's output harmless even when it is wrong.
  - Analytics: the `/admin-imamshaffy/ai-usage` board answers "what are people
    asking" from an **intent label plus a fixed keyword allow-list**
    (`src/lib/ai-analytics.ts`), written per day to a platform-stats doc. Raw
    prompts are never stored — that is a privacy boundary, not a missing
    feature.
- **Quotas** — `aiDailyLimit` + `effectivePlan` cap daily AI usage per
  business.

---

## 5. Auth, RBAC, and the two sides of the security model

- **Auth** — Firebase Auth with email/password, ID tokens verified server-side
  (`requireSuperAdmin` / `requireUser` in `src/actions/admin-guard.ts`).
- **Roles** — `admin`, `manager`, `vendor_operator`, with a fine-grained
  permission map on each profile (`record_sales`, `manage_inventory`,
  `view_customers`, …). `addToQueue` enforces it on writes; the server actions
  in `src/actions/` re-verify the ID token on every export (`admin-guard.ts`),
  because **server actions are public endpoints** — a Next server action is
  just a POST endpoint with nicer ergonomics, and anyone can call it.
- **A standing rule: entitlement fields are owner-only** — plan, access level
  and trial expiry are rule-locked; paid upgrades are server-written, never
  client-written.
- **Android signing** — the registered upload key alias is `zeneva`, and the
  local `key.properties` saying `keyAlias=upload` is wrong (that caused a
  real Play rejection). The keystore is never generated in CI; `release.yml`
  verifies the built AAB's fingerprint against an `EXPECTED` value and fails
  the job on mismatch. Full story: `docs/android-signing.md`.

---

## 6. The platform-admin layer — Redis, and why it is there

The `/admin-imamshaffy` dashboards (GMV, MRR, ARR, sales velocity, user counts)
cannot read Firestore directly: a global aggregate over 10k+ receipts is
megabytes of documents and a firehose of reads — and Firestore bills per read.

So `src/lib/redis.ts` + `src/lib/admin-api.ts` do this: a **serverless
aggregation via the Firebase Admin SDK** computes the global numbers, then
caches the result in **Upstash Redis**. The browser pulls a kilobytes-sized
JSON blob from the API instead of thousands of documents, the admin screens
load in well under 200ms, and the cache invalidates on a TTL with a manual
"refresh" button. The *server actions are public endpoints* rule applies here
too: the admin API routes verify an admin ID token before returning the
aggregate.

The same "compute once, cache, bill once" instinct runs through the rest of
the platform — see the Firestore cost constraint in §3.

---

## 7. The tricky operational details (things that burned real time)

These are documented here so the next person does not rediscover them the hard
way. Each has its own doc; the one-line version:

- **`api/<route>` 404s and the client reports "Unexpected token '<'"** — the
  route file was renamed to `route.ts.bak` during an old static-export
  experiment. A missing route returns the HTML 404 page, and `response.json()`
  chokes on `<!DOCTYPE`. Check for a `.bak` before debugging JSON parsing.
  (`CLAUDE.md` has the full list.)
- **`force-static` was injected into those renamed files** and is meaningless
  on a POST handler. All current handlers are correctly `force-dynamic`.
- **Route warming in the recorder** — the dev server compiles on demand, so a
  recorded take warms each route before the camera rolls; the compile cache
  lives in the server process, so warming once per run is enough.
- **A BOM in the middle of a file** — a PowerShell `>` redirect wrote a UTF-8
  BOM mid-file and corrupted a route. Use the Bash tool for heredocs and
  `cmd /c` for binary redirects; never PowerShell `>` to write files.
- **The PWA service worker serves stale builds** — `npm run build` leaves a
  production `sw.js` that the dev server then serves, precaching *built* chunks
  over your source. A stale stack-trace line number means a stale worker, not a
  bad edit. The dev guard unregisters stray workers but spares
  `firebase-messaging-sw.js` (killing that breaks push in dev).
- **The `ai` + `@ai-sdk/react` version pair must stay `ai@7` + `@ai-sdk/react@4`**
  — on v7 `useChat` accepts neither `api` nor `body`; passing them is silently
  ignored, which strips `businessId`/`userId` and makes every prompt 401.

---

## 8. The marketing recorder

The admin area's Marketing Studio drives a **headless-Chrome recorder**
(`scripts/record/`) that logs into the real app and records real flows with a
custom cursor, click effects and camera moves — so a "product video" is actual
footage of the POS flow, not an animation mock. The full mechanism is in
`scripts/record/README.md`; the stack facts:

- **Raw Chrome DevTools Protocol over Node's global `WebSocket`** — no
  Playwright, no new npm dependencies. The only external requirement is ffmpeg
  on PATH.
- **Constant-rate sampling** — frames are written at a fixed rate as one
  concatenated MJPEG stream (one append per frame, not one file), and video
  time is just `frameIndex / fps`. This deleted the two-clock problem the
  variable-duration encoder used to have.
- **The camera is an encode-time filter** — `zoompan` punch-ins and the phone
  chassis are applied by ffmpeg *after* capture, never as CSS transforms on the
  page, so the page renders exactly as it always did.
- **Audio is synthesised** — the bed and click/keystroke ticks are generated
  with ffmpeg filters (`scripts/record/audio.mjs`), so there is no licensed
  binary in the repo. A supplied music track can replace the bed.
- **Speed is measured, not guessed** — `--timings` prints per-stage wall-clock;
  the encoder was benchmarked on a fixed capture and the results (including
  which levers do *not* help) are recorded in `scripts/record/README.md`.

---

## 9. The rest of the stack, briefly

- **Framer Motion** — the micro-animations (card lifts, panel transitions)
  that make the POS feel tactile.
- **Tailwind CSS 3** — styling; the codebase predates Tailwind v4 and stays on
  v3 deliberately.
- **TypeScript + Zod** — typed across the wire; the Zen AI tool schemas in
  `src/app/api/chat/tools.ts` are Zod-validated, which is what makes the
  model's arguments safe to act on.
- **i18n** — 11 locale catalogs in `src/lib/i18n/messages/` (`ar, de, en, es,
  fr, hi, it, ja, ko, pt, zh`). One new key is eleven edits, and a `$-anchored`
  grep silently misses seven of the catalogs — add keys to all of them.
- **Email** — `resend` + `nodemailer` for digital receipts, audit logs and
  operational reports.
- **OTP / MFA** — `otpauth` and `crypto-js` for one-time passwords and
  locally-encrypted transaction state.
- **CSV** — `papaparse` for bulk inventory import/export.
- **~66 app pages, 172 components, 17 live API routes, 41 Zen AI tools** — a
  sense of scale (checked August 2026).

---

## 10. How this document stays honest

The README sells; this document *checks*. Three things this pass corrected in
the surrounding docs while being written:

- The README claimed a "Real-time Database" and a "Tauri SQL Plugin — Local
  SQLite" as if they were the same thing; they are not — Firestore is the
  source of truth, SQLite is the local mirror, and the client talks to both.
- The route-restoration list in `CLAUDE.md` was partly wrong: three routes it
  listed as restored still 404, one it listed as 404 is live, and nine routes
  carry a stale `route.ts.bak` *beside* a live `route.ts`. The corrected list:

  **Still 404 in production** (only `.bak` exists):
  `auth/create-login-token`, `download/[platform]`, `paystack`,
  `paystack/activate-terminal`, `paystack/banks`, `paystack/create-subaccount`,
  `paystack/resolve-account`, `paystack/verify-customer`, `upload`.

  **Live** (may carry a stale `.bak` — ignore it): `admin/chat`,
  `admin/follow-up-stats`, `admin/metrics`, `admin/record`,
  `admin/record/file/[name]`, `admin/record/live`, `admin/record/live/frame`,
  `admin/send-follow-up`, `admin/users`, `chat`, `dodo/checkout`,
  `paystack/verify`, `paystack/verify-transaction`, `platform-stats`, `track`,
  `webhooks/dodo`, `webhooks/paystack`.
- `docs/blueprint.md` described a blue-and-purple app in Space Grotesk. The app
  is orange (`#F47125` primary) with Bricolage Grotesque headlines and DM Sans
  body, and the feature list predated branches, loyalty, Zen AI and the
  storefront. Rewritten from `globals.css`, `tailwind.config.ts` and the page
  tree; the colour table is computed from the actual HSL tokens.

What the same pass checked and found **correct**, so it does not need
re-auditing: the counts in `docs/zen-ai.md` for 10 `WORKFLOWS`, 29 `APP_ROUTES`
and 13 injection patterns; `docs/android-signing.md`'s fingerprints against
`release.yml`'s `EXPECTED` and `assetlinks.json`, and `generate-keystore.yml`
still disabled; and `radix_layout_gap_fix.md`'s 57 `modal={false}` sites, portal
backdrop and `globals.css` safeguards.

The tool count was in that list and has since been removed from it: tools were
added, every doc that spelled the number out drifted, and the figure now lives in
exactly one place (`ZEN_TOOL_COUNT`, derived from `TOOL_LINES`) with
`npm run test:zen-cost` asserting it matches the real set. A number worth
auditing repeatedly is a number that should not have been copied.

Related docs: `docs/zen-ai.md` (the chat in depth), `docs/android-signing.md`
(signing/Play), `docs/blueprint.md` (product blueprint),
`scripts/record/README.md` (the recorder).
