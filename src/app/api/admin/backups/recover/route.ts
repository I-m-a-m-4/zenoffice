import { NextResponse } from 'next/server';
import { adminAuth } from '@/firebase/admin';
import * as admin from 'firebase-admin';

const ADMIN_EMAIL = 'belloimam431@gmail.com';

// Collections that contain documents with a `businessId` field
const SCOPED_COLLECTIONS = ['products', 'receipts', 'branches', 'onlineOrders', 'users'];

export async function POST(request: Request) {
  // 1. Authenticate the caller
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const idToken = authHeader.substring(7);
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.email !== ADMIN_EMAIL) {
      return new Response('Forbidden', { status: 403 });
    }
  } catch (error) {
    return new Response('Unauthorized: Invalid token', { status: 401 });
  }

  // 2. Parse request payload
  let payload: { businessId?: string; sourceDbId?: string; isDryRun?: boolean } = {};
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  const { businessId, sourceDbId = 'restored-db', isDryRun = false } = payload;
  if (!businessId) {
    return new Response('Missing businessId', { status: 400 });
  }

  // 3. Setup Response Stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const log = (msg: string) => {
        controller.enqueue(encoder.encode(JSON.stringify({ time: new Date().toISOString(), message: msg }) + '\n'));
      };

      try {
        log(`Initializing targeted tenant recovery for business ID: ${businessId}`);
        log(`Source Database: ${sourceDbId} | Destination Database: (default)`);
        log(`Mode: ${isDryRun ? 'DRY RUN (No writes will be committed)' : 'LIVE RESTORE'}`);

        if (!admin.apps.length) {
          throw new Error('Firebase Admin SDK is not initialized.');
        }

        // Initialize source and destination Firestore instances
        const destDb = admin.firestore();
        let sourceDb: admin.firestore.Firestore;
        try {
          sourceDb = admin.firestore(admin.apps[0], sourceDbId);
        } catch (err: any) {
          throw new Error(`Failed to connect to source database "${sourceDbId}": ${err.message}`);
        }

        // --- STEP 1: Copy businessInstances/{businessId} ---
        log(`[Step 1/4] Reading businessInstance profile...`);
        const bizDocRef = sourceDb.collection('businessInstances').doc(businessId);
        const bizDocSnap = await bizDocRef.get();

        if (!bizDocSnap.exists) {
          throw new Error(`Business Instance "${businessId}" not found in source database.`);
        }

        const bizData = bizDocSnap.data()!;
        log(`Found Business Instance: "${bizData.name || 'Unnamed'}"`);

        if (!isDryRun) {
          await destDb.collection('businessInstances').doc(businessId).set(bizData);
          log(`Successfully wrote businessInstance profile.`);
        }

        // Subcollections of businessInstances
        const subcollections = ['auditLogs', 'stats'];
        for (const subName of subcollections) {
          log(`Checking subcollection "${subName}"...`);
          const subSnap = await bizDocRef.collection(subName).get();
          log(`Found ${subSnap.size} documents in "${subName}"`);

          if (!isDryRun && subSnap.size > 0) {
            let batch = destDb.batch();
            let count = 0;
            for (const doc of subSnap.docs) {
              const targetRef = destDb.collection('businessInstances').doc(businessId).collection(subName).doc(doc.id);
              batch.set(targetRef, doc.data());
              count++;
              if (count % 100 === 0) {
                await batch.commit();
                batch = destDb.batch();
              }
            }
            if (count % 100 !== 0) {
              await batch.commit();
            }
            log(`Migrated ${count} documents in "${subName}"`);
          }
        }

        // --- STEP 2: Copy Scoped Collections ---
        log(`[Step 2/4] Migrating tenant-scoped collections...`);
        for (const colName of SCOPED_COLLECTIONS) {
          log(`Querying "${colName}" where businessId == "${businessId}"...`);
          const snap = await sourceDb.collection(colName).where('businessId', '==', businessId).get();
          log(`Found ${snap.size} documents in "${colName}"`);

          if (!isDryRun && snap.size > 0) {
            let batch = destDb.batch();
            let count = 0;
            for (const doc of snap.docs) {
              const targetRef = destDb.collection(colName).doc(doc.id);
              batch.set(targetRef, doc.data());
              count++;
              if (count % 100 === 0) {
                await batch.commit();
                batch = destDb.batch();
              }
            }
            if (count % 100 !== 0) {
              await batch.commit();
            }
            log(`Migrated ${count} documents in "${colName}"`);
          }

          // If copying users, we need to copy user subcollections
          if (colName === 'users') {
            log(`[Step 3/4] Checking subcollections for ${snap.size} users...`);
            for (const userDoc of snap.docs) {
              const userId = userDoc.id;
              const userSubNames = ['fcmTokens', 'notifications', 'sessions', 'journey'];
              for (const subName of userSubNames) {
                const subSnap = await sourceDb.collection('users').doc(userId).collection(subName).get();
                if (subSnap.size > 0) {
                  log(`Found ${subSnap.size} documents in user "${userId}" subcollection "${subName}"`);
                  if (!isDryRun) {
                    let batch = destDb.batch();
                    let count = 0;
                    for (const doc of subSnap.docs) {
                      const targetRef = destDb.collection('users').doc(userId).collection(subName).doc(doc.id);
                      batch.set(targetRef, doc.data());
                      count++;
                      if (count % 100 === 0) {
                        await batch.commit();
                        batch = destDb.batch();
                      }
                    }
                    if (count % 100 !== 0) {
                      await batch.commit();
                    }
                    log(`Migrated ${count} documents in user "${userId}" subcollection "${subName}"`);
                  }
                }
              }
            }
          }
        }

        log(`[Step 4/4] Finalizing recovery checks...`);
        log(`Recovery operation completed successfully!`);
        controller.close();
      } catch (err: any) {
        log(`ERROR: ${err.message || err}`);
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
