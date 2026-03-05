'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function AdminReports() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<'user' | 'revenue' | 'transaction' | 'activity'>('user');

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem('admin_token');
    if (token) {
      setAdminToken(token);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (!adminToken) {
      router.push('/admin-login');
    }
  }, [isMounted, adminToken, router]);
  // Fetch real data from Convex (hooks must run unconditionally)
  const users = useQuery(api.user.getAllUsers) || [];
  const transactions = useQuery(api.transaction.getAllTransactions) || [];
  const totalDeposits = transactions.filter((t: any) => t.type === 'deposit').reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const pendingTx = transactions.filter((t: any) => t.status === 'pending').length;

  if (!isMounted || !adminToken) {
    return <div className="text-center py-32">Loading...</div>;
  }

  const reportTypes = [
    { id: 'user', label: 'User Report', icon: '👥', description: 'Detailed user statistics and information' },
    { id: 'revenue', label: 'Revenue Report', icon: '💰', description: 'Financial performance and earnings' },
    { id: 'transaction', label: 'Transaction Report', icon: '💳', description: 'All transactions and movements' },
    { id: 'activity', label: 'Activity Report', icon: '🔔', description: 'System activity and events' },
  ];

  // Build daily reports (last 7 days) from transactions
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const dayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime() - (6 - i) * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const dayTx = transactions.filter((t: any) => (t.createdAt || now) >= dayStart && (t.createdAt || now) < dayEnd);
    const depositsCount = dayTx.filter((t: any) => t.type === 'deposit').length;
    const withdrawalsCount = dayTx.filter((t: any) => t.type === 'withdrawal').length;
    const depositsSum = dayTx.filter((t: any) => t.type === 'deposit').reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const withdrawalsSum = dayTx.filter((t: any) => t.type === 'withdrawal').reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const failed = dayTx.filter((t: any) => t.status === 'failed').length;
    const activeUsers = new Set(dayTx.map((t: any) => String(t.userId))).size;
    return {
      date: fmt(new Date(dayStart)),
      newUsers: 'N/A',
      activeUsers,
      retention: 'N/A',
      avgSessionTime: 'N/A',
      depositsCount,
      withdrawalsCount,
      depositsSum,
      withdrawalsSum,
      failed,
      totalValue: depositsSum - withdrawalsSum,
    };
  });

  const userReportData = last7.map(d => ({ date: d.date, newUsers: d.newUsers, activeUsers: d.activeUsers, retention: d.retention, avgSessionTime: d.avgSessionTime }));
  const revenueReportData = last7.map(d => ({ date: d.date, deposits: `$${d.depositsSum.toLocaleString()}`, withdrawals: `$${d.withdrawalsSum.toLocaleString()}`, commissions: '$0', profit: `$${(d.depositsSum - d.withdrawalsSum).toLocaleString()}` }));
  const transactionReportData = last7.map(d => ({ date: d.date, deposits: d.depositsCount, withdrawals: d.withdrawalsCount, commissions: 0, failed: d.failed, total: `$${d.totalValue.toLocaleString()}` }));

  return (
    <div className="p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Reports</h1>
          <p className="text-lg text-gray-600">Generate and download detailed reports</p>
        </div>

        {/* Report Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {reportTypes.map((report) => (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report.id as any)}
              className={`p-6 rounded-xl border-2 transition text-left ${
                selectedReport === report.id
                  ? 'bg-gradient-to-br from-red-50 to-pink-50 border-red-500'
                  : 'bg-white border-gray-200 hover:border-red-300'
              }`}
            >
              <div className="text-3xl mb-3">{report.icon}</div>
              <h3 className="font-bold text-gray-900 mb-1">{report.label}</h3>
              <p className="text-sm text-gray-600">{report.description}</p>
            </button>
          ))}
        </div>

        {/* Report Content */}
        <div className="bg-white rounded-2xl p-8 shadow-lg mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              {reportTypes.find(r => r.id === selectedReport)?.label}
            </h2>
            <div className="flex gap-3">
              <button className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition">
                📋 Copy
              </button>
              <button className="px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg transition">
                ⬇ Download CSV
              </button>
            </div>
          </div>

          {/* User Report */}
          {selectedReport === 'user' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Date</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">New Users</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Active Users</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Retention</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Avg Session</th>
                  </tr>
                </thead>
                <tbody>
                  {userReportData.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-700">{row.date}</td>
                      <td className="px-6 py-4 font-semibold text-green-600">{row.newUsers}</td>
                      <td className="px-6 py-4 font-semibold text-blue-600">{row.activeUsers}</td>
                      <td className="px-6 py-4 font-semibold text-purple-600">{row.retention}</td>
                      <td className="px-6 py-4 text-gray-700">{row.avgSessionTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Revenue Report */}
          {selectedReport === 'revenue' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Date</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Deposits</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Withdrawals</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Commissions</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueReportData.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-700">{row.date}</td>
                      <td className="px-6 py-4 font-semibold text-green-600">{row.deposits}</td>
                      <td className="px-6 py-4 font-semibold text-red-600">{row.withdrawals}</td>
                      <td className="px-6 py-4 font-semibold text-blue-600">{row.commissions}</td>
                      <td className="px-6 py-4 font-semibold text-purple-600">{row.profit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Transaction Report */}
          {selectedReport === 'transaction' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Date</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Deposits</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Withdrawals</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Commissions</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Failed</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-900">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionReportData.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-700">{row.date}</td>
                      <td className="px-6 py-4 font-semibold text-green-600">{row.deposits}</td>
                      <td className="px-6 py-4 font-semibold text-red-600">{row.withdrawals}</td>
                      <td className="px-6 py-4 font-semibold text-blue-600">{row.commissions}</td>
                      <td className="px-6 py-4 font-semibold text-orange-600">{row.failed}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Activity Report */}
          {selectedReport === 'activity' && (
            <div className="space-y-4">
              {transactions
                .slice()
                .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
                .slice(0, 8)
                .map((t: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <span className="text-sm font-semibold text-gray-600 min-w-[120px]">{new Date(t.createdAt || Date.now()).toLocaleString()}</span>
                    <span className="flex-1 text-gray-700">{t.type === 'deposit' ? `Deposit $${(t.amount || 0).toLocaleString()} by User ${String(t.userId)}` : `Withdrawal $${(t.amount || 0).toLocaleString()} by User ${String(t.userId)}`}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      t.status === 'completed' ? 'bg-green-100 text-green-700' : t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {t.status === 'completed' ? '✓ Completed' : t.status === 'pending' ? '⏳ Pending' : '✗ Failed'}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
            <p className="text-gray-600 text-sm font-semibold mb-2">Total Users</p>
            <p className="text-3xl font-bold text-gray-900">{users.length}</p>
            <p className="text-green-600 font-semibold text-sm mt-2">&nbsp;</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
            <p className="text-gray-600 text-sm font-semibold mb-2">Total Deposits</p>
            <p className="text-3xl font-bold text-gray-900">${totalDeposits.toLocaleString()}</p>
            <p className="text-green-600 font-semibold text-sm mt-2">&nbsp;</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
            <p className="text-gray-600 text-sm font-semibold mb-2">Transactions</p>
            <p className="text-3xl font-bold text-gray-900">{transactions.length}</p>
            <p className="text-green-600 font-semibold text-sm mt-2">&nbsp;</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-200">
            <p className="text-gray-600 text-sm font-semibold mb-2">Pending Items</p>
            <p className="text-3xl font-bold text-gray-900">{pendingTx}</p>
            <p className="text-orange-600 font-semibold text-sm mt-2">&nbsp;</p>
          </div>
        </div>
      </div>
    </div>
  );
}
