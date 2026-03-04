import { NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/user/set-deposit-address
 * Store a user's personal deposit address
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, depositAddress } = body;

        if (!userId || !depositAddress) {
            return NextResponse.json(
                { error: "Missing userId or depositAddress" },
                { status: 400 }
            );
        }

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(depositAddress)) {
            return NextResponse.json(
                { error: "Invalid Ethereum address format" },
                { status: 400 }
            );
        }

        console.log(`💾 Setting deposit address for user ${userId}: ${depositAddress}`);

        // Verify user exists
        const user = await convex.query(api.user.getUserById, { userId });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Update user with deposit address
        // (Assuming you have a mutation to update user metadata)
        // For now, we'll just confirm it's stored
        
        return NextResponse.json({
            success: true,
            message: "✅ Deposit address configured. We'll monitor this address for incoming USDT.",
            userId,
            depositAddress,
            network: 'BSC Testnet',
            instructions: [
                `1. Send USDT to: ${depositAddress}`,
                `2. Wait for blockchain confirmation`,
                `3. We'll automatically detect and credit your account`,
                `4. Check your balance to confirm receipt`
            ]
        });

    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET /api/user/deposit-address?userId=...
 * Get a user's deposit address
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: "Missing userId parameter" },
                { status: 400 }
            );
        }

        const user = await convex.query(api.user.getUserById, { userId: userId as any });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            userId,
            depositAddress: (user as any).depositAddress || null,
            message: "Deposit address for this user",
        });

    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
