import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../helpers/auth";
import { shuffleArray } from "../helpers/gameLogic";
import { loadThemesByIds, summarizeSessionWords } from "../helpers/sessionWords";
import { loadWeeklyGoalSessionThemesByThemeIds } from "../helpers/weeklyGoalSnapshots";
import {
  dismissChallengeNotifications,
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
import {
  getGoalParticipantIds,
  isGoalParticipant,
} from "./participants";

export function getEligibleThemeIdsForBoss(
  goal: Doc<"weeklyGoals">,
  bossType: BossType
): Id<"themes">[] {
  if (bossType === "mini") {
    return goal.themes
      .filter((t) =>
        goal.mode === "solo"
          ? t.creatorCompleted
          : t.creatorCompleted && t.partnerCompleted
      )
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
  if (!isGoalParticipant(goal, user._id)) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
  }

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
  if (goal.mode === "solo") {
    await upsertWeeklyGoalNotificationForGoal(ctx, {
      toUserId: goal.creatorId,
      fromUserId: goal.creatorId,
      goalId: goal._id,
      themeCount: goal.themes.length,
      event: "goal_completed_solo",
      createdAt: now,
    });
    return;
  }

  if (goal.partnerId === undefined) {
    throw new ConvexError({ code: "INVALID_STATE", message: "Shared weekly goal is missing partner data" });
  }

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

export async function handleCompleteBossSoloPractice(
  ctx: MutationCtx,
  soloPracticeSessionId: Id<"soloPracticeSessions">
): Promise<{ completed: boolean }> {
  const { user } = await getAuthenticatedUser(ctx);

  const session = await ctx.db.get(soloPracticeSessionId);
  if (!session) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Solo practice session not found" });
  }
  if (session.userId !== user._id) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
  }
  if (session.sourceType !== "boss" || !session.bossType) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Session is not a boss practice session" });
  }
  if (session.status === "completed") {
    return { completed: false };
  }

  const goal = await ctx.db.get(session.weeklyGoalId);
  if (!goal) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Weekly goal not found" });
  }

  const now = Date.now();
  if (!isGoalPlayable(goal, now)) {
    throw new ConvexError({ code: "INVALID_STATE", message: "This goal is not playable" });
  }

  await ctx.db.patch(soloPracticeSessionId, {
    status: "completed",
    completedAt: now,
  });

  // Solo practice on a shared goal is only a warmup; it must not advance the goal,
  // but the session itself is still marked completed above.
  if (goal.mode !== "solo") {
    return { completed: false };
  }

  if (session.bossType === "mini") {
    await completeMiniBoss(ctx, goal);
  } else {
    await completeBigBoss(ctx, goal);
  }

  return { completed: true };
}

export { summarizeSessionWords };
