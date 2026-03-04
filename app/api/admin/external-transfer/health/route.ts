import { NextResponse } from 'next/server';

/**
 * GET: Health check endpoint for external-transfer API
 * No authentication required - just verifies the API is running
 */
export async function GET(req: Request) {
  try {
    console.log('[HEALTH] External transfer API health check');
    return NextResponse.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'External transfer API is running',
    });
  } catch (error: any) {
    console.error('[HEALTH] Health check failed:', error);
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}
