#!/usr/bin/env node
/*
Script: perform-withdrawal.js
Performs a real withdrawal:
- Resolves Convex user by contact
- Calls requestWithdrawal (creates pending tx)
- Broadcasts TRC20 transfer from hot wallet
- Verifies on-chain
- Calls completeWithdrawal (marks completed)

Usage: node scripts/perform-withdrawal.js --contact "+1783150249" --amount 100 --address TRahYuQRtfd92wYBqS4rKpb3MmfYv5RHLT

Requires the environment (.env.local) to contain:
- NEXT_PUBLIC_CONVEX_URL
- TRON_PRIVATE_KEY
- TRONGRID_API_URL
- TRONGRID_API_KEY (optional)
- ACTIVE_USDT_CONTRACT
*/

async function main() {
  // Simple CLI parser
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

  if (!args.contact || !args.amount || !args.address) {
    console.error('Usage: node scripts/perform-withdrawal.js --contact <contact> --amount <number> --address <tronAddress>');
    process.exit(1);
  }

  // Load environment
  try { require('dotenv').config({ path: '.env.local' }); } catch(e) {
    // Fallback: manually parse .env.local if dotenv isn't installed
    try {
      const fs = require('fs');
      const envPath = '.env.local';
      if (fs.existsSync(envPath)) {
        const envRaw = fs.readFileSync(envPath, 'utf8');
        envRaw.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const eq = trimmed.indexOf('=');
          if (eq === -1) return;
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          // Remove surrounding quotes
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        });
      }
    } catch (e2) {
      // ignore
    }
  }

  const contact = String(args.contact);
  const amount = Number(args.amount);
  const recipient = String(args.address);

  console.log('Starting real withdrawal process');
  console.log(`Contact: ${contact}`);
  console.log(`Amount: ${amount} USDT`);
  console.log(`Recipient: ${recipient}`);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error('Missing NEXT_PUBLIC_CONVEX_URL in environment');
    process.exit(2);
  }

  const TronWeb = require('tronweb');
  const { ConvexHttpClient } = require('convex/browser');
  const { anyApi } = require('convex/server');

  const convex = new ConvexHttpClient(convexUrl);

  try {
    // 1. Resolve user by contact
    console.log('Resolving user in Convex by contact...');
    const user = await convex.query(anyApi.user.getUserByContact, { contact });
    if (!user) {
      console.error('User not found for contact:', contact);
      process.exit(3);
    }
    console.log('Found user id:', user._id);

    // 2. Create pending withdrawal in Convex
      // Ensure withdrawable amount is sufficient. Withdrawable amount comes from `earnings` only.
      const userEarnings = user.earnings || 0;
      if (userEarnings < amount) {
        console.error(`Insufficient earnings to withdraw: available ${userEarnings}, requested ${amount}. Aborting.`);
        process.exit(3);
      }

      console.log('Requesting withdrawal in Convex (creates pending tx)...');
      const txId = await convex.mutation(anyApi.withdrawal.requestWithdrawal, {
        userId: user._id,
        amount: amount,
        address: recipient,
        network: 'trc20',
      });

    console.log('Convex pending transaction id:', txId);

    // 3. Broadcast TRC20 transfer
    const privateKey = process.env.TRON_PRIVATE_KEY;
    const activeContract = process.env.ACTIVE_USDT_CONTRACT;
    const TRONGRID = process.env.TRONGRID_API_URL || 'https://nile.trongrid.io';

    if (!privateKey) {
      console.error('Missing TRON_PRIVATE_KEY in environment');
      // Attempt to mark failed
      await convex.mutation(anyApi.withdrawal.completeWithdrawal, { transactionId: txId, status: 'failed', error: 'Server missing hot wallet key' }).catch(()=>{});
      process.exit(4);
    }
    if (!activeContract) {
      console.error('Missing ACTIVE_USDT_CONTRACT in environment');
      await convex.mutation(anyApi.withdrawal.completeWithdrawal, { transactionId: txId, status: 'failed', error: 'Server missing USDT contract' }).catch(()=>{});
      process.exit(5);
    }

    const tronWeb = new TronWeb({ fullHost: TRONGRID, headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' } });
    tronWeb.setPrivateKey(privateKey);

    const hotAddress = tronWeb.address.fromPrivateKey(privateKey);
    console.log('Hot wallet address:', hotAddress);

    const contract = await tronWeb.contract().at(activeContract);
    const amountInSun = Math.floor(amount * 1e6);

    console.log(`Sending ${amount} USDT (${amountInSun} units) to ${recipient} via contract ${activeContract}`);

    let transferResult = null;
    try {
      transferResult = await contract.transfer(recipient, amountInSun).send({ feeLimit: 100_000_000 });
    } catch (err) {
        try {
          const util = require('util');
          console.error('Transfer error (inspect):', util.inspect(err, { depth: 6, colors: false }));
        } catch (e) {
          console.error('Transfer error (raw):', err);
        }
    }

    // Normalize tx id
    let txHash = null;
    if (!transferResult) {
      console.error('No transfer result returned from TronWeb');
    } else if (typeof transferResult === 'string') {
      txHash = transferResult;
    } else if (transferResult && (transferResult.txid || transferResult.transactionHash || transferResult.hash || transferResult.transaction?.hash)) {
      txHash = transferResult.txid || transferResult.transactionHash || transferResult.hash || transferResult.transaction?.hash;
    }

    if (!txHash) {
      console.error('Unable to determine txHash from transfer result. Marking failed and refunding user.');
      await convex.mutation(anyApi.withdrawal.completeWithdrawal, { transactionId: txId, status: 'failed', error: 'No txHash from TronWeb transfer' }).catch(()=>{});
      process.exit(6);
    }

    console.log('Broadcasted txHash:', txHash);

    // 4. Verify tx on chain with retries
    const maxVerify = 12;
    let verified = false;
    for (let i = 0; i < maxVerify; i++) {
      try {
        await new Promise(r => setTimeout(r, i < 3 ? 1000 : 2000));
        const res = await fetch(`${TRONGRID}/v1/transactions/${txHash}`, { headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' } });
        if (res.ok) {
          const data = await res.json();
          if (data.data && data.data.length) { verified = true; break; }
        }
      } catch (err) {
        console.log('Verify attempt error, retrying...', err?.message || err);
      }
    }

    if (!verified) {
      console.warn('Tx not found on chain after retries. Checking recipient balance as fallback...');
      try {
        const libUtils = require('../lib/tron/utils');
        const recipientBal = await libUtils.getAccountBalance(recipient);
        if ((recipientBal.usdt || 0) >= amount * 0.99) {
          verified = true;
          console.log('Fallback recipient balance check passed:', recipientBal.usdt);
        } else {
          console.error('Fallback check failed. Recipient balance:', recipientBal.usdt);
        }
      } catch (err) {
        console.error('Fallback balance check error:', err?.message || err);
      }
    }

    if (!verified) {
      console.error('Transaction not verifiable. Marking failed and refunding user.');
      await convex.mutation(anyApi.withdrawal.completeWithdrawal, { transactionId: txId, status: 'failed', error: 'Tx not confirmed' }).catch(()=>{});
      process.exit(7);
    }

    console.log('Tx verified. Finalizing Convex withdrawal...');
    await convex.mutation(anyApi.withdrawal.completeWithdrawal, { transactionId: txId, status: 'completed', transactionHash: txHash });

    console.log('Withdrawal completed successfully. txHash:', txHash);
    process.exit(0);

  } catch (err) {
    try {
      const util = require('util');
      console.error('Fatal error during withdrawal process (inspect):', util.inspect(err, { depth: 6, colors: false }));
    } catch (e) {
      console.error('Fatal error during withdrawal process:', err);
    }
    process.exit(10);
  }
}

main();
