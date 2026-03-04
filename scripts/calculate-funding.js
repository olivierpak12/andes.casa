/**
 * Calculate Required Hot Wallet Funding
 * Determines how much USDT needs to be in the hot wallet based on all user balances
 */

require('dotenv').config({ path: '.env.local' });
const { ConvexHttpClient } = require('convex/browser');
const TronWeb = require('tronweb');
const axios = require('axios');

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error('❌ NEXT_PUBLIC_CONVEX_URL not set');
  process.exit(1);
}

async function calculateFunding() {
  console.log('💰 Hot Wallet Funding Calculator\n');

  const convex = new ConvexHttpClient(convexUrl);
  const pk = process.env.TRON_PRIVATE_KEY;
  const apiKey = process.env.TRONGRID_API_KEY;

  // 1. Get hot wallet address
  const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': apiKey || '' },
  });

  const hotAddress = tronWeb.address.fromPrivateKey(pk);
  console.log(`📍 Hot Wallet Address: ${hotAddress}\n`);

  // 2. Get all users from Convex
  console.log('📊 Fetching user balances from database...');
  try {
    // Import the API dynamically
    const { api } = require('../convex/_generated/api');
    
    const users = await convex.query(api.user.getAllUsers, {});
    console.log(`✓ Found ${users.length} users\n`);

    let totalUserBalance = 0;
    let userDetails = [];

    for (const user of users) {
      const deposit = user.depositAmount || 0;
      const earnings = user.earnings || 0;
      const balance = deposit + earnings;
      totalUserBalance += balance;
      if (balance > 0) {
        userDetails.push({
          contact: user.contact || 'unknown',
          balance: balance,
        });
      }
    }

    console.log('👥 User Balances:');
    if (userDetails.length === 0) {
      console.log('   No users with balances');
    } else {
      userDetails.sort((a, b) => b.balance - a.balance);
      userDetails.slice(0, 10).forEach((u) => {
        console.log(`   ${u.contact}: $${u.balance} USDT`);
      });
      if (userDetails.length > 10) {
        console.log(`   ... and ${userDetails.length - 10} more users`);
      }
    }

    console.log(`\n📈 Total User Balances: $${totalUserBalance} USDT\n`);

    // 3. Get current hot wallet balance
    console.log('🔄 Checking current hot wallet balance...');
    try {
      const response = await axios.get(
        `https://nile.trongrid.io/v1/accounts/${hotAddress}`,
        { headers: { 'TRON-PRO-API-KEY': apiKey || '' } }
      );

      if (response.data && response.data.data && response.data.data[0]) {
        const account = response.data.data[0];
        const trxBalance = (account.balance || 0) / 1e6;
        console.log(`   TRX Balance: ${trxBalance} TRX`);
      }
    } catch (err) {
      console.log(`   ⚠️ Could not fetch TRX balance`);
    }

    // Try to get USDT balance
    let hotWalletUSDT = 0;
    try {
      tronWeb.setAddress(hotAddress);
      const contractAddr = process.env.ACTIVE_USDT_CONTRACT;
      const contract = await tronWeb.contract().at(contractAddr);
      const balance = await contract.balanceOf(hotAddress).call();
      hotWalletUSDT = parseInt(balance.toString()) / 1e6;
      console.log(`   USDT Balance: ${hotWalletUSDT} USDT`);
    } catch (err) {
      console.log(`   ⚠️ Could not fetch USDT balance (might need contract funding)`);
    }

    console.log('');

    // 4. Calculate requirement
    console.log('💳 Funding Requirement:');
    const fundingNeeded = totalUserBalance - hotWalletUSDT;

    console.log(`   Total User Balances (Database): $${totalUserBalance} USDT`);
    console.log(`   Current Hot Wallet (On-Chain):  $${hotWalletUSDT} USDT`);
    console.log(`   ─────────────────────────────────────────`);

    if (fundingNeeded > 0) {
      console.log(`   ❌ FUNDING NEEDED:              $${fundingNeeded.toFixed(2)} USDT`);
      console.log('');
      console.log('📌 Action Required:');
      console.log(`   1. Go to Nile testnet faucet: https://nileex.io/join/getJoinPage`);
      console.log(`   2. Paste address: ${hotAddress}`);
      console.log(`   3. Request at least ${fundingNeeded.toFixed(0)} TRC20 USDT`);
      console.log(`   4. Wait for confirmation`);
      console.log(`   5. Reload admin dashboard`);
    } else if (fundingNeeded === 0) {
      console.log(`   ✅ FUNDED:                      $${hotWalletUSDT} USDT`);
      console.log('');
      console.log('✓ Hot wallet perfectly matches user balances!');
    } else {
      console.log(`   ✅ OVER FUNDED:                 $${hotWalletUSDT.toFixed(2)} USDT`);
      console.log(`   (Surplus: $${Math.abs(fundingNeeded).toFixed(2)} USDT)`);
    }

    console.log('');
    console.log('ℹ️ How it works:');
    console.log('   - User balances are stored in Convex database');
    console.log('   - Hot wallet on-chain must hold equivalent USDT');
    console.log('   - This is the "reserve" for user withdrawals');
    console.log('   - When users withdraw, USDT comes from hot wallet');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

calculateFunding();
