import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { DuelMode } from "../../lib/duelMode";
import { getAuthenticatedUser } from "../helpers/auth";
import { buildChallengeInvite } from "../helpers/sessionCreation";
import { assertRelayUnavailable } from "../rules/duelModeGuards";
import { createChallengeInviteNotificationAndEmail } from "../notificationHelpers";
import { SPACED_REPETITION_TOTAL_STEPS } from "../../lib/spacedRepetition";
import { loadReadyRepetitionContext } from "./attemptMutations";
import { getGoalPartnerIdForViewer } from "./rules";

export async function createRepetitionChallengeForCurrentUser(
  ctx: MutationCtx,
  weeklyGoalId: Id<"weeklyGoals">,
  duelMode: DuelMode
): Promise<Id<"challenges">> {
  assertRelayUnavailable(duelMode, "spaced repetition duels");

  const { user } = await getAuthenticatedUser(ctx);
  const now = Date.now();
  const { goal, content, step } = await loadReadyRepetitionContext({
    ctx,
    weeklyGoalId,
    userId: user._id,
    now,
  });

  await assertNoDuplicateAttemptInFlight(ctx, weeklyGoalId, step);

  if (goal.mode === "solo") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Solo goals cannot run SR duels" });
  }

  const opponentId = getGoalPartnerIdForViewer(goal, user._id);
  if (opponentId === undefined) {
    throw new ConvexError({ code: "INVALID_STATE", message: "Shared weekly goal is missing partner data" });
  }
  const opponent = await ctx.db.get(opponentId);
  if (!opponent) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message:
        "This partner is no longer available. You can still practice solo.",
    });
  }

  const challengeInvite = buildChallengeInvite({
    challengerId: user._id,
    opponentId,
    themeIds: goal.themes.map((theme) => theme.themeId),
    sourceType: "spaced_repetition",
    weeklyGoalId,
    spacedRepetitionStep: step,
    duelMode,
    createdAt: now,
  });
  const challengeId = await ctx.db.insert("challenges", { ...challengeInvite });

  await createChallengeInviteNotificationAndEmail(ctx, {
    challengerId: user._id,
    opponentId,
    challengeId,
    themeName: `Spaced Repetition ${step}/${SPACED_REPETITION_TOTAL_STEPS}: ${content.themeSummary}`,
    duelDifficultyPreset: challengeInvite.duelDifficultyPreset,
    duelMode: challengeInvite.duelMode,
    createdAt: now,
  });

  return challengeId;
}

async function assertNoDuplicateAttemptInFlight(
  ctx: MutationCtx,
  weeklyGoalId: Id<"weeklyGoals">,
  step: number
) {
  const activeAttempts = await ctx.db
    .query("challenges")
    .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", weeklyGoalId))
    .collect();
  const activeDuels = await ctx.db
    .query("duels")
    .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", weeklyGoalId))
    .collect();
  const duplicateAttempt =
    activeAttempts.find(
      (challenge) =>
        challenge.sourceType === "spaced_repetition" &&
        challenge.spacedRepetitionStep === step &&
        challenge.status === "pending"
    ) ||
    activeDuels.find(
      (duel) =>
        duel.sourceType === "spaced_repetition" &&
        duel.spacedRepetitionStep === step &&
        duel.status === "active"
    );
  if (duplicateAttempt) {
    throw new ConvexError({
      code: "INVALID_STATE",
      message: "A spaced repetition duel is already in progress.",
    });
  }
}
