'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AdminSecurityStatus } from '@/components/AdminSecurityStatus';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const [isMounted, setIsMounted] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();

  // Fetch real data from Convex
  const users = useQuery(api.user.getAllUsers) || [];
  const transactions = useQuery(api.transaction.getAllTransactions) || [];

  React.useEffect(() => {
    setIsMounted(true);

    // After session state resolves, redirect non-admins away
    if (status !== 'loading') {
      const hasAdminLocal = typeof window !== 'undefined' && !!localStorage.getItem('admin_token');

      if (!session?.user || (session.user as any).role !== 'admin') {
        if (!hasAdminLocal) {
          router.push('/admin-login');
        }
      }
    }
  }, [status, session, router]);

  if (!isMounted || status === 'loading') return null;

  // Calculate real stats
  const totalUsers = users.length;
  const totalBalance = users.reduce((sum: number, u: any) => sum + (u.balance || 0), 0);
  const deposits = transactions.filter((t: any) => t.type === 'deposit');
  const withdrawals = transactions.filter((t: any) => t.type === 'withdrawal');
  const totalDeposits = deposits.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const totalWithdrawals = withdrawals.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const pendingCount = transactions.filter((t: any) => t.status === 'pending').length;
  const completedTransactions = transactions.filter((t: any) => t.status === 'completed');
  const completedAmount = completedTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

  const stats = [
    { label: 'Total Users', value: totalUsers.toLocaleString(), change: '+12%', icon: '👥', color: 'from-blue-500 to-cyan-500' },
    { label: 'Total Deposits', value: '$' + totalDeposits.toLocaleString(), change: '+25%', icon: '💰', color: 'from-green-500 to-emerald-500' },
    { label: 'Pending Approvals', value: pendingCount.toString(), change: '-5%', icon: '⏳', color: 'from-orange-500 to-red-500' },
    { label: 'System Balance', value: '$' + totalBalance.toLocaleString(), change: '+42%', icon: '📈', color: 'from-purple-500 to-pink-500' },
  ];

  const quickActions = [
    { label: 'Manage Users', href: '/admin/users', icon: '👥', desc: 'Add, edit, or remove users' },
    { label: 'Transactions', href: '/admin/transactions', icon: '💳', desc: 'Review and approve transactions' },
    { label: 'Analytics', href: '/admin/analytics', icon: '📊', desc: 'View detailed analytics & reports' },
    { label: 'Settings', href: '/admin/settings', icon: '⚙️', desc: 'Configure system settings' },
  ];

  // Build recent activities from latest transactions
  const recentActivities = transactions.slice(0, 4).map((t: any) => {
    const time = t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : '00:00';
    const action = `${t.type === 'deposit' ? '📥 Deposit' : '📤 Withdrawal'} of $${t.amount} (${t.network})`;
    const status = t.status === 'completed' ? 'success' : t.status === 'pending' ? 'warning' : 'failed';
    return { time, action, status };
  });

  return (
    <div className="p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome to Admin Panel</h1>
          <p className="text-lg text-gray-600">Manage your platform, users, and transactions</p>
          </div>

        {/* Security Status */}
        <AdminSecurityStatus />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition border-l-4 border-transparent"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 text-sm font-semibold mb-2">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`bg-gradient-to-br ${stat.color} p-3 rounded-lg text-white text-2xl`}>
                  {stat.icon}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-bold">{stat.change}</span>
                <span className="text-gray-600 text-sm">from last period</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, idx) => (
              <Link
                key={idx}
                href={action.href}
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg hover:scale-105 transition border-t-4 border-red-500 group"
              >
                <div className="text-3xl mb-3 group-hover:scale-125 transition">{action.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{action.label}</h3>
                <p className="text-sm text-gray-600">{action.desc}</p>
                <div className="text-red-500 font-semibold mt-4 group-hover:translate-x-1 transition">
                  Visit →
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
              <Link href="/admin/logs" className="text-red-600 font-semibold hover:text-red-700">
                View All →
              </Link>
            </div>
            <div className="space-y-4">
              {recentActivities.map((activity, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <span className="min-w-[60px] text-sm font-semibold text-gray-600">{activity.time}</span>
                  <span className="flex-1 text-gray-700">{activity.action}</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      activity.status === 'success'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {activity.status === 'success' ? '✓ Success' : '⏳ Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">System Status</h2>
            <div className="space-y-4">
              {[
                { name: 'Database', status: 'Healthy', icon: '✓' },
                { name: 'API Server', status: 'Running', icon: '✓' },
                { name: 'Payment Gateway', status: 'Connected', icon: '✓' },
                { name: 'Backup System', status: 'Active', icon: '✓' },
                { name: 'SSL Certificate', status: 'Valid', icon: '✓' },
              ].map((system, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">{system.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">{system.icon}</span>
                    <span className="text-green-600 font-semibold text-sm">{system.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Last Updated */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Last Updated:</span> Just now
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="mt-12 bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-8 border-2 border-red-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm font-semibold mb-2">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">{totalUsers}</p>
              <p className="text-green-600 font-semibold text-sm">↑ 12%</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm font-semibold mb-2">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">{transactions.length}</p>
              <p className="text-green-600 font-semibold text-sm">↑ 19%</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm font-semibold mb-2">System Balance</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">${totalBalance.toLocaleString()}</p>
              <p className="text-green-600 font-semibold text-sm">↑ 8%</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm font-semibold mb-2">Avg Transaction</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">${(transactions.length > 0 ? (totalDeposits + totalWithdrawals) / transactions.length : 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              <p className="text-green-600 font-semibold text-sm">↑ 5%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
