import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { emailNotificationTriggerValidator } from "../schema";
import {
  isNotificationEnabled,
  type NotificationTrigger,
} from "../../lib/notificationPreferences";
import { renderNotificationEmail } from "../../lib/notificationTemplates";
import { buildEmailData } from "./notificationEmailData";

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

    const { subject, html } = renderNotificationEmail(trigger, emailData);

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
      throw new Error("Email send claim was created without a claim id");
    }

    try {
      await ctx.runAction(internal.emails.actions.internalSendEmail, {
        to: toUser.email,
        subject,
        html,
      });
    } catch (error) {
      await ctx.runMutation(internal.emails.emailNotificationLog.releaseNotificationSendClaim, {
        claimId: claim.claimId,
      });
      throw error;
    }

    return { sent: true };
  },
});
