/**
 * Deep Diagnostic: Check actual API responses and contract state
 */

require('dotenv').config({ path: '.env.local' });
const TronWeb = require('tronweb');
const axios = require('axios');

async function deepDiagnose() {
  console.log('🔍 Deep Wallet Diagnostics\n');

  const pk = process.env.TRON_PRIVATE_KEY;
  const apiKey = process.env.TRONGRID_API_KEY;
  const contractAddr = process.env.ACTIVE_USDT_CONTRACT;

  if (!pk) {
    console.error('❌ TRON_PRIVATE_KEY not set');
    process.exit(1);
  }

  const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': apiKey || '' },
  });

  const hotAddress = tronWeb.address.fromPrivateKey(pk);
  console.log(`📍 Hot Wallet Address: ${hotAddress}\n`);

  // 1. Direct API call for TRX balance
  console.log('🔄 Fetching TRX Balance via Direct API...');
  try {
    const response = await axios.get(
      `https://nile.trongrid.io/v1/accounts/${hotAddress}`,
      { headers: { 'TRON-PRO-API-KEY': apiKey || '' } }
    );
    
    if (response.data && response.data.data && response.data.data[0]) {
      const account = response.data.data[0];
      const trxBalance = account.balance || 0;
      const trxInTRX = trxBalance / 1e6;
      console.log(`   ✓ TRX Balance: ${trxInTRX} TRX`);
      console.log(`   Account Status: ${account.account_name || 'unnamed'}`);
      
      // Check if account is activated
      if (!account.balance) {
        console.log(`   ⚠️ Account has 0 TRX - might not be activated on testnet`);
      }
    } else {
      console.log(`   ⚠️ No account data returned`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    }
  } catch (err) {
    console.error(`   ❌ API Error:`, err.response?.data || err.message);
  }

  // 2. Check contract existence
  console.log(`\n📋 Checking Contract: ${contractAddr}`);
  try {
    const response = await axios.get(
      `https://nile.trongrid.io/v1/contracts/${contractAddr}`,
      { headers: { 'TRON-PRO-API-KEY': apiKey || '' } }
    );
    
    if (response.data && response.data.data) {
      console.log(`   ✓ Contract found`);
      console.log(`   Type: TRC20`);
    } else {
      console.log(`   ⚠️ Contract not found or invalid`);
    }
  } catch (err) {
    console.error(`   ❌ Contract check failed:`, err.response?.data?.message || err.message);
  }

  // 3. Try TronWeb contract call
  console.log(`\n🔄 Fetching USDT Balance via TronWeb...`);
  try {
    tronWeb.setAddress(hotAddress);
    const contract = await tronWeb.contract().at(contractAddr);
    const balance = await contract.balanceOf(hotAddress).call();
    const usdtBalance = parseInt(balance.toString()) / 1e6;
    console.log(`   ✓ USDT Balance: ${usdtBalance} USDT`);
  } catch (err) {
    console.error(`   ❌ TronWeb contract call failed:`);
    console.error(`      Message: ${err.message}`);
    if (err.response) console.error(`      Response:`, err.response);
  }

  // 4. Direct RPC call for contract state
  console.log(`\n🔄 Querying Contract ABI...`);
  try {
    const response = await axios.post(
      'https://nile.trongrid.io/jsonrpc',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [contractAddr, 'latest'],
      },
      { headers: { 'TRON-PRO-API-KEY': apiKey || '' } }
    );
    
    if (response.data && response.data.result) {
      console.log(`   ✓ Contract code found (deployed)`);
    } else {
      console.log(`   ⚠️ Contract might not be deployed or invalid address`);
    }
  } catch (err) {
    console.error(`   ⚠️ RPC check inconclusive:`, err.message);
  }

  // 5. Check for recent transactions
  console.log(`\n📊 Checking Recent Transactions...`);
  try {
    const response = await axios.get(
      `https://nile.trongrid.io/v1/accounts/${hotAddress}/transactions?limit=5`,
      { headers: { 'TRON-PRO-API-KEY': apiKey || '' } }
    );
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      console.log(`   ✓ Found ${response.data.data.length} transactions`);
      response.data.data.forEach((tx, i) => {
        console.log(`     ${i + 1}. ${tx.txID?.substring(0, 16)}...`);
      });
    } else {
      console.log(`   ⚠️ No transactions found (new account)`);
    }
  } catch (err) {
    console.error(`   ⚠️ Transaction check failed:`, err.message);
  }

  console.log('\n✅ Diagnostics complete\n');
  console.log('💡 Summary:');
  console.log(`   - Hot Wallet: ${hotAddress}`);
  console.log(`   - Contract: ${contractAddr}`);
  console.log(`   - If balance is 0, the account may not have received funds yet`);
  console.log(`   - Check Nile testnet faucet: https://nileex.io/join/getJoinPage`);
}

deepDiagnose().catch(console.error);
