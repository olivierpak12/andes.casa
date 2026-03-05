/**
 * Verify: Does the private key derive to the expected address?
 */

require('dotenv').config({ path: '.env.local' });
const TronWeb = require('tronweb');

console.log('🔐 PRIVATE KEY VERIFICATION\n');

const pk = process.env.TRON_PRIVATE_KEY;
if (!pk) {
  console.error('❌ TRON_PRIVATE_KEY not set');
  process.exit(1);
}

const tronWeb = new TronWeb({
  fullHost: 'https://nile.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
});

console.log('Private Key (first 10 chars): ' + pk.substring(0, 10) + '...');
console.log('');

const derivedAddress = tronWeb.address.fromPrivateKey(pk);
const expectedAddress = 'TRahYuQRtfd92wYBqS4rKpb3MmfYv5RHLT';

console.log('✓ DERIVED ADDRESS: ' + derivedAddress);
console.log('✓ EXPECTED ADDRESS: ' + expectedAddress);
console.log('');

if (derivedAddress === expectedAddress) {
  console.log('✅ MATCH! Private key correctly generates the hot wallet address.');
  console.log('');
  console.log('🤔 So if you have money sent to this address, where is it?');
  console.log('');
  console.log('Possibilities:');
  console.log('1. Money is in the DATABASE (user account balances) but not on blockchain');
  console.log('2. Money was sent to a DIFFERENT address');
  console.log('3. Money needs to be bridged/transferred to this address');
  console.log('');
  console.log('📌 To check: Use "find-money.js" script to see total in user accounts');
} else {
  console.log('❌ MISMATCH! The private key does NOT match the hot wallet address.');
  console.log('');
  console.log('This means:');
  console.log('- If money was sent to ' + expectedAddress);
  console.log('- You cannot spend it with this private key: ' + pk);
  console.log('');
  console.log('You need to check which private key corresponds to: ' + expectedAddress);
}
