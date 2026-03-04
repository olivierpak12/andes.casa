'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TransactionHistory from '@/components/TransactionHistory';
import { api } from '@/convex/_generated/api';
import Image from 'next/image';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [depositModal, setDepositModal] = useState<{ open: boolean; required?: number }>({ open: false });
  const [copied, setCopied] = useState(false);
  const [activeTasks, setActiveTasks] = useState<{ [key: string]: number }>({});
  const [adminMode, setAdminMode] = useState(false);
  const [forceAdmin, setForceAdmin] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savingDurations, setSavingDurations] = useState(false);
  const [taskDurations, setTaskDurations] = useState<{ [key: string]: number }>({});
  const [taskStartHour, setTaskStartHour] = useState(6);
  const [taskEndHour, setTaskEndHour] = useState(18);
  const [taskTimeZone, setTaskTimeZone] = useState('GMT+2');
  const [isWithinTaskWindow, setIsWithinTaskWindow] = useState(true);
  const [timeWindowDisplay, setTimeWindowDisplay] = useState('');

  // Initialize task time window from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('andes_task_time_window');
      if (stored) {
        const { startHour, endHour, timeZone } = JSON.parse(stored);
        setTaskStartHour(startHour);
        setTaskEndHour(endHour);
        setTaskTimeZone(timeZone);
      }
    } catch (e) {
      console.error('Error loading task time window:', e);
    }
  }, []);

  // Try to load global time window from server (Convex settings)
  const savedTimeWindow = useQuery((api as any).settings?.getSettingByKey, { key: 'andes_task_time_window' }) as any;
  const mutationSetSettings = useMutation((api as any).settings?.setSettings as any);

  useEffect(() => {
    try {
      if (savedTimeWindow && savedTimeWindow.value) {
        const v = savedTimeWindow.value;
        if (v.startHour !== undefined) setTaskStartHour(v.startHour);
        if (v.endHour !== undefined) setTaskEndHour(v.endHour);
        if (v.timeZone) setTaskTimeZone(v.timeZone);
        // sync to localStorage for backwards compatibility
        try { localStorage.setItem('andes_task_time_window', JSON.stringify(v)); } catch (_) {}
      }
    } catch (e) {}
  }, [savedTimeWindow]);

  // Check if current time is within task window (every minute)
  useEffect(() => {
    const checkTimeWindow = () => {
      const now = new Date();
      
      // Parse timezone offset from taskTimeZone (e.g., "GMT+2" or "GMT-5")
      const tzMatch = taskTimeZone.match(/GMT([+-]\d+)/);
      const tzOffset = tzMatch ? parseInt(tzMatch[1]) : 2;
      
      // Calculate time in target timezone
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const localHours = (utcHours + tzOffset + 24) % 24;
      
      const withinWindow = localHours >= taskStartHour && localHours < taskEndHour;
      setIsWithinTaskWindow(withinWindow);
      setTimeWindowDisplay(`${taskStartHour}:00 - ${taskEndHour}:00 ${taskTimeZone}`);
    };

    checkTimeWindow();
    const interval = setInterval(checkTimeWindow, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [taskStartHour, taskEndHour, taskTimeZone]);

  const handleSaveTimeWindow = () => {
    try {
      localStorage.setItem(
        'andes_task_time_window',
        JSON.stringify({
          startHour: taskStartHour,
          endHour: taskEndHour,
          timeZone: taskTimeZone,
        })
      );
      // persist globally for all users (requires admin permissions)
      try {
        mutationSetSettings({ key: 'andes_task_time_window', value: { startHour: taskStartHour, endHour: taskEndHour, timeZone: taskTimeZone } });
      } catch (err) {
        console.error('Failed to save global time window:', err);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error('Error saving task time window:', e);
    }
  };

  // Initialize task durations from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('andes_task_durations');
      if (stored) {
        setTaskDurations(JSON.parse(stored));
      } else {
        const defaultDurations: { [key: string]: number } = {
          'A1': 24, 'A2': 48, 'A3': 72, 'B1': 96, 'B2': 120, 'B3': 144
        };
        setTaskDurations(defaultDurations);
      }
    } catch (e) {
      console.error('Error loading task durations:', e);
    }
  }, []);

  // Try to load global task durations from server (Convex settings)
  const savedTaskDurations = useQuery((api as any).settings?.getSettingByKey, { key: 'andes_task_durations' }) as any;

  useEffect(() => {
    try {
      const record = savedTaskDurations?.value;
      if (record && record.value) {
        const v = record.value;
        setTaskDurations(v);
        // sync to localStorage for backwards compatibility
        try { localStorage.setItem('andes_task_durations', JSON.stringify(v)); } catch (_) {}
      }
    } catch (e) {}
  }, [savedTaskDurations]);

  // Get task management mutations
  const updateTaskDurationMutation = useMutation((api as any).taskManagement?.updateTaskDuration as any);

  const handleSaveDurations = async () => {
    try {
      setSavingDurations(true);
      localStorage.setItem('andes_task_durations', JSON.stringify(taskDurations));
      
      // Also save to global settings
      try {
        await mutationSetSettings({ key: 'andes_task_durations', value: taskDurations });
      } catch (err) {
        console.error('Failed to save durations to global settings:', err);
      }

      // Update all active tasks with new durations for each grade
      for (const [grade, duration] of Object.entries(taskDurations)) {
        try {
          const result = await updateTaskDurationMutation({ grade, newDurationHours: duration as number });
          console.log(`Updated ${grade} tasks:`, result);
        } catch (err) {
          console.error(`Failed to update ${grade} tasks:`, err);
        }
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error('Error saving task durations:', e);
    } finally {
      setSavingDurations(false);
    }
  };

  const user = useQuery(api.user.getUserByContact, { contact: session?.user?.contact || '' });
  
  // Calculate total cost of active tasks
  const totalActiveCost = Object.values(activeTasks).reduce((sum, cost) => sum + cost, 0);
  const availableBalance = (user?.depositAmount || 0) - totalActiveCost;
  
  // Load active tasks from localStorage on mount
  useEffect(() => {
    if (isMounted) return;
    
    const activeTasksFromStorage: { [key: string]: number } = {};
    const grades = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
    const equipmentMap: { [key: string]: number } = {
      'A1': 20, 'A2': 100, 'A3': 380, 'B1': 780, 'B2': 1800, 'B3': 4800
    };
    
    grades.forEach((grade) => {
      try {
        const storageKey = `andes_device_${grade}`;
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.active === true) {
            activeTasksFromStorage[grade] = equipmentMap[grade];
          }
        }
      } catch (e) {}
    });
    
    setActiveTasks(activeTasksFromStorage);
  }, [isMounted]);

  // Listen for storage changes and refresh active tasks (sync across tabs/pages)
  useEffect(() => {
    const gradesList = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
    const equipmentMap: { [key: string]: number } = {
      'A1': 20, 'A2': 100, 'A3': 380, 'B1': 780, 'B2': 1800, 'B3': 4800
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (!e.key.startsWith('andes_device_')) return;

      const activeTasksFromStorage: { [key: string]: number } = {};
      gradesList.forEach((grade) => {
        try {
          const storageKey = `andes_device_${grade}`;
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.active === true) activeTasksFromStorage[grade] = equipmentMap[grade];
          }
        } catch (err) {}
      });
      setActiveTasks(activeTasksFromStorage);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  
  // Persist active tasks to localStorage
  useEffect(() => {
    Object.entries(activeTasks).forEach(([grade, cost]) => {
      const storageKey = `andes_device_${grade}`;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.active = true;
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        }
      } catch (e) {}
    });
  }, [activeTasks]);
  
  // Also fetch full user details if available
  // const fullUser = useQuery(api.user.getUserById, user ? { userId: user._id } : "skip");

  const grades = [
    { grade: 'A1', equipment: 20, daily: 2, monthly: 60, annual: 730, durationHours: taskDurations['A1'] || 24 },
    { grade: 'A2', equipment: 100, daily: 6.6, monthly: 198, annual: 2409, durationHours: taskDurations['A2'] || 48 },
    { grade: 'A3', equipment: 380, daily: 25, monthly: 750, annual: 9125, durationHours: taskDurations['A3'] || 72 },
    { grade: 'B1', equipment: 780, daily: 52, monthly: 1560, annual: 18980, durationHours: taskDurations['B1'] || 96 },
    { grade: 'B2', equipment: 1800, daily: 120, monthly: 3600, annual: 43800, durationHours: taskDurations['B2'] || 120 },
    { grade: 'B3', equipment: 4800, daily: 320, monthly: 9600, annual: 116800, durationHours: taskDurations['B3'] || 144 },
  ];

  const onRequestDeposit = (required: number) => {
    setDepositModal({ open: true, required });
  };

  const closeDepositModal = () => setDepositModal({ open: false });

  const goToDeposit = () => {
    if (!depositModal.required) return;
    const q = new URLSearchParams({ amount: String(depositModal.required) });
    router.push('/deposit?' + q.toString());
    setDepositModal({ open: false });
  };
  
  const handleCopyCode = () => {
    if (user?.invitationCode) {
      navigator.clipboard.writeText(user.invitationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-open admin panel for real admins
  useEffect(() => {
    try {
      if (user?.role === 'admin') setAdminMode(true);
      if (forceAdmin) setAdminMode(true);
    } catch (e) {}
  }, [user, forceAdmin]);

  // Allow forcing admin UI for preview/testing via URL param or localStorage
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin_preview') === '1' || localStorage.getItem('andes_admin_preview') === '1') {
        setForceAdmin(true);
      }
    } catch (e) {}
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
    }
  }, [status, router]);

  function DeviceCard({ item }: { item: { grade: string; equipment: number; daily: number; durationHours: number } }) {
    const getGradeColor = (grade: string) => {
      if (grade.startsWith('A')) return 'from-blue-500 to-blue-600';
      return 'from-green-500 to-green-600';
    };

    return (
      <div className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100`}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${getGradeColor(item.grade)} p-6 text-white relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
          <h3 className="text-2xl font-bold mb-2">{item.grade} Series</h3>
          <p className="text-white/90">Investment Package</p>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Info */}
          <div className="space-y-3 mb-6 pb-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Investment Cost</span>
              <span className="font-bold text-gray-900">${item.equipment}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Daily Profit</span>
              <span className="font-bold text-emerald-600">${item.daily}</span>
            </div>
            
          </div>

          {/* Action - Link to Tasks Page */}
          <Link
            href="/tasks"
            className="block w-full py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-emerald-500/30 transition-all text-center"
          >
            Manage Task →
          </Link>
        </div>
      </div>
    );
  }

  if (!isMounted || status === 'loading' || user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!session || !user) {
    return (
      <main className="font-montserrat text-gray-800 bg-gray-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-gray-600 mb-8">Please sign in to your account to access the dashboard.</p>
          <Link
            href="/sign-in"
            className="block w-full py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/30"
          >
            Sign In Now
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="font-montserrat text-gray-800 bg-gray-50 min-h-screen">
      {/* Navigation Bar */}
      

      <div className="pt-24 px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">{user.fullname || 'Partner'}</span>
              </h2>
              <p className="text-gray-500">Here's what's happening with your investments today.</p>
            </div>
            <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm">
               Last login: {new Date().toLocaleDateString()}
            </div>
          </div>

          

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
             {/* Left Column: Stats & Actions */}
             <div className="lg:col-span-2 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Balance Card */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"/></svg>
                        </div>
                        <div className="text-gray-500 text-sm font-medium mb-2">Available Balance</div>
                        <div className="text-4xl font-bold text-gray-900 tracking-tight mb-2">
                            ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                         <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded mb-3">
                            <span>📊 Ready to use</span>
                        </div>
                        <div className="space-y-2 text-xs text-gray-500 border-t border-gray-100 pt-3">
                          <div className="flex items-center justify-between">
                            <span>Total Balance:</span>
                            <span className="font-semibold text-gray-700">${(user?.depositAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          {totalActiveCost > 0 && (
                            <div className="flex items-center justify-between text-orange-600">
                              <span>In Use:</span>
                              <span className="font-semibold">-${totalActiveCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>
                    </div>

                    {/* Earnings Card */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 15.293 6.293A1 1 0 0115 7h-3z" clipRule="evenodd"/></svg>
                        </div>
                        <div className="text-gray-500 text-sm font-medium mb-2">Active Tasks</div>
                        <div className="text-4xl font-bold text-gray-900 tracking-tight mb-2">{Object.keys(activeTasks).length}</div>
                        <div className="text-sm text-gray-400">
                          {Object.keys(activeTasks).length > 0 
                            ? `Earning rewards` 
                            : 'No active tasks'}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link href="/tasks" className="group bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-1">
                        <div className="mb-4 bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                            <span className="text-2xl">📋</span>
                        </div>
                        <h3 className="text-lg font-bold mb-1">My Tasks</h3>
                        <p className="text-indigo-100 text-sm opacity-90">View all tasks</p>
                    </Link>

                    <Link href="/deposit" className="group bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all transform hover:-translate-y-1">
                        <div className="mb-4 bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                            <span className="text-2xl">💰</span>
                        </div>
                        <h3 className="text-lg font-bold mb-1">Deposit</h3>
                        <p className="text-emerald-100 text-sm opacity-90">Add funds instantly</p>
                    </Link>

                    <Link href="/withdraw" className="group bg-white border border-gray-200 rounded-2xl p-6 text-gray-800 shadow-sm hover:shadow-md transition-all transform hover:-translate-y-1">
                        <div className="mb-4 bg-gray-50 w-12 h-12 rounded-lg flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                            <span className="text-2xl">💸</span>
                        </div>
                        <h3 className="text-lg font-bold mb-1 text-gray-900">Withdraw</h3>
                        <p className="text-gray-500 text-sm">Cash out earnings</p>
                    </Link>
                </div>
                
                 {/* Available Machines List */}
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-900">Available Investment Packages</h3>
                        <Link href="/joining-process" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                            View All <span className="text-lg">›</span>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {grades.map((item) => (
                            <DeviceCard
                            key={item.grade}
                            item={item}
                            />
                        ))}
                    </div>
                 </div>
             </div>

             {/* Right Column: Profile & Account Details */}
             <div className="space-y-8">
                 {/* Profile Card */}
                 <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="h-24 bg-gradient-to-r from-gray-100 to-gray-200"></div>
                    <div className="px-6 pb-6 relative">
                        <div className="w-20 h-20 bg-white rounded-full border-4 border-white shadow-md absolute -top-10 flex items-center justify-center font-bold text-2xl text-emerald-600">
                             {user.fullname?.charAt(0) || user.contact?.charAt(0) || 'U'}
                        </div>
                        <div className="pt-12 mb-6">
                             <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">{user.fullname || 'Anonymous User'}</h3>
                                    <p className="text-sm text-gray-500">{user.email || user.contact || 'No contact info'}</p>
                                </div>
                                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold uppercase">
                                    {user.role || 'Member'}
                                </span>
                             </div>
                        </div>
                        
                        <div className="space-y-4">
                             <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <span className="text-sm text-gray-500">Status</span>
                                <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    Verified
                                </span>
                             </div>
                             <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <span className="text-sm text-gray-500">Country</span>
                                <span className="text-sm font-medium text-gray-900">{user.countryCode || 'N/A'}</span>
                             </div>
                             <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <span className="text-sm text-gray-500">Position</span>
                                <span className="text-sm font-medium text-gray-900">{user.position || 'Partner'}</span>
                             </div>
                             {user.telegram && (
                                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                    <span className="text-sm text-gray-500">Telegram</span>
                                    <a href={`https://t.me/${user.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-500 hover:text-blue-600">
                                        {user.telegram}
                                    </a>
                                </div>
                             )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <div className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Invitation Code</div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono text-center font-bold tracking-widest text-gray-700">
                                    {user.invitationCode || '----'}
                                </div>
                                <button 
                                    onClick={handleCopyCode}
                                    className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                                    title="Copy Code"
                                >
                                    {copied ? '✓' : '📋'}
                                </button>
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* Recent Activity Mini */}
                 <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="font-bold text-gray-900 mb-6">Recent Transactions</h3>
                    <TransactionHistory limit={5} />
                    <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                        <Link href="/finances" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View All History</Link>
                    </div>
                 </div>
             </div>
           </div>
        </div>
      </div>

      {/* Deposit Modal */}
      {depositModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all scale-100">
            <h3 className="text-2xl font-bold mb-2 text-gray-900">Insufficient Balance</h3>
            <p className="mb-6 text-gray-600 leading-relaxed">
                You need <strong className="text-emerald-600">{depositModal.required} USDT</strong> (TRC20) to activate this machine.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={closeDepositModal} 
                className="px-5 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={goToDeposit} 
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 transition-all"
              >
                Deposit Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12 px-8 mt-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-8">
          <div>
            <h4 className="font-bold text-lg mb-4 text-gray-900">ANDES</h4>
            <p className="text-gray-500 text-sm">Global sharing economy platform empowering users worldwide.</p>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-4 text-gray-900">Platform</h4>
            <ul className="space-y-2 text-gray-500 text-sm">
              <li><Link href="/dashboard" className="hover:text-emerald-600 transition">Dashboard</Link></li>
              <li><Link href="/joining-process" className="hover:text-emerald-600 transition">How it Works</Link></li>
              <li><Link href="/equipment" className="hover:text-emerald-600 transition">Equipment</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-4 text-gray-900">Account</h4>
            <ul className="space-y-2 text-gray-500 text-sm">
              <li><Link href="/profile" className="hover:text-emerald-600 transition">Profile Settings</Link></li>
              <li><Link href="/deposit" className="hover:text-emerald-600 transition">Make a Deposit</Link></li>
              <li><Link href="/withdraw" className="hover:text-emerald-600 transition">Withdraw Funds</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-4 text-gray-900">Connect</h4>
            <ul className="space-y-2 text-gray-500 text-sm">
              <li><a href="https://t.me/andes" className="hover:text-emerald-600 transition">Telegram Channel</a></li>
              <li><a href="https://youtube.com/andes" className="hover:text-emerald-600 transition">YouTube</a></li>
              <li><a href="mailto:support@andes.com" className="hover:text-emerald-600 transition">support@andes.com</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; 2026 ANDES. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}