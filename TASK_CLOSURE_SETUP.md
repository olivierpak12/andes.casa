/**
 * SETUP GUIDE: AUTOMATIC TASK CLOSURE
 * ====================================
 * 
 * This guide explains how to enable automatic task closure to prevent users
 * from manipulating localStorage to extend task times.
 * 
 * OPTION 1: MANUAL SCHEDULE (Recommended for Initial Launch)
 * ===========================================================
 * 
 * Run the task closure check from Dashboard Admin panel:
 * 
 * 1. Add a button to the Dashboard admin panel
 * 2. When clicked, calls: checkAndCloseExpiredTasks() mutation
 * 3. Scans all active tasks in database
 * 4. Auto-closes any task where now >= expiresAt
 * 
 * Implementation:
 * - Go to app/(dashboard)/dashboard/page.tsx
 * - Find the "Global Task Schedule" section
 * - Add button: "Cleanup Expired Tasks Now"
 * - Call: checkAndCloseExpiredTasks() mutation
 * 
 * OPTION 2: PERIODIC SERVER JOB (Production Recommended)
 * =======================================================
 * 
 * Setup an HTTP endpoint that runs every 5-15 minutes:
 * 
 * 1. Create Convex HTTP Action:
 *    
 *    File: convex/taskManagement.ts (add this):
 *    
 *    export const httpCheckExpiredTasks = httpAction(async (ctx, request) => {
 *      // Verify secret token for security
 *      const token = new URL(request.url).searchParams.get('token');
 *      if (token !== process.env.TASK_CLEANUP_SECRET) {
 *        return new Response('Unauthorized', { status: 401 });
 *      }
 *    
 *      const result = await ctx.runMutation(api.taskManagement.checkAndCloseExpiredTasks, {});
 *      return new Response(JSON.stringify(result), { status: 200 });
 *    });
 * 
 * 2. Deploy and get the endpoint URL:
 *    - Deploy to Convex
 *    - Copy the HTTP endpoint URL from Convex dashboard
 * 
 * 3. Setup External Scheduler (e.g., EasyCron, AWS Lambda, or cron.io):
 *    - Service: EasyCron.com (free tier)
 *    - URL: https://your-convex.convex.cloud/taskManagement/httpCheckExpiredTasks?token=YOUR_SECRET
 *    - Frequency: Every 5 minutes
 *    - Method: GET or POST
 * 
 * Environment Variables needed:
 *    TASK_CLEANUP_SECRET=your-secure-random-string
 * 
 * OPTION 3: CLIENT-SIDE VALIDATION (Current Implementation)
 * ===========================================================
 * 
 * Currently implemented, but can be validated server-side:
 * 
 * When user clicks "Stop Task" or task expires:
 * 1. Calculate what expiresAt should be: startedAt + (durationHours * 3600000)
 * 2. If current task.expiresAt doesn't match, reject (user manipulated it)
 * 3. Compare Date.now() to stored expiresAt
 * 4. If user trying to use task past expiration, deny action
 * 
 * OPTION 4: HYBRID APPROACH (Best Security)
 * ==========================================
 * 
 * Combine client-side UX with server-side enforcement:
 * 
 * 1. Client side (good UX):
 *    - Show countdown timer
 *    - Auto-disable task actions when expired
 *    - Display "Task Expired" message
 * 
 * 2. Server side (security):
 *    - Verify expiresAt on every mutation
 *    - Check: now < task.expiresAt
 *    - Reject any action on expired tasks
 *    - Periodic cleanup to change status to "expired"
 * 
 * Implementation in convex/taskManagement.ts:
 * 
 *    // Helper function to validate task is not expired
 *    async function validateTaskNotExpired(ctx, taskId) {
 *      const task = await ctx.db.get(taskId);
 *      if (!task) throw new Error("Task not found");
 *      if (task.status !== "active") throw new Error("Task is not active");
 *      if (Date.now() >= task.expiresAt) {
 *        // Auto-close expired task
 *        await ctx.db.patch(taskId, { status: "expired", updatedAt: Date.now() });
 *        throw new Error("Task has expired");
 *      }
 *      return task;
 *    }
 *    
 *    // Then use in mutations:
 *    export const completeTask = mutation({
 *      args: { taskId: v.id("task") },
 *      handler: async (ctx, args) => {
 *        const task = await validateTaskNotExpired(ctx, args.taskId);
 *        // ... rest of logic
 *      },
 *    });
 * 
 * TESTING TASK EXPIRATION
 * =======================
 * 
 * 1. Test with short duration:
 *    - Temporarily set A1 duration to 1 minute
 *    - Save changes
 *    - Start a task
 *    - Watch timer count down
 *    - Verify task auto-stops when counter reaches 0
 * 
 * 2. Test automatic cleanup:
 *    - Set a task with very short duration (30 seconds)
 *    - Start the task
 *    - Wait for it to naturally expire
 *    - Call checkAndCloseExpiredTasks()
 *    - Verify: task status changed to "expired" in database
 * 
 * 3. Test admin duration change:
 *    - Start a task (e.g., 2 hours remaining)
 *    - As admin, change that grade's duration to 5 hours
 *    - Call updateTaskDuration()
 *    - Verify: user's task now shows 5 hours remaining
 *    - Verify: expiresAt recalculated correctly
 * 
 * MONITORING
 * ==========
 * 
 * To monitor task expirations:
 * 
 * 1. Check Convex database:
 *    - Query tasks with status = "expired"
 *    - Track frequency of expirations
 *    - Identify patterns
 * 
 * 2. Setup logs:
 *    - Log all updateTaskDuration calls
 *    - Log all checkAndCloseExpiredTasks runs
 *    - Track admin usage of duration changes
 * 
 * 3. Create admin dashboard:
 *    - Show count of active vs expired tasks
 *    - Display task expiration timeline
 *    - Show duration change history
 * 
 * TROUBLESHOOTING
 * ===============
 * 
 * Issue: Tasks not expiring
 * - Check: expiresAt timestamp correct (milliseconds, not seconds)
 * - Check: System time on server is accurate
 * - Check: Interval is running (should update every second)
 * - Check: localStorage has correct expiresAt value
 * 
 * Issue: Admin changes don't affect active tasks
 * - Check: updateTaskDuration() called for all grades
 * - Check: Real-time query is subscribed to task changes
 * - Check: Browser localStorage not overriding server value
 * - Try: Hard refresh (Ctrl+Shift+R)
 * 
 * Issue: Time window not enforced
 * - Check: Current timezone is correctly parsed
 * - Check: Start/end hours are in 24-hour format
 * - Check: isWithinTaskWindow state is updating
 * - Check: Button disabled state is linked to isWithinTaskWindow
 * 
 * PERFORMANCE CONSIDERATIONS
 * ==========================
 * 
 * 1. Database Queries:
 *    - checkAndCloseExpiredTasks() scans all active tasks
 *    - For 1000+ active tasks, consider pagination:
 *      tasks.collect() -> tasks.take(500) in loop
 * 
 * 2. Real-Time Updates:
 *    - Every task update triggers real-time subscribers
 *    - For many concurrent updates, consider batching
 *    - Or schedule cleanup during off-peak hours
 * 
 * 3. Timer Intervals:
 *    - Update every 1 second per active task
 *    - For 100+ users: consider 5-second intervals
 *    - Or use shared interval for all tasks on page
 * 
 * SECURITY CHECKLIST
 * ==================
 * 
 * - [ ] Tasks verified on backend before allowing any action
 * - [ ] expiresAt never trusted from client
 * - [ ] durationHours only changeable by admins
 * - [ ] startTime validated against server timestamp
 * - [ ] userId verified against session
 * - [ ] Audit logs created for all task changes
 * - [ ] Failed task actions logged
 * - [ ] Periodic cleanup automated
 * - [ ] Rate limiting on task start/stop
 * - [ ] SQL injection protection (Convex handles this)
 */

export const IMPLEMENTATION_STATUS = {
  clientSideTimers: "✅ COMPLETE",
  adminDurationChange: "✅ COMPLETE", 
  taskExpiration: "✅ COMPLETE",
  timeWindowControl: "✅ COMPLETE",
  serverSideValidation: "📋 TODO",
  automatedCleanup: "📋 TODO",
  auditLogging: "📋 TODO",
  realTimeSync: "⚠️ PARTIAL (uses Convex queries)",
};
