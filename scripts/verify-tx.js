#!/usr/bin/env node

const TronWeb = require('tronweb');

const base58Address = 'THtp4Ydz3BGVWXZWHopLJ6RcQyDkeezoyu';
const hexFromTx = '4156ec31744535e7b0c74ad0345e0a0aff26206a32';

const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });

const convertedToHex = tronWeb.address.toHex(base58Address);
const convertedFromHex = tronWeb.address.fromHex(hexFromTx);

console.log('\n📊 Address Check: THtp4Ydz3BGVWXZWHopLJ6RcQyDkeezoyu');
console.log('═'.repeat(60));

console.log('\nYour address (base58):');
console.log(`  ${base58Address}`);

console.log('\nYour address (hex):');
console.log(`  ${convertedToHex}`);

console.log('\nHex from transaction TO field:');
console.log(`  ${hexFromTx}`);

console.log('\nConverted from tx hex to base58:');
console.log(`  ${convertedFromHex}`);

if (convertedFromHex === base58Address) {
  console.log('\n✅ MATCH! The transaction IS for this address');
} else {
  console.log('\n❌ NO MATCH - Transaction goes to a different address');
}

console.log('\n\n📋 Transaction Summary:');
console.log('═'.repeat(60));
console.log(`Amount: 2 TRX`);
console.log(`From: 41ab4046e7a877ee6a6e3f5e4c1035881d032fb32c`);
console.log(`  (${tronWeb.address.fromHex('41ab4046e7a877ee6a6e3f5e4c1035881d032fb32c')})`);
console.log(`To: ${hexFromTx}`);
console.log(`  (${convertedFromHex})`);
console.log(`Timestamp: 2026-03-03T13:39:21 UTC`);
console.log(`Status: ✅ CONFIRMED`);
console.log(`Estimated USDT value: $${(2 * 0.15).toFixed(2)}`);
