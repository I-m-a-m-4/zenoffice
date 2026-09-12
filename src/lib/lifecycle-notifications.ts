/**
 * Lifecycle ("drip") notifications — the small set of one-off messages Zeneva
 * sends an account over its first few weeks.
 *
 * Two things were wrong with the previous version, and both were structural,
 * so they are fixed here rather than at the call site:
 *
 * 1. The "already sent" flag lived in `localStorage`, but the notification it
 *    guards lives in Firestore. That is the wrong place for it: a second
 *    device, a cleared browser cache, a reinstalled desktop app, a fresh Tauri
 *    webview and a private window all read an empty flag and sent the message
 *    again. The record now lives on the user document, next to the account it
 *    describes, so it is the same on every device the account signs in from.
 *
 * 2. Each stage tested its own threshold independently (`>= 3 days`,
 *    `>= 5 days`), so an account that qualified for several at once received
 *    them in the same second. Delivery is now single-file: at most one message
 *    per pass, and never within {@link LIFECYCLE_MIN_GAP_DAYS} of the previous
 *    one.
 *
 * Each stage also has a closing window. A drip is only worth sending near the
 * moment it describes — telling a two-month-old account "welcome to your third
 * day" is worse than saying nothing, and back-filling a stale queue is exactly
 * what produced the burst users complained about.
 *
 * Titles carry no emoji: these render in the notification centre, in the OS
 * notification tray and in the Play/Microsoft Store push payload, and a
 * picture character in the title line is the difference between reading like a
 * business tool and reading like a mailing list. The type icon in the UI
 * carries the same signal without the noise.
 */

import { storeUrl } from '@/lib/platform';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimum spacing between any two lifecycle messages, in days. */
export const LIFECYCLE_MIN_GAP_DAYS = 7;

/**
 * How many notification documents any listener may pull down.
 *
 * The notification listeners are attached in the persistent app layout, so they
 * live for the whole session and re-bill on every attach. `notifications` is the
 * platform-wide broadcast collection, which means an unbounded query there cost
 * (every announcement ever sent) × (every tenant, every session) and grew with
 * each announcement — permanently. Both listeners are capped here, on the
 * server side, rather than trimmed after the download.
 *
 * Deliberately larger than the 20 the bell dropdown shows: the notifications
 * page renders the full list, and "mark all read" / "clear all" act on whatever
 * was fetched. 50 keeps those honest for any realistic backlog while still
 * bounding the read.
 */
export const NOTIFICATION_FETCH_LIMIT = 50;

/** What the running client looks like, for stages whose copy depends on it. */
export type LifecycleContext = {
  /** Inside a Tauri shell (desktop or mobile) rather than a browser. */
  isNative: boolean;
  /** The user agent is a phone or tablet, native shell or not. */
  isMobileUA: boolean;
};

export type LifecycleMessage = {
  title: string;
  body: string;
  /** Kept on the document; drives the icon, the label and the click target. */
  type: string;
  link: string;
  /** Store listings and other off-app URLs must leave the webview. */
  openExternal?: boolean;
};

export type LifecycleStage = {
  /** Stable key. Used as the map key on the user document and as the
   *  notification's document id, so a repeat write is an overwrite. */
  id: string;
  /** Account age, in days, at which this becomes eligible. */
  afterDays: number;
  /** Days after `afterDays` that eligibility remains open. */
  windowDays: number;
  /** Returns null when this stage does not apply to the current client. */
  build: (ctx: LifecycleContext) => LifecycleMessage | null;
};

/**
 * The schedule. Order matters — the first eligible stage wins — and the day
 * offsets are spaced at least {@link LIFECYCLE_MIN_GAP_DAYS} apart so the gap
 * rule never has to hold a message back under normal use.
 */
export const LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    id: 'ceo_chat',
    afterDays: 3,
    windowDays: 21,
    build: () => ({
      title: 'Message the founder directly',
      body:
        'Questions, feedback, or a feature your shop needs? The CEO Direct Line goes straight to Bello Imam — not a ticket queue.',
      type: 'ceo_chat',
      link: '/support',
    }),
  },
  {
    id: 'companion_app',
    afterDays: 14,
    windowDays: 60,
    build: (ctx) => {
      // Someone reading this inside the Android app already has the Android
      // app. Point them at the desktop build instead of at themselves.
      const onMobileShell = ctx.isNative && ctx.isMobileUA;
      if (onMobileShell) return null;

      if (ctx.isNative || !ctx.isMobileUA) {
        // Desktop app or desktop browser -> the phone is what they are missing.
        const url = storeUrl('play');
        if (!url) return null;
        return {
          title: 'Zeneva on Android',
          body: 'Check stock and take sales away from the counter. Available on Google Play.',
          type: 'app_download',
          link: url,
          openExternal: true,
        };
      }

      // Mobile browser -> the desktop build is what they are missing.
      const url = storeUrl('microsoft');
      if (!url) return null;
      return {
        title: 'Zeneva on Windows',
        body: 'Faster receipts and offline printing on the shop PC. Available on the Microsoft Store.',
        type: 'app_download',
        link: url,
        openExternal: true,
      };
    },
  },
];

