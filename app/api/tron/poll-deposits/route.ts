// pages/api/tron/poll-deposits.ts
// This endpoint should be called by a cron job every minute to check for new deposits

import type { NextApiRequest, NextApiResponse } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getAccountBalance, getNewTransactions } from "@/lib/tron/utils";
import { MIN_DEPOSIT, REQUIRED_CONFIRMATIONS } from "@/lib/tron/config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Secure this endpoint with a secret key
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("🔄 Starting deposit polling service...");

    // Get all users with TRC20 deposit addresses
    const users = await convex.query(api.user.getAllUsersWithDepositAddresses, {});
    
    console.log(`👥 Found ${users.length} users to check`);

    let totalDepositsFound = 0;
    let totalDepositsProcessed = 0;
    const results = [];

    for (const user of users) {
      const depositAddress = user.depositAddresses?.trc20;
      
      if (!depositAddress) continue;

      try {
        console.log(`\n📍 Checking ${user.contact} - ${depositAddress}`);

        // Get last check timestamp
        const lastCheck = user.lastDepositCheck || 0;
        
        // Get new transactions
        const newTransactions = await getNewTransactions(depositAddress, lastCheck);
        
        if (newTransactions.length === 0) {
          console.log("  ℹ️  No new transactions");
          continue;
        }

        console.log(`  📊 Found ${newTransactions.length} new transactions`);
        totalDepositsFound += newTransactions.length;

        let latestTimestamp = lastCheck;
        
        for (const tx of newTransactions) {
          // Only process incoming transactions
          if (tx.to !== depositAddress) {
            console.log(`  ⏭️  Skipping outgoing tx: ${tx.txHash}`);
            continue;
          }
          
          // Only process confirmed transactions
          if (!tx.confirmed) {
            console.log(`  ⏳ Pending tx: ${tx.txHash}`);
            continue;
          }

          // Check minimum deposit
          const amount = tx.type === 'TRX' ? tx.amount : tx.amount;
          const minDeposit = tx.type === 'TRX' ? MIN_DEPOSIT.TRX : MIN_DEPOSIT.USDT;
          
          if (amount < minDeposit) {
            console.log(`  ⚠️  Amount too small: ${amount} ${tx.type} (min: ${minDeposit})`);
            continue;
          }

          // Check if already processed
          const existing = await convex.query(api.deposit.getDepositByHash, {
            txHash: tx.txHash,
          });

          if (existing) {
            console.log(`  ⏭️  Already processed: ${tx.txHash}`);
            continue;
          }

          // Record deposit
          try {
            const depositId = await convex.mutation(api.deposit.recordDeposit, {
              userId: user._id,
              network: 'trc20',
              amount,
              walletAddress: depositAddress,
              transactionHash: tx.txHash,
            });

            console.log(`  ✅ Recorded: ${amount} ${tx.type} - ${tx.txHash}`);

            // Update to completed and credit balance
            await convex.mutation(api.deposit.updateDepositStatus, {
              transactionHash: tx.txHash,
              status: 'completed',
            });

            console.log(`  💰 Balance credited: ${amount} USDT`);

            totalDepositsProcessed++;

            // Track latest timestamp
            if (tx.timestamp > latestTimestamp) {
              latestTimestamp = tx.timestamp;
            }

            results.push({
              user: user.contact,
              address: depositAddress,
              txHash: tx.txHash,
              amount,
              type: tx.type,
              status: 'processed',
            });

          } catch (error: any) {
            console.error(`  ❌ Error processing deposit:`, error.message);
            results.push({
              user: user.contact,
              address: depositAddress,
              txHash: tx.txHash,
              amount,
              type: tx.type,
              status: 'error',
              error: error.message,
            });
          }
        }

        // Update last check timestamp
        if (latestTimestamp > lastCheck) {
          await convex.mutation(api.user.updateLastDepositCheck, {
            userId: user._id,
            timestamp: latestTimestamp,
          });
          console.log(`  🕒 Updated last check: ${new Date(latestTimestamp).toISOString()}`);
        }

      } catch (error: any) {
        console.error(`❌ Error checking user ${user.contact}:`, error);
        results.push({
          user: user.contact,
          status: 'error',
          error: error.message,
        });
      }
    }

    console.log(`\n✨ Polling complete!`);
    console.log(`   Total deposits found: ${totalDepositsFound}`);
    console.log(`   Total deposits processed: ${totalDepositsProcessed}`);

    return res.status(200).json({
      success: true,
      usersChecked: users.length,
      depositsFound: totalDepositsFound,
      depositsProcessed: totalDepositsProcessed,
      results,
      timestamp: Date.now(),
    });

  } catch (error: any) {
    console.error("❌ Polling service error:", error);
    
    return res.status(500).json({
      success: false,
      error: "Polling service failed",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}