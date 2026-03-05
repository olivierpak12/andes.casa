import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api";

/**
 * Simple custom hash function for Convex (synchronous, no setTimeout)
 * Not for production - use bcryptjs on client side for registration
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

/**
 * Generate a unique invitation code
 */
function generateInvitationCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Get user by contact (phone number)
 */
export const getUserByContact = query({
  args: { contact: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("contact"), args.contact))
      .first();

    return users || null;
  },
});

/**
 * Get user by ID
 */
export const getUserById = query({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user || null;
  },
});

/**
 * Get all users with deposit addresses
 */
export const getAllUsersWithDepositAddresses = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("user").collect();
    return users.filter((u) => u.depositAddresses && Object.keys(u.depositAddresses).length > 0);
  },
});

/**
 * Get all users (for internal lookups)
 */
export const getAllUsersWithAllData = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("user").collect();
    return users;
  },
});

/**
 * Get all users
 */
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("user").collect();
    return users;
  },
});

/**
 * Update last deposit check timestamp for a user
 */
export const updateLastDepositCheck = mutation({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    await ctx.db.patch(args.userId, {
      lastDepositCheck: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update user's balance (earnings)
 */
export const updateUserBalance = mutation({
  args: {
    userId: v.id("user"),
    earnings: v.optional(v.number()),
    depositAmount: v.optional(v.number()),
    investedCapital: v.optional(v.number()),
    lockedPrincipal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const updateData: any = {};
    
    if (args.earnings !== undefined) {
      updateData.earnings = args.earnings;
    }
    if (args.depositAmount !== undefined) {
      updateData.depositAmount = args.depositAmount;
    }
    if (args.investedCapital !== undefined) {
      updateData.investedCapital = args.investedCapital;
    }
    if (args.lockedPrincipal !== undefined) {
      updateData.lockedPrincipal = args.lockedPrincipal;
    }

    await ctx.db.patch(args.userId, updateData);

    return { success: true };
  },
});

/**
 * Register a new user with password hashing
 */
export const registerUser = mutation({
  args: {
    contact: v.string(),
    email: v.optional(v.string()),
    password: v.string(),
    confirmPassword: v.string(),
    transactionPassword: v.string(),
    countryCode: v.string(),
    invitationCode: v.optional(v.string()),
    telegram: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // Validate passwords match
      if (args.password !== args.confirmPassword) {
        return {
          success: false,
          error: "Passwords do not match",
        };
      }

      // Hash passwords using simple custom hash to avoid setTimeout issues in Convex
      const hashedPassword = simpleHash(args.password);
      const hashedTxPassword = simpleHash(args.transactionPassword);

      // Generate invitation code for this user
      const userInvitationCode = generateInvitationCode();

      // Create the user directly
      const userId = await ctx.db.insert("user", {
        contact: args.contact,
        email: args.email,
        password: hashedPassword,
        transactionPassword: hashedTxPassword,
        countryCode: args.countryCode,
        invitationCode: userInvitationCode,
        telegram: args.telegram,
        referredBy: undefined, // TODO: Implement referral lookup if needed
        depositAmount: 0,
        earnings: 0,
        investedCapital: 0,
        lockedPrincipal: 0,
        role: "client",
      } as any);

      return {
        success: true,
        userId: userId,
        invitationCode: userInvitationCode,
      };
    } catch (error: any) {
      console.error("Registration error:", error);
      return {
        success: false,
        error: error?.message || "Registration failed",
      };
    }
  },
});

/**
 * Verify user password
 */
export const verifyPassword = query({
  args: {
    userId: v.id("user"),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.password) {
      return false;
    }

    // Compare password using simple hash
    const hashedInput = simpleHash(args.password);
    return hashedInput === user.password;
  },
});

/**
 * Verify transaction password
 */
export const verifyTransactionPassword = query({
  args: {
    userId: v.id("user"),
    transactionPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.transactionPassword) {
      return false;
    }

    // Compare password using simple hash
    const hashedInput = simpleHash(args.transactionPassword);
    return hashedInput === user.transactionPassword;
  },
});

/**
 * Generate a secure reset token
 */
function generateResetToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token + '-' + Date.now().toString(36);
}

/**
 * Request password reset - generates reset token for user
 */
export const requestPasswordResetAction = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    try {
      // Find user by email
      const user = await ctx.db
        .query("user")
        .filter((q) => q.eq(q.field("email"), args.email))
        .first();

      if (!user) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Generate reset token (expires in 1 hour)
      const resetToken = generateResetToken();
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

      // Update user with reset token
      await ctx.db.patch(user._id, {
        resetToken: resetToken,
        resetTokenExpiry: resetTokenExpiry,
      });

      return {
        success: true,
        resetToken,
      };
    } catch (error: any) {
      console.error("Password reset request error:", error);
      return {
        success: false,
        error: error?.message || "Failed to request password reset",
      };
    }
  },
});

