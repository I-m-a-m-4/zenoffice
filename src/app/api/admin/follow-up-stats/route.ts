import { NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';
import { requireSuperAdmin, corsHeaders } from '../_guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/admin/follow-up-stats
 *
 * The 50 most recent outreach sends. Super-admin only — the logs carry merchant
 * names and email addresses.
 */
export async function GET(req: Request) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.res;

  try {
    const logsSnapshot = await adminFirestore.collection('follow_up_logs')
      .orderBy('sentAt', 'desc')
      .limit(50)
      .get();

    const logs = logsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ success: true, logs }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Fetch Follow-Up Stats Error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
}
