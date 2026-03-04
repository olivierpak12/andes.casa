import { NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/deposit/debug?userId=<id>
 * Debug endpoint to see all deposits for a user
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
        }

        console.log(`📊 Getting all deposits for user: ${userId}`);

        // Get user
        const user = await convex.query(api.user.getUserById, { userId: userId as any });
        
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Get all deposits
        const deposits = await convex.query(api.deposit.getUserDeposits, { userId: userId as any });

        return NextResponse.json({
            success: true,
            user: {
                id: user._id,
                name: user.fullname || user.contact || 'Unknown',
                totalBalance: (user.depositAmount || 0) + (user.earnings || 0),
                depositAmount: user.depositAmount || 0,
                lockedPrincipal: user.lockedPrincipal || 0,
                referredBy: user.referredBy || null,
            },
            deposits: deposits.map((d: any) => ({
                id: d._id,
                amount: d.amount,
                status: d.status,
                network: d.network,
                txHash: d.transactionHash,
                createdAt: new Date(d.createdAt).toLocaleString(),
                type: d.type,
            })) || [],
        });

    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
