import { adminMessaging, adminFirestore } from '@/firebase/admin';
import {
    createPushCampaign,
    dedupeTargets,
    finalizePushCampaign,
    pushStatsDay,
    rollUpPushStats,
    type PushSource,
    type PushTarget,
} from './push-log';
import { INTERNAL_ACCOUNT_EMAILS } from '@/lib/platform-revenue';

/**
 * Push to one user's devices.
 *
 * Every send is recorded as a `push_campaigns` doc with a per-recipient row, so
 * the admin board can report volume and opens — see `push-log.ts`. The campaign id
 * rides along in `data.campaignId`, which is what lets the service worker attribute
 * a click back to this notification.
 */
export async function sendNotificationToUser(
    userId: string,
    payload: { title: string; body: string; url?: string; source?: PushSource; sentBy?: string | null; audienceLabel?: string | null },
) {
    try {
        // 1. Get user's FCM tokens
        const tokensSnapshot = await adminFirestore
            .collection('users')
            .doc(userId)
            .collection('fcmTokens')
            .get();

        if (tokensSnapshot.empty) {
            console.log(`No devices found for user ${userId}`);
            return;
        }

        // use-fcm.ts writes the token as both the doc id and a `token` field, so fall
        // back to the id — a missing field would otherwise put `undefined` in the array
        // and make the send throw.
        const targets = dedupeTargets(
            tokensSnapshot.docs.map((doc: any) => ({ token: doc.data().token || doc.id, userId })),
        );

        if (targets.length === 0) {
            console.log(`No usable FCM tokens for user ${userId}`);
            return;
        }

        const tokens = targets.map((t) => t.token);
        const url = payload.url || '/';

        // Minted before the send: the id has to be inside the payload for a click to
        // be attributable, so a failure here costs tracking, not delivery.
        const campaignId = await createPushCampaign({
            title: payload.title,
            body: payload.body,
            link: url,
            source: payload.source || 'system',
            audience: 'user',
            audienceLabel: payload.audienceLabel ?? userId,
            sentBy: payload.sentBy ?? null,
        });

        // 2. Send multicast message
        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
                // zeneva.space, not zeneva.app — the latter is not a host we serve.
                imageUrl: 'https://zeneva.space/icon.svg',
            },
            data: {
                url,
                icon: '/icon.svg',
                campaignId: campaignId || '',
            },
            // Without this, the Firebase Android SDK defaults to an
            // `intent://play.google.com/store/apps/details?id=com.zeneva.app`
            // click action, which crashes inside the TWA WebView with
            // ERR_UNKNOWN_URL_SCHEME. Explicitly pointing at the app origin
            // opens the running app window instead.
            android: {
                notification: {
                    defaultVibrateTimings: true,
                    defaultSound: true,
                    sound: 'default',
                },
                data: {
                    url,
                    campaignId: campaignId || '',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                    }
                }
            },
            webpush: {
                notification: {
                    icon: 'https://zeneva.space/icon.svg',
                    badge: 'https://zeneva.space/icon.svg',
                },
                fcmOptions: {
                    link: `https://zeneva.space${url.startsWith('/') ? url : '/' + url}`,
                },
            },
            tokens: tokens,
        };

        const response = await adminMessaging.sendEachForMulticast(message);

        // 3. Cleanup invalid tokens
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            const tokensToDelete: any[] = [];

            response.responses.forEach((resp: any, idx: number) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                    const errorCode = resp.error?.code;
                    // These errors mean the user uninstalled the app or revoked notification permissions
                    if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered') {
                        tokensToDelete.push(tokens[idx]);
                    }
                }
            });

            if (failedTokens.length > 0) {
                console.log('List of tokens that caused failures: ' + failedTokens);
            }

            if (tokensToDelete.length > 0) {
                console.log(`User ${userId} uninstalled the app or revoked tokens. Deleting ${tokensToDelete.length} invalid tokens.`);
                // Delete invalid tokens from Firestore
                const batch = adminFirestore.batch();
                tokensToDelete.forEach(token => {
                    const tokenRef = adminFirestore.collection('users').doc(userId).collection('fcmTokens').doc(token);
                    batch.delete(tokenRef);
                });
                await batch.commit();

                // If they have no valid tokens left, we can mark them as uninstalled
                const remainingTokensCount = tokens.length - tokensToDelete.length;
                if (remainingTokensCount === 0) {
                    await adminFirestore.collection('users').doc(userId).update({ hasUninstalledApp: true, uninstalledAt: new Date() });
                }
            }
        }

        await finalizePushCampaign(campaignId, targets, response.responses.map((r: any) => r.success));
        await rollUpPushStats(pushStatsDay(), {
            devices: targets.length,
            success: response.successCount,
            failure: response.failureCount,
            recipients: 1,
        });

        return response;
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

/**
 * Push to every registered device on the platform, recording who it reached.
 *
 * Split out of the `broadcastNotification` server action so the alert form can
 * reuse the exact same send-and-record path instead of growing a second, subtly
 * different copy of it. Callers are responsible for authorising the request —
 * this reads `collectionGroup('fcmTokens')` across every tenant.
 */
