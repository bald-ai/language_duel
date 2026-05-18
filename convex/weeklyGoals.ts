/**
 * Weekly Goals API - public Convex wiring for collaborative learning goals.
 */

import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  createNotification,
  isWeeklyGoalPayload,
} from "./notificationHelpers";
import { getAuthenticatedUserOrNull } from "./helpers/auth";
import { GRACE_PERIOD_MS, WEEKLY_GOAL_DRAFT_TTL_MS } from "./constants";
import type { GoalWithUsers } from "./weeklyGoals/types";
import {
  getBossLaunchPreviewForViewer,
  getBossPracticeSessionForViewer,
  getEligibleThemesForViewer,
  getGoalForViewer,
  getVisibleGoalsForViewer,
  getWeeklyGoalPracticeThemesForViewer,
} from "./weeklyGoals/queries";
import { closeVisibleGoalsBetweenParticipants, runWeeklyGoalRetentionCleanup } from "./weeklyGoals/cleanup";
import {
  handleAddTheme,
  handleArchiveCompletedGoalThemesFromNotification,
  handleCreateBossChallenge,
  handleCreateGoal,
  handleDeclineWeeklyGoalInvitation,
  handleDeleteGoal,
  handleDismissWeeklyGoalInvitation,
  handleLockGoal,
  handleRemoveTheme,
  handleSetGoalEndDate,
  handleStartBossSoloPractice,
  handleToggleCompletion,
} from "./weeklyGoals/mutations";

export { closeVisibleGoalsBetweenParticipants };
export type { GoalWithUsers } from "./weeklyGoals/types";

export const getVisibleGoals = query({
  args: {},
  handler: async (ctx): Promise<GoalWithUsers[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    return await getVisibleGoalsForViewer(ctx, auth.user._id);
  },
});

export const getGoalById = query({
  args: { goalId: v.id("weeklyGoals") },
  handler: async (ctx, { goalId }): Promise<GoalWithUsers | null> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    return await getGoalForViewer(ctx, auth.user._id, goalId);
  },
});

export const getBossLaunchPreview = query({
  args: {
    goalId: v.id("weeklyGoals"),
    bossType: v.union(v.literal("mini"), v.literal("big")),
  },
  handler: async (ctx, { goalId, bossType }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    return await getBossLaunchPreviewForViewer(ctx, auth.user._id, goalId, bossType);
  },
});

export const getBossPracticeSession = query({
  args: { soloPracticeSessionId: v.id("soloPracticeSessions") },
  handler: async (ctx, { soloPracticeSessionId }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    return await getBossPracticeSessionForViewer(ctx, auth.user._id, soloPracticeSessionId);
  },
});

export const getWeeklyGoalPracticeThemes = query({
  args: {
    weeklyGoalId: v.id("weeklyGoals"),
    themeIds: v.optional(v.array(v.id("themes"))),
  },
  handler: async (ctx, { weeklyGoalId, themeIds }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    return await getWeeklyGoalPracticeThemesForViewer(
      ctx,
      auth.user._id,
      weeklyGoalId,
      themeIds
    );
  },
});

export const getEligibleThemes = query({
  args: { goalId: v.id("weeklyGoals") },
  handler: async (ctx, { goalId }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    return await getEligibleThemesForViewer(ctx, auth.user._id, goalId);
  },
});

export const createGoal = mutation({
  args: { partnerId: v.id("users") },
  handler: async (ctx, { partnerId }) => {
    return await handleCreateGoal(ctx, partnerId);
  },
});

export const addTheme = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    themeId: v.id("themes"),
  },
  handler: async (ctx, { goalId, themeId }) => {
    return await handleAddTheme(ctx, goalId, themeId);
  },
});

export const removeTheme = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    themeId: v.id("themes"),
  },
  handler: async (ctx, { goalId, themeId }) => {
    return await handleRemoveTheme(ctx, goalId, themeId);
  },
});

export const setGoalEndDate = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    endDate: v.number(),
  },
  handler: async (ctx, { goalId, endDate }) => {
    return await handleSetGoalEndDate(ctx, goalId, endDate);
  },
});

