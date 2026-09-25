import { ConvexError, v } from "convex/values";
import {
  internalQuery,
  internalMutation,
  type QueryCtx,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { emailNotificationTriggerValidator } from "../schema";
import { type NotificationEmailTrigger } from "../../lib/notificationPreferences";
import { EMAIL_LOG_TTL_MS, EMAIL_SEND_CLAIM_STALE_MS } from "../constants";
import { isEmailLogPastRetention } from "../../lib/cleanupRetention";

type EmailNotificationLogLookupArgs = {
  toUserId: Id<"users">;
  trigger: NotificationEmailTrigger;
  challengeId?: Id<"challenges">;
  weeklyGoalId?: Id<"weeklyGoals">;
  dedupeKey?: string;
};

async function checkEmailNotificationSent(
  ctx: Pick<QueryCtx, "db">,
  args: EmailNotificationLogLookupArgs
): Promise<boolean> {
  const log = await findEmailNotificationLog(ctx, args);
  return log?.status === "sent";
}

async function findEmailNotificationLog(
  ctx: Pick<QueryCtx, "db">,
  args: EmailNotificationLogLookupArgs
) {
  if (args.trigger === "immediate_challenge_invite") {
    const challengeId = args.challengeId;
    if (!challengeId) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Challenge email log requires challengeId" });
    }
    return ctx.db.query("emailNotificationLog")
      .withIndex("by_user_trigger_challenge", q =>
        q.eq("toUserId", args.toUserId).eq("trigger", args.trigger).eq("challengeId", challengeId))
      .first();
  }
  const weeklyGoalId = args.weeklyGoalId;
  if (!weeklyGoalId) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Weekly goal email log requires weeklyGoalId" });
  }
  if (args.dedupeKey) {
    return ctx.db.query("emailNotificationLog")
      .withIndex("by_user_trigger_weeklyGoal_dedupeKey", q =>
        q.eq("toUserId", args.toUserId).eq("trigger", args.trigger)
          .eq("weeklyGoalId", weeklyGoalId).eq("dedupeKey", args.dedupeKey))
      .first();
  }
  return ctx.db.query("emailNotificationLog")
    .withIndex("by_user_trigger_weeklyGoal", q =>
      q.eq("toUserId", args.toUserId).eq("trigger", args.trigger).eq("weeklyGoalId", weeklyGoalId))
    .first();
}

export const checkNotificationSent = internalQuery({
  args: {
    toUserId: v.id("users"),
    trigger: emailNotificationTriggerValidator,
    challengeId: v.optional(v.id("challenges")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    dedupeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await checkEmailNotificationSent(ctx, args);
  },
});

export const claimNotificationSend = internalMutation({
  args: {
    toUserId: v.id("users"),
    trigger: emailNotificationTriggerValidator,
    challengeId: v.optional(v.id("challenges")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    dedupeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await findEmailNotificationLog(ctx, args);
    const now = Date.now();
    if (existing?.status === "sent") {
      return { claimed: false };
    }
    if (
      existing?.status === "pending" &&
      typeof existing.claimedAt === "number" &&
      existing.claimedAt > now - EMAIL_SEND_CLAIM_STALE_MS
    ) {
      return { claimed: false };
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "pending",
        claimedAt: now,
        failedAt: undefined,
      });
      return { claimed: true, claimId: existing._id };
    }

    const claimId = await ctx.db.insert("emailNotificationLog", {
      toUserId: args.toUserId,
      trigger: args.trigger,
      status: "pending",
      challengeId: args.challengeId,
      weeklyGoalId: args.weeklyGoalId,
      dedupeKey: args.dedupeKey,
      claimedAt: now,
    });

    return { claimed: true, claimId };
  },
});

export const markNotificationSendSent = internalMutation({
  args: {
    claimId: v.id("emailNotificationLog"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.claimId, {
      status: "sent",
      sentAt: Date.now(),
      failedAt: undefined,
    });
  },
});

export const markNotificationSendFailed = internalMutation({
  args: {
    claimId: v.id("emailNotificationLog"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.claimId, {
      status: "failed",
      failedAt: Date.now(),
    });
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

    // The by_sentAt range only narrows candidates; isEmailLogPastRetention is the
    // single authority on whether a row is past retention.
    for (const log of logs) {
      if (log.status !== "sent" || typeof log.sentAt !== "number") continue;
      if (!isEmailLogPastRetention({ sentAt: log.sentAt }, now, EMAIL_LOG_TTL_MS)) continue;

      await ctx.db.delete(log._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});
