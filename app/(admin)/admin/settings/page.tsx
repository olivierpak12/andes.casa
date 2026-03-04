'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function AdminSettings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'commission' | 'equipment' | 'notifications'>('general');
  
  const isAdmin = session?.user?.role === 'admin' || adminToken !== null;

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem('admin_token');
    if (token) {
      setAdminToken(token);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (!isAdmin && status !== 'loading' && status !== 'authenticated') {
      router.push('/admin-login');
    }
  }, [isMounted, isAdmin, status, router]);

  const [settings, setSettings] = useState({
    general: {
      platformName: 'ANDES Platform',
      maintenanceMode: false,
      maxWithdrawalAmount: '50000',
      minDepositAmount: '100',
      supportEmail: 'support@andes.com',
    },
    commission: {
      teamAPercentage: '18',
      teamBPercentage: '3',
      teamCPercentage: '2',
      dailyProfitDistribution: '70',
      commissionInterval: 'daily',
    },
    equipment: {
      a1Price: '500',
      a2Price: '1000',
      a3Price: '2000',
      b1Price: '5000',
      b2Price: '10000',
      b3Price: '20000',
    },
    notifications: {
      emailAlerts: true,
      transactionNotifications: true,
      withdrawalPending: true,
      newUserAlert: true,
      dailySummary: true,
    }
  });

  // Convex: load and persist settings
  const savedSettings = useQuery((api as any).settings?.getSettings) as any;
  const mutationSetSettings = useMutation((api as any).settings?.setSettings as any);

  useEffect(() => {
    if (savedSettings && savedSettings.value) {
      setSettings(prev => ({ ...prev, ...(savedSettings.value || {}) }));
    }
  }, [savedSettings]);

  useEffect(() => {
    if (isMounted && !isAdmin && status !== 'loading') {
      router.push('/dashboard');
    }
  }, [isMounted, isAdmin, status, router]);

  const handleInputChange = (section: string, field: string, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof settings],
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    try {
      mutationSetSettings({ key: 'platform', value: settings });
      // Task time window settings removed along with ETH/BSC/Polygon networks
      alert('Settings saved successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to save settings');
    }
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
              <p className="text-xs text-gray-600">System Settings</p>
            </div>
          </div>

          <ul className="hidden lg:flex gap-8 items-center list-none">
            <li><Link href="/admin/dashboard" className="text-gray-700 font-medium hover:text-red-600 transition">Dashboard</Link></li>
            <li><Link href="/admin/users" className="text-gray-700 font-medium hover:text-red-600 transition">Users</Link></li>
            <li><Link href="/admin/transactions" className="text-gray-700 font-medium hover:text-red-600 transition">Transactions</Link></li>
            <li><Link href="/admin/analytics" className="text-gray-700 font-medium hover:text-red-600 transition">Analytics</Link></li>
            <li><Link href="/admin/settings" className="text-red-600 font-bold border-b-2 border-red-600">Settings</Link></li>
          </ul>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">System Settings</h2>
            <p className="text-lg text-gray-600">Configure platform settings and parameters</p>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {/* Settings Menu */}
            <div className="bg-white rounded-2xl p-6 shadow-lg h-fit">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Settings Menu</h3>
              <div className="space-y-2">
                {[
                  { id: 'general', label: 'General', icon: '⚙️' },
                  { id: 'commission', label: 'Commission', icon: '💰' },
                  { id: 'equipment', label: 'Equipment', icon: '🖥️' },
                  { id: 'notifications', label: 'Notifications', icon: '🔔' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition ${
                      activeTab === item.id
                        ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Settings Content */}
            <div className="col-span-3">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="bg-white rounded-2xl p-8 shadow-lg">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">General Settings</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Platform Name</label>
                      <input
                        type="text"
                        value={settings.general.platformName}
                        onChange={(e) => handleInputChange('general', 'platformName', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Support Email</label>
                      <input
                        type="email"
                        value={settings.general.supportEmail}
                        onChange={(e) => handleInputChange('general', 'supportEmail', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Deposit Amount (USDT)</label>
                      <input
                        type="number"
                        value={settings.general.minDepositAmount}
                        onChange={(e) => handleInputChange('general', 'minDepositAmount', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Maximum Withdrawal Amount (USDT)</label>
                      <input
                        type="number"
                        value={settings.general.maxWithdrawalAmount}
                        onChange={(e) => handleInputChange('general', 'maxWithdrawalAmount', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div className="flex items-center gap-4 pt-4">
                      <input
                        type="checkbox"
                        checked={settings.general.maintenanceMode}
                        onChange={(e) => handleInputChange('general', 'maintenanceMode', e.target.checked)}
                        className="w-5 h-5 text-red-500 rounded"
                      />
                      <label className="font-semibold text-gray-700">Enable Maintenance Mode</label>
                    </div>
                  </div>
                </div>
              )}

              {/* Commission Settings */}
              {activeTab === 'commission' && (
                <div className="bg-white rounded-2xl p-8 shadow-lg">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Commission Settings</h3>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Team A Commission %</label>
                        <input
                          type="number"
                          value={settings.commission.teamAPercentage}
                          onChange={(e) => handleInputChange('commission', 'teamAPercentage', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Team B Commission %</label>
                        <input
                          type="number"
                          value={settings.commission.teamBPercentage}
                          onChange={(e) => handleInputChange('commission', 'teamBPercentage', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Team C Commission %</label>
                        <input
                          type="number"
                          value={settings.commission.teamCPercentage}
                          onChange={(e) => handleInputChange('commission', 'teamCPercentage', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Daily Profit Distribution %</label>
                        <input
                          type="number"
                          value={settings.commission.dailyProfitDistribution}
                          onChange={(e) => handleInputChange('commission', 'dailyProfitDistribution', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Commission Payment Interval</label>
                      <select
                        value={settings.commission.commissionInterval}
                        onChange={(e) => handleInputChange('commission', 'commissionInterval', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Equipment Settings */}
              {activeTab === 'equipment' && (
                <div className="bg-white rounded-2xl p-8 shadow-lg">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Equipment Pricing</h3>
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 mb-6 border border-blue-200">
                      <p className="text-gray-700 text-sm">Set the pricing for each equipment grade. These prices determine the investment cost for users.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      {[
                        { label: 'A1 Grade Price', field: 'a1Price' },
                        { label: 'A2 Grade Price', field: 'a2Price' },
                        { label: 'A3 Grade Price', field: 'a3Price' },
                        { label: 'B1 Grade Price', field: 'b1Price' },
                        { label: 'B2 Grade Price', field: 'b2Price' },
                        { label: 'B3 Grade Price', field: 'b3Price' },
                      ].map(item => (
                        <div key={item.field}>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">{item.label} (USDT)</label>
                          <input
                            type="number"
                            value={settings.equipment[item.field as keyof typeof settings.equipment]}
                            onChange={(e) => handleInputChange('equipment', item.field, e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Notification Settings */}
              {activeTab === 'notifications' && (
                <div className="bg-white rounded-2xl p-8 shadow-lg">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Notification Settings</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Email Alerts', field: 'emailAlerts' },
                      { label: 'Transaction Notifications', field: 'transactionNotifications' },
                      { label: 'Pending Withdrawal Alerts', field: 'withdrawalPending' },
                      { label: 'New User Alerts', field: 'newUserAlert' },
                      { label: 'Daily Summary Email', field: 'dailySummary' },
                    ].map(item => (
                      <div key={item.field} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <label className="font-semibold text-gray-700">{item.label}</label>
                        <input
                          type="checkbox"
                          checked={settings.notifications[item.field as keyof typeof settings.notifications] as boolean}
                          onChange={(e) => handleInputChange('notifications', item.field, e.target.checked)}
                          className="w-5 h-5 text-red-500 rounded"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 flex justify-end gap-4">
            <button className="px-8 py-3 bg-gray-300 text-gray-800 font-bold rounded-lg hover:bg-gray-400 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-lg hover:shadow-lg transition"
            >
              💾 Save Changes
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
