/**
 * Weekly Goals API - Queries and mutations for collaborative learning goals.
 */

import { mutation, query, type MutationCtx, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { buildChallengeBase, buildChallengeStartState } from "./helpers/challengeCreation";
import { shuffleArray } from "./helpers/gameLogic";
import { loadThemesByIds, summarizeSessionWords } from "./helpers/sessionWords";
import { loadUsersById } from "./helpers/users";
import { isWeeklyPlanPayload } from "./notificationPayloads";
import type { NotificationPayload } from "./schema";
import { GRACE_PERIOD_MS, WEEKLY_GOAL_EDITING_TTL_MS } from "./constants";
import {
  isCreatedAtExpired,
  isGoalPastGracePeriod,
} from "../lib/cleanupExpiry";
import { buildSessionWords } from "../lib/sessionWords";
import {
  canEditGoalEndDate,
  countCompletedThemes,
  getEffectiveBossStatus,
  getEffectiveGoalStatus,
  getEffectiveMiniBossStatus,
  getGoalMidpointAt,
  getMiniBossUnlockThreshold,
  MIN_THEMES_PER_GOAL,
  type WeeklyGoalBossStatus,
  type WeeklyGoalLifecycleStatus,
} from "../lib/weeklyGoals";

// Constants
const MAX_THEMES_PER_GOAL = 10;
const MINI_BOSS_WORD_CAP = 20;
const BIG_BOSS_WORD_CAP = 30;
type BossType = "mini" | "big";

function getBossWordCap(bossType: BossType): number {
  return bossType === "mini" ? MINI_BOSS_WORD_CAP : BIG_BOSS_WORD_CAP;
}

function getGoalParticipantIds(goal: Doc<"weeklyGoals">): Id<"users">[] {
  return [goal.creatorId, goal.partnerId];
}

function getEligibleThemeIdsForBoss(
  goal: Doc<"weeklyGoals">,
  bossType: BossType
): Id<"themes">[] {
  if (bossType === "mini") {
    const completedThemeIds = goal.themes
      .filter((t) => t.creatorCompleted && t.partnerCompleted)
      .map((t) => t.themeId);
    const miniBossThemeCount = getMiniBossUnlockThreshold(goal.themes.length);

    return shuffleArray(completedThemeIds).slice(0, miniBossThemeCount);
  }
  return goal.themes.map((t) => t.themeId);
}

function buildSampledBossSessionWords(
  themes: Awaited<ReturnType<typeof loadThemesByIds>>,
  bossType: BossType
) {
  const fullSessionWords = buildSessionWords(themes);

  if (fullSessionWords.length === 0) {
    throw new Error("No boss words are available for this goal");
  }

  return shuffleArray(fullSessionWords).slice(0, getBossWordCap(bossType));
}

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
    event: "invite" | "partner_locked" | "goal_activated" | "goal_completed";
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

async function dismissChallengeNotifications(
  ctx: MutationCtx,
  participantIds: Id<"users">[],
  challengeIds: Id<"challenges">[]
) {
  if (challengeIds.length === 0) return;

  const challengeIdSet = new Set(challengeIds.map((challengeId) => String(challengeId)));

  for (const userId of participantIds) {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_type", (q) => q.eq("type", "duel_challenge").eq("toUserId", userId))
      .collect();

    for (const notification of notifications) {
      if (
        (notification.status === "pending" || notification.status === "read") &&
        notification.payload &&
        "challengeId" in notification.payload &&
        challengeIdSet.has(String(notification.payload.challengeId))
      ) {
        await ctx.db.patch(notification._id, { status: "dismissed" });
      }
    }
  }
}

async function deleteBossChallengesForGoal(
  ctx: MutationCtx,
  goal: Doc<"weeklyGoals">
) {
  const challenges = await ctx.db
    .query("challenges")
    .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goal._id))
    .collect();

  if (challenges.length === 0) return;

  const challengeIds = challenges.map((challenge) => challenge._id);
  await dismissChallengeNotifications(ctx, getGoalParticipantIds(goal), challengeIds);

  for (const challenge of challenges) {
    await ctx.db.delete(challenge._id);
  }
}

