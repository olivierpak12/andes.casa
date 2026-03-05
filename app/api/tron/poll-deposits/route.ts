// app/api/tron/poll-deposits/route.ts
// Called by a cron job every minute to check ALL users for new deposits.

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { getAccountBalance, getNewTransactions } from '@/lib/tron/utils';
import { sendTrx, sweepUsdtFromAddress } from '@/server/tronService';
import { MIN_DEPOSIT } from '@/lib/tron/config';

const convex      = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key';
const MIN_SWEEP   = 1; // USDT — skip dust
const SWEEP_DELAY = 8_000; // ms to wait after gas funding

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fundAndSweep(
  depositAddress:    string,
  hotWalletAddress:  string,
  depositPrivateKey: string,
  trxBalance:        number,
  usdtBalance:       number
): Promise<{ txId: string; amount: number } | null> {
  if (usdtBalance < MIN_SWEEP) return null;

  if (trxBalance < 5) {
    console.log(`  ⚡ [SWEEP] Low TRX (${trxBalance}). Funding 5 TRX...`);
    try {
      const fundTx = await sendTrx(depositAddress, 5);
      console.log(`  ✅ [SWEEP] Gas funded: ${fundTx}`);
      await new Promise((r) => setTimeout(r, SWEEP_DELAY));
    } catch (e: any) {
      console.error(`  ❌ [SWEEP] Gas funding failed: ${e?.message}`);
    }
  }

  try {
    // ✅ Pass depositPrivateKey from Convex — no keystore file
    const res = await sweepUsdtFromAddress(depositAddress, hotWalletAddress, depositPrivateKey);
    if (res?.txId) {
      console.log(`  ✅ [SWEEP] ${res.amount} USDT → ${hotWalletAddress} | txId: ${res.txId}`);
      return res;
    }
    return null;
  } catch (e: any) {
    console.error(`  ❌ [SWEEP] Failed: ${e?.message}`);
    return null;
  }
}

