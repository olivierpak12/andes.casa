#!/usr/bin/env node

/**
 * Deposit Debug Script
 * Tests the deposit detection flow step-by-step
 * 
 * Usage: node scripts/debug-deposits.js <deposit-address> [user-contact]
 */

import axios from 'axios';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

const TRON_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.trongrid.io'
  : 'https://nile.trongrid.io';

const USDT_CONTRACT = process.env.NODE_ENV === 'production'
  ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  : 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

async function getTransactions(address) {
  console.log(`\n📡 Fetching transactions for: ${address}`);
  console.log(`   API: ${TRON_API_URL}`);
  
  try {
    const response = await axios.get(`${TRON_API_URL}/v1/accounts/${address}/transactions`, {
      params: {
        only_confirmed: true,
        limit: 20,
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
    // TRC20 transfer: a9059cbb + 64 chars address + 64 chars amount
    if (!data || !data.startsWith('a9059cbb') || data.length < 136) {
      return null;
    }

    const recipientHex = '41' + data.slice(8, 72);
    const amountHex = data.slice(72, 136);
    const amount = parseInt(amountHex, 16) / 1e6;
    
    return {
      recipientHex,
      amount,
    };
  } catch (e) {
    console.error('  ❌ Error parsing TRC20 data:', e.message);
    return null;
  }
}

function analyzeTransactions(transactions, targetAddress) {
  console.log(`\n🔍 Analyzing transactions for recipient: ${targetAddress}\n`);
  
  let analyzedCount = 0;
  let usdt_count = 0;
  let trx_count = 0;
  let other_count = 0;

  transactions.forEach((tx, idx) => {
    const txHash = tx.txID;
    const timestamp = new Date(tx.raw_data.timestamp);
    const contract = tx.raw_data.contract[0];
    const confirmed = tx.ret?.[0]?.contractRet === 'SUCCESS';
    
    console.log(`[${idx + 1}] ${txHash.substring(0, 16)}... | ${timestamp.toISOString()}`);
    console.log(`    Status: ${confirmed ? '✅ CONFIRMED' : '⚠️ PENDING'}`);
    
    if (contract.type === 'TransferContract') {
      const value = contract.parameter.value;
      const amount = value.amount / 1e6;
      console.log(`    Type: TRX Transfer`);
      console.log(`    Amount: ${amount.toFixed(2)} TRX`);
      trx_count++;
    } else if (contract.type === 'TriggerSmartContract') {
      const parameter = contract.parameter.value;
      const contractAddr = parameter.contract_address;
      const data = parameter.data;
      
      console.log(`    Type: TriggerSmartContract (TRC20?)`);
      console.log(`    Contract: ${contractAddr}`);
      console.log(`    Is USDT: ${contractAddr.toLowerCase() === USDT_CONTRACT.toLowerCase() ? '✅ YES' : '❌ NO (different contract)'}`);
      
      if (data.startsWith('a9059cbb')) {
        const parsed = parseTRC20TransferData(data);
        if (parsed) {
          console.log(`    Amount: ${parsed.amount.toFixed(6)} USDT`);
          console.log(`    Recipient: ${parsed.recipientHex.substring(0, 16)}...`);
          usdt_count++;
        } else {
          console.log(`    ❌ Failed to parse data`);
        }
      } else {
        console.log(`    ❌ Not a transfer (data doesn't start with a9059cbb)`);
        other_count++;
      }
    } else {
      console.log(`    Type: ${contract.type} (unknown)`);
      other_count++;
    }
    
    analyzedCount++;
    console.log('');
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Total transactions: ${analyzedCount}`);
  console.log(`   TRX transfers: ${trx_count}`);
  console.log(`   USDT (TRC20): ${usdt_count}`);
  console.log(`   Other: ${other_count}`);
}

async function checkUserDeposits(userContact) {
  try {
    console.log(`\n👤 Looking up user: ${userContact}`);
    const user = await convex.query(api.user.getUserByContact, { contact: userContact });
    
    if (!user) {
      console.log(`❌ User not found`);
      return;
    }

    console.log(`✅ User found: ${user.fullname || 'Unknown'}`);
    console.log(`   Current deposit amount: $${(user.depositAmount || 0).toFixed(2)}`);
    console.log(`   Last check: ${user.lastDepositCheck ? new Date(user.lastDepositCheck).toISOString() : 'Never'}`);
    console.log(`   Deposit address: ${user.depositAddresses?.trc20 || 'Not set'}`);
  } catch (error) {
    console.error(`❌ Error checking user:`, error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: node scripts/debug-deposits.js <address> [user-contact]

Examples:
  node scripts/debug-deposits.js TN3W4H6rK8ZaLkD5mN2pQ9rT6wU8vX1yZ
  node scripts/debug-deposits.js TN3W4H6rK8ZaLkD5mN2pQ9rT6wU8vX1yZ user@example.com
    `);
    process.exit(1);
  }

  const depositAddress = args[0];
  const userContact = args[1];

  console.log('\n🔧 Deposit Detection Debug Tool');
  console.log('================================\n');

  // Check user if provided
  if (userContact) {
    await checkUserDeposits(userContact);
  }

  // Fetch and analyze transactions
  const transactions = await getTransactions(depositAddress);
  analyzeTransactions(transactions, depositAddress);

  console.log(`\n✅ Debug complete. Check the logs above for issues.`);
  console.log(`\n💡 Common issues:`);
  console.log(`   - Contract address mismatch (wrong USDT contract)`);
  console.log(`   - Transaction not confirmed yet`);
  console.log(`   - Recipient address parsed incorrectly from data field`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
