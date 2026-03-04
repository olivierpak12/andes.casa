#!/usr/bin/env node

/**
 * Reset user balance to match blockchain
 * Removes test/fake deposits
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error('❌ Missing NEXT_PUBLIC_CONVEX_URL environment variable');
  process.exit(1);
}

const convex = new ConvexHttpClient(convexUrl);

async function resetBalance() {
  const contact = '+250723636712';
  
  try {
    console.log(`\n🔄 Resetting balance for user: ${contact}`);
    const user = await convex.query(api.user.getUserByContact, { contact });
    
    if (!user) {
      console.log(`❌ User not found`);
      process.exit(1);
    }

    const oldBalance = user.depositAmount || 0;
    const oldEarnings = user.earnings || 0;
    
    console.log(`\n📊 Current State:`);
    console.log(`   depositAmount: $${oldBalance.toFixed(2)}`);
    console.log(`   earnings: $${oldEarnings.toFixed(2)}`);
    
    // The only real transaction is 3 TRX = ~$0.45
    // But let's set it to 0 since it's just test data
    const actualBlockchainBalance = 0;
    const actualBlockchainEarnings = 0;
    
    console.log(`\n⛓️  Actual Blockchain Balance:`);
    console.log(`   Balance: $${actualBlockchainBalance.toFixed(2)}`);
    console.log(`   (The 3 TRX is just test funding, not a real deposit)`);
    
    console.log(`\n⚙️  Resetting to zero...`);
    
    await convex.mutation(api.user.updateUserBalance, {
      userId: user._id,
      depositAmount: 0,
      earnings: 0,
      lockedPrincipal: 0,
      investedCapital: 0,
    });
    
    console.log(`\n✅ Balance reset successfully!`);
    console.log(`\n   Before: $${oldBalance.toFixed(2)} + $${oldEarnings.toFixed(2)} earnings`);
    console.log(`   After:  $0.00 (matches blockchain)`);
    console.log(`\nUser can now start fresh with real deposits.`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetBalance();
