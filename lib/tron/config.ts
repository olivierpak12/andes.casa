// lib/tron/config.ts

export const TRON_CONFIG = {
  // Nile Testnet Configuration
  NILE: {
    fullHost: 'https://nile.trongrid.io',
    network: 'nile',
    explorer: 'https://nile.tronscan.org',
    faucet: 'https://nileex.io/join/getJoinPage',
  },
  
  // Mainnet Configuration (for production)
  MAINNET: {
    fullHost: 'https://api.trongrid.io',
    network: 'mainnet',
    explorer: 'https://tronscan.org',
  },
} as const;

// Use Nile for development, Mainnet for production
export const ACTIVE_NETWORK = 
  process.env.NODE_ENV === 'production' ? TRON_CONFIG.MAINNET : TRON_CONFIG.NILE;

// TRC20 USDT Contract Addresses
export const USDT_CONTRACT = {
  NILE: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj', // Nile Testnet USDT
  MAINNET: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // Mainnet USDT
};

export const ACTIVE_USDT_CONTRACT = 
  process.env.NODE_ENV === 'production' ? USDT_CONTRACT.MAINNET : USDT_CONTRACT.NILE;

// Minimum deposit amounts (in USDT, with 6 decimals)
export const MIN_DEPOSIT = {
  TRX: 100, // 100 TRX minimum
  USDT: 10, // 10 USDT minimum
};

// Required confirmations before crediting
export const REQUIRED_CONFIRMATIONS = 1; // Nile testnet is fast, 1 is enough