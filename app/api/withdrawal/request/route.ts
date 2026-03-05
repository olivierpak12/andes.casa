// app/api/withdrawal/request/route.ts
// Create a withdrawal request for non-TRC20 networks

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  // Withdrawals are now only supported on Tron (TRC20).
  // The old endpoint for polygon/bep20/erc20 is deprecated.
  return NextResponse.json(
    { error: 'Deprecated: use /api/tron/withdraw for TRC20 withdrawals only' },
    { status: 400 }
  );
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/withdrawal/request',
    method: 'POST',
    description: 'Deprecated endpoint. Use /api/tron/withdraw instead; only TRC20 supported.',
  });
}
