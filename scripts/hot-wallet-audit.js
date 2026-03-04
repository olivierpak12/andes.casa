#!/usr/bin/env node
// scripts/hot-wallet-audit.js
// Summarize TRC20 (USDT) incoming transfers to the configured hot wallet.

const axios = require('axios');
// Load .env.local when running from CLI
try { require('dotenv').config({ path: process.env.DOTENV_PATH || '.env.local' }); } catch (e) {}
// Avoid importing TypeScript files from node. Use environment variables with sensible defaults.
const HOT = process.env.MAIN_WALLET_ADDRESS || process.env.HOT_WALLET_ADDRESS;
const API_KEY = process.env.TRONGRID_API_KEY || '';
const TRON_HOST = (process.env.FORCE_TESTNET === 'true') ? 'https://nile.trongrid.io' : (process.env.TRONGRID_API_URL || 'https://nile.trongrid.io');
const ACTIVE_USDT_CONTRACT = process.env.USDT_CONTRACT_ADDRESS || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

if (!HOT) {
  console.error('HOT wallet address not set. Set MAIN_WALLET_ADDRESS env var.');
  process.exit(2);
}

async function fetchTxs(address, limit = 200) {
  const url = `${TRON_HOST}/v1/accounts/${address}/transactions`;
  const res = await axios.get(url, {
    params: { only_confirmed: true, limit },
    headers: { 'TRON-PRO-API-KEY': API_KEY },
    timeout: 15000,
  });
  return res.data.data || [];
}

async function fetchContractEvents(contract, address, limit = 200) {
  // Try event endpoint to find TRC20 transfers involving the hot wallet
  const url = `${TRON_HOST}/v1/contracts/${contract}/events`;
  try {
    const res = await axios.get(url, {
      params: { only_confirmed: true, limit, relatedAddress: address },
      headers: { 'TRON-PRO-API-KEY': API_KEY },
      timeout: 15000,
    });
    return res.data.data || [];
  } catch (e) {
    // Some TronGrid instances may not support relatedAddress filter; return empty and let caller decide
    try {
      const res = await axios.get(url, {
        params: { only_confirmed: true, limit },
        headers: { 'TRON-PRO-API-KEY': API_KEY },
        timeout: 15000,
      });
      return (res.data.data || []).filter((ev) => {
        return (ev.result && (String(ev.result.to).toLowerCase() === address.toLowerCase() || String(ev.result._to).toLowerCase() === address.toLowerCase()));
      });
    } catch (e2) {
      return [];
    }
  }
}

function parseTRC20(tx) {
  try {
    const contract = tx.raw_data.contract[0];
    if (contract.type !== 'TriggerSmartContract') return null;
    const param = contract.parameter.value;
    if (!param.contract_address) return null;
    if (param.contract_address.toLowerCase() !== ACTIVE_USDT_CONTRACT.toLowerCase()) return null;
    const data = param.data;
    if (!data || !data.startsWith('a9059cbb')) return null;
    const recipientHex = '41' + data.slice(8, 72);
    const amountHex = data.slice(72, 136);
    const TronWeb = require('tronweb');
    const tronWeb = new TronWeb({ fullHost: TRON_HOST, headers: { 'TRON-PRO-API-KEY': API_KEY } });
    const to = tronWeb.address.fromHex(recipientHex);
    const from = tronWeb.address.fromHex(param.owner_address);
    const amount = parseInt(amountHex, 16) / 1e6;
    return { txHash: tx.txID, from, to, amount, timestamp: tx.raw_data.timestamp };
  } catch (e) {
    return null;
  }
}

async function audit() {
  console.log('Hot wallet audit for', HOT);
  const txs = await fetchTxs(HOT, 200);
  console.log('Fetched', txs.length, 'transactions (latest)');

  const incoming = [];
  for (const tx of txs) {
    const parsed = parseTRC20(tx);
    if (parsed && parsed.to.toLowerCase() === HOT.toLowerCase()) {
      incoming.push(parsed);
    }
  }

  // Also check contract events for transfer logs involving the hot wallet
  try {
    const events = await fetchContractEvents(ACTIVE_USDT_CONTRACT, HOT, 200);
    console.log('Fetched', events.length, 'contract events (filtered)');
    for (const ev of events) {
      // try to normalize event structure
      const result = ev.result || ev && ev.contract_result && ev.contract_result[0] || {};
      // Some event shapes include topics/data; attempt to parse known transfer shape
      const from = (result.from || result._from || ev.from || '').toString();
      const to = (result.to || result._to || ev.to || '').toString();
      const value = result.value || result._value || ev.value || ev.amount || 0;
      if (to && to.toLowerCase() === HOT.toLowerCase()) {
        const amount = Number(value) / 1e6;
        incoming.push({ txHash: ev.transaction_id || ev.transactionHash || ev.transaction, from, to, amount, timestamp: ev.block_timestamp || ev.timestamp || Date.now() });
      }
    }
  } catch (e) {
    console.error('Contract events fetch failed:', e?.message || e);
  }

  // Also fetch balance directly from contract via TronWeb
  try {
    const TronWeb = require('tronweb');
    const tronWeb = new TronWeb({ fullHost: TRON_HOST, headers: { 'TRON-PRO-API-KEY': API_KEY } });
    // Ensure owner_address is set for RPC calls
    try {
      tronWeb.setAddress(HOT);
    } catch (setErr) {
      // ignore if setAddress not available
    }
    const contract = await tronWeb.contract().at(ACTIVE_USDT_CONTRACT);
    // Some TronGrid nodes require owner_address in triggerConstantContract; setting TronWeb address helps.
    const balanceRaw = await contract.balanceOf(HOT).call();
    const balanceOnChain = Number(balanceRaw.toString()) / 1e6;
    console.log('Contract.balanceOf(', HOT, ') =', balanceOnChain, 'USDT');
  } catch (e) {
    console.error('Direct contract balanceOf failed:', e?.message || String(e));
  }

  const total = incoming.reduce((s, t) => s + t.amount, 0);
  console.log(`Total incoming TRC20 (USDT) to ${HOT}: ${total} USDT across ${incoming.length} tx(s)`);

  if (incoming.length) {
    console.log('\nRecent incoming transfers:');
    for (const t of incoming.slice(0, 20)) {
      console.log(`- ${t.txHash} | from ${t.from} | +${t.amount} USDT | ${new Date(t.timestamp).toISOString()}`);
    }
  }

  console.log('\nAudit complete');
}

audit().catch((e) => {
  console.error('Audit failed:', e?.message || e);
  process.exit(1);
});
