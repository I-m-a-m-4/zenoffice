'use server';

import { broadcastToAllDevices, sendNotificationToUser } from '@/lib/server/notifications';
import { adminAuth } from '@/firebase/admin';
import { requireSuperAdmin, requireUser } from './admin-guard';
import { sendEmail } from '@/lib/server/resend';

/**
 * Send the caller a test push.
 *
 * The target is the verified token's own uid, not a client-supplied id — this
 * used to accept any `userId`, which let anyone push a notification to any
 * user's devices. The parameter is kept for call-site compatibility but is only
 * honoured when it matches the caller.
 */
export async function sendTestNotification(userId: string, idToken?: string) {
    let callerUid: string;
    try {
        callerUid = await requireUser(idToken);
    } catch (err: any) {
        return { success: false, error: err.message };
    }

    if (userId && userId !== callerUid) {
        return { success: false, error: "You can only send a test notification to yourself." };
    }

    try {
        userId = callerUid;
        await sendNotificationToUser(userId, {
            title: "Test notification",
            body: "This is a test alert. Your notifications are working correctly.",
            url: "/settings",
            source: 'test',
            sentBy: callerUid,
        });
        return { success: true };
    } catch (error: any) {
        console.error("Test notification failed:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Push a notification to every registered device on the platform.
 *
 * Owner-only, and verified server-side: this reads `collectionGroup('fcmTokens')`
 * across all tenants, so an unauthenticated version of this action was a
 * spam-every-customer button sitting on a public URL.
 *
 * The send itself lives in `@/lib/server/notifications` so the alert form can
 * reuse it; this wrapper is the authorisation boundary.
 */
export async function broadcastNotification(title: string, body: string, url: string = '/', idToken?: string) {
    try {
        const admin = await requireSuperAdmin(idToken);

        const result = await broadcastToAllDevices({
            title,
            body,
            url,
            source: 'broadcast',
            sentBy: admin.uid,
            sentByEmail: admin.email ?? null,
        });

        if (result.deviceCount === 0) {
            return { success: true, message: "No registered devices found." };
        }

        return {
            success: true,
            message: `Broadcast sent to ${result.successCount} devices. Failed on ${result.failureCount} devices.`,
            campaignId: result.campaignId,
        };
    } catch (error: any) {
        console.error("Broadcast notification failed:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Push an admin alert to phones — either everyone, or one person by email.
 *
 * The Alerts page only ever wrote an in-app `notifications` document, so an alert
 * marked "sent" reached the bell icon and never the recipient's phone. This is the
 * push half, called alongside that write when the owner opts in, and it records the
 * send like any other campaign so the analytics board covers it too.
 */
export async function pushAlertToPhones(input: {
    title: string;
    body: string;
    link?: string;
    /** Omit or leave null to push to every registered device. */
    targetEmail?: string | null;
    idToken?: string;
}) {
    try {
        const admin = await requireSuperAdmin(input.idToken);
        const url = input.link || '/notifications';

        if (input.targetEmail) {
            if (!adminAuth) {
                throw new Error('Server not configured for administrative actions.');
            }

            let uid: string;
            try {
                const target = await adminAuth.getUserByEmail(input.targetEmail);
                uid = target.uid;
            } catch {
                // A targeted alert whose recipient has no account is a typo, not a
                // system failure — say which address failed so it can be corrected.
                return { success: false, error: `No account found for ${input.targetEmail}.` };
            }

            const response = await sendNotificationToUser(uid, {
                title: input.title,
                body: input.body,
                url,
                source: 'alert',
                sentBy: admin.uid,
                audienceLabel: input.targetEmail,
            });

            if (!response) {
                return { success: true, message: `${input.targetEmail} has no registered device.`, deviceCount: 0 };
            }

            return {
                success: true,
                message: `Pushed to ${response.successCount} of ${input.targetEmail}'s devices.`,
                deviceCount: response.successCount,
            };
        }

        const result = await broadcastToAllDevices({
            title: input.title,
            body: input.body,
            url,
            source: 'alert',
            sentBy: admin.uid,
            sentByEmail: admin.email ?? null,
        });

        if (result.deviceCount === 0) {
            return { success: true, message: 'No registered devices found.', deviceCount: 0 };
        }

        return {
            success: true,
            message: `Pushed to ${result.successCount} devices (${result.recipientCount} people). ${result.failureCount} failed.`,
            deviceCount: result.successCount,
            campaignId: result.campaignId,
        };
    } catch (error: any) {
        console.error('Alert push failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Direct push notification to a target user (e.g. from Admin Support Chat or Payment Confirmation).
 */
export async function sendDirectUserPush(
    targetUserId: string,
    payload: { title: string; body: string; url?: string },
    idToken?: string
) {
    try {
        const admin = await requireSuperAdmin(idToken);
        const url = payload.url || '/support';

        // 1. Send FCM Push Notification
        await sendNotificationToUser(targetUserId, {
            title: payload.title,
            body: payload.body,
            url,
            source: 'support',
            sentBy: admin.uid,
        });

        // 2. Send Email Notification
        try {
            if (adminAuth) {
                const targetUser = await adminAuth.getUser(targetUserId);
                if (targetUser.email) {
                    await sendEmail({
                        to: targetUser.email,
                        name: targetUser.displayName || 'Zeneva User',
                        subject: payload.title,
                        body: `<p style="font-size: 16px; color: #333;">${payload.body}</p><br><hr style="border-top: 1px solid #eaeaea; margin: 20px 0;"><p style="color: #666; font-size: 14px;">Reply to this email or log into your Zeneva account to continue the conversation.</p>`,
                        from: 'Zeneva Support <support@zeneva.space>',
                        replyTo: 'support@zeneva.space',
                        type: 'support'
                    });
                }
            }
        } catch (emailErr) {
            console.warn('Failed to send support email:', emailErr);
        }

        return { success: true };
    } catch (error: any) {
        console.error('sendDirectUserPush error:', error);
        return { success: false, error: error.message };
    }
}
