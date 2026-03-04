'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/convex/_generated/api';
import Image from 'next/image';
import { Id } from '@/convex/_generated/dataModel';

export default function EquipmentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  const user = useQuery(api.user.getUserByContact, { contact: session?.user?.contact || '' });
  const activeTasks = useQuery(api.taskManagement.getUserActiveTasks, user?._id ?  { userId: user?._id } : 'skip');
  const closeTask = useMutation(api.taskManagement.closeTask);

  const grades = [
    { grade: 'A1', equipment: 20, daily: 2, monthly: 60, annual: 730 },
    { grade: 'A2', equipment: 100, daily: 6.6, monthly: 198, annual: 2409 },
    { grade: 'A3', equipment: 380, daily: 25, monthly: 750, annual: 9125 },
    { grade: 'B1', equipment: 780, daily: 52, monthly: 1560, annual: 18980 },
    { grade: 'B2', equipment: 1800, daily: 120, monthly: 3600, annual: 43800 },
    { grade: 'B3', equipment: 4800, daily: 320, monthly: 9600, annual: 116800 },
    { grade: 'S1', equipment: 12800, daily: 853, monthly: 25590, annual: 311345 },
    { grade: 'S2', equipment: 25800, daily: 1720, monthly: 51600, annual: 627800 },
    { grade: 'S3', equipment: 58000, daily: 3850, monthly: 115500, annual: 1405250 },
    { grade: 'SS', equipment: 128000, daily: 8530, monthly: 255900, annual: 3113450 },
    { grade: 'SSS', equipment: 280000, daily: 18600, monthly: 558000, annual: 6789000 },
  ];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const gradeInfo = (grade: string) => {
    return grades.find(g => g.grade === grade) || grades[0];
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
    }
  }, [status, router]);

  if (!isMounted || status === 'loading' || user === undefined || activeTasks === undefined) {
    return <div className="text-center py-32">Loading...</div>;
  }

  if (!session || !user) {
    return (
      <main className="font-montserrat text-gray-800 overflow-x-hidden bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-lg text-gray-600 mb-8">Please sign in to access your equipment.</p>
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

  // Get active equipment from database tasks
  const activeEquipment = activeTasks.map((task: any) => {
    const info = gradeInfo(task.grade);
    return {
      ...info,
      taskId: task._id,
      startedAt: task.startedAt,
      expiresAt: task.expiresAt,
      durationHours: task.durationHours,
      earningsAwarded: task.earningsAwarded || 0,
    };
  }) || [];

  // Calculate equipment stats
  const stats = {
    totalActive: activeEquipment.length,
    totalCost: activeEquipment.reduce((sum, e) => sum + e.equipment, 0),
    dailyProfit: activeEquipment.reduce((sum, e) => sum + e.daily, 0),
    monthlyProfit: activeEquipment.reduce((sum, e) => sum + e.monthly, 0),
  };

  const handleStopEquipment = (taskId: Id<'task'>) => {
    closeTask({ taskId });
  };

  return (
    <main className="font-montserrat text-gray-800 overflow-x-hidden bg-gray-50 min-h-screen">
      

      {/* Main Content */}
      <div className="pt-24 px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-12">
            <h2 className="text-5xl font-bold text-gray-900 mb-2">Equipment Management</h2>
            <p className="text-xl text-gray-600">Manage your devices and track performance</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition border-l-4 border-emerald-500">
              <div className="text-gray-600 text-sm font-semibold mb-2">Active Devices</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">{stats.totalActive}</div>
              <p className="text-xs text-gray-500">Currently running</p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition border-l-4 border-cyan-500">
              <div className="text-gray-600 text-sm font-semibold mb-2">Daily Profit</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">${stats.dailyProfit.toFixed(2)}</div>
              <p className="text-xs text-gray-500">Expected daily earnings</p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition border-l-4 border-green-500">
              <div className="text-gray-600 text-sm font-semibold mb-2">Monthly Profit</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">${stats.monthlyProfit.toFixed(2)}</div>
              <p className="text-xs text-gray-500">Expected monthly earnings</p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition border-l-4 border-blue-500">
              <div className="text-gray-600 text-sm font-semibold mb-2">Total Investment</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">${stats.totalCost.toFixed(2)}</div>
              <p className="text-xs text-gray-500">Equipment cost</p>
            </div>
          </div>

          {/* Active Equipment Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold text-gray-900">Active Equipment</h3>
              <Link href="/dashboard" className="px-6 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 transition">
                + Add Equipment
              </Link>
            </div>

            {activeEquipment.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {activeEquipment.map((equipment) => (
                  <div key={equipment.taskId} className="bg-gradient-to-br from-green-50 to-cyan-50 rounded-2xl p-8 border-2 border-green-300 shadow-lg">
                    <div className="flex items-start justify-between gap-8">
                      {/* Left Side - Equipment Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center shadow-md">
                            <Image src="/scooter.png" alt="Scooter" width={80} height={80} />
                          </div>
                          <div>
                            <h4 className="text-3xl font-bold text-gray-900">{equipment.grade}</h4>
                            <p className="text-sm text-gray-600 mt-1">Grade {equipment.grade} Equipment</p>
                          </div>
                        </div>
                      </div>

                      {/* Right Side - Stats Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                          <div className="text-gray-600 text-xs font-semibold mb-1">Device Price</div>
                          <div className="text-2xl font-bold text-gray-900">${equipment.equipment}</div>
                        </div>

                        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                          <div className="text-gray-600 text-xs font-semibold mb-1">Daily Income</div>
                          <div className="text-2xl font-bold text-green-600">${equipment.daily.toFixed(2)}</div>
                        </div>

                        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                          <div className="text-gray-600 text-xs font-semibold mb-1">Monthly Income</div>
                          <div className="text-2xl font-bold text-cyan-600">${equipment.monthly.toFixed(2)}</div>
                        </div>

                        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                          <div className="text-gray-600 text-xs font-semibold mb-1">Annual Income</div>
                          <div className="text-2xl font-bold text-blue-600">${equipment.annual.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom - Status and Action */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="font-semibold text-green-700">Active</span>
                        <span className="text-gray-600 ml-2">Running ({equipment.durationHours}h duration)</span>
                      </div>
                      <button
                        onClick={() => handleStopEquipment(equipment.taskId)}
                        className="px-6 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition"
                      >
                        Stop Equipment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">⚙️</div>
                <h4 className="text-2xl font-bold text-gray-900 mb-2">No Active Equipment</h4>
                <p className="text-gray-700 mb-6">You haven't started any equipment yet. Visit the dashboard to start your first task.</p>
                <Link href="/dashboard" className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
                  Start Equipment
                </Link>
              </div>
            )}
          </div>

          {/* Available Equipment Reference */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold text-gray-900">Available Equipment</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                    <th className="px-6 py-4 text-left font-bold">Grade</th>
                    <th className="px-6 py-4 text-center font-bold">Price</th>
                    <th className="px-6 py-4 text-center font-bold">Daily</th>
                    <th className="px-6 py-4 text-center font-bold">Monthly</th>
                    <th className="px-6 py-4 text-center font-bold">Annual</th>
                    <th className="px-6 py-4 text-center font-bold">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade, idx) => {
                    const roi = ((grade.daily * 365) / grade.equipment * 100).toFixed(2);
                    const isActive = activeEquipment.some(e => e.grade === grade.grade);
                    return (
                      <tr
                        key={idx}
                        className={`border-b ${isActive ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition`}
                      >
                        <td className={`px-6 py-4 font-bold ${isActive ? 'text-green-700' : 'text-gray-900'}`}>
                          {grade.grade} {isActive && '✓'}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-700">${grade.equipment}</td>
                        <td className="px-6 py-4 text-center text-gray-700">${grade.daily}</td>
                        <td className="px-6 py-4 text-center text-gray-700">${grade.monthly.toLocaleString()}</td>
                        <td className="px-6 py-4 text-center text-gray-700">${grade.annual.toLocaleString()}</td>
                        <td className={`px-6 py-4 text-center font-bold ${parseFloat(roi) > 100 ? 'text-green-600' : 'text-gray-700'}`}>
                          {roi}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Equipment Performance Guide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-8 border-2 border-cyan-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4">💡 Equipment Tips</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-cyan-600 font-bold">✓</span>
                  <span className="text-gray-700">Higher grade equipment generates more daily income</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-600 font-bold">✓</span>
                  <span className="text-gray-700">ROI varies by grade - check return on investment</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-600 font-bold">✓</span>
                  <span className="text-gray-700">Multiple devices generate compounded earnings</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-600 font-bold">✓</span>
                  <span className="text-gray-700">Equipment runs continuously to generate profit</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-8 border-2 border-emerald-200">
              <h4 className="text-xl font-bold text-gray-900 mb-4">📊 Performance Metrics</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700 font-semibold">Daily Yield</span>
                    <span className="text-emerald-600 font-bold">${stats.dailyProfit.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min((stats.dailyProfit / 1000) * 100, 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700 font-semibold">Monthly Yield</span>
                    <span className="text-emerald-600 font-bold">${stats.monthlyProfit.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min((stats.monthlyProfit / 10000) * 100, 100)}%` }}></div>
                  </div>
                </div>
                <div className="pt-4 border-t border-emerald-200">
                  <p className="text-sm text-gray-600">Earnings are automatically added to your account daily.</p>
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
              <li><Link href="/equipment" className="hover:text-cyan-400 transition">Equipment</Link></li>
              <li><Link href="/team" className="hover:text-cyan-400 transition">Team</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-4">Account</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="/profile" className="hover:text-cyan-400 transition">Profile</Link></li>
              <li><Link href="/deposit" className="hover:text-cyan-400 transition">Deposit</Link></li>
              <li><Link href="/finances" className="hover:text-cyan-400 transition">Finances</Link></li>
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
