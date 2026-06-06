import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { DuelMode } from "../../lib/duelMode";
import { getAuthenticatedUser } from "../helpers/auth";
import { shuffleArray } from "../helpers/shuffle";
import { loadThemesByIds, summarizeSessionItems } from "../helpers/sessionItems";
import { loadWeeklyGoalSessionThemesByThemeIds } from "../helpers/weeklyGoalSnapshots";
import { buildChallengeInvite, buildSoloPracticeSession } from "../helpers/sessionCreation";
import { assertRelayUnavailable, assertTbtUnavailable } from "../rules/duelModeGuards";
import {
  dismissChallengeNotifications,
} from "./notifications";
import {
  createChallengeInviteNotificationAndEmail,
  upsertWeeklyGoalNotificationForGoal,
} from "../notificationHelpers";
import { buildSessionItems } from "../../lib/sessionItems";
import {
  getEffectiveBigBossStatus,
  getEffectiveMiniBossStatus,
  isGoalPlayable,
  isGoalThemeCompleted,
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
      .filter((t) => isGoalThemeCompleted(t, goal.mode))
      .map((t) => t.themeId);
  }
  return goal.themes.map((t) => t.themeId);
}

export function buildBossSessionItems(themes: Awaited<ReturnType<typeof loadThemesByIds>>) {
  const fullSessionItems = buildSessionItems(themes);

  if (fullSessionItems.length === 0) {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "No boss practice items are available for this goal" });
  }

  return shuffleArray(fullSessionItems);
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
  if (themes.length === 0) {
    throw new ConvexError({
      code: "INVALID_STATE",
      message: "This goal has no themes to practice.",
    });
  }
  const sessionItems = buildBossSessionItems(themes);
  return { user, goal, isCreator, now, sessionItems };
}

export async function handleCreateBossChallenge(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  bossType: "mini" | "big",
  duelMode: DuelMode
) {
  assertRelayUnavailable(duelMode, "boss duels");
  assertTbtUnavailable(duelMode, "boss duels");

  const { user, goal, isCreator, now, sessionItems } =
    await validateAndPrepareBoss(ctx, goalId, bossType);

  if (goal.mode === "solo") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Solo goals do not support boss duels" });
  }

  const existingGoalChallenges = await ctx.db
    .query("challenges")
    .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goalId))
    .collect();
  const existingGoalDuels = await ctx.db
    .query("duels")
    .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", goalId))
    .collect();

  const duplicateAttempt = existingGoalChallenges.find(
    (challenge) =>
      challenge.bossType === bossType &&
      challenge.status === "pending"
  ) || existingGoalDuels.find(
    (duel) =>
      duel.bossType === bossType &&
      duel.status === "active"
  );
  if (duplicateAttempt) {
    throw new ConvexError({ code: "INVALID_STATE", message: "A boss attempt is already in progress" });
  }

  const opponentId = isCreator ? goal.partnerId : goal.creatorId;
  if (opponentId === undefined) {
    throw new ConvexError({ code: "INVALID_STATE", message: "Shared weekly goal is missing partner data" });
  }
  const opponent = await ctx.db.get(opponentId);
  if (!opponent) {
    throw new ConvexError({ code: "NOT_FOUND", message: "This partner is no longer available. You can still practice solo." });
  }
  const challengeInvite = buildChallengeInvite({
    challengerId: user._id,
    opponentId,
    themeIds: getEligibleThemeIdsForBoss(goal, bossType),
    sourceType: "boss",
    weeklyGoalId: goalId,
    bossType,
    duelMode,
    createdAt: now,
  });

  const challengeId = await ctx.db.insert("challenges", {
    ...challengeInvite,
  });

  await createChallengeInviteNotificationAndEmail(ctx, {
    challengerId: user._id,
    opponentId,
    challengeId,
    themeName: `${getBossLabel(bossType)}: ${summarizeSessionItems(sessionItems)}`,
    duelDifficultyPreset: challengeInvite.duelDifficultyPreset,
    duelMode: challengeInvite.duelMode,
    createdAt: now,
  });

  return challengeId;
}

export async function handleStartBossSoloPractice(
  ctx: MutationCtx,
  goalId: Id<"weeklyGoals">,
  bossType: "mini" | "big"
) {
  const { user, now, sessionItems } =
    await validateAndPrepareBoss(ctx, goalId, bossType);

  return await ctx.db.insert("soloPracticeSessions", buildSoloPracticeSession({
    userId: user._id,
    sessionItems,
    sourceType: "boss",
    weeklyGoalId: goalId,
    bossType,
    startsInLearning: true,
    createdAt: now,
  }));
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

export { summarizeSessionItems };
