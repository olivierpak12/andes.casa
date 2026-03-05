import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getTransactionInfo, parseTRC20Transfer, getAccountBalance } from '@/lib/tron/utils';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET: Verify transfer actually happened on blockchain
 * Checks transaction hash and confirms USDT was actually transferred
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

    // Get query parameter for transfer ID or transaction hash
    const { searchParams } = new URL(req.url);
    const transferId = searchParams.get('transferId');
    const txHash = searchParams.get('txHash');

    if (!transferId && !txHash) {
      return NextResponse.json(
        { error: "Provide either transferId or txHash parameter" },
        { status: 400 }
      );
    }

    let transactionHash = txHash;
    let transfer = null;

    // If transferId provided, get the hash from database
    if (transferId && !txHash) {
      try {
        transfer = await convex.query(api.externalTransfer.getTransfersByAdmin, {
          adminId: user._id,
        });
        transfer = transfer?.find((t: any) => t._id === transferId);
        
        if (!transfer) {
          return NextResponse.json(
            { error: "Transfer not found" },
            { status: 404 }
          );
        }

        transactionHash = transfer.transactionHash || null;

        if (!transactionHash) {
          return NextResponse.json({
            success: false,
            status: transfer.status,
            message: 'Transfer has no transaction hash yet - may still be pending',
            transfer: {
              id: transfer._id,
              amount: transfer.amount,
              recipient: transfer.recipientAddress,
              status: transfer.status,
              createdAt: new Date(transfer.createdAt).toLocaleString(),
            },
          });
        }
      } catch (error: any) {
        console.error('[VERIFY] Error fetching transfer:', error);
        return NextResponse.json(
          { error: "Failed to fetch transfer details" },
          { status: 500 }
        );
      }
    }

    if (!transactionHash) {
      return NextResponse.json(
        { error: "No transaction hash available for verification" },
        { status: 400 }
      );
    }

    // Get transaction info from blockchain
    console.log('[VERIFY] Checking transaction hash:', transactionHash);
    const txInfo = await getTransactionInfo(transactionHash);

    if (!txInfo) {
      return NextResponse.json({
        success: false,
        message: 'Transaction not found on blockchain',
        txHash: transactionHash,
        status: 'NOT FOUND',
        recommendation: 'Transaction hash does not exist on blockchain. Transfer may have failed.',
      });
    }

    // Parse the transaction to extract transfer details
    const transferData = parseTRC20Transfer(txInfo);

    if (!transferData) {
      return NextResponse.json({
        success: false,
        message: 'Transaction is not a valid USDT transfer',
        txHash: transactionHash,
        transactionStatus: txInfo.ret?.[0]?.contractRet || 'UNKNOWN',
        recommendation: 'This transaction exists but is not a valid TRC20 USDT transfer',
      });
    }

    // Verify the transaction was successful
    const isSuccessful = txInfo.ret?.[0]?.contractRet === 'SUCCESS';

    return NextResponse.json({
      success: isSuccessful,
      verified: isSuccessful,
      txHash: transactionHash,
      transaction: {
        from: transferData.from,
        to: transferData.to,
        amount: transferData.amount,
        contract: transferData.contractAddress,
        status: isSuccessful ? 'SUCCESS' : 'FAILED',
        blockNumber: txInfo.blockNumber || 'Not yet confirmed',
        confirmed: !!txInfo.blockNumber,
      },
      transfer: transfer ? {
        id: transfer._id,
        amount: transfer.amount,
        recipient: transfer.recipientAddress,
        status: transfer.status,
      } : undefined,
      message: isSuccessful 
        ? `✅ Transfer verified: ${transferData.amount} USDT sent to ${transferData.to}`
        : '❌ Transfer failed on blockchain',
    });
  } catch (error: any) {
    console.error('[VERIFY] Error:', error);
    return NextResponse.json({
      error: error.message || "Verification failed",
      details: error.message,
    }, { status: 500 });
  }
}
