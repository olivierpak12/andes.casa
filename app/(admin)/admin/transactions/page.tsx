'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function AdminTransactions() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal'>('all');

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

  // Fetch all transactions from Convex
  const txQuery = useQuery(api.transaction.getAllTransactions) || [];

  const mappedTx = txQuery.map((t: any) => ({
    id: String(t._id),
    user: t.userId ? String(t.userId) : 'Unknown',
    email: t.email || '',
    type: t.type || 'deposit',
    amount: typeof t.amount === 'number' ? t.amount : 0,
    network: t.network || '',
    status: t.status || 'pending',
    date: t.createdAt ? new Date(t.createdAt).toLocaleString() : '-',
    walletAddress: t.walletAddress || '',
  }));

  const filteredTransactions = mappedTx.filter(tx => {
    const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;
    const matchesType = filterType === 'all' || tx.type === filterType;
    return matchesStatus && matchesType;
  });

  const stats = {
    totalAmount: mappedTx.reduce((sum, tx) => sum + tx.amount, 0),
    completedAmount: mappedTx.filter(t => t.status === 'completed').reduce((sum, tx) => sum + tx.amount, 0),
    pendingCount: mappedTx.filter(t => t.status === 'pending').length,
    failedCount: mappedTx.filter(t => t.status === 'failed').length,
  };

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
              <p className="text-xs text-gray-600">Transaction Management</p>
            </div>
          </div>

          <ul className="hidden lg:flex gap-8 items-center list-none">
            <li><Link href="/admin/dashboard" className="text-gray-700 font-medium hover:text-red-600 transition">Dashboard</Link></li>
            <li><Link href="/admin/users" className="text-gray-700 font-medium hover:text-red-600 transition">Users</Link></li>
            <li><Link href="/admin/transactions" className="text-red-600 font-bold border-b-2 border-red-600">Transactions</Link></li>
            <li><Link href="/admin/analytics" className="text-gray-700 font-medium hover:text-red-600 transition">Analytics</Link></li>
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
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Transaction Management</h2>
              <p className="text-lg text-gray-600">Monitor and manage all system transactions</p>
            </div>
            <button className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-lg hover:shadow-lg transition">
              Export CSV
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="text-gray-600 text-sm font-semibold mb-2">Total Amount</div>
              <div className="text-3xl font-bold text-gray-900">${stats.totalAmount.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="text-gray-600 text-sm font-semibold mb-2">Completed</div>
              <div className="text-3xl font-bold text-green-600">${stats.completedAmount.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="text-gray-600 text-sm font-semibold mb-2">Pending</div>
              <div className="text-3xl font-bold text-orange-600">{stats.pendingCount}</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="text-gray-600 text-sm font-semibold mb-2">Failed</div>
              <div className="text-3xl font-bold text-red-600">{stats.failedCount}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
              </select>
              <button className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition">
                Apply Filters
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-red-500 to-pink-500 text-white">
                    <th className="px-6 py-4 text-left font-bold">User</th>
                    <th className="px-6 py-4 text-left font-bold">Type</th>
                    <th className="px-6 py-4 text-center font-bold">Amount</th>
                    <th className="px-6 py-4 text-left font-bold">Network</th>
                    <th className="px-6 py-4 text-center font-bold">Status</th>
                    <th className="px-6 py-4 text-left font-bold">Date</th>
                    <th className="px-6 py-4 text-center font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, idx) => (
                    <tr key={tx.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition`}>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{tx.user}</div>
                        <div className="text-sm text-gray-600">{tx.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          tx.type === 'deposit' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {tx.type === 'deposit' ? '📥 Deposit' : '📤 Withdrawal'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-900">${tx.amount}</td>
                      <td className="px-6 py-4 text-gray-700">{tx.network}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                          tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{tx.date}</td>
                      <td className="px-6 py-4 text-center">
                        {tx.status === 'pending' && (
                          <>
                            <button className="text-green-600 hover:text-green-800 font-semibold mr-3">Approve</button>
                            <button className="text-red-600 hover:text-red-800 font-semibold">Reject</button>
                          </>
                        )}
                        {tx.status !== 'pending' && (
                          <button className="text-blue-600 hover:text-blue-800 font-semibold">View</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-50" disabled>
              Previous
            </button>
            <div className="flex gap-2">
              {[1, 2].map(page => (
                <button
                  key={page}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    page === 1 ? 'bg-red-500 text-white' : 'border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition">
              Next
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
