import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reason, details, aiResult, prompt, timestamp } = body;

    // Log the AI feedback report for human review
    console.log('[Zen AI Content Report]:', {
      timestamp: timestamp || new Date().toISOString(),
      reason: reason || 'unspecified',
      details: details || '',
      promptSnippet: (prompt || '').slice(0, 200),
      resultSnippet: (aiResult || '').slice(0, 300),
    });

    return NextResponse.json({
      success: true,
      message: 'Thank you for your report. Our safety team reviews all flagged AI output.',
      reportId: `rep_${Date.now()}`
    });
  } catch (error: any) {
    console.error('Failed to process AI report:', error);
    return NextResponse.json(
      { error: 'REPORT_FAILED', message: error.message || 'Unable to submit report' },
      { status: 500 }
    );
  }
}
