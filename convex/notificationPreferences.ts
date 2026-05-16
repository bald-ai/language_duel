import { ConvexError, v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { getAuthenticatedUser } from "./helpers/auth";
import {
  DEFAULT_NOTIFICATION_PREFS,
  WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES,
  normalizeNotificationPreferences,
} from "../lib/notificationPreferences";

export const NOTIFICATION_PREFERENCE_BOOLEAN_FIELDS = [
  "challengeInviteEmailsEnabled",
  "challengeInviteEmailEnabled",
  "weeklyGoalEmailsEnabled",
  "weeklyGoalInviteEmailEnabled",
  "weeklyGoalAcceptedEmailEnabled",
  "weeklyGoalLockedEmailEnabled",
  "weeklyGoalDailyReminderEmailEnabled",
  "weeklyGoalGracePeriodReminderEmailEnabled",
  "weeklyGoalDraftExpiringEmailEnabled",
  "weeklyGoalReminder1EmailEnabled",
  "weeklyGoalReminder2EmailEnabled",
] as const;

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

export const updateNotificationPreferences = mutation({
  args: {
    challengeInviteEmailsEnabled: v.optional(v.boolean()),
    challengeInviteEmailEnabled: v.optional(v.boolean()),

    weeklyGoalEmailsEnabled: v.optional(v.boolean()),
    weeklyGoalInviteEmailEnabled: v.optional(v.boolean()),
    weeklyGoalAcceptedEmailEnabled: v.optional(v.boolean()),
    weeklyGoalLockedEmailEnabled: v.optional(v.boolean()),
    weeklyGoalDailyReminderEmailEnabled: v.optional(v.boolean()),
    weeklyGoalGracePeriodReminderEmailEnabled: v.optional(v.boolean()),
    weeklyGoalDraftExpiringEmailEnabled: v.optional(v.boolean()),
    weeklyGoalReminder1EmailEnabled: v.optional(v.boolean()),
    weeklyGoalReminder1OffsetMinutes: v.optional(v.number()),
    weeklyGoalReminder2EmailEnabled: v.optional(v.boolean()),
    weeklyGoalReminder2OffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    if (
      args.weeklyGoalReminder1OffsetMinutes !== undefined &&
      (args.weeklyGoalReminder1OffsetMinutes < WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES ||
        args.weeklyGoalReminder1OffsetMinutes > WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES)
    ) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid weekly goal reminder 1 offset" });
    }
    if (
      args.weeklyGoalReminder2OffsetMinutes !== undefined &&
      (args.weeklyGoalReminder2OffsetMinutes < WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES ||
        args.weeklyGoalReminder2OffsetMinutes > WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES)
    ) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid weekly goal reminder 2 offset" });
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
        ...normalizeNotificationPreferences(args),
        updatedAt: Date.now(),
      });
    }
  },
});
