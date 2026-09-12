# Notifications

Read this before touching anything that raises a notification, adds a trigger, or
tries to work out why one did not arrive.

## The one rule

**A notification is a Firestore document.** Writing the document is what raises the
operating-system notification, updates the bell, and gives the tap somewhere to land.
Nothing else does — there is no second way in.

Two bridges turn documents into popups, and they are the only two:

| Bridge | Collection | Where |
|---|---|---|
| Per-user | `users/{uid}/notifications` | `src/components/shared/native-notification-listener.tsx` (root layout) |
| Announcements | `notifications` (platform-wide) | `src/app/(app)/layout.tsx` |

Both call `triggerNativeNotification` in `src/lib/native-notifications.ts`, which is
the only caller of the platform notification API in the codebase.

## Native shells only

Notifications fire inside the Tauri desktop and mobile apps. On the web, the PWA and
the Play Store TWA they do not, on purpose: `Notification` support is inconsistent
across those three and a notification that sometimes appears is worse than one that
never does. The bell and the in-app toast cover the browser.

`triggerNativeNotification` returns immediately when `isTauriEnv()` is false. If you
find yourself adding a `new Notification(...)` anywhere, that is the rule you are
about to break — there were three such call sites and all three are gone.

FCM push is still wired up (`src/lib/server/notifications.ts`, `src/hooks/use-fcm.ts`,
`public/firebase-messaging-sw.js`) and is the only thing that can reach an app that is
**fully closed**. It is a bonus channel, not the mechanism to rely on: tokens are only
registered inside the Tauri shell, so there may be very few of them. The admin Push
Analytics tab reports what it actually reached — check there before assuming a push
went out.

## Why one support reply used to raise four popups

Four independent paths existed and each covered a different subset of the sources:

1. the per-user document bridge,
2. a second bridge in the app layout that also watched announcements,
3. a `supportThreads` listener that notified directly,
4. FCM.

A support reply wrote a per-user document *and* pushed, so it hit all four. An admin
broadcast wrote only an announcement, which just one of the four watched — and that
one only ever looked at the single newest notification, so any newer per-user alert
hid it. The redundancy made support look reliable and hid the fact that broadcasts
were not.

There are now two bridges, split by collection, and the dispatcher de-duplicates on
the way out (90 seconds, keyed on the document id **or** a hash of the body — the
support-thread listener and the document bridge describe the same message with
different titles, so the title cannot be part of the identity).

## Tapping a notification

Every notification resolves to a destination through `resolveNotificationLink`
(`src/lib/notification-links.ts`). When nothing better applies, the destination is the
notification's own detail view: `/notifications?n=<id>`, or `?g=<id>` for an
announcement. That is what guarantees a tap always shows *something*.

- **Android / iOS** — `sendNotification` carries `extra.url` and the plugin's
  `onAction` event routes it. This is the real tap-through.
- **Web / TWA** — the service worker's `notificationclick` handler opens `data.url`.
- **Desktop** — Tauri gives no click callback. Best effort: a notification raised
  while the window is hidden stashes its URL, and the window becoming visible within
  25 seconds is treated as the tap. Narrow on purpose; see the comment on
  `startDesktopTapWatcher`.

**Announcements are never keyword-sniffed.** The link heuristics read the title and
body for "stock", "order", "expire" and so on, which suits a one-line operational
alert and is wrong for prose an admin wrote. A broadcast that happens to mention stock
is not an inventory alert.

## Announcements are filtered on read, not by rules

The platform-wide `notifications` collection is readable by every signed-in user by
design, so Firestore rules cannot narrow it. `filterVisibleAnnouncements` does, and
**every reader has to call it**:

- `deleted: true` is a soft delete. Without the filter, deleting an announcement in
  the admin history only struck it through for the admin — it stayed in every user's
  bell.
- `targetEmail` scopes an alert to one person. Without the filter, an alert addressed
  to one shop appeared in every shop's bell, even though the phone push went to the
  right single uid.

