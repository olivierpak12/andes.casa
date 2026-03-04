#!/usr/bin/env node

/**
 * Direct database patch to reset balance
 * Bypasses updateUserBalance mutation
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error('❌ Missing NEXT_PUBLIC_CONVEX_URL environment variable');
  process.exit(1);
}

const convex = new ConvexHttpClient(convexUrl);

async function directReset() {
  const contact = '+250723636712';
  
  try {
    console.log(`\n🔴 DIRECT DATABASE PATCH`);
    console.log(`User: ${contact}\n`);
    
    const user = await convex.query(api.user.getUserByContact, { contact });
    
    if (!user) {
      console.log(`❌ User not found`);
      process.exit(1);
    }

    console.log(`Current balance: $${(user.depositAmount || 0).toFixed(2)}`);
    console.log(`User ID: ${user._id}\n`);
    
    // Create a custom mutation that patches directly
    // Since we can't use the updateUserBalance (it might have issues),
    // let's try calling it multiple times to ensure it works
    
    console.log(`Resetting balance field by field...\n`);
    
    // First, reset depositAmount to 0
    console.log(`1. Resetting depositAmount...`);
    const reset1 = await convex.mutation(api.user.updateUserBalance, {
      userId: user._id,
      depositAmount: 0,
    });
    console.log(`   Result:`, reset1);
    
    // Then reset earnings to 0
    console.log(`2. Resetting earnings...`);
    const reset2 = await convex.mutation(api.user.updateUserBalance, {
      userId: user._id,
      earnings: 0,
    });
    console.log(`   Result:`, reset2);
    
    // Then reset lockedPrincipal
    console.log(`3. Resetting lockedPrincipal...`);
    const reset3 = await convex.mutation(api.user.updateUserBalance, {
      userId: user._id,
      lockedPrincipal: 0,
    });
    console.log(`   Result:`, reset3);
    
    // Then reset investedCapital
    console.log(`4. Resetting investedCapital...`);
    const reset4 = await convex.mutation(api.user.updateUserBalance, {
      userId: user._id,
      investedCapital: 0,
    });
    console.log(`   Result:`, reset4);
    
    // Wait a moment and verify
    await new Promise(r => setTimeout(r, 1000));
    
    const updated = await convex.query(api.user.getUserByContact, { contact });
    
    console.log(`\n✅ Update attempt complete!\n`);
    console.log(`New depositAmount: $${(updated.depositAmount || 0).toFixed(2)}`);
    console.log(`New earnings: $${(updated.earnings || 0).toFixed(2)}`);
    console.log(`New lockedPrincipal: $${(updated.lockedPrincipal || 0).toFixed(2)}`);
    console.log(`New investedCapital: $${(updated.investedCapital || 0).toFixed(2)}`);
    
    const allZero = (updated.depositAmount || 0) === 0 && 
                   (updated.earnings || 0) === 0 &&
                   (updated.lockedPrincipal || 0) === 0 &&
                   (updated.investedCapital || 0) === 0;
    
    if (allZero) {
      console.log(`\n✅ SUCCESS: All balances reset to $0.00`);
    } else {
      console.log(`\n⚠️  WARNING: Some balances still have values`);
      console.log(`\nThe mutations might not be applying correctly.`);
      console.log(`Check if updateUserBalance mutation is working.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

directReset();
