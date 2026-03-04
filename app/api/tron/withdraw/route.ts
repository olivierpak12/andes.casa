import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getTronWeb, toSun, fromSun, getAccountBalance } from '@/lib/tron/utils';
import { ACTIVE_USDT_CONTRACT } from '@/lib/tron/config';
import { sendTrx } from '../../../../server/tronService';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Simple custom hash function (matches convex/user.ts)
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// small helper
function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

// Helper to validate Tron address format
function isValidTronAddress(address: string) {
    try {
        const tronWeb = getTronWeb();
        return tronWeb.isAddress(address);
    } catch {
        return false;
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user?.contact) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { amount, network, address, transactionPassword } = body;

        if (!amount || !network || !address) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (network !== 'trc20') {
             return NextResponse.json({ error: "Only TRC20 withdrawals are currently supported" }, { status: 400 });
        }

        // Validate destination address format
        if (!isValidTronAddress(address)) {
            return NextResponse.json({ error: 'Invalid TRON address' }, { status: 400 });
        }
        
        // 1. Get User ID from Convex
        const user = await convex.query(api.user.getUserByContact, {
             contact: session.user.contact,
        });

        if (!user) {
             return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Get transaction password from request (can be empty for 24hr bypass)
        const transactionPassword = body.transactionPassword || "";

        // Check if transaction password is locked (within 24 hours of change)
        const isPasswordLocked = await convex.query(api.user.isTransactionPasswordLocked, {
             userId: user._id,
        });

        if (isPasswordLocked) {
            // Get time remaining for the lock
            const lockTimeRemaining = await convex.query(api.user.getTransactionPasswordLockTimeRemaining, {
                 userId: user._id,
            });
            
            const hours = lockTimeRemaining ? Math.ceil(lockTimeRemaining / (1000 * 60 * 60)) : 24;
            console.warn(`User ${user._id} attempted withdrawal but transaction password is locked for ${hours} more hours`);
            return NextResponse.json(
                { error: `Your new transaction password is locked for security. Please wait ${hours} hours before withdrawing.` },
                { status: 403 }
            );
        }

        // Check if user can bypass password verification (24 hours since forgotten)
        const canBypass = await convex.query(api.user.canBypassPasswordVerification, {
             userId: user._id,
        });

        // Verify transaction password OR check 24-hour bypass
        if (!canBypass) {
            // Password verification is required if not bypassing
            if (!transactionPassword || typeof transactionPassword !== 'string') {
                return NextResponse.json({ error: 'Missing transaction password' }, { status: 400 });
            }
            try {
                const storedHash = user.transactionPassword || "";
                if (!storedHash || typeof storedHash !== 'string' || storedHash.trim().length === 0) {
                    console.warn(`User ${user._id} attempted withdrawal but has no transaction password configured.`);
                    return NextResponse.json({ error: 'Transaction password not configured for account' }, { status: 400 });
                }

                const hashedInput = simpleHash(transactionPassword);
                if (hashedInput !== storedHash) {
                    return NextResponse.json({ error: 'Invalid transaction password' }, { status: 401 });
                }
            } catch (e) {
                console.error('Transaction password verification error:', e);
                return NextResponse.json({ error: 'Failed to verify transaction password' }, { status: 500 });
            }
        } else {
            console.log(`User ${user._id} bypassed password verification (24 hours since marked forgotten)`);
            // Clear the forgotten timestamp after successful bypass
            await convex.mutation(api.user._updateForgottenTimestamp, {
                userId: user._id,
                timestamp: undefined,
            });
        }

        // Validate server configuration and hot-wallet balances BEFORE creating a pending withdrawal
        const privateKey = process.env.TRON_PRIVATE_KEY;
        if (!privateKey) {
            return NextResponse.json({ error: 'Server configuration error: Missing hot wallet key' }, { status: 500 });
        }

        if (!ACTIVE_USDT_CONTRACT) {
            return NextResponse.json({ error: 'Server configuration error: Missing USDT contract address' }, { status: 500 });
        }

        // Build tronWeb and derive hot wallet address
        const tronWeb = getTronWeb();
        let hotAddress: string | null = null;
        try {
            hotAddress = tronWeb.address.fromPrivateKey(privateKey);
        } catch (err) {
            console.error('Failed to derive hot wallet address from private key:', err);
            return NextResponse.json({ error: 'Server configuration error: Invalid hot wallet key' }, { status: 500 });
        }

        // Check hot wallet balances
        try {
            const bal = await getAccountBalance(hotAddress!);
            const amountFloat = parseFloat(amount);
            
            console.log(`Hot wallet balances - TRX: ${bal.trx}, USDT: ${bal.usdt}`);
            
            if ((bal.usdt || 0) < amountFloat) {
                console.error(`Hot wallet insufficient USDT: has ${bal.usdt}, needs ${amountFloat}`);
                return NextResponse.json({ 
                    error: 'Server hot wallet has insufficient USDT to process this withdrawal. Please contact support.',
                    details: `Hot wallet USDT balance: ${bal.usdt}, Required: ${amountFloat}` 
                }, { status: 503 });
            }
            // Ensure there's some TRX for fees (require at least 0.5 TRX for safety)
            if ((bal.trx || 0) < 0.5) {
                console.error(`Hot wallet insufficient TRX for fees: ${bal.trx}`);
                return NextResponse.json({ 
                    error: 'Server hot wallet has insufficient TRX to pay transaction fees. Please contact support.',
                    details: `Hot wallet TRX balance: ${bal.trx}` 
                }, { status: 503 });
            }
        } catch (err) {
            console.error('Failed to fetch hot wallet balances:', err);
            return NextResponse.json({ error: 'Failed to verify hot wallet status' }, { status: 500 });
        }

        // 2. Request Withdrawal in Convex (deducts balance, creates pending tx)
        // Record the user's destination address in the transaction record.
        let transactionId;
        try {
            transactionId = await convex.mutation(api.withdrawal.requestWithdrawal, {
                userId: user._id,
                amount: parseFloat(amount),
                address: address,  // user's destination address
                network: 'trc20',
            });
        } catch (err: any) {
             return NextResponse.json({ error: err.message || "Failed to create withdrawal request" }, { status: 400 });
        }

        // 3. Process withdrawal on Tron Blockchain (with retries and improved logging)
        try {
            const tronWeb = getTronWeb();
            const privateKey = process.env.TRON_PRIVATE_KEY;

            if (!privateKey) {
                throw new Error("Server configuration error: Missing hot wallet key");
            }

            tronWeb.setPrivateKey(privateKey);

            const contract = await tronWeb.contract().at(ACTIVE_USDT_CONTRACT);

            // Amount is in USDT (6 decimals) - convert to integer units
            const amountInSun = Math.floor(parseFloat(amount) * 1_000_000);

            console.log(`Processing withdrawal: ${amount} USDT to ${address}`);
            console.log(`Contract: ${ACTIVE_USDT_CONTRACT}`);

            // ⭐ ACTIVATION CHECK: If destination address has insufficient TRX, send 1 TRX to activate it
            try {
                const destBalance = await getAccountBalance(address);
                console.log(`Destination TRX balance: ${destBalance.trx}`);
                
                if (destBalance.trx < 1) {
                    console.log(`⚡ Destination address has insufficient TRX (${destBalance.trx}). Attempting to send 1 TRX for activation...`);
                    try {
                        const fundTxId = await sendTrx(address, 1);
                        console.log(`✅ Successfully sent 1 TRX to activate destination: ${fundTxId}`);
                    } catch (activateErr: any) {
                        console.error(`⚠️ Failed to send activation TRX: ${activateErr?.message || activateErr}`);
                        console.log(`   Proceeding with USDT transfer anyway (may fail if destination account is not activated)`);
                    }
                }
            } catch (balanceCheckErr: any) {
                console.error(`⚠️ Failed to check destination balance: ${balanceCheckErr?.message || balanceCheckErr}`);
                console.log(`   Proceeding with USDT transfer...`);
            }

            // Helper to attempt the transfer with retries
            const maxRetries = 3;
            let lastError: any = null;
            let tradeResult: any = null;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    console.log(`\n🔄 Transfer attempt ${attempt + 1}/${maxRetries}`);
                    console.log(`   From: ${hotAddress}`);
                    console.log(`   To: ${address}`);
                    console.log(`   Amount (sun): ${amountInSun}`);
                    
                    // Send USDT from hot wallet to the user's destination `address`.
                    const transferMethod = contract.transfer(address, amountInSun);
                    console.log(`   Transfer method created`);
                    
                    tradeResult = await transferMethod.send({ feeLimit: 100_000_000 });
                    
                    console.log(`   Raw result:`, typeof tradeResult, Object.keys(tradeResult || {}).slice(0, 10));

                    // tronWeb may return a tx id string or an object; normalize
                    const txId = typeof tradeResult === 'string' ? tradeResult : (tradeResult && (tradeResult.hash || tradeResult.transaction?.hash || tradeResult.txid || tradeResult.result?.hash));
                    
                    console.log(`   TxId extracted:`, txId?.substring(0, 16));
                    
                    if (txId) {
                        console.log(`Transfer succeeded on attempt ${attempt + 1}:`, txId);
                        
                        // ⭐ CRITICAL: Verify txHash exists on blockchain before confirming
                        let txVerified = false;
                        const maxVerifyAttempts = 12;
                        for (let verifyAttempt = 0; verifyAttempt < maxVerifyAttempts; verifyAttempt++) {
                            await sleep(1000 * (verifyAttempt < 3 ? 1 : 2)); // 1s for first 3, then 2s
                            try {
                                const verifyRes = await fetch(`${process.env.TRONGRID_API_URL || 'https://nile.trongrid.io'}/v1/transactions/${txId}`, {
                                    headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' },
                                });
                                if (verifyRes.ok) {
                                    const txData = await verifyRes.json();
                                    if (txData.data?.[0]) {
                                        txVerified = true;
                                        console.log(`✅ TxHash verified on blockchain after ${verifyAttempt + 1} attempts: ${txId}`);
                                        break;
                                    }
                                }
                            } catch (verifyErr) {
                                console.log(`Verification attempt ${verifyAttempt + 1}/${maxVerifyAttempts} for ${txId}: Network/API error, retrying...`);
                            }
                        }

                        if (!txVerified) {
                            console.warn(`⚠️ TxHash ${txId} not found on blockchain after ${maxVerifyAttempts} attempts (${maxVerifyAttempts * 1.5}s timeout).`);
                            console.warn(`   Network may be congested or tx failed silently. Checking hot wallet balance as fallback...`);
                            
                            // FALLBACK: Check if funds actually arrived at hot wallet
                            try {
                                await sleep(2000);
                                const hotWalletBal = await getAccountBalance(hotAddress!);
                                const expectedUSDT = parseFloat(amount);
                                
                                console.log(`📊 Hot wallet balance check: Expected increase of ${expectedUSDT} USDT, Current USDT: ${hotWalletBal.usdt} USDT`);
                                
                                // Only consider it successful if we have a significant match (within 1%)
                                if ((hotWalletBal.usdt || 0) >= expectedUSDT * 0.99) {
                                    console.log(`✅ FALLBACK VERIFIED: Funds arrived at hot wallet. Balance: ${hotWalletBal.usdt} USDT`);
                                    txVerified = true;
                                } else {
                                    console.error(`❌ FALLBACK FAILED: Hot wallet balance (${hotWalletBal.usdt}) verification inconclusive. Expected at least ${expectedUSDT * 0.99} USDT`);
                                }
                            } catch (fallbackErr) {
                                console.error(`❌ Fallback balance check error:`, fallbackErr);
                                lastError = fallbackErr;
                            }
                        }

                        if (!txVerified) {
                            console.error(`❌ CRITICAL: TxHash ${txId} not confirmed and fallback check failed. Marking as failed to refund.`);
                            lastError = new Error(`Transaction not confirmed on blockchain within timeout (12 attempts, fallback failed)`);
                            continue;
                        }

                        // write completed status only after verification
                        await convex.mutation(api.withdrawal.completeWithdrawal, {
                            transactionId,
                            status: 'completed',
                            transactionHash: String(txId)
                        });

                        return NextResponse.json({ success: true, txId: String(txId), message: 'Withdrawal successful' });
                    }

                    // If no txId, treat as error
                    lastError = new Error('No transaction id returned from Tron transfer');
                } catch (err: any) {
                    lastError = err;
                    console.error(`Transfer attempt ${attempt + 1} failed:`, err?.message || err);
                    try {
                        console.error('Full transfer error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                    } catch (e) {
                        // ignore stringify errors
                    }

                    // Backoff before retrying
                    if (attempt < maxRetries - 1) {
                        await sleep(500 * Math.pow(2, attempt));
                    }
                }
            }

            // All attempts failed - record failure and refund
            console.error('All transfer attempts failed');
            try {
                await convex.mutation(api.withdrawal.completeWithdrawal, {
                    transactionId,
                    status: 'failed',
                    error: lastError?.message ? `${lastError.message}` : 'Blockchain transaction failed (no message)'
                });
            } catch (e) {
                console.error('Failed to mark withdrawal failed in DB:', e);
            }

            return NextResponse.json({ error: 'Withdrawal failed on blockchain. Your balance has been refunded.', details: lastError?.message }, { status: 500 });

        } catch (error: any) {
            console.error('Withdrawal API processing error:', error);
            try {
                console.error('Full processing error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            } catch (e) {
                // ignore
            }

            // Attempt to mark withdraw failed if we have a transactionId
            try {
                if (typeof transactionId !== 'undefined') {
                    await convex.mutation(api.withdrawal.completeWithdrawal, {
                        transactionId,
                        status: 'failed',
                        error: error?.message || 'Processing error'
                    });
                }
            } catch (e) {
                console.error('Failed to mark failed after processing error:', e);
            }

            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Withdrawal API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
