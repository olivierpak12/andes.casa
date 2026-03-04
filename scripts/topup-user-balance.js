#!/usr/bin/env node
// Usage: node scripts/topup-user-balance.js --contact "+1783150249" --amount 100

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
  if (!args.contact || !args.amount) {
    console.error('Usage: node scripts/topup-user-balance.js --contact <contact> --amount <number>');
    process.exit(1);
  }

  try { require('dotenv').config({ path: '.env.local' }); } catch(e) {
    try { const fs = require('fs'); if (fs.existsSync('.env.local')) { const envRaw = fs.readFileSync('.env.local','utf8'); envRaw.split(/\r?\n/).forEach(line=>{ const trimmed=line.trim(); if(!trimmed||trimmed.startsWith('#')) return; const eq=trimmed.indexOf('='); if(eq===-1) return; const key=trimmed.slice(0,eq).trim(); let val=trimmed.slice(eq+1).trim(); if((val.startsWith('"')&&val.endsWith('"'))||(val.startsWith("'")&&val.endsWith("'"))) val=val.slice(1,-1); if(!process.env[key]) process.env[key]=val; }); } } catch(e2){}
  }

  const contact = String(args.contact);
  const add = Number(args.amount);

  const { ConvexHttpClient } = require('convex/browser');
  const { anyApi } = require('convex/server');

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) { console.error('Missing NEXT_PUBLIC_CONVEX_URL'); process.exit(2); }
  const convex = new ConvexHttpClient(convexUrl);

  try {
    console.log('Resolving user by contact...', contact);
    const user = await convex.query(anyApi.user.getUserByContact, { contact });
    if (!user) { console.error('User not found'); process.exit(3); }
    const currentDeposit = user.depositAmount || 0;
    const currentEarnings = user.earnings || 0;
    const currentBalance = currentDeposit + currentEarnings;
    console.log('Found user id:', user._id, 'current balance:', currentBalance, 'deposit:', currentDeposit, 'earnings:', currentEarnings, 'locked:', user.lockedPrincipal || 0);

    const newDepositTotal = currentDeposit + add;
    console.log('Updating depositAmount to', newDepositTotal);

    await convex.mutation(anyApi.user.updateUserBalance, { userId: user._id, depositAmount: newDepositTotal });

    console.log('Top-up completed. New depositAmount set to', newDepositTotal, 'new total balance:', newDepositTotal + currentEarnings);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(4);
  }
}

main();
