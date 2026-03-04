import { NextResponse } from 'next/server';
import { getTronWeb, getAccountBalance } from '@/lib/tron/utils';
import { ACTIVE_USDT_CONTRACT } from '@/lib/tron/config';

export async function GET() {
  try {
    const tronWeb = getTronWeb();
    const privateKey = process.env.TRON_PRIVATE_KEY;

    if (!privateKey) {
      return NextResponse.json({ error: 'Missing TRON_PRIVATE_KEY' }, { status: 500 });
    }

    // Derive hot wallet address
    const hotAddress = tronWeb.address.fromPrivateKey(privateKey);
    console.log('Hot wallet address:', hotAddress);

    // Get account details
    const response = await fetch(`https://nile.trongrid.io/v1/accounts/${hotAddress}`, {
      headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
    });

    const accountData = await response.json();
    const account = accountData.data?.[0];

    if (!account) {
      return NextResponse.json({ error: 'Account not found on Nile' }, { status: 404 });
    }

    // Get balance
    const bal = await getAccountBalance(hotAddress);

    return NextResponse.json({
      hotWallet: {
        address: hotAddress,
        trxBalance: bal.trx,
        usdt_balance_for_configured_contract: bal.usdt,
      },
      configured: {
        ACTIVE_USDT_CONTRACT,
        TRON_PRIVATE_KEY: privateKey.substring(0, 8) + '...',
      },
      account: {
        trxBalance: (account.balance || 0) / 1_000_000,
        trc20Tokens: account.trc20 || [],
        lastOperation: account.latest_opration_time,
        createTime: account.create_time,
      },
      recommendation:
        bal.usdt === 0 && account.trc20?.length > 0
          ? `⚠️ Hot wallet has TRC20 tokens but NOT from the configured contract (${ACTIVE_USDT_CONTRACT}). Fund with USDT from the correct contract.`
          : bal.usdt > 0
          ? `✅ Hot wallet has ${bal.usdt} USDT available`
          : `❌ Hot wallet has 0 USDT. Fund it with USDT from contract ${ACTIVE_USDT_CONTRACT}`,
    });
  } catch (err: any) {
    console.error('Diagnostics error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to get diagnostics' },
      { status: 500 }
    );
  }
}
