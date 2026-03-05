import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getAccountBalance, getAddressFromPrivateKey } from '@/lib/tron/utils';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Get hot wallet address from private key or use fallback
function getHotWalletAddress(): string {
  try {
    if (process.env.TRON_PRIVATE_KEY) {
      const { address } = getAddressFromPrivateKey(process.env.TRON_PRIVATE_KEY);
      if (address) return address;
    }
  } catch (error) {
    console.log('Could not derive address from private key, using fallback');
  }
  
  // Fallback to known hot wallet address
  return 'TRahYuQRtfd92wYBqS4rKpb3MmfYv5RHLT';
}

/**
 * GET: Check real hot wallet balance from blockchain
 * Also returns database-tracked transactions
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.contact) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await convex.query(api.user.getUserByContact, {
      contact: session.user.contact,
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get real blockchain balance
    const HOT_WALLET_ADDRESS = getHotWalletAddress();
    const blockchainBalance = await getAccountBalance(HOT_WALLET_ADDRESS);
    console.log('[HOT_WALLET_BALANCE] Blockchain balance:', blockchainBalance);

    // Get all transfers (to calculate what should have been deducted)
    const transfers = await convex.query(api.externalTransfer.getTransfersByAdmin, {
      adminId: user._id,
    });

    // Calculate total transferred
    const completedTransfers = transfers?.filter((t: any) => t.status === 'completed') || [];
    const totalTransferred = completedTransfers.reduce((sum: number, t: any) => sum + t.amount, 0);

    // Calculate expected balance (blockchain balance + what we transferred)
    // Note: This is approximate - the real balance on blockchain is what matters
    const analysis: any = {
      hotwallet: {
        address: HOT_WALLET_ADDRESS,
        blockchainBalance: blockchainBalance,
      },
      transfers: {
        totalCompleted: completedTransfers.length,
        totalTransferredAmount: totalTransferred,
        transfers: completedTransfers.map((t: any) => ({
          id: t._id,
          recipient: t.recipientAddress,
          amount: t.amount,
          status: t.status,
          txHash: t.transactionHash,
          createdAt: new Date(t.createdAt).toLocaleString(),
        })),
      },
      balance: {
        availableOnBlockchain: blockchainBalance.usdt,
        trxForFees: blockchainBalance.trx,
      },
      recommendations: [] as any[],
    };

    // Add recommendations based on balance
    if (blockchainBalance.usdt < totalTransferred) {
      analysis.recommendations.push({
        type: 'WARNING',
        message: 'Hot wallet USDT balance is less than total transferred - some transfers may have failed on blockchain',
      });
    }

    if (blockchainBalance.trx < 1) {
      analysis.recommendations.push({
        type: 'ERROR',
        message: 'Hot wallet has insufficient TRX for gas fees - transfers will fail',
      });
    }

    return NextResponse.json({
      success: true,
      ...analysis,
    });
  } catch (error: any) {
    console.error('[HOT_WALLET_BALANCE] Error:', error);
    return NextResponse.json({
      error: error.message || "Failed to get hot wallet balance",
      details: error.message,
    }, { status: 500 });
  }
}

/**
 * POST: Zero out database transferred balance after verification
 * Use this to sync database with actual blockchain after transfers complete
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.contact) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await convex.query(api.user.getUserByContact, {
      contact: session.user.contact,
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'verify-balance') {
      // Just verify the current balance
      const HOT_WALLET_ADDRESS = getHotWalletAddress();
      const balance = await getAccountBalance(HOT_WALLET_ADDRESS);
      return NextResponse.json({
        success: true,
        message: 'Hot wallet balance verified',
        balance: {
          usdt: balance.usdt,
          trx: balance.trx,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error('[HOT_WALLET_BALANCE][POST] Error:', error);
    return NextResponse.json({
      error: error.message || "Failed to process hot wallet request",
    }, { status: 500 });
  }
}
