const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function checkBalance() {
    const userId = "j97903gww6z1qr8z5jk5v8j91x80xpvc";
    
    try {
        console.log(`🔍 Checking balance for user: ${userId}`);
        
        // Get user
        const user = await convex.query(api.user.getUserById, { userId });
        
        if (!user) {
            console.log(`❌ User not found`);
            return;
        }
        
        console.log(`✅ User found:`);
        console.log(`   Name: ${user.name || user.username}`);
        console.log(`   Email: ${user.email || user.contact}`);
        console.log(`💰 Current Balance: ${user.walletBalance || 0} USDT`);
        console.log(`📊 Referral Earnings: ${user.referralEarnings || 0} USDT`);
        
        // Get all deposits for this user
        const deposits = await convex.query(api.deposit.getUserDeposits, { userId });
        
        console.log(`\n📦 Deposit History:`);
        if (deposits && deposits.length > 0) {
            deposits.forEach((dep, idx) => {
                console.log(`   [${idx + 1}] Amount: ${dep.amount} | Status: ${dep.status} | TxHash: ${dep.transactionHash?.slice(0, 10)}...`);
            });
        } else {
            console.log(`   No deposits found`);
        }
        
    } catch (error) {
        console.error(`❌ Error:`, error.message);
    }
}

checkBalance();
