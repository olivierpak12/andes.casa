// convex/deposits.ts

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Save/update a deposit address for a user
 * Updates the depositAddresses object in the user table
 */
export const saveDepositAddress = mutation({
  args: {
    userId: v.id("user"),
    network: v.union(
      v.literal("erc20"),
      v.literal("bep20"),
      v.literal("trc20"),
      v.literal("polygon")
    ),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      throw new Error("User not found");
    }

    // Get existing addresses or create new object
    const currentAddresses = user.depositAddresses || {};

    // Update the specific network address
    const updatedAddresses = {
      ...currentAddresses,
      [args.network]: args.address,
    };

    // Update user document
    await ctx.db.patch(args.userId, {
      depositAddresses: updatedAddresses,
    });

    return args.address;
  },
});

/**
 * Get all deposit addresses for a user
 * Returns addresses from the user.depositAddresses object
 */
export const getUserDepositAddresses = query({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return null;
    }

    return user.depositAddresses || {
      trc20: undefined,
      bep20: undefined,
      erc20: undefined,
      polygon: undefined,
    };
  },
});

/**
 * Record a new deposit transaction
 * Creates a transaction record with type "deposit"
 */
export const recordDeposit = mutation({
  args: {
    userId: v.id("user"),
    network: v.union(
      v.literal("erc20"),
      v.literal("bep20"),
      v.literal("trc20"),
      v.literal("polygon")
    ),
    amount: v.number(),
    walletAddress: v.string(),
    transactionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if transaction with this hash already exists
    if (args.transactionHash) {
      const existing = await ctx.db
        .query("transaction")
        .filter((q) => q.eq(q.field("transactionHash"), args.transactionHash))
        .first();

      if (existing) {
        return existing._id;
      }
    }

    const now = Date.now();

    // Create new deposit transaction
    const transactionId = await ctx.db.insert("transaction", {
      userId: args.userId,
      type: "deposit",
      network: args.network,
      amount: args.amount,
      walletAddress: args.walletAddress,
      transactionHash: args.transactionHash,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return transactionId;
  },
});

/**
 * Update deposit transaction status
 */
export const updateDepositStatus = mutation({
  args: {
    transactionHash: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db
      .query("transaction")
      .filter((q) => q.eq(q.field("transactionHash"), args.transactionHash))
      .first();

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    await ctx.db.patch(transaction._id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    // If completed, credit user balance
    if (args.status === "completed" && transaction.type === "deposit") {
      const user = await ctx.db.get(transaction.userId);
      if (user) {
        const currentBalance = user.balance || 0;
        await ctx.db.patch(transaction.userId, {
          balance: currentBalance + transaction.amount,
        });
      }
    }

    return transaction._id;
  },
});

/**
 * Get user's deposit history
 */
export const getUserDeposits = query({
  args: {
    userId: v.id("user"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    const deposits = await ctx.db
      .query("transaction")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("type"), "deposit"))
      .order("desc")
      .take(limit);

    return deposits;
  },
});

/**
 * Get pending deposits for a user
 */
export const getPendingDeposits = query({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const deposits = await ctx.db
      .query("transaction")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => 
        q.and(
          q.eq(q.field("type"), "deposit"),
          q.eq(q.field("status"), "pending")
        )
      )
      .collect();

    return deposits;
  },
});

/**
 * Get deposit statistics for a user
 */
export const getDepositStats = query({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const allDeposits = await ctx.db
      .query("transaction")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("type"), "deposit"))
      .collect();

    const completed = allDeposits.filter(d => d.status === "completed");
    const pending = allDeposits.filter(d => d.status === "pending");
    const failed = allDeposits.filter(d => d.status === "failed");

    const totalDeposited = completed.reduce((sum, d) => sum + d.amount, 0);

    return {
      totalDeposits: allDeposits.length,
      completedDeposits: completed.length,
      pendingDeposits: pending.length,
      failedDeposits: failed.length,
      totalAmount: totalDeposited,
    };
  },
});

/**
 * Find deposit by wallet address (for webhook processing)
 */
export const getDepositByAddress = query({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    // Find user who owns this deposit address
    const users = await ctx.db.query("user").collect();
    
    for (const user of users) {
      if (user.depositAddresses) {
        const addresses = Object.values(user.depositAddresses);
        if (addresses.includes(args.address)) {
          return {
            userId: user._id,
            userContact: user.contact,
            userEmail: user.email,
          };
        }
      }
    }

    return null;
  },
});

export const getDepositByHash = query({
  args: { txHash: v.string() },
  handler: async (ctx, args) => {
    const deposit = await ctx.db
      .query("transaction")
      .filter((q) => q.eq(q.field("transactionHash"), args.txHash))
      .first();

    return deposit;
  },
});

/**
 * Get all users with deposit addresses (for polling service)
 */
export const getAllUsersWithDepositAddresses = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("user").collect();
    
    // Filter users who have deposit addresses
    return users.filter(user => user.depositAddresses?.trc20);
  },
});

/**
 * Update last deposit check timestamp
 */
export const updateLastDepositCheck = mutation({
  args: {
    userId: v.id("user"),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastDepositCheck: args.timestamp,
    });
    
    return args.timestamp;
  },
});