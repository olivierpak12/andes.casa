import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { transferUsdt, isValidTronAddress, getAccountBalance, isValidPrivateKey, getAddressFromPrivateKey } from '@/lib/tron/utils';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface TransferRequest {
  userId: string; // User ID whose deposit to deduct from
  recipientAddress: string;
  amount: number;
  reason?: string;
}

/**
 * POST: Initiate external transfer from hot wallet
 * Only admins can initiate transfers
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.contact) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from Convex
    const user = await convex.query(api.user.getUserByContact, {
      contact: session.user.contact,
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body: TransferRequest = await req.json();
    let { userId, recipientAddress, amount, reason } = body;

    console.log('[API][POST] Received transfer request:', {
      amount,
      amountType: typeof amount,
      userId,
      recipient: recipientAddress?.substring(0, 20) + '...',
    });

    // Validate inputs
    if (!userId || !recipientAddress || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: userId, recipientAddress, amount" },
        { status: 400 }
      );
    }

    // Validate user exists
    const targetUser = await convex.query(api.user.getUserById, {
      userId: userId as any, // This will fail if user doesn't exist
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    console.log('[API][POST] Target user found:', targetUser.contact);

    // CRITICAL: Reject if amount is not a positive number
    if (typeof amount !== 'number') {
      console.error('[API][POST] ❌ Amount is not a number:', { amount, type: typeof amount });
      return NextResponse.json(
        { error: "Amount must be a valid number" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      console.error('[API][POST] ❌ Amount is not positive:', amount);
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // SAFEGUARD: Ensure amount is always positive (convert negative to positive)
    const originalAmount = amount;
    amount = Math.abs(amount);
    if (Math.abs(amount - originalAmount) > 0.001) {
      console.error('[API][POST] ⚠️ NEGATIVE AMOUNT DETECTED AND CORRECTED:', {
        original: originalAmount,
        corrected: amount,
      });
    }

    // Validate recipient address
    if (!isValidTronAddress(recipientAddress)) {
      console.log('[TRANSFER] Invalid recipient address:', recipientAddress);
      return NextResponse.json(
        { 
          error: "Invalid TRON address format",
          details: `Address must start with 'T' and be valid Base58 format. Received: ${recipientAddress.substring(0, 20)}...`,
          recipient: recipientAddress,
        },
        { status: 400 }
      );
    }

    // Get and validate private key
    const privateKey = process.env.TRON_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing hot wallet key' },
        { status: 500 }
      );
    }

    // Validate private key format
    if (!isValidPrivateKey(privateKey)) {
      return NextResponse.json(
        { 
          error: 'Server configuration error: Invalid private key format',
          details: 'Private key must be 64 character hexadecimal string'
        },
        { status: 500 }
      );
    }

    // Get and validate hot wallet address
    const { address: hotAddress, valid: addressValid } = getAddressFromPrivateKey(privateKey);
    if (!addressValid) {
      return NextResponse.json(
        { error: 'Server configuration error: Cannot derive valid address from private key' },
        { status: 500 }
      );
    }
    
    // Check hot wallet balance
    const balance = await getAccountBalance(hotAddress);
    
    if (balance.usdt < amount) {
      return NextResponse.json(
        {
          error: `Insufficient balance in hot wallet`,
          available: balance.usdt,
          requested: amount,
        },
        { status: 400 }
      );
    }

    if (balance.trx < 1) {
      return NextResponse.json(
        {
          error: `Insufficient TRX for gas fees. Need at least 1 TRX for transaction`,
          available: balance.trx,
        },
        { status: 400 }
      );
    }

    // Create pending transfer record in database with user deposit deduction
    const transferRecord = await convex.mutation(
      api.externalTransfer.createTransfer,
      {
        adminId: user._id,
        userId: userId as any, // Transfer from this user's deposit
        recipientAddress,
        amount,
        reason: reason || undefined,
      }
    );

    console.log('[API][POST] Transfer record created:', transferRecord);

    // Execute the transfer asynchronously
    executeTransfer(transferRecord, privateKey, recipientAddress, amount);

    return NextResponse.json({
      success: true,
      message: "Transfer initiated",
      transferId: transferRecord,
      status: "pending",
      amount,
      recipient: recipientAddress,
    });
  } catch (error: any) {
    console.error("Transfer error:", error);
    return NextResponse.json(
      { error: error.message || "Transfer failed" },
      { status: 500 }
    );
  }
}

/**
 * GET: List all external transfers (for admins)
 */