/**
 * Internal mutation to update reset token
 * @internal
 */
export const _updateResetToken = mutation({
  args: {
    userId: v.id("user"),
    resetToken: v.string(),
    resetTokenExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      resetToken: args.resetToken,
      resetTokenExpiry: args.resetTokenExpiry,
    });
    return { success: true };
  },
});

/**
 * Request transaction password reset - generates reset token for user
 */
export const requestTransactionPasswordResetAction = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    try {
      // Find user by email
      const user = await ctx.db
        .query("user")
        .filter((q) => q.eq(q.field("email"), args.email))
        .first();

      if (!user) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Generate reset token (expires in 1 hour)
      const resetToken = generateResetToken();
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

      // Update user with reset token
      await ctx.db.patch(user._id, {
        resetToken: resetToken,
        resetTokenExpiry: resetTokenExpiry,
      });

      return {
        success: true,
        resetToken,
      };
    } catch (error: any) {
      console.error("Transaction password reset request error:", error);
      return {
        success: false,
        error: error?.message || "Failed to request transaction password reset",
      };
    }
  },
});

/**
 * Internal mutation to perform password reset
 * @internal
 */
export const _performPasswordReset = mutation({
  args: {
    email: v.string(),
    resetToken: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Find user by email
      const user = await ctx.db
        .query("user")
        .filter((q: any) => q.eq(q.field("email"), args.email))
        .first();

      if (!user) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Check if reset token matches
      if (user.resetToken !== args.resetToken) {
        return {
          success: false,
          error: "Invalid reset token",
        };
      }

      // Check if token has expired (1 hour = 3600000 ms)
      const tokenExpiry = user.resetTokenExpiry || 0;
      if (Date.now() > tokenExpiry) {
        return {
          success: false,
          error: "Reset token has expired. Please request a new password reset.",
        };
      }

      // Hash the new password using simple hash
      const hashedPassword = simpleHash(args.newPassword);

      // Update user with new password and clear reset token
      await ctx.db.patch(user._id, {
        password: hashedPassword,
        resetToken: undefined,
        resetTokenExpiry: undefined,
      });

      return {
        success: true,
        message: "Password reset successfully",
      };
    } catch (error: any) {
      console.error("Password reset error:", error);
      return {
        success: false,
        error: error?.message || "Failed to reset password",
      };
    }
  },
});

/**
 * Reset user password using reset token
 */
export const resetPassword = action({
  args: {
    email: v.string(),
    resetToken: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      // Call the internal mutation to perform password reset
      const result: any = await ctx.runMutation(api.user._performPasswordReset, {
        email: args.email,
        resetToken: args.resetToken,
        newPassword: args.newPassword,
      });

      return result;
    } catch (error: any) {
      console.error("Password reset action error:", error);
      return {
        success: false,
        error: error?.message || "Failed to reset password",
      };
    }
  },
});

/**
 * Internal mutation to perform transaction password reset
 * @internal
 */
export const _performTransactionPasswordReset = mutation({
  args: {
    email: v.string(),
    resetToken: v.string(),
    newTransactionPassword: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Find user by email
      const user = await ctx.db
        .query("user")
        .filter((q: any) => q.eq(q.field("email"), args.email))
        .first();

      if (!user) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Check if reset token matches
      if (user.resetToken !== args.resetToken) {
        return {
          success: false,
          error: "Invalid reset token",
        };
      }

      // Check if token has expired (1 hour = 3600000 ms)
      const tokenExpiry = user.resetTokenExpiry || 0;
      if (Date.now() > tokenExpiry) {
        return {
          success: false,
          error: "Reset token has expired. Please request a new password reset.",
        };
      }

      // Hash the new transaction password using simple hash
      const hashedTransactionPassword = simpleHash(args.newTransactionPassword);

      // Update user with new transaction password, clear reset token, and set 24hr lock
      await ctx.db.patch(user._id, {
        transactionPassword: hashedTransactionPassword,
        transactionPasswordChangedAt: Date.now(), // Set 24hr withdrawal lock
        resetToken: undefined,
        resetTokenExpiry: undefined,
      });

      return {
        success: true,
        message: "Transaction password reset successfully",
      };
    } catch (error: any) {
      console.error("Transaction password reset error:", error);
      return {
        success: false,
        error: error?.message || "Failed to reset transaction password",
      };
    }
  },
});

/**
 * Reset transaction password using reset token
 */
