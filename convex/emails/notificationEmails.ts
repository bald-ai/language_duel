import { v } from "convex/values";
import {
  internalAction,
  internalQuery,
  internalMutation,
  type ActionCtx,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { emailNotificationTriggerValidator } from "../schema";
import {
  isNotificationEnabled,
  formatScheduledTimeForEmail,
  type NotificationTrigger,
} from "../../lib/notificationPreferences";
import { renderNotificationEmail, type EmailData } from "../../lib/notificationTemplates";
import {
  EMAIL_LOG_TTL_MS,
} from "../constants";
import { isEmailLogPastRetention } from "../../lib/cleanupRetention";
import { colorPalettes, DEFAULT_THEME_NAME } from "../../lib/theme";
import { summarizeThemeNames, type SessionWordEntry } from "../../lib/sessionWords";
import {
  getGoalDeleteAt,
} from "../../lib/weeklyGoals";

const DEFAULT_TIMEZONE = "Europe/Prague";

type EmailNotificationLogLookupArgs = {
  toUserId: Id<"users">;
  trigger: NotificationTrigger;
  challengeId?: Id<"challenges">;
  scheduledDuelId?: Id<"scheduledDuels">;
  weeklyGoalId?: Id<"weeklyGoals">;
  dedupeKey?: string;
};

async function checkEmailNotificationSent(
  ctx: Pick<QueryCtx, "db">,
  args: EmailNotificationLogLookupArgs
): Promise<boolean> {
  if (args.scheduledDuelId) {
    const log = await ctx.db
      .query("emailNotificationLog")
      .withIndex("by_user_trigger_scheduledDuel", (q) =>
        q
          .eq("toUserId", args.toUserId)
          .eq("trigger", args.trigger)
          .eq("scheduledDuelId", args.scheduledDuelId)
      )
      .first();
    return Boolean(log);
  }

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

  const log = await ctx.db
    .query("emailNotificationLog")
    .withIndex("by_user_trigger", (q) =>
      q.eq("toUserId", args.toUserId).eq("trigger", args.trigger)
    )
    .first();
  return Boolean(log);
}

export const getUserById = internalQuery({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getChallengeById = internalQuery({
  args: { id: v.id("challenges") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getScheduledDuelById = internalQuery({
  args: { id: v.id("scheduledDuels") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getWeeklyGoalById = internalQuery({
  args: { id: v.id("weeklyGoals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getThemeById = internalQuery({
  args: { id: v.id("themes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const checkNotificationSent = internalQuery({
  args: {
    toUserId: v.id("users"),
    trigger: emailNotificationTriggerValidator,
    challengeId: v.optional(v.id("challenges")),
    scheduledDuelId: v.optional(v.id("scheduledDuels")),
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
    scheduledDuelId: v.optional(v.id("scheduledDuels")),
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
      scheduledDuelId: args.scheduledDuelId,
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
    scheduledDuelId: v.optional(v.id("scheduledDuels")),
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
      scheduledDuelId: args.scheduledDuelId,
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

export const sendNotificationEmail = internalAction({
  args: {
    trigger: emailNotificationTriggerValidator,
    toUserId: v.id("users"),
    fromUserId: v.optional(v.id("users")),
    challengeId: v.optional(v.id("challenges")),
    scheduledDuelId: v.optional(v.id("scheduledDuels")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
    dedupeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trigger = args.trigger as NotificationTrigger;
    const toUser = await ctx.runQuery(internal.emails.notificationEmails.getUserById, {
      id: args.toUserId,
    });
    if (!toUser?.email) return { sent: false, reason: "no_email" };

    const prefs = await ctx.runQuery(internal.notificationPreferences.getByUserId, {
      userId: args.toUserId,
    });

    if (!isNotificationEnabled(trigger, prefs)) {
      return { sent: false, reason: "disabled_by_user" };
    }

    const emailData = await buildEmailData(ctx, {
      trigger,
      toUser,
      fromUserId: args.fromUserId,
      challengeId: args.challengeId,
      scheduledDuelId: args.scheduledDuelId,
      weeklyGoalId: args.weeklyGoalId,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
      dedupeKey: args.dedupeKey,
    });

    const { subject, html } = renderNotificationEmail(trigger, emailData);

    const claim = await ctx.runMutation(internal.emails.notificationEmails.claimNotificationSend, {
      toUserId: args.toUserId,
      trigger: args.trigger,
      challengeId: args.challengeId,
      scheduledDuelId: args.scheduledDuelId,
      weeklyGoalId: args.weeklyGoalId,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
      dedupeKey: args.dedupeKey,
    });
    if (!claim.claimed) return { sent: false, reason: "already_sent" };
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
      await ctx.runMutation(internal.emails.notificationEmails.releaseNotificationSendClaim, {
        claimId: claim.claimId,
      });
      throw error;
    }

    return { sent: true };
  },
});

export type BuildEmailArgs = {
  trigger: NotificationTrigger;
  toUser: Doc<"users">;
  fromUserId?: Id<"users">;
  challengeId?: Id<"challenges">;
  scheduledDuelId?: Id<"scheduledDuels">;
  weeklyGoalId?: Id<"weeklyGoals">;
  reminderOffsetMinutes?: number;
  dedupeKey?: string;
};

export async function buildEmailData(
  ctx: ActionCtx,
  args: BuildEmailArgs
): Promise<EmailData> {
  const data: EmailData = {
    recipientName: args.toUser.nickname ?? args.toUser.name ?? "Player",
  };

  if (args.fromUserId) {
    const fromUser = await ctx.runQuery(internal.emails.notificationEmails.getUserById, {
      id: args.fromUserId,
    });
    data.senderName = fromUser?.nickname ?? fromUser?.name ?? "Player";
    data.partnerName = data.senderName;

    const paletteName = fromUser?.selectedColorSet ?? DEFAULT_THEME_NAME;
    const palette = colorPalettes.find((p) => p.name === paletteName) ?? colorPalettes[0];
    data.senderPalette = { bg: palette.bg, primary: palette.primary, accent: palette.accent };
  }

  if (args.challengeId) {
    const challenge = await ctx.runQuery(internal.emails.notificationEmails.getChallengeById, {
      id: args.challengeId,
    });
    if (challenge) {
      const sessionThemeNames = Array.from(new Set(
        (challenge.sessionWords ?? [])
          .map((word) => (word as SessionWordEntry).themeName)
          .filter((themeName): themeName is string => typeof themeName === "string")
      ));

      if (sessionThemeNames.length > 0) {
        data.themeName = summarizeThemeNames(sessionThemeNames);
      }
    }
  }

  if (args.scheduledDuelId) {
    const scheduledDuel = await ctx.runQuery(internal.emails.notificationEmails.getScheduledDuelById, {
      id: args.scheduledDuelId,
    });
    if (scheduledDuel) {
      const themes = await Promise.all(
        scheduledDuel.themeIds.map((themeId) =>
          ctx.runQuery(internal.emails.notificationEmails.getThemeById, {
            id: themeId,
          })
        )
      );
      const themeNames = themes
        .filter((theme): theme is Doc<"themes"> => theme !== null)
        .map((theme) => theme.name);
      data.themeName = summarizeThemeNames(themeNames);
      data.scheduledTime = formatScheduledTimeForEmail(scheduledDuel.scheduledTime, DEFAULT_TIMEZONE);
      data.minutesBefore = args.reminderOffsetMinutes;
      if (!data.partnerName) {
        const opponentId =
          scheduledDuel.proposerId === args.toUser._id
            ? scheduledDuel.recipientId
            : scheduledDuel.proposerId;
        const opponent = await ctx.runQuery(internal.emails.notificationEmails.getUserById, {
          id: opponentId,
        });
        data.partnerName = opponent?.nickname ?? opponent?.name ?? "Opponent";
      }
    }
  }

  if (args.weeklyGoalId) {
    const goal = await ctx.runQuery(internal.emails.notificationEmails.getWeeklyGoalById, {
      id: args.weeklyGoalId,
    });
    if (goal) {
      const partnerId =
        goal.creatorId === args.toUser._id ? goal.partnerId : goal.creatorId;
      const partner = await ctx.runQuery(internal.emails.notificationEmails.getUserById, {
        id: partnerId,
      });
      data.partnerName = partner?.nickname ?? partner?.name ?? data.partnerName;
      if (goal.endDate) {
        data.scheduledTime = formatScheduledTimeForEmail(goal.endDate, DEFAULT_TIMEZONE);
      }
      data.completedCount = goal.themes.filter((theme: { creatorCompleted: boolean; partnerCompleted: boolean }) =>
        args.toUser._id === goal.creatorId ? theme.creatorCompleted : theme.partnerCompleted
      ).length;
      data.totalCount = goal.themes.length;
      if (goal.endDate) {
        data.hoursLeft = Math.max(
          0,
          Math.round((goal.endDate - Date.now()) / (60 * 60 * 1000))
        );
      }

      if (args.trigger === "weekly_goal_expired_delete_reminder" && goal.endDate) {
        const deleteAt = getGoalDeleteAt(goal.endDate);
        if (deleteAt) {
          data.deleteAt = formatScheduledTimeForEmail(deleteAt, DEFAULT_TIMEZONE);
          data.graceHoursLeft = Math.max(
            0,
            Math.ceil((deleteAt - Date.now()) / (60 * 60 * 1000))
          );
        }
      }

    }
  }

  return data;
}
