/**
 * Weekly Goals API - Queries and mutations for collaborative learning goals.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import type { MutationCtx } from "./_generated/server";

// Constants
const MAX_THEMES_PER_GOAL = 5;
const GOAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Types
export type GoalRole = "creator" | "partner";

export interface GoalWithUsers {
  goal: Doc<"weeklyGoals">;
  creator: { _id: Id<"users">; nickname?: string; email: string } | null;
  partner: { _id: Id<"users">; nickname?: string; email: string } | null;
  viewerRole: GoalRole;
}

async function purgeExpiredGoals(
  ctx: MutationCtx,
  goals: Doc<"weeklyGoals">[],
  now: number,
  shouldDelete: boolean
): Promise<Doc<"weeklyGoals">[]> {
  const expiredGoals = goals.filter(
    (goal) => goal.expiresAt && goal.expiresAt < now
  );

  if (shouldDelete && expiredGoals.length > 0) {
    await Promise.all(expiredGoals.map((goal) => ctx.db.delete(goal._id)));
  }

  return goals.filter((goal) => !goal.expiresAt || goal.expiresAt >= now);
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get the user's active or editing goal.
 * Returns null if user has no active goal.
 */
export const getActiveGoal = mutation({
  args: {},
  handler: async (ctx): Promise<GoalWithUsers | null> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const userId = auth.user._id;
    const now = Date.now();

    // Check for goal where user is creator
    const goalsAsCreator = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "editing"),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();
    const activeGoalsAsCreator = await purgeExpiredGoals(
      ctx,
      goalsAsCreator,
      now,
      true
    );
    const goalAsCreator = activeGoalsAsCreator[0];

    if (goalAsCreator) {
      const creator = await ctx.db.get(goalAsCreator.creatorId);
      const partner = await ctx.db.get(goalAsCreator.partnerId);

      return {
        goal: goalAsCreator,
        creator: creator
          ? { _id: creator._id, nickname: creator.nickname, email: creator.email }
          : null,
        partner: partner
          ? { _id: partner._id, nickname: partner.nickname, email: partner.email }
          : null,
        viewerRole: "creator",
      };
    }

    // Check for goal where user is partner
    const goalsAsPartner = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_partner", (q) => q.eq("partnerId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "editing"),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();
    const activeGoalsAsPartner = await purgeExpiredGoals(
      ctx,
      goalsAsPartner,
      now,
      true
    );
    const goalAsPartner = activeGoalsAsPartner[0];

    if (goalAsPartner) {
      const creator = await ctx.db.get(goalAsPartner.creatorId);
      const partner = await ctx.db.get(goalAsPartner.partnerId);

      return {
        goal: goalAsPartner,
        creator: creator
          ? { _id: creator._id, nickname: creator.nickname, email: creator.email }
          : null,
        partner: partner
          ? { _id: partner._id, nickname: partner.nickname, email: partner.email }
          : null,
        viewerRole: "partner",
      };
    }

    return null;
  },
});

/**
 * Get pending goal invite count for badge display.
 * Returns the number of goals where user is partner and status is "editing" and partner hasn't locked.
 */
export const getPendingGoalInviteCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return 0;

    const pendingGoals = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_partner", (q) => q.eq("partnerId", auth.user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "editing"),
          q.eq(q.field("partnerLocked"), false)
        )
      )
      .collect();

    return pendingGoals.length;
  },
});

/**
 * Get themes that can be added to a goal.
 * Returns shared themes owned by either the creator or partner.
 */
export const getEligibleThemes = query({
  args: { goalId: v.id("weeklyGoals") },
  handler: async (ctx, { goalId }): Promise<Doc<"themes">[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    const goal = await ctx.db.get(goalId);
    if (!goal) return [];

    // Verify user is part of this goal
    const isCreator = goal.creatorId === auth.user._id;
    const isPartner = goal.partnerId === auth.user._id;
    if (!isCreator && !isPartner) return [];

    // Get themes owned by creator that are shared
    const creatorThemes = await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", goal.creatorId))
      .filter((q) => q.eq(q.field("visibility"), "shared"))
      .collect();

    // Get themes owned by partner that are shared
    const partnerThemes = await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", goal.partnerId))
      .filter((q) => q.eq(q.field("visibility"), "shared"))
      .collect();

    // Combine and dedupe (shouldn't have dupes but just in case)
    const allThemes = [...creatorThemes, ...partnerThemes];
    const themeMap = new Map<string, Doc<"themes">>();
    for (const theme of allThemes) {
      themeMap.set(theme._id, theme);
    }

    // Filter out themes already in the goal
    const existingThemeIds = new Set(goal.themes.map((t) => t.themeId));
    return Array.from(themeMap.values()).filter(
      (theme) => !existingThemeIds.has(theme._id)
    );
  },
});

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create a new weekly goal with a partner.
 */
