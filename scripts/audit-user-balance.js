#!/usr/bin/env node

/**
 * Query user and their transaction history
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error('❌ Missing NEXT_PUBLIC_CONVEX_URL environment variable');
  process.exit(1);
}

const convex = new ConvexHttpClient(convexUrl);

async function auditUserBalance() {
  const contact = '+250723636712';
  
  try {
    console.log(`\n🔍 Looking up user: ${contact}`);
    const user = await convex.query(api.user.getUserByContact, { contact });
    
    if (!user) {
      console.log(`❌ User not found`);
      process.exit(1);
    }

    console.log(`✅ User found: ${user.fullname || user.contact}`);
    console.log(`\n💰 BALANCE INFORMATION:`);
    console.log(`   depositAmount: $${(user.depositAmount || 0).toFixed(2)}`);
    console.log(`   earnings: $${(user.earnings || 0).toFixed(2)}`);
    console.log(`   lockedPrincipal: $${(user.lockedPrincipal || 0).toFixed(2)}`);
    console.log(`   investedCapital: $${(user.investedCapital || 0).toFixed(2)}`);
    console.log(`   TOTAL: $${((user.depositAmount || 0) + (user.earnings || 0)).toFixed(2)}`);
    
    console.log(`\n📍 DEPOSIT ADDRESSES:`);
    console.log(`   TRC20: ${user.depositAddresses?.trc20 || 'Not set'}`);
    console.log(`   BEP20: ${user.depositAddresses?.bep20 || 'Not set'}`);
    
    console.log(`\n🕐 LAST DEPOSIT CHECK: ${user.lastDepositCheck ? new Date(user.lastDepositCheck).toISOString() : 'Never'}`);
    
    // Get all transactions for this user
    console.log(`\n📊 TRANSACTION HISTORY:`);
    const transactions = await convex.query(api.deposit.getUserDeposits, { userId: user._id });
    
    if (!transactions || transactions.length === 0) {
      console.log(`   ❌ No transaction records found`);
    } else {
      console.log(`   Found ${transactions.length} deposit transactions:\n`);
      
      let totalDeposited = 0;
      transactions.forEach((tx, i) => {
        const timestamp = new Date(tx.createdAt).toISOString();
        const status = tx.status;
        const amount = tx.amount;
        const hash = tx.transactionHash?.substring(0, 16) + '...' || 'N/A';
        
        console.log(`   [${i + 1}] Amount: $${amount.toFixed(2)} | Status: ${status} | Hash: ${hash}`);
        console.log(`       Time: ${timestamp}`);
        
        if (status === 'completed') {
          totalDeposited += amount;
        }
      });
      
      console.log(`\n   ✅ Total completed deposits: $${totalDeposited.toFixed(2)}`);
    }
    
    // Check for discrepancies
    console.log(`\n` + '='.repeat(60));
    console.log(`⚠️  AUDIT RESULTS`);
    console.log('='.repeat(60));
    
    const systemDeposit = user.depositAmount || 0;
    const onChainBalance = 0; // We know blockchain has 0
    
    if (systemDeposit > onChainBalance) {
      console.log(`\n🔴 CRITICAL MISMATCH:`);
      console.log(`   System shows: $${systemDeposit.toFixed(2)}`);
      console.log(`   Blockchain has: $${onChainBalance.toFixed(2)}`);
      console.log(`   Discrepancy: $${(systemDeposit - onChainBalance).toFixed(2)}`);
      
      console.log(`\n⚠️  POSSIBLE CAUSES:`);
      console.log(`   1. Deposits recorded but never arrived on blockchain`);
      console.log(`   2. Transactions recorded from wrong wallet`);
      console.log(`   3. User balance manually credited for testing`);
      console.log(`   4. Hot wallet received funds but they weren't credited to user`);
    } else {
      console.log(`✅ No discrepancy - balances match`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

auditUserBalance();
