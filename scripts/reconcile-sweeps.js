#!/usr/bin/env node
// scripts/reconcile-sweeps.js
// Scan the hot wallet USDT transfer events and match them to users' deposit addresses.
// Run with --apply to create missing deposit records in Convex. Default is dry-run (preview only).

// Load environment from .env.local when running from CLI
try {
  require('dotenv').config({ path: process.env.DOTENV_PATH || '.env.local' });
} catch (e) {
  // ignore if dotenv not installed
}

const axios = require('axios');
const { ConvexHttpClient } = require('convex/browser');
const { api } = require('../convex/_generated/api');

const HOT = process.env.MAIN_WALLET_ADDRESS;
const API_KEY = process.env.TRONGRID_API_KEY || '';
const TRON_HOST = (process.env.FORCE_TESTNET === 'true') ? 'https://nile.trongrid.io' : (process.env.TRONGRID_API_URL || 'https://nile.trongrid.io');
const ACTIVE_USDT_CONTRACT = process.env.USDT_CONTRACT_ADDRESS || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!HOT) {
  console.error('MAIN_WALLET_ADDRESS not set. Set env MAIN_WALLET_ADDRESS to your hot wallet.');
  process.exit(2);
}
if (!CONVEX_URL) {
  console.error('NEXT_PUBLIC_CONVEX_URL not set. Set to your Convex endpoint to apply changes.');
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
// TronGrid enforces a relatively small per-request limit (usually <= 200).
// Use a conservative per-page limit and paginate when we need more history.
const LIMIT = 200;
const MAX_PAGES = 50; // safety cap => will fetch up to LIMIT * MAX_PAGES records

async function fetchContractEvents(contract, perPage = LIMIT) {
  const url = `${TRON_HOST}/v1/contracts/${contract}/events`;
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const start = page * perPage;
    try {
      console.log('DEBUG: GET', url, 'params=', { only_confirmed: true, limit: perPage, start }, 'API_KEY_SET=', Boolean(API_KEY));
      const res = await axios.get(url, {
        params: { only_confirmed: true, limit: perPage, start },
        headers: { 'TRON-PRO-API-KEY': API_KEY },
        timeout: 20000,
      });
      console.log('DEBUG: contract events response status=', res.status, 'dataKeys=', Object.keys(res.data || {}).slice(0,10));
      const pageData = res.data && Array.isArray(res.data.data) ? res.data.data : [];
      console.log('DEBUG: contract events page=', page, 'count=', pageData.length);
      out.push(...pageData);
      if (pageData.length < perPage) break; // last page
    } catch (e) {
      if (e.response) {
        try {
          console.error('Failed fetching contract events: status=', e.response.status, 'body=', JSON.stringify(e.response.data).slice(0,1000));
        } catch (__) {
          console.error('Failed fetching contract events: status=', e.response.status);
        }
      } else {
        console.error('Failed fetching contract events:', e?.message || e);
      }
      break;
    }
  }
  return out;
}

async function fetchAccountTxs(address, limit = 200) {
  const url = `${TRON_HOST}/v1/accounts/${address}/transactions`;
    const out = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const start = page * limit;
      try {
        console.log('DEBUG: GET', url, 'params=', { only_confirmed: true, limit, start }, 'API_KEY_SET=', Boolean(API_KEY));
        const res = await axios.get(url, {
          params: { only_confirmed: true, limit, start },
          headers: { 'TRON-PRO-API-KEY': API_KEY },
          timeout: 20000,
        });
        console.log('DEBUG: account txs response status=', res.status, 'dataKeys=', Object.keys(res.data || {}).slice(0,10));
        const pageData = res.data && Array.isArray(res.data.data) ? res.data.data : [];
        console.log('DEBUG: account txs page=', page, 'count=', pageData.length);
        out.push(...pageData);
        if (pageData.length < limit) break;
      } catch (e) {
        if (e.response) {
          try {
            console.error('Failed fetching account transactions: status=', e.response.status, 'body=', JSON.stringify(e.response.data).slice(0,1000));
          } catch (__) {
            console.error('Failed fetching account transactions: status=', e.response.status);
          }
        } else {
          console.error('Failed fetching account transactions:', e?.message || e);
        }
        break;
      }
  }
    return out;
}

async function fetchAccountTrc20(address, limit = LIMIT) {
  const url = `${TRON_HOST}/v1/accounts/${address}/transactions/trc20`;
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const start = page * limit;
    try {
      console.log('DEBUG: GET', url, 'params=', { only_confirmed: true, limit, start }, 'API_KEY_SET=', Boolean(API_KEY));
      const res = await axios.get(url, {
        params: { only_confirmed: true, limit, start },
        headers: { 'TRON-PRO-API-KEY': API_KEY },
        timeout: 20000,
      });
      console.log('DEBUG: trc20 account response status=', res.status, 'dataKeys=', Object.keys(res.data || {}).slice(0,10));
      const pageData = res.data && Array.isArray(res.data.data) ? res.data.data : [];
      console.log('DEBUG: trc20 account page=', page, 'count=', pageData.length);
      out.push(...pageData);
      if (pageData.length < limit) break;
    } catch (e) {
      if (e.response) {
        try {
          console.error('Failed fetching TRC20 txs for account: status=', e.response.status, 'body=', JSON.stringify(e.response.data).slice(0,1000));
        } catch (__) {
          console.error('Failed fetching TRC20 txs for account: status=', e.response.status);
        }
      } else {
        console.error('Failed fetching TRC20 txs for account:', e?.message || e);
      }
      break;
    }
  }
  return out;
}

