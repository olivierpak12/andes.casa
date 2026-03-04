import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getTronWeb, getAccountBalance } from '@/lib/tron/utils';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user?.contact) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is admin
        const user = await convex.query(api.user.getUserByContact, {
            contact: session.user.contact,
        });

        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        // 1. Get hot wallet balance
        const privateKey = process.env.TRON_PRIVATE_KEY;
        if (!privateKey) {
            return NextResponse.json(
                { error: 'Server configuration: Missing hot wallet key' },
                { status: 500 }
            );
        }

        const tronWeb = getTronWeb();
        const hotAddress = tronWeb.address.fromPrivateKey(privateKey);
        const hotWalletBal = await getAccountBalance(hotAddress);

        // 2. Get all users and their balances
        const users = await convex.query(api.user.getAllUsers, {});
        
        let totalUserDeposits = 0;
        let totalUserEarnings = 0;
        let totalTransferredOut = 0;
        let totalLockedPrincipal = 0;
        for (const u of users) {
            // Users have: depositAmount (principal remaining), earnings (rewards), transferredOut, and lockedPrincipal (invested)
            const depositAmount = u.depositAmount || 0;
            const earnings = u.earnings || 0;
            const transferred = u.transferredOut || 0;
            const locked = u.lockedPrincipal || 0;
            
            totalUserDeposits += depositAmount;
            totalUserEarnings += earnings;
            totalTransferredOut += transferred;
            totalLockedPrincipal += locked;
        }
        const totalUserBalances = totalUserDeposits + totalUserEarnings;

        // 3. Get all transactions
        const transactions = await convex.query(api.transaction.getAllTransactions, {});

        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let pendingWithdrawals = 0;

        for (const tx of transactions) {
            if (tx.type === 'deposit' && tx.status === 'completed') {
                totalDeposits += tx.amount || 0;
            } else if (tx.type === 'withdrawal' && tx.status === 'completed') {
                totalWithdrawals += tx.amount || 0;
            } else if (tx.type === 'withdrawal' && tx.status === 'pending') {
                pendingWithdrawals += tx.amount || 0;
            }
        }

        const netFlows = totalDeposits - totalWithdrawals;
        const totalAccounted = hotWalletBal.usdt + totalUserDeposits + totalUserEarnings + totalTransferredOut + totalLockedPrincipal;
        const discrepancy = Math.abs(netFlows - totalAccounted);
        const fundingRequired = (totalUserBalances + totalLockedPrincipal) - hotWalletBal.usdt;

        return NextResponse.json({
            success: true,
            hotWallet: {
                address: hotAddress,
                trx: hotWalletBal.trx,
                usdt: hotWalletBal.usdt,
            },
            userAccounts: {
                totalUsers: users.length,
                totalDeposits: totalUserDeposits,
                totalEarnings: totalUserEarnings,
                totalTransferredOut: totalTransferredOut,
                totalBalances: totalUserBalances,
                totalLocked: totalLockedPrincipal,
                totalFunds: totalUserBalances + totalLockedPrincipal + totalTransferredOut,
            },
            transactions: {
                totalDeposits,
                totalWithdrawals,
                pendingWithdrawals,
                totalCompleted: transactions.length,
            },
            summary: {
                netFlows: netFlows,
                hotWalletBalance: hotWalletBal.usdt,
                userBalances: totalUserBalances,
                totalAccounted: totalAccounted,
                discrepancy: discrepancy,
                fundingRequired: fundingRequired > 0 ? fundingRequired : 0,
                status: discrepancy < 0.1 ? 'OK' : 'MISMATCH',
            },
        });

    } catch (error: any) {
        console.error('Audit API error:', error);
        return NextResponse.json(
            { error: error.message || 'Audit failed' },
            { status: 500 }
        );
    }
}
