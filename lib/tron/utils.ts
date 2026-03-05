// lib/tron/utils.ts
const TronWeb = require('tronweb');
import axios from 'axios';
import { ACTIVE_NETWORK, ACTIVE_USDT_CONTRACT } from './config';

// ─── TronWeb Factories ────────────────────────────────────────────────────────

export function getTronWeb() {
  const apiKey  = process.env.TRONGRID_API_KEY;
  const network = ACTIVE_NETWORK.fullHost;
  try {
    const tronWeb = new TronWeb({
      fullHost: network,
      headers: { 'TRON-PRO-API-KEY': apiKey || '' },
    });
    return tronWeb;
  } catch (e: any) {
    console.error(`❌ [TRONWEB] Init failed: ${e?.message}`);
    throw e;
  }
}

export function getTronWebWithKey(privateKey: string) {
  const apiKey  = process.env.TRONGRID_API_KEY;
  const network = ACTIVE_NETWORK.fullHost;
  console.log(`🔧 [TRONWEB_SIGNED] Network: ${network} | Key valid: ${isValidPrivateKey(privateKey)}`);
  try {
    const tronWeb = new TronWeb({
      fullHost:   network,
      privateKey: privateKey,
      headers:    { 'TRON-PRO-API-KEY': apiKey || '' },
    });
    console.log(`✅ [TRONWEB_SIGNED] Initialized`);
    return tronWeb;
  } catch (e: any) {
    console.error(`❌ [TRONWEB_SIGNED] Init failed: ${e?.message}`);
    throw e;
  }
}

// ─── Key / Address Utils ──────────────────────────────────────────────────────

export function isValidPrivateKey(privateKey: string): boolean {
  if (!privateKey) return false;
  return /^[0-9a-fA-F]{64}$/.test(privateKey.trim());
}

export function getAddressFromPrivateKey(privateKey: string): { address: string; valid: boolean } {
  try {
    if (!isValidPrivateKey(privateKey)) return { address: '', valid: false };
    const tronWeb = getTronWeb();
    const address = tronWeb.address.fromPrivateKey(privateKey);
    return { address, valid: !!address && tronWeb.isAddress(address) };
  } catch (e) {
    console.error('[CRYPTO] Error deriving address:', e);
    return { address: '', valid: false };
  }
}

export function isValidTronAddress(address: string): boolean {
  return getTronWeb().isAddress(address);
}

// ─── Address Generation ───────────────────────────────────────────────────────

/**
 * Generate a brand-new TRON address.
 * The returned privateKey MUST be saved to Convex immediately — it cannot be recovered.
 */
export async function generateTronAddress(): Promise<{
  address:    string;
  privateKey: string;
  hexAddress: string;
}> {
  const tronWeb = getTronWeb();
  const account = await tronWeb.createAccount();
  console.log(`[GENERATE] New address: ${account.address.base58}`);
  return {
    address:    account.address.base58,
    privateKey: account.privateKey,
    hexAddress: account.address.hex,
  };
}

// ─── Balance ──────────────────────────────────────────────────────────────────

export interface AccountBalance {
  address: string;
  trx:     number;
  usdt:    number;
}

/**
 * Get TRX and USDT balance for any address.
 * Tries three methods for USDT in case one fails.
 */
