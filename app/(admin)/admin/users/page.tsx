'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function AdminUsers() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'user' | 'admin'>('all');

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

  // Fetch real users from Convex
  const usersQuery = useQuery(api.user.getAllUsers) || [];
  const mappedUsers = (usersQuery || []).map((u: any) => ({
    id: String(u._id),
    name: u.fullname || u.contact || 'Unknown',
    email: u.email || '',
    phone: u.contact || '',
    status: u.role ? 'active' : 'inactive',
    role: u.role || 'user',
    balance: (typeof u.depositAmount === 'number' ? u.depositAmount : (u.depositAmount || 0)) + (typeof u.earnings === 'number' ? u.earnings : (u.earnings || 0)),
    joinDate: u._creationTime ? new Date(u._creationTime).toISOString().split('T')[0] : '-',
  }));

  const filteredUsers = mappedUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

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
              <p className="text-xs text-gray-600">User Management</p>
            </div>
          </div>

          <ul className="hidden lg:flex gap-8 items-center list-none">
            <li><Link href="/admin/dashboard" className="text-gray-700 font-medium hover:text-red-600 transition">Dashboard</Link></li>
            <li><Link href="/admin/users" className="text-red-600 font-bold border-b-2 border-red-600">Users</Link></li>
            <li><Link href="/admin/transactions" className="text-gray-700 font-medium hover:text-red-600 transition">Transactions</Link></li>
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
              <h2 className="text-4xl font-bold text-gray-900 mb-2">User Management</h2>
              <p className="text-lg text-gray-600">Manage and monitor all system users</p>
            </div>
            <button className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-lg hover:shadow-lg transition">
              + Add User
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="text-gray-600 text-sm font-semibold mb-2">Total Users</div>
              <div className="text-3xl font-bold text-gray-900">{mappedUsers.length}</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="text-gray-600 text-sm font-semibold mb-2">Active</div>
              <div className="text-3xl font-bold text-green-600">{mappedUsers.filter(u => u.status === 'active').length}</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="text-gray-600 text-sm font-semibold mb-2">Inactive</div>
              <div className="text-3xl font-bold text-gray-600">{mappedUsers.filter(u => u.status === 'inactive').length}</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="text-gray-600 text-sm font-semibold mb-2">Admin</div>
              <div className="text-3xl font-bold text-orange-600">{mappedUsers.filter(u => u.role === 'admin').length}</div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as 'all' | 'user' | 'admin')}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition">
                Apply Filters
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-red-500 to-pink-500 text-white">
                    <th className="px-6 py-4 text-left font-bold">Name</th>
                    <th className="px-6 py-4 text-left font-bold">Email</th>
                    <th className="px-6 py-4 text-left font-bold">Phone</th>
                    <th className="px-6 py-4 text-center font-bold">Status</th>
                    <th className="px-6 py-4 text-center font-bold">Role</th>
                    <th className="px-6 py-4 text-right font-bold">Balance</th>
                    <th className="px-6 py-4 text-center font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, idx) => (
                    <tr key={user.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition`}>
                      <td className="px-6 py-4 font-semibold text-gray-900">{user.name}</td>
                      <td className="px-6 py-4 text-gray-700">{user.email}</td>
                      <td className="px-6 py-4 text-gray-700">{user.phone}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          user.role === 'admin' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">${user.balance.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <button className="text-blue-600 hover:text-blue-800 font-semibold mr-4">Edit</button>
                        <button className="text-red-600 hover:text-red-800 font-semibold">Delete</button>
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
              {[1, 2, 3].map(page => (
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