export async function broadcastToAllDevices(payload: {
    title: string;
    body: string;
    url?: string;
    source?: PushSource;
    sentBy?: string | null;
    sentByEmail?: string | null;
}): Promise<{ deviceCount: number; successCount: number; failureCount: number; recipientCount: number; campaignId: string | null }> {
    if (!adminFirestore || !adminMessaging) {
        throw new Error('Firebase Admin Services are not initialized on the server.');
    }

    const url = payload.url || '/';

    // Tokens live at `users/{uid}/fcmTokens/{token}`, so the owning uid is the
    // grandparent of each doc. The old code deduped tokens through a `Set` and
    // discarded that, which is why a send could not name its recipients.
    const tokensSnapshot = await adminFirestore.collectionGroup('fcmTokens').get();
    const targets = dedupeTargets(
        tokensSnapshot.docs.map((doc: any) => ({
            token: doc.data().token || doc.id,
            userId: doc.ref.parent.parent?.id || '',
        })),
    );

    if (targets.length === 0) {
        return { deviceCount: 0, successCount: 0, failureCount: 0, recipientCount: 0, campaignId: null };
    }

    const campaignId = await createPushCampaign({
        title: payload.title,
        body: payload.body,
        link: url,
        source: payload.source || 'broadcast',
        audience: 'all',
        audienceLabel: 'All registered devices',
        sentBy: payload.sentBy ?? null,
        sentByEmail: payload.sentByEmail ?? null,
    });

    // Firebase multicast limit is 500 tokens per request.
    const chunks: PushTarget[][] = [];
    for (let i = 0; i < targets.length; i += 500) {
        chunks.push(targets.slice(i, i + 500));
    }

    let successCount = 0;
    let failureCount = 0;
    // Flat, in target order, so index i here is target i — that alignment is what
    // `finalizePushCampaign` uses to attribute a device result to a person.
    const results: boolean[] = [];

    for (const chunk of chunks) {
        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
                imageUrl: 'https://zeneva.space/icon.svg',
            },
            data: {
                url,
                icon: '/zeneva.png',
                campaignId: campaignId || '',
            },
            // Without this, the Firebase Android SDK defaults to an
            // `intent://play.google.com/store/apps/details?id=com.zeneva.app`
            // click action, which crashes inside the TWA WebView with
            // ERR_UNKNOWN_URL_SCHEME. Explicitly pointing at the app origin
            // opens the running app window instead.
            android: {
                notification: {
                    defaultVibrateTimings: true,
                    defaultSound: true,
                },
                data: {
                    url,
                    campaignId: campaignId || '',
                },
            },
            webpush: {
                notification: {
                    icon: 'https://zeneva.space/icon.svg',
                    badge: 'https://zeneva.space/icon.svg',
                },
                fcmOptions: {
                    link: `https://zeneva.space${url.startsWith('/') ? url : '/' + url}`,
                },
            },
            tokens: chunk.map((t) => t.token),
        };

        try {
            const response = await adminMessaging.sendEachForMulticast(message);
            successCount += response.successCount;
            failureCount += response.failureCount;
            response.responses.forEach((r: any) => results.push(r.success));
        } catch (error) {
            // One rejected chunk must not lose the other 500 devices' results.
            console.error('[broadcast] Chunk send failed:', error);
            failureCount += chunk.length;
            chunk.forEach(() => results.push(false));
        }
    }

    await finalizePushCampaign(campaignId, targets, results);

    const recipientCount = new Set(targets.map((t) => t.userId)).size;
    await rollUpPushStats(pushStatsDay(), {
        devices: targets.length,
        success: successCount,
        failure: failureCount,
        recipients: recipientCount,
    });

    return { deviceCount: targets.length, successCount, failureCount, recipientCount, campaignId };
}

export async function notifyAdminsOfSubscription(payload: {
    businessName: string;
    planId: string;
    amount: number;
    currency: string;
}) {
    try {
        const querySnapshot = await adminFirestore
            .collection('users')
            .where('email', 'in', INTERNAL_ACCOUNT_EMAILS)
            .get();

        if (querySnapshot.empty) {
            console.log('No admin users found to notify.');
            return;
        }

        /*
         * Subscriptions only. This carried a `kind` discriminator while AI credit
         * packs were on sale, because "subscribed to 1,000 AI credits" would have put
         * a one-off sale in the same sentence as recurring revenue and the platform
         * owner reads these to know the run rate. Packs are scrapped and nothing
         * passes a kind any more, so the wording is unconditional again — if a
         * one-off product ever returns, the discriminator has to come back with it.
         */
        const formattedAmount = `${payload.currency === 'USD' ? '$' : '₦'}${payload.amount.toLocaleString()}`;
        const title = '🎉 New Subscription!';
        const body = `"${payload.businessName}" subscribed to ${payload.planId} for ${formattedAmount}.`;

        const notificationPromises = querySnapshot.docs.flatMap((doc: any) => {
            // Write to in-app notification feed
            const dbWrite = adminFirestore
                .collection('users')
                .doc(doc.id)
                .collection('notifications')
                .add({
                    title,
                    body,
                    createdAt: new Date(),
                    read: false,
                    type: 'system',
                    amount: payload.amount,
                    plan: payload.planId,
                });

            // Send push notification
            const pushSend = sendNotificationToUser(doc.id, {
                title,
                body,
                url: '/admin-imamshaffy',
                source: 'system',
            });

            return [dbWrite, pushSend];
        });

        await Promise.all(notificationPromises);
        console.log(`Successfully dispatched subscription notifications to ${querySnapshot.size} admin(s).`);
    } catch (error) {
        console.error('Error notifying admins of subscription:', error);
    }
}