async function recordDeposit(params: {
  userId:          string;
  depositAddress:  string;
  txHash:          string;
  amount:          number;
}): Promise<boolean> {
  try {
    // Idempotency — skip if already recorded
    const existing = await convex.query(api.deposit.getDepositByHash, { txHash: params.txHash }).catch(() => null);
    if (existing) {
      console.log(`  ⏭️  Already recorded: ${params.txHash}`);
      return false;
    }

    const depositId = await convex.mutation(api.deposit.recordDeposit, {
      userId:          params.userId as any,
      network:         'trc20',
      amount:          params.amount,
      walletAddress:   params.depositAddress,
      transactionHash: params.txHash,
    });

    await convex.mutation(api.deposit.updateDepositStatus, {
      transactionHash: params.txHash,
      status:          'completed',
    });

    console.log(`  ✅ Recorded $${params.amount} USDT | ${params.txHash}`);
    return true;
  } catch (e: any) {
    console.error(`  ❌ Failed to record ${params.txHash}: ${e?.message}`);
    return false;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('\n🔄 Starting deposit poll...');
    const pollStarted = Date.now();

    const users = await convex.query(api.user.getAllUsersWithDepositAddresses, {});
    console.log(`👥 ${users.length} users to check`);

    const hotWalletAddress = process.env.MAIN_WALLET_ADDRESS;
    let totalFound     = 0;
    let totalProcessed = 0;
    const results: any[] = [];

    for (const user of users) {
      const depositAddress   = user.depositAddresses?.trc20;
      // ✅ Private key from Convex — not from keystore file
      const depositPrivateKey = user.depositPrivateKeys?.trc20;

      if (!depositAddress) continue;

      const canSweep = !!(depositPrivateKey && hotWalletAddress);

      if (!depositPrivateKey) {
        console.log(`  ⚠️  ${user.contact}: no private key stored — sweep disabled for this address`);
      }

      try {
        console.log(`\n📍 ${user.contact} — ${depositAddress}`);

        const lastCheck = user.lastDepositCheck ?? 0;
        let latestTimestamp = lastCheck;

        // ── Fetch on-chain data ──────────────────────────────────────────
        const [balance, newTransactions] = await Promise.all([
          getAccountBalance(depositAddress),
          getNewTransactions(depositAddress, lastCheck),
        ]);

        console.log(`  💰 Balance: TRX ${balance.trx} | USDT ${balance.usdt}`);
        console.log(`  📊 New txs: ${newTransactions.length}`);

        totalFound += newTransactions.length;

        // ── Process each new inbound tx ──────────────────────────────────
        for (const tx of newTransactions) {
          if ((tx?.to ?? '').toLowerCase() !== depositAddress.toLowerCase()) continue;
          if (!tx?.confirmed) { console.log(`  ⏳ Unconfirmed: ${tx?.txHash}`); continue; }
          if (hotWalletAddress && tx?.from === hotWalletAddress) { console.log(`  ⏭️  Own funding tx`); continue; }

          const amount = Number(tx?.amount);
          const minDeposit = tx?.type === 'TRX' ? MIN_DEPOSIT.TRX : MIN_DEPOSIT.USDT;

          if (amount < minDeposit) {
            console.log(`  ⚠️  Too small: ${amount} ${tx?.type} (min ${minDeposit})`);
            continue;
          }

          let recordedHash   = tx?.txHash;
          let recordedAmount = amount;

          // Auto-sweep USDT to hot wallet
          if (tx?.type === 'TRC20' && canSweep && hotWalletAddress && depositPrivateKey) {
            const sweep = await fundAndSweep(
              depositAddress,
              hotWalletAddress,
              depositPrivateKey,
              balance.trx,
              balance.usdt
            );
            if (sweep) {
              recordedHash   = sweep.txId;
              recordedAmount = sweep.amount;
            }
          }

          const recorded = await recordDeposit({
            userId:         user._id,
            depositAddress,
            txHash:         recordedHash,
            amount:         recordedAmount,
          });

          if (recorded) {
            totalProcessed++;
            results.push({
              user:    user.contact,
              address: depositAddress,
              txHash:  recordedHash,
              amount:  recordedAmount,
              type:    tx?.type,
              status:  'processed',
            });
          }

          if (tx?.timestamp > latestTimestamp) latestTimestamp = tx?.timestamp;
        }

        // ── Fallback sweep: USDT on-chain but no new txs detected ────────
        if (
          newTransactions.length === 0 &&
          balance.usdt >= MIN_SWEEP &&
          canSweep &&
          hotWalletAddress &&
          depositPrivateKey
        ) {
          console.log(`  🔍 [FALLBACK] ${balance.usdt} USDT idle on address — attempting sweep`);

          const sweep = await fundAndSweep(
            depositAddress,
            hotWalletAddress,
            depositPrivateKey,
            balance.trx,
            balance.usdt
          );

          if (sweep) {
            const recorded = await recordDeposit({
              userId:         user._id,
              depositAddress,
              txHash:         sweep.txId,
              amount:         sweep.amount,
            });

            if (recorded) {
              totalProcessed++;
              results.push({
                user:    user.contact,
                address: depositAddress,
                txHash:  sweep.txId,
                amount:  sweep.amount,
                type:    'TRC20',
                status:  'processed_fallback_sweep',
              });
            }
          }
        }

        // ── Advance lastCheck ────────────────────────────────────────────
        const newTimestamp = Math.max(latestTimestamp, pollStarted);
        await convex.mutation(api.deposit.updateLastDepositCheck, {
          userId:    user._id,
          timestamp: newTimestamp,
        });
        console.log(`  🕐 lastCheck → ${new Date(newTimestamp).toISOString()}`);

      } catch (e: any) {
        console.error(`❌ Error for ${user.contact}: ${e?.message}`);
        results.push({ user: user.contact, status: 'error', error: e?.message });
      }
    }

    console.log(`\n✨ Poll complete — found: ${totalFound}, processed: ${totalProcessed}\n`);

    return NextResponse.json({
      success:           true,
      usersChecked:      users.length,
      depositsFound:     totalFound,
      depositsProcessed: totalProcessed,
      results,
      timestamp:         Date.now(),
    });

  } catch (e: any) {
    console.error('❌ Poll service error:', e?.message);
    return NextResponse.json(
      { success: false, error: 'Polling failed', details: process.env.NODE_ENV === 'development' ? e?.message : undefined },
      { status: 500 }
    );
  }
}