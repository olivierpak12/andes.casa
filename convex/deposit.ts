// convex/deposit.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ─── Address Management ───────────────────────────────────────────────────────

/**
 * Save a deposit address AND its private key for a user.
 * The private key is stored server-side only — never returned to the client.
 */
export const setDepositAddress = mutation({
  args: {
    userId:     v.id("user"),
    network:    v.union(v.literal("trc20"), v.literal("bep20"), v.literal("erc20"), v.literal("polygon")),
    address:    v.string(),
    privateKey: v.string(), // stored securely, never exposed via queries
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const updatedAddresses = {
      ...(user.depositAddresses || {}),
      [args.network]: args.address,
    };

    const updatedKeys = {
      ...(user.depositPrivateKeys || {}),
      [args.network]: args.privateKey,
    };

    await ctx.db.patch(args.userId, {
      depositAddresses:    updatedAddresses,
      depositPrivateKeys:  updatedKeys,
    });

    console.log(`[CONVEX] Deposit address set for user ${args.userId} — network: ${args.network}, address: ${args.address}`);
    return args.address;
  },
});

/**
 * Legacy: save address only (no private key). Kept for compatibility.
 */
export const saveDepositAddress = mutation({
  args: {
    userId:  v.id("user"),
    network: v.union(v.literal("trc20"), v.literal("bep20"), v.literal("erc20"), v.literal("polygon")),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const updatedAddresses = {
      ...(user.depositAddresses || {}),
      [args.network]: args.address,
    };

    await ctx.db.patch(args.userId, { depositAddresses: updatedAddresses });
    return args.address;
  },
});

/**
 * Get deposit addresses for a user (public fields only — NO private keys).
 */
export const getUserDepositAddresses = query({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return user.depositAddresses || {};
  },
});

/**
 * Internal: get the private key for a user's deposit address.
 * Only call this from server-side mutations/actions — never return to client.
 */
export const getDepositPrivateKey = query({
  args: {
    userId:  v.id("user"),
    network: v.union(v.literal("trc20"), v.literal("bep20"), v.literal("erc20"), v.literal("polygon")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return user.depositPrivateKeys?.[args.network] ?? null;
  },
});

// ─── Deposit Recording ────────────────────────────────────────────────────────

/**
 * Record a new deposit transaction (idempotent by txHash).
 */
export const recordDeposit = mutation({
  args: {
    userId:          v.id("user"),
    network:         v.union(v.literal("trc20"), v.literal("bep20"), v.literal("erc20"), v.literal("polygon")),
    amount:          v.number(),
    walletAddress:   v.string(),
    transactionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Idempotency — skip if already recorded
    if (args.transactionHash) {
      const existing = await ctx.db
        .query("transaction")
        .withIndex("by_transactionHash", (q) => q.eq("transactionHash", args.transactionHash!))
        .unique();

      if (existing) {
        console.log(`[CONVEX] Deposit already recorded: ${args.transactionHash}`);
        return existing._id;
      }
    }

    const now = Date.now();
    const transactionId = await ctx.db.insert("transaction", {
      userId:          args.userId,
      type:            "deposit",
      network:         args.network,
      amount:          args.amount,
      walletAddress:   args.walletAddress,
      transactionHash: args.transactionHash,
      status:          "pending",
      createdAt:       now,
      updatedAt:       now,
    });

    console.log(`[CONVEX] Deposit recorded — $${args.amount} | hash: ${args.transactionHash} | id: ${transactionId}`);
    return transactionId;
  },
});

/**
 * Update deposit status. Credits user balance when transitioning to "completed".
 */
export const updateDepositStatus = mutation({
  args: {
    transactionHash: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db
      .query("transaction")
      .withIndex("by_transactionHash", (q) => q.eq("transactionHash", args.transactionHash))
      .unique();

    if (!transaction) {
      throw new Error(`Transaction not found: ${args.transactionHash}`);
    }

    // No-op guard — avoid double-credit
    if (transaction.status === args.status) {
      console.log(`[CONVEX] Status already ${args.status} for ${args.transactionHash} — no-op`);
      return transaction._id;
    }

    // Credit user when completing a deposit
    if (args.status === "completed" && transaction.status !== "completed" && transaction.type === "deposit") {
      const user = await ctx.db.get(transaction.userId);
      if (!user) throw new Error(`User not found for tx: ${args.transactionHash}`);

      await ctx.db.patch(transaction.userId, {
        depositAmount:   (user.depositAmount  ?? 0) + transaction.amount,
        lockedPrincipal: (user.lockedPrincipal ?? 0) + transaction.amount,
        lastDepositCheck: Date.now(),
      });

      console.log(`[CONVEX] Credited $${transaction.amount} to user ${transaction.userId}`);

      // Referral commissions (18% / 3% / 2% across 3 levels)
      try {
        const RATES = [0.18, 0.03, 0.02];
        let ancestorId: Id<"user"> | undefined = user.referredBy;
        for (let level = 0; level < RATES.length && ancestorId; level++) {
          const referrer = await ctx.db.get(ancestorId);
          if (!referrer) break;
          const commission = transaction.amount * RATES[level];
          if (commission > 0) {
            await ctx.db.patch(ancestorId, { earnings: (referrer.earnings ?? 0) + commission });
            console.log(`[CONVEX] Referral L${level + 1}: $${commission.toFixed(4)} → ${ancestorId}`);
            ancestorId = referrer.referredBy;
          } else {
            break;
          }
        }
      } catch (e) {
        console.error("[CONVEX] Referral commission error:", e);
      }
    }

    await ctx.db.patch(transaction._id, { status: args.status, updatedAt: Date.now() });
    console.log(`[CONVEX] Tx ${args.transactionHash} status → ${args.status}`);
    return transaction._id;
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getUserDeposits = query({
  args: { userId: v.id("user"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("transaction")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("type"), "deposit"))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const getPendingDeposits = query({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("transaction")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(q.eq(q.field("type"), "deposit"), q.eq(q.field("status"), "pending"))
      )
      .collect();
  },
});

export const getDepositStats = query({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("transaction")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("type"), "deposit"))
      .collect();

    const completed = all.filter((d) => d.status === "completed");
    const pending   = all.filter((d) => d.status === "pending");
    const failed    = all.filter((d) => d.status === "failed");

    return {
      totalDeposits:     all.length,
      completedDeposits: completed.length,
      pendingDeposits:   pending.length,
      failedDeposits:    failed.length,
      totalAmount:       completed.reduce((s, d) => s + d.amount, 0),
    };
  },
});

export const getDepositByHash = query({
  args: { txHash: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("transaction")
      .filter((q) => q.eq(q.field("transactionHash"), args.txHash))
      .first() ?? null;
  },
});

export const getDepositByTransactionHash = query({
  args: { txHash: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("transaction")
      .withIndex("by_transactionHash", (q) => q.eq("transactionHash", args.txHash))
      .unique() ?? null;
  },
});

/**
 * Find which user owns a given deposit address.
 */
export const getDepositByAddress = query({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("user").collect();
    for (const user of users) {
      if (!user.depositAddresses) continue;
      if (Object.values(user.depositAddresses).includes(args.address)) {
        return { userId: user._id, userContact: user.contact, userEmail: user.email };
      }
    }
    return null;
  },
});

export const getAllUsersWithDepositAddresses = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("user").collect();
    return users.filter((u) => u.depositAddresses?.trc20);
  },
});

export const updateLastDepositCheck = mutation({
  args: { userId: v.id("user"), timestamp: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { lastDepositCheck: args.timestamp });
    return args.timestamp;
  },
});