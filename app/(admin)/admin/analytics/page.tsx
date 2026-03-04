'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function AdminAnalytics() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'overview' | 'users' | 'revenue' | 'growth'>('overview');
  // Fetch real data from Convex (hooks must run unconditionally)
  const users = useQuery(api.user.getAllUsers) || [];
  const transactions = useQuery(api.transaction.getAllTransactions) || [];

  const isAdmin = session?.user?.role === 'admin' || adminToken !== null;

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem('admin_token');
    if (token) {
      setAdminToken(token);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
    }
  }, [status, router]);

  useEffect(() => {
    if (isMounted && !isAdmin && status !== 'loading') {
      router.push('/dashboard');
    }
  }, [isMounted, isAdmin, status, router]);

  if (!isMounted || status === 'loading') {
    return <div className="text-center py-32">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <main className="font-montserrat text-gray-800 overflow-x-hidden bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <Link href="/dashboard" className="inline-block px-8 py-3 bg-cyan-500 text-white font-semibold rounded-full hover:bg-cyan-600 transition-all">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // Calculate real analytics
  const totalUsers = users.length;
  const totalBalance = users.reduce((sum: number, u: any) => sum + (u.balance || 0), 0);
  const deposits = transactions.filter((t: any) => t.type === 'deposit');
  const withdrawals = transactions.filter((t: any) => t.type === 'withdrawal');
  const totalDeposits = deposits.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const totalWithdrawals = withdrawals.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const pendingTx = transactions.filter((t: any) => t.status === 'pending').length;
  const completedTx = transactions.filter((t: any) => t.status === 'completed').length;
  const avgTransaction = transactions.length > 0 ? (totalDeposits + totalWithdrawals) / transactions.length : 0;

  // Helper: time windows
  const now = Date.now();
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const daysAgo = (d: number) => now - d * 24 * 60 * 60 * 1000;

  // Active users based on transactions (distinct userIds)
  const txByUser = new Map<string, number[]>();
  transactions.forEach((t: any) => {
    const uid = String(t.userId);
    if (!txByUser.has(uid)) txByUser.set(uid, []);
    txByUser.get(uid)!.push(t.createdAt || now);
  });

  const distinctUsers = Array.from(txByUser.keys()).length;
  const activeToday = Array.from(txByUser.entries()).filter(([, times]) => times.some(ts => ts >= startOfDay)).length;
  const activeWeek = Array.from(txByUser.entries()).filter(([, times]) => times.some(ts => ts >= daysAgo(7))).length;
  const activeMonth = Array.from(txByUser.entries()).filter(([, times]) => times.some(ts => ts >= daysAgo(30))).length;

  // Retention: users active in last30 vs previous30
  const inLast30 = new Set<string>(Array.from(txByUser.entries()).filter(([, times]) => times.some(ts => ts >= daysAgo(30))).map(([u]) => u));
  const inPrev30 = new Set<string>(Array.from(txByUser.entries()).filter(([, times]) => times.some(ts => ts >= daysAgo(60) && ts < daysAgo(30))).map(([u]) => u));
  const retained = inPrev30.size > 0 ? Math.round((Array.from(inLast30).filter(u => inPrev30.has(u)).length / inPrev30.size) * 100) : null;

  // Weekly buckets for the last 9 weeks
  const weeks = Array.from({ length: 9 }).map((_, i) => {
    const start = daysAgo((8 - i) * 7);
    const end = daysAgo((7 - i) * 7);
    const weekTx = transactions.filter((t: any) => (t.createdAt || now) >= start && (t.createdAt || now) < end);
    const weekRevenue = weekTx.filter((t: any) => t.type === 'deposit').reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const weekActive = new Set(weekTx.map((t: any) => String(t.userId))).size;
    return { weekRevenue, weekActive };
  });

  const analyticsData = {
    overview: [
      { label: 'Total Users', value: totalUsers.toString(), change: null, trend: 'up' },
      { label: 'Active Users (30d)', value: Array.from(inLast30).length.toString(), change: null, trend: 'up' },
      { label: 'Total Transactions', value: transactions.length.toString(), change: null, trend: 'up' },
      { label: 'Total Deposits', value: '$' + totalDeposits.toLocaleString(), change: null, trend: 'up' },
      { label: 'Total Withdrawals', value: '$' + totalWithdrawals.toLocaleString(), change: null, trend: 'up' },
      { label: 'Pending Transactions', value: pendingTx.toString(), change: null, trend: 'down' },
    ],
    users: [
      { label: 'Active Users (Today)', value: activeToday.toString(), change: null, trend: 'up' },
      { label: 'Active Users (Week)', value: activeWeek.toString(), change: null, trend: 'up' },
      { label: 'Active Users (Month)', value: activeMonth.toString(), change: null, trend: 'up' },
      { label: 'User Retention (30d)', value: retained !== null ? `${retained}%` : 'N/A', change: null, trend: 'up' },
      { label: 'User Dropout', value: 'N/A', change: null, trend: 'down' },
      { label: 'Avg Session Time', value: 'N/A', change: null, trend: 'up' },
    ],
    revenue: [
      { label: 'Total Deposits', value: '$' + totalDeposits.toLocaleString(), change: null, trend: 'up' },
      { label: 'Total Withdrawals', value: '$' + totalWithdrawals.toLocaleString(), change: null, trend: 'up' },
      { label: 'Avg Transaction', value: '$' + Math.round(avgTransaction).toLocaleString(), change: null, trend: 'up' },
      { label: 'Pending Transactions', value: pendingTx.toString(), change: null, trend: 'down' },
      { label: 'Distinct Transacting Users', value: distinctUsers.toString(), change: null, trend: 'up' },
      { label: 'System Balance', value: '$' + totalBalance.toLocaleString(), change: null, trend: 'up' },
    ],
    growth: weeks.map((w, idx) => ({ label: `Week ${idx + 1}`, value: `$${Math.round(w.weekRevenue).toLocaleString()}`, change: null, trend: 'up' })),
  };

  const currentData = analyticsData[reportType];

  return (
    <main className="font-montserrat text-gray-800 overflow-x-hidden bg-gray-50 min-h-screen">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-white shadow-lg z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
              ⚙️
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ANDES Admin</h1>
              <p className="text-xs text-gray-600">Analytics & Reports</p>
            </div>
          </div>

          <ul className="hidden lg:flex gap-8 items-center list-none">
            <li><Link href="/admin/dashboard" className="text-gray-700 font-medium hover:text-red-600 transition">Dashboard</Link></li>
            <li><Link href="/admin/users" className="text-gray-700 font-medium hover:text-red-600 transition">Users</Link></li>
            <li><Link href="/admin/transactions" className="text-gray-700 font-medium hover:text-red-600 transition">Transactions</Link></li>
            <li><Link href="/admin/analytics" className="text-red-600 font-bold border-b-2 border-red-600">Analytics</Link></li>
            <li><Link href="/admin/settings" className="text-gray-700 font-medium hover:text-red-600 transition">Settings</Link></li>
          </ul>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Analytics & Reports</h2>
              <p className="text-lg text-gray-600">System performance and detailed metrics</p>
            </div>
            <button className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-lg hover:shadow-lg transition">
              ⬇ Download Report
            </button>
          </div>

          {/* Report Type Selector */}
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Select Report Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['overview', 'users', 'revenue', 'growth'].map(type => (
                <button
                  key={type}
                  onClick={() => setReportType(type as any)}
                  className={`px-6 py-3 rounded-lg font-semibold transition ${
                    reportType === type 
                      ? 'bg-red-500 text-white shadow-lg' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Analytics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {currentData.map((metric, idx) => (
              <div key={idx} className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-gray-600 text-sm font-semibold mb-2">{metric.label}</div>
                    <div className="text-3xl font-bold text-gray-900">{metric.value}</div>
                  </div>
                  <div className={`text-2xl ${metric.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                    {metric.trend === 'up' ? '📈' : '📉'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {metric.change}
                  </span>
                  <span className="text-gray-600 text-sm">from last period</span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* User Growth Chart */}
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">User Growth Trend</h3>
              <div className="h-64 flex items-end gap-2">
                {weeks.map((w, idx) => {
                  const vals = weeks.map(x => x.weekActive);
                  const max = Math.max(...vals, 1);
                  const height = Math.round((w.weekActive / max) * 100);
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-lg hover:opacity-80 transition cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`Week ${idx + 1}: ${w.weekActive} active users`}
                    />
                  );
                })}
              </div>
              <div className="mt-4 text-center text-sm text-gray-600">
                <p>Active transacting users over the last 9 weeks</p>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Revenue Trend</h3>
              <div className="h-64 flex items-end gap-2">
                {weeks.map((w, idx) => {
                  const vals = weeks.map(x => x.weekRevenue);
                  const max = Math.max(...vals, 1);
                  const height = Math.round((w.weekRevenue / max) * 100);
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-gradient-to-t from-green-500 to-emerald-400 rounded-t-lg hover:opacity-80 transition cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`Week ${idx + 1}: $${Math.round(w.weekRevenue)}`}
                    />
                  );
                })}
              </div>
              <div className="mt-4 text-center text-sm text-gray-600">
                <p>Deposits over the last 9 weeks</p>
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 border-2 border-blue-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4">📊 Key Insights</h4>
              <ul className="space-y-2">
                <li className="text-gray-700">• Deposits (30d): $ {Math.round(weeks.slice(-4).reduce((s, w) => s + w.weekRevenue, 0)).toLocaleString()}</li>
                <li className="text-gray-700">• Active users (30d): {activeMonth}</li>
                <li className="text-gray-700">• Pending transactions: {pendingTx}</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border-2 border-green-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4">💰 Financial Health</h4>
              <ul className="space-y-2">
                <li className="text-gray-700">• Cash flow positive</li>
                <li className="text-gray-700">• Operating expenses stable</li>
                <li className="text-gray-700">• Profit margin at 28%</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border-2 border-purple-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4">🎯 Forecast</h4>
              <ul className="space-y-2">
                <li className="text-gray-700">• Q1 target: +150% growth</li>
                <li className="text-gray-700">• 3,500 users by end Q1</li>
                <li className="text-gray-700">• $4M+ revenue projected</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
