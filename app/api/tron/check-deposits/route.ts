// pages/api/tron/check-deposits.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getAccountBalance, getNewTransactions } from "@/lib/tron/utils";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🔐 Checking authentication...");
    
    // Verify authentication
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.contact) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get user from Convex
    const user = await convex.query(api.user.getUserByContact, {
      contact: session.user.contact,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's TRC20 deposit address
    const depositAddress = user.depositAddresses?.trc20;
    
    if (!depositAddress) {
      return res.status(404).json({ 
        error: "No deposit address found",
        message: "Please generate a deposit address first"
      });
    }

    console.log("📍 Checking deposits for address:", depositAddress);

    // Get current balance
    const balance = await getAccountBalance(depositAddress);
    
    console.log("💰 Balance:", balance);

    // Get last check timestamp from database
    // This prevents processing the same transactions multiple times
    const lastCheck = user.lastDepositCheck || 0;
    
    // Get new transactions since last check
    const newTransactions = await getNewTransactions(depositAddress, lastCheck);
    
    console.log(`📊 Found ${newTransactions.length} new transactions`);

    // Process new deposits
    const deposits = [];
    
    for (const tx of newTransactions) {
      // Only process incoming transactions
      if (tx.to !== depositAddress) continue;
      
      // Only process confirmed transactions
      if (!tx.confirmed) continue;
      
      // Record deposit in database
      try {
        const depositId = await convex.mutation(api.deposit.recordDeposit, {
          userId: user._id,
          network: 'trc20',
          amount: tx.type === 'TRX' ? tx.amount : tx.amount,
          walletAddress: depositAddress,
          transactionHash: tx.txHash,
        });
        
        deposits.push({
          id: depositId,
          txHash: tx.txHash,
          amount: tx.amount,
          type: tx.type,
          timestamp: tx.timestamp,
        });
        
        console.log(`✅ Recorded deposit: ${tx.amount} ${tx.type}`);
      } catch (error) {
        console.error("Error recording deposit:", error);
      }
    }

    // Update last check timestamp
    if (newTransactions.length > 0) {
      const latestTimestamp = Math.max(...newTransactions.map(tx => tx.timestamp));
      
      // TODO: Add this mutation to update last check time
      // await convex.mutation(api.user.updateLastDepositCheck, {
      //   userId: user._id,
      //   timestamp: latestTimestamp,
      // });
    }

    return res.status(200).json({
      address: depositAddress,
      balance,
      newDeposits: deposits,
      totalNewDeposits: deposits.length,
    });

  } catch (error: any) {
    console.error("❌ Error checking deposits:", error);
    
    return res.status(500).json({
      error: "Failed to check deposits",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}