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
    "cleanup-duel-challenges",
    { minutes: 5 },
    internal.lobby.cleanupExpiredDuelChallenges
);

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
    "send-weekly-goal-draft-expiry-reminders",
    { hours: 1 },
    internal.emails.reminderCrons.sendDraftExpiryReminders
);

crons.hourly(
    "send-daily-weekly-goal-reminder-emails",
    { minuteUTC: 27 },
    internal.emails.reminderCrons.sendDailyWeeklyGoalReminderEmails
);

crons.interval(
    "cleanup-friend-requests",
    { hours: 24 },
    internal.friends.cleanupExpiredFriendRequests
);

crons.interval(
    "cleanup-resolved-friend-requests",
    { hours: 24 },
    internal.friends.cleanupResolvedFriendRequests
);

crons.interval(
    "cleanup-dismissed-notifications",
    { hours: 24 },
    internal.notifications.cleanupDismissedNotifications
);

crons.interval(
    "cleanup-email-notification-log",
    { hours: 24 },
    internal.emails.notificationEmails.cleanupEmailNotificationLog
);

crons.interval(
    "cleanup-terminal-scheduled-duels",
    { hours: 24 },
    internal.scheduledDuels.cleanupTerminalScheduledDuels
);

crons.interval(
    "cleanup-weekly-goals",
    { hours: 24 },
    internal.weeklyGoals.cleanupExpiredGoals
);

export default crons;