export async function GET(req: Request) {
  try {
    console.log('[API][GET] Starting fetch transfers request');
    
    const session = await getServerSession(authOptions);
    console.log('[API][GET] Session:', session?.user?.contact ? '✓ Authenticated' : '✗ Not authenticated');
    
    if (!session?.user?.contact) {
      console.log('[API][GET] Unauthorized - no session');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from Convex
    console.log('[API][GET] Querying user:', session.user.contact);
    const user = await convex.query(api.user.getUserByContact, {
      contact: session.user.contact,
    });
    console.log('[API][GET] User found:', user?._id ? '✓ Yes' : '✗ No');

    if (!user || user.role !== 'admin') {
      console.log('[API][GET] Admin check failed - role:', user?.role);
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get all transfers by this admin
    console.log('[API][GET] Fetching transfers for admin:', user._id);
    const transfers = await convex.query(api.externalTransfer.getTransfersByAdmin, {
      adminId: user._id,
    });
    console.log('[API][GET] Transfers fetched:', transfers?.length || 0);

    return NextResponse.json({
      success: true,
      transfers,
    });
  } catch (error: any) {
    console.error("[API][GET] Error fetching transfers:", {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 300),
    });
    return NextResponse.json(
      { 
        error: error.message || "Failed to fetch transfers",
        details: error.name,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Retry a failed transfer
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.contact) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from Convex
    const user = await convex.query(api.user.getUserByContact, {
      contact: session.user.contact,
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { transferId } = body;

    if (!transferId) {
      return NextResponse.json(
        { error: "Missing transferId" },
        { status: 400 }
      );
    }

    // Get and validate private key
    const privateKey = process.env.TRON_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing hot wallet key' },
        { status: 500 }
      );
    }

    // Validate private key format
    if (!isValidPrivateKey(privateKey)) {
      return NextResponse.json(
        { 
          error: 'Server configuration error: Invalid private key format',
          details: 'Private key must be 64 character hexadecimal string'
        },
        { status: 500 }
      );
    }

    // Retry the transfer
    await convex.mutation(api.externalTransfer.retryFailedTransfer, {
      transferId,
    });

    // Get transfer details to retry
    const transfers = await convex.query(api.externalTransfer.getRecentTransfers);
    const transfer = transfers.find((t: any) => t._id === transferId);

    if (!transfer) {
      return NextResponse.json(
        { error: "Transfer not found" },
        { status: 404 }
      );
    }

    // Execute transfer again asynchronously
    executeTransfer(transferId, privateKey, transfer.recipientAddress, transfer.amount);

    return NextResponse.json({
      success: true,
      message: "Transfer retry initiated",
      transferId,
      status: "pending",
    });
  } catch (error: any) {
    console.error("Retry error:", error);
    return NextResponse.json(
      { error: error.message || "Retry failed" },
      { status: 500 }
    );
  }
}

/**
 * Execute transfer asynchronously and update status
 */
async function executeTransfer(
  transferId: string,
  privateKey: string,
  recipientAddress: string,
  amount: number
) {
  try {
    console.log('[EXECUTE] Starting executeTransfer:', {
      transferId,
      recipientAddress,
      amount,
      amountType: typeof amount,
      isPositive: amount > 0,
    });

    // SAFEGUARD: Ensure amount is always positive
    const positiveAmount = Math.abs(amount);
    if (Math.abs(positiveAmount - amount) > 0.0001) {
      console.error('[EXECUTE] ⚠️ NEGATIVE AMOUNT DETECTED:', {
        original: amount,
        corrected: positiveAmount,
        transferId,
      });
    }

    console.log('[EXECUTE] Verified positive amount:', positiveAmount);

    // Update status to processing
    await convex.mutation(api.externalTransfer.updateTransferStatus, {
      transferId: transferId as any,
      status: 'processing',
    });

    // Execute transfer with POSITIVE amount
    console.log('[EXECUTE] Calling transferUsdt with:', {
      recipient: recipientAddress,
      amount: positiveAmount,
    });

    const result = await transferUsdt(privateKey, recipientAddress, positiveAmount);

    if (result.success) {
      console.log('[EXECUTE] ✅ Transfer successful on blockchain:', result.transactionId);
      
      // Update with completed status
      await convex.mutation(api.externalTransfer.completeTransfer, {
        transferId: transferId as any,
        status: 'completed',
        transactionHash: result.transactionId,
      });

      console.log(`[EXECUTE] ✅ TRANSFER COMPLETE AND VERIFIED: ${transferId}`);
      console.log(`[EXECUTE] Transaction Hash: ${result.transactionId}`);
    } else {
      console.error('[EXECUTE] ❌ Transfer failed on blockchain:', result.error);
      
      // Update with failed status (will refund user)
      await convex.mutation(api.externalTransfer.completeTransfer, {
        transferId: transferId as any,
        status: 'failed',
        errorMessage: result.error || 'Unknown error',
      });

      console.log(`[EXECUTE] Transfer failed: ${transferId} - ${result.error}`);
    }
  } catch (error: any) {
    console.error("[EXECUTE] Error executing transfer:", error);
    try {
      await convex.mutation(api.externalTransfer.completeTransfer, {
        transferId: transferId as any,
        status: 'failed',
        errorMessage: error.message || 'Execution error',
      });
    } catch (updateError) {
      console.error("[EXECUTE] Error updating transfer status:", updateError);
    }
  }
}
