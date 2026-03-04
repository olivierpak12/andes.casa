#!/usr/bin/env node
// Dry-run withdrawal simulator
// Usage examples:
// node scripts/dry-run-withdrawal.js --userId user123 --balance 100 --locked 10 --amount 20 --address TRah... --network trc20

// Simple CLI arg parser (no external dependencies)
function parseArgs() {
  const raw = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < raw.length; i++) {
    const token = raw[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = raw[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

const args = parseArgs();

function printUsageAndExit() {
  console.log('Usage: node scripts/dry-run-withdrawal.js --userId <id> --balance <number> --locked <number> --amount <number> --address <addr> --network <trc20|erc20|polygon|bep20>');
  process.exit(1);
}

if (!args.userId || typeof args.amount === 'undefined' || typeof args.balance === 'undefined') {
  printUsageAndExit();
}

const userId = String(args.userId);
const balance = Number(args.balance) || 0;
const locked = Number(args.locked) || 0;
const amount = Number(args.amount) || 0;
const address = String(args.address || '');
const network = String(args.network || 'trc20');

const MIN_WITHDRAWAL = { polygon: 2, erc20: 20, trc20: 100, bep20: 2 };

console.log('\n--- DRY RUN: Withdrawal Simulation ---');
console.log(`User: ${userId}`);
console.log(`Balance: ${balance} USDT`);
console.log(`Locked (invested): ${locked} USDT`);
console.log(`Requested amount: ${amount} USDT`);
console.log(`Network: ${network}`);
console.log(`Recipient address: ${address}\n`);

// Validate minimum
const min = MIN_WITHDRAWAL[network] || 0;
if (amount < min) {
  console.error(`❌ Rejected: amount ${amount} < minimum ${min} for ${network}`);
  process.exit(2);
}

// Check withdrawable
const withdrawable = balance - locked;
console.log(`Withdrawable available: ${withdrawable} USDT`);
if (withdrawable < amount) {
  console.error(`❌ Rejected: insufficient withdrawable balance (available ${withdrawable}, requested ${amount})`);
  process.exit(3);
}

console.log('✅ Validation passed — creating PENDING transaction (no DB change in dry-run)');

// Simulate transaction creation
const txId = `dry_tx_${Math.random().toString(36).slice(2,12)}`;
const now = Date.now();
const transaction = {
  id: txId,
  userId,
  type: 'withdrawal',
  amount,
  network,
  walletAddress: address,
  status: 'pending',
  createdAt: now,
  updatedAt: now,
};

console.log('Pending transaction (simulated):', transaction);

// Simulate blockchain send (DRY RUN — do NOT broadcast)
console.log('\n--- Simulating blockchain transfer (dry run, not broadcasting) ---');
console.log(`Preparing to send ${amount} USDT (${network}) to ${address} from hot wallet (mock)`);

// Create a mock tx hash and verification steps
const mockedTxHash = `MOCKTX${Math.random().toString(16).slice(2,14)}`;
console.log(`Simulated send succeeded locally (mock). Generated mock txHash: ${mockedTxHash}`);

// Simulate verification attempts
console.log('Verifying mock tx on chain (simulated):');
for (let i = 1; i <= 3; i++) {
  console.log(`  verify attempt ${i}: checking explorer... (simulated success)`);
}
console.log('✅ Mock verification succeeded');

// Simulate completing the withdrawal: deduct balance
const newBalance = balance - amount;
console.log('\n--- Applying completion changes (simulated) ---');
console.log(`Balance before: ${balance}`);
console.log(`Deducting amount: ${amount}`);
console.log(`Balance after: ${newBalance}`);

const completedTransaction = Object.assign({}, transaction, {
  status: 'completed',
  transactionHash: mockedTxHash,
  updatedAt: Date.now(),
});

console.log('Completed transaction (simulated):', completedTransaction);

console.log('\nDRY RUN complete — no network broadcast or DB writes performed.');
console.log('If you want me to perform a real transfer, respond with explicit confirmation and provide the recipient address and amount.');

process.exit(0);
