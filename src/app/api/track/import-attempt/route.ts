import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId = 'anonymous',
      userEmail = '',
      userName = '',
      businessId = '',
      businessName = '',
      action = 'unknown_action',
      source = '',
      fileName = '',
      fileSize = 0,
      fileType = '',
      metadata = {},
    } = body;

    const docData: Record<string, any> = {
      userId,
      userEmail,
      userName,
      businessId,
      businessName,
      action,
      timestamp: FieldValue.serverTimestamp(),
    };

    if (source) docData.source = source;
    if (fileName) docData.fileName = fileName;
    if (fileSize) docData.fileSize = fileSize;
    if (fileType) docData.fileType = fileType;
    if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
      docData.metadata = metadata;
    }

    const docRef = await adminFirestore.collection('import_attempts').add(docData);

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    console.error('Failed to record import attempt telemetry:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
