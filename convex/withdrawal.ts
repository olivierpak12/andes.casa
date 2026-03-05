import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Request a withdrawal
 * Creates a pending transaction and checks balance ONLY
 * Does NOT deduct balance - deduction happens on completion
 */
export const requestWithdrawal = mutation({
  args: {
    userId: v.id("user"),
    amount: v.number(),
    address: v.string(),
    network: v.union(
      v.literal("trc20"),
      v.literal("bep20"),
      v.literal("erc20"),
      v.literal("polygon")
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      throw new Error("User not found");
    }

    // Check withdrawable amount: only earnings are withdrawable (deposits are not)
    const userEarnings = user.earnings || 0;
    if (userEarnings < args.amount) {
      throw new Error(`Insufficient withdrawable earnings. Available: ${userEarnings} USDT, Requested: ${args.amount} USDT`);
    }

    // Create pending withdrawal transaction WITHOUT deducting balance yet
    // Balance will be deducted only when withdrawal completes successfully
    const transactionId = await ctx.db.insert("transaction", {
      userId: args.userId,
      type: "withdrawal",
      amount: args.amount,
      network: args.network,
      status: "pending",
      walletAddress: args.address,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return transactionId;
  },
});

/**
 * Complete a withdrawal (update status)
 * Deducts balance on success, refunds on failure
 */
export const completeWithdrawal = mutation({
  args: {
    transactionId: v.id("transaction"),
    status: v.union(
      v.literal("completed"),
      v.literal("failed")
    ),
    transactionHash: v.optional(v.string()), // For completed withdrawals
    error: v.optional(v.string()), // For failed withdrawals
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId);

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.type !== "withdrawal") {
      throw new Error("Not a withdrawal transaction");
    }

    if (transaction.status !== "pending") {
      throw new Error("Transaction is already processed");
    }

    const user = await ctx.db.get(transaction.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Handle successful withdrawal
    if (args.status === "completed") {
      const userEarnings = user.earnings || 0;
      // Deduct the withdrawal amount from earnings only
      await ctx.db.patch(transaction.userId, {
        earnings: Math.max(0, userEarnings - transaction.amount),
      });
    }
    // If failed, refund the user (no refund needed since we didn't deduct)
    // Just mark as failed and user balance remains unchanged

    await ctx.db.patch(args.transactionId, {
      status: args.status,
      transactionHash: args.transactionHash,
      updatedAt: Date.now(),
    });

    return args.status;
  },
});

/**
 * Get user's withdrawal history
 */
export const getUserWithdrawals = query({
  args: {
    userId: v.id("user"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    const withdrawals = await ctx.db
      .query("transaction")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("type"), "withdrawal"))
      .order("desc")
      .take(limit);

    return withdrawals;
  },
});
