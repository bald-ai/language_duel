import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  getTimeZoneDateKey,
  getTimeZoneDateParts,
} from "../../lib/notificationPreferences";
import {
  WEEKLY_GOAL_DAILY_REMINDER_LOCAL_HOUR,
  WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE,
} from "../constants";
import {
  planDailyReminderEmail,
  planDraftExpiryDecision,
  planFixedReminderEmails,
  planGracePeriodReminderEmail,
} from "./reminderPlanners";
import { getGoalParticipantIds } from "../weeklyGoals/participants";

// Best-effort fan-out: a single failing recipient must not abort the batch, so
// we log and continue. This is intentional batch isolation, not a silent fallback.
async function runEmailSend(send: () => Promise<unknown>, context: string) {
  try {
    await send();
  } catch (error) {
    console.error(`Failed to send reminder email: ${context}`, error);
  }
}

export const sendWeeklyGoalReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const lockedGoals = await ctx.runQuery(
      internal.weeklyGoals.getLockedGoalsWithEndDate,
      {}
    );

    for (const goal of lockedGoals) {
      const participants = getGoalParticipantIds(goal);

      for (const userId of participants) {
        const prefs = await ctx.runQuery(internal.notificationPreferences.getByUserId, {
          userId,
        });

        const plannedSends = planFixedReminderEmails({
          goal,
          toUserId: userId,
          now,
          prefs,
        });

        for (const plannedSend of plannedSends) {
          await runEmailSend(
            () =>
              ctx.runAction(internal.emails.notificationEmails.sendNotificationEmail, {
                trigger: plannedSend.trigger,
                toUserId: plannedSend.toUserId,
                weeklyGoalId: plannedSend.weeklyGoalId,
                reminderOffsetMinutes: plannedSend.reminderOffsetMinutes,
              }),
            `${plannedSend.trigger} ${goal._id} for user ${userId}`
          );
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

    if (localTime.hour !== WEEKLY_GOAL_DAILY_REMINDER_LOCAL_HOUR) {
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
      const participants = getGoalParticipantIds(goal);

      for (const userId of participants) {
        const plannedSend = planDailyReminderEmail({
          goal,
          toUserId: userId,
          dedupeKey: dailyKey,
        });

        await runEmailSend(
          () =>
            ctx.runAction(internal.emails.notificationEmails.sendNotificationEmail, {
              trigger: plannedSend.trigger,
              toUserId: plannedSend.toUserId,
              weeklyGoalId: plannedSend.weeklyGoalId,
              dedupeKey: plannedSend.dedupeKey,
            }),
          `daily weekly goal ${goal._id} for user ${userId}`
        );
      }
    }

    for (const goal of gracePeriodGoals) {
      const participants = getGoalParticipantIds(goal);

      for (const userId of participants) {
        const plannedSend = planGracePeriodReminderEmail({
          goal,
          toUserId: userId,
          dedupeKey: dailyKey,
        });

        await runEmailSend(
          () =>
            ctx.runAction(internal.emails.notificationEmails.sendNotificationEmail, {
              trigger: plannedSend.trigger,
              toUserId: plannedSend.toUserId,
              weeklyGoalId: plannedSend.weeklyGoalId,
              dedupeKey: plannedSend.dedupeKey,
            }),
          `grace weekly goal ${goal._id} for user ${userId}`
        );
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
        internal.emails.emailNotificationLog.checkNotificationSent,
        {
          toUserId: goal.creatorId,
          trigger: "weekly_goal_draft_expiring",
          weeklyGoalId: goal._id,
        }
      );

      const draftDecision = planDraftExpiryDecision({
        alreadySent,
      });
      if (!draftDecision.shouldCreateInAppNotification) {
        continue;
      }

      await ctx.runMutation(internal.weeklyGoals.createDraftExpiryNotification, {
        goalId: goal._id,
        now,
      });

      if (!draftDecision.shouldSendEmail) {
        continue;
      }

      await runEmailSend(
        () =>
          ctx.runAction(internal.emails.notificationEmails.sendNotificationEmail, {
            trigger: "weekly_goal_draft_expiring",
            toUserId: goal.creatorId,
            weeklyGoalId: goal._id,
          }),
        `draft expiry weekly goal ${goal._id} for user ${goal.creatorId}`
      );
    }
  },
});
