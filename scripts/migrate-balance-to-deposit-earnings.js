#!/usr/bin/env node
// Usage: node scripts/migrate-balance-to-deposit-earnings.js [--dry-run]
// This will set `depositAmount` = existing `balance` for users that don't
// already have `depositAmount` or `earnings` fields. It does NOT attempt to
// infer historical earnings. Run in staging first and backup DB.

async function main() {
  const raw = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (t.startsWith('--')) {
      const k = t.slice(2);
      const n = raw[i+1];
      if (n && !n.startsWith('--')) { args[k] = n; i++; } else { args[k] = true; }
    }
  }

  try { require('dotenv').config({ path: '.env.local' }); } catch(e) {}

  const dryRun = !!args['dry-run'];

  const { ConvexHttpClient } = require('convex/browser');
  const { anyApi } = require('convex/server');

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) { console.error('Missing NEXT_PUBLIC_CONVEX_URL in env'); process.exit(2); }
  const convex = new ConvexHttpClient(convexUrl);

  try {
    console.log('Fetching all users...');
    const users = await convex.query(anyApi.user.getAllUsers);
    if (!Array.isArray(users)) {
      console.error('Unexpected response for users');
      process.exit(3);
    }

    console.log(`Found ${users.length} users. Starting migration${dryRun ? ' (dry-run)' : ''}...`);
    let changed = 0;
    for (const u of users) {
      const userId = u._id;
      const hasDeposit = typeof u.depositAmount === 'number';
      const hasEarnings = typeof u.earnings === 'number';
      const balance = typeof u.balance === 'number' ? u.balance : (u.balance ? Number(u.balance) : 0);

      if (hasDeposit || hasEarnings) {
        console.log(`Skipping user ${userId} (already has depositAmount/earnings).`);
        continue;
      }

      // If balance is NaN or zero, we still write depositAmount = 0 for clarity
      const depositAmount = isNaN(balance) ? 0 : balance;

      console.log(`User ${userId}: balance=${depositAmount} -> setting depositAmount=${depositAmount}` + (dryRun ? ' (dry-run)' : ''));
      if (!dryRun) {
        await convex.mutation(anyApi.user.updateUserBalance, { userId, depositAmount: depositAmount });
        changed++;
      }
    }

    console.log(`Migration complete. ${dryRun ? 'Dry-run: no changes applied.' : `Updated ${changed} users.`}`);
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err && err.message ? err.message : err);
    process.exit(4);
  }
}

main();
