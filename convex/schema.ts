import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({

  // 👤 Users
  user: defineTable({
    countryCode: v.string(),
    password: v.optional(v.string()),
    transactionPassword: v.optional(v.string()),
    invitationCode: v.optional(v.string()),
    contact: v.optional(v.string()),
    email: v.optional(v.string()),
    fullname: v.optional(v.string()),
    telegram: v.optional(v.string()),
    position: v.optional(v.string()),
    depositAmount: v.optional(v.number()),
    earnings: v.optional(v.number()),
    investedCapital: v.optional(v.number()),
    role: v.optional(v.union(v.literal("admin"), v.literal("client"))),
    resetToken: v.optional(v.string()),
    resetTokenExpiry: v.optional(v.number()),
    // Deposit addresses (public, shown to user)
    depositAddresses: v.optional(v.object({
      trc20:    v.optional(v.string()),
      bep20:    v.optional(v.string()),
      erc20:    v.optional(v.string()),
      polygon:  v.optional(v.string()),
    })),
    // ✅ NEW: Private keys for per-user deposit addresses (never expose to client)
    depositPrivateKeys: v.optional(v.object({
      trc20:    v.optional(v.string()),
      bep20:    v.optional(v.string()),
      erc20:    v.optional(v.string()),
      polygon:  v.optional(v.string()),
    })),
    lastDepositCheck: v.optional(v.number()),
    invitationExpiry: v.optional(v.number()),
    referredBy: v.optional(v.id("user")),
    lockedPrincipal: v.optional(v.number()),
    passwordForgottenAt: v.optional(v.number()),
    transactionPasswordChangedAt: v.optional(v.number()),
    transferredOut: v.optional(v.number()),
  })
    .index("by_contact", ["contact"])
    .index("by_email", ["email"]),

  // 💳 Transactions
  transaction: defineTable({
    userId: v.id("user"),
    type: v.union(v.literal("deposit"), v.literal("withdrawal")),
    amount: v.number(),
    network: v.union(
      v.literal("trc20"),
      v.literal("bep20"),
      v.literal("erc20"),
      v.literal("polygon")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    walletAddress: v.optional(v.string()),
    transactionHash: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_type", ["type"])
    .index("by_transactionHash", ["transactionHash"]),

  // 🔑 Invitation codes
  invite: defineTable({
    code: v.string(),
    issuer: v.optional(v.id("user")),
    maxUses: v.optional(v.number()),
    uses: v.optional(v.number()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    meta: v.optional(v.any()),
  }).index("by_code", ["code"]),

  // ⚙️ Settings
  settings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.optional(v.number()),
  }).index("by_key", ["key"]),

  // 📋 Tasks
  task: defineTable({
    userId: v.id("user"),
    grade: v.string(),
    startedAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("expired"),
      v.literal("closed")
    ),
    durationHours: v.number(),
    earningsAwarded: v.optional(v.number()),
    rewardedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_expiresAt", ["expiresAt"]),

  // 🔄 External Transfers
  externalTransfer: defineTable({
    adminId: v.id("user"),
    userId: v.optional(v.id("user")),
    recipientAddress: v.string(),
    amount: v.number(),
    network: v.union(
      v.literal("trc20"),
      v.literal("bep20"),
      v.literal("erc20"),
      v.literal("polygon")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    transactionHash: v.optional(v.string()),
    reason: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_adminId", ["adminId"])
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),
});