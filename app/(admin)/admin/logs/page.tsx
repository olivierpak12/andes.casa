'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function AdminLogs() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'user' | 'transaction' | 'system'>('all');
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warning' | 'error'>('all');

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

  // Fetch real data from Convex (hooks must be unconditional)
  const transactions = useQuery(api.transaction.getAllTransactions) || [];

  if (!isMounted || !adminToken) {
    return <div className="text-center py-32">Loading...</div>;
  }

  // Build real logs from transactions
  const logs = transactions.map((t: any, idx: number) => ({
    id: idx + 1,
    timestamp: t.createdAt ? new Date(t.createdAt).toLocaleString() : 'Unknown',
    type: 'transaction',
    level: t.status === 'completed' ? 'info' : t.status === 'failed' ? 'error' : 'warning',
    user: 'User',
    action: `${t.type === 'deposit' ? 'Deposit' : 'Withdrawal'} ${t.status}`,
    details: `Amount: $${(t.amount || 0).toLocaleString()} on ${t.network || 'N/A'}`,
    icon: t.status === 'completed' ? '✓' : t.status === 'failed' ? '✗' : '⏳',
  }));

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    return true;
  });

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'info': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'warning': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'error': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'user': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'transaction': return 'bg-green-100 text-green-700 border-green-300';
      case 'system': return 'bg-orange-100 text-orange-700 border-orange-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Activity Logs</h1>
          <p className="text-lg text-gray-600">Monitor system and user activity logs</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Types</option>
                <option value="user">User Activity</option>
                <option value="transaction">Transactions</option>
                <option value="system">System Events</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Level</label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border-2 border-blue-200">
            <p className="text-gray-600 text-xs font-semibold mb-1">Total Logs</p>
            <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
            <p className="text-gray-600 text-xs font-semibold mb-1">Info</p>
            <p className="text-2xl font-bold text-gray-900">{logs.filter(l => l.level === 'info').length}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border-2 border-yellow-200">
            <p className="text-gray-600 text-xs font-semibold mb-1">Warnings</p>
            <p className="text-2xl font-bold text-gray-900">{logs.filter(l => l.level === 'warning').length}</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-lg p-4 border-2 border-red-200">
            <p className="text-gray-600 text-xs font-semibold mb-1">Errors</p>
            <p className="text-2xl font-bold text-gray-900">{logs.filter(l => l.level === 'error').length}</p>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-6 py-4 text-left font-bold text-gray-900">Timestamp</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-900">Type</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-900">Level</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-900">User</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-900">Action</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-900">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-gray-700 font-mono text-xs">{log.timestamp}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(log.type)}`}>
                          {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getLevelColor(log.level)}`}>
                          {log.level.charAt(0).toUpperCase() + log.level.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-semibold">{log.user}</td>
                      <td className="px-6 py-4 text-gray-700">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{log.icon}</span>
                          <span>{log.action}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs">{log.details}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <p className="text-gray-500 font-semibold">No logs found matching the filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <p className="text-sm text-gray-600 font-semibold">
              Showing {filteredLogs.length} of {logs.length} logs
            </p>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition">
                ← Previous
              </button>
              <button className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition">
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="mt-8 flex gap-4 justify-end">
          <button className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition">
            📊 Export as CSV
          </button>
          <button className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg transition">
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
