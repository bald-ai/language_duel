import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { getAuthenticatedUser } from "./helpers/auth";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPreferences,
} from "../lib/notificationPreferences";

function normalizeNotificationPreferences(
  prefs: Partial<NotificationPreferences> | null | undefined
): NotificationPreferences {
  return {
    immediateDuelsEnabled:
      prefs?.immediateDuelsEnabled ?? DEFAULT_NOTIFICATION_PREFS.immediateDuelsEnabled,
    immediateDuelChallengeEnabled:
      prefs?.immediateDuelChallengeEnabled ??
      DEFAULT_NOTIFICATION_PREFS.immediateDuelChallengeEnabled,
    scheduledDuelsEnabled:
      prefs?.scheduledDuelsEnabled ?? DEFAULT_NOTIFICATION_PREFS.scheduledDuelsEnabled,
    scheduledDuelProposalEnabled:
      prefs?.scheduledDuelProposalEnabled ??
      DEFAULT_NOTIFICATION_PREFS.scheduledDuelProposalEnabled,
    scheduledDuelReminderEnabled:
      prefs?.scheduledDuelReminderEnabled ??
      DEFAULT_NOTIFICATION_PREFS.scheduledDuelReminderEnabled,
    scheduledDuelReminderOffsetMinutes:
      prefs?.scheduledDuelReminderOffsetMinutes ??
      DEFAULT_NOTIFICATION_PREFS.scheduledDuelReminderOffsetMinutes,
    weeklyGoalsEnabled:
      prefs?.weeklyGoalsEnabled ?? DEFAULT_NOTIFICATION_PREFS.weeklyGoalsEnabled,
    weeklyGoalInviteEnabled:
      prefs?.weeklyGoalInviteEnabled ?? DEFAULT_NOTIFICATION_PREFS.weeklyGoalInviteEnabled,
    weeklyGoalAcceptedEnabled:
      prefs?.weeklyGoalAcceptedEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalAcceptedEnabled,
    weeklyGoalLockedEnabled:
      prefs?.weeklyGoalLockedEnabled ?? DEFAULT_NOTIFICATION_PREFS.weeklyGoalLockedEnabled,
    weeklyGoalDailyReminderEnabled:
      prefs?.weeklyGoalDailyReminderEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalDailyReminderEnabled,
    weeklyGoalDraftExpiringEnabled:
      prefs?.weeklyGoalDraftExpiringEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalDraftExpiringEnabled,
    weeklyGoalReminder1Enabled:
      prefs?.weeklyGoalReminder1Enabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1Enabled,
    weeklyGoalReminder1OffsetMinutes:
      prefs?.weeklyGoalReminder1OffsetMinutes ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1OffsetMinutes,
    weeklyGoalReminder2Enabled:
      prefs?.weeklyGoalReminder2Enabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2Enabled,
    weeklyGoalReminder2OffsetMinutes:
      prefs?.weeklyGoalReminder2OffsetMinutes ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes,
  };
}

export const getMyNotificationPreferences = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await getAuthenticatedUser(ctx);

    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!prefs) {
      return { ...DEFAULT_NOTIFICATION_PREFS, userId: user._id, isDefault: true };
    }

    return {
      ...normalizeNotificationPreferences(prefs),
      userId: user._id,
      isDefault: false,
    };
  },
});

export const getByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return {
      ...normalizeNotificationPreferences(prefs),
      userId: args.userId,
    };
  },
});

const MIN_OFFSET = 1;
const MAX_OFFSET = 7 * 24 * 60;

export const setMyNotificationPreferences = mutation({
  args: {
    immediateDuelsEnabled: v.boolean(),
    immediateDuelChallengeEnabled: v.boolean(),

    scheduledDuelsEnabled: v.boolean(),
    scheduledDuelProposalEnabled: v.boolean(),
    scheduledDuelReminderEnabled: v.boolean(),
    scheduledDuelReminderOffsetMinutes: v.number(),

    weeklyGoalsEnabled: v.boolean(),
    weeklyGoalInviteEnabled: v.boolean(),
    weeklyGoalAcceptedEnabled: v.boolean(),
    weeklyGoalLockedEnabled: v.boolean(),
    weeklyGoalDailyReminderEnabled: v.boolean(),
    weeklyGoalDraftExpiringEnabled: v.boolean(),
    weeklyGoalReminder1Enabled: v.boolean(),
    weeklyGoalReminder1OffsetMinutes: v.number(),
    weeklyGoalReminder2Enabled: v.boolean(),
    weeklyGoalReminder2OffsetMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    if (
      args.scheduledDuelReminderOffsetMinutes < MIN_OFFSET ||
      args.scheduledDuelReminderOffsetMinutes > MAX_OFFSET
    ) {
      throw new Error("Invalid scheduled duel reminder offset");
    }
    if (
      args.weeklyGoalReminder1OffsetMinutes < MIN_OFFSET ||
      args.weeklyGoalReminder1OffsetMinutes > MAX_OFFSET
    ) {
      throw new Error("Invalid weekly goal reminder 1 offset");
    }
    if (
      args.weeklyGoalReminder2OffsetMinutes < MIN_OFFSET ||
      args.weeklyGoalReminder2OffsetMinutes > MAX_OFFSET
    ) {
      throw new Error("Invalid weekly goal reminder 2 offset");
    }

    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("notificationPreferences", {
        userId: user._id,
        ...args,
        updatedAt: Date.now(),
      });
    }
  },
});
