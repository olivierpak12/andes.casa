import { NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const BSCSCAN_API = "https://api-testnet.bscscan.com/api";
const USDT_CONTRACT_TESTNET = "0x337610d27c682E347C9cD60BD4b3b107C9d34585";

/**
 * POST /api/deposit/scan-address
 * Scan a user's address for incoming USDT deposits and record them
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, address } = body;

        if (!userId || !address) {
            return NextResponse.json(
                { error: "Missing userId or address" },
                { status: 400 }
            );
        }

        console.log(`🔍 Scanning address ${address} for user ${userId}`);

        // Verify user exists
        const user = await convex.query(api.user.getUserById, { userId });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Get all USDT transfers to this address from BSCscan
        const params = new URLSearchParams({
            module: 'account',
            action: 'tokentx',
            contractaddress: USDT_CONTRACT_TESTNET,
            address: address,
            startblock: '0',
            endblock: '99999999',
            sort: 'desc',
            page: '1',
            offset: '100',
            apikey: 'YourApiKeyToken',
        });

        const response = await fetch(`${BSCSCAN_API}?${params}`);
        const data = await response.json();

        if (data.status === '0' || !data.result) {
            return NextResponse.json({
                success: true,
                message: "No USDT transactions found for this address",
                processed: 0,
            });
        }

        // Filter incoming transfers only
        const incomingTransfers = data.result.filter((tx: any) =>
            tx.to.toLowerCase() === address.toLowerCase()
        );

        console.log(`✅ Found ${incomingTransfers.length} incoming transfers`);

        let processed = 0;
        const results = [];

        // Process each transfer
        for (const transfer of incomingTransfers) {
            try {
                const txHash = transfer.hash;
                const amount = (parseInt(transfer.value) / 1e6).toString(); // USDT has 6 decimals
                const status = transfer.isError === '0' ? 'success' : 'failed';

                if (status === 'failed') {
                    console.log(`⏭️  Skipping failed transaction: ${txHash}`);
                    continue;
                }

                // Check if already recorded
                let existingDeposit;
                try {
                    existingDeposit = await convex.query(api.deposit.getDepositByTransactionHash, {
                        txHash,
                    });
                } catch (e) {
                    // OK if not found
                }

                if (existingDeposit) {
                    console.log(`⏭️  Already recorded: ${txHash}`);
                    results.push({
                        txHash,
                        amount,
                        status: 'already_recorded',
                        depositId: existingDeposit._id,
                    });
                    continue;
                }

                // Record new deposit
                console.log(`📝 Recording deposit: ${amount} USDT from tx ${txHash}`);

                const depositId = await convex.mutation(api.deposit.recordDeposit, {
                    userId,
                    transactionHash: txHash,
                    amount: parseFloat(amount),
                    network: 'bep20',
                    walletAddress: transfer.to,
                });

                // Mark as completed
                await convex.mutation(api.deposit.updateDepositStatus, {
                    transactionHash: txHash,
                    status: 'completed',
                });

                console.log(`✅ Deposit completed and credited`);
                processed++;

                results.push({
                    txHash,
                    amount,
                    status: 'credited',
                    depositId,
                });

            } catch (error: any) {
                console.error(`❌ Error processing transfer:`, error.message);
                results.push({
                    txHash: transfer.hash,
                    error: error.message,
                    status: 'error',
                });
            }
        }

        // Get updated balance
        const updatedUser = await convex.query(api.user.getUserById, { userId });

        return NextResponse.json({
            success: true,
            message: `✅ Scan complete. Processed ${processed} new deposits.`,
            userId,
            address,
            processed,
            totalFound: incomingTransfers.length,
            newBalance: updateduser?.depositAmount || 0,
            newLockedPrincipal: updatedUser?.lockedPrincipal || 0,
            results,
        });

    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
