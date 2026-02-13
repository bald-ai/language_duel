/**
 * Cron jobs for scheduled tasks
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Cleanup scheduled duels every 5 minutes
// - Clears expired ready states (30 min since readyAt)
// - Cancels duels 1 hour after scheduled time if not started
crons.interval(
    "cleanup-scheduled-duels",
    { minutes: 5 },
    internal.scheduledDuels.autoCleanupScheduledDuels
);

crons.interval(
    "send-scheduled-duel-reminders",
    { minutes: 5 },
    internal.emails.reminderCrons.sendScheduledDuelReminders
);

crons.interval(
    "send-weekly-goal-reminders",
    { hours: 1 },
    internal.emails.reminderCrons.sendWeeklyGoalReminders
);

crons.interval(
    "cleanup-friend-requests",
    { hours: 24 },
    internal.friends.cleanupExpiredFriendRequests
);

crons.interval(
    "cleanup-weekly-goals",
    { hours: 24 },
    internal.weeklyGoals.cleanupExpiredGoals
);

export default crons;