export async function completeWeeklyGoalBoss(
  ctx: MutationCtx,
  goal: Doc<"weeklyGoals">,
  bossType: BossType
) {
  if (bossType === "mini") {
    if (goal.miniBossStatus === "completed") return;
    await ctx.db.patch(goal._id, { miniBossStatus: "completed" });
    return;
  }

  if (goal.bossStatus === "completed" && goal.status === "completed") {
    return;
  }

  await ctx.db.patch(goal._id, {
    bossStatus: "completed",
    status: "completed",
  });

  const now = Date.now();
  const participants = getGoalParticipantIds(goal);
  await upsertWeeklyPlanNotificationForGoal(ctx, {
    toUserId: goal.creatorId,
    fromUserId: goal.partnerId,
    goalId: goal._id,
    themeCount: goal.themes.length,
    event: "goal_completed",
    createdAt: now,
  });
  await upsertWeeklyPlanNotificationForGoal(ctx, {
    toUserId: goal.partnerId,
    fromUserId: goal.creatorId,
    goalId: goal._id,
    themeCount: goal.themes.length,
    event: "goal_completed",
    createdAt: now,
  });

  await dismissChallengeNotifications(
    ctx,
    participants,
    (
      await ctx.db
        .query("challenges")
        .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goal._id))
        .collect()
    ).map((challenge) => challenge._id)
  );
}

// Types
export type GoalRole = "creator" | "partner";

export interface GoalWithUsers {
  goal: Doc<"weeklyGoals">;
  creator: { _id: Id<"users">; nickname?: string; email: string } | null;
  partner: { _id: Id<"users">; nickname?: string; email: string } | null;
  viewerRole: GoalRole;
  effectiveStatus: WeeklyGoalLifecycleStatus;
  miniBossStatus: WeeklyGoalBossStatus;
  bossStatus: WeeklyGoalBossStatus;
  midpointAt: number | null;
  completedThemeCount: number;
  canEditEndDate: boolean;
}

type UserSummary = { _id: Id<"users">; nickname?: string; email: string };

const toUserSummary = (user: Doc<"users"> | null): UserSummary | null => {
  if (!user) return null;
  return { _id: user._id, nickname: user.nickname, email: user.email };
};

function shouldIncludeGoal(
  goal: Doc<"weeklyGoals">,
  now: number
): boolean {
  const effectiveStatus = getEffectiveGoalStatus(goal, now);

  if (effectiveStatus === "completed") {
    return false;
  }

  if (effectiveStatus === "editing") {
    return true;
  }

  return !isGoalPastGracePeriod(goal.endDate, now, GRACE_PERIOD_MS);
}

function buildGoalWithUsers(
  goal: Doc<"weeklyGoals">,
  usersById: Map<Id<"users">, Doc<"users"> | null>,
  viewerRole: GoalRole,
  now: number
): GoalWithUsers {
  const miniBossStatus = getEffectiveMiniBossStatus(goal, now);
  const bossStatus = getEffectiveBossStatus(goal, now, miniBossStatus);

  return {
    goal,
    creator: toUserSummary(usersById.get(goal.creatorId) ?? null),
    partner: toUserSummary(usersById.get(goal.partnerId) ?? null),
    viewerRole,
    effectiveStatus: getEffectiveGoalStatus(goal, now),
    miniBossStatus,
    bossStatus,
    midpointAt: getGoalMidpointAt(goal.lockedAt ?? now, goal.endDate),
    completedThemeCount: countCompletedThemes(goal.themes),
    canEditEndDate: canEditGoalEndDate(goal, now),
  };
}

function validateEndDateTimestamp(endDate: number): void {
  if (!Number.isFinite(endDate)) {
    throw new Error("Invalid end date");
  }
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
 * Get all weekly goals that should still be visible to the current user.
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
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "expired")
        )
      )
      .collect();
    const visibleGoalsAsCreator = goalsAsCreator.filter((goal) =>
      shouldIncludeGoal(goal, now)
    );

    // Get all goals where user is partner
    const goalsAsPartner = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_partner", (q) => q.eq("partnerId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "editing"),
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "expired")
        )
      )
      .collect();
    const visibleGoalsAsPartner = goalsAsPartner.filter((goal) =>
      shouldIncludeGoal(goal, now)
    );

    const allVisibleGoals = [...visibleGoalsAsCreator, ...visibleGoalsAsPartner];
    const participantIds = allVisibleGoals.flatMap((goal) => [
      goal.creatorId,
      goal.partnerId,
    ]);
    const usersById = await loadUsersById(ctx, participantIds);

    for (const goal of visibleGoalsAsCreator) {
      results.push(buildGoalWithUsers(goal, usersById, "creator", now));
    }

    for (const goal of visibleGoalsAsPartner) {
      results.push(buildGoalWithUsers(goal, usersById, "partner", now));
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

    if (!shouldIncludeGoal(goal, now)) {
      return null;
    }

    const usersById = await loadUsersById(ctx, [goal.creatorId, goal.partnerId]);
    return buildGoalWithUsers(goal, usersById, isCreator ? "creator" : "partner", now);
  },
});

export const getBossPracticeSession = query({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const challenge = await ctx.db.get(challengeId);
    if (!challenge) return null;

    const isOwnPracticeChallenge =
      challenge.challengerId === auth.user._id &&
      challenge.opponentId === auth.user._id &&
      challenge.mode === "solo" &&
      !challenge.bossType;

    if (!isOwnPracticeChallenge) {
      return null;
    }

    return {
      challengeId: challenge._id,
      sessionWords: challenge.sessionWords,
      themeSummary: summarizeSessionWords(challenge.sessionWords),
    };
  },
});

/**
 * Purge all expired goals for the current user.
 * This mutation should be called periodically from the client to clean up expired goals.
 */
export const purgeExpiredGoalsForUser = mutation({
  args: {},
  handler: async (ctx): Promise<{ deletedCount: number; expiredCount: number }> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return { deletedCount: 0, expiredCount: 0 };

    const userId = auth.user._id;
    const now = Date.now();
    let deletedCount = 0;
    let expiredCount = 0;

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

    // Sync expired goals and delete anything past the grace window.
    for (const goal of uniqueGoals) {
      const effectiveStatus = getEffectiveGoalStatus(goal, now);

      if (effectiveStatus === "expired" && goal.status !== "expired") {
        await ctx.db.patch(goal._id, { status: "expired" });
        expiredCount++;
      }

      if (isGoalPastGracePeriod(goal.endDate, now, GRACE_PERIOD_MS)) {
        await dismissGoalNotifications(ctx, goal._id);
        await deleteBossChallengesForGoal(ctx, goal);
        await ctx.db.delete(goal._id);
        deletedCount++;
      }
    }

    return { deletedCount, expiredCount };
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
    const activeUserAsCreator = existingGoalUserAsCreator.filter((goal) =>
      shouldIncludeGoal(goal, now)
    );

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
    const activeUserAsPartner = existingGoalUserAsPartner.filter((goal) =>
      shouldIncludeGoal(goal, now)
    );

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
      miniBossStatus: "locked",
      bossStatus: "locked",
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
 * Set or update the goal end date.
 */
export const setGoalEndDate = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    endDate: v.number(),
  },
  handler: async (ctx, { goalId, endDate }) => {
    const { user } = await getAuthenticatedUser(ctx);
    const goal = await ctx.db.get(goalId);

    if (!goal) throw new Error("Goal not found");

    const isCreator = goal.creatorId === user._id;
    const isPartner = goal.partnerId === user._id;
    if (!isCreator && !isPartner) throw new Error("Not authorized");

    validateEndDateTimestamp(endDate);

    const now = Date.now();
    if (endDate <= now) {
      throw new Error("End date must be in the future");
    }

    if (!canEditGoalEndDate(goal, now)) {
      throw new Error("End date can no longer be changed");
    }

    if (goal.lockedAt && endDate <= goal.lockedAt) {
      throw new Error("End date must be after the start date");
    }

    await ctx.db.patch(goalId, { endDate });
  },
});

async function validateAndPrepareBoss(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  bossType: BossType
) {
  const { user } = await getAuthenticatedUser(ctx);
  const goal = await ctx.db.get(goalId);

  if (!goal) throw new Error("Goal not found");

  const isCreator = goal.creatorId === user._id;
  const isPartner = goal.partnerId === user._id;
  if (!isCreator && !isPartner) throw new Error("Not authorized");

  const now = Date.now();
  if (getEffectiveGoalStatus(goal, now) !== "active") {
    throw new Error("This goal is not active");
  }

  const effectiveStatus = bossType === "mini"
    ? getEffectiveMiniBossStatus(goal, now)
    : getEffectiveBossStatus(goal, now);

  if (effectiveStatus !== "available") {
    throw new Error("This boss is not ready yet");
  }

  const eligibleThemeIds = getEligibleThemeIdsForBoss(goal, bossType);
  const themes = await loadThemesByIds(ctx, eligibleThemeIds);
  const sampledSessionWords = buildSampledBossSessionWords(themes, bossType);

  return { user, goal, isCreator, now, sampledSessionWords };
}

export const startBossDuel = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    bossType: v.union(v.literal("mini"), v.literal("big")),
  },
  handler: async (ctx, { goalId, bossType }) => {
    const { user, goal, isCreator, now, sampledSessionWords } =
      await validateAndPrepareBoss(ctx, goalId, bossType);

    const existingGoalChallenges = await ctx.db
      .query("challenges")
      .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goalId))
      .collect();

    const duplicateAttempt = existingGoalChallenges.find(
      (challenge) =>
        challenge.bossType === bossType &&
        (challenge.status === "pending" || challenge.status === "accepted")
    );
    if (duplicateAttempt) {
      throw new Error("A boss attempt is already in progress");
    }

    const opponentId = isCreator ? goal.partnerId : goal.creatorId;
    const challengeBase = buildChallengeBase({
      challengerId: user._id,
      opponentId,
      sessionWords: sampledSessionWords,
      mode: "classic",
      createdAt: now,
    });

    const challengeId = await ctx.db.insert("challenges", {
      ...challengeBase,
      weeklyGoalId: goalId,
      bossType,
      challengerPerfectRun: true,
      opponentPerfectRun: true,
      status: "pending",
    });

    const bossLabel = bossType === "mini" ? "Mini Boss" : "Big Boss";
    await ctx.db.insert("notifications", {
      type: "duel_challenge",
      fromUserId: user._id,
      toUserId: opponentId,
      status: "pending",
      payload: {
        challengeId,
        themeName: `${bossLabel}: ${summarizeSessionWords(sampledSessionWords)}`,
        mode: challengeBase.mode,
        classicDifficultyPreset: challengeBase.classicDifficultyPreset,
      },
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
      trigger: "immediate_duel_challenge",
      toUserId: opponentId,
      fromUserId: user._id,
      challengeId,
    });

    return challengeId;
  },
});

