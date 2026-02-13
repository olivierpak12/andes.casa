// lib/tron/utils.ts

const TronWeb = require('tronweb');
import { ACTIVE_NETWORK, ACTIVE_USDT_CONTRACT, MIN_DEPOSIT } from './config';

// Initialize TronWeb instance
export function getTronWeb() {
  return new TronWeb({
    fullHost: ACTIVE_NETWORK.fullHost,
    headers: { 
      'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' 
    },
  });
}

/**
 * Generate a new TRON address
 * Returns: { address: string, privateKey: string, hexAddress: string }
 */
export async function generateTronAddress() {
  const tronWeb = getTronWeb();
  const account = await tronWeb.createAccount();
  
  return {
    address: account.address.base58, // Base58 format (starts with T)
    privateKey: account.privateKey,   // IMPORTANT: Store securely!
    hexAddress: account.address.hex,  // Hex format
  };
}

/**
 * Validate a TRON address
 */
export function isValidTronAddress(address: string): boolean {
  const tronWeb = getTronWeb();
  return tronWeb.isAddress(address);
}

/**
 * Get account balance (TRX and USDT)
 */
export async function getAccountBalance(address: string) {
  const tronWeb = getTronWeb();
  
  try {
    // Get TRX balance
    const trxBalance = await tronWeb.trx.getBalance(address);
    const trxBalanceInTRX = tronWeb.fromSun(trxBalance);
    
    // Get USDT balance
    let usdtBalance = 0;
    try {
      const contract = await tronWeb.contract().at(ACTIVE_USDT_CONTRACT);
      const balance = await contract.balanceOf(address).call();
      usdtBalance = parseInt(balance.toString()) / 1e6; // USDT has 6 decimals
    } catch (error) {
      console.log('USDT balance fetch failed (might be zero):', error);
    }
    
    return {
      trx: parseFloat(trxBalanceInTRX),
      usdt: usdtBalance,
      address,
    };
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw error;
  }
}

/**
 * Get transactions for an address
 * @param address - TRON address
 * @param limit - Number of transactions to fetch
 */
export async function getTransactions(address: string, limit: number = 50) {
  const tronWeb = getTronWeb();
  
  try {
    const transactions = await tronWeb.trx.getTransactionsRelated(
      address,
      'all',
      limit
    );
    
    return transactions;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Get transaction details by hash
 */
export async function getTransactionInfo(txHash: string) {
  const tronWeb = getTronWeb();
  
  try {
    const txInfo = await tronWeb.trx.getTransactionInfo(txHash);
    return txInfo;
  } catch (error) {
    console.error('Error fetching transaction info:', error);
    throw error;
  }
}

/**
 * Check if transaction is confirmed
 */
export async function isTransactionConfirmed(txHash: string): Promise<boolean> {
  try {
    const txInfo = await getTransactionInfo(txHash);
    return txInfo && txInfo.blockNumber !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Parse TRC20 transfer from transaction
 * Returns null if not a TRC20 transfer
 */
export function parseTRC20Transfer(transaction: any) {
  try {
    if (!transaction.raw_data?.contract?.[0]) {
      return null;
    }
    
    const contract = transaction.raw_data.contract[0];
    
    // Check if it's a TriggerSmartContract (TRC20 transfer)
    if (contract.type !== 'TriggerSmartContract') {
      return null;
    }
    
    const parameter = contract.parameter.value;
    const contractAddress = parameter.contract_address;
    
    // Decode the data field to get transfer details
    const data = parameter.data;
    
    // TRC20 transfer method signature: a9059cbb (first 8 chars)
    if (!data || !data.startsWith('a9059cbb')) {
      return null;
    }
    
    // Parse recipient and amount from data
    // Data format: a9059cbb + 64 chars (address) + 64 chars (amount)
    const recipientHex = '41' + data.slice(32, 72); // Add 41 prefix for TRON
    const amountHex = data.slice(72);
    
    const tronWeb = getTronWeb();
    const recipient = tronWeb.address.fromHex(recipientHex);
    const amount = parseInt(amountHex, 16);
    
    return {
      contractAddress,
      from: tronWeb.address.fromHex(parameter.owner_address),
      to: recipient,
      amount: amount / 1e6, // USDT has 6 decimals
      tokenType: 'TRC20',
    };
  } catch (error) {
    console.error('Error parsing TRC20 transfer:', error);
    return null;
  }
}

/**
 * Monitor address for new transactions
 * Returns recent transactions since lastCheckTimestamp
 */
export async function getNewTransactions(
  address: string,
  lastCheckTimestamp: number = 0
) {
  const tronWeb = getTronWeb();
  
  try {
    // Get recent transactions
    const transactions = await tronWeb.trx.getTransactionsRelated(
      address,
      'all',
      50
    );
    
    // Filter transactions newer than lastCheckTimestamp
    const newTransactions = transactions.filter((tx: any) => {
      return tx.raw_data.timestamp > lastCheckTimestamp;
    });
    
    // Parse each transaction
    const parsedTransactions = newTransactions.map((tx: any) => {
      const txHash = tx.txID;
      const timestamp = tx.raw_data.timestamp;
      
      // Check if it's a TRX transfer
      const contract = tx.raw_data.contract[0];
      
      if (contract.type === 'TransferContract') {
        const value = contract.parameter.value;
        return {
          txHash,
          timestamp,
          type: 'TRX',
          from: tronWeb.address.fromHex(value.owner_address),
          to: tronWeb.address.fromHex(value.to_address),
          amount: tronWeb.fromSun(value.amount),
          confirmed: tx.ret?.[0]?.contractRet === 'SUCCESS',
        };
      }
      
      // Check if it's a TRC20 transfer
      const trc20Transfer = parseTRC20Transfer(tx);
      if (trc20Transfer) {
        return {
          txHash,
          timestamp,
          type: 'TRC20',
          ...trc20Transfer,
          confirmed: tx.ret?.[0]?.contractRet === 'SUCCESS',
        };
      }
      
      return null;
    }).filter((tx: any) => tx !== null);
    
    return parsedTransactions;
  } catch (error) {
    console.error('Error monitoring address:', error);
    throw error;
  }
}

/**
 * Convert TRX amount to SUN (smallest unit)
 */
export function toSun(trx: number): number {
  const tronWeb = getTronWeb();
  return tronWeb.toSun(trx);
}

/**
 * Convert SUN to TRX
 */
export function fromSun(sun: number): number {
  const tronWeb = getTronWeb();
  return tronWeb.fromSun(sun);
}