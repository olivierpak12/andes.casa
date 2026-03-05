/**
 * Diagnostic: Check hot wallet address and contract setup
 */

require('dotenv').config({ path: '.env.local' });
const TronWeb = require('tronweb');

async function diagnose() {
  console.log('🔍 Hot Wallet Diagnostics\n');

  // 1. Check private key
  const pk = process.env.TRON_PRIVATE_KEY;
  if (!pk) {
    console.error('❌ TRON_PRIVATE_KEY not set');
    process.exit(1);
  }

  console.log('✓ Private key found\n');

  // 2. Derive address from private key
  const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
  });

  const derivedAddress = tronWeb.address.fromPrivateKey(pk);
  console.log(`📍 Hot Wallet Address (derived from private key):`);
  console.log(`   ${derivedAddress}\n`);

  // 3. Check configured contract
  const configuredContract = process.env.ACTIVE_USDT_CONTRACT;
  const officialNileContract = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

  console.log('📋 Contract Configuration:');
  console.log(`   Configured: ${configuredContract}`);
  console.log(`   Official Nile Testnet: ${officialNileContract}`);

  if (configuredContract === officialNileContract) {
    console.log('   ✅ Contract matches official Nile testnet USDT\n');
  } else {
    console.log('   ⚠️ Contract does NOT match official Nile testnet USDT');
    console.log('   This could explain why balances show as 0\n');
  }

  // 4. Try to fetch TRX balance
  console.log('🔄 Testing balance fetch...');
  try {
    tronWeb.setAddress(derivedAddress);
    
    const trxBalance = await tronWeb.trx.getBalance(derivedAddress);
    const trxInTRX = tronWeb.fromSun(trxBalance);
    console.log(`   TRX Balance: ${trxInTRX} TRX ✓`);
  } catch (err) {
    console.error(`   ❌ TRX balance fetch failed:`, err.message);
  }

  // 5. Try to fetch USDT balance with configured contract
  try {
    console.log(`\n   Testing USDT balance with configured contract...`);
    const contract = await tronWeb.contract().at(configuredContract);
    const balance = await contract.balanceOf(derivedAddress).call();
    const usdtBalance = parseInt(balance.toString()) / 1e6;
    console.log(`   USDT Balance (configured): ${usdtBalance} USDT ✓`);
  } catch (err) {
    console.error(`   ❌ USDT balance fetch failed with configured contract:`, err.message);
  }

  // 6. Try to fetch USDT balance with official contract
  try {
    console.log(`\n   Testing USDT balance with official Nile contract...`);
    const contract = await tronWeb.contract().at(officialNileContract);
    const balance = await contract.balanceOf(derivedAddress).call();
    const usdtBalance = parseInt(balance.toString()) / 1e6;
    console.log(`   USDT Balance (official): ${usdtBalance} USDT ✓`);
  } catch (err) {
    console.error(`   ❌ USDT balance fetch failed with official contract:`, err.message);
  }

  console.log('\n✅ Diagnostics complete');
}

diagnose().catch(console.error);
