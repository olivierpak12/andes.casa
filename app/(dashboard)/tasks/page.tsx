'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/convex/_generated/api';

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [activeTasks, setActiveTasks] = useState<{ [key: string]: number }>({});
  const [taskDurations, setTaskDurations] = useState<{ [key: string]: number }>({});
  const [depositModal, setDepositModal] = useState<{ open: boolean; required?: number; grade?: string }>({ open: false });
  const [taskStartHour, setTaskStartHour] = useState(6);
  const [taskEndHour, setTaskEndHour] = useState(18);
  const [taskStartMinute, setTaskStartMinute] = useState(0);
  const [taskEndMinute, setTaskEndMinute] = useState(0);
  const [taskTimeZone, setTaskTimeZone] = useState('GMT+2');
  const [isWithinTaskWindow, setIsWithinTaskWindow] = useState(true);
  const [timeWindowDisplay, setTimeWindowDisplay] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [forceAdmin, setForceAdmin] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const user = useQuery(api.user.getUserByContact, { contact: session?.user?.contact || '' });

  // Load task time window from localStorage (fallback)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('andes_task_time_window');
      if (stored) {
        const { startHour, endHour, startMinute, endMinute, timeZone } = JSON.parse(stored);
        setTaskStartHour(startHour);
        setTaskEndHour(endHour);
        if (startMinute !== undefined) setTaskStartMinute(startMinute);
        if (endMinute !== undefined) setTaskEndMinute(endMinute);
        setTaskTimeZone(timeZone);
      }
    } catch (e) {
      console.error('Error loading task time window:', e);
    }
  }, []);

  // Also fetch global task time window from server
  const savedTimeWindow = useQuery((api as any).settings?.getSettingByKey, { key: 'andes_task_time_window' }) as any;

  useEffect(() => {
    try {
      if (savedTimeWindow && savedTimeWindow.value) {
        const v = savedTimeWindow.value;
        if (v.startHour !== undefined) setTaskStartHour(v.startHour);
        if (v.endHour !== undefined) setTaskEndHour(v.endHour);
        if (v.startMinute !== undefined) setTaskStartMinute(v.startMinute);
        if (v.endMinute !== undefined) setTaskEndMinute(v.endMinute);
        if (v.timeZone) setTaskTimeZone(v.timeZone);
        try { localStorage.setItem('andes_task_time_window', JSON.stringify(v)); } catch (_) {}
      }
    } catch (e) {}
  }, [savedTimeWindow]);

  // Load global time window from server (Convex) if present
  const mutationSetSettings = useMutation((api as any).settings?.setSettings as any);

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
      
      // Convert to total minutes from midnight for comparison
      const currentTotalMinutes = localHours * 60 + utcMinutes;
      const startTotalMinutes = taskStartHour * 60 + taskStartMinute;
      const endTotalMinutes = taskEndHour * 60 + taskEndMinute;
      
      const withinWindow = currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
      setIsWithinTaskWindow(withinWindow);
      setTimeWindowDisplay(`${String(taskStartHour).padStart(2, '0')}:${String(taskStartMinute).padStart(2, '0')} - ${String(taskEndHour).padStart(2, '0')}:${String(taskEndMinute).padStart(2, '0')} ${taskTimeZone}`);
    };

    checkTimeWindow();
    const interval = setInterval(checkTimeWindow, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [taskStartHour, taskEndHour, taskStartMinute, taskEndMinute, taskTimeZone]);

  const handleSaveTimeWindow = () => {
    try {
      const timeWindowData = {
        startHour: taskStartHour,
        endHour: taskEndHour,
        startMinute: taskStartMinute,
        endMinute: taskEndMinute,
        timeZone: taskTimeZone,
      };
      
      // Save to localStorage
      localStorage.setItem('andes_task_time_window', JSON.stringify(timeWindowData));
      
      // Save to global settings (Convex) - all users will see this via real-time query
      try {
        mutationSetSettings({ key: 'andes_task_time_window', value: timeWindowData });
      } catch (err) {
        console.error('Failed to save global time window:', err);
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error('Error saving task time window:', e);
    }
  };

  // Load active tasks and durations from localStorage
  useEffect(() => {
    if (isMounted) return;

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
    setIsMounted(true);
  }, [isMounted]);

  // Listen for task start/stop events from TaskCard instances (same-tab updates)
  useEffect(() => {
    const onTaskUpdate = (e: any) => {
      try {
        const { grade, active } = e.detail || {};
        setActiveTasks((prev) => {
          const next = { ...prev };
          const equipmentMap: { [key: string]: number } = {
            'A1': 20, 'A2': 100, 'A3': 380, 'B1': 780, 'B2': 1800, 'B3': 4800
          };
          if (active) {
            next[grade] = equipmentMap[grade] || 0;
          } else {
            delete next[grade];
          }
          return next;
        });
      } catch (err) {
        console.error('Error handling task update event:', err);
      }
    };

    window.addEventListener('andes_task_update', onTaskUpdate as EventListener);
    return () => window.removeEventListener('andes_task_update', onTaskUpdate as EventListener);
  }, []);

  // Allow forcing admin UI for preview/testing via URL param or localStorage
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin_preview') === '1' || localStorage.getItem('andes_admin_preview') === '1') {
        setForceAdmin(true);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
    }
  }, [status, router]);

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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-gray-600 mb-8">Please sign in to view your tasks.</p>
          <Link
            href="/sign-in"
            className="block w-full py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  const grades = [
    { grade: 'A1', equipment: 20, daily: 2, monthly: 60, annual: 730, color: 'blue', durationHours: taskDurations['A1'] || 24 },
    { grade: 'A2', equipment: 100, daily: 6.6, monthly: 198, annual: 2409, color: 'blue', durationHours: taskDurations['A2'] || 48 },
    { grade: 'A3', equipment: 380, daily: 25, monthly: 750, annual: 9125, color: 'blue', durationHours: taskDurations['A3'] || 72 },
    { grade: 'B1', equipment: 780, daily: 52, monthly: 1560, annual: 18980, color: 'green', durationHours: taskDurations['B1'] || 96 },
    { grade: 'B2', equipment: 1800, daily: 120, monthly: 3600, annual: 43800, color: 'green', durationHours: taskDurations['B2'] || 120 },
    { grade: 'B3', equipment: 4800, daily: 320, monthly: 9600, annual: 116800, color: 'green', durationHours: taskDurations['B3'] || 144 },
  ];

  const activeTaskCount = Object.keys(activeTasks).length;

  return (
    <main className="font-montserrat text-gray-800 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      

      <div className="pt-24 px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">My Investment Tasks</h2>
            <p className="text-gray-600">Manage and monitor your active earning tasks</p>
          </div>

          {/* Task Window Status Banner */}
          <div className={`mb-8 rounded-2xl border p-4 ${isWithinTaskWindow ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-bold text-lg ${isWithinTaskWindow ? 'text-emerald-900' : 'text-amber-900'}`}>
                  {isWithinTaskWindow ? '✓ Task Window Open' : '⏰ Task Window Closed'}
                </h3>
                {isWithinTaskWindow && (
                  <p className={`text-sm mt-1 ${isWithinTaskWindow ? 'text-emerald-700' : 'text-amber-700'}`}>
                    Available: <span className="font-semibold">{taskStartHour}:00 - {taskEndHour}:00 {taskTimeZone}</span>
                  </p>
                )}
              </div>
              {!isWithinTaskWindow && (
                <div className="text-right">
                  <p className="text-sm text-amber-700">Come back during task hours to start new tasks</p>
                </div>
              )}
            </div>
          </div>

          {/* Admin Task Configuration (visible to admins) */}
          {(user?.role === 'admin' || forceAdmin) && (
            <div className="mb-8 bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-blue-900">Admin Task Configuration</h3>
                <button
                  onClick={() => setAdminMode(!adminMode)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    adminMode ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-200'
                  }`}
                >
                  {adminMode ? 'Hide' : 'Configure'}
                </button>
              </div>

              {adminMode && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <h4 className="font-bold text-gray-900 mb-4">Time Window Settings</h4>
                    <p className="text-sm text-gray-600 mb-4">Set when users can start tasks (global schedule)</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Start Hour (0-23)</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={taskStartHour}
                          onChange={(e) => setTaskStartHour(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Start Minute (0-59)</label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={taskStartMinute}
                          onChange={(e) => setTaskStartMinute(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">End Hour (0-23)</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={taskEndHour}
                          onChange={(e) => setTaskEndHour(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">End Minute (0-59)</label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={taskEndMinute}
                          onChange={(e) => setTaskEndMinute(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Timezone</label>
                        <select
                          value={taskTimeZone}
                          onChange={(e) => setTaskTimeZone(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="GMT-12">GMT-12</option>
                          <option value="GMT-11">GMT-11</option>
                          <option value="GMT-10">GMT-10</option>
                          <option value="GMT-9">GMT-9</option>
                          <option value="GMT-8">GMT-8</option>
                          <option value="GMT-7">GMT-7</option>
                          <option value="GMT-6">GMT-6</option>
                          <option value="GMT-5">GMT-5</option>
                          <option value="GMT-4">GMT-4</option>
                          <option value="GMT-3">GMT-3</option>
                          <option value="GMT-2">GMT-2</option>
                          <option value="GMT-1">GMT-1</option>
                          <option value="GMT">GMT</option>
                          <option value="GMT+1">GMT+1</option>
                          <option value="GMT+2">GMT+2</option>
                          <option value="GMT+3">GMT+3</option>
                          <option value="GMT+4">GMT+4</option>
                          <option value="GMT+5">GMT+5</option>
                          <option value="GMT+6">GMT+6</option>
                          <option value="GMT+7">GMT+7</option>
                          <option value="GMT+8">GMT+8</option>
                          <option value="GMT+9">GMT+9</option>
                          <option value="GMT+10">GMT+10</option>
                          <option value="GMT+11">GMT+11</option>
                          <option value="GMT+12">GMT+12</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveTimeWindow}
                      className="w-full py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Save Time Window
                    </button>
                    {saveSuccess && (
                      <div className="text-center text-sm text-emerald-600 font-semibold mt-2">✓ Saved successfully!</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Active Tasks */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm text-gray-600 font-medium">Active Tasks</h3>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <span className="text-2xl">▶️</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{activeTaskCount}</p>
              <p className="text-xs text-gray-500 mt-2">Currently earning rewards</p>
            </div>

            {/* Total Earnings */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm text-gray-600 font-medium">Total Balance</h3>
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">${user?.depositAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}</p>
              <p className="text-xs text-gray-500 mt-2">Available for use</p>
            </div>

            {/* Available Tasks */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm text-gray-600 font-medium">Available Tasks</h3>
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                  <span className="text-2xl">📦</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{6 - activeTaskCount}</p>
              <p className="text-xs text-gray-500 mt-2">Ready to start</p>
            </div>
          </div>

          {/* Tasks Grid */}
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">All Investment Packages</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {grades.map((item) => (
                <TaskCard
                  key={item.grade}
                  item={item}
                  durationHours={item.durationHours}
                  userBalance={user?.depositAmount || 0}
                  isWithinTaskWindow={isWithinTaskWindow}
                  timeWindowDisplay={timeWindowDisplay}
                  taskStartHour={taskStartHour}
                  taskEndHour={taskEndHour}
                  taskStartMinute={taskStartMinute}
                  taskEndMinute={taskEndMinute}
                  taskTimeZone={taskTimeZone}
                  userId={user?._id}
                  // Pass active state from page (derived from localStorage on mount)
                  isActive={!!activeTasks[item.grade]}
                />
              ))}
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-white rounded-2xl p-8 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 font-bold text-emerald-600">1</div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Select Package</h4>
                  <p className="text-sm text-gray-600">Choose an investment package that matches your budget</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 font-bold text-emerald-600">2</div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Start Task</h4>
                  <p className="text-sm text-gray-600">Deploy your investment and begin earning immediately</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 font-bold text-emerald-600">3</div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Earn Rewards</h4>
                  <p className="text-sm text-gray-600">Receive daily profits until task completion</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function TaskCard({ item, durationHours, userBalance, isWithinTaskWindow, timeWindowDisplay, taskStartHour, taskEndHour, taskStartMinute, taskEndMinute, taskTimeZone, userId, isActive }: { item: any; durationHours: number; userBalance: number; isWithinTaskWindow: boolean; timeWindowDisplay: string; taskStartHour: number; taskEndHour: number; taskStartMinute: number; taskEndMinute: number; taskTimeZone: string; userId?: string; isActive?: boolean }) {
  const storageKey = `andes_device_${item.grade}`;
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [active, setActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showDepositError, setShowDepositError] = useState(false);
  const [showTimeError, setShowTimeError] = useState(false);
  const [taskExpired, setTaskExpired] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const completeTaskWithRewardsMutation = useMutation((api as any).taskManagement?.completeTaskWithRewards as any);
  const startTaskMutation = useMutation((api as any).taskManagement?.startTask as any);
  const closeTaskMutation = useMutation((api as any).taskManagement?.closeTask as any);
  const [taskIdState, setTaskIdState] = useState<string | null>(null);

  // Load initial task state from localStorage on mount
  useEffect(() => {
    try {
      // Prefer active state passed from parent (page) which is derived from localStorage there.
      if (typeof isActive === 'boolean') {
        setActive(!!isActive);
      }

      // Also read persisted details (startTime/expiresAt) if present
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.startTime) {
          setStartTime(parsed.startTime);
        }
        if (parsed.expiresAt) {
          setExpiresAt(parsed.expiresAt);
        }
        if (parsed.taskId) {
          setTaskIdState(parsed.taskId);
        }
        // If parent didn't indicate active but storage says active, ensure we reflect that
        if (typeof isActive !== 'boolean' && parsed.active) {
          setActive(true);
        }
      }
    } catch (e) {
      console.error('Error loading task:', e);
    }
  }, [storageKey]);

  // Update timer every second when task is active and count down to task window end
  useEffect(() => {
    if (!active) return;

    const updateTime = () => {
      const now = new Date();
      
      // Parse timezone offset from taskTimeZone (e.g., "GMT+2" or "GMT-5")
      const tzMatch = taskTimeZone.match(/GMT([+-]\d+)/);
      const tzOffset = tzMatch ? parseInt(tzMatch[1]) : 2;
      
      // Calculate current time in target timezone
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const utcSeconds = now.getUTCSeconds();
      const localHours = (utcHours + tzOffset + 24) % 24;
      
      // Convert to total minutes from midnight for both current time and end time
      const currentTotalMinutes = localHours * 60 + utcMinutes;
      const endTotalMinutes = taskEndHour * 60 + taskEndMinute;
      
      // Calculate remaining seconds from current time until endpoint
      let remainingSeconds = (endTotalMinutes * 60) - (currentTotalMinutes * 60) - utcSeconds;
      
      // Check if window has closed
      if (remainingSeconds <= 0) {
        setActive(false);
        setStartTime(null);
        setTaskExpired(true);
        setExpiresAt(null);
        try {
          // Get existing data BEFORE overwriting
          let existing: any = null;
          try { existing = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (e) {}
          const convexTaskId = existing?.taskId || taskIdState;
          
          // Update localStorage but PRESERVE the taskId
          localStorage.setItem(storageKey, JSON.stringify({ 
            active: false, 
            expired: true,
            taskId: convexTaskId
          }));
          
          // Award rewards when task expires
          if (userId && startTime && convexTaskId) {
            completeTaskWithRewardsMutation({ 
              taskId: convexTaskId as any, 
              userId: userId as any 
            }).catch(err => console.error('Failed to award rewards:', err));
          } else if (userId && startTime) {
            console.error('No Convex taskId available for completion - skipping reward call');
          }
        } catch (e) {}
        return;
      }
      
      // Convert remaining seconds to hours, minutes, seconds
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;
      
      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [active, taskEndHour, taskEndMinute, taskTimeZone, storageKey, userId, startTime, completeTaskWithRewardsMutation]);

  // Persist task state to localStorage whenever it changes
  useEffect(() => {
    try {
      // Include taskIdState so we don't accidentally overwrite the persisted Convex task id
      localStorage.setItem(storageKey, JSON.stringify({ active, startTime, expiresAt, taskId: taskIdState }));
    } catch (e) {
      console.error('Error saving task:', e);
    }
  }, [active, startTime, expiresAt, storageKey, taskIdState]);

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'from-blue-500 to-blue-600';
    return 'from-green-500 to-green-600';
  };

  const required = item.equipment;
  const totalAvailable = userBalance;

  const handleStartTask = async () => {
    if (!isWithinTaskWindow) {
      setShowTimeError(true);
      setTimeout(() => setShowTimeError(false), 3000);
      return;
    }

    if (totalAvailable < required) {
      setShowDepositError(true);
      setTimeout(() => setShowDepositError(false), 3000);
      return;
    }

    const now = Date.now();
    const expiryTime = now + (durationHours * 60 * 60 * 1000);
    setActive(true);
    setStartTime(now);
    setExpiresAt(expiryTime);
    setTaskExpired(false);
    try {
      let taskId: string | null = null;
      
      // Create server-side task record and get the Convex taskId
      if (userId) {
        try {
          const res: any = await startTaskMutation({ userId: userId as any, grade: item.grade, durationHours });
          if (res && res.taskId) {
            taskId = res.taskId;
          } else {
            // Fallback: generate a local ID if server didn't return one
            // Format: userId_grade_timestamp
            taskId = `task_${userId}_${item.grade}_${now}`;
            console.warn('Server did not return taskId, using generated ID:', taskId);
          }
        } catch (e) {
          // Fallback: generate a local ID on error
          taskId = `task_${userId}_${item.grade}_${now}`;
          console.warn('Failed to create server task, using generated ID:', taskId, e);
        }
      } else {
        // Fallback: generate a local ID if no userId
        taskId = `task_local_${item.grade}_${now}`;
      }
      
      // Always set taskIdState with the final taskId
      setTaskIdState(taskId);
      
      // Persist complete state with the taskId
      localStorage.setItem(storageKey, JSON.stringify({ 
        active: true, 
        startTime: now,
        expiresAt: expiryTime,
        durationHours: durationHours,
        taskId: taskId
      }));
      
      // Notify other components in the same tab about this task starting
      try { window.dispatchEvent(new CustomEvent('andes_task_update', { detail: { grade: item.grade, active: true } })); } catch (_) {}
    } catch (e) {
      console.error('Error persisting task start:', e);
    }
  };

  const handleStopTask = () => {
    setActive(false);
    setStartTime(null);
    setExpiresAt(null);
    try {
      // Get the taskId from state first, then check localStorage as fallback
      const convexTaskId = taskIdState || (() => {
        let persisted: any = null;
        try { persisted = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (e) {}
        return persisted?.taskId || null;
      })();
      
      if (convexTaskId) {
        closeTaskMutation({ taskId: convexTaskId as any }).catch(err => console.error('Failed to close server task:', err));
      }
      
      localStorage.setItem(storageKey, JSON.stringify({ active: false, taskId: convexTaskId || undefined }));
      // Notify other components in the same tab about this task stopping
      try { window.dispatchEvent(new CustomEvent('andes_task_update', { detail: { grade: item.grade, active: false } })); } catch (_) {}
    } catch (e) {
      console.error('Error persisting task stop:', e);
    }
  };

  // Sync with other tabs/windows when storage changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key !== storageKey) return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : null;
        setActive(!!parsed?.active);
        setStartTime(parsed?.startTime || null);
        setExpiresAt(parsed?.expiresAt || null);
        if (!parsed?.active) {
          setTimeRemaining('');
        }
      } catch (err) {
        console.error('Error parsing storage event for task:', err);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border ${
      taskExpired ? 'border-gray-300 bg-gray-50' : active ? 'border-emerald-200 bg-white' : 'border-gray-100 bg-white'
    }`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${getGradeColor(item.grade)} p-6 text-white relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2">{item.grade} Series</h3>
            <p className="text-white/90">Investment Package</p>
          </div>
          <div className="w-20 h-20 bg-white/20 rounded-lg flex items-center justify-center p-2 flex-shrink-0">
            <Image src="/scooter.png" alt="Scooter" width={64} height={64} className="object-contain" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={`p-6 ${taskExpired ? 'opacity-50' : ''}`}>
        {/* Status Badge */}
        <div className="mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
            taskExpired
              ? 'bg-gray-200 text-gray-700'
              : active 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-gray-100 text-gray-700'
          }`}>
            {taskExpired ? '⏱️ Expired' : active ? '🟢 Active' : '⚪ Available'}
          </span>
        </div>

        {/* Time Window Status */}
        <div className={`mb-4 rounded-lg p-3 border ${isWithinTaskWindow ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`text-xs font-semibold ${isWithinTaskWindow ? 'text-emerald-600' : 'text-red-600'}`}>
            {isWithinTaskWindow ? '✓ Task Window Open' : '✗ Task Window Closed'}
          </div>
          {isWithinTaskWindow && (
            <div className={`text-xs mt-1 font-semibold ${isWithinTaskWindow ? 'text-emerald-700' : 'text-red-700'}`}>
              {taskStartHour}:00 - {taskEndHour}:00 {taskTimeZone}
            </div>
          )}
        </div>

        {/* Info Rows */}
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

        {/* Timer Display */}
        {active && timeRemaining && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
            <p className="text-xs text-emerald-600 font-semibold uppercase mb-2">⏱️ Time Remaining</p>
            <p className="text-3xl font-bold text-emerald-700 font-mono">{timeRemaining}</p>
          </div>
        )}

        {/* Expired Message */}
        {taskExpired && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-orange-700 font-semibold">
              ⏰ Task expired. You can start a new one.
            </p>
          </div>
        )}

        {/* Error Messages */}
        {showTimeError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700 font-semibold">
              ⏰ Tasks can only be started {timeWindowDisplay}
            </p>
          </div>
        )}
        {showDepositError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700 font-semibold">
              ❌ Need ${required - totalAvailable} more USDT
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {!active ? (
          <button
            onClick={handleStartTask}
            className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
              isWithinTaskWindow && totalAvailable >= required
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!isWithinTaskWindow || totalAvailable < required}
          >
            {!isWithinTaskWindow 
              ? '⏰ Task Window Closed' 
              : totalAvailable >= required 
                ? '▶️ Start Task' 
                : `Need $${required - totalAvailable} more`}
          </button>
        ) : (
          <button
            onClick={handleStopTask}
            className="w-full py-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold text-sm border border-red-200 transition-colors"
          >
            ⏹️ Stop Task
          </button>
        )}
      </div>
    </div>
  );
}
