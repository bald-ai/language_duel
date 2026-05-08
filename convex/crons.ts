/**
 * Cron jobs for scheduled tasks
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
    "cleanup-challenge-invites",
    { minutes: 5 },
    internal.lobby.cleanupExpiredChallengeInvites
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
    "cleanup-weekly-goals",
    { hours: 24 },
    internal.weeklyGoals.cleanupWeeklyGoalRetention
);

export default crons;
