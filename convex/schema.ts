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
    balance: v.optional(v.number()),
    role: v.optional(
      v.union(
        v.literal("admin"),
        v.literal("client"),
      ),
    ),
    resetToken: v.optional(v.string()),
    resetTokenExpiry: v.optional(v.number()),
    depositAddresses: v.optional(v.object({
      trc20: v.optional(v.string()),
      bep20: v.optional(v.string()),
      erc20: v.optional(v.string()),
      polygon: v.optional(v.string()),
    })),
    lastDepositCheck: v.optional(v.number()),
    invitationExpiry: v.optional(v.number()),
    referredBy: v.optional(v.id("user")),
    
  }).index("by_contact", ["contact"]).index("by_email", ["email"]),

  // 💳 Transactions (Deposits & Withdrawals)
  transaction: defineTable({
    userId: v.id("user"),
    type: v.union(v.literal("deposit"), v.literal("withdrawal")),
    amount: v.number(),
    network: v.union(
      v.literal("polygon"),
      v.literal("erc20"),
      v.literal("trc20"),
      v.literal("bep20")
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
  }).index("by_userId", ["userId"]).index("by_type", ["type"]),

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

  // ⚙️ Settings (single document for platform settings)
  settings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.optional(v.number()),
  }).index("by_key", ["key"]),
});
