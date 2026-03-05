#!/usr/bin/env node

const TronWeb = require('tronweb');

// The hex address from the transaction
const hexAddress = '410a3ddbfe5f19ca9ffcb35dc9abe69c48ce2cd890';

// Your deposit address
const base58Address = 'TAuMs3Hq6mFTmvTJQb7i3KHP79Kyw4wouE';

// Convert
const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
const convertedFromHex = tronWeb.address.fromHex(hexAddress);
const convertedToHex = tronWeb.address.toHex(base58Address);

console.log('Address Verification:');
console.log('====================\n');
console.log('Your deposit address (base58):');
console.log(`  ${base58Address}`);
console.log('\nHex format of your address:');
console.log(`  ${convertedToHex}`);
console.log('\nHex from transaction:');
console.log(`  ${hexAddress}`);
console.log('\nConverted from hex:');
console.log(`  ${convertedFromHex}`);

if (convertedFromHex === base58Address) {
  console.log('\n✅ MATCH! This transaction goes to your deposit address');
} else {
  console.log('\n❌ NO MATCH - Transaction goes to a different address');
}

console.log('\n\nTransaction Summary:\n');
console.log(`Amount: 3 TRX`);
console.log(`From: 41ab4046e7a877ee6a6e3f5e4c1035881d032fb32c`);
console.log(`  (${tronWeb.address.fromHex('41ab4046e7a877ee6a6e3f5e4c1035881d032fb32c')})`);
console.log(`To: ${hexAddress}`);
console.log(`  (${convertedFromHex})`);
console.log(`Timestamp: 2026-03-03T12:46:27 UTC`);
console.log(`Status: ✅ CONFIRMED`);
