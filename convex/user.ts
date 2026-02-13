import { hash } from "bcryptjs";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import type { generateUserAddresses } from "./userNode";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query
} from "./_generated/server";



export const getUserByContact = query({
  args: {
    contact: v.string(),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query("user")
      .withIndex("by_contact", (q) => q.eq("contact", args.contact))
      .first();

    return client;
  },
});


export const createUser = internalMutation({
  args: {
    countryCode: v.string(),
    password: v.optional(v.string()),
    transactionPassword: v.optional(v.string()),
    invitationCode: v.optional(v.string()),
    contact: v.optional(v.string()),
    telegram: v.optional(v.string()),
    position: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("admin"),
        v.literal("client"),
      ),
    ),
    
  },
  handler: async (ctx, args) => {
    const newUser = await ctx.db.insert("user", {
      countryCode: args.countryCode,
      password: args.password,
      transactionPassword: args.transactionPassword,
      invitationCode: args.invitationCode,
      contact: args.contact,
      telegram: args.telegram,
      position: args.position,
      role: args.role,
    });
    if (!newUser)
      throw new ConvexError("something went wrong in creating user!");
    // After creating user, generate a unique invitation code and create invite record
    const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
    let code = generateCode();
    let tries = 0;
    while (tries < 5) {
      const existing = await ctx.db
        .query("invite")
        .withIndex("by_code", (q: any) => q.eq("code", code))
        .first();
      if (!existing) break;
      code = generateCode();
      tries++;
    }

    try {
      // expiry in seconds provided by user request: 2896064 (seconds)
      const EXPIRY_SECONDS = 2896064;
      const expiresAt = Date.now() + EXPIRY_SECONDS * 1000;

      await ctx.db.insert("invite", {
        code,
        issuer: newUser,
        maxUses: 5,
        uses: 0,
        createdAt: Date.now(),
        expiresAt,
      });

      // patch user with invitation code and expiry so it's available on profile
      await ctx.db.patch(newUser, { invitationCode: code, invitationExpiry: expiresAt });
    } catch (e) {
      // ignore invite creation failures
    }

    return newUser;
  },
});

export const getUser = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const User = await ctx.db
      .query("user")
      .withIndex("by_contact", (q) => q.eq("contact", args.email))
      .collect();

    if (!User) {
      throw new ConvexError("something went wrong in getting user!");
    }
    return User[0];
  },
});

export const getUserContact = internalQuery({
  args: {
    contact: v.string(),
  },
  handler: async (ctx, args) => {
    const User = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("contact"), args.contact))
      .first();

    if (!User) {
      return null;
    }
    return User;
  },
});

export const getUserById = query({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const User = await ctx.db.get(args.userId);

    if (!User) {
      throw new ConvexError("something went wrong in creating user!");
    }
    return User;
  },
});

export const getAllUsers = query({
  handler: async (ctx) => {
    const User = await ctx.db.query("user").order("desc").collect();

    if (!User) {
      throw new ConvexError("something went wrong in creating user!");
    }
    return User;
  },
});
export const registerUser = action({
  args: {
    countryCode: v.string(),
    password: v.string(),
    confirmPassword: v.string(),
    transactionPassword: v.string(),
    invitationCode: v.optional(v.string()),
    telegram: v.string(),
    contact: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate passwords match
    if (args.password !== args.confirmPassword) {
      return { success: false, error: "Passwords do not match" };
    }

    const existingUser = await ctx.runQuery(internal.user.getUserContact, {
      contact: args.contact,
    });
    if (existingUser) {
      return { success: false, error: "User already exists" };
    }

    // If an invitation code was provided, validate it by attempting to claim it
    if (args.invitationCode) {
      const claimResult: any = await ctx.runMutation(internal.invite.claimInvite, {
        code: args.invitationCode,
      });
      if (!claimResult || !claimResult.success) {
        return { success: false, error: claimResult?.error || 'Invalid invitation code' };
      }
    }

    
    // Hash both passwords
    const hashPass = await hash(args.password, 12);
    const hashTransactionPass = await hash(args.transactionPassword, 12);

    const newUser = await ctx.runMutation(internal.user.createUser, {
      countryCode: args.countryCode,
      password: hashPass,
      transactionPassword: hashTransactionPass,
      invitationCode: args.invitationCode,
      telegram: args.telegram,
      role: "client", // Default role
      contact: args.contact,
    });
    if (!newUser) {
      throw new Error("Failed to create user");
    }
    // If this registration used an invitation code, try to associate the new user
    // with the inviter (referredBy) so they appear in the inviter's team.
    if (args.invitationCode) {
      try {
        const invite = await ctx.runQuery(internal.invite.getInviteByCode, { code: args.invitationCode });
        if (invite && invite.issuer) {
          await ctx.runMutation(internal.user.setReferredBy, {
            userId: newUser,
            referrerId: invite.issuer,
          });
        }
      } catch (e) {
        // ignore failures to avoid blocking registration
      }
    }
    
    // Assign deposit addresses to the new user
    try {
      await ctx.runAction((internal as any).userNode.generateUserAddresses, {
        userId: newUser.toString(),
      });
    } catch (e) {
      console.error("Failed to assign addresses:", e);
      // Don't fail registration if address assignment fails
    }
    
    // console.log("User created successfully");
    return { success: true, error: null };
  },
});



