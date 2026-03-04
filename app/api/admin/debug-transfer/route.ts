import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/auth";
import { getTronWeb, getAccountBalance, isValidTronAddress, isValidPrivateKey, getAddressFromPrivateKey } from '@/lib/tron/utils';
import { ACTIVE_USDT_CONTRACT } from '@/lib/tron/config';

/**
 * GET: Debug endpoint to verify hot wallet setup and address formats
 * Admin-only access
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.contact) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Simple admin check (could be more strict in production)
    const isAdmin = session.user?.email?.includes('admin') || session.user?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const privateKey = process.env.TRON_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({
        success: false,
        error: 'TRON_PRIVATE_KEY not configured',
        debug: {
          privateKeyConfigured: false,
        },
      }, { status: 500 });
    }

    // Validate private key format
    const pkValid = isValidPrivateKey(privateKey);
    console.log('[DEBUG] Private key format valid:', pkValid);

    if (!pkValid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid TRON_PRIVATE_KEY format',
        debug: {
          privateKeyConfigured: true,
          privateKeyFormatValid: false,
          expectedFormat: '64-character hexadecimal string',
          actualLength: privateKey.length,
          actualFirst20Chars: privateKey.substring(0, 20) + '...',
        },
      }, { status: 400 });
    }

    // Initialize TronWeb
    const tronWeb = getTronWeb();
    console.log('[DEBUG] TronWeb initialized');

    // Derive and validate hot wallet address
    const { address: hotAddress, valid: addressValid } = getAddressFromPrivateKey(privateKey);
    console.log('[DEBUG] Hot wallet address:', hotAddress, 'Valid:', addressValid);

    if (!addressValid) {
      return NextResponse.json({
        success: false,
        error: 'Failed to derive valid address from private key',
        debug: {
          privateKeyFormatValid: true,
          addressDerivationFailed: true,
        },
      }, { status: 400 });
    }

    // Convert to hex for comparison
    const hotAddressHex = tronWeb.address.toHex(hotAddress);
    console.log('[DEBUG] Hot wallet hex:', hotAddressHex);

    // Validate contract address
    const contractValid = isValidTronAddress(ACTIVE_USDT_CONTRACT);
    console.log('[DEBUG] Contract address valid:', contractValid);

    // Convert contract to hex
    const contractHex = tronWeb.address.toHex(ACTIVE_USDT_CONTRACT);
    console.log('[DEBUG] Contract hex:', contractHex);

    // Get hot wallet balance
    let balance = null;
    let balanceError = null;
    try {
      balance = await getAccountBalance(hotAddress);
      console.log('[DEBUG] Hot wallet balance:', balance);
    } catch (error: any) {
      balanceError = error.message;
      console.log('[DEBUG] Balance fetch error:', error);
    }

    // Try to load contract
    let contractLoaded = false;
    let contractError = null;
    try {
      const contract = await tronWeb.contract().at(ACTIVE_USDT_CONTRACT);
      contractLoaded = contract ? true : false;
      console.log('[DEBUG] Contract loaded successfully');
    } catch (error: any) {
      contractError = error.message;
      console.log('[DEBUG] Contract load error:', error);
    }

    // Return comprehensive debug info
    return NextResponse.json({
      success: true,
      debug: {
        privateKey: {
          configured: true,
          formatValid: pkValid,
          format: '64-char hex string',
          length: privateKey.length,
        },
        hotWallet: {
          address: hotAddress,
          addressValid: addressValid,
          hexAddress: hotAddressHex,
          balance: balance,
          balanceError: balanceError,
          hasSufficientTRX: balance && balance.trx > 1,
          hasSufficientUSDT: balance && balance.usdt > 0,
          status: balance && balance.trx > 1 && balance.usdt > 0 ? '✅ Ready for transfers' : '⚠️ May have issues',
        },
        contract: {
          address: ACTIVE_USDT_CONTRACT,
          addressValid: contractValid,
          hexAddress: contractHex,
          loaded: contractLoaded,
          loadError: contractError,
        },
        config: {
          network: process.env.TRONGRID_API_URL,
          hasApiKey: !!process.env.TRONGRID_API_KEY,
        },
      },
      recommendations: [
        !pkValid && '⚠️ Private key format invalid - must be 64 character hex string',
        !addressValid && '⚠️ Cannot derive valid address from private key',
        balance && balance.trx < 1 && '⚠️ Hot wallet has insufficient TRX for gas fees (need at least 1 TRX)',
        balance && balance.usdt < 10 && '⚠️ Hot wallet has low USDT balance',
        !contractLoaded && '⚠️ Cannot load USDT contract from blockchain',
        contractError && `⚠️ Contract error: ${contractError}`,
      ].filter(Boolean),
      message: contractLoaded && addressValid && balance && balance.trx > 1 
        ? '✅ Everything looks good! Ready to transfer.' 
        : '⚠️ Check recommendations above',
    });
  } catch (error: any) {
    console.error('[DEBUG] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Debug check failed",
        details: error.stack?.substring(0, 1000),
      },
      { status: 500 }
    );
  }
}
