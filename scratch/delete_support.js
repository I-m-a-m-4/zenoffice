const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Handle escaped newlines in private key
const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Missing required Firebase environment variables in .env file.");
  process.exit(1);
}

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const db = admin.firestore();

async function deleteCollection(collectionRef) {
  const query = collectionRef.limit(100);
  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid exploding the stack
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function cleanSupportCollection() {
  console.log("🚀 Starting cleanup of supportThreads and messages...");
  
  try {
    const supportThreadsRef = db.collection('supportThreads');
    const snapshot = await supportThreadsRef.get();
    
    console.log(`Found ${snapshot.size} support threads.`);
    
    for (const doc of snapshot.docs) {
      const threadId = doc.id;
      console.log(`Processing thread: ${threadId}`);
      
      // Delete all messages in subcollection first
      const messagesRef = supportThreadsRef.doc(threadId).collection('messages');
      const messagesSnapshot = await messagesRef.get();
      console.log(`  Deleting ${messagesSnapshot.size} messages in messages subcollection...`);
      
      const batch = db.batch();
      messagesSnapshot.docs.forEach((msgDoc) => {
        batch.delete(msgDoc.ref);
      });
      await batch.commit();
      
      // Delete the thread document itself
      await supportThreadsRef.doc(threadId).delete();
      console.log(`  Deleted thread document: ${threadId}`);
    }
    
    console.log("✅ Support threads and messages successfully cleaned up!");
  } catch (error) {
    console.error("❌ Error cleaning up support collection:", error);
  }
}

cleanSupportCollection().then(() => {
  console.log("Cleanup job complete.");
  process.exit(0);
});
