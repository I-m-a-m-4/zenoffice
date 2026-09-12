import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

if (!getFirestore) {
    initializeApp({
        credential: cert(serviceAccount)
    });
} else {
    try {
        initializeApp({
            credential: cert(serviceAccount)
        });
    } catch (e) {}
}

const db = getFirestore();

async function cleanup() {
  console.log("NUCLEAR WIPE: Deleting all existing blog posts...");
  try {
    const snapshot = await db.collection('blogPosts').get();
    
    if (snapshot.empty) {
      console.log("No blog posts found to delete.");
      process.exit(0);
    }

    console.log(`Found ${snapshot.size} posts. Initializing batch delete...`);
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log("SUCCESS: All blog posts have been removed.");
    process.exit(0);
  } catch (err) {
    console.error("Error during cleanup:", err);
    process.exit(1);
  }
}

cleanup();