## Triggers

`src/lib/notification-rules.ts` holds the rules that decide when Zeneva interrupts
someone. The runner is one effect in `src/app/(app)/layout.tsx`.

It reads only what the POS context already holds — products, receipts, customers,
audit logs, stats, the offline queue — so **the whole feature costs writes and no
reads.** Firestore cost is a standing constraint here; do not add a listener for a
trigger.

Rules in place, worst consequence first: unflushed sales queue, lapsed subscription,
expired stock still on the shelf, negative stock, high-risk audit events, overdue credit
sales, stock expiring within a month, out of stock, low stock, close-of-day summary,
milestones.

Expired stock outranks a wrong stock count deliberately — it is the only rule here with a
legal edge, and everything else merely costs money. It targets the person on the till,
because they are who can stop the sale; *expiring* stock targets the owner, because
discounting and reordering is their decision.

Three properties every rule must hold:

1. **A deterministic id.** The id *is* the idempotency guarantee — writing
   `trg-lowstock-abc-20260818` twice is an overwrite, and the bridges only react to
   `added`, so a repeat write raises nothing. Never mint a random id.
2. **A day (or hour) component on anything recurring**, or the alert either fires once
   and never again after the condition clears, or fires on every pass.
3. **A cap.** Each rule emits at most `RULE_EMIT_CAP` named alerts and collapses to a
   single digest beyond that; a pass writes at most `TRIGGER_BATCH_CAP` documents. The
   cap delays rather than drops — the rest arrive on a later pass.

Adding a trigger is one function and one entry in the `RULES` array. Nothing else in
the app changes.

### Two constraints that shape the design

**`owner`-targeted rules only run on the owner's own device.** Firestore rules do not
let a staff member write into the owner's notifications, so `selectDueNotifications`
drops those results for anyone who is not the owner rather than redirecting them to
the wrong person. The consequence, and it is deliberate: a low-stock event at the till
reaches the owner's phone the next time the owner opens the app, not instantly. Making
it instant needs either a rules change or a scheduled server job.

**Never while impersonating.** The runner returns early on `isImpersonating`. These
documents land in the tenant's own feed, and an admin looking around a shop must not
leave alerts behind in it.

### The debt figure is a floor, not a total

`outstandingDebt` counts unpaid and pending receipts older than a week out of the
**most recent 200 receipts** — that is what the listener holds
(`src/context/pos-context.tsx`, the `limit(200)` query). An older unpaid sale is not in
memory to be counted, so the amount is the least the shop is owed, never the whole of it.
This is the same capped-window trap `docs/business-rating.md` documents for dormant
buyers, and the notification links to `/invoices` precisely because that page queries
properly. Do not restate this number as the shop's total debt.

There is also no minimum amount on it, on purpose: a money floor cannot be
currency-neutral, and the rule is capped to once a day anyway.

### The audit-risk rule is not the loss-prevention scan

`auditRisk` says "this happened, look at it". `src/lib/forensics.ts` is the tool that
names a member of staff and says their numbers look like theft, and it runs only when
the owner asks for it — see `docs/loss-prevention.md`. A background trigger must never
make that accusation on its own.

## Sending from the admin

Every admin surface writes a document, so every one of them reaches phones:

| Surface | Writes |
|---|---|
| `/admin-imamshaffy` → Send Broadcast | `system_broadcasts` (banner) **and** an announcement (bell + native) **and** FCM |
| `/admin-imamshaffy/notifications` → Alerts | an announcement, plus FCM when `pushToPhones` is on — **on by default** |
| `/admin-imamshaffy/support` → reply | a per-user document + FCM |
| CEO broadcast (`support` page) | `ceo_broadcasts`, bridged by its own listener in the app layout |
| Halt / resume a business | a per-user document to the owner |
| Assign a plan | a per-user document to the owner |

A `system_broadcasts` document on its own only drives the dismissible banner — it is
read by neither bridge and not by the bell. That is why Send Broadcast writes an
announcement alongside it.