export const deleteUserInDb = mutation({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      throw new ConvexError("User not found!");
    }

    await ctx.db.delete(args.userId);
    return { success: true };
  },
});

// Internal mutation to set referredBy
export const setReferredBy = internalMutation({
  args: {
    userId: v.id("user"),
    referrerId: v.id("user"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { referredBy: args.referrerId });
    return true;
  },
});

// Internal mutation to save a single address
export const saveSingleAddress = internalMutation({
  args: {
    userId: v.id("user"),
    network: v.string(),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      throw new ConvexError("User not found!");
    }

    const addresses = user.depositAddresses || {};
    const updatedAddresses = {
      ...addresses,
      [args.network]: args.address,
    };

    await ctx.db.patch(args.userId, {
      depositAddresses: updatedAddresses,
    });

    return args.address;
  },
});

// Internal mutation to save all addresses
export const saveAllAddresses = internalMutation({
  args: {
    userId: v.id("user"),
    addresses: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      throw new ConvexError("User not found!");
    }

    await ctx.db.patch(args.userId, {
      depositAddresses: args.addresses,
    });

    return args.addresses;
  },
});




export const getOrAssignUserAddress = action({
  args: {
    userId: v.id("user"),
    network: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate new address via action
    const allAddresses = await ctx.runAction((internal as any).userNode.generateUserAddresses, {
      userId: args.userId,
    });
    const newAddress = allAddresses[args.network];
    
    // Store it in database
    await ctx.runMutation(internal.user.saveSingleAddress, {
      userId: args.userId,
      network: args.network,
      address: newAddress,
    });

    return newAddress;
  },
}) as any;

export const getUserAddresses = query({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      throw new ConvexError("User not found!");
    }

    return user.depositAddresses || {};
  },
});

export const assignAllUserAddresses = action({
  args: {
    userId: v.id("user"),
  },
  handler: async (ctx, args) => {
    // Generate all addresses via action
    const addresses = await ctx.runAction((internal as any).userNode.generateUserAddresses, {
      userId: args.userId,
    });

    // Save all addresses
    await ctx.runMutation(internal.user.saveAllAddresses, {
      userId: args.userId,
      addresses,
    });

    return addresses;
  },
}) as any;

export const updateLastDepositCheck = mutation({
  args: {
    userId: v.id("user"),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      throw new Error("User not found");
    }

    // Update the user's lastDepositCheck field
    await ctx.db.patch(args.userId, {
      lastDepositCheck: args.timestamp,
    });

    console.log(`✅ Updated lastDepositCheck for user ${args.userId}: ${new Date(args.timestamp).toISOString()}`);
    
    return {
      userId: args.userId,
      timestamp: args.timestamp,
      updatedAt: Date.now(),
    };
  },
});

/**
 * Get all users with deposit addresses (needed for polling service)
 */
export const getAllUsersWithDepositAddresses = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("user").collect();
    
    // Filter users who have at least one deposit address
    const usersWithAddresses = users.filter(user => {
      const addresses = user.depositAddresses;
      return addresses && (
        addresses.trc20 || 
        addresses.bep20 || 
        addresses.erc20 || 
        addresses.polygon
      );
    });
    
    console.log(`📊 Found ${usersWithAddresses.length} users with deposit addresses`);
    
    return usersWithAddresses;
  },
});

/**
 * Get user's last deposit check timestamp
 */
export const getLastDepositCheck = query({
  args: { userId: v.id("user") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      return null;
    }
    
    return {
      userId: args.userId,
      lastDepositCheck: user.lastDepositCheck || 0,
      lastCheckDate: user.lastDepositCheck 
        ? new Date(user.lastDepositCheck).toISOString() 
        : null,
    };
  },
});
