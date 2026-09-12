import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { adminFirestore } from './src/firebase/admin';

async function run() {
  if (!adminFirestore) {
    console.error('adminFirestore not initialized - check .env.local keys!');
    process.exit(1);
  }

  const email = 'umahivictor2100@gmail.com';
  console.log(`Searching for user with email: ${email}...`);

  let businessId = '';

  // 1. Search by email
  const userSnap = await adminFirestore.collection('users').where('email', '==', email).limit(1).get();
  if (!userSnap.empty) {
    const userData = userSnap.docs[0].data();
    businessId = userData.businessId;
    console.log(`Found user ${userData.name || email}, linked businessId: ${businessId}`);
  }

  // 2. Fallback search business by prefix p3JahP
  if (!businessId) {
    console.log('Searching businessInstances by prefix p3JahP...');
    const bizSnap = await adminFirestore.collection('businessInstances').get();
    const match = bizSnap.docs.find((d: any) => d.id.startsWith('p3JahP') || d.id.substring(0, 6) === 'p3JahP');
    if (match) {
      businessId = match.id;
      console.log(`Found businessInstance by prefix: ${businessId}`);
    }
  }

  if (!businessId) {
    console.error('Could not find business for email or prefix p3JahP!');
    process.exit(1);
  }

  // Calculate 1 month expiration
  const businessRef = adminFirestore.collection('businessInstances').doc(businessId);
  const bizDoc = await businessRef.get();
  const bData = bizDoc.data() || {};

  const currentExpiry = bData.trialExpiresAt?.toDate ? bData.trialExpiresAt.toDate() : null;
  const startDate = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
  const expiresAt = new Date(startDate);
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const batch = adminFirestore.batch();
  batch.update(businessRef, {
    plan: 'pro',
    trialExpiresAt: expiresAt,
    accessLevel: null,
    updatedAt: new Date()
  });

  const purchasesRef = adminFirestore.collection('purchases').doc();
  batch.set(purchasesRef, {
    businessId,
    userEmail: email,
    plan: 'pro',
    amount: 10000,
    currency: 'NGN',
    reference: 'z-p3JahP-1788526200987',
    timestamp: new Date(),
    verifiedServerSide: true,
    source: 'manual-admin-grant'
  });

  const historyRef = businessRef.collection('subscription_history').doc();
  batch.set(historyRef, {
    action: 'Subscribed to Pro plan for 1 month(s)',
    amount: 10000,
    currency: 'NGN',
    timestamp: new Date(),
    reference: 'z-p3JahP-1788526200987'
  });

  await batch.commit();
  console.log(`SUCCESS: Upgraded business ${businessId} (${bData.name || 'Store'}) to PRO plan until ${expiresAt.toISOString()}!`);
  process.exit(0);
}

run().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
