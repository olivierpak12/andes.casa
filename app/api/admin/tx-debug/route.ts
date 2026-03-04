import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const TRON_GRID_URL = process.env.TRONGRID_API_URL || 'https://nile.trongrid.io';
const TRON_GRID_KEY = process.env.TRONGRID_API_KEY || '';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.contact) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require admin role
    const caller = await convex.query(api.user.getUserByContact, { contact: session.user.contact });
    if (!caller || caller.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { transactionId, contact } = body || {};

    let transaction: any = null;

    if (transactionId) {
      transaction = await convex.query(api.transaction.getTransactionById, { transactionId });
    } else if (contact) {
      const user = await convex.query(api.user.getUserByContact, { contact });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const txs = await convex.query(api.transaction.getTransactionHistory, { userId: user._id });
      return NextResponse.json({ user: { _id: user._id, contact: user.contact }, transactions: txs });
    } else {
      return NextResponse.json({ error: 'Provide transactionId or contact' }, { status: 400 });
    }

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // If we have a transactionHash, fetch Tron transaction details
    let tronInfo: any = null;
    if (transaction.transactionHash) {
      try {
        const res = await fetch(`${TRON_GRID_URL}/v1/transactions/${transaction.transactionHash}`, {
          headers: { 'TRON-PRO-API-KEY': TRON_GRID_KEY },
        });
        tronInfo = await res.json();
      } catch (err) {
        console.error('Failed to fetch Tron transaction info:', err);
        tronInfo = { error: 'Failed to fetch Tron transaction info', details: String(err) };
      }
    }

    return NextResponse.json({ transaction, tronInfo });
  } catch (err: any) {
    console.error('tx-debug error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
