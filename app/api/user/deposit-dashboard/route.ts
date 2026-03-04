import { NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/user/deposit-dashboard?userId=...
 * Get complete deposit info and status for a user
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        // Get user
        const user = await convex.query(api.user.getUserById, { userId: userId as any });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Get deposits
        const deposits = await convex.query(api.deposit.getUserDeposits, { userId: userId as any });

        // Calculate stats
        const totalDeposited = deposits.reduce((sum: number, d: any) => 
            d.status === 'completed' ? sum + d.amount : sum, 0
        );
        const pendingDeposits = deposits.filter((d: any) => d.status === 'pending');
        const completedDeposits = deposits.filter((d: any) => d.status === 'completed');

        return NextResponse.json({
            success: true,
            user: {
                id: user._id,
                name: user.fullname || user.contact,
                email: user.email || user.contact,
            },
            balance: {
                total: (user.depositAmount || 0) + (user.earnings || 0),
                locked: user.lockedPrincipal || 0,
                // Only earnings are withdrawable; deposited principal is not.
                withdrawable: user.earnings || 0,
                earnings: user.earnings || 0,
            },
            deposits: {
                total: deposits.length,
                completed: completedDeposits.length,
                pending: pendingDeposits.length,
                totalDeposited,
                list: deposits.map((d: any) => ({
                    id: d._id,
                    amount: d.amount,
                    status: d.status,
                    txHash: d.transactionHash,
                    date: new Date(d.createdAt).toLocaleString(),
                    network: d.network,
                })),
            },
            depositInstructions: {
                network: "Tron (TRC20)",
                token: "USDT (TRC20)",
                depositAddress: "0x840244c07080841682f4d902a197ee58b694c195", // example address, replace as needed
                explorerUrl: "https://tronscan.org",
                instructions: [
                    "1. Send TRC20 USDT to the deposit address above",
                    "2. Wait for blockchain confirmation (usually under a minute)",
                    "3. System automatically detects and credits your account",
                    "4. Check this page to confirm balance updated"
                ]
            },
            monitoring: {
                status: "Active",
                lastCheck: new Date().toISOString(),
                checkUrl: `/api/tron/poll-deposits?userId=${userId}&address=0x840244c07080841682f4d902a197ee58b694c195`
            }
        });

    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
