import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Simple custom hash function matching convex/user.ts
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex string
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// Minimum amounts per network
const MIN_WITHDRAWAL: Record<string, number> = {
  trc20: 100,
  bep20: 2,
  erc20: 20,
  polygon: 2,
};

const MIN_DEPOSIT: Record<string, number> = {
  trc20: 50,
  bep20: 2,
  erc20: 20,
  polygon: 2,
};

export const createDeposit = mutation({
  args: {
    userId: v.id("user"),
    amount: v.number(),
    network: v.union(
      v.literal("trc20"),
      v.literal("bep20"),
      v.literal("erc20"),
      v.literal("polygon")
    ),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate minimum amount
    const minAmount = MIN_DEPOSIT[args.network];
    if (args.amount < minAmount) {
      throw new ConvexError(
        `Minimum deposit for ${args.network.toUpperCase()} is ${minAmount} USDT`
      );
    }

    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Create transaction record
    const transactionId = await ctx.db.insert("transaction", {
      userId: args.userId,
      type: "deposit",
      amount: args.amount,
      network: args.network,
      walletAddress: args.walletAddress,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return transactionId;
  },
});

export const createWithdrawal = mutation({
  args: {
    userId: v.id("user"),
    amount: v.number(),
    network: v.union(
      v.literal("trc20"),
      v.literal("bep20"),
      v.literal("erc20"),
      v.literal("polygon")
    ),
    transactionPassword: v.string(),
    walletAddress: v.optional(v.string()),  // Optional - funds go to platform hot wallet
  },
  handler: async (ctx, args) => {
    // Validate minimum amount
    const minAmount = MIN_WITHDRAWAL[args.network];
    if (args.amount < minAmount) {
      throw new ConvexError(
        `Minimum withdrawal for ${args.network.toUpperCase()} is ${minAmount} USDT`
      );
    }

    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Verify transaction password using simple hash
      const storedHash = user.transactionPassword || "";
      const hashedInput = simpleHash(args.transactionPassword);
      const isMatch = hashedInput === storedHash;
      if (!isMatch) {
        throw new ConvexError("Invalid transaction password");
    }

    // Check withdrawable amount: only earnings are withdrawable (deposits are not)
    const userEarnings = user.earnings || 0;
    if (userEarnings < args.amount) {
      throw new ConvexError(
        `Insufficient withdrawable earnings. Available to withdraw: ${userEarnings} USDT`
      );
    }

    // Create withdrawal transaction WITHOUT deducting balance yet
    // Balance will only be deducted when withdrawal completes successfully
    // Note: All funds are transferred to platform hot wallet
    const transactionId = await ctx.db.insert("transaction", {
      userId: args.userId,
      type: "withdrawal",
      amount: args.amount,
      network: args.network,
      walletAddress: args.walletAddress || "hot-wallet",  // Placeholder - actual transfer to platform hot wallet
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return transactionId;
  },
});

export const getTransactionHistory = query({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transaction")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return transactions;
  },
});

export const getAllTransactions = query({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db
      .query("transaction")
      .order("desc")
      .collect();

    return transactions;
  },
});

export const getTransactionById = query({
  args: {
    transactionId: v.id("transaction"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.transactionId);
  },
});

export const updateTransactionStatus = mutation({
  args: {
    transactionId: v.id("transaction"),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    transactionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) {
      throw new ConvexError("Transaction not found");
    }

    // If withdrawal is completed, deduct from user balance
    if (
      args.status === "completed" &&
      transaction.type === "withdrawal" &&
      transaction.status === "pending"
    ) {
      const user = await ctx.db.get(transaction.userId);
      if (user) {
        const userEarnings = user.earnings || 0;
        await ctx.db.patch(transaction.userId, {
          earnings: Math.max(0, userEarnings - transaction.amount),
        });
      }
    }

    // If withdrawal was failed, no balance change needed (balance was never deducted)
    // Just mark transaction as failed

    // If deposit is completed, add to balance
    if (
      args.status === "completed" &&
      transaction.type === "deposit" &&
      transaction.status === "pending"
    ) {
      const user = await ctx.db.get(transaction.userId);
      if (user) {
        const userDeposit = user.depositAmount || 0;
        await ctx.db.patch(transaction.userId, {
          depositAmount: userDeposit + transaction.amount,
        });
      }
    }

    await ctx.db.patch(args.transactionId, {
      status: args.status,
      transactionHash: args.transactionHash,
      updatedAt: Date.now(),
    });
  },
});
