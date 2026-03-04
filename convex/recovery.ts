import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Recover a stuck withdrawal by txHash
 * Finds the transaction and marks it as failed to trigger refund
 */
export const recoverWithdrawalByHash = mutation({
  args: {
    transactionHash: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find transaction by hash
    const transactions = await ctx.db
      .query("transaction")
      .filter((q) => q.eq(q.field("transactionHash"), args.transactionHash))
      .collect();

    if (transactions.length === 0) {
      throw new Error(`Transaction not found with hash: ${args.transactionHash}`);
    }

    const tx = transactions[0];

    if (tx.type !== "withdrawal") {
      throw new Error("Only withdrawals can be recovered");
    }

    if (tx.status === "failed") {
      return { message: "Already refunded", transaction: tx };
    }

    // Get the user
    const user = await ctx.db.get(tx.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Mark as failed (triggers refund in completeWithdrawal)
    await ctx.db.patch(tx._id, {
      status: "failed",
      updatedAt: Date.now(),
    });

    // Refund the amount to earnings (withdrawals take from earnings)
    const currentEarnings = user.earnings || 0;
    await ctx.db.patch(tx.userId, {
      earnings: currentEarnings + tx.amount,
    });

    return {
      success: true,
      message: `Refunded ${tx.amount} USDT`,
      transaction: { id: tx._id, amount: tx.amount, status: "failed" },
      userNewBalance: ((user.depositAmount || 0) + (user.earnings || 0)) + tx.amount,
    };
  },
});
