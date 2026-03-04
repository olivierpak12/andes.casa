#!/usr/bin/env node

/**
 * Debug Script: Compare System Records vs Blockchain
 * Shows what deposits the system thinks it has vs what's actually on chain
 */

import axios from 'axios';

const contact = '+250723636712';
const NILE_API = 'https://nile.trongrid.io';

async function getUserFromDB() {
  try {
    console.log(`\n🔍 Looking up user in system: ${contact}`);
    
    // This would need the actual backend endpoint
    // For now, we'll just explain what needs to happen
    console.log(`\n⚠️  Need to check database for:`);
    console.log(`   - User contact: ${contact}`);
    console.log(`   - depositAddresses.trc20: ?`);
    console.log(`   - depositAmount: ?`);
    console.log(`   - transactions (type=deposit): ?`);
    
    return null;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

async function getBlockchainBalance(address) {
  try {
    console.log(`\n💾 Checking blockchain for address: ${address}`);
    
    const response = await axios.get(`${NILE_API}/v1/accounts/${address}/transactions`, {
      params: {
        only_confirmed: true,
        limit: 50,
      },
      headers: {
        'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || ''
      }
    });

    const transactions = response.data.data || [];
    
    // Calculate balance from transactions
    let totalTrx = 0;
    
    transactions.forEach((tx) => {
      if (tx.raw_data.contract[0].type === 'TransferContract') {
        const value = tx.raw_data.contract[0].parameter.value;
        const toAddress = value.to_address;
        const amount = value.amount / 1e6;
        
        // Only count if receiving (this is simplified)
        totalTrx += amount;
      }
    });
    
    console.log(`   ✅ Found ${transactions.length} confirmed transactions`);
    console.log(`   💰 Total TRX received: ${totalTrx.toFixed(6)}`);
    console.log(`   💵 Estimated USDT value: $${(totalTrx * 0.15).toFixed(2)}`);
    
    return totalTrx;
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return 0;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('System Balance vs Blockchain Balance');
  console.log('='.repeat(60));

  // System side
  await getUserFromDB();
  
  // Blockchain side
  const address = 'TAuMs3Hq6mFTmvTJQb7i3KHP79Kyw4wouE'; // We know this from before
  const blockchainBalance = await getBlockchainBalance(address);

  console.log('\n' + '='.repeat(60));
  console.log('⚠️  COMPARISON');
  console.log('='.repeat(60));
  console.log(`System shows: $210.84 USDT`);
  console.log(`Blockchain has: $${(blockchainBalance * 0.15).toFixed(2)} USDT`);
  console.log(`Discrepancy: $${(210.84 - (blockchainBalance * 0.15)).toFixed(2)}`);
  
  console.log('\n🔴 ISSUE DETECTED:');
  console.log('═════════════════════════════════════════════════════════════');
  console.log('1. System shows $210.84 balance');
  console.log('2. Blockchain shows 0 balance');
  console.log('3. LIKELY CAUSES:');
  console.log('   a) Deposits were credited WITHOUT actually receiving them');
  console.log('   b) Money sent to different address by mistake');
  console.log('   c) Manual balance credits for testing without blockchain tx');
  console.log('');
  console.log('ACTION REQUIRED:');
  console.log('   ✓ Check database for user account');
  console.log('   ✓ Review transaction records (type=deposit)');
  console.log('   ✓ Check hot wallet balance and recent transfers');
  console.log('   ✓ Find where the $210.84 came from (if it exists)');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
