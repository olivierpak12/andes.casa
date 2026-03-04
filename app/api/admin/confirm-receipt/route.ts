import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ConfirmReceiptRequest {
  userId: string; // User ID who received the USDT
  amount: number;
  transactionHash: string;
}

/**
 * POST: Confirm that a user received external USDT and credit their account
 * Call this after verifying on-chain that USDT arrived at user's address
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

    const body: ConfirmReceiptRequest = await req.json();
    const { userId, amount, transactionHash } = body;

    // Validate inputs
    if (!userId || !amount || !transactionHash) {
      return NextResponse.json(
        { error: "Missing required fields: userId, amount, transactionHash" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Ensure amount is positive (safeguard against negative values)
    const positiveAmount = Math.abs(amount);
    if (positiveAmount !== amount) {
      console.error('[CONFIRM] Amount sign changed from negative to positive:', {
        original: amount,
        corrected: positiveAmount,
      });
    }

    // Record received transfer and credit user balance
    const result = await convex.mutation(api.externalTransfer.recordReceivedTransfer, {
      userId: userId as any, // Convert string ID from request to Convex ID
      amount: positiveAmount, // Always use positive amount for crediting
      transactionHash,
      senderAddress: "hotWallet",
      reason: "External USDT transfer confirmed",
    });

    console.log('[CONFIRM] User received USDT:', {
      userId,
      amount,
      txHash: transactionHash,
      newBalance: result.newBalance,
    });

    return NextResponse.json({
      success: true,
      message: `Credited ${amount} USDT to user account`,
      userId,
      amount,
      newBalance: result.newBalance,
      transactionHash,
      transactionId: result.transactionId,
    });
  } catch (error: any) {
    console.error('[CONFIRM] Error:', error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm receipt" },
      { status: 500 }
    );
  }
}

/**
 * GET: Get receipt confirmation details  
 */
export async function GET(req: Request) {
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

    return NextResponse.json({
      success: true,
      info: {
        description: "Endpoint to confirm users received external USDT transfers",
        method: "POST",
        requiredFields: {
          userId: "ID of user who received USDT",
          amount: "Amount of USDT received (positive number)",
          transactionHash: "TRON transaction hash from blockchain",
        },
        example: {
          userId: "user_12345",
          amount: 10.98,
          transactionHash: "0x...",
        },
      },
    });
  } catch (error: any) {
    console.error('[CONFIRM] Error:', error);
    return NextResponse.json(
      { error: error.message || "Failed to get info" },
      { status: 500 }
    );
  }
}
