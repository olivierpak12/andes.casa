#!/usr/bin/env node

import axios from 'axios';

const address = 'THtp4Ydz3BGVWXZWHopLJ6RcQyDkeezoyu';

console.log(`\n🔍 Checking balance for: ${address}\n`);

try {
  // Get account info
  const response = await axios.get(`https://nile.trongrid.io/v1/accounts/${address}`, {
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' }
  });
  
  const account = response.data;
  
  console.log(`📊 Account Status:`);
  console.log(`   Balance: ${(account.balance || 0) / 1e6} TRX`);
  console.log(`   Account type: ${account.type || 'Unknown'}`);
  console.log(`   Created: ${account.create_time ? new Date(account.create_time).toISOString() : 'Never activated'}`);
  
  if (!account.balance || account.balance === 0) {
    console.log(`\n⚠️  ADDRESS IS INACTIVATED OR EMPTY`);
    console.log(`\nPossible reasons:`);
    console.log(`  1. The 2 TRX was received but then spent/transferred`);
    console.log(`  2. The transaction is pending and not yet confirmed`);
    console.log(`  3. The address was created but never received funds`);
  } else {
    console.log(`\n✅ Address has balance: ${(account.balance / 1e6).toFixed(6)} TRX`);
  }
  
} catch (error) {
  console.error('Error:', error.message);
}
