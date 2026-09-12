import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  console.error('Missing Firebase credentials in .env');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  })
});

const db = admin.firestore();

async function run() {
  const receiptsSnapshot = await db.collection('receipts').limit(100).get();
  console.log(`Total receipts in query: ${receiptsSnapshot.size}`);
  
  const sample = [];
  receiptsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.customer?.name === 'ONLINE' || data.customer?.id === 'ONLINE' || (data.customer?.name && data.customer.name.toLowerCase().includes('online'))) {
      sample.push({
        id: doc.id,
        customerName: data.customer?.name,
        total: data.total,
        paymentMethod: data.paymentMethod,
        status: data.status,
      });
    }
  });

  console.log('ONLINE receipts count:', sample.length);
  console.log('ONLINE receipts sample:', JSON.stringify(sample.slice(0, 10), null, 2));

  const genSample = [];
  receiptsSnapshot.forEach(doc => {
    const data = doc.data();
    if (genSample.length < 5) {
      genSample.push({
        id: doc.id,
        customerName: data.customer?.name,
        total: data.total,
        paymentMethod: data.paymentMethod,
        status: data.status,
      });
    }
  });
  console.log('General receipts sample:', JSON.stringify(genSample, null, 2));
}

run().catch(console.error);
