export const dynamic = 'force-static'; // [TAURI_INJECTED]
// [TAURI_HIDDEN] export const dynamic = 'force-static';
﻿import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }

    if (!adminAuth) {
      console.error('Firebase Admin Auth is not initialized');
      
      return NextResponse.json({ error: 'Authentication service not configured' }, { status: 500 });
    }

    // Verify the ID token sent from the client
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Create a custom token for this user (valid for 1 hour)
    const customToken = await adminAuth.createCustomToken(uid);

    return NextResponse.json({ customToken });
  } catch (error: any) {
    console.error('Error creating custom login token:', error);
    return NextResponse.json({ error: 'Authentication failed', details: error.message }, { status: 500 });
  }
}


