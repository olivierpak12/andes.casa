import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const TRON_GRID_URL = process.env.TRONGRID_API_URL || 'https://nile.trongrid.io';
const TRON_GRID_KEY = process.env.TRONGRID_API_KEY || '';

async function validateTxOnChain(txHash: string): Promise<boolean> {
  try {
    const res = await fetch(`${TRON_GRID_URL}/v1/transactions/${txHash}`, {
      headers: { 'TRON-PRO-API-KEY': TRON_GRID_KEY },
    });
    return res.ok; // 200 = exists, 404 = doesn't exist
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { autoRecover } = body || {};

    console.log('🔄 Scanning all transactions...');

    // Get all transactions
    const allTxs = await convex.query(api.transaction.getAllTransactions);

    // Find completed withdrawals
    const completedWithdrawals = allTxs.filter(
      (tx: any) => tx.type === 'withdrawal' && tx.status === 'completed' && tx.transactionHash
    );

    console.log(`Found ${completedWithdrawals.length} completed withdrawals`);

    const stuck: any[] = [];
    const valid: any[] = [];

    // Check each one on-chain
    for (const tx of completedWithdrawals) {
      if (!tx.transactionHash) {
        stuck.push(tx);
        console.log(`  ❌ Stuck: No transaction hash (${tx.amount} USDT)`);
        continue;
      }
      
      const isValid = await validateTxOnChain(tx.transactionHash);
      if (isValid) {
        valid.push(tx);
      } else {
        stuck.push(tx);
        console.log(`  ❌ Stuck: ${tx.transactionHash.substring(0, 16)}... (${tx.amount} USDT)`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Valid on-chain: ${valid.length}`);
    console.log(`   Stuck (not on-chain): ${stuck.length}`);

    if (!autoRecover) {
      return NextResponse.json({
        found: stuck.length,
        stuck: stuck.map((tx) => ({ id: tx._id, amount: tx.amount, hash: tx.transactionHash })),
      });
    }

    // Auto-recover all stuck ones
    const recovered: any[] = [];
    let totalRefunded = 0;

    for (const tx of stuck) {
      try {
        const result = await convex.mutation(api.recovery.recoverWithdrawalByHash, {
          transactionHash: tx.transactionHash,
          reason: 'Bulk recovery - invalid on-chain txhash',
        });
        recovered.push(tx);
        totalRefunded += tx.amount;
        console.log(`  ✅ Recovered: ${tx.amount} USDT`);
      } catch (err) {
        console.error(`  ❌ Failed to recover ${tx.transactionHash}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recovered ${recovered.length} stuck withdrawals`,
      found: stuck.length,
      recovered: recovered.map((tx) => ({
        userId: tx.userId,
        amount: tx.amount,
        transactionHash: tx.transactionHash,
      })),
      totalRefunded,
      valid: valid.length,
    });
  } catch (err: any) {
    console.error('Bulk recovery error:', err);
    return NextResponse.json(
      { error: err.message || 'Bulk recovery failed' },
      { status: 500 }
    );
  }
}
