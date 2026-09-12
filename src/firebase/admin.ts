
import admin from 'firebase-admin';

// Check for required environment variables
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
    if (projectId && clientEmail && privateKey) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    // Handle literal \n and real newlines in the string
                    privateKey: privateKey.includes('---') 
                        ? privateKey.replace(/\\n/g, '\n') 
                        : privateKey,
                }),
            });
        } catch (error: any) {
            console.error('Firebase admin initialization error:', error.message);
        }
    } else {
        const missing = [];
        if (!projectId) missing.push('FIREBASE_PROJECT_ID');
        if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
        if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
        console.warn(`Firebase Admin missing: ${missing.join(', ')}. Admin features will be disabled.`);
    }
}

// Export safe instances (or null/mock if initialization failed to prevent build crashes)
// If not initialized, accessing these will throw, so we check app length again.
export const adminAuth = admin.apps.length ? admin.auth() : null as any;
export const adminFirestore = admin.apps.length ? admin.firestore() : null as any;
export const adminMessaging = admin.apps.length ? admin.messaging() : null as any;
