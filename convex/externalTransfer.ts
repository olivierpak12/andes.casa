import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a new external transfer record AND deduct from user's deposit
 */
export const createTransfer = mutation({
  args: {
    adminId: v.id("user"),
    userId: v.id("user"), // User whose deposit is being transferred
    recipientAddress: v.string(),
    amount: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log('[CREATE_TRANSFER] Starting with args:', {
      amount: args.amount,
      recipient: args.recipientAddress,
      userId: args.userId,
    });

    // SAFEGUARD: Validate amount is positive
    if (args.amount <= 0) {
      console.error('[CREATE_TRANSFER] ❌ ZERO OR NEGATIVE AMOUNT:', args.amount);
      throw new Error(`Invalid amount: ${args.amount}. Amount must be positive.`);
    }

    // Ensure amount is always positive (safeguard against any negative values)
    const amount = Math.abs(args.amount);
    if (Math.abs(amount - args.amount) > 0.0001) {
      console.error('[CREATE_TRANSFER] ⚠️ NEGATIVE AMOUNT DETECTED AND CORRECTED:', {
        original: args.amount,
        corrected: amount,
      });
    }

    // Get user and check deposit balance
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const userDeposit = user.depositAmount || 0;
    console.log('[CREATE_TRANSFER] User deposit balance:', userDeposit);

    if (userDeposit < amount) {
      throw new Error(`Insufficient deposit balance. Available: ${userDeposit}, Requested: ${amount}`);
    }

    // Deduct from user's deposit
    const newDeposit = Math.max(0, userDeposit - amount);
    const transferredOut = (user.transferredOut || 0) + amount;

    await ctx.db.patch(args.userId, {
      depositAmount: newDeposit,
      transferredOut: transferredOut,
    });

    console.log('[CREATE_TRANSFER] ✓ User deposit deducted:', {
      userId: args.userId,
      before: userDeposit,
      after: newDeposit,
      transferred: amount,
    });

    // Create a withdrawal transaction record for the user
    await ctx.db.insert("transaction", {
      userId: args.userId,
      type: "withdrawal",
      amount: amount,
      network: "trc20",
      status: "pending",
      walletAddress: args.recipientAddress,
      transactionHash: `external-transfer-${Date.now()}`, // Temporary ID
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log('[CREATE_TRANSFER] ✓ Withdrawal transaction recorded for user');

    console.log('[CREATE_TRANSFER] ✓ Inserting transfer with positive amount:', amount);

    const transferId = await ctx.db.insert("externalTransfer", {
      adminId: args.adminId,
      userId: args.userId, // Track which user's deposit this is from
      recipientAddress: args.recipientAddress,
      amount: amount,
      network: "trc20",
      status: "pending",
      reason: args.reason,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log('[CREATE_TRANSFER] ✓ Transfer created:', { transferId, amount, userId: args.userId });

    return transferId;
  },
});

/**
 * Update transfer status
 */
export const updateTransferStatus = mutation({
  args: {
    transferId: v.id("externalTransfer"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    
    if (!transfer) {
      throw new Error("Transfer not found");
    }

    await ctx.db.patch(args.transferId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.transferId;
  },
});

/**
 * Complete transfer with transaction hash or error
 * User deposit was already deducted during createTransfer
 */
export const completeTransfer = mutation({
  args: {
    transferId: v.id("externalTransfer"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    transactionHash: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    
    if (!transfer) {
      throw new Error("Transfer not found");
    }

    // If transfer failed, refund the amount back to user's deposit
    if (args.status === "failed" && transfer.userId) {
      const user = await ctx.db.get(transfer.userId);
      if (user) {
        const currentDeposit = user.depositAmount || 0;
        const refundedDeposit = currentDeposit + transfer.amount;
        const transferredOut = (user.transferredOut || 0) - transfer.amount;

        await ctx.db.patch(transfer.userId, {
          depositAmount: refundedDeposit,
          transferredOut: transferredOut,
        });

        // Create refund transaction record
        await ctx.db.insert("transaction", {
          userId: transfer.userId,
          type: "deposit",
          amount: transfer.amount,
          network: "trc20",
          status: "completed",
          walletAddress: "refund",
          transactionHash: `refund-${args.transferId}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        console.log('[COMPLETE_TRANSFER] Refunded user due to failed transfer:', {
          userId: transfer.userId,
          amount: transfer.amount,
        });
      }
    }

    await ctx.db.patch(args.transferId, {
      status: args.status,
      transactionHash: args.transactionHash,
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return args.transferId;
  },
});

/**
 * Get all transfers by admin
 */
export const getTransfersByAdmin = query({
  args: {
    adminId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const transfers = await ctx.db
      .query("externalTransfer")
      .withIndex("by_adminId", (q) => q.eq("adminId", args.adminId))
      .order("desc")
      .collect();

    return transfers;
  },
});

/**
 * Get recent transfers (all admins)
 */
export const getRecentTransfers = query({
  handler: async (ctx) => {
    const transfers = await ctx.db
      .query("externalTransfer")
      .order("desc")
      .take(50);

    return transfers;
  },
});

/**
 * Get transfers by status
 */
export const getTransfersByStatus = query({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const transfers = await ctx.db
      .query("externalTransfer")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .collect();

    return transfers;
  },
});

/**
 * Retry a failed transfer
 * Resets status to pending and clears error details
 */
export const retryFailedTransfer = mutation({
  args: {
    transferId: v.id("externalTransfer"),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    
    if (!transfer) {
      throw new Error("Transfer not found");
    }

    if (transfer.status !== "failed") {
      throw new Error("Only failed transfers can be retried");
    }

    // Reset transfer to pending status
    await ctx.db.patch(args.transferId, {
      status: "pending",
      transactionHash: undefined,
      errorMessage: undefined,
      completedAt: undefined,
      updatedAt: Date.now(),
    });

    return args.transferId;
  },
});

/**
 * Record external USDT received at user address and credit their balance
 * Called when external transfer completes and USDT arrives at user's address
 */
export const recordReceivedTransfer = mutation({
  args: {
    userId: v.id("user"),
    amount: v.number(),
    transactionHash: v.optional(v.string()),
    senderAddress: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      throw new Error("User not found");
    }

    // Validate amount is positive
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    // Ensure amount is positive (safeguard against negative values)
    const amount = Math.abs(args.amount);
    if (amount !== args.amount) {
      console.error('[RECEIVED] Negative amount detected and converted to positive:', {
        original: args.amount,
        corrected: amount,
      });
    }

    // Create deposit transaction record (POSITIVE amount for received funds)
    const transactionId = await ctx.db.insert("transaction", {
      userId: args.userId,
      type: "deposit",
      amount: amount, // ALWAYS positive
      network: "trc20",
      status: "completed",
      walletAddress: user.contact, // User's identifier
      transactionHash: args.transactionHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Credit user's deposited principal (depositAmount)
    const currentDeposit = user.depositAmount || 0;
    const newDeposit = currentDeposit + amount;

    await ctx.db.patch(args.userId, {
      depositAmount: newDeposit,
    });

    console.log('[RECEIVED] Credited user depositAmount:', {
      userId: args.userId,
      amount: amount,
      previousDeposit: currentDeposit,
      newDeposit: newDeposit,
      txHash: args.transactionHash,
    });

    return {
      transactionId,
      newDeposit,
    };
  },
});
