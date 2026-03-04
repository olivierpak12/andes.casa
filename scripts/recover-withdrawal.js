#!/usr/bin/env node
// Recovery script for stuck withdrawals
// Usage: node scripts/recover-withdrawal.js --txHash <txhash>

const txHash = process.argv[2] || process.argv.find((arg, i, arr) => arr[i-1] === '--txHash');

if (!txHash || txHash.startsWith('--')) {
  console.error('Usage: node scripts/recover-withdrawal.js 6e66eec449a935d49e6177324cee40ed834c4edd5e5579ad20157a112526a224');
  console.error('   or: node scripts/recover-withdrawal.js --txHash <txhash>');
  process.exit(1);
}

async function recover() {
  const url = 'http://localhost:3000/api/admin/recover-withdrawal';
  
  console.log(`🔄 Recovering withdrawal with txHash: ${txHash.substring(0, 16)}...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionHash: txHash,
        reason: 'Invalid blockchain txhash - local recovery script'
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`❌ Recovery failed (${response.status}):`, result.error || result.message);
      console.error('Full response:', JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('✅ Recovery successful!');
    console.log(`   Amount refunded: ${result.transaction?.amount || '?'} USDT`);
    console.log(`   New user balance: ${result.userNewBalance || '?'} USDT`);
    console.log(`\nFull response:`);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

recover();
