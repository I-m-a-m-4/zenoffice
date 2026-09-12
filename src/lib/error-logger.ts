import { firebaseApp, auth, firestore } from '../firebase/instance';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Save reference to original native console before any libraries hook it
const nativeConsoleError = typeof window !== 'undefined' ? (window.console.error || console.error) : console.error;

// Prevent spam: Max 5 errors per session
let errorCount = 0;
const MAX_ERRORS_PER_SESSION = 5;
let isLogging = false;

interface ErrorLogPayload {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  userId?: string;
  businessId?: string;
  type: 'react' | 'window' | 'unhandledrejection' | 'api' | 'anomaly';
  code?: string;
  details?: Record<string, any>;
  createdAt?: any;
}

export const logErrorToFirestore = async (
  error: Error,
  type: ErrorLogPayload['type'],
  context?: { userId?: string; businessId?: string }
) => {
  if (typeof window === 'undefined') return; // Do not log server-side errors to this client collection
  if (isLogging) return;
  if (errorCount >= MAX_ERRORS_PER_SESSION) return;

  isLogging = true;

  // Filter out benign or expected errors — network noise, Firestore internals, browser quirks
  const errorMsg = error.message || String(error);
  const errorStack = error.stack || '';

  const NOISE_PATTERNS = [
    // Permissions (handled separately)
    'Missing or insufficient permissions',
    'permission-denied',
    // Network connectivity noise
    'network error',
    'Failed to fetch',
    'ERR_CONNECTION_CLOSED',
    'ERR_CONNECTION_REFUSED',
    'ERR_NETWORK_CHANGED',
    'ERR_INTERNET_DISCONNECTED',
    'net::ERR_',
    // Firestore internal transport errors
    'webchannel',
    'firestore.googleapis.com',
    'Listen/channel',
    'Bad Request',
    '400',
    // Font / favicon / CDN noise
    'fonts.googleapis.com',
    'favicon.ico',
    '404 (Not Found)',
    // React dev mode noise
    'Fast Refresh',
    // Generic offline noise
    'Failed to load resource',
    // Admin cyber-shield — intentionally caught & handled errors
    'Entity not found in current grid',
    'Termination failed',
    'Termination aborted',
  ];

  if (NOISE_PATTERNS.some(p => errorMsg.includes(p) || errorStack.includes(p))) {
    return;
  }

  errorCount++;

  try {
    const payload: ErrorLogPayload = {
      message: errorMsg,
      stack: error.stack || 'No stack trace available',
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: context?.userId || 'unknown',
      businessId: context?.businessId || 'unknown',
      type,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(firestore, 'error_logs'), payload);
  } catch (err) {
    nativeConsoleError('Failed to log error to Firestore, queuing locally:', err);
    try {
      const offlinePayload = {
        message: errorMsg,
        stack: error.stack || 'No stack trace available',
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: context?.userId || 'unknown',
        businessId: context?.businessId || 'unknown',
        type,
        createdAt: new Date().toISOString(),
      };
      const offlineLogs = JSON.parse(localStorage.getItem('failed_logs') || '[]');
      offlineLogs.push({ payload: offlinePayload, error: err instanceof Error ? err.message : String(err), timestamp: Date.now() });
      localStorage.setItem('failed_logs', JSON.stringify(offlineLogs.slice(-20))); // Keep last 20
    } catch (e) {
      // If local storage is also full or blocked, fail completely silent
    }
  } finally {
    isLogging = false;
  }
};

/**
 * Reports a silent data anomaly — something that is not a thrown error but is
 * still wrong, and that nobody would otherwise find out about.
 *
 * It lands in `error_logs`, which the admin shell already watches live
 * (`admin-imamshaffy/layout.tsx`): a new document raises the unread badge and an
 * OS notification, so writing one *is* the way to tell the platform owner.
 *
 * Deliberately not routed through `logErrorToFirestore`:
 *
 * - the `NOISE_PATTERNS` filter there would drop most of these, because an
 *   anomaly usually *names* its cause and the causes are "permission-denied",
 *   "Failed to fetch" and friends;
 * - the 5-per-session error budget is for a page that is falling over, and an
 *   anomaly must not be crowded out of it.
 *
 * Throttled per `code` per device per day. A device with a broken SQLite file
 * hits the same anomaly on every launch, and the point is to learn that it
 * happened, not to pay for a document each time.
 */
const ANOMALY_THROTTLE_MS = 24 * 60 * 60 * 1000;
const anomaliesThisSession = new Set<string>();

export const reportAnomaly = async (
  code: string,
  message: string,
  context?: { userId?: string; businessId?: string; details?: Record<string, any> }
) => {
  if (typeof window === 'undefined') return;
  if (anomaliesThisSession.has(code)) return;
  anomaliesThisSession.add(code);

  const throttleKey = `zeneva_anomaly_${code}`;
  try {
    const last = Number(localStorage.getItem(throttleKey) || 0);
    if (last && Date.now() - last < ANOMALY_THROTTLE_MS) return;
    localStorage.setItem(throttleKey, Date.now().toString());
  } catch {
    // No localStorage — report it anyway; the session guard above still holds.
  }

  const payload: ErrorLogPayload = {
    message: `[${code}] ${message}`,
    stack: `Anomaly: ${code}`,
    url: window.location.href,
    userAgent: navigator.userAgent,
    userId: context?.userId || 'unknown',
    businessId: context?.businessId || 'unknown',
    type: 'anomaly',
    code,
    details: context?.details,
    createdAt: serverTimestamp(),
  };

  try {
    await addDoc(collection(firestore, 'error_logs'), payload);
  } catch (err) {
    nativeConsoleError('Failed to report anomaly, queuing locally:', err);
    try {
      const offlineLogs = JSON.parse(localStorage.getItem('failed_logs') || '[]');
      offlineLogs.push({
        payload: { ...payload, createdAt: new Date().toISOString() },
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      });
      localStorage.setItem('failed_logs', JSON.stringify(offlineLogs.slice(-20)));
      // The write never landed, so let the next launch try again.
      localStorage.removeItem(throttleKey);
    } catch {
      // Nothing left to try.
    }
  }
};

export const flushOfflineErrors = async () => {
  if (typeof window === 'undefined' || !firestore) return;
  try {
    const offlineLogs = JSON.parse(localStorage.getItem('failed_logs') || '[]');
    if (!offlineLogs || offlineLogs.length === 0) return;

    // Load dynamic import of firestore functions to avoid dependencies issues
    const { collection: col, addDoc: add } = await import('firebase/firestore');

    const batch = [];
    for (const log of offlineLogs) {
      batch.push(
        add(col(firestore, 'error_logs'), {
          ...log.payload,
          syncedAt: new Date().toISOString(),
        })
      );
    }
    await Promise.all(batch);
    localStorage.removeItem('failed_logs');
  } catch (err) {
    nativeConsoleError('Failed to flush offline errors to Firestore:', err);
  }
};