export const createBossChallenge = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    bossType: v.union(v.literal("mini"), v.literal("big")),
  },
  handler: async (ctx, { goalId, bossType }) => {
    return await handleCreateBossChallenge(ctx, goalId, bossType);
  },
});

export const startBossSoloPractice = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    bossType: v.union(v.literal("mini"), v.literal("big")),
  },
  handler: async (ctx, { goalId, bossType }) => {
    return await handleStartBossSoloPractice(ctx, goalId, bossType);
  },
});

export const toggleCompletion = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    themeId: v.id("themes"),
  },
  handler: async (ctx, { goalId, themeId }) => {
    return await handleToggleCompletion(ctx, goalId, themeId);
  },
});

export const lockGoal = mutation({
  args: { goalId: v.id("weeklyGoals") },
  handler: async (ctx, { goalId }) => {
    return await handleLockGoal(ctx, goalId);
  },
});

export const deleteGoal = mutation({
  args: { goalId: v.id("weeklyGoals") },
  handler: async (ctx, { goalId }) => {
    return await handleDeleteGoal(ctx, goalId);
  },
});

export const getLockedGoalsWithEndDate = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_endDate", (q) =>
        q.eq("status", "locked").gt("endDate", now)
      )
      .collect();
  },
});

export const getGoalsInGraceWindow = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const lockedPastEndDate = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_endDate", (q) =>
        q.eq("status", "locked").lt("endDate", now)
      )
      .filter((q) => q.neq(q.field("bigBossStatus"), "defeated"))
      .collect();

    const gracePeriodGoals = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_endDate", (q) =>
        q.eq("status", "grace_period").gt("endDate", now - GRACE_PERIOD_MS)
      )
      .filter((q) => q.neq(q.field("bigBossStatus"), "defeated"))
      .collect();

    const goals = [...lockedPastEndDate, ...gracePeriodGoals];
    const seen = new Set<string>();
    return goals.filter((goal) => {
      const key = String(goal._id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
});

export const getDraftGoalsExpiringSoon = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const minCreatedAt = now - WEEKLY_GOAL_DRAFT_TTL_MS + 22 * oneHourMs;
    const maxCreatedAt = now - WEEKLY_GOAL_DRAFT_TTL_MS + 24 * oneHourMs;

    return await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_createdAt", (q) =>
        q
          .eq("status", "draft")
          .gte("createdAt", minCreatedAt)
          .lt("createdAt", maxCreatedAt)
      )
      .collect();
  },
});

export const createDraftExpiryNotification = internalMutation({
  args: {
    goalId: v.id("weeklyGoals"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.status !== "draft") {
      return { created: false };
    }

    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_type", (q) =>
        q
          .eq("type", "weekly_goal_draft_expiring")
          .eq("toUserId", goal.creatorId)
      )
      .collect();

    const matching = existing.find(
      (notification) =>
        isWeeklyGoalPayload(notification.payload) &&
        notification.payload.goalId === goal._id &&
        notification.status !== "dismissed"
    );

    if (matching) {
      return { created: false };
    }

    await createNotification(ctx, {
      type: "weekly_goal_draft_expiring",
      fromUserId: goal.creatorId,
      toUserId: goal.creatorId,
      payload: {
        goalId: goal._id,
        themeCount: goal.themes.length,
        event: "draft_expiring",
      },
      createdAt: args.now,
    });

    return { created: true };
  },
});

export const cleanupWeeklyGoalRetention = internalMutation({
  args: {},
  handler: async (ctx) => {
    await runWeeklyGoalRetentionCleanup(ctx);
  },
});

export const dismissWeeklyGoalInvitation = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    return await handleDismissWeeklyGoalInvitation(ctx, notificationId);
  },
});

export const archiveCompletedGoalThemesFromNotification = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    return await handleArchiveCompletedGoalThemesFromNotification(ctx, notificationId);
  },
});

export const declineWeeklyGoalInvitation = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    return await handleDeclineWeeklyGoalInvitation(ctx, notificationId);
  },
});
