#!/usr/bin/env node

/**
 * Simple Deposit Debug - Check blockchain transactions
 * No Convex dependency required
 */

import axios from 'axios';

const TRON_API_URL = 'https://nile.trongrid.io'; // or https://api.trongrid.io for mainnet
const USDT_CONTRACT = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'; // Nile testnet USDT

async function getTransactions(address) {
  console.log(`\n📡 Fetching transactions for: ${address}`);
  console.log(`   API: ${TRON_API_URL}\n`);
  
  try {
    const response = await axios.get(`${TRON_API_URL}/v1/accounts/${address}/transactions`, {
      params: {
        only_confirmed: true,
        limit: 50,
      },
      headers: {
        'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || ''
      }
    });

    const transactions = response.data.data || [];
    console.log(`✅ Found ${transactions.length} confirmed transactions\n`);
    
    return transactions;
  } catch (error) {
    console.error(`❌ Error fetching transactions:`, error.message);
    return [];
  }
}

function parseTRC20TransferData(data) {
  try {
    if (!data || !data.startsWith('a9059cbb') || data.length < 136) {
      return null;
    }

    const amountHex = data.slice(72, 136);
    const amount = parseInt(amountHex, 16) / 1e6;
    
    return { amount };
  } catch (e) {
    return null;
  }
}

function analyzeTransactions(transactions, targetAddress) {
  console.log(`\n🔍 Analyzing transactions\n`);
  
  let usdt_deposits = [];
  let trx_deposits = [];

  transactions.forEach((tx) => {
    const txHash = tx.txID;
    const timestamp = new Date(tx.raw_data.timestamp);
    const contract = tx.raw_data.contract[0];
    const confirmed = tx.ret?.[0]?.contractRet === 'SUCCESS';
    
    if (contract.type === 'TransferContract') {
      const value = contract.parameter.value;
      const to = value.to_address;
      const amount = value.amount / 1e6;
      
      if (confirmed && to === targetAddress) {
        trx_deposits.push({
          txHash,
          timestamp,
          amount: `${amount.toFixed(2)} TRX`,
          from: value.owner_address,
        });
      }
    } 
    else if (contract.type === 'TriggerSmartContract') {
      const parameter = contract.parameter.value;
      const contractAddr = parameter.contract_address;
      const data = parameter.data;
      
      // Check if USDT
      if (contractAddr.toLowerCase() === USDT_CONTRACT.toLowerCase()) {
        if (data.startsWith('a9059cbb')) {
          const parsed = parseTRC20TransferData(data);
          if (parsed && parsed.amount > 0) {
            usdt_deposits.push({
              txHash,
              timestamp,
              amount: `${parsed.amount.toFixed(6)} USDT`,
              type: 'USDT Transfer',
            });
          }
        }
      }
    }
  });

  // Display results
  console.log(`📊 USDT Deposits Found: ${usdt_deposits.length}`);
  if (usdt_deposits.length > 0) {
    usdt_deposits.forEach((dep, i) => {
      console.log(`   [${i + 1}] ${dep.amount} | ${dep.timestamp.toISOString()}`);
      console.log(`       TxHash: ${dep.txHash.substring(0, 20)}...`);
    });
  } else {
    console.log(`   ❌ No USDT deposits found`);
  }

  console.log(`\n💰 TRX Transfers Found: ${trx_deposits.length}`);
  if (trx_deposits.length > 0) {
    trx_deposits.forEach((dep, i) => {
      console.log(`   [${i + 1}] ${dep.amount} | ${dep.timestamp.toISOString()}`);
      console.log(`       TxHash: ${dep.txHash.substring(0, 20)}...`);
    });
  }

  // Summary
  const totalUsdt = usdt_deposits.reduce((sum, d) => {
    const num = parseFloat(d.amount);
    return sum + num;
  }, 0);

  console.log(`\n✅ Total USDT: $${totalUsdt.toFixed(2)}`);
}

async function main() {
  const address = process.argv[2];
  
  if (!address) {
    console.log(`Usage: node scripts/check-address.js <address>`);
    console.log(`Example: node scripts/check-address.js TAuMs3Hq6mFTmvTJQb7i3KHP79Kyw4wouE`);
    process.exit(1);
  }

  console.log('\n🔧 TRON Address Deposit Checker');
  console.log('==================================');

  const transactions = await getTransactions(address);
  analyzeTransactions(transactions, address);
  
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
