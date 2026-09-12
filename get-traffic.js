const admin = require('firebase-admin');

// Load environment variables if needed
require('dotenv').config({ path: './.env' });

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        })
    });
}

const db = admin.firestore();

async function run() {
    try {
        const snapshot = await db.collection('app_launches').get();
        const countries = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const country = data.country || 'unknown';
            countries[country] = (countries[country] || 0) + 1;
        });

        console.log('--- Country Breakdown (Visits/Installs) ---');
        console.table(countries);
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