function parseTRC20FromTx(tx) {
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
    return { txHash: tx.txID, from, to, amount, timestamp: tx.raw_data ? tx.raw_data.timestamp : Date.now() };
  } catch (e) {
    return null;
  }
}

function normalizeEventToTransfer(ev) {
  const result = ev.result || {};
  const from = (result.from || result._from || ev.from || '').toString();
  const to = (result.to || result._to || ev.to || '').toString();
  const value = result.value || result._value || ev.value || ev.amount || 0;
  const txHash = ev.transaction_id || ev.transactionHash || ev.transaction;
  const timestamp = ev.block_timestamp || ev.timestamp || Date.now();
  return { txHash, from, to, amount: Number(value) / 1e6, timestamp };
}

async function run() {
  console.log('Reconciling sweeps for hot wallet', HOT, APPLY ? '(APPLY MODE)' : '(DRY RUN)');

  // Fetch users and map depositAddress -> user
  let convex;
  if (CONVEX_URL) convex = new ConvexHttpClient(CONVEX_URL);

  let users = [];
  if (convex) {
    try {
      users = await convex.query(api.user.getAllUsersWithDepositAddresses, {});
    } catch (e) {
      console.error('Failed to fetch users from Convex:', e?.message || e);
      users = [];
    }
  }

  const addrToUser = {};
  for (const u of users) {
    const addr = (u.depositAddresses?.trc20 || '').toLowerCase().trim();
    if (addr) addrToUser[addr] = u;
  }

  console.log('Loaded', Object.keys(addrToUser).length, 'deposit addresses from Convex');

  const events = await fetchContractEvents(ACTIVE_USDT_CONTRACT, LIMIT);
  console.log('Fetched', events.length, 'contract events (limit', LIMIT, ')');

  let transfers = [];
  if (events && events.length > 0) {
    transfers = events.map(normalizeEventToTransfer).filter(t => t.to && t.from);
  } else {
    // Fall back: scan hot wallet transactions and parse TRC20 transfer calls
    console.log('No contract events found; falling back to scanning account transactions for TRC20 transfers');
    let txs = await fetchAccountTxs(HOT, LIMIT);
    console.log('Fetched', txs.length, 'account transactions (limit', LIMIT, ')');
    let parsed = txs.map(parseTRC20FromTx).filter(Boolean);
    if (parsed.length === 0) {
      // Try TRC20-specific endpoint as a fallback
      const trc20 = await fetchAccountTrc20(HOT, LIMIT);
      console.log('Fetched', trc20.length, 'TRC20 account transactions (limit', LIMIT, ')');
      parsed = (trc20 || []).map(ev => {
        const from = (ev.from || ev._from || ev.owner_address || '').toString();
        const to = (ev.to || ev._to || ev.to_address || '').toString();
        const value = ev.value || ev.amount || ev._value || 0;
        const txHash = ev.transaction_id || ev.txHash || ev.transactionHash || ev.transaction;
        const timestamp = ev.block_timestamp || ev.timestamp || Date.now();
        return { txHash, from, to, amount: Number(value) / 1e6, timestamp };
      }).filter(t => t.to && t.from);
    }
    transfers = parsed.map(p => ({ txHash: p.txHash, from: p.from, to: p.to, amount: p.amount, timestamp: p.timestamp }));
  }

  // Find transfers that went to HOT and originated from one of our deposit addresses
  const candidateSweeps = transfers.filter(t => t.to.toLowerCase() === HOT.toLowerCase() && addrToUser[t.from.toLowerCase()]);

  console.log('Found', candidateSweeps.length, 'sweep transfer(s) from known deposit addresses into hot wallet');

  if (candidateSweeps.length === 0) return;

  const missing = [];

  for (const t of candidateSweeps) {
    const user = addrToUser[t.from.toLowerCase()];
    // Check if already recorded
    let existing = null;
    try {
      if (convex) existing = await convex.query(api.deposit.getDepositByHash, { txHash: t.txHash });
    } catch (e) {
      console.error('Convex check failed for', t.txHash, e?.message || e);
    }

    if (existing) {
      // already recorded
      continue;
    }

    missing.push({ tx: t, user });
  }

  console.log('Missing deposit records to create:', missing.length);
  for (const m of missing) {
    console.log(`- ${m.tx.txHash} | from ${m.tx.from} | user ${m.user.contact} | amount ${m.tx.amount} USDT`);
  }

  if (APPLY && missing.length > 0) {
    if (!convex) {
      console.error('Cannot apply: Convex client not configured (NEXT_PUBLIC_CONVEX_URL missing)');
      return;
    }

    for (const m of missing) {
      try {
        const depositId = await convex.mutation(api.deposit.recordDeposit, {
          userId: m.user._id,
          network: 'trc20',
          amount: m.tx.amount,
          walletAddress: m.user.depositAddresses.trc20,
          transactionHash: m.tx.txHash,
        });

        await convex.mutation(api.deposit.updateDepositStatus, { transactionHash: m.tx.txHash, status: 'completed' });

        console.log(`Created deposit ${depositId} for user ${m.user.contact} — ${m.tx.amount} USDT (${m.tx.txHash})`);
      } catch (e) {
        console.error('Failed to create deposit for', m.user.contact, e?.message || e);
      }
    }
  } else if (!APPLY) {
    console.log('Dry run complete. Rerun with --apply to create these deposit records.');
  }
}

run().catch(e => { console.error('Reconcile failed:', e?.message || e); process.exit(1); });
