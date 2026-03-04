#!/usr/bin/env node

import axios from 'axios';

const address = process.argv[2] || 'THtp4Ydz3BGVWXZWHopLJ6RcQyDkeezoyu';

const data = await axios.get(`https://nile.trongrid.io/v1/accounts/${address}/transactions`, {
  params: { only_confirmed: true, limit: 5 },
  headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' }
});

const txs = data.data.data || [];
console.log(`\n📊 Address: ${address}`);
console.log(`Found ${txs.length} transactions\n`);

txs.forEach((tx, i) => {
  console.log(`[${i}] TxHash: ${tx.txID.substring(0, 20)}...`);
  console.log('    Timestamp:', new Date(tx.raw_data.timestamp).toISOString());
  console.log('    Contract type:', tx.raw_data.contract[0]?.type);
  console.log('    Status:', tx.ret?.[0]?.contractRet);
  
  const param = tx.raw_data.contract[0]?.parameter?.value;
  if (param) {
    if (param.to_address) console.log('    To:', param.to_address);
    if (param.owner_address) console.log('    From:', param.owner_address);
    if (param.amount) console.log('    Amount:', param.amount);
    if (param.contract_address) console.log('    Contract:', param.contract_address);
    if (param.data) console.log('    Data:', param.data.substring(0, 50));
  }
  
  console.log('');
});
