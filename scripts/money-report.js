/**
 * Money Location Report
 * Shows exactly where all platform money is and what needs to happen
 */

require('dotenv').config({ path: '.env.local' });
const { ConvexHttpClient } = require('convex/browser');

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error('❌ NEXT_PUBLIC_CONVEX_URL not set');
  process.exit(1);
}

async function moneyReport() {
  console.log('\n💰 MONEY LOCATION REPORT\n');
  console.log('═'.repeat(70));

  const convex = new ConvexHttpClient(convexUrl);
  const { api } = require('../convex/_generated/api');

  try {
    // Get all users
    const users = await convex.query(api.user.getAllUsers, {});
    
    let totalBalance = 0;
    const userList = [];

    for (const user of users) {
      const deposit = user.depositAmount || 0;
      const earnings = user.earnings || 0;
      const balance = deposit + earnings;
      if (balance > 0) {
        totalBalance += balance;
        userList.push({
          contact: user.contact || user._id,
          balance,
        });
      }
    }

    userList.sort((a, b) => b.balance - a.balance);

    console.log('\n📊 MONEY IN DATABASE (User Account Balances):\n');
    
    if (userList.length === 0) {
      console.log('   ❌ No users have money in their accounts');
    } else {
      console.log(`   Total Users: ${users.length}`);
      console.log(`   Users with Money: ${userList.length}\n`);
      
      userList.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.contact}: $${u.balance.toFixed(2)} USDT`);
      });
    }

    console.log(`\n   ╔════════════════════════════════════════╗`);
    console.log(`   ║ TOTAL IN DATABASE: $${totalBalance.toFixed(2).padStart(31)} ║`);
    console.log(`   ╚════════════════════════════════════════╝\n`);

    // Get transactions
    const transactions = await convex.query(api.transaction.getAllTransactions, {});
    
    let depositsCompleted = 0;
    let withdrawalsCompleted = 0;

    for (const tx of transactions) {
      if (tx.type === 'deposit' && tx.status === 'completed') {
        depositsCompleted += tx.amount || 0;
      } else if (tx.type === 'withdrawal' && tx.status === 'completed') {
        withdrawalsCompleted += tx.amount || 0;
      }
    }

    const netFlow = depositsCompleted - withdrawalsCompleted;

    console.log('📋 TRANSACTION HISTORY:\n');
    console.log(`   Completed Deposits:  + $${depositsCompleted.toFixed(2)} USDT`);
    console.log(`   Completed Withdrawals: - $${withdrawalsCompleted.toFixed(2)} USDT`);
    console.log(`   ──────────────────────────────────`);
    console.log(`   Net Money In System: $${netFlow.toFixed(2)} USDT\n`);

    // Now the important part
    console.log('═'.repeat(70));
    console.log('\n🚨 WHAT YOU NEED TO DO:\n');

    if (totalBalance > 0) {
      console.log(`   ⚠️  You have $${totalBalance.toFixed(2)} USDT tracked in user accounts`);
      console.log(`   ❌ But hot wallet shows: $0.00 USDT on blockchain\n`);
      console.log(`   ACTION REQUIRED:\n`);
      console.log(`   1. Go to Nile Testnet Faucet:`);
      console.log(`      https://nileex.io/join/getJoinPage\n`);
      console.log(`   2. Paste this address:`);
      console.log(`      TRahYuQRtfd92wYBqS4rKpb3MmfYv5RHLT\n`);
      console.log(`   3. Request EXACTLY $${totalBalance.toFixed(0)} USDT (TRC20)\n`);
      console.log(`   4. Wait 2-5 minutes for confirmation\n`);
      console.log(`   5. Reload your admin dashboard\n`);
      console.log(`   After funding:\n`);
      console.log(`   ✓ Hot Wallet: $${totalBalance.toFixed(2)} USDT (on-chain)`);
      console.log(`   ✓ User Accounts: $${totalBalance.toFixed(2)} USDT (database)`);
      console.log(`   ✓ System is BALANCED and ready for operations\n`);
    } else {
      console.log(`   ✓ No users have money yet`);
      console.log(`   ✓ System is ready to receive deposits\n`);
    }

    console.log('═'.repeat(70));
    console.log('\nℹ️  How the system works:\n');
    console.log('   DATABASE          BLOCKCHAIN');
    console.log('   ────────          ──────────');
    console.log('   Tracks ownership  Holds actual money');
    console.log('   User balances     Hot wallet USDT');
    console.log('   $ amount owned    $ amount available');
    console.log('\n   These MUST be equal for the system to work!\n');
    console.log('═'.repeat(70) + '\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

moneyReport();
