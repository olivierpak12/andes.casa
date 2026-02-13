// pages/api/webhooks/tatum-deposit.ts
// This endpoint receives notifications from Tatum when deposits are detected

import type { NextApiRequest, NextApiResponse } from "next";
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Optional: Verify webhook signature if Tatum provides one
    // const signature = req.headers['x-tatum-signature'];
    // if (!verifySignature(signature, req.body)) {
    //   return res.status(401).json({ error: "Invalid signature" });
    // }

    const payload: TatumWebhookPayload = req.body;

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
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Find the user who owns this deposit address
    const userInfo = await convex.query(api.deposit.getDepositByAddress, {
      address: depositAddress,
    });

    if (!userInfo) {
      console.error("❌ Deposit address not found:", depositAddress);
      return res.status(404).json({ error: "Deposit address not found" });
    }

    const { userId } = userInfo;

    // Determine network from deposit address format or currency
    const network = determineNetwork(depositAddress, currency);

    if (!network) {
      console.error("❌ Could not determine network for address:", depositAddress);
      return res.status(400).json({ error: "Invalid network" });
    }

    // Determine required confirmations based on network
    const confirmationsNeeded = getConfirmationsNeeded(network);
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

    return res.status(200).json({
      success: true,
      txId,
      status,
      confirmations: currentConfirmations,
      confirmationsNeeded,
    });
  } catch (error: any) {
    console.error("❌ Webhook processing error:", error);
    return res.status(500).json({
      error: "Webhook processing failed",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * Determine network from address format or currency
 */
function determineNetwork(
  address: string,
  currency: string
): "erc20" | "bep20" | "trc20" | "polygon" | null {
  // Tron addresses start with 'T'
  if (address.startsWith("T")) {
    return "trc20";
  }

  // Check by currency or other indicators
  if (currency === "TRON" || currency === "TRX") {
    return "trc20";
  }

  if (currency === "BSC" || currency === "BNB") {
    return "bep20";
  }

  if (currency === "MATIC" || currency === "POLYGON") {
    return "polygon";
  }

  if (currency === "ETH" || currency === "ETHEREUM") {
    return "erc20";
  }

  // Default to ERC20 for Ethereum-style addresses
  if (address.startsWith("0x")) {
    // You may need additional logic to distinguish between ERC20, BEP20, and Polygon
    // For now, you could check the address in your database
    return "erc20"; // Default
  }

  return null;
}

/**
 * Get required confirmations for each network
 */
function getConfirmationsNeeded(
  network: "erc20" | "bep20" | "trc20" | "polygon"
): number {
  const confirmationsMap = {
    trc20: 1, // Tron is fast, usually 1 confirmation is enough
    bep20: 15, // BSC requires more for security
    erc20: 12, // Ethereum standard
    polygon: 128, // Polygon requires many confirmations
  };

  return confirmationsMap[network];
}

/**
 * Optional: Verify webhook signature for security
 */
function verifySignature(signature: string | undefined, body: any): boolean {
  // Implement signature verification if Tatum provides it
  // This is a security measure to ensure webhooks are from Tatum
  return true; // Placeholder
}