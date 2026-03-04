import { NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/user/balance?userId=<id>
 * Get user balance by ID (admin/debug endpoint)
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
        }

        console.log(`📊 Getting balance for user: ${userId}`);

        try {
            const user = await convex.query(api.user.getUserById, { userId: userId as any });
            
            if (!user) {
                return NextResponse.json(
                    { error: "User not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                user: {
                    id: user._id,
                    name: user.fullname || user.contact,
                    email: user.email || user.contact,
                    balance: (user.depositAmount || 0) + (user.earnings || 0),
                    depositAmount: user.depositAmount || 0,
                    lockedPrincipal: user.lockedPrincipal || 0,
                    // Only earnings are withdrawable (deposits are not)
                    withdrawableBalance: user.earnings || 0,
                    earnings: user.earnings || 0,
                },
            });
        } catch (error: any) {
            console.error('Database error:', error);
            return NextResponse.json(
                { error: "Failed to query user", details: error.message },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
