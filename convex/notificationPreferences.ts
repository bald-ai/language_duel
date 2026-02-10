import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { getAuthenticatedUser } from "./helpers/auth";
import { DEFAULT_NOTIFICATION_PREFS } from "../lib/notificationPreferences";

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

    // Merge defaults so newly added fields get sensible values for older rows.
    return { ...DEFAULT_NOTIFICATION_PREFS, ...prefs, userId: user._id, isDefault: false };
  },
});

export const getByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return prefs
      ? { ...DEFAULT_NOTIFICATION_PREFS, ...prefs, userId: args.userId }
      : { ...DEFAULT_NOTIFICATION_PREFS, userId: args.userId };
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
    scheduledDuelAcceptedEnabled: v.boolean(),
    scheduledDuelCounterProposedEnabled: v.boolean(),
    scheduledDuelDeclinedEnabled: v.boolean(),
    scheduledDuelCanceledEnabled: v.boolean(),
    scheduledDuelReminderEnabled: v.boolean(),
    scheduledDuelReminderOffsetMinutes: v.number(),
    scheduledDuelReadyEnabled: v.boolean(),

    weeklyGoalsEnabled: v.boolean(),
    weeklyGoalInviteEnabled: v.boolean(),
    weeklyGoalAcceptedEnabled: v.boolean(),
    weeklyGoalLockedEnabled: v.boolean(),
    weeklyGoalDeclinedEnabled: v.boolean(),
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
