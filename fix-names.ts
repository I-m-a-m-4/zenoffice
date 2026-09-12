import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey && privateKey.includes('\\n')) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: privateKey,
};

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function run() {
  console.log('Starting DB fix for Unknown user support threads...');
  try {
    const threadsSnapshot = await db.collection('supportThreads').get();
    let updatedCount = 0;

    for (const doc of threadsSnapshot.docs) {
      const data = doc.data();
      if (!data.userName || data.userName === 'Unknown user' || data.userName.includes('@')) {
        const userId = data.userId;
        if (!userId) continue;

        // fetch user
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        let newName = '';
        if (userData) {
          newName = userData.name || userData.business?.name || '';
          
          if (!newName && userData.businessId) {
             const businessDoc = await db.collection('businessInstances').doc(userData.businessId).get();
             if (businessDoc.exists) {
                 newName = businessDoc.data()?.name || '';
             }
          }
        }

        if (newName && newName !== 'Unknown user') {
          await doc.ref.update({ userName: newName });
          updatedCount++;
          console.log(`Updated thread ${doc.id} with new name: ${newName}`);
        } else if (userData?.email) {
            await doc.ref.update({ userName: userData.email });
            updatedCount++;
            console.log(`Updated thread ${doc.id} with fallback email: ${userData.email}`);
        }
      }
    }
    console.log(`Finished. Updated ${updatedCount} threads successfully.`);
  } catch (error) {
    console.error('Error fixing support names:', error);
  }
}

run();
