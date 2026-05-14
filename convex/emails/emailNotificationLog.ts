import { v } from "convex/values";
import {
  internalQuery,
  internalMutation,
  type QueryCtx,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { emailNotificationTriggerValidator } from "../schema";
import { type NotificationTrigger } from "../../lib/notificationPreferences";
import { EMAIL_LOG_TTL_MS } from "../constants";
import { isEmailLogPastRetention } from "../../lib/cleanupRetention";

type EmailNotificationLogLookupArgs = {
  toUserId: Id<"users">;
  trigger: NotificationTrigger;
  challengeId?: Id<"challenges">;
  duelId?: Id<"duels">;
  soloPracticeSessionId?: Id<"soloPracticeSessions">;
  weeklyGoalId?: Id<"weeklyGoals">;
  dedupeKey?: string;
};

async function checkEmailNotificationSent(
  ctx: Pick<QueryCtx, "db">,
  args: EmailNotificationLogLookupArgs
): Promise<boolean> {
  if (args.weeklyGoalId && args.dedupeKey) {
    const log = await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_weeklyGoal_dedupeKey", (q) =>
        q
          .eq("toUserId", args.toUserId)
          .eq("trigger", args.trigger)
          .eq("weeklyGoalId", args.weeklyGoalId)
          .eq("dedupeKey", args.dedupeKey)
      )
      .first();
    return Boolean(log);
  }

  if (args.challengeId) {
    const log = await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_challenge", (q) =>
        q
          .eq("toUserId", args.toUserId)
          .eq("trigger", args.trigger)
          .eq("challengeId", args.challengeId)
      )
      .first();
    return Boolean(log);
  }

  if (args.duelId) {
    const log = await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_duel", (q) =>
        q
          .eq("toUserId", args.toUserId)
          .eq("trigger", args.trigger)
          .eq("duelId", args.duelId)
      )
      .first();
    return Boolean(log);
  }

  if (args.soloPracticeSessionId) {
    const log = await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_soloPracticeSession", (q) =>
        q
          .eq("toUserId", args.toUserId)
          .eq("trigger", args.trigger)
          .eq("soloPracticeSessionId", args.soloPracticeSessionId)
      )
      .first();
    return Boolean(log);
  }

  if (args.weeklyGoalId) {
    const log = await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_weeklyGoal", (q) =>
        q
          .eq("toUserId", args.toUserId)
          .eq("trigger", args.trigger)
          .eq("weeklyGoalId", args.weeklyGoalId)
      )
      .first();
    return Boolean(log);
  }

  const log = await ctx.db
    .query("emailNotificationLog")
    .withIndex("by_user_trigger", (q) =>
      q.eq("toUserId", args.toUserId).eq("trigger", args.trigger)
    )
    .first();
  return Boolean(log);
}

export const checkNotificationSent = internalQuery({
  args: {
    toUserId: v.id("users"),
    trigger: emailNotificationTriggerValidator,
    challengeId: v.optional(v.id("challenges")),
    duelId: v.optional(v.id("duels")),
    soloPracticeSessionId: v.optional(v.id("soloPracticeSessions")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
    dedupeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await checkEmailNotificationSent(ctx, args);
  },
});

export const logNotificationSent = internalMutation({
  args: {
    toUserId: v.id("users"),
    trigger: emailNotificationTriggerValidator,
    challengeId: v.optional(v.id("challenges")),
    duelId: v.optional(v.id("duels")),
    soloPracticeSessionId: v.optional(v.id("soloPracticeSessions")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
    dedupeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const alreadySent = await checkEmailNotificationSent(ctx, args);
    if (alreadySent) {
      return { logged: false };
    }

    const logId = await ctx.db.insert("emailNotificationLog", {
      toUserId: args.toUserId,
      trigger: args.trigger,
      challengeId: args.challengeId,
      duelId: args.duelId,
      soloPracticeSessionId: args.soloPracticeSessionId,
      weeklyGoalId: args.weeklyGoalId,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
      dedupeKey: args.dedupeKey,
      sentAt: Date.now(),
    });
    return { logged: true, logId };
  },
});

export const claimNotificationSend = internalMutation({
  args: {
    toUserId: v.id("users"),
    trigger: emailNotificationTriggerValidator,
    challengeId: v.optional(v.id("challenges")),
    duelId: v.optional(v.id("duels")),
    soloPracticeSessionId: v.optional(v.id("soloPracticeSessions")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
    dedupeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const alreadySent = await checkEmailNotificationSent(ctx, args);
    if (alreadySent) {
      return { claimed: false };
    }

    const claimId = await ctx.db.insert("emailNotificationLog", {
      toUserId: args.toUserId,
      trigger: args.trigger,
      challengeId: args.challengeId,
      duelId: args.duelId,
      soloPracticeSessionId: args.soloPracticeSessionId,
      weeklyGoalId: args.weeklyGoalId,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
      dedupeKey: args.dedupeKey,
      sentAt: Date.now(),
    });

    return { claimed: true, claimId };
  },
});

export const releaseNotificationSendClaim = internalMutation({
  args: {
    claimId: v.id("emailNotificationLog"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.claimId);
  },
});

export const cleanupEmailNotificationLog = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - EMAIL_LOG_TTL_MS;
    const logs = await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_sentAt", (q) => q.lt("sentAt", cutoff))
      .collect();
    let deletedCount = 0;

    for (const log of logs) {
      if (!isEmailLogPastRetention(log, now, EMAIL_LOG_TTL_MS)) continue;

      await ctx.db.delete(log._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});