export async function getAccountBalance(address: string): Promise<AccountBalance> {
  const tronWeb = getTronWeb();

  if (!tronWeb.isAddress(address)) {
    throw new Error(`[BALANCE] Invalid address: ${address}`);
  }

  console.log(`🔍 [BALANCE] Checking: ${address}`);

  // ── TRX ──────────────────────────────────────────────────────────────────
  const trxSun      = await tronWeb.trx.getBalance(address);
  const trx         = parseFloat(tronWeb.fromSun(trxSun));
  console.log(`✅ [BALANCE] TRX: ${trx}`);

  // ── USDT ──────────────────────────────────────────────────────────────────
  let usdt = 0;

  // Method 1: contract().at()
  try {
    tronWeb.setAddress(address);
    const contract = await tronWeb.contract().at(ACTIVE_USDT_CONTRACT);
    const raw       = await contract.balanceOf(address).call();
    usdt            = parseInt(raw.toString()) / 1e6;
    console.log(`✅ [BALANCE] USDT (method 1): ${usdt}`);
    return { address, trx, usdt };
  } catch (e1: any) {
    console.warn(`⚠️ [BALANCE] Method 1 failed: ${e1?.message}`);
  }

  // Method 2: triggerConstantContract
  try {
    const addressHex    = tronWeb.address.toHex(address).substring(2);
    const paddedAddress = addressHex.padStart(64, '0');
    const result        = await tronWeb.transactionBuilder.triggerConstantContract(
      ACTIVE_USDT_CONTRACT,
      '70a08231',
      {},
      [{ type: 'address', value: address }],
      address
    );
    const constant_result = result?.constant_result?.[0] ?? result?.result?.result;
    if (constant_result) {
      usdt = Number(BigInt('0x' + String(constant_result).padStart(64, '0'))) / 1e6;
      console.log(`✅ [BALANCE] USDT (method 2): ${usdt}`);
      return { address, trx, usdt };
    }
    throw new Error('Empty constant_result');
  } catch (e2: any) {
    console.warn(`⚠️ [BALANCE] Method 2 failed: ${e2?.message}`);
  }

  // Method 3: TronGrid REST API
  try {
    const res = await axios.get(
      `${ACTIVE_NETWORK.fullHost}/v1/accounts/${address}`,
      { headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' } }
    );
    const trc20List: Array<Record<string, string>> = res.data?.data?.[0]?.trc20 ?? [];
    const usdtEntry = trc20List.find((t) => Object.keys(t)[0] === ACTIVE_USDT_CONTRACT);
    if (usdtEntry) {
      usdt = parseInt(Object.values(usdtEntry)[0]) / 1e6;
    }
    console.log(`✅ [BALANCE] USDT (method 3): ${usdt}`);
  } catch (e3: any) {
    console.warn(`⚠️ [BALANCE] Method 3 failed: ${e3?.message}`);
    usdt = 0;
  }

  return { address, trx, usdt };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function parseTRC20Transfer(transaction: any) {
  try {
    const contract = transaction.raw_data?.contract?.[0];
    if (!contract || contract.type !== 'TriggerSmartContract') return null;

    const parameter     = contract.parameter.value;
    const contractAddress = parameter.contract_address;

    // Normalise both to hex for comparison (TronGrid returns hex, ACTIVE_USDT_CONTRACT is base58)
    const tronWeb = getTronWeb();
    let activeHex = ACTIVE_USDT_CONTRACT;
    try {
      if (!ACTIVE_USDT_CONTRACT.startsWith('41')) {
        activeHex = tronWeb.address.toHex(ACTIVE_USDT_CONTRACT).toLowerCase();
      }
    } catch (_) {}

    const contractHex = (contractAddress ?? '').toLowerCase();
    if (contractHex !== activeHex.toLowerCase()) {
      return null;
    }

    const data = parameter.data;
    if (!data || !data.startsWith('a9059cbb')) return null;

    // a9059cbb + 64 chars (address) + 64 chars (amount)
    const recipientHex = '41' + data.slice(32, 72); // correct: slice(8+24, 8+24+40)
    const amountHex    = data.slice(72, 136);

    let recipient = '';
    let amount    = 0;
    try {
      recipient = tronWeb.address.fromHex(recipientHex);
      amount    = parseInt(amountHex, 16) / 1e6;
    } catch (e) {
      console.error('[PARSE] Address/amount conversion error:', e);
      return null;
    }

    return {
      contractAddress,
      from: tronWeb.address.fromHex(parameter.owner_address),
      to:   recipient,
      amount,
      tokenType: 'TRC20',
    };
  } catch (e) {
    console.error('[PARSE] parseTRC20Transfer error:', e);
    return null;
  }
}

export async function getNewTransactions(address: string, lastCheckTimestamp = 0) {
  const tronWeb = getTronWeb();
  try {
    console.log(`[DEPOSITS] Fetching txs for ${address} since ${lastCheckTimestamp ? new Date(lastCheckTimestamp).toISOString() : 'never'}`);

    const response = await axios.get(
      `${ACTIVE_NETWORK.fullHost}/v1/accounts/${address}/transactions`,
      {
        params:  { only_confirmed: true, limit: 50 },
        headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
      }
    );

    const all: any[] = response.data?.data ?? [];
    console.log(`[DEPOSITS] Total confirmed txs: ${all.length}`);

    const newer = all.filter((tx: any) => {
      const ts     = tx.raw_data?.timestamp ?? 0;
      const isNew  = ts > lastCheckTimestamp;
      if (!isNew && lastCheckTimestamp > 0) {
        console.log(`[DEPOSITS] Skipping old tx ${tx.txID?.substring(0, 10)}... (${new Date(ts).toISOString()})`);
      }
      return isNew;
    });

    console.log(`[DEPOSITS] New txs: ${newer.length}`);

    const parsed = newer
      .map((tx: any) => {
        const txHash    = tx.txID;
        const timestamp = tx.raw_data?.timestamp;
        const contract  = tx.raw_data?.contract?.[0];

        if (contract?.type === 'TransferContract') {
          const val = contract.parameter.value;
          return {
            txHash,
            timestamp,
            type:      'TRX',
            from:      tronWeb.address.fromHex(val.owner_address),
            to:        tronWeb.address.fromHex(val.to_address),
            amount:    tronWeb.fromSun(val.amount),
            confirmed: tx.ret?.[0]?.contractRet === 'SUCCESS',
          };
        }

        const trc20 = parseTRC20Transfer(tx);
        if (trc20) {
          console.log(`[DEPOSITS] TRC20: ${trc20.from} → ${trc20.to}: ${trc20.amount} USDT`);
          return {
            txHash,
            timestamp,
            type:      'TRC20',
            ...trc20,
            confirmed: tx.ret?.[0]?.contractRet === 'SUCCESS',
          };
        }

        return null;
      })
      .filter(Boolean);

    console.log(`[DEPOSITS] Parsed valid txs: ${parsed.length}`);
    return parsed;
  } catch (e: any) {
    console.error('❌ [DEPOSITS] Error:', e?.message);
    return [];
  }
}

// ─── Transfer USDT (hot wallet → recipient) ───────────────────────────────────

export async function transferUsdt(
  privateKey: string,
  toAddress:  string,
  amount:     number
): Promise<{ transactionId: string; success: boolean; error?: string }> {
  try {
    console.log(`[TRANSFER] ${amount} USDT → ${toAddress}`);

    const positiveAmount = Math.abs(amount);
    if (!isValidPrivateKey(privateKey)) throw new Error('Invalid private key format');

    const tronWeb = getTronWebWithKey(privateKey);
    const { address: fromAddress, valid } = getAddressFromPrivateKey(privateKey);
    if (!valid) throw new Error('Could not derive valid address from private key');

    if (!tronWeb.isAddress(toAddress))        throw new Error(`Invalid recipient: ${toAddress}`);
    if (!tronWeb.isAddress(ACTIVE_USDT_CONTRACT)) throw new Error(`Invalid contract: ${ACTIVE_USDT_CONTRACT}`);

    const balance = await getAccountBalance(fromAddress);
    if (balance.usdt < positiveAmount) throw new Error(`Insufficient USDT: have ${balance.usdt}, need ${positiveAmount}`);
    if (balance.trx  < 1)             throw new Error(`Insufficient TRX for gas: ${balance.trx}`);

    const contract     = await tronWeb.contract().at(ACTIVE_USDT_CONTRACT);
    const amountInBase = Math.floor(positiveAmount * 1e6);
    if (amountInBase <= 0) throw new Error(`Amount not positive: ${amountInBase}`);

    const tx = await contract.transfer(toAddress, amountInBase).send({ feeLimit: 50_000_000 });
    console.log(`[TRANSFER] ✅ txId: ${tx}`);

    return { transactionId: tx, success: true };
  } catch (e: any) {
    console.error('[TRANSFER] ❌', e?.message);
    return { transactionId: '', success: false, error: e?.message ?? 'Transfer failed' };
  }
}

export function toSun(trx: number):   number { return getTronWeb().toSun(trx); }
export function fromSun(sun: number): number { return getTronWeb().fromSun(sun); }