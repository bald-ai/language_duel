/**
 * Weekly Goals API - Queries and mutations for collaborative learning goals.
 */

import { mutation, query, type MutationCtx, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { isWeeklyPlanPayload } from "./notificationPayloads";
import type { NotificationPayload } from "./schema";
import { WEEKLY_GOAL_EDITING_TTL_MS } from "./constants";
import { isCreatedAtExpired, isGoalPastExpiry } from "../lib/cleanupExpiry";

// Constants
const MAX_THEMES_PER_GOAL = 5;
const GOAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function dismissGoalNotifications(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">
) {
  const goal = await ctx.db.get(goalId);
  if (!goal) return;

  const participantIds = [goal.creatorId, goal.partnerId];

  for (const userId of participantIds) {
    const pendingNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status", (q) =>
        q
          .eq("type", "weekly_plan_invitation")
          .eq("toUserId", userId)
          .eq("status", "pending")
      )
      .collect();

    const readNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status", (q) =>
        q
          .eq("type", "weekly_plan_invitation")
          .eq("toUserId", userId)
          .eq("status", "read")
      )
      .collect();

    const notifications = [...pendingNotifications, ...readNotifications];

    for (const notification of notifications) {
      if (
        isWeeklyPlanPayload(notification.payload) &&
        notification.payload.goalId === goalId
      ) {
        await ctx.db.patch(notification._id, { status: "dismissed" });
      }
    }
  }
}

async function dismissGoalNotificationsForParticipants(
  ctx: MutationCtx,
  participantIds: Id<"users">[],
  goalIds: Id<"weeklyGoals">[]
) {
  if (participantIds.length === 0 || goalIds.length === 0) return;

  const goalIdSet = new Set(goalIds.map((id) => String(id)));

  for (const userId of participantIds) {
    const pendingNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status", (q) =>
        q
          .eq("type", "weekly_plan_invitation")
          .eq("toUserId", userId)
          .eq("status", "pending")
      )
      .collect();

    const readNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status", (q) =>
        q
          .eq("type", "weekly_plan_invitation")
          .eq("toUserId", userId)
          .eq("status", "read")
      )
      .collect();

    const notifications = [...pendingNotifications, ...readNotifications];
    for (const notification of notifications) {
      if (!isWeeklyPlanPayload(notification.payload)) continue;
      if (!goalIdSet.has(String(notification.payload.goalId))) continue;
      await ctx.db.patch(notification._id, { status: "dismissed" });
    }
  }
}

async function upsertWeeklyPlanNotificationForGoal(
  ctx: MutationCtx,
  args: {
    toUserId: Id<"users">;
    fromUserId: Id<"users">;
    goalId: Id<"weeklyGoals">;
    themeCount: number;
    event: "invite" | "partner_locked" | "goal_activated";
    createdAt: number;
  }
) {
  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_type", (q) =>
      q.eq("type", "weekly_plan_invitation").eq("toUserId", args.toUserId)
    )
    .collect();

  const matching = existing.find(
    (n) => isWeeklyPlanPayload(n.payload) && n.payload.goalId === args.goalId
  );

  const payload: NotificationPayload = {
    goalId: args.goalId,
    themeCount: args.themeCount,
    event: args.event,
  };

  if (matching) {
    await ctx.db.patch(matching._id, {
      fromUserId: args.fromUserId,
      payload,
      status: "pending",
      createdAt: args.createdAt,
    });
    return;
  }

  await ctx.db.insert("notifications", {
    type: "weekly_plan_invitation",
    fromUserId: args.fromUserId,
    toUserId: args.toUserId,
    status: "pending",
    payload,
    createdAt: args.createdAt,
  });
}

// Types
export type GoalRole = "creator" | "partner";

export interface GoalWithUsers {
  goal: Doc<"weeklyGoals">;
  creator: { _id: Id<"users">; nickname?: string; email: string } | null;
  partner: { _id: Id<"users">; nickname?: string; email: string } | null;
  viewerRole: GoalRole;
}

type UserDoc = Doc<"users">;
type UserSummary = { _id: Id<"users">; nickname?: string; email: string };

const toUserSummary = (user: UserDoc | null): UserSummary | null => {
  if (!user) return null;
  return { _id: user._id, nickname: user.nickname, email: user.email };
};

