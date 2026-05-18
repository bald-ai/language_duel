import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { advanceUserIfReady } from "./attemptMutations";

export async function completeRepetitionDuel(
  ctx: MutationCtx,
  duel: Doc<"duels">,
  now: number
) {
  if (
    duel.sourceType !== "spaced_repetition" ||
    !duel.weeklyGoalId ||
    typeof duel.spacedRepetitionStep !== "number" ||
    typeof duel.livesRemaining !== "number" ||
    duel.livesRemaining <= 0
  ) {
    console.warn(
      "Skipping spaced repetition duel completion: duel is not a successful SR attempt.",
      {
        duelId: duel._id,
        sourceType: duel.sourceType,
        weeklyGoalId: duel.weeklyGoalId,
        spacedRepetitionStep: duel.spacedRepetitionStep,
        livesRemaining: duel.livesRemaining,
      }
    );
    return;
  }

  const goal = await ctx.db.get(duel.weeklyGoalId);
  if (!goal || goal.status !== "completed") {
    console.warn(
      "Skipping spaced repetition duel completion: goal is missing or not completed.",
      { duelId: duel._id, weeklyGoalId: duel.weeklyGoalId }
    );
    return;
  }

  await advanceUserIfReady({
    ctx,
    goal,
    userId: duel.challengerId,
    completedVia: "duel",
    duelId: duel._id,
    expectedStep: duel.spacedRepetitionStep,
    now,
  });
  await advanceUserIfReady({
    ctx,
    goal,
    userId: duel.opponentId,
    completedVia: "duel",
    duelId: duel._id,
    expectedStep: duel.spacedRepetitionStep,
    now,
  });
}
