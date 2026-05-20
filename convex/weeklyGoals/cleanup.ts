import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  deleteWeeklyGoalThemeSnapshots,
} from "../helpers/weeklyGoalSnapshots";
import { dismissWeeklyGoalNotificationsForParticipants } from "../notificationHelpers";
import { GRACE_PERIOD_MS, WEEKLY_GOAL_DRAFT_TTL_MS } from "../constants";
import {
  isCreatedAtExpired,
  isGoalPastGracePeriod,
} from "../../lib/cleanupExpiry";
import { shouldIncludeGoal } from "./readModels";
import {
  dismissChallengeNotifications,
  dismissGoalNotifications,
} from "./notifications";
import { getGoalParticipantIds } from "./participants";

export async function deleteGoalPlayRecordsForGoal(
  ctx: MutationCtx,
  goal: Doc<"weeklyGoals">
) {
  const challenges = await ctx.db
    .query("challenges")
    .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goal._id))
    .collect();

  const challengeIds = challenges.map((challenge) => challenge._id);
  await dismissChallengeNotifications(ctx, getGoalParticipantIds(goal), challengeIds);

  for (const challenge of challenges) {
    await ctx.db.delete(challenge._id);
  }

  const duels = await ctx.db
    .query("duels")
    .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goal._id))
    .collect();
  for (const duel of duels) {
    await ctx.db.delete(duel._id);
  }

  const soloPracticeSessions = await ctx.db
    .query("soloPracticeSessions")
    .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goal._id))
    .collect();
  for (const session of soloPracticeSessions) {
    await ctx.db.delete(session._id);
  }
}

export async function deleteGoalAndRelatedData(
  ctx: MutationCtx,
  goal: Doc<"weeklyGoals">
) {
  await deleteGoalPlayRecordsForGoal(ctx, goal);
  await deleteWeeklyGoalThemeSnapshots(ctx, goal._id);
  await ctx.db.delete(goal._id);
}

export async function closeVisibleGoalsBetweenParticipants(
  ctx: MutationCtx,
  firstUserId: Id<"users">,
  secondUserId: Id<"users">
): Promise<number> {
  const now = Date.now();

  const goalsAsFirstCreator = (
    await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", firstUserId))
      .collect()
  ).filter(
    (goal) =>
      goal.partnerId === secondUserId &&
      shouldIncludeGoal(goal, now)
  );

  const goalsAsSecondCreator = (
    await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", secondUserId))
      .collect()
  ).filter(
    (goal) =>
      goal.partnerId === firstUserId &&
      shouldIncludeGoal(goal, now)
  );

  const seenGoalIds = new Set<string>();
  const visibleGoals = [...goalsAsFirstCreator, ...goalsAsSecondCreator].filter((goal) => {
    const goalId = String(goal._id);
    if (seenGoalIds.has(goalId)) {
      return false;
    }
    seenGoalIds.add(goalId);
    return true;
  });

  for (const goal of visibleGoals) {
    await dismissGoalNotifications(ctx, goal._id);
    await deleteGoalAndRelatedData(ctx, goal);
  }

  return visibleGoals.length;
}

export async function dismissAndDeleteGoals(
  ctx: MutationCtx,
  goals: Doc<"weeklyGoals">[]
) {
  if (goals.length === 0) return;

  const participantIdSet = new Set<Id<"users">>();
  const goalIds: Id<"weeklyGoals">[] = [];
  for (const goal of goals) {
    goalIds.push(goal._id);
    for (const participantId of getGoalParticipantIds(goal)) {
      participantIdSet.add(participantId);
    }
  }

  await dismissWeeklyGoalNotificationsForParticipants(
    ctx,
    Array.from(participantIdSet),
    goalIds
  );

  for (const goal of goals) {
    await deleteGoalAndRelatedData(ctx, goal);
  }
}

export async function runWeeklyGoalRetentionCleanup(ctx: MutationCtx) {
  const now = Date.now();
  const draftCutoff = now - WEEKLY_GOAL_DRAFT_TTL_MS;

  const lockedGoalsPastEndDate = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_status_endDate", (q) =>
      q.eq("status", "locked").lt("endDate", now)
    )
    .collect();

  const gracePeriodGoalsPastGrace = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_status_endDate", (q) =>
      q.eq("status", "grace_period").lt("endDate", now - GRACE_PERIOD_MS)
    )
    .collect();

  const draftGoals = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_status_createdAt", (q) =>
      q.eq("status", "draft").lt("createdAt", draftCutoff)
    )
    .collect();

  const goalsToDelete = [
    ...lockedGoalsPastEndDate.filter((goal) =>
      isGoalPastGracePeriod(goal.endDate, now, GRACE_PERIOD_MS)
    ),
    ...gracePeriodGoalsPastGrace,
    ...draftGoals.filter((goal) =>
      isCreatedAtExpired(goal.createdAt, now, WEEKLY_GOAL_DRAFT_TTL_MS)
    ),
  ];

  const goalsToMoveToGracePeriod = lockedGoalsPastEndDate.filter(
    (goal) => !isGoalPastGracePeriod(goal.endDate, now, GRACE_PERIOD_MS)
  );

  for (const goal of goalsToMoveToGracePeriod) {
    await ctx.db.patch(goal._id, { status: "grace_period" });
  }

  if (goalsToDelete.length === 0) return;

  const seen = new Set<string>();
  const uniqueGoalsToDelete = goalsToDelete.filter((goal) => {
    const key = String(goal._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await dismissAndDeleteGoals(ctx, uniqueGoalsToDelete);
}
