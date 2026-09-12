import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore';
import { track } from '@vercel/analytics';

export type ImportAttemptPayload = {
  userId?: string;
  userEmail?: string;
  userName?: string;
  businessId?: string;
  businessName?: string;
  action: string;
  source?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  metadata?: Record<string, any>;
};

/**
 * Robust dual-write telemetry logger for inventory import interactions.
 * Records both to Firestore directly and forwards to the server-side API.
 */
export async function logImportTelemetry(
  firestore: Firestore | null | undefined,
  payload: ImportAttemptPayload
): Promise<void> {
  // 1. Vercel Analytics tracking
  try {
    track(`import_${payload.action}`, {
      source: payload.source || 'unspecified',
      businessId: payload.businessId,
      fileName: payload.fileName,
    });
  } catch {
    // Vercel analytics non-fatal
  }

  const cleanPayload = {
    userId: payload.userId || 'anonymous',
    userEmail: payload.userEmail || '',
    userName: payload.userName || '',
    businessId: payload.businessId || '',
    businessName: payload.businessName || '',
    action: payload.action,
    source: payload.source || '',
    fileName: payload.fileName || '',
    fileSize: payload.fileSize || 0,
    fileType: payload.fileType || '',
    metadata: payload.metadata || {},
  };

  // 2. Direct Firestore write (with serverTimestamp)
  if (firestore) {
    try {
      const docData: Record<string, any> = {
        ...cleanPayload,
        timestamp: serverTimestamp(),
      };
      // Clean up empty optional fields for cleaner Firestore docs
      if (!docData.source) delete docData.source;
      if (!docData.fileName) delete docData.fileName;
      if (!docData.fileSize) delete docData.fileSize;
      if (!docData.fileType) delete docData.fileType;
      if (Object.keys(docData.metadata).length === 0) delete docData.metadata;

      await addDoc(collection(firestore, 'import_attempts'), docData);
    } catch (firestoreErr) {
      console.warn('Direct Firestore import telemetry write skipped/failed:', firestoreErr);
    }
  }

  // 3. Server-side API backup write (runs in background with adminFirestore)
  try {
    if (typeof window !== 'undefined') {
      fetch('/api/track/import-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanPayload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Non-fatal
  }
}
