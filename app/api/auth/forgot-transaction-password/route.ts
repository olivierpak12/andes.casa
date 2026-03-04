import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { sendEmail, generateTransactionPasswordResetEmail } from '@/lib/emailService';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Request transaction password reset using Convex mutation
    const result: any = await convex.mutation(api.user.requestTransactionPasswordResetAction, { email });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Send email if user exists
    if (result.resetToken) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resetLink = `${baseUrl}/reset-transaction-password?token=${result.resetToken}&email=${encodeURIComponent(email)}`;

      const emailSent = await sendEmail({
        to: email,
        subject: 'Transaction Password Reset Request - Andes',
        html: generateTransactionPasswordResetEmail(resetLink, ''),
      });

      if (!emailSent) {
        console.error(`Failed to send transaction password reset email to ${email}`);
      }
    }

    return NextResponse.json(
      { success: true, message: 'If an account with that email exists, a reset link has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Transaction password reset request error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process transaction password reset request' },
      { status: 500 }
    );
  }
}
