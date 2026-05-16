import { ConvexError, v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { emailNotificationTriggerValidator } from "../schema";
import {
  isNotificationEnabled,
  type NotificationTrigger,
} from "../../lib/notificationPreferences";
import { renderNotificationEmail } from "../../lib/notificationTemplates";
import { buildEmailData } from "./notificationEmailData";

function getNotificationAppUrl(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new ConvexError({ code: "CONFIG_ERROR", message: "APP_URL must be set before sending notification emails" });
  }
  return appUrl;
}

function assertRequiredEmailContext(args: {
  trigger: NotificationTrigger;
  challengeId?: unknown;
  weeklyGoalId?: unknown;
  dedupeKey?: unknown;
  reminderOffsetMinutes?: unknown;
}) {
  if (args.trigger === "immediate_challenge_invite" && !args.challengeId) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Challenge email requires challengeId" });
  }

  if (args.trigger.startsWith("weekly_goal_") && !args.weeklyGoalId) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Weekly-goal email requires weeklyGoalId" });
  }

  if (
    (args.trigger === "weekly_goal_daily_reminder" ||
      args.trigger === "weekly_goal_grace_period_reminder") &&
    !args.dedupeKey
  ) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Daily reminder email requires dedupeKey" });
  }

  if (
    (args.trigger === "weekly_goal_reminder_1" ||
      args.trigger === "weekly_goal_reminder_2") &&
    typeof args.reminderOffsetMinutes !== "number"
  ) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Fixed reminder email requires reminderOffsetMinutes" });
  }
}

export const sendNotificationEmail = internalAction({
  args: {
    trigger: emailNotificationTriggerValidator,
    toUserId: v.id("users"),
    fromUserId: v.optional(v.id("users")),
    challengeId: v.optional(v.id("challenges")),
    duelId: v.optional(v.id("duels")),
    soloPracticeSessionId: v.optional(v.id("soloPracticeSessions")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
    dedupeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trigger = args.trigger as NotificationTrigger;
    assertRequiredEmailContext({
      trigger,
      challengeId: args.challengeId,
      weeklyGoalId: args.weeklyGoalId,
      dedupeKey: args.dedupeKey,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
    });
    const toUser = await ctx.runQuery(internal.emails.notificationEmailData.getUserById, {
      id: args.toUserId,
    });
    if (!toUser?.email) return { sent: false, reason: "no_email" as const };

    const prefs = await ctx.runQuery(internal.notificationPreferences.getByUserId, {
      userId: args.toUserId,
    });

    if (!isNotificationEnabled(trigger, prefs)) {
      return { sent: false, reason: "disabled_by_user" as const };
    }

    const emailData = await buildEmailData(ctx, {
      trigger,
      toUser,
      fromUserId: args.fromUserId,
      challengeId: args.challengeId,
      duelId: args.duelId,
      soloPracticeSessionId: args.soloPracticeSessionId,
      weeklyGoalId: args.weeklyGoalId,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
      dedupeKey: args.dedupeKey,
    });

    const { subject, html } = renderNotificationEmail(trigger, emailData, {
      appUrl: getNotificationAppUrl(),
    });

    const claim = await ctx.runMutation(internal.emails.emailNotificationLog.claimNotificationSend, {
      toUserId: args.toUserId,
      trigger: args.trigger,
      challengeId: args.challengeId,
      duelId: args.duelId,
      soloPracticeSessionId: args.soloPracticeSessionId,
      weeklyGoalId: args.weeklyGoalId,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
      dedupeKey: args.dedupeKey,
    });
    if (!claim.claimed) return { sent: false, reason: "already_sent" as const };
    if (!claim.claimId) {
      throw new ConvexError({ code: "INTERNAL_ERROR", message: "Email send claim was created without a claim id" });
    }

    try {
      await ctx.runAction(internal.emails.actions.internalSendEmail, {
        to: toUser.email,
        subject,
        html,
      });
      await ctx.runMutation(internal.emails.emailNotificationLog.markNotificationSendSent, {
        claimId: claim.claimId,
      });
    } catch (error) {
      await ctx.runMutation(internal.emails.emailNotificationLog.markNotificationSendFailed, {
        claimId: claim.claimId,
      });
      throw error;
    }

    return { sent: true };
  },
});
