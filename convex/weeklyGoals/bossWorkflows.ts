import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../helpers/auth";
import { shuffleArray } from "../helpers/gameLogic";
import { loadThemesByIds, summarizeSessionWords } from "../helpers/sessionWords";
import { loadWeeklyGoalSessionThemesByThemeIds } from "../helpers/weeklyGoalSnapshots";
import {
  dismissChallengeNotifications,
  getGoalParticipantIds,
} from "./notifications";
import {
  upsertWeeklyGoalNotificationForGoal,
} from "../notificationHelpers";
import { buildSessionWords } from "../../lib/sessionWords";
import {
  getEffectiveBigBossStatus,
  getEffectiveMiniBossStatus,
  isGoalPlayable,
} from "../../lib/weeklyGoals";
import { ensureRepetitionRecordsForCompletedGoal } from "../weeklyGoalRepetitions";
import type { BossType } from "./types";

export function getEligibleThemeIdsForBoss(
  goal: Doc<"weeklyGoals">,
  bossType: BossType
): Id<"themes">[] {
  if (bossType === "mini") {
    return goal.themes
      .filter((t) => t.creatorCompleted && t.partnerCompleted)
      .map((t) => t.themeId);
  }
  return goal.themes.map((t) => t.themeId);
}

export function buildBossSessionWords(themes: Awaited<ReturnType<typeof loadThemesByIds>>) {
  const fullSessionWords = buildSessionWords(themes);

  if (fullSessionWords.length === 0) {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "No boss words are available for this goal" });
  }

  return shuffleArray(fullSessionWords);
}

export async function loadGoalThemesForBoss(
  ctx: MutationCtx,
  goal: Doc<"weeklyGoals">,
  bossType: BossType
) {
  const eligibleThemeIds = getEligibleThemeIdsForBoss(goal, bossType);
  return loadWeeklyGoalSessionThemesByThemeIds(ctx, goal, eligibleThemeIds);
}

export async function validateAndPrepareBoss(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  bossType: BossType
) {
  const { user } = await getAuthenticatedUser(ctx);
  const goal = await ctx.db.get(goalId);

  if (!goal) throw new ConvexError({ code: "NOT_FOUND", message: "Goal not found" });

  const isCreator = goal.creatorId === user._id;
  const isPartner = goal.partnerId === user._id;
  if (!isCreator && !isPartner) throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });

  const now = Date.now();
  if (!isGoalPlayable(goal, now)) {
    throw new ConvexError({ code: "INVALID_STATE", message: "This goal is not playable" });
  }

  const effectiveStatus = bossType === "mini"
    ? getEffectiveMiniBossStatus(goal, now)
    : getEffectiveBigBossStatus(goal, now);

  if (effectiveStatus !== "ready") {
    throw new ConvexError({ code: "INVALID_STATE", message: "This boss is not ready yet" });
  }

  const themes = await loadGoalThemesForBoss(ctx, goal, bossType);
  const sessionWords = buildBossSessionWords(themes);
  return { user, goal, isCreator, now, sessionWords };
}

export async function completeMiniBoss(
  ctx: MutationCtx,
  goal: Doc<"weeklyGoals">
) {
  if (getEffectiveMiniBossStatus(goal, Date.now()) === "defeated") return;
  await ctx.db.patch(goal._id, { miniBossStatus: "defeated" });
}

export async function completeBigBoss(
  ctx: MutationCtx,
  goal: Doc<"weeklyGoals">
) {
  if (getEffectiveBigBossStatus(goal, Date.now()) === "defeated" && goal.status === "completed") {
    return;
  }

  const now = Date.now();
  await ctx.db.patch(goal._id, {
    bigBossStatus: "defeated",
    status: "completed",
    completedAt: now,
  });

  await ensureRepetitionRecordsForCompletedGoal(ctx, goal, now);

  const participants = getGoalParticipantIds(goal);
  await upsertWeeklyGoalNotificationForGoal(ctx, {
    toUserId: goal.creatorId,
    fromUserId: goal.partnerId,
    goalId: goal._id,
    themeCount: goal.themes.length,
    event: "goal_completed",
    createdAt: now,
  });
  await upsertWeeklyGoalNotificationForGoal(ctx, {
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

export function getBossLabel(bossType: BossType): string {
  return bossType === "mini" ? "Mini Boss" : "Big Boss";
}

export { summarizeSessionWords };
