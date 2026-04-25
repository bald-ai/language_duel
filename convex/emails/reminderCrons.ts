import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  getTimeZoneDateKey,
  getTimeZoneDateParts,
  shouldSendScheduledDuelReminder,
  shouldSendWeeklyGoalReminder,
} from "../../lib/notificationPreferences";
import {
  WEEKLY_GOAL_DAILY_REMINDER_LOCAL_HOUR,
  WEEKLY_GOAL_DAILY_REMINDER_LOCAL_MINUTE,
  WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE,
} from "../constants";

export const sendScheduledDuelReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const upcomingDuels = await ctx.runQuery(
      internal.scheduledDuels.getUpcomingAcceptedDuels,
      {}
    );

    for (const duel of upcomingDuels) {
      const participants = [duel.proposerId, duel.recipientId];

      for (const userId of participants) {
        const prefs = await ctx.runQuery(internal.notificationPreferences.getByUserId, {
          userId,
        });

        if (
          shouldSendScheduledDuelReminder(
            duel,
            now,
            prefs.scheduledDuelReminderOffsetMinutes
          )
        ) {
          await ctx.runAction(internal.emails.notificationEmails.sendNotificationEmail, {
            trigger: "scheduled_duel_reminder",
            toUserId: userId,
            scheduledDuelId: duel._id,
            reminderOffsetMinutes: prefs.scheduledDuelReminderOffsetMinutes,
          });
        }
      }
    }
  },
});

export const sendWeeklyGoalReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const lockedGoals = await ctx.runQuery(
      internal.weeklyGoals.getLockedGoalsWithEndDate,
      {}
    );

    for (const goal of lockedGoals) {
      const participants = [goal.creatorId, goal.partnerId];

      for (const userId of participants) {
        const prefs = await ctx.runQuery(internal.notificationPreferences.getByUserId, {
          userId,
        });

        if (
          prefs.weeklyGoalReminder1Enabled &&
          shouldSendWeeklyGoalReminder(
            goal,
            now,
            prefs.weeklyGoalReminder1OffsetMinutes
          )
        ) {
          await ctx.runAction(internal.emails.notificationEmails.sendNotificationEmail, {
            trigger: "weekly_goal_reminder_1",
            toUserId: userId,
            weeklyGoalId: goal._id,
            reminderOffsetMinutes: prefs.weeklyGoalReminder1OffsetMinutes,
          });
        }

        if (
          prefs.weeklyGoalReminder2Enabled &&
          shouldSendWeeklyGoalReminder(
            goal,
            now,
            prefs.weeklyGoalReminder2OffsetMinutes
          )
        ) {
          await ctx.runAction(internal.emails.notificationEmails.sendNotificationEmail, {
            trigger: "weekly_goal_reminder_2",
            toUserId: userId,
            weeklyGoalId: goal._id,
            reminderOffsetMinutes: prefs.weeklyGoalReminder2OffsetMinutes,
          });
        }
      }
    }
  },
});

export const sendDailyWeeklyGoalReminderEmails = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const localTime = getTimeZoneDateParts(now, WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE);

    if (
      localTime.hour !== WEEKLY_GOAL_DAILY_REMINDER_LOCAL_HOUR ||
      localTime.minute !== WEEKLY_GOAL_DAILY_REMINDER_LOCAL_MINUTE
    ) {
      return;
    }

    const lockedGoals = await ctx.runQuery(
      internal.weeklyGoals.getLockedGoalsWithEndDate,
      {}
    );
    const gracePeriodGoals = await ctx.runQuery(
      internal.weeklyGoals.getGoalsInGraceWindow,
      {}
    );
    const dailyKey = getTimeZoneDateKey(now, WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE);

    for (const goal of lockedGoals) {
      const participants = [goal.creatorId, goal.partnerId];

      for (const userId of participants) {
        const prefs = await ctx.runQuery(internal.notificationPreferences.getByUserId, {
          userId,
        });

        if (!prefs.weeklyGoalDailyReminderEnabled) {
          continue;
        }

        await ctx.runAction(internal.emails.notificationEmails.sendNotificationEmail, {
          trigger: "weekly_goal_daily_reminder",
          toUserId: userId,
          weeklyGoalId: goal._id,
          dedupeKey: dailyKey,
        });
      }
    }

    for (const goal of gracePeriodGoals) {
      const participants = [goal.creatorId, goal.partnerId];

      for (const userId of participants) {
        const prefs = await ctx.runQuery(internal.notificationPreferences.getByUserId, {
          userId,
        });

        if (!prefs.weeklyGoalDailyReminderEnabled) {
          continue;
        }

        await ctx.runAction(internal.emails.notificationEmails.sendNotificationEmail, {
          trigger: "weekly_goal_expired_delete_reminder",
          toUserId: userId,
          weeklyGoalId: goal._id,
          dedupeKey: dailyKey,
        });
      }
    }
  },
});

export const sendDraftExpiryReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiringDrafts = await ctx.runQuery(
      internal.weeklyGoals.getDraftGoalsExpiringSoon,
      {}
    );

    for (const goal of expiringDrafts) {
      const alreadySent = await ctx.runQuery(
        internal.emails.notificationEmails.checkNotificationSent,
        {
          toUserId: goal.creatorId,
          trigger: "weekly_goal_draft_expiring",
          weeklyGoalId: goal._id,
        }
      );

      if (alreadySent) {
        continue;
      }

      await ctx.runMutation(internal.weeklyGoals.createDraftExpiryNotification, {
        goalId: goal._id,
        now,
      });

      const result = await ctx.runAction(
        internal.emails.notificationEmails.sendNotificationEmail,
        {
          trigger: "weekly_goal_draft_expiring",
          toUserId: goal.creatorId,
          weeklyGoalId: goal._id,
        }
      );

      if (!result.sent) {
        await ctx.runMutation(
          internal.emails.notificationEmails.logNotificationSent,
          {
            toUserId: goal.creatorId,
            trigger: "weekly_goal_draft_expiring",
            weeklyGoalId: goal._id,
          }
        );
      }
    }
  },
});
