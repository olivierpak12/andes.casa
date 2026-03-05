const { ConvexHttpClient } = require('convex/browser');
require('dotenv').config({ path: '.env.local' });
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = new ConvexHttpClient(convexUrl);
const { api } = require('./convex/_generated/api');

(async () => {
  const users = await convex.query(api.user.getAllUsers, {});
  let totalDeposit = 0, totalEarnings = 0, totalLocked = 0;
  
  console.log('USER BREAKDOWN:');
  users.forEach(u => {
    const d = u.depositAmount || 0;
    const e = u.earnings || 0;
    const l = u.lockedPrincipal || 0;
    totalDeposit += d;
    totalEarnings += e;
    totalLocked += l;
    if (d + e + l > 0) {
      console.log(`${u.contact}: Deposit=${d}, Earnings=${e}, Locked=${l}`);
    }
  });
  
  console.log('\nTOTALS:');
  console.log(`Deposits: ${totalDeposit}`);
  console.log(`Earnings: ${totalEarnings}`);
  console.log(`Locked: ${totalLocked}`);
  console.log(`Grand Total: ${totalDeposit + totalEarnings + totalLocked}`);
})();
