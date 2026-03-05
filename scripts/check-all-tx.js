#!/usr/bin/env node

import axios from 'axios';

const address = 'THtp4Ydz3BGVWXZWHopLJ6RcQyDkeezoyu';

console.log(`\n🔍 Checking all transactions for: ${address}\n`);

try {
  const response = await axios.get(`https://nile.trongrid.io/v1/accounts/${address}/transactions`, {
    params: { limit: 20 },
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' }
  });
  
  const txs = response.data.data || [];
  
  console.log(`Found ${txs.length} transactions:\n`);
  
  let incomingTRX = 0;
  let outgoingTRX = 0;
  
  txs.forEach((tx, i) => {
    const contract = tx.raw_data.contract[0];
    
    if (contract.type === 'TransferContract') {
      const value = contract.parameter.value;
      const from = value.owner_address;
      const to = value.to_address;
      const amount = value.amount / 1e6;
      
      // Check if incoming or outgoing
      if (to === '4156ec31744535e7b0c74ad0345e0a0aff26206a32') {
        console.log(`[${i}] 📥 INCOMING: ${amount.toFixed(6)} TRX`);
        incomingTRX += amount;
      } else if (from === '4156ec31744535e7b0c74ad0345e0a0aff26206a32') {
        console.log(`[${i}] 📤 OUTGOING: ${amount.toFixed(6)} TRX`);
        outgoingTRX += amount;
      }
      
      console.log(`    Time: ${new Date(tx.raw_data.timestamp).toISOString()}`);
      console.log(`    Status: ${tx.ret?.[0]?.contractRet}`);
      console.log('');
    }
  });
  
  console.log('═'.repeat(50));
  console.log(`\n💰 Summary:`);
  console.log(`   Incoming: ${incomingTRX.toFixed(6)} TRX`);
  console.log(`   Outgoing: ${outgoingTRX.toFixed(6)} TRX`);
  console.log(`   Net: ${(incomingTRX - outgoingTRX).toFixed(6)} TRX`);
  
  if (outgoingTRX > 0) {
    console.log(`\n⚠️  The 2 TRX that arrived was SPENT/TRANSFERRED OUT`);
  } else {
    console.log(`\n⚠️  The 2 TRX transaction is still pending confirmation`);
  }
  
} catch (error) {
  console.error('Error:', error.message);
}
