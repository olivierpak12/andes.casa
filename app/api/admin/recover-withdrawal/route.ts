import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transactionHash, transactionId, reason } = body || {};

    if (!transactionHash && !transactionId) {
      return NextResponse.json(
        { error: 'Provide either transactionHash or transactionId' },
        { status: 400 }
      );
    }

    // If we have txHash, use the recovery mutation (no auth needed for recovery)
    if (transactionHash) {
      try {
        const result = await convex.mutation(api.recovery.recoverWithdrawalByHash, {
          transactionHash,
          reason: reason || 'Invalid blockchain txhash',
        });
        return NextResponse.json({
          success: true,
          ...result,
        });
      } catch (err: any) {
        return NextResponse.json(
          { error: err.message || 'Recovery failed' },
          { status: 400 }
        );
      }
    }

    // If we have transactionId, require admin auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.contact) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caller = await convex.query(api.user.getUserByContact, {
      contact: session.user.contact,
    });
    if (!caller || caller.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch transaction by ID to get hash, then recover
    const tx = await convex.query(api.transaction.getTransactionById, {
      transactionId,
    });
    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (tx.transactionHash) {
      const result = await convex.mutation(api.recovery.recoverWithdrawalByHash, {
        transactionHash: tx.transactionHash,
        reason: reason || 'Admin recovery',
      });
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    return NextResponse.json(
      { error: 'Transaction has no hash to recover' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Recovery error:', err);
    return NextResponse.json(
      { error: err.message || 'Recovery failed' },
      { status: 500 }
    );
  }
}

