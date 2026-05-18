import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { GRACE_PERIOD_MS, MIN_GOAL_DURATION_MS } from "../constants";
import { isGoalPastGracePeriod } from "../../lib/cleanupExpiry";
import {
  canEditGoalEndDate,
  countCompletedThemes,
  getEffectiveBigBossStatus,
  getEffectiveGoalStatus,
  getEffectiveMiniBossStatus,
} from "../../lib/weeklyGoals";
import type { GoalRole, GoalWithUsers } from "./types";
import { toUserSummary } from "../helpers/userSummary";

export function shouldIncludeGoal(
  goal: Doc<"weeklyGoals">,
  now: number
): boolean {
  const effectiveStatus = getEffectiveGoalStatus(goal, now);

  if (effectiveStatus === "completed") {
    return false;
  }

  if (effectiveStatus === "draft") {
    return true;
  }

  return !isGoalPastGracePeriod(goal.endDate, now, GRACE_PERIOD_MS);
}

export function buildGoalWithUsers(
  goal: Doc<"weeklyGoals">,
  usersById: Map<Id<"users">, Doc<"users"> | null>,
  viewerRole: GoalRole,
  now: number
): GoalWithUsers {
  const miniBossStatus = getEffectiveMiniBossStatus(goal, now);
  const bigBossStatus = getEffectiveBigBossStatus(goal, now);

  return {
    goal,
    creator: toUserSummary(usersById.get(goal.creatorId) ?? null),
    partner: toUserSummary(usersById.get(goal.partnerId) ?? null),
    viewerRole,
    effectiveStatus: getEffectiveGoalStatus(goal, now),
    miniBossStatus,
    bigBossStatus,
    completedThemeCount: countCompletedThemes(goal.themes),
    canEditEndDate: canEditGoalEndDate(goal, now),
  };
}

export function validateEndDateTimestamp(endDate: number): void {
  if (!Number.isFinite(endDate)) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid end date" });
  }
}

export function validateGoalEndDateAtLeast24hAhead(endDate: number, now: number): void {
  if (endDate - now < MIN_GOAL_DURATION_MS) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "End date must be at least 24 hours from now" });
  }
}

export function sortGoalsByRecency(goals: GoalWithUsers[]): GoalWithUsers[] {
  return [...goals].sort((a, b) => {
    const aLockedAt = a.goal.lockedAt ?? 0;
    const bLockedAt = b.goal.lockedAt ?? 0;
    if (aLockedAt !== bLockedAt) {
      return bLockedAt - aLockedAt;
    }

    const aCreatedAt = a.goal.createdAt ?? 0;
    const bCreatedAt = b.goal.createdAt ?? 0;
    return bCreatedAt - aCreatedAt;
  });
}