export const createGoal = mutation({
  args: {
    partnerId: v.id("users"),
  },
  handler: async (ctx, { partnerId }) => {
    const { user } = await getAuthenticatedUser(ctx);
    const now = Date.now();

    // Verify partner exists
    const partner = await ctx.db.get(partnerId);
    if (!partner) throw new Error("Partner not found");

    // Verify they are friends
    const friendship = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("friendId"), partnerId))
      .first();

    if (!friendship) throw new Error("You can only create goals with friends");

    // Check if user already has an active goal
    const existingAsCreator = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "editing"),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();
    const activeAsCreator = await purgeExpiredGoals(ctx, existingAsCreator, now, true);

    if (activeAsCreator.length > 0) throw new Error("You already have an active goal");

    const existingAsPartner = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_partner", (q) => q.eq("partnerId", user._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "editing"),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();
    const activeAsPartner = await purgeExpiredGoals(ctx, existingAsPartner, now, true);

    if (activeAsPartner.length > 0) throw new Error("You already have an active goal");

    // Check if partner already has an active goal
    const partnerExistingAsCreator = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", partnerId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "editing"),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();
    const activePartnerAsCreator = await purgeExpiredGoals(
      ctx,
      partnerExistingAsCreator,
      now,
      false
    );

    if (activePartnerAsCreator.length > 0)
      throw new Error("Your partner already has an active goal");

    const partnerExistingAsPartner = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_partner", (q) => q.eq("partnerId", partnerId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "editing"),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();
    const activePartnerAsPartner = await purgeExpiredGoals(
      ctx,
      partnerExistingAsPartner,
      now,
      false
    );

    if (activePartnerAsPartner.length > 0)
      throw new Error("Your partner already has an active goal");

    // Create the goal
    return await ctx.db.insert("weeklyGoals", {
      creatorId: user._id,
      partnerId,
      themes: [],
      creatorLocked: false,
      partnerLocked: false,
      status: "editing",
      createdAt: Date.now(),
    });
  },
});

/**
 * Add a theme to a goal.
 */
export const addTheme = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    themeId: v.id("themes"),
  },
  handler: async (ctx, { goalId, themeId }) => {
    const { user } = await getAuthenticatedUser(ctx);

    const goal = await ctx.db.get(goalId);
    if (!goal) throw new Error("Goal not found");

    // Verify user is part of this goal
    const isCreator = goal.creatorId === user._id;
    const isPartner = goal.partnerId === user._id;
    if (!isCreator && !isPartner) throw new Error("Not authorized");

    // Can only add themes in editing status
    if (goal.status !== "editing") throw new Error("Goal is locked");

    // Check max themes
    if (goal.themes.length >= MAX_THEMES_PER_GOAL)
      throw new Error("Maximum themes reached");

    // Verify theme exists and is eligible
    const theme = await ctx.db.get(themeId);
    if (!theme) throw new Error("Theme not found");

    // Theme must be shared and owned by one of the participants
    const isOwnedByCreator = theme.ownerId === goal.creatorId;
    const isOwnedByPartner = theme.ownerId === goal.partnerId;
    if (!isOwnedByCreator && !isOwnedByPartner)
      throw new Error("Theme must be owned by a participant");
    if (theme.visibility !== "shared")
      throw new Error("Theme must be shared");

    // Check if theme is already in goal
    if (goal.themes.some((t) => t.themeId === themeId))
      throw new Error("Theme already added");

    // Add theme
    await ctx.db.patch(goalId, {
      themes: [
        ...goal.themes,
        {
          themeId,
          themeName: theme.name,
          creatorCompleted: false,
          partnerCompleted: false,
        },
      ],
    });
  },
});

/**
 * Remove a theme from a goal.
 */
