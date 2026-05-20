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
  normalizeWeeklyGoal,
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
  const normalizedGoal = normalizeWeeklyGoal(goal);
  const miniBossStatus = getEffectiveMiniBossStatus(normalizedGoal, now);
  const bigBossStatus = getEffectiveBigBossStatus(normalizedGoal, now);
  const effectiveViewerRole = normalizedGoal.mode === "solo" ? "creator" : viewerRole;

  return {
    goal: normalizedGoal,
    mode: normalizedGoal.mode,
    creator: toUserSummary(usersById.get(goal.creatorId) ?? null),
    partner: normalizedGoal.mode === "solo"
      ? null
      : toUserSummary(usersById.get(goal.partnerId!) ?? null),
    viewerRole: effectiveViewerRole,
    effectiveStatus: getEffectiveGoalStatus(normalizedGoal, now),
    miniBossStatus,
    bigBossStatus,
    completedThemeCount: countCompletedThemes(normalizedGoal.themes, normalizedGoal.mode),
    canEditEndDate: canEditGoalEndDate(normalizedGoal, now),
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