async function loadUsersByGoalParticipants(
  ctx: { db: { get: (id: Id<"users">) => Promise<UserDoc | null> } },
  goals: Doc<"weeklyGoals">[]
) {
  const userIds = new Set<Id<"users">>();
  for (const goal of goals) {
    userIds.add(goal.creatorId);
    userIds.add(goal.partnerId);
  }
  const idList = Array.from(userIds);
  const users = await Promise.all(idList.map((id) => ctx.db.get(id)));
  const usersById = new Map<Id<"users">, UserDoc | null>();
  idList.forEach((id, index) => {
    usersById.set(id, users[index] ?? null);
  });
  return usersById;
}

function filterNonExpiredGoals(
  goals: Doc<"weeklyGoals">[],
  now: number
): Doc<"weeklyGoals">[] {
  return goals.filter((goal) => !goal.expiresAt || goal.expiresAt >= now);
}

/**
 * Sort goals by lockedAt descending, then createdAt descending as a tiebreaker.
 * This ensures consistent ordering across loads.
 */
function sortGoalsByRecency(goals: GoalWithUsers[]): GoalWithUsers[] {
  return [...goals].sort((a, b) => {
    // First sort by lockedAt descending (locked goals first, more recent locks first)
    const aLockedAt = a.goal.lockedAt ?? 0;
    const bLockedAt = b.goal.lockedAt ?? 0;
    if (aLockedAt !== bLockedAt) {
      return bLockedAt - aLockedAt; // descending
    }
    // Tiebreaker: createdAt descending (more recent first)
    const aCreatedAt = a.goal.createdAt ?? 0;
    const bCreatedAt = b.goal.createdAt ?? 0;
    return bCreatedAt - aCreatedAt; // descending
  });
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get all the user's active or editing goals.
 * Returns an array of goals where the user is either creator or partner.
 */
export const getAllActiveGoals = query({
  args: {},
  handler: async (ctx): Promise<GoalWithUsers[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    const userId = auth.user._id;
    const now = Date.now();
    const results: GoalWithUsers[] = [];

    // Get all goals where user is creator
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
    const activeGoalsAsCreator = filterNonExpiredGoals(goalsAsCreator, now);

    // Get all goals where user is partner
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
    const activeGoalsAsPartner = filterNonExpiredGoals(goalsAsPartner, now);

    const allActiveGoals = [...activeGoalsAsCreator, ...activeGoalsAsPartner];
    const usersById = await loadUsersByGoalParticipants(ctx, allActiveGoals);

    for (const goal of activeGoalsAsCreator) {
      results.push({
        goal,
        creator: toUserSummary(usersById.get(goal.creatorId) ?? null),
        partner: toUserSummary(usersById.get(goal.partnerId) ?? null),
        viewerRole: "creator",
      });
    }

    for (const goal of activeGoalsAsPartner) {
      results.push({
        goal,
        creator: toUserSummary(usersById.get(goal.creatorId) ?? null),
        partner: toUserSummary(usersById.get(goal.partnerId) ?? null),
        viewerRole: "partner",
      });
    }

    // Sort results for consistent ordering: lockedAt desc, then createdAt desc
    return sortGoalsByRecency(results);
  },
});

/**
 * Get a specific goal by ID.
 * Returns null if goal not found or user is not a participant.
 */
export const getGoalById = query({
  args: { goalId: v.id("weeklyGoals") },
  handler: async (ctx, { goalId }): Promise<GoalWithUsers | null> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const userId = auth.user._id;
    const now = Date.now();

    const goal = await ctx.db.get(goalId);
    if (!goal) return null;

    // Check if user is a participant
    const isCreator = goal.creatorId === userId;
    const isPartner = goal.partnerId === userId;
    if (!isCreator && !isPartner) return null;

    // Check if goal is expired (return null, but don't delete - that's done via mutation)
    if (goal.expiresAt && goal.expiresAt < now) {
      return null;
    }

    // Only return active or editing goals
    if (goal.status !== "active" && goal.status !== "editing") return null;

    const [creator, partner] = await Promise.all([
      ctx.db.get(goal.creatorId),
      ctx.db.get(goal.partnerId),
    ]);

    return {
      goal,
      creator: toUserSummary(creator),
      partner: toUserSummary(partner),
      viewerRole: isCreator ? "creator" : "partner",
    };
  },
});

/**
 * Purge all expired goals for the current user.
 * This mutation should be called periodically from the client to clean up expired goals.
 */
export const purgeExpiredGoalsForUser = mutation({
  args: {},
  handler: async (ctx): Promise<{ deletedCount: number }> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return { deletedCount: 0 };

    const userId = auth.user._id;
    const now = Date.now();
    let deletedCount = 0;

    // Get all goals where user is creator
    const goalsAsCreator = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .collect();

    // Get all goals where user is partner
    const goalsAsPartner = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_partner", (q) => q.eq("partnerId", userId))
      .collect();

    // Combine and dedupe
    const allGoals = [...goalsAsCreator, ...goalsAsPartner];
    const seenIds = new Set<string>();
    const uniqueGoals = allGoals.filter((g) => {
      if (seenIds.has(g._id)) return false;
      seenIds.add(g._id);
      return true;
    });

    // Delete expired goals and dismiss their notifications
    for (const goal of uniqueGoals) {
      if (goal.expiresAt && goal.expiresAt < now) {
        await dismissGoalNotifications(ctx, goal._id);
        await ctx.db.delete(goal._id);
        deletedCount++;
      }
    }

    return { deletedCount };
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

    // Get themes owned by creator
    const creatorThemes = await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", goal.creatorId))
      .collect();

    // Get themes owned by partner
    const partnerThemes = await ctx.db
      .query("themes")
      .withIndex("by_owner", (q) => q.eq("ownerId", goal.partnerId))
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
 * Validates that there's no existing active goal between this specific duo.
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

    // Check if there's already an active goal between this SPECIFIC duo
    // Case 1: Current user is creator, partner is partner
    const existingGoalUserAsCreator = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("partnerId"), partnerId),
          q.or(
            q.eq(q.field("status"), "editing"),
            q.eq(q.field("status"), "active")
          )
        )
      )
      .collect();
    const activeUserAsCreator = filterNonExpiredGoals(existingGoalUserAsCreator, now);

    if (activeUserAsCreator.length > 0) {
      throw new Error("You already have an active goal with this partner");
    }

    // Case 2: Partner is creator, current user is partner
    const existingGoalUserAsPartner = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", partnerId))
      .filter((q) =>
        q.and(
          q.eq(q.field("partnerId"), user._id),
          q.or(
            q.eq(q.field("status"), "editing"),
            q.eq(q.field("status"), "active")
          )
        )
      )
      .collect();
    const activeUserAsPartner = filterNonExpiredGoals(existingGoalUserAsPartner, now);

    if (activeUserAsPartner.length > 0) {
      throw new Error("You already have an active goal with this partner");
    }

    // Create the goal
    const goalId = await ctx.db.insert("weeklyGoals", {
      creatorId: user._id,
      partnerId,
      themes: [],
      creatorLocked: false,
      partnerLocked: false,
      status: "editing",
      createdAt: now,
    });

    // Notify the partner about the new goal invitation
    await ctx.db.insert("notifications", {
      type: "weekly_plan_invitation",
      fromUserId: user._id,
      toUserId: partnerId,
      status: "pending",
      payload: {
        goalId,
        themeCount: 0,
        event: "invite",
      },
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
      trigger: "weekly_goal_invite",
      toUserId: partnerId,
      fromUserId: user._id,
      weeklyGoalId: goalId,
    });

    return goalId;
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

    // Cannot add themes if either participant has locked
    if (goal.creatorLocked || goal.partnerLocked)
      throw new Error("Cannot add themes after a participant has locked");

    // Check max themes
    if (goal.themes.length >= MAX_THEMES_PER_GOAL)
      throw new Error("Maximum themes reached");

    // Verify theme exists and is eligible
    const theme = await ctx.db.get(themeId);
    if (!theme) throw new Error("Theme not found");

    // Theme must be owned by one of the participants
    // Access is granted to the partner via the weekly goal relationship (see hasAccessViaWeeklyGoal)
    const isOwnedByCreator = theme.ownerId === goal.creatorId;
    const isOwnedByPartner = theme.ownerId === goal.partnerId;
    if (!isOwnedByCreator && !isOwnedByPartner)
      throw new Error("Theme must be owned by a participant");

    // Skip if theme is already in goal (idempotent behavior)
    if (goal.themes.some((t) => t.themeId === themeId)) {
      return; // Already added, silently succeed
    }

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

    // Cannot remove themes if either participant has locked
    if (goal.creatorLocked || goal.partnerLocked)
      throw new Error("Cannot remove themes after a participant has locked");

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

    const now = Date.now();

    if (bothLocked) {
      // Both are now locked - activate the goal
      updates.status = "active";
      updates.lockedAt = now;
      updates.expiresAt = now + GOAL_DURATION_MS;

      // Notify the other user (the one who locked first) in the UI.
      await upsertWeeklyPlanNotificationForGoal(ctx, {
        toUserId: isCreator ? goal.partnerId : goal.creatorId,
        fromUserId: user._id,
        goalId,
        themeCount: goal.themes.length,
        event: "goal_activated",
        createdAt: now,
      });

      await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
        trigger: "weekly_goal_accepted",
        toUserId: isCreator ? goal.partnerId : goal.creatorId,
        fromUserId: user._id,
        weeklyGoalId: goalId,
      });
    } else {
      // First lock - update the existing notification with current theme count
      const otherUserId = isCreator ? goal.partnerId : goal.creatorId;

      await upsertWeeklyPlanNotificationForGoal(ctx, {
        toUserId: otherUserId,
        fromUserId: user._id,
        goalId,
        themeCount: goal.themes.length,
        event: "partner_locked",
        createdAt: now,
      });

      await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
        trigger: "weekly_goal_locked",
        toUserId: otherUserId,
        fromUserId: user._id,
        weeklyGoalId: goalId,
      });
    }

    await ctx.db.patch(goalId, updates);
  },
});

