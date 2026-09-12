/**
 * Shared presentation rules for notifications: who sees an announcement, and where a
 * tap sends them.
 *
 * Both halves lived twice, copied verbatim, in `src/app/(app)/layout.tsx` and
 * `src/app/(app)/notifications/page.tsx`, and both copies ended the same way: a
 * global announcement fell through to `/support`. So tapping "New platform upgrade
 * available" opened the support chat, which says nothing about the upgrade — the
 * complaint that a tapped notification shows nothing was literally true.
 *
 * Three rules:
 *
 * - **Every notification has a destination.** When nothing better applies the answer
 *   is the notification's own detail view, which always renders its title and body.
 *   There is no "nowhere to go" case any more.
 * - **Announcements are not keyword-sniffed.** The heuristics below read the title
 *   and body looking for "stock", "order", "expire" and so on, which is fine for a
 *   one-line operational alert and wrong for prose an admin wrote: a broadcast that
 *   happens to mention stock is not an inventory alert. Global documents skip
 *   straight to their own detail view unless the sender set an explicit link.
 * - **An announcement aimed at one person is not shown to everyone.** See
 *   {@link filterVisibleAnnouncements}.
 */

export type NotificationLike = {
  id: string;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  link?: string | null;
  url?: string | null;
  /** True for a document from the platform-wide `notifications` collection. */
  isGlobal?: boolean;
};

/** One document from the platform-wide `notifications` collection. */
type AnnouncementLike = {
  /** Soft delete. The admin history keeps the row; recipients must not. */
  deleted?: boolean;
  /** Set when the alert was aimed at one person; absent or null means everyone. */
  targetEmail?: string | null;
};

/**
 * Narrow the platform-wide announcement collection to what one viewer should see.
 *
 * Two things were wrong with reading that collection raw, and both were invisible
 * because the collection is small:
 *
 * - A **soft-deleted** announcement (`deleted: true`) stayed in every user's bell.
 *   Deleting it in the admin history only struck it through for the admin.
 * - A **targeted** alert was shown to everyone. `pushAlertToPhones` resolves
 *   `targetEmail` to a single uid for the phone push, but the in-app document it is
 *   written alongside lives in the shared collection with no scoping — so "your
 *   payment failed", addressed to one shop, appeared in every shop's bell.
 *
 * Firestore rules cannot narrow this: the collection is read by every tenant by
 * design (`allow list, get: if isUserAuthenticated()`), so the filter belongs here
 * and has to be applied by every reader.
 */
export function filterVisibleAnnouncements<T extends AnnouncementLike>(
  announcements: T[] | null | undefined,
  viewerEmail?: string | null,
): T[] {
  if (!announcements) return [];
  const email = (viewerEmail || '').trim().toLowerCase();
  return announcements.filter((n) => {
    if (n.deleted === true) return false;
    const target = (n.targetEmail || '').trim().toLowerCase();
    return !target || target === email;
  });
}

/**
 * Deep link to a single notification's detail view.
 *
 * Two parameters rather than one because the id alone is ambiguous: per-user
 * documents live at `users/{uid}/notifications` and announcements at the top-level
 * `notifications` collection, and the page has to know which one to look in.
 */
export function notificationDetailLink(notif: Pick<NotificationLike, 'id' | 'isGlobal'>): string {
  const param = notif.isGlobal ? 'g' : 'n';
  return `/notifications?${param}=${encodeURIComponent(notif.id)}`;
}

/** True when `link` points off the app and needs `openExternal` rather than a route. */
export function isExternalNotificationLink(link: string): boolean {
  return /^https?:\/\//i.test(link || '');
}

export function resolveNotificationLink(notif: NotificationLike): string {
  const explicit = (notif.link || notif.url || '').trim();
  if (explicit) return explicit;

  const title = (notif.title || '').toLowerCase();
  const body = (notif.body || '').toLowerCase();
  const mentions = (needle: string) => title.includes(needle) || body.includes(needle);

  // Handle marketing/download announcements before the global fallback catches them.
  // Global announcements often lack an explicit link, but we want them to take the
  // user to the download page rather than the blank-ish notification detail view.
  if (mentions('zeneva on windows') || mentions('microsoft store') || mentions('windows desktop')) {
    return '/download';
  }
  if (mentions('mobile app') || mentions('android app') || mentions('google play')) {
    return 'https://play.google.com/store/apps/details?id=com.zeneva.app';
  }
  
  if (mentions('sales are waiting to sync')) {
    return '/dashboard';
  }

  // See the header: prose gets no keyword sniffing.
  if (notif.isGlobal) return notificationDetailLink(notif);

  const type = (notif.type || '').toLowerCase();

  if (type === 'billing' || mentions('expire') || mentions('subscribe') || title.includes('subscription')) {
    return '/billing';
  }
  if (type === 'inventory' || mentions('stock') || mentions('backorder')) return '/inventory';
  if (type === 'payment' || mentions('payment received')) return '/terminal-alerts';
  if (type === 'order' || type === 'sale' || mentions('order')) return '/online-orders';
  if (type === 'support' || type === 'ceo_chat' || mentions('ceo')) return '/support';
  if (type === 'achievement' || type === 'milestone') return '/achievements';
  if (type === 'audit' || type === 'sync') return '/audit-log';
  if (type === 'report' || type === 'summary') return '/reports';
  if (type === 'permission_update') return '/users';

  return notificationDetailLink(notif);
}
