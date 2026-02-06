import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  shouldSendScheduledDuelReminder,
  shouldSendWeeklyGoalReminder,
} from "../../lib/notificationPreferences";

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

    const activeGoals = await ctx.runQuery(
      internal.weeklyGoals.getActiveGoalsWithExpiry,
      {}
    );

    for (const goal of activeGoals) {
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