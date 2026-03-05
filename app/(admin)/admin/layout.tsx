'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminSecurityStatus } from '@/components/AdminSecurityStatus';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const isAdmin = session?.user?.role === 'admin' || adminToken !== null;

  useEffect(() => {
    setIsMounted(true);
    // Check for admin token in localStorage
    const token = localStorage.getItem('admin_token');
    if (token) {
      setAdminToken(token);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    
    // If no admin token and no NextAuth session, redirect to admin login
    if (!adminToken && status !== 'authenticated') {
      router.push('/admin-login');
    }
  }, [isMounted, adminToken, status, router]);

  useEffect(() => {
    if (isMounted && !isAdmin && status !== 'loading') {
      // If has NextAuth session but not admin role, redirect to dashboard
      if (session && session.user?.role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [isMounted, isAdmin, status, session, router]);

  if (!isMounted || (status === 'loading' && !adminToken)) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <main className="font-montserrat text-gray-800 overflow-x-hidden bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-lg text-gray-600 mb-8">You don't have permission to access the admin panel.</p>
          </div>
          <Link href="/admin-login" className="inline-block px-8 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-full hover:shadow-lg transition-all">
            Admin Login
          </Link>
        </div>
      </main>
    );
  }

  const menuItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/admin/users', label: 'Users', icon: '👥' },
    { href: '/admin/transactions', label: 'Transactions', icon: '💳' },
    { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
    { href: '/admin/reports', label: 'Reports', icon: '📋' },
    { href: '/admin/logs', label: 'Activity Logs', icon: '📝' },
  ];

  return (
    <div className="font-montserrat text-gray-800 flex flex-col lg:flex-row min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-gray-900 to-gray-800 text-white fixed lg:relative h-full transition-all duration-300 z-40 shadow-2xl`}>
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center font-bold text-lg flex-shrink-0">
            A
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="text-xl font-bold">ANDES</h1>
              <p className="text-xs text-gray-400">Admin</p>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex-1 py-6 px-3">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition font-medium text-sm"
                >
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-700">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition font-medium text-sm"
          >
            <span className="text-lg">←</span>
            {sidebarOpen && <span>Back to App</span>}
          </Link>
        </div>

        {/* Sidebar Toggle */}
        <div className="p-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-sm"
          >
            {sidebarOpen ? '◄' : '►'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-0 w-full">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              {sidebarOpen ? '✕' : '☰'}
            </button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <span className="font-bold text-gray-900">ANDES Admin</span>
          </div>
        </div>

        {/* Page Content */}
        <div className="w-full">
          {children}
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