/**
 * Coerce a Firestore timestamp, Date, epoch number or ISO string to a Date.
 *
 * Deliberately returns `null` rather than the epoch for missing input. The
 * shared `safeToDate` returns `new Date(0)` there, which is correct for
 * sorting and wrong here: an account with no `createdAt` would read as ~20,000
 * days old and qualify for every stage at once, on every device, forever. That
 * is the other half of the burst.
 */
export function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof (value as any)?.toDate === 'function') {
    date = (value as any).toDate();
  } else if (typeof (value as any)?.seconds === 'number') {
    date = new Date((value as any).seconds * 1000);
  } else if (typeof value === 'number' || typeof value === 'string') {
    date = new Date(value);
  } else {
    return null;
  }

  const time = date.getTime();
  // `<= 0` also rejects the epoch itself, which only ever appears here as the
  // fallback for a missing value.
  if (Number.isNaN(time) || time <= 0) return null;
  return date;
}

export type DueLifecycleMessage = {
  stage: LifecycleStage;
  message: LifecycleMessage;
};

/**
 * Pick the one lifecycle message that is due, or null.
 *
 * Pure: everything it needs is passed in, so the scheduling rules can be read
 * (and reasoned about) without a Firestore client.
 */
export function selectDueLifecycleMessage(input: {
  accountCreatedAt: Date | null;
  /** The `lifecycleNotifications` map from the user document. */
  delivered: Record<string, unknown> | null | undefined;
  now: Date;
  context: LifecycleContext;
  stages?: LifecycleStage[];
}): DueLifecycleMessage | null {
  const { accountCreatedAt, delivered, now, context } = input;
  const stages = input.stages ?? LIFECYCLE_STAGES;

  // No usable signup date means no schedule. Saying nothing is the correct
  // behaviour — guessing produced the "welcome to your 3rd day" message on
  // accounts that were months old.
  if (!accountCreatedAt) return null;

  const ageDays = Math.floor((now.getTime() - accountCreatedAt.getTime()) / DAY_MS);
  if (!Number.isFinite(ageDays) || ageDays < 0) return null;

  // Spacing: hold everything back until the gap since the last delivery has
  // passed. This is what stops a queue that has gone stale from emptying
  // itself in one burst.
  let lastDeliveryMs = 0;
  for (const value of Object.values(delivered ?? {})) {
    const at = toDateOrNull(value);
    if (at && at.getTime() > lastDeliveryMs) lastDeliveryMs = at.getTime();
  }
  if (lastDeliveryMs > 0) {
    const daysSinceLast = (now.getTime() - lastDeliveryMs) / DAY_MS;
    if (daysSinceLast < LIFECYCLE_MIN_GAP_DAYS) return null;
  }

  for (const stage of stages) {
    if (delivered && Object.prototype.hasOwnProperty.call(delivered, stage.id)) continue;
    if (ageDays < stage.afterDays) continue;
    if (ageDays > stage.afterDays + stage.windowDays) continue;

    const message = stage.build(context);
    if (!message) continue;

    return { stage, message };
  }

  return null;
}

/** Document id for a stage's notification. Deterministic on purpose: two tabs
 *  racing each other write the same document instead of two copies of it. */
export function lifecycleNotificationId(stageId: string): string {
  return `lifecycle_${stageId}`;
}

/**
 * Collapse repeats of the same announcement, newest kept.
 *
 * This is a display-side repair, not a substitute for the scheduling fix
 * above. Accounts that were on the old localStorage guard already have the
 * duplicates sitting in Firestore, and nothing deletes them — the user would
 * have to clear the list by hand. Folding them here means an existing account
 * sees the same tidy list as a new one, without a destructive migration over
 * every tenant's data.
 *
 * Only announcements are folded. Operational alerts — a sale, an order, a
 * stock warning, a payment — describe separate real events that happen to
 * share a title, so collapsing those would hide work the user has to do. They
 * are keyed by id and always pass through.
 */
const COLLAPSIBLE_TYPES = new Set(['ceo_chat', 'app_download', 'system', 'promo']);

export function collapseDuplicateNotifications<
  T extends { id: string; title?: string; type?: string; isGlobal?: boolean }
>(notifications: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  // Input is already sorted newest-first, so the first of each group is the
  // one to keep.
  for (const notif of notifications) {
    const type = (notif.type || '').toLowerCase();
    if (!COLLAPSIBLE_TYPES.has(type)) {
      out.push(notif);
      continue;
    }

    const key = `${notif.isGlobal ? 'g' : 'u'}:${type}:${(notif.title || '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(notif);
  }

  return out;
}
