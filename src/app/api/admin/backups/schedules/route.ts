import { NextResponse } from 'next/server';
import { adminAuth } from '@/firebase/admin';
import { GoogleAuth } from 'google-auth-library';

const ADMIN_EMAIL = 'belloimam431@gmail.com';

async function getGoogleAuthToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error('Missing Google service account credentials in environment.');
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.includes('---') ? privateKey.replace(/\\n/g, '\n') : privateKey,
    },
    projectId: projectId,
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return { token: tokenResponse.token, projectId };
}

export async function GET(request: Request) {
  // 1. Authorize the caller
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const idToken = authHeader.substring(7);
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  // 2. Fetch schedules, backups, and databases from Firestore Admin REST API
  try {
    const { token, projectId } = await getGoogleAuthToken();

    // Fetch Backup Schedules
    const schedulesUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/backupSchedules`;
    const schedulesRes = await fetch(schedulesUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const schedulesData = await schedulesRes.json();

    // Fetch All Backups
    const backupsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/locations/-/backups`;
    const backupsRes = await fetch(backupsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const backupsData = await backupsRes.json();

    // Fetch All Database Instances (so we know if they restored one)
    const databasesUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases`;
    const databasesRes = await fetch(databasesUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const databasesData = await databasesRes.json();

    return NextResponse.json({
      schedules: schedulesData.backupSchedules || [],
      backups: backupsData.backups || [],
      databases: databasesData.databases || [],
    });
  } catch (err: any) {
    console.error('Error fetching backup info:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
