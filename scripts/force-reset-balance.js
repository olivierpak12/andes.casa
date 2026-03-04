#!/usr/bin/env node

/**
 * Force reset user balance - PERMANENT DELETE of deposits
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error('❌ Missing NEXT_PUBLIC_CONVEX_URL environment variable');
  process.exit(1);
}

const convex = new ConvexHttpClient(convexUrl);

async function forceReset() {
  const contact = '+250723636712';
  
  try {
    console.log(`\n🔴 FORCE RESET USER BALANCE`);
    console.log(`Contact: ${contact}\n`);
    
    const user = await convex.query(api.user.getUserByContact, { contact });
    
    if (!user) {
      console.log(`❌ User not found`);
      process.exit(1);
    }

    console.log(`Current balance: $${(user.depositAmount || 0).toFixed(2)}`);
    console.log(`\n⚠️  This will DELETE all balance data...\n`);
    
    // Try different approach - set to exact 0
    console.log(`Attempt 1: Setting depositAmount to 0...`);
    await convex.mutation(api.user.updateUserBalance, {
      userId: user._id,
      depositAmount: 0,
    });
    
    console.log(`Attempt 2: Force clear all balance fields...`);
    await convex.mutation(api.user.updateUserBalance, {
      userId: user._id,
      depositAmount: 0,
      earnings: 0,
      lockedPrincipal: 0,
      investedCapital: 0,
    });
    
    // Verify
    const updated = await convex.query(api.user.getUserByContact, { contact });
    
    console.log(`\n✅ Reset complete!`);
    console.log(`New balance: $${(updated.depositAmount || 0).toFixed(2)}`);
    
    if ((updated.depositAmount || 0) === 0) {
      console.log(`\n✅ Successfully reset to $0.00`);
    } else {
      console.log(`\n⚠️  WARNING: Balance is still ${updated.depositAmount}`);
      console.log(`The updateUserBalance function may not be working correctly`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

forceReset();
