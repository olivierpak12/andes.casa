// app/api/webhooks/tatum-deposit/route.ts
// This endpoint receives notifications from Tatum when deposits are detected
// Only Tron network is now supported

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface TatumWebhookPayload {
  subscriptionType: string;
  accountId: string;
  txId: string;
  amount: string;
  currency: string;
  blockNumber?: number;
  from?: string;
  to?: string;
  asset?: string;
  mempool?: boolean;
  confirmations?: number;
}

export async function POST(req: NextRequest) {

  try {
    // Optional: Verify webhook signature if Tatum provides one
    // const signature = req.headers.get('x-tatum-signature');
    // if (!verifySignature(signature, body)) {
    //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    // }

    const payload: TatumWebhookPayload = await req.json();

    console.log("📥 Received Tatum webhook:", {
      txId: payload.txId,
      amount: payload.amount,
      currency: payload.currency,
      to: payload.to,
      confirmations: payload.confirmations,
    });

    // Extract deposit information
    const {
      txId,
      amount,
      currency,
      to: depositAddress,
      confirmations = 0,
      mempool = false,
    } = payload;

    // Validate required fields
    if (!txId || !amount || !depositAddress) {
      console.error("❌ Missing required webhook fields");
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Only process Tron deposits now
    if (currency !== "TRON" && currency !== "TRX" && currency !== "USDT_TRON") {
      console.warn(`⏭️  Skipping non-Tron deposit: ${currency}`);
      return NextResponse.json(
        { message: "Only Tron deposits are supported", currency },
        { status: 202 }
      );
    }

    // Find the user who owns this deposit address
    const userInfo = await convex.query(api.deposit.getDepositByAddress, {
      address: depositAddress,
    });

    if (!userInfo) {
      console.error("❌ Deposit address not found:", depositAddress);
      return NextResponse.json({ error: "Deposit address not found" }, { status: 404 });
    }

    const { userId } = userInfo;
    const network = "trc20";
    const confirmationsNeeded = 1; // Tron only
    const currentConfirmations = mempool ? 0 : confirmations;

    console.log(`📊 Confirmations: ${currentConfirmations}/${confirmationsNeeded}`);

    // Record or update the deposit
    const transactionId = await convex.mutation(api.deposit.recordDeposit, {
      userId,
      network,
      amount: parseFloat(amount),
      walletAddress: depositAddress,
      transactionHash: txId,
    });

    console.log("✅ Deposit recorded:", transactionId);

    // Update status based on confirmations
    let status: "pending" | "completed" | "failed" = "pending";
    
    if (currentConfirmations >= confirmationsNeeded) {
      status = "completed";
      console.log("✨ Deposit confirmed and completed!");
    }

    await convex.mutation(api.deposit.updateDepositStatus, {
      transactionHash: txId,
      status,
    });

    // Send notification to user (optional)
    if (status === "completed") {
      // TODO: Send email/SMS notification
      // await sendDepositNotification(userId, amount, currency);
      console.log(`📧 Should send notification to user ${userId}`);
    }

    return NextResponse.json({
      success: true,
      txId,
      status,
      confirmations: currentConfirmations,
      confirmationsNeeded,
    });
  } catch (error: any) {
    console.error("❌ Webhook processing error:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    webhook: "tatum-deposit",
    supported_networks: ["trc20"],
  });
}