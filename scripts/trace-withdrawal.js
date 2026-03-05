#!/usr/bin/env node
// Simple tracer for Tron/TRC20 USDT withdrawals using TronGrid
// Usage examples:
//   node scripts/trace-withdrawal.js --tx <txid>
//   node scripts/trace-withdrawal.js --to TG... --amount 100
//   node scripts/trace-withdrawal.js --from TG... --amount 100

const TRON_GRID_URL = process.env.TRONGRID_API_URL || 'https://nile.trongrid.io';
const TRON_GRID_KEY = process.env.TRONGRID_API_KEY || '';
const DEFAULT_CONTRACT = process.env.ACTIVE_USDT_CONTRACT || '';

// Simple arg parser (no external dependencies)
const args = {};
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    const key = process.argv[i].slice(2);
    const val = process.argv[i + 1]?.startsWith('--') ? true : process.argv[i + 1];
    args[key] = val;
    if (!val?.startsWith('--')) i++;
  }
}

function pretty(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

async function fetchTx(txid) {
  const res = await fetch(`${TRON_GRID_URL}/v1/transactions/${txid}`, {
    headers: { 'TRON-PRO-API-KEY': TRON_GRID_KEY },
  });
  return res.ok ? res.json() : { error: `HTTP ${res.status}` };
}

async function fetchContractEvents(contract, limit = 200) {
  const url = `${TRON_GRID_URL}/v1/contracts/${contract}/events?limit=${limit}&event_name=Transfer&event_name_oneof=true`;
  const res = await fetch(url, { headers: { 'TRON-PRO-API-KEY': TRON_GRID_KEY } });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  return res.json();
}

async function main() {
  if (args.tx) {
    const r = await fetchTx(args.tx);
    pretty(r);
    return;
  }

  const contract = args.contract || DEFAULT_CONTRACT;
  if (!contract) {
    console.error('Specify --contract or set ACTIVE_USDT_CONTRACT in env');
    process.exit(1);
  }

  const r = await fetchContractEvents(contract, args.limit || 200);
  if (r.error) {
    console.error('Error fetching events:', r.error);
    process.exit(1);
  }

  const events = r.data || [];

  const to = args.to;
  const from = args.from;
  const amount = args.amount ? Number(args.amount) : null; // USDT

  const filtered = events.filter((e) => {
    try {
      const evtTo = e.result?.to?.address || e.to?.address || (e.topic_map && e.topic_map.to);
      const evtFrom = e.result?.from?.address || e.from?.address || (e.topic_map && e.topic_map.from);
      const rawAmount = e.result?.value || e.value || e.amount || e.result?.amount || e.result?._value;

      if (to && evtTo !== to) return false;
      if (from && evtFrom !== from) return false;
      if (amount && rawAmount) {
        // rawAmount may be a string in smallest unit
        const rawNum = Number(rawAmount);
        if (Number.isNaN(rawNum)) return false;
        const human = rawNum / 1_000_000; // USDT has 6 decimals
        if (Math.abs(human - amount) > 0.0001) return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  });

  pretty({ totalEvents: events.length, matched: filtered.length, results: filtered.slice(0, args.limit || 50) });
}

main().catch((e) => { console.error(e); process.exit(2); });
