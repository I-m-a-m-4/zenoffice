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
  const businesses = await db.collection('businessInstances').get();
  console.log(`Total businesses (businessInstances): ${businesses.size}`);
  let found = false;
  for (const doc of businesses.docs) {
    const data = doc.data();
    if (data.name && data.name.toLowerCase().includes('nexusbiz')) {
      console.log('Found business:', doc.id, data);
      found = true;
      if (data.ownerId) {
        const userDoc = await db.collection('users').doc(data.ownerId).get();
        if (userDoc.exists) {
          console.log('Owner user data:', userDoc.id, userDoc.data());
        } else {
          console.log('Owner user doc does not exist for ownerId:', data.ownerId);
        }
      }
    }
  }
  if (!found) {
    console.log('Business containing "nexusbiz" not found. Printing first 10 business names:');
    let count = 0;
    businesses.forEach(b => {
      if (count < 10) {
        console.log(b.id, 'name:', b.data().name, 'ownerId:', b.data().ownerId);
        count++;
      }
    });
  }
}

run();