/**
 * Delete an unlocked goal.
 * Either creator or partner can delete while in editing status.
 */
export const deleteGoal = mutation({
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

    // Can only delete unlocked goals
    if (goal.status !== "editing") {
      throw new Error("Cannot delete a locked goal");
    }

    // Cannot delete if either participant has locked
    if (goal.creatorLocked || goal.partnerLocked) {
      throw new Error("Cannot delete goal after a participant has locked");
    }

    await dismissGoalNotifications(ctx, goalId);
    await ctx.db.delete(goalId);
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

    await dismissGoalNotifications(ctx, goalId);
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
      await dismissGoalNotifications(ctx, goalId);
      await ctx.db.delete(goalId);
    }
  },
});

// Internal query for reminder crons
export const getActiveGoalsWithExpiry = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_expiresAt", (q) =>
        q.eq("status", "active").gt("expiresAt", now)
      )
      .collect();
  },
});

/**
 * Internal cron cleanup for expired weekly goals.
 * - Active goals expire by expiresAt.
 * - Editing goals expire by createdAt + TTL.
 */
export const cleanupExpiredGoals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const editingCutoff = now - WEEKLY_GOAL_EDITING_TTL_MS;

    const expiredActiveGoals = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_expiresAt", (q) =>
        q.eq("status", "active").lt("expiresAt", now)
      )
      .collect();

    const editingGoals = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_createdAt", (q) =>
        q.eq("status", "editing").lt("createdAt", editingCutoff)
      )
      .collect();

    const goalsToDelete = [
      ...expiredActiveGoals.filter((goal) => isGoalPastExpiry(goal.expiresAt, now)),
      ...editingGoals.filter((goal) =>
        isCreatedAtExpired(goal.createdAt, now, WEEKLY_GOAL_EDITING_TTL_MS)
      ),
    ];

    if (goalsToDelete.length === 0) return;

    const participantIdSet = new Set<Id<"users">>();
    const goalIds: Id<"weeklyGoals">[] = [];
    for (const goal of goalsToDelete) {
      goalIds.push(goal._id);
      participantIdSet.add(goal.creatorId);
      participantIdSet.add(goal.partnerId);
    }

    await dismissGoalNotificationsForParticipants(
      ctx,
      Array.from(participantIdSet),
      goalIds
    );

    for (const goal of goalsToDelete) {
      await ctx.db.delete(goal._id);
    }
  },
});

export const dismissWeeklyPlanInvitation = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.toUserId !== user._id) {
      throw new Error("Not authorized");
    }

    if (notification.type !== "weekly_plan_invitation") {
      throw new Error("Invalid notification type");
    }

    await ctx.db.patch(args.notificationId, {
      status: "dismissed",
    });

    return { success: true };
  },
});
