import { v } from "convex/values";
import {
  internalAction,
  internalQuery,
  internalMutation,
  type ActionCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  isNotificationEnabled,
  DEFAULT_NOTIFICATION_PREFS,
  formatScheduledTime,
  type NotificationTrigger,
} from "../../lib/notificationPreferences";
import { renderNotificationEmail, type EmailData } from "../../lib/notificationTemplates";
import { colorPalettes, DEFAULT_THEME_NAME } from "../../lib/theme";

const DEFAULT_TIMEZONE = "Europe/Bratislava";

export const getNotificationPreferencesByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    return prefs ?? { ...DEFAULT_NOTIFICATION_PREFS, userId: args.userId };
  },
});

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
    trigger: v.union(
      v.literal("immediate_duel_challenge"),
      v.literal("scheduled_duel_proposal"),
      v.literal("scheduled_duel_accepted"),
      v.literal("scheduled_duel_counter_proposed"),
      v.literal("scheduled_duel_declined"),
      v.literal("scheduled_duel_canceled"),
      v.literal("scheduled_duel_reminder"),
      v.literal("weekly_goal_invite"),
      v.literal("weekly_goal_accepted"),
      v.literal("weekly_goal_declined"),
      v.literal("weekly_goal_reminder_1"),
      v.literal("weekly_goal_reminder_2")
    ),
    challengeId: v.optional(v.id("challenges")),
    scheduledDuelId: v.optional(v.id("scheduledDuels")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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

    if (args.reminderOffsetMinutes !== undefined) {
      const log = await ctx.db
        .query("emailNotificationLog")
        .withIndex("by_user_trigger_reminder_offset", (q) =>
          q
            .eq("toUserId", args.toUserId)
            .eq("trigger", args.trigger)
            .eq("reminderOffsetMinutes", args.reminderOffsetMinutes)
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
  },
});

export const logNotificationSent = internalMutation({
  args: {
    toUserId: v.id("users"),
    trigger: v.union(
      v.literal("immediate_duel_challenge"),
      v.literal("scheduled_duel_proposal"),
      v.literal("scheduled_duel_accepted"),
      v.literal("scheduled_duel_counter_proposed"),
      v.literal("scheduled_duel_declined"),
      v.literal("scheduled_duel_canceled"),
      v.literal("scheduled_duel_reminder"),
      v.literal("weekly_goal_invite"),
      v.literal("weekly_goal_accepted"),
      v.literal("weekly_goal_declined"),
      v.literal("weekly_goal_reminder_1"),
      v.literal("weekly_goal_reminder_2")
    ),
    challengeId: v.optional(v.id("challenges")),
    scheduledDuelId: v.optional(v.id("scheduledDuels")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailNotificationLog", {
      toUserId: args.toUserId,
      trigger: args.trigger,
      challengeId: args.challengeId,
      scheduledDuelId: args.scheduledDuelId,
      weeklyGoalId: args.weeklyGoalId,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
      sentAt: Date.now(),
    });
  },
});

export const sendNotificationEmail = internalAction({
  args: {
    trigger: v.union(
      v.literal("immediate_duel_challenge"),
      v.literal("scheduled_duel_proposal"),
      v.literal("scheduled_duel_accepted"),
      v.literal("scheduled_duel_counter_proposed"),
      v.literal("scheduled_duel_declined"),
      v.literal("scheduled_duel_canceled"),
      v.literal("scheduled_duel_reminder"),
      v.literal("weekly_goal_invite"),
      v.literal("weekly_goal_accepted"),
      v.literal("weekly_goal_declined"),
      v.literal("weekly_goal_reminder_1"),
      v.literal("weekly_goal_reminder_2")
    ),
    toUserId: v.id("users"),
    fromUserId: v.optional(v.id("users")),
    challengeId: v.optional(v.id("challenges")),
    scheduledDuelId: v.optional(v.id("scheduledDuels")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
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

    const alreadySent = await ctx.runQuery(
      internal.emails.notificationEmails.checkNotificationSent,
      {
        toUserId: args.toUserId,
        trigger: args.trigger,
        challengeId: args.challengeId,
        scheduledDuelId: args.scheduledDuelId,
        weeklyGoalId: args.weeklyGoalId,
        reminderOffsetMinutes: args.reminderOffsetMinutes,
      }
    );
    if (alreadySent) return { sent: false, reason: "already_sent" };

    const emailData = await buildEmailData(ctx, {
      trigger,
      toUser,
      fromUserId: args.fromUserId,
      challengeId: args.challengeId,
      scheduledDuelId: args.scheduledDuelId,
      weeklyGoalId: args.weeklyGoalId,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
    });

    const { subject, html } = renderNotificationEmail(trigger, emailData);

    await ctx.runAction(internal.emails.actions.internalSendEmail, {
      to: toUser.email,
      subject,
      html,
    });

    await ctx.runMutation(internal.emails.notificationEmails.logNotificationSent, {
      toUserId: args.toUserId,
      trigger: args.trigger,
      challengeId: args.challengeId,
      scheduledDuelId: args.scheduledDuelId,
      weeklyGoalId: args.weeklyGoalId,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
    });

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
      const theme = await ctx.runQuery(internal.emails.notificationEmails.getThemeById, {
        id: challenge.themeId,
      });
      data.themeName = theme?.name;
    }
  }

  if (args.scheduledDuelId) {
    const scheduledDuel = await ctx.runQuery(internal.emails.notificationEmails.getScheduledDuelById, {
      id: args.scheduledDuelId,
    });
    if (scheduledDuel) {
      const theme = await ctx.runQuery(internal.emails.notificationEmails.getThemeById, {
        id: scheduledDuel.themeId,
      });
      data.themeName = theme?.name;
      data.scheduledTime = formatScheduledTime(scheduledDuel.scheduledTime, DEFAULT_TIMEZONE);
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
      if (goal.expiresAt) {
        data.scheduledTime = formatScheduledTime(goal.expiresAt, DEFAULT_TIMEZONE);
      }
      data.completedCount = goal.themes.filter((theme: { creatorCompleted: boolean; partnerCompleted: boolean }) =>
        args.toUser._id === goal.creatorId ? theme.creatorCompleted : theme.partnerCompleted
      ).length;
      data.totalCount = goal.themes.length;
      if (goal.expiresAt) {
        data.hoursLeft = Math.max(
          0,
          Math.round((goal.expiresAt - Date.now()) / (60 * 60 * 1000))
        );
      }
    }
  }

  return data;
}