export const resetTransactionPassword = action({
  args: {
    email: v.string(),
    resetToken: v.string(),
    newTransactionPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      // Call the internal mutation to perform transaction password reset
      const result: any = await ctx.runMutation(api.user._performTransactionPasswordReset, {
        email: args.email,
        resetToken: args.resetToken,
        newTransactionPassword: args.newTransactionPassword,
      });

      return result;
    } catch (error: any) {
      console.error("Transaction password reset action error:", error);
      return {
        success: false,
        error: error?.message || "Failed to reset transaction password",
      };
    }
  },
});

/**
 * Internal mutation to update forgotten timestamp
 * @internal
 */
export const _updateForgottenTimestamp = mutation({
  args: {
    userId: v.id("user"),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      passwordForgottenAt: args.timestamp,
    });
    return { success: true };
  },
});

/**
 * Mark transaction password as forgotten (enables 24hr bypass)
 */
export const markPasswordForgotten = mutation({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Set the forgotten timestamp to now
      await ctx.db.patch(args.userId, {
        passwordForgottenAt: Date.now(),
      });

      return {
        success: true,
        message: "Password marked as forgotten. You can withdraw after 24 hours without entering a password.",
      };
    } catch (error: any) {
      console.error("Mark password forgotten error:", error);
      return {
        success: false,
        error: error?.message || "Failed to mark password as forgotten",
      };
    }
  },
});

/**
 * Check if user can bypass password verification (24 hours since forgotten)
 */
export const canBypassPasswordVerification = query({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        return false;
      }

      const forgottenAt = user.passwordForgottenAt;
      if (!forgottenAt) {
        return false;
      }

      // Check if 24 hours (86400000 ms) have passed
      const now = Date.now();
      const timePassed = now - forgottenAt;
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 86400000 ms

      return timePassed >= TWENTY_FOUR_HOURS;
    } catch (error) {
      console.error("Check bypass verification error:", error);
      return false;
    }
  },
});

/**
 * Get time remaining until password bypass is available (in milliseconds)
 */
export const getPasswordBypassTimeRemaining = query({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        return null;
      }

      const forgottenAt = user.passwordForgottenAt;
      if (!forgottenAt) {
        return null;
      }

      const now = Date.now();
      const timePassed = now - forgottenAt;
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const remaining = Math.max(0, TWENTY_FOUR_HOURS - timePassed);

      return remaining;
    } catch (error) {
      console.error("Get bypass time remaining error:", error);
      return null;
    }
  },
});
/**
 * Check if user's transaction password is locked (within 24 hours of change)
 */
export const isTransactionPasswordLocked = query({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        return false;
      }

      const passwordChangedAt = user.transactionPasswordChangedAt;
      if (!passwordChangedAt) {
        return false; // Password never changed, not locked
      }

      const now = Date.now();
      const timePassed = now - passwordChangedAt;
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

      // Password is locked if less than 24 hours have passed
      return timePassed < TWENTY_FOUR_HOURS;
    } catch (error) {
      console.error("Check password lock error:", error);
      return false;
    }
  },
});

/**
 * Get time remaining until transaction password lock expires (in milliseconds)
 */
export const getTransactionPasswordLockTimeRemaining = query({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        return null;
      }

      const passwordChangedAt = user.transactionPasswordChangedAt;
      if (!passwordChangedAt) {
        return null; // Password never changed
      }

      const now = Date.now();
      const timePassed = now - passwordChangedAt;
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const remaining = Math.max(0, TWENTY_FOUR_HOURS - timePassed);

      return remaining > 0 ? remaining : null; // null if lock is expired
    } catch (error) {
      console.error("Get password lock time remaining error:", error);
      return null;
    }
  },
});

/**
 * Deduct from user deposit due to admin external transfer
 * Proportionally reduces depositAmount and tracks transferred amount separately
 * User will see: (depositAmount + transferredOut) = original balance
 */
export const deductUserDepositForTransfer = mutation({
  args: {
    userId: v.id("user"),
    deductionAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const currentDeposit = user.depositAmount || 0;
    const currentTransferred = user.transferredOut || 0;
    
    // Deduct from deposit
    const newDeposit = Math.max(0, currentDeposit - args.deductionAmount);
    const actualDeduction = currentDeposit - newDeposit;
    
    // Track the transfer
    const newTransferred = currentTransferred + actualDeduction;

    await ctx.db.patch(args.userId, {
      depositAmount: newDeposit,
      transferredOut: newTransferred,
    });

    console.log(`[CONVEX] User ${args.userId} transfer: Deposit $${currentDeposit} → $${newDeposit}, Transferred +$${actualDeduction}`);

    return {
      userId: args.userId,
      depositBefore: currentDeposit,
      depositAfter: newDeposit,
      transferredAfter: newTransferred,
      userSeesBalance: newDeposit + newTransferred, // What user sees (unchanged)
    };
  },
});