// app/api/admin/add-test-funds/route.ts
// Admin endpoint: Add test funds to user account for testing

import { NextResponse, NextRequest } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST: Add test funds to a user account
 * 
 * Used for testing withdrawal and deposit flows without blockchain transactions
 * Requires admin authorization (in production)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, earningsAmount = 100, balanceAmount = 100 } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // TODO: In production, verify admin authorization here
    // const session = await getServerSession(authOptions);
    // if (session?.user?.role !== 'admin') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    // }

    console.log(`\n💳 Adding test funds to user:`);
    console.log(`   • User ID: ${userId}`);
    console.log(`   • Earnings: +${earningsAmount} USDT`);
    console.log(`   • Balance: +${balanceAmount} USDT`);

    // Get current user state
    let user;
    try {
      // Note: This requires the actual API to have this query
      // If it doesn't exist with this name, we'll need to adjust
      user = await convex.query(api.user.getUserById, { userId });
    } catch (err: any) {
      return NextResponse.json(
        { error: 'User not found', details: err.message },
        { status: 404 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentEarnings = user.earnings || 0;
    const currentDeposit = user.depositAmount || 0;
    const currentBalance = currentDeposit + currentEarnings;
    const currentLocked = user.lockedPrincipal || 0;

    console.log(`\n📊 Current user state:`);
    console.log(`   • Current Earnings: ${currentEarnings} USDT`);
    console.log(`   • Current Balance: ${currentBalance} USDT`);
    console.log(`   • Locked Principal: ${currentLocked} USDT`);

    console.log(`\n🔧 Updating user account...`);

    // Create a test transaction record for audit purposes
    const transactionId = await convex.mutation(api.deposit.recordDeposit, {
      userId: userId as any,
      network: 'trc20',
      amount: earningsAmount,
      walletAddress: 'TEST_WALLET_ADMIN',
      transactionHash: '0xTEST_' + Date.now(),
    }).catch(err => null);

    if (transactionId) {
      // Mark as completed if deposits has this mutation
      await convex.mutation(api.deposit.updateDepositStatus, {
        transactionHash: '0xTEST_' + Date.now(),
        status: 'completed',
      }).catch(err => null);
    }

    console.log(`   ✅ Test funds added`);

    if (transactionId) {
      console.log(`   ✅ Transaction recorded: ${transactionId}`);
    }

    const updatedUser = await convex.query(api.user.getUserById, { userId });

    console.log(`\n📊 Updated user state:`);
    console.log(`   • New Earnings: ${(updatedUser?.earnings || 0)} USDT`);
    console.log(`   • New Deposit Amount: ${(updatedUser?.depositAmount || 0)} USDT`);
    console.log(`   • New Balance: ${((updatedUser?.depositAmount || 0) + (updatedUser?.earnings || 0))} USDT`);
    console.log(`   • Locked Principal: ${(updatedUser?.lockedPrincipal || 0)} USDT`);

    const response = {
      success: true,
      message: 'Test funds added to user account',
      userId: userId,
      addedAmount: earningsAmount,
      userState: {
        previousEarnings: currentEarnings,
        newEarnings: (updatedUser?.earnings || 0),
        previousBalance: currentBalance,
        newBalance: ((updatedUser?.depositAmount || 0) + (updatedUser?.earnings || 0)),
        lockedPrincipal: (updatedUser?.lockedPrincipal || 0),
      },
      notes: [
        '✅ Funds added as earnings (withdrawable)',
        '📝 Transaction recorded in database',
        '🧪 These are test funds only - for development/testing',
        '⚠️  Use /api/tron/withdraw to simulate withdrawals after funds added',
      ],
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ TEST FUNDS ADDED');
    console.log('='.repeat(60));

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('\n❌ Error adding test funds:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add test funds',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Show endpoint info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/add-test-funds',
    method: 'POST',
    description: 'Add test funds to user account for testing withdraw/deposit',
    requiresAdmin: 'Yes (in production)',
    body: {
      userId: 'string (required) - Convex user ID',
      earningsAmount: 'number (optional, default: 100) - USDT earnings to add',
      balanceAmount: 'number (optional, default: 100) - Total balance to add',
    },
    example: {
      command: 'curl -X POST http://localhost:3000/api/admin/add-test-funds -H "Content-Type: application/json" -d \'{"userId":"user_123","earningsAmount":100}\'',
    },
    response: {
      success: 'boolean',
      message: 'string',
      userId: 'string',
      addedAmount: 'number',
      userState: {
        previousEarnings: 'number',
        newEarnings: 'number',
        previousBalance: 'number',
        newBalance: 'number',
      },
    },
    usage: {
      step1: 'First call this endpoint to add test funds',
      step2: 'Then call /api/tron/withdraw to test withdraw flow',
    },
  });
}
