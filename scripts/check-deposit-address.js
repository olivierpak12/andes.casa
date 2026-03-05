#!/usr/bin/env node
// scripts/check-deposit-address.js
// Usage: node scripts/check-deposit-address.js <address>
// Shows TRX and USDT balances and whether a private key exists in the keystore.

// Load .env.local when running from CLI
try { require('dotenv').config({ path: process.env.DOTENV_PATH || '.env.local' }); } catch (e) {}
const TronWeb = require('tronweb');
const fs = require('fs');
const axios = require('axios');

const API_KEY = process.env.TRONGRID_API_KEY || '';
const TRON_HOST = (process.env.FORCE_TESTNET === 'true') ? 'https://nile.trongrid.io' : (process.env.TRONGRID_API_URL || 'https://nile.trongrid.io');
const USDT_CONTRACT = process.env.USDT_CONTRACT_ADDRESS || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const KEYSTORE = process.env.DEPOSIT_KEYSTORE_PATH || './keystore.json';

async function getAccount(address) {
  const tronWeb = new TronWeb({ fullHost: TRON_HOST, headers: { 'TRON-PRO-API-KEY': API_KEY } });
  try {
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
  } catch (e) {
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/check-deposit-address.js <address>');
    process.exit(2);
  }
  const address = args[0];
  console.log('Checking address:', address);

  try {
    const balances = await getAccount(address);
    console.log('TRX balance:', balances.trx);
    console.log('USDT balance:', balances.usdt);
  } catch (e) {
    console.error('Failed to fetch balances:', e?.message || e);
  }

  // check keystore
  try {
    const content = fs.readFileSync(KEYSTORE, 'utf8');
    const keys = JSON.parse(content);
    if (keys[address]) {
      console.log('✅ Private key for address found in keystore (keystore:', KEYSTORE, ')');
    } else {
      console.log('❌ Private key for address NOT found in keystore (keystore:', KEYSTORE, ')');
    }
  } catch (e) {
    console.log('Keystore not accessible at', KEYSTORE, ':', e?.message || e);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
