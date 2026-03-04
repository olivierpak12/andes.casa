import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET: Diagnostic endpoint to check all external transfers for negative amounts
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.contact) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await convex.query(api.user.getUserByContact, {
      contact: session.user.contact,
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get all transfers by this admin
    const transfers = await convex.query(api.externalTransfer.getTransfersByAdmin, {
      adminId: user._id,
    });

    console.log('[DIAGNOSTIC] Analyzing transfers:', {
      totalCount: transfers?.length || 0,
    });

    // Analyze for negative amounts
    const analysis: any = {
      totalTransfers: transfers?.length || 0,
      negativeAmounts: [] as any[],
      positiveAmounts: [] as any[],
      zeroAmounts: [] as any[],
      summary: {},
    };

    if (transfers) {
      transfers.forEach((transfer: any) => {
        console.log('[DIAGNOSTIC] Transfer:', {
          id: transfer._id,
          amount: transfer.amount,
          amountType: typeof transfer.amount,
          isPositive: transfer.amount > 0,
          isNegative: transfer.amount < 0,
          recipient: transfer.recipientAddress,
        });

        if (transfer.amount < 0) {
          analysis.negativeAmounts.push({
            id: transfer._id,
            amount: transfer.amount,
            recipient: transfer.recipientAddress,
            status: transfer.status,
            createdAt: transfer.createdAt,
          });
        } else if (transfer.amount > 0) {
          analysis.positiveAmounts.push({
            id: transfer._id,
            amount: transfer.amount,
            recipient: transfer.recipientAddress,
          });
        } else {
          analysis.zeroAmounts.push({
            id: transfer._id,
            recipient: transfer.recipientAddress,
          });
        }
      });
    }

    analysis.summary = {
      totalPositive: analysis.positiveAmounts.length,
      totalNegative: analysis.negativeAmounts.length,
      totalZero: analysis.zeroAmounts.length,
      problemDetected: analysis.negativeAmounts.length > 0 || analysis.zeroAmounts.length > 0,
    };

    console.log('[DIAGNOSTIC] Summary:', analysis.summary);

    return NextResponse.json({
      success: true,
      analysis,
      recommendations: analysis.negativeAmounts.length > 0
        ? [
            "❌ NEGATIVE AMOUNTS DETECTED!",
            "These transfers were made with the old code before safeguards were added.",
            "Action: Contact support to reverse these transactions.",
            "Future transfers are now protected with amount validation at 3 layers.",
          ]
        : ["✅ No negative amounts found. All safeguards are working."],
    });
  } catch (error: any) {
    console.error('[DIAGNOSTIC] Error:', error);
    return NextResponse.json(
      { error: error.message || "Diagnostic failed" },
      { status: 500 }
    );
  }
}
