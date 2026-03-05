/**
 * TASK TIMING SYSTEM DOCUMENTATION
 * ================================
 * 
 * This document explains how the task timing system works and how all users
 * see updated task times when an admin changes them.
 * 
 * ARCHITECTURE OVERVIEW
 * =====================
 * 
 * 1. GLOBAL SETTINGS (Convex Settings Table)
 *    - 'andes_task_time_window': Controls when tasks can be started (start/end hours + timezone)
 *    - 'andes_task_durations': Stores duration for each grade (A1, A2, A3, B1, B2, B3)
 * 
 * 2. USER ACTIVE TASKS (Convex Task Table)
 *    - Tracks each user's active tasks with:
 *      * userId: Who is running the task
 *      * grade: Task grade (A1-B3)
 *      * startedAt: When the task started (milliseconds)
 *      * expiresAt: When the task should auto-close (milliseconds)
 *      * durationHours: Duration set by admin (can change)
 *      * status: active|completed|expired|closed
 * 
 * 3. FRONTEND STATE MANAGEMENT
 *    - LocalStorage: Backup/cache of task settings
 *    - Real-time queries: Fetch settings from Convex on page load
 *    - Intervals: Update timers every second
 *    - Event listeners: Sync tasks across browser tabs
 * 
 * FEATURE: ADMIN EDITS TASK TIME
 * ===============================
 * 
 * When admin changes task duration (e.g., A1 from 24h to 36h):
 * 
 * 1. Admin updates duration in dashboard:
 *    - Input: A1 grade = 36 hours
 *    - Click: "Save Task Durations" button
 * 
 * 2. Backend processes the update:
 *    - Saves to Convex settings table: { key: 'andes_task_durations', value: {...} }
 *    - Calls updateTaskDuration() mutation which:
 *      * Finds all ACTIVE tasks for that grade
 *      * Recalculates expiresAt = startedAt + (newDuration * 60 * 60 * 1000)
 *      * Updates each task in database
 * 
 * 3. All users see the update:
 *    - Real-time queries trigger on all connected clients
 *    - New duration appears in task duration field
 *    - Active task countdowns are recalculated with new expiry time
 *    - localStorage syncs with server values
 * 
 * 4. New users see updated duration:
 *    - When creating new tasks, they use the updated duration
 *    - New tasks have expiresAt = now + (updatedDuration * 60 * 60 * 1000)
 * 
 * FEATURE: TIME WINDOW CONTROL
 * =============================
 * 
 * When admin sets task hours (e.g., 6 AM to 6 PM):
 * 
 * 1. Admin sets hours:
 *    - Start Hour: 6 (6 AM)
 *    - End Hour: 18 (6 PM)
 *    - Timezone: GMT+2
 *    - Click: "Save Time Window"
 * 
 * 2. Backend saves:
 *    - Convex settings: { key: 'andes_task_time_window', value: {startHour, endHour, timeZone} }
 * 
 * 3. All users see the restriction:
 *    - Dashboard shows: "Task Window Open" or "Task Window Closed"
 *    - If window is closed, all "Start Task" buttons are disabled
 *    - Error message shows: "Tasks can only be started 6:00 - 18:00 GMT+2"
 * 
 * 4. System calculates current time:
 *    - Parses timezone offset from "GMT+2" string
 *    - Converts UTC time to target timezone
 *    - Compares localized hour against start/end hours
 *    - Updates every 60 seconds
 * 
 * FEATURE: AUTOMATIC TASK EXPIRATION
 * ===================================
 * 
 * When a task's time expires:
 * 
 * 1. User's browser timer counts down:
 *    - Every second: currentTime < expiresAt
 *    - Displays: "Xh Xm Xs remaining"
 *    - Updates localStorage every second
 * 
 * 2. When countdown reaches 0:
 *    - Task status auto-changes to "expired"
 *    - Button changes from "⏹️ Stop Task" to "Start Task" again
 *    - Message shows: "⏰ Task expired. You can start a new one."
 *    - User can immediately start a new task (during task window)
 * 
 * 3. Backend cleanup (Optional - currently client-side):
 *    - Admin or system can call checkAndCloseExpiredTasks()
 *    - Scans all active tasks, closes those past expiresAt
 *    - Prevents abuse if client manipulates localStorage
 * 
 * SECURITY NOTES
 * ==============
 * 
 * Current Implementation (Client-Side Storage):
 * - ✓ Simple and responsive
 * - ✗ Users could manipulate localStorage to extend tasks
 * - ✗ No permanent record without manual audit
 * 
 * Recommended Improvements for Production:
 * 
 * 1. Server-Side Enforcement:
 *    - Store all task records in database
 *    - Validate expiresAt on every task action
 *    - Don't trust client timestamps
 * 
 * 2. Audit Trail:
 *    - Log every task start/stop/expire
 *    - Track admin duration changes
 *    - Create reports of task history
 * 
 * 3. Automated Cleanup:
 *    - Add Convex scheduled function (in Convex v1.1+)
 *    - Or use external cron service calling Convex HTTP action
 *    - Periodically close expired tasks
 * 
 * 4. Real-Time Sync:
 *    - Use Convex subscriptions for live updates
 *    - Tasks update instantly when admin changes duration
 *    - No page refresh needed
 * 
 * FILES INVOLVED
 * ==============
 * 
 * Backend:
 * - convex/schema.ts: Task table definition
 * - convex/taskManagement.ts: All task functions
 * - convex/settings.ts: Settings storage
 * 
 * Frontend - Dashboard:
 * - app/(dashboard)/dashboard/page.tsx: Admin task duration editor
 * 
 * Frontend - Tasks:
 * - app/(dashboard)/tasks/page.tsx: Task display with timers
 * 
 * API Integration:
 * - Convex mutations called from dashboard and tasks pages
 * - Real-time queries update UI automatically
 * 
 * TESTING THE FEATURE
 * ===================
 * 
 * Test 1: Admin changes task duration
 * - Go to Dashboard (as admin)
 * - Change A1 duration from 24 to 36 hours
 * - Click "Save Task Durations"
 * - Go to Tasks page
 * - Verify: Task duration shows 36 hours
 * - Open another browser tab to Tasks page
 * - Verify: Both tabs show 36 hours (real-time sync)
 * 
 * Test 2: Admin sets time window
 * - Go to Dashboard (as admin)
 * - Set task window to only 1 hour from now
 * - Go to Tasks page
 * - Verify: "Task Window Open" shows
 * - Wait for window to close (1 hour)
 * - Verify: "Task Window Closed" shows
 * - "Start Task" buttons are disabled
 * 
 * Test 3: Task auto-expires
 * - For testing speed: Temporarily set short duration (e.g., 1 minute)
 * - Go to Tasks page
 * - Click "Start Task"
 * - Timer counts down
 * - When countdown reaches 0, task auto-stops
 * - Status shows "⏰ Expired"
 * - Can start a new task immediately
 * 
 * FUTURE ENHANCEMENTS
 * ===================
 * 
 * 1. Task Pause/Resume:
 *    - Allow users to pause tasks temporarily
 *    - Timer doesn't count while paused
 *    - Extends expiresAt accordingly
 * 
 * 2. Task Extensions:
 *    - Users can extend task time (costs credits)
 *    - Admin can give extension bonuses
 *    - New expiresAt = currentExpiresAt + extensionTime
 * 
 * 3. Task History/Analytics:
 *    - Show users completed/expired tasks
 *    - Display earnings from each task
 *    - Export task reports
 * 
 * 4. Dynamic Pricing:
 *    - Different prices based on time of day
 *    - Shorter durations = higher daily return
 *    - Bonus multiplier during off-hours
 * 
 * 5. Multi-Task Management:
 *    - Allow users to run multiple tasks simultaneously
 *    - Track total earnings across active tasks
 *    - Set max concurrent tasks per user
 */

// Example: Checking if a task is expired on the frontend
export function isTaskExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt;
}

// Example: Formatting remaining time
export function formatTimeRemaining(expiresAt: number | null): string {
  if (!expiresAt) return 'No task';
  
  const remainingMs = Math.max(0, expiresAt - Date.now());
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
  
  return `${hours}h ${minutes}m ${seconds}s`;
}

// Example: Calculating new expiry time when admin changes duration
export function calculateNewExpiresAt(startedAt: number, newDurationHours: number): number {
  return startedAt + (newDurationHours * 60 * 60 * 1000);
}
