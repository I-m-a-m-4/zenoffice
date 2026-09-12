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

async function checkUser() {
  const userId = 'GNJl8UNC72fzG0u3EPtGdBZsgiV2';
  console.log('Checking user:', userId);

  const userDoc = await db.collection('users').doc(userId).get();
  console.log('User Exists:', userDoc.exists);
  if (userDoc.exists) {
      console.log('User Data:', userDoc.data());
  }

  const businessesByOwner = await db.collection('businesses').where('ownerId', '==', userId).get();
  console.log('Businesses where ownerId == userId:', businessesByOwner.size);
  businessesByOwner.forEach(b => console.log('Business Data:', b.data()));

  const allBusinesses = await db.collection('businesses').limit(10).get();
  console.log('Sample businesses:');
  allBusinesses.forEach(b => console.log('ID:', b.id, 'ownerId:', b.data().ownerId, 'name:', b.data().name));

}

checkUser();