export const startBossPractice = mutation({
  args: {
    goalId: v.id("weeklyGoals"),
    bossType: v.union(v.literal("mini"), v.literal("big")),
  },
  handler: async (ctx, { goalId, bossType }) => {
    const { user, now, sampledSessionWords } =
      await validateAndPrepareBoss(ctx, goalId, bossType);

    const challengeBase = buildChallengeBase({
      challengerId: user._id,
      opponentId: user._id,
      sessionWords: sampledSessionWords,
      mode: "solo",
      createdAt: now,
    });
    const startState = buildChallengeStartState({
      mode: "solo",
      wordCount: sampledSessionWords.length,
      now,
      seed: challengeBase.seed,
    });

    return await ctx.db.insert("challenges", {
      ...challengeBase,
      weeklyGoalId: goalId,
      ...startState,
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

    if (goal.themes.length < MIN_THEMES_PER_GOAL) {
      throw new Error(`Add at least ${MIN_THEMES_PER_GOAL} themes before locking`);
    }

    if (typeof goal.endDate !== "number") {
      throw new Error("Choose an end date before locking");
    }

    // Update lock status
    const updates: Partial<Doc<"weeklyGoals">> = isCreator
      ? { creatorLocked: true }
      : { partnerLocked: true };

    // Check if this makes both locked
    const bothLocked = isCreator
      ? goal.partnerLocked
      : goal.creatorLocked;

    const now = Date.now();

    if (goal.endDate <= now) {
      throw new Error("End date must be in the future");
    }

    if (bothLocked) {
      // Both are now locked - activate the goal
      updates.status = "active";
      updates.lockedAt = now;

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
 * Delete a goal in any state.
 * Either creator or partner can remove the goal and its related boss challenges.
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

    await dismissGoalNotifications(ctx, goalId);
    await deleteBossChallengesForGoal(ctx, goal);
    await ctx.db.delete(goalId);
  },
});

// Internal query for reminder crons
export const getActiveGoalsWithEndDate = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_endDate", (q) =>
        q.eq("status", "active").gt("endDate", now)
      )
      .collect();
  },
});

/**
 * Internal cron cleanup for expired weekly goals.
 * - Active goals move to expired once endDate passes.
 * - Expired goals are deleted after a 48 hour grace period.
 * - Editing goals expire by createdAt + TTL.
 */
export const cleanupExpiredGoals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const editingCutoff = now - WEEKLY_GOAL_EDITING_TTL_MS;

    const activeGoalsPastEndDate = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_endDate", (q) =>
        q.eq("status", "active").lt("endDate", now)
      )
      .collect();

    const expiredGoalsPastGrace = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_endDate", (q) =>
        q.eq("status", "expired").lt("endDate", now - GRACE_PERIOD_MS)
      )
      .collect();

    const editingGoals = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_status_createdAt", (q) =>
        q.eq("status", "editing").lt("createdAt", editingCutoff)
      )
      .collect();

    const goalsToDelete = [
      ...activeGoalsPastEndDate.filter((goal) =>
        isGoalPastGracePeriod(goal.endDate, now, GRACE_PERIOD_MS)
      ),
      ...expiredGoalsPastGrace,
      ...editingGoals.filter((goal) =>
        isCreatedAtExpired(goal.createdAt, now, WEEKLY_GOAL_EDITING_TTL_MS)
      ),
    ];

    const goalsToExpire = activeGoalsPastEndDate.filter(
      (goal) => !isGoalPastGracePeriod(goal.endDate, now, GRACE_PERIOD_MS)
    );

    for (const goal of goalsToExpire) {
      await ctx.db.patch(goal._id, { status: "expired" });
    }

    if (goalsToDelete.length === 0) return;

    // Deduplicate — a goal could appear in multiple query results.
    const seen = new Set<string>();
    const uniqueGoalsToDelete = goalsToDelete.filter((g) => {
      const key = String(g._id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const participantIdSet = new Set<Id<"users">>();
    const goalIds: Id<"weeklyGoals">[] = [];
    for (const goal of uniqueGoalsToDelete) {
      goalIds.push(goal._id);
      participantIdSet.add(goal.creatorId);
      participantIdSet.add(goal.partnerId);
    }

    await dismissGoalNotificationsForParticipants(
      ctx,
      Array.from(participantIdSet),
      goalIds
    );

    for (const goal of uniqueGoalsToDelete) {
      await deleteBossChallengesForGoal(ctx, goal);
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
