import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { MIN_GOAL_DURATION_MS } from "../constants";
import {
  canEditGoalEndDate,
  countCompletedThemes,
  getEffectiveBigBossStatus,
  getEffectiveGoalStatus,
  getEffectiveMiniBossStatus,
  normalizeWeeklyGoal,
  type NormalizedWeeklyGoal,
  type WeeklyGoalLockState,
} from "../../lib/weeklyGoals";
import type { GoalRole, GoalWithUsers } from "./types";
import { toUserSummary } from "../helpers/userSummary";

export function shouldIncludeGoal(
  goal: Doc<"weeklyGoals">,
  now: number
): boolean {
  // getEffectiveGoalStatus is the single lifecycle truth: a goal is visible
  // until it is completed. Past-grace deletion is handled by the cron, whose
  // index predicate (cleanup.ts) needs the raw arithmetic because it runs
  // before this reclassification would apply.
  return getEffectiveGoalStatus(goal, now) !== "completed";
}

/**
 * Derive the viewer-relative lock view once, so no client read path has to
 * re-implement the role↔lock mapping from the raw creator/partner booleans.
 */
function deriveLockState(
  goal: NormalizedWeeklyGoal<Doc<"weeklyGoals">>,
  viewerRole: GoalRole
): WeeklyGoalLockState {
  const viewerLocked = goal.mode === "solo"
    ? goal.creatorLocked
    : viewerRole === "creator"
      ? goal.creatorLocked
      : goal.partnerLocked;
  const partnerLocked = goal.mode === "solo"
    ? false
    : viewerRole === "creator"
      ? goal.partnerLocked
      : goal.creatorLocked;

  if (viewerLocked && partnerLocked) return "both_locked";
  if (viewerLocked) return "viewer_locked";
  if (partnerLocked) return "partner_locked";
  return "none";
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
  const partnerId = goal.partnerId;

  return {
    goal: normalizedGoal,
    mode: normalizedGoal.mode,
    creator: toUserSummary(usersById.get(goal.creatorId) ?? null),
    partner: normalizedGoal.mode === "solo" || partnerId === undefined
      ? null
      : toUserSummary(usersById.get(partnerId) ?? null),
    viewerRole: effectiveViewerRole,
    lockState: deriveLockState(normalizedGoal, effectiveViewerRole),
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
