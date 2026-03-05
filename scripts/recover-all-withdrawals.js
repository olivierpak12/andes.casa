#!/usr/bin/env node
// Bulk recovery script for all stuck withdrawals
// Finds all "completed" withdrawals and checks if they're valid on-chain
// Usage: node scripts/recover-all-withdrawals.js

async function recoverAll() {
  const url = 'http://localhost:3000/api/admin/recover-all';
  
  console.log('🔄 Scanning for all stuck withdrawals...\n');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoRecover: true }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`❌ Scan failed (${response.status}):`, result.error || result.message);
      process.exit(1);
    }

    if (result.recovered.length === 0) {
      console.log('✅ No stuck withdrawals found!');
      return;
    }

    console.log(`✅ Found and recovered ${result.recovered.length} stuck withdrawal(s):\n`);
    result.recovered.forEach((tx, i) => {
      console.log(`${i + 1}. Amount: ${tx.amount} USDT | User: ${tx.userId} | TxHash: ${tx.transactionHash.substring(0, 16)}...`);
    });

    console.log(`\n💰 Total refunded: ${result.totalRefunded} USDT`);
    console.log(`✅ All funds restored to user accounts!`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

recoverAll();
