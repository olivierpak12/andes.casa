import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/deposit/manual-record
 * Admin endpoint to manually record a deposit (for pending/delayed transactions)
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, txHash, amount } = body; // network no longer accepted (TRC20 only)

        // Check for admin authentication
        const authHeader = req.headers.get('authorization') || '';
        const bearerTokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        
        if (!bearerTokenMatch) {
            return NextResponse.json(
                { error: "Admin token required" },
                { status: 401 }
            );
        }

        if (!userId || !txHash || !amount) {
            return NextResponse.json(
                { error: "Missing userId, txHash, or amount" },
                { status: 400 }
            );
        }

        console.log(`💾 Manually recording deposit: ${amount} USDT for user ${userId}`);

        // Verify user exists
        const user = await convex.query(api.user.getUserById, { userId });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Check if already recorded
        let existingDeposit;
        try {
            existingDeposit = await convex.query(api.deposit.getDepositByTransactionHash, {
                txHash,
            });
        } catch (e) {
            // Not found - OK
        }

        if (existingDeposit) {
            return NextResponse.json({
                success: true,
                message: `✅ Deposit already recorded`,
                depositId: existingDeposit._id,
                status: existingDeposit.status,
            });
        }

        // Record deposit
        const depositId = await convex.mutation(api.deposit.recordDeposit, {
            userId,
            transactionHash: txHash,
            amount,
            network: 'trc20',
            walletAddress: '0x840244c07080841682f4d902a197ee58b694c195', // example/tron deposit address
        });

        console.log(`✅ Deposit recorded: ${depositId}`);

        // Mark as completed to trigger balance credit
        await convex.mutation(api.deposit.updateDepositStatus, {
            transactionHash: txHash,
            status: 'completed',
        });

        console.log(`✅ Deposit completed and balance credited`);

        // Get updated user
        const updatedUser = await convex.query(api.user.getUserById, { userId });

        return NextResponse.json({
            success: true,
            message: "✅ Deposit manually recorded and credited!",
            deposit: {
                id: depositId,
                amount,
                status: 'completed',
                txHash,
            },
            newBalance: updateduser?.depositAmount || 0,
            newLockedPrincipal: updatedUser?.lockedPrincipal || 0,
        });

    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
