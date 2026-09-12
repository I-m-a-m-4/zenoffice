importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
firebase.initializeApp({
  apiKey: "AIzaSyCwHoA6JCTKw4FTVtRFvKV6wEKfTiuHxmg",
  authDomain: "studio-3699136485-6747d.firebaseapp.com",
  projectId: "studio-3699136485-6747d",
  storageBucket: "studio-3699136485-6747d.appspot.com",
  messagingSenderId: "382067240570",
  appId: "1:382067240570:web:b5e639d22cbc047c9195c3",
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // A data-only message has no `notification` block. Reading `.title` off it
  // unguarded threw inside the handler, which silently dropped the notification.
  const notification = payload.notification || {};
  const data = payload.data || {};

  const notificationTitle = notification.title || data.title || 'Zeneva';
  const notificationOptions = {
    body: notification.body || data.body || '',
    icon: '/icon.svg', // path to your app logo
    badge: '/icon.svg', // small monochrome icon preferably
    // Without this, `event.notification.data` is undefined in the click handler
    // below and both the deep link and the campaign id are lost.
    data: data,
    // Lets a later push about the same campaign replace this one rather than
    // stacking a second copy in the tray.
    tag: data.campaignId || undefined,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Where a tapped notification goes, and how the tap gets counted.
 *
 * There was no handler here at all, so `data.url` — which the server has always
 * sent — was ignored and a tap did nothing but dismiss the tray item. Two jobs:
 *
 * 1. Open the deep link the notification carried.
 * 2. Attribute the tap to its campaign, so the Push Analytics tab on
 *    /admin-imamshaffy/notifications can report who actually opened it.
 *
 * The write itself happens in the page, not here: a service worker has no Firebase
 * Auth session, so it cannot satisfy the Firestore rule that only lets a signed-in
 * user mark their own recipient row. The worker therefore just carries the campaign
 * id across — as a `?zpc=` query param when it has to open a new window, and as a
 * postMessage when a tab is already open — and `push-click-tracker.tsx` records it.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // When the compat SDK displays a notification itself (no handler registered
  // yet), it nests the original message under `FCM_MSG`. Handle both shapes.
  const raw = event.notification.data || {};
  const data = raw.FCM_MSG ? (raw.FCM_MSG.data || {}) : raw;

  const link = data.url || data.link || '/';
  const campaignId = data.campaignId || '';

  event.waitUntil(
    (async () => {
      let target;
      try {
        target = new URL(link, self.location.origin);
      } catch (err) {
        target = new URL('/', self.location.origin);
      }
      // Same-origin only: a notification must never be able to hand an arbitrary
      // external URL to `openWindow`.
      if (target.origin !== self.location.origin) {
        target = new URL('/', self.location.origin);
      }
      if (campaignId) target.searchParams.set('zpc', campaignId);

      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = clientList.find((client) => client.url.startsWith(self.location.origin));

      if (existing) {
        try {
          await existing.focus();
        } catch (err) {
          // Focus can be refused; the message below is still worth sending.
        }

        // Record the tap without disturbing whatever the person was doing.
        try {
          existing.postMessage({ type: 'zeneva-push-click', campaignId: campaignId, url: target.pathname + target.search });
        } catch (err) {
          console.warn('[firebase-messaging-sw.js] Could not post click to client', err);
        }

        // Only steer an open tab elsewhere when the notification pointed at a
        // specific page. Navigating on a bare "/" link would yank someone off the
        // screen they were using to show them nothing new.
        const wantsSpecificPage = target.pathname !== '/' && target.pathname !== new URL(existing.url).pathname;
        if (wantsSpecificPage && typeof existing.navigate === 'function') {
          try {
            await existing.navigate(target.href);
          } catch (err) {
            console.warn('[firebase-messaging-sw.js] Client navigate refused', err);
          }
        }
        return;
      }

      await self.clients.openWindow(target.href);
    })(),
  );
});

