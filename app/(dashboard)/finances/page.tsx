'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/convex/_generated/api';

export default function FinancesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  const user = useQuery(api.user.getUserByContact, { contact: session?.user?.contact || '' });
  const transactions = useQuery(api.transaction.getTransactionHistory, { userId: (session as any)?.user?.id || '' });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
    }
  }, [status, router]);

  if (!isMounted || status === 'loading' || user === undefined) {
    return <div className="text-center py-32">Loading...</div>;
  }

  if (!session || !user) {
    return (
      <main className="font-montserrat text-gray-800 overflow-x-hidden bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-lg text-gray-600 mb-8">Please sign in to access your finances.</p>
          <Link
            href="/sign-in"
            className="inline-block px-8 py-3 bg-cyan-500 text-white font-semibold rounded-full hover:bg-cyan-600 transition-all"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  // Calculate transaction stats
  const stats = {
    deposits: transactions?.filter((t: any) => t.type === 'deposit' && t.status === 'completed').reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0,
    withdrawals: transactions?.filter((t: any) => t.type === 'withdrawal' && t.status === 'completed').reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0,
    pending: transactions?.filter((t: any) => t.status === 'pending').reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0,
    earnings: (transactions ? (
      transactions.filter((t: any) => t.type === 'deposit' && t.status === 'completed').reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
      - transactions.filter((t: any) => t.type === 'withdrawal' && t.status === 'completed').reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    ) : 0),
  };

  const filteredTransactions = transactions?.filter((t: any) => t.status === 'completed') || [];

  const getTransactionIcon = (type: string) => {
    switch(type) {
      case 'deposit': return '📥';
      case 'withdrawal': return '📤';
      case 'earnings': return '💰';
      default: return '💳';
    }
  };

  const getTransactionColor = (type: string) => {
    switch(type) {
      case 'deposit': return 'from-green-500 to-emerald-500';
      case 'withdrawal': return 'from-red-500 to-pink-500';
      case 'earnings': return 'from-blue-500 to-cyan-500';
      default: return 'from-gray-500 to-slate-500';
    }
  };

  return (
    <main className="font-montserrat text-gray-800 overflow-x-hidden bg-gray-50 min-h-screen">
    

      {/* Main Content */}
      <div className="pt-24 px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-12">
            <h2 className="text-5xl font-bold text-gray-900 mb-2">Finances</h2>
            <p className="text-xl text-gray-600">Manage your account balance and transactions</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Total Balance */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition border-l-4 border-emerald-500">
              <div className="text-gray-600 text-sm font-semibold mb-2">Total Balance</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">${(user?.depositAmount || 0).toFixed(2)}</div>
              <p className="text-xs text-gray-500">Available funds</p>
            </div>

            {/* Total Deposits */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition border-l-4 border-green-500">
              <div className="text-gray-600 text-sm font-semibold mb-2">Total Deposits</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">${user?.depositAmount?.toLocaleString()}</div>
              <p className="text-xs text-gray-500">Amount deposited</p>
            </div>

            {/* Total Withdrawals */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition border-l-4 border-red-500">
              <div className="text-gray-600 text-sm font-semibold mb-2">Total Withdrawals</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">${stats.withdrawals.toFixed(2)}</div>
              <p className="text-xs text-gray-500">Amount withdrawn</p>
            </div>

            {/* Total Earnings */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition border-l-4 border-cyan-500">
              <div className="text-gray-600 text-sm font-semibold mb-2">Total Earnings</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">${user.earnings?.toFixed(2)}</div>
              <p className="text-xs text-gray-500">Commissions earned</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Link href="/deposit" className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-8 text-white shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-2xl font-bold mb-2">Deposit</h3>
              <p>Add funds to your account</p>
            </Link>

            <Link href="/withdraw" className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-8 text-white shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
              <div className="text-4xl mb-4">💸</div>
              <h3 className="text-2xl font-bold mb-2">Withdraw</h3>
              <p>Cash out your earnings</p>
            </Link>
          </div>

          {/* Transaction Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Pending Transactions */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h4 className="text-lg font-bold text-gray-900 mb-4">Pending</h4>
              <div className="text-3xl font-bold text-orange-600">${stats.pending.toFixed(2)}</div>
              <p className="text-sm text-gray-600 mt-2">Transactions awaiting confirmation</p>
            </div>

            {/* Monthly Stats */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h4 className="text-lg font-bold text-gray-900 mb-4">This Month</h4>
              <div className="text-3xl font-bold text-blue-600">${((stats.deposits + stats.earnings) - stats.withdrawals).toFixed(2)}</div>
              <p className="text-sm text-gray-600 mt-2">Net income this month</p>
            </div>

            {/* Account Status */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h4 className="text-lg font-bold text-gray-900 mb-4">Account Status</h4>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-semibold">Active</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Account in good standing</p>
            </div>
          </div>

          {/* Transaction History Section */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold text-gray-900">Transaction History</h3>
              <Link href="/finances?filter=all" className="px-6 py-2 text-emerald-600 font-semibold hover:bg-emerald-50 rounded-lg transition">
                View All
              </Link>
            </div>

            {filteredTransactions && filteredTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">Type</th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">Amount</th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">Network</th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.slice(0, 10).map((tx: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="py-4 px-4">
                          <span className="text-2xl">{getTransactionIcon(tx.type)}</span>
                          {' '}
                          <span className="font-semibold text-gray-900 capitalize">{tx.type}</span>
                        </td>
                        <td className="py-4 px-4 font-bold text-gray-900">${(tx.amount || 0).toFixed(2)}</td>
                        <td className="py-4 px-4 text-gray-600 capitalize">{tx.network || 'N/A'}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                            tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {tx.status?.charAt(0).toUpperCase() + tx.status?.slice(1)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-600">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">No transactions yet</p>
                <p className="text-gray-500 mt-2">Your transaction history will appear here</p>
              </div>
            )}
          </div>

          {/* Finance Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-8 border-2 border-cyan-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4">💡 Finance Tips</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-cyan-600 font-bold">✓</span>
                  <span className="text-gray-700">Keep your balance above the minimum equipment cost to start tasks</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-600 font-bold">✓</span>
                  <span className="text-gray-700">Monitor pending transactions - they'll update within 24 hours</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-600 font-bold">✓</span>
                  <span className="text-gray-700">Your team earnings are automatically added to your balance</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-8 border-2 border-emerald-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4">📊 Account Overview</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Account Active Since:</span>
                  <span className="font-semibold text-gray-900">{user?._creationTime ? new Date(user._creationTime).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Total Transactions:</span>
                  <span className="font-semibold text-gray-900">{filteredTransactions?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Account Status:</span>
                  <span className="font-semibold text-green-600">✓ Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-8 mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-8">
          <div>
            <h4 className="font-bold text-lg mb-4">ANDES</h4>
            <p className="text-gray-400 text-sm">Global sharing economy platform</p>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-4">Navigation</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="/dashboard" className="hover:text-cyan-400 transition">Dashboard</Link></li>
              <li><Link href="/finances" className="hover:text-cyan-400 transition">Finances</Link></li>
              <li><Link href="/team" className="hover:text-cyan-400 transition">Team</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-4">Account</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="/profile" className="hover:text-cyan-400 transition">Profile</Link></li>
              <li><Link href="/deposit" className="hover:text-cyan-400 transition">Deposit</Link></li>
              <li><Link href="/withdraw" className="hover:text-cyan-400 transition">Withdraw</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="https://t.me/andes" className="hover:text-cyan-400 transition">Telegram</a></li>
              <li><a href="https://youtube.com/andes" className="hover:text-cyan-400 transition">YouTube</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; 2026 ANDES. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