## Reaching the platform owner — anomalies

Everything above carries a message *to* a tenant. The reverse direction — telling the
platform owner that something broke on a user's device — uses a different collection,
and the reason it is worth documenting here is that it is easy to build a third channel
by accident when a perfectly good one already exists.

`error_logs` is `allow create: if true`, readable only by a super admin
(`firestore.rules:222` and `:386`). `src/app/admin-imamshaffy/layout.tsx` already holds
a live `onSnapshot` on the newest 20 by `createdAt desc`: it badges anything newer than
`localStorage.zeneva_last_viewed_errors`, and for `added` documents under 60 seconds old
it calls the same `notify()` used everywhere else, landing the tap on
`/admin-imamshaffy/developer-logs`. So a write into `error_logs` already produces a
badge, a popup on the owner's desktop and somewhere to tap. Nothing new was needed.

`reportAnomaly(code, message, { userId, businessId, details })` in
`src/lib/error-logger.ts` is the writer. Four things about it:

- **It is not `logErrorToFirestore`.** That function's `NOISE_PATTERNS` filter drops
  exactly the strings an anomaly is made of — "permission-denied", "Failed to fetch" —
  because for a crash log those are noise. And its 5-per-session budget exists for a
  page that is falling over; an anomaly must not be crowded out of it by a render loop.
- **An anomaly is a condition, not an exception.** Three of the five that exist throw
  nothing at all: a stamp that outlived its data, a cache that read as empty, a mirror
  that refused a write. The test is "can this shop still trade", not "did something
  throw".
- **Throttled per code, per device, per day** via `zeneva_anomaly_<code>` plus an
  in-session `Set`. A desktop install with a locked `zeneva.db` hits the same anomaly on
  every launch, and the owner needs to know it happened once, not 40 times. If the write
  fails, the throttle key is deleted again so the next launch retries, and the payload
  joins the `failed_logs` queue that `flushOfflineErrors` drains.
- The popup title is **"Zeneva Anomaly Detected"** rather than "New Developer Log", so
  a device that cannot sell is distinguishable from a stack trace without opening the
  page.

The five codes, all from the empty-POS investigation:

| Code | Means |
|---|---|
| `product_cache_write_failed` | products fetched, SQLite refused the write — `full_products_sync` withheld |
| `product_cache_unreadable` | the mirror could not be read at all; on desktop it is the only product store |
| `product_cache_lost` | a fresh stamp over an empty store — the state that produced "No products found" |
| `product_sync_permission_denied` | rules refused the catalogue listing; the POS is unusable for that user |
| `product_sync_failed` | the retry budget is spent — `PRODUCT_SYNC_MAX_RETRIES` backed-off attempts all failed |

Adding a sixth needs only a `reportAnomaly` call with a new stable `code` — the throttle
is keyed on it, so a code that varies per call (an interpolated count, a timestamp)
defeats the throttle and bills the platform for a document per launch.

## Debugging a notification that did not arrive

In order, because each step rules out the one below:

1. **Is it a browser?** Then it is working as designed. Check the bell.
2. **Is there a document?** Look in `users/{uid}/notifications` or `notifications`. No
   document, no notification — find the writer, not the listener.
3. **Is it an announcement with `deleted: true` or a `targetEmail` that is not
   theirs?** `filterVisibleAnnouncements` is doing its job.
4. **Is it older than 10 minutes?** Both bridges have a freshness window, so a
   listener re-attaching after a long offline stretch does not dump a backlog.
5. **Was the same body shown in the last 90 seconds?** The de-dupe suppressed it.
6. **Is it a trigger?** Check `localStorage.zeneva_trg_sent_<businessId>` — the id may
   already be recorded. Deleting that key is safe; the deterministic ids still make a
   re-run an overwrite.
7. **Expecting FCM on a closed app?** Open the Push Analytics tab and read the device
   count for that campaign. `0` means no registered devices, which is a token
   registration problem, not a send problem.
