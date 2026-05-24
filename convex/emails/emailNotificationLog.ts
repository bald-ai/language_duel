import { v } from "convex/values";
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
  duelId?: Id<"duels">;
  soloPracticeSessionId?: Id<"soloPracticeSessions">;
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
  if (args.weeklyGoalId && args.dedupeKey) {
    return await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_weeklyGoal_dedupeKey", (q) =>
        q
          .eq("toUserId", args.toUserId)
          .eq("trigger", args.trigger)
          .eq("weeklyGoalId", args.weeklyGoalId)
          .eq("dedupeKey", args.dedupeKey)
      )
      .first();
  }

  if (args.challengeId) {
    return await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_challenge", (q) =>
        q.eq("toUserId", args.toUserId).eq("trigger", args.trigger).eq("challengeId", args.challengeId)
      )
      .first();
  }

  if (args.duelId) {
    return await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_duel", (q) =>
        q.eq("toUserId", args.toUserId).eq("trigger", args.trigger).eq("duelId", args.duelId)
      )
      .first();
  }

  if (args.soloPracticeSessionId) {
    return await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_soloPracticeSession", (q) =>
        q
          .eq("toUserId", args.toUserId)
          .eq("trigger", args.trigger)
          .eq("soloPracticeSessionId", args.soloPracticeSessionId)
      )
      .first();
  }

  if (args.weeklyGoalId) {
    return await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_weeklyGoal", (q) =>
        q.eq("toUserId", args.toUserId).eq("trigger", args.trigger).eq("weeklyGoalId", args.weeklyGoalId)
      )
      .first();
  }

  return await ctx.db
    .query("emailNotificationLog")
    .withIndex("by_user_trigger", (q) => q.eq("toUserId", args.toUserId).eq("trigger", args.trigger))
    .first();
}

export const checkNotificationSent = internalQuery({
  args: {
    toUserId: v.id("users"),
    trigger: emailNotificationTriggerValidator,
    challengeId: v.optional(v.id("challenges")),
    duelId: v.optional(v.id("duels")),
    soloPracticeSessionId: v.optional(v.id("soloPracticeSessions")),
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
    duelId: v.optional(v.id("duels")),
    soloPracticeSessionId: v.optional(v.id("soloPracticeSessions")),
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
      duelId: args.duelId,
      soloPracticeSessionId: args.soloPracticeSessionId,
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
