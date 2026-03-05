/**
 * Find Where the Money Is
 * Trace all user balances and transaction history
 * UPDATED: Now actually checks blockchain balance!
 */

require('dotenv').config({ path: '.env.local' });
const { ConvexHttpClient } = require('convex/browser');
const TronWeb = require('tronweb');

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error('❌ NEXT_PUBLIC_CONVEX_URL not set');
  process.exit(1);
}

async function findMoney() {
  console.log('🔍 WHERE IS THE MONEY?\n');

  const convex = new ConvexHttpClient(convexUrl);
  const { api } = require('../convex/_generated/api');

  // 1. Get all users and their balances
  console.log('📊 DATABASE: User Balances');
  console.log('─'.repeat(60));
  
  const users = await convex.query(api.user.getAllUsers, {});
  
  let totalUserBalance = 0;
  const usersWithBalance = [];

    for (const user of users) {
    const deposit = user.depositAmount || 0;
    const balance = deposit + (user.earnings || 0);
    const locked = user.lockedPrincipal || 0;
    const earnings = user.earnings || 0;
    
    if (balance > 0 || locked > 0 || earnings > 0) {
      usersWithBalance.push({
        contact: user.contact || user._id,
        balance,
        locked,
        earnings,
        total: balance + locked + earnings,
      });
      totalUserBalance += balance;
    }
  }

  if (usersWithBalance.length === 0) {
    console.log('   ❌ No users with money');
  } else {
    console.log(`   Total Users: ${users.length}`);
    console.log(`   Users with Money: ${usersWithBalance.length}\n`);
    
    usersWithBalance.sort((a, b) => b.total - a.total);
    
    console.log('   TOP USERS:');
    usersWithBalance.slice(0, 15).forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.contact}`);
      console.log(`      Balance: $${u.balance.toFixed(2)}`);
      if (u.locked > 0) console.log(`      Locked: $${u.locked.toFixed(2)}`);
      if (u.earnings > 0) console.log(`      Earnings: $${u.earnings.toFixed(2)}`);
    });
  }

  console.log(`\n   ✓ TOTAL IN USER ACCOUNTS: $${totalUserBalance.toFixed(2)} USDT\n`);

  // 2. Get transaction history
  console.log('📋 TRANSACTIONS');
  console.log('─'.repeat(60));
  
  const transactions = await convex.query(api.transaction.getAllTransactions, {});
  
  let totalDepositsPending = 0;
  let totalDepositsCompleted = 0;
  let totalWithdrawalsPending = 0;
  let totalWithdrawalsCompleted = 0;

  for (const tx of transactions) {
    if (tx.type === 'deposit') {
      if (tx.status === 'pending') totalDepositsPending += tx.amount || 0;
      if (tx.status === 'completed') totalDepositsCompleted += tx.amount || 0;
    } else if (tx.type === 'withdrawal') {
      if (tx.status === 'pending') totalWithdrawalsPending += tx.amount || 0;
      if (tx.status === 'completed') totalWithdrawalsCompleted += tx.amount || 0;
    }
  }

  console.log(`   Deposits (Completed): $${totalDepositsCompleted.toFixed(2)} USDT`);
  console.log(`   Deposits (Pending): $${totalDepositsPending.toFixed(2)} USDT`);
  console.log(`   Withdrawals (Completed): $${totalWithdrawalsCompleted.toFixed(2)} USDT`);
  console.log(`   Withdrawals (Pending): $${totalWithdrawalsPending.toFixed(2)} USDT`);
  console.log(`\n   Net Flow (Deposits - Withdrawals): $${(totalDepositsCompleted - totalWithdrawalsCompleted).toFixed(2)} USDT\n`);

  // 3. Get hot wallet blockchain balance
  console.log('🔗 BLOCKCHAIN: Hot Wallet Balance');
  console.log('─'.repeat(60));
  
  const TRONGRID = process.env.TRONGRID_API_URL || 'https://nile.trongrid.io';
  const tronWeb = new TronWeb({ 
    fullHost: TRONGRID, 
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' } 
  });
  
  const privateKey = process.env.TRON_PRIVATE_KEY;
  let hotWalletAddress = 'UNKNOWN';
  let hotWalletUSDT = 0;
  let hotWalletTRX = 0;

  if (!privateKey) {
    console.log('   ❌ TRON_PRIVATE_KEY not set in .env.local');
  } else {
    try {
      hotWalletAddress = tronWeb.address.fromPrivateKey(privateKey);
      console.log(`   Hot Wallet Address: ${hotWalletAddress}\n`);

      // Get TRX balance
      try {
        const trxBalance = await tronWeb.trx.getBalance(hotWalletAddress);
        hotWalletTRX = tronWeb.fromSun(trxBalance);
        console.log(`   TRX Balance: ${hotWalletTRX.toFixed(6)} TRX`);
      } catch (e) {
        console.log(`   TRX Balance: ERROR - ${e.message}`);
      }

      // Get USDT balance
      const activeContract = process.env.ACTIVE_USDT_CONTRACT;
      if (activeContract) {
        try {
          const contract = await tronWeb.contract().at(activeContract);
          const usdtRaw = await contract.balanceOf(hotWalletAddress).call();
          hotWalletUSDT = parseInt(usdtRaw.toString()) / 1e6;
          console.log(`   USDT Balance: $${hotWalletUSDT.toFixed(2)} USDT ✅`);
        } catch (e) {
          console.log(`   USDT Balance: ERROR - ${e.message}`);
        }
      } else {
        console.log(`   USDT Balance: ❌ ACTIVE_USDT_CONTRACT not set`);
      }
    } catch (e) {
      console.log(`   ❌ Error getting hot wallet: ${e.message}`);
    }
  }

  console.log();

  // 4. Summary
  console.log('💰 MONEY SUMMARY');
  console.log('─'.repeat(60));
  console.log(`\n   🏦 IN USER ACCOUNTS (DATABASE):`);
  console.log(`      Total: $${totalUserBalance.toFixed(2)} USDT`);
  
  console.log(`\n   🔗 ON BLOCKCHAIN (HOT WALLET):`);
  console.log(`      Address: ${hotWalletAddress}`);
  console.log(`      USDT: $${hotWalletUSDT.toFixed(2)} USDT ${hotWalletUSDT > 0 ? '✅' : '❌'}`);
  
  console.log(`\n   📊 RECONCILIATION:`);
  const difference = totalUserBalance - hotWalletUSDT;
  console.log(`      User Balances: $${totalUserBalance.toFixed(2)}`);
  console.log(`      Hot Wallet: $${hotWalletUSDT.toFixed(2)}`);
  console.log(`      ─────────────────────────`);
  if (difference === 0) {
    console.log(`      ✅ BALANCED! System is ready`);
  } else if (difference > 0) {
    console.log(`      ⚠️  MISSING: $${difference.toFixed(2)} (Need to fund)`);
  } else {
    console.log(`      ⚠️  EXCESS: $${Math.abs(difference).toFixed(2)} (Extra in wallet)`);
  }
  
  console.log(`\n✅ ANALYSIS:`);
  if (totalUserBalance === 0) {
    console.log(`   ✓ No users have money - system is empty and ready`);
  } else if (hotWalletUSDT >= totalUserBalance) {
    console.log(`   ✓ Hot wallet is FUNDED and covers all user balances`);
  } else if (hotWalletUSDT === 0) {
    console.log(`   ⚠️  The system has $${totalUserBalance.toFixed(2)} USDT in user accounts,`);
    console.log(`   ⚠️  but the hot wallet has $0.00 USDT on-chain.`);
    console.log(`\n   WHAT TO DO:`);
    console.log(`   1. Fund the hot wallet with $${difference.toFixed(2)} USDT`);
    console.log(`   2. Use testnet faucet: https://nileex.io/join/getJoinPage`);
    console.log(`   3. Paste address: ${hotWalletAddress}`);
    console.log(`   4. Request exactly $${difference.toFixed(0)} USDT (TRC20)`);
    console.log(`   5. Wait 2-5 minutes and rerun this script`);
  } else {
    console.log(`   ⚠️  Partial funding detected:`);
    console.log(`   ⚠️  Need $${difference.toFixed(2)} more USDT`);
  }
  
  console.log('');
}

findMoney().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
