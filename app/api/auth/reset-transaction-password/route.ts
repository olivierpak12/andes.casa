import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { token, email, transactionPassword } = await req.json();

    if (!token || !transactionPassword) {
      return NextResponse.json(
        { success: false, error: 'Token and transaction password are required' },
        { status: 400 }
      );
    }

    if (transactionPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Transaction password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Reset transaction password using Convex action
    const result: any = await convex.action(api.user.resetTransactionPasswordAction, {
      token,
      email,
      transactionPassword,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Transaction password has been reset successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Transaction password reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset transaction password' },
      { status: 500 }
    );
  }
}
