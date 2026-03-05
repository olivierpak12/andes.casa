#!/usr/bin/env node
// scripts/manual-sweep.js
// Usage: node scripts/manual-sweep.js <depositAddress> [--send]
// Dry-run by default; pass --send to actually perform the sweep (will use keystore).

// Load environment from .env.local when running from CLI
try {
  require('dotenv').config({ path: process.env.DOTENV_PATH || '.env.local' });
} catch (e) {
  // ignore if dotenv not installed
}

const TronWeb = require('tronweb');
const fs = require('fs');

const API_KEY = process.env.TRONGRID_API_KEY || '';
const TRON_HOST = (process.env.FORCE_TESTNET === 'true') ? 'https://nile.trongrid.io' : (process.env.TRONGRID_API_URL || 'https://nile.trongrid.io');
const USDT_CONTRACT = process.env.USDT_CONTRACT_ADDRESS || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const KEYSTORE = process.env.DEPOSIT_KEYSTORE_PATH || './keystore.json';
const HOT = process.env.MAIN_WALLET_ADDRESS;

async function getBalances(address) {
  const tronWeb = new TronWeb({ fullHost: TRON_HOST, headers: { 'TRON-PRO-API-KEY': API_KEY } });
  const trxSun = await tronWeb.trx.getBalance(address);
  const trx = tronWeb.fromSun(trxSun);
  let usdt = 0;
  try {
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const bal = await contract.balanceOf(address).call();
    usdt = Number(bal.toString()) / 1e6;
  } catch (e) {
    // ignore
  }
  return { trx: Number(trx), usdt };
}

async function attemptSweep(depositAddress, send) {
  console.log('Deposit address:', depositAddress);
  console.log('Hot wallet:', HOT);
  if (!HOT) throw new Error('MAIN_WALLET_ADDRESS not set');

  const balances = await getBalances(depositAddress);
  console.log('Balances:', balances);

  // check keystore
  let keys = null;
  try {
    const content = fs.readFileSync(KEYSTORE, 'utf8');
    keys = JSON.parse(content);
  } catch (e) {
    console.log('Keystore not found or not readable at', KEYSTORE);
  }

  const priv = keys ? keys[depositAddress] : null;
  if (!priv) {
    console.log('Private key for deposit address not found in keystore. Cannot sweep.');
    return;
  }

  if (!balances.usdt || balances.usdt <= 0) {
    console.log('No USDT to sweep.');
    return;
  }

  if (!send) {
    console.log('Dry run: found USDT', balances.usdt, 'but --send not provided. To perform sweep, re-run with --send');
    return;
  }

  // perform sweep
  const tronWeb = new TronWeb({ fullHost: TRON_HOST, privateKey: priv, headers: { 'TRON-PRO-API-KEY': API_KEY } });
  const contract = await tronWeb.contract().at(USDT_CONTRACT);
  const amountRaw = Math.floor(balances.usdt * 1e6);
  console.log('Sending', amountRaw, 'USDT (raw units) to', HOT);
  const res = await contract.transfer(HOT, amountRaw).send({ feeLimit: 100_000_000 });
  console.log('Sweep submitted:', res);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/manual-sweep.js <depositAddress> [--send]');
    process.exit(2);
  }
  const address = args[0];
  const send = args.includes('--send');
  try {
    await attemptSweep(address, send);
  } catch (e) {
    console.error('Sweep failed:', e?.message || e);
    process.exit(1);
  }
}

main();
