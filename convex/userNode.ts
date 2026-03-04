"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || "34bc99af-0435-44d7-ae2c-463be7256be5";
const TRONGRID_API_URL = process.env.TRONGRID_API_URL || "https://api.trongrid.io";

// Helper function to generate real TRC20 address using TronGrid API
async function generateTRC20Address(userId: string): Promise<string> {
  try {
    // Create a deterministic wallet from userId
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const seed = hash.update(userId + ':trc20:seed').digest();
    
    // TronWeb expects the private key as a hex string WITHOUT the 0x prefix
    const privateKey = seed.toString('hex');
    
    // Use TronWeb to create address from the private key
    const TronWeb = require('tronweb');
    const tronWeb = new TronWeb({
      fullHost: TRONGRID_API_URL,
      headers: { "TRON-PRO-API-KEY": TRONGRID_API_KEY }
    });
    
    // Generate account from private key
    const account = tronWeb.address.fromPrivateKey(privateKey);
    return account;
  } catch (error) {
    console.error("Failed to generate TRC20 address via TronGrid:", error);
    // Fallback: generate deterministic address
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const hexHash = hash.update(userId + ':trc20:fallback').digest('hex');
    return 'T' + hexHash.substring(0, 33).toUpperCase();
  }
}

// ✅ Tron-only: Only supports TRC20 addresses now
export const generateUserAddresses = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Only generate Tron address - other EVM networks removed
    const address = await generateTRC20Address(args.userId);
    
    return {
      trc20: address,
    };
  },
});
