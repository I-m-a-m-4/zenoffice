import { NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';
import { sendNotificationToUser } from '@/lib/server/notifications';
import { INTERNAL_ACCOUNT_EMAILS } from '@/lib/platform-revenue';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { message, userName, businessName } = body;

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const querySnapshot = await adminFirestore
            .collection('users')
            .where('email', 'in', INTERNAL_ACCOUNT_EMAILS)
            .get();

        if (querySnapshot.empty) {
            return NextResponse.json({ success: true, message: 'No admin users to notify' });
        }

        const senderName = userName || businessName || 'Unknown User';
        const title = `New Support Message from ${senderName}`;
        const bodyText = message.length > 100 ? message.substring(0, 97) + '...' : message;

        const notificationPromises = querySnapshot.docs.flatMap((doc: any) => {
            // Write to in-app notification feed
            const dbWrite = adminFirestore
                .collection('users')
                .doc(doc.id)
                .collection('notifications')
                .add({
                    title,
                    body: bodyText,
                    createdAt: new Date(),
                    read: false,
                    type: 'system',
                    link: '/admin-imamshaffy/support'
                });

            // Send push notification
            const pushSend = sendNotificationToUser(doc.id, {
                title,
                body: bodyText,
                url: '/admin-imamshaffy/support',
                source: 'system',
            });

            return [dbWrite, pushSend];
        });

        await Promise.all(notificationPromises);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in support notification API:', error);
        return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
    }
}