export const removeTheme = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    themeId: v.id("themes"),
  },
  handler: async (ctx, { goalId, themeId }) => {
    const { user } = await getAuthenticatedUser(ctx);

    const goal = await ctx.db.get(goalId);
    if (!goal) throw new Error("Goal not found");

    // Verify user is part of this goal
    const isCreator = goal.creatorId === user._id;
    const isPartner = goal.partnerId === user._id;
    if (!isCreator && !isPartner) throw new Error("Not authorized");

    // Can only remove themes in editing status
    if (goal.status !== "editing") throw new Error("Goal is locked");

    // Remove theme
    await ctx.db.patch(goalId, {
      themes: goal.themes.filter((t) => t.themeId !== themeId),
    });
  },
});

/**
 * Toggle completion status for a theme.
 */
export const toggleCompletion = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    themeId: v.id("themes"),
  },
  handler: async (ctx, { goalId, themeId }) => {
    const { user } = await getAuthenticatedUser(ctx);

    const goal = await ctx.db.get(goalId);
    if (!goal) throw new Error("Goal not found");

    // Verify user is part of this goal
    const isCreator = goal.creatorId === user._id;
    const isPartner = goal.partnerId === user._id;
    if (!isCreator && !isPartner) throw new Error("Not authorized");

    // Find the theme
    const themeIndex = goal.themes.findIndex((t) => t.themeId === themeId);
    if (themeIndex === -1) throw new Error("Theme not in goal");

    // Toggle the appropriate completion flag
    const updatedThemes = [...goal.themes];
    if (isCreator) {
      updatedThemes[themeIndex] = {
        ...updatedThemes[themeIndex],
        creatorCompleted: !updatedThemes[themeIndex].creatorCompleted,
      };
    } else {
      updatedThemes[themeIndex] = {
        ...updatedThemes[themeIndex],
        partnerCompleted: !updatedThemes[themeIndex].partnerCompleted,
      };
    }

    await ctx.db.patch(goalId, { themes: updatedThemes });
  },
});

/**
 * Lock the goal for the current user.
 */
export const lockGoal = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
  },
  handler: async (ctx, { goalId }) => {
    const { user } = await getAuthenticatedUser(ctx);

    const goal = await ctx.db.get(goalId);
    if (!goal) throw new Error("Goal not found");

    // Verify user is part of this goal
    const isCreator = goal.creatorId === user._id;
    const isPartner = goal.partnerId === user._id;
    if (!isCreator && !isPartner) throw new Error("Not authorized");

    // Must be in editing status
    if (goal.status !== "editing") throw new Error("Goal already locked");

    // Check if already locked
    if (isCreator && goal.creatorLocked)
      throw new Error("You already locked this goal");
    if (isPartner && goal.partnerLocked)
      throw new Error("You already locked this goal");

    // Update lock status
    const updates: Partial<Doc<"weeklyGoals">> = isCreator
      ? { creatorLocked: true }
      : { partnerLocked: true };

    // Check if this makes both locked
    const bothLocked = isCreator
      ? goal.partnerLocked
      : goal.creatorLocked;

    if (bothLocked) {
      // Both are now locked - activate the goal
      const now = Date.now();
      updates.status = "active";
      updates.lockedAt = now;
      updates.expiresAt = now + GOAL_DURATION_MS;
    }

    await ctx.db.patch(goalId, updates);
  },
});

/**
 * Complete and delete a goal.
 * Called when all themes are checked or when time expires.
 */
export const completeGoal = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
  },
  handler: async (ctx, { goalId }) => {
    const { user } = await getAuthenticatedUser(ctx);

    const goal = await ctx.db.get(goalId);
    if (!goal) throw new Error("Goal not found");

    // Verify user is part of this goal
    const isCreator = goal.creatorId === user._id;
    const isPartner = goal.partnerId === user._id;
    if (!isCreator && !isPartner) throw new Error("Not authorized");

    // Delete the goal
    await ctx.db.delete(goalId);
  },
});

/**
 * Clean up expired goals.
 * This is called when loading goals to remove expired ones.
 */
export const cleanupExpiredGoal = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
  },
  handler: async (ctx, { goalId }) => {
    const { user } = await getAuthenticatedUser(ctx);

    const goal = await ctx.db.get(goalId);
    if (!goal) return;

    const isCreator = goal.creatorId === user._id;
    const isPartner = goal.partnerId === user._id;
    if (!isCreator && !isPartner) throw new Error("Not authorized");

    // Only delete if expired
    if (goal.expiresAt && goal.expiresAt < Date.now()) {
      await ctx.db.delete(goalId);
    }
  },
});
