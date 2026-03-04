/**
 * Audit Script: Verify where platform funds are located
 * - Check hot wallet balance
 * - Check total user balances in Convex
 * - Compare and report discrepancies
 */

require('dotenv').config({ path: '.env.local' });

const { ConvexHttpClient } = require('convex/browser');
const { api } = require('../convex/_generated/api');
const { getTronWeb, getAccountBalance } = require('../lib/tron/utils');

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error('❌ NEXT_PUBLIC_CONVEX_URL not set in .env.local');
  process.exit(1);
}

const convex = new ConvexHttpClient(convexUrl);

async function auditFunds() {
  console.log('🔍 Platform Fund Audit\n');
  
  try {
    // 1. Get hot wallet balance
    console.log('📊 Checking Hot Wallet...');
    const privateKey = process.env.TRON_PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ TRON_PRIVATE_KEY not set');
      process.exit(1);
    }

    const tronWeb = getTronWeb();
    const hotAddress = tronWeb.address.fromPrivateKey(privateKey);
    console.log(`   Hot Wallet Address: ${hotAddress}`);

    const hotWalletBal = await getAccountBalance(hotAddress);
    console.log(`   TRX Balance: ${hotWalletBal.trx} TRX`);
    console.log(`   USDT Balance: ${hotWalletBal.usdt} USDT`);
    console.log('');

    // 2. Get all users and their balances from Convex
    console.log('📊 Checking User Balances in Convex...');
    
    const { api } = require('../convex/_generated/api');
    const users = await convex.query(api.user.getAllUsers, {});
    console.log(`   Total Users: ${users.length}`);

    let totalUserBalance = 0;
    let totalWithdrawals = 0;
    let totalDeposits = 0;
    let totalUserBalances = 0;

    // Calculate from users (depositAmount + earnings)
    for (const user of users) {
      const balance = (user.depositAmount || 0) + (user.earnings || 0);
      totalUserBalance += balance;
      totalUserBalances += balance;
    }
    console.log(`   Total User Balances (in Convex DB): ${totalUserBalances} USDT`);
    console.log('');

    // Try to get transactions to calculate totals
    console.log('📊 Analyzing Transactions...');
    const transactions = await convex.query(api.transaction.getAllTransactions, {});

    // Calculate totals from transactions
    for (const tx of transactions) {
      if (tx.type === 'deposit' && tx.status === 'completed') {
        totalDeposits += tx.amount || 0;
      } else if (tx.type === 'withdrawal' && tx.status === 'completed') {
        totalWithdrawals += tx.amount || 0;
      }
    }

    console.log(`   Total Completed Deposits: ${totalDeposits} USDT`);
    console.log(`   Total Completed Withdrawals: ${totalWithdrawals} USDT`);
    console.log('');

    // 3. Calculate summary
    console.log('💰 Financial Summary:');
    console.log(`   Total User Balances (Convex DB): ${totalUserBalances} USDT`);
    console.log(`   Total Completed Deposits: ${totalDeposits} USDT`);
    console.log(`   Total Completed Withdrawals: ${totalWithdrawals} USDT`);
    console.log(`   Net Flows (Deposits - Withdrawals): ${totalDeposits - totalWithdrawals} USDT`);
    console.log(`   Hot Wallet USDT Balance (On-Chain): ${hotWalletBal.usdt} USDT`);
    console.log('');

    // 4. Analysis
    console.log('📈 Analysis:');
    const netFlows = totalDeposits - totalWithdrawals;
    const difference = Math.abs(hotWalletBal.usdt - netFlows);
    
    console.log(`   Expected Platform Balance: ${netFlows} USDT`);
    console.log(`   Hot Wallet Balance: ${hotWalletBal.usdt} USDT`);
    
    if (difference < 0.1) {
      console.log('   ✅ HOT WALLET BALANCE MATCHES EXPECTED! Funds are properly accounted for.');
    } else {
      console.log(`   ⚠️ DISCREPANCY: ${difference} USDT difference`);
    }
    console.log('');

    // 5. Breakdown
    console.log('🔐 Where Are the Funds?');
    console.log(`   [ON-CHAIN] Hot Wallet USDT: ${hotWalletBal.usdt} USDT`);
    console.log(`   [DATABASE] User Account Balances: ${totalUserBalances} USDT`);
    console.log(`   [TOTAL ACCOUNTED]: ${hotWalletBal.usdt + totalUserBalances} USDT`);
    console.log('');

    console.log('✅ Audit Complete');

  } catch (error) {
    console.error('❌ Audit Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

auditFunds();
