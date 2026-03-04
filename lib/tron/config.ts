// lib/tron/config.ts

export const TRON_CONFIG = {
  // 🧪 Nile Testnet (development)
  NILE: {
    fullHost: "https://nile.trongrid.io",
    network: "nile",
    explorer: "https://nile.tronscan.org",
    faucet: "https://nileex.io/join/getJoinPage",
  },

  // 🚀 Mainnet (production)
  MAINNET: {
    fullHost: "https://api.trongrid.io",
    network: "mainnet",
    explorer: "https://tronscan.org",
  },
} as const;

// 🔁 Auto-switch network
// FORCE_TESTNET overrides NODE_ENV for explicit testnet use
export const ACTIVE_NETWORK =
  process.env.FORCE_TESTNET === 'true'
    ? TRON_CONFIG.NILE
    : process.env.NODE_ENV === "production"
    ? TRON_CONFIG.MAINNET
    : TRON_CONFIG.NILE;

// ✅ CORRECT TRC20 USDT CONTRACTS
export const USDT_CONTRACT = {
  // Nile Testnet USDT (TRC20) - OFFICIAL TESTNET CONTRACT
  NILE: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",

  // Mainnet USDT (official)
  MAINNET: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
} as const;

// 🎯 Active USDT contract
export const ACTIVE_USDT_CONTRACT =
  process.env.FORCE_TESTNET === 'true'
    ? USDT_CONTRACT.NILE
    : process.env.NODE_ENV === "production"
    ? USDT_CONTRACT.MAINNET
    : USDT_CONTRACT.NILE;

// 💰 Minimum deposit thresholds
export const MIN_DEPOSIT = {
  TRX: 1,  // activation
  USDT: 10,
};

// ⏱ Confirmations
export const REQUIRED_CONFIRMATIONS = 1;
