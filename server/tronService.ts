// server/tronService.ts
import { getTronWebWithKey, isValidPrivateKey } from '@/lib/tron/utils';
import { ACTIVE_USDT_CONTRACT, ACTIVE_NETWORK } from '@/lib/tron/config';

const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY!;
const MAIN_WALLET_ADDRESS     = process.env.MAIN_WALLET_ADDRESS!;
const TRX_FUND_AMOUNT         = Number(process.env.TRX_FUND_AMOUNT ?? '5');

if (!MAIN_WALLET_PRIVATE_KEY) {
  console.warn('⚠️  MAIN_WALLET_PRIVATE_KEY not set');
}

export interface SweepResult {
  txId:      string;
  amount:    number;
  rawAmount: number;
}

function extractTxId(result: unknown): string | null {
  if (typeof result === 'string' && result.length >= 60) return result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, any>;
    return r.txid ?? r.txID ?? r.hash ?? r.transaction?.txID ?? r.transaction?.txid ?? null;
  }
  return null;
}

export async function waitForConfirmation(tronWeb: any, txId: string, attempts = 30, delayMs = 2_000): Promise<any> {
  console.log(`[CONFIRM] Waiting for ${txId} (max ${attempts} × ${delayMs}ms)`);
  for (let i = 1; i <= attempts; i++) {
    try {
      const info = await tronWeb.trx.getTransactionInfo(txId);
      if (info?.blockNumber) {
        console.log(`[CONFIRM] ✅ Block ${info.blockNumber} (attempt ${i})`);
        return info;
      }
    } catch (_) {}
    console.log(`[CONFIRM] ${i}/${attempts} — pending`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`[CONFIRM] ${txId} not confirmed after ${attempts} attempts`);
}

export async function sendTrx(toAddress: string, amountTrx = TRX_FUND_AMOUNT, skipConfirmation = false): Promise<string> {
  console.log(`\n[TRX SEND] From: ${MAIN_WALLET_ADDRESS} → To: ${toAddress} | ${amountTrx} TRX`);
  if (!MAIN_WALLET_PRIVATE_KEY) throw new Error('[TRX SEND] MAIN_WALLET_PRIVATE_KEY not set');

  const tw  = getTronWebWithKey(MAIN_WALLET_PRIVATE_KEY);
  const sun = tw.toSun(amountTrx);

  let result: unknown;
  try {
    result = await tw.trx.sendTransaction(toAddress, sun);
  } catch (e: any) {
    console.error(`[TRX SEND] ❌ ${e?.message}`);
    throw e;
  }

  console.log(`[TRX SEND] Raw result:`, JSON.stringify(result, null, 2));
  const txId = extractTxId(result);
  if (!txId) throw new Error(`[TRX SEND] No txId in result: ${JSON.stringify(result)}`);
  console.log(`[TRX SEND] ✅ txId: ${txId}`);

  if (!skipConfirmation) {
    try { await waitForConfirmation(tw, txId); }
    catch (e: any) { console.warn(`[TRX SEND] ⚠️  Timeout: ${e?.message}`); }
  }
  return txId;
}

export async function sweepUsdtFromAddress(
  depositAddress:    string,
  hotWalletAddress:  string,
  depositPrivateKey: string
): Promise<SweepResult | null> {
  console.log(`\n[SWEEP] ${'─'.repeat(50)}`);
  console.log(`[SWEEP] From:    ${depositAddress}`);
  console.log(`[SWEEP] To:      ${hotWalletAddress}`);
  console.log(`[SWEEP] Network: ${ACTIVE_NETWORK.fullHost}`);
  console.log(`[SWEEP] USDT:    ${ACTIVE_USDT_CONTRACT}`);

  if (!ACTIVE_USDT_CONTRACT) throw new Error('[SWEEP] USDT_CONTRACT_ADDRESS not set');
  if (!depositAddress)       throw new Error('[SWEEP] depositAddress is empty');
  if (!hotWalletAddress)     throw new Error('[SWEEP] hotWalletAddress is empty');
  if (!depositPrivateKey)    throw new Error('[SWEEP] depositPrivateKey is empty');

  if (!isValidPrivateKey(depositPrivateKey)) {
    throw new Error(`[SWEEP] Invalid private key (length: ${depositPrivateKey?.length ?? 0})`);
  }

  const tw             = getTronWebWithKey(depositPrivateKey);
  const derivedAddress = tw.defaultAddress?.base58 ?? '';
  console.log(`[SWEEP] Key derives to: ${derivedAddress}`);

  if (!derivedAddress) throw new Error('[SWEEP] Could not derive address from key');
  if (derivedAddress.toLowerCase() !== depositAddress.toLowerCase()) {
    throw new Error(
      `[SWEEP] Key mismatch — key is for ${derivedAddress}, not ${depositAddress}. ` +
      `Wrong private key stored in Convex for this deposit address.`
    );
  }
  console.log(`[SWEEP] ✅ Key verified`);

  let contract: any;
  try {
    contract = await tw.contract().at(ACTIVE_USDT_CONTRACT);
    console.log(`[SWEEP] ✅ Contract loaded`);
  } catch (e: any) {
    throw new Error(`[SWEEP] Failed to load contract: ${e?.message ?? JSON.stringify(e)}`);
  }

  let rawBalance: any;
  try {
    rawBalance = await contract.balanceOf(depositAddress).call();
    console.log(`[SWEEP] Raw balance: ${rawBalance?.toString()}`);
  } catch (e: any) {
    throw new Error(`[SWEEP] balanceOf() failed: ${e?.message ?? JSON.stringify(e)}`);
  }

  const rawAmount  = Number(rawBalance.toString());
  const usdtAmount = rawAmount / 1e6;
  console.log(`[SWEEP] USDT balance: ${usdtAmount} (${rawAmount} base units)`);

  if (!rawAmount || rawAmount <= 0) {
    console.log(`[SWEEP] Nothing to sweep`);
    return null;
  }

  const MIN_GAS_SUN = 5_000_000;
  let trxSun = 0;
  try {
    trxSun = await tw.trx.getBalance(depositAddress);
    console.log(`[SWEEP] TRX: ${trxSun / 1e6}`);
  } catch (e: any) {
    console.warn(`[SWEEP] Cannot read TRX balance: ${e?.message}`);
  }

  if (trxSun < MIN_GAS_SUN) {
    const needed = MIN_GAS_SUN / 1e6;
    console.log(`[SWEEP] ⚡ Funding ${needed} TRX for gas...`);
    const fundTxId = await sendTrx(depositAddress, needed, false);
    console.log(`[SWEEP] ✅ Gas funded: ${fundTxId}`);
    await new Promise((r) => setTimeout(r, 3_000));
    try {
      const newSun = await tw.trx.getBalance(depositAddress);
      console.log(`[SWEEP] TRX after funding: ${newSun / 1e6}`);
    } catch (_) {}
  } else {
    console.log(`[SWEEP] ✅ Sufficient TRX`);
  }

  console.log(`[SWEEP] Calling transfer(${hotWalletAddress}, ${rawAmount})...`);
  let transferResult: unknown;
  try {
    transferResult = await contract.transfer(hotWalletAddress, rawAmount).send({ feeLimit: 150_000_000 });
    console.log(`[SWEEP] Raw result:`, JSON.stringify(transferResult, null, 2));
  } catch (e: any) {
    console.error(`[SWEEP] ❌ transfer failed:`);
    console.error(`  message:     ${e?.message}`);
    console.error(`  output:      ${JSON.stringify(e?.output)}`);
    console.error(`  transaction: ${JSON.stringify(e?.transaction)}`);
    console.error(`  full:`, JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
    throw e;
  }

  const txId = extractTxId(transferResult);
  if (!txId) throw new Error(`[SWEEP] No txId in result: ${JSON.stringify(transferResult)}`);
  console.log(`[SWEEP] txId: ${txId}`);

  try {
    await waitForConfirmation(tw, txId);
    console.log(`[SWEEP] ✅ Confirmed`);
  } catch (e: any) {
    console.warn(`[SWEEP] ⚠️  Timeout (tx submitted): ${e?.message}`);
  }

  console.log(`[SWEEP] ✅ Swept ${usdtAmount} USDT → ${hotWalletAddress}`);
  return { txId, amount: usdtAmount, rawAmount };
}

export default { waitForConfirmation, sendTrx, sweepUsdtFromAddress };