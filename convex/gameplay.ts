/**
 * Gameplay mutations for answering questions, timer management, and countdown controls.
 */

import { mutation, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getDuelParticipant } from "./helpers/auth";
import { getSessionItems } from "./helpers/sessionItems";
import { completeBigBoss, completeMiniBoss } from "./weeklyGoals/bossWorkflows";
import { completeRepetitionDuel } from "./weeklyGoalRepetitions";
import {
  buildAnswerPatch,
  buildFinalCompletionPatch,
  buildNextRoundPatch,
  buildTimeoutPatch,
  haveBothPlayersAnswered,
  shouldCompleteSpacedRepetitionDuel,
  shouldCompleteWeeklyGoalBoss,
  validateActiveQuestion,
} from "./rules/duelGameplayRules";
import {
  appendSentenceTile,
  removeLastSentenceTile as removeLastSentenceTileRule,
  clearSentenceBoard as clearSentenceBoardRule,
  confirmSentenceRound as confirmSentenceRoundRule,
  buildSentenceAnswerPatch,
  validateTimedOutFlag,
} from "./rules/sentenceGameplayRules";
import { getEffectiveQuestionStartTime } from "../lib/duelTiming";
import { getDuelQuestionOrThrow, requireWordDuelQuestion } from "./rules/duelScoringRules";
import {
  planConfirmUnpauseCountdown,
  planSkipCountdown,
} from "./rules/countdownPlanners";

type DuelLifecycleIntent = {
  completed: boolean;
  completeWeeklyGoalMilestone: boolean;
  completeSpacedRepetition: boolean;
};

const noLifecycleIntent: DuelLifecycleIntent = {
  completed: false,
  completeWeeklyGoalMilestone: false,
  completeSpacedRepetition: false,
};

async function scheduleLifecycleCompletions(
  ctx: MutationCtx,
  duelId: Id<"duels">,
  intent: DuelLifecycleIntent
): Promise<void> {
  if (!intent.completed) return;
  if (intent.completeWeeklyGoalMilestone) {
    await ctx.scheduler.runAfter(0, internal.gameplay.completeWeeklyGoalMilestoneDuelInternal, {
      duelId,
    });
  }
  if (intent.completeSpacedRepetition) {
    await ctx.scheduler.runAfter(0, internal.gameplay.completeSpacedRepetitionDuelInternal, {
      duelId,
    });
  }
}

async function advanceDuelIfBothAnswered(
  ctx: MutationCtx,
  duelId: Id<"duels">,
  duel: Doc<"duels">,
  wordCount: number
): Promise<DuelLifecycleIntent> {
  if (!haveBothPlayersAnswered(duel)) {
    return noLifecycleIntent;
  }

  const nextWordIndex = duel.currentWordIndex + 1;

  if (nextWordIndex >= wordCount) {
    const bossWasDefeated = shouldCompleteWeeklyGoalBoss(duel);

    await ctx.db.patch(duelId, buildFinalCompletionPatch(duel, nextWordIndex));

    const intent: DuelLifecycleIntent = {
      completed: true,
      completeWeeklyGoalMilestone: Boolean(duel.weeklyGoalId && duel.bossType && bossWasDefeated),
      completeSpacedRepetition: shouldCompleteSpacedRepetitionDuel(duel),
    };
    await scheduleLifecycleCompletions(ctx, duelId, intent);
    return intent;
  }

  await ctx.db.patch(duelId, buildNextRoundPatch(duel, nextWordIndex, Date.now()));
  return noLifecycleIntent;
}

/**
 * Shared post-answer tail for `answerDuel` / `timeoutAnswer`: re-read the duel
 * after the patch, then advance it if both players have answered, report the
 * already-completed lifecycle intent, or no-op.
 */
async function finalizeAfterAnswer(
  ctx: MutationCtx,
  duelId: Id<"duels">
): Promise<DuelLifecycleIntent> {
  const updatedDuel = await ctx.db.get(duelId);
  if (!updatedDuel) {
    return noLifecycleIntent;
  }
  if (updatedDuel.status === "active") {
    const wordCount = getSessionItems(updatedDuel).length;
    return await advanceDuelIfBothAnswered(ctx, duelId, updatedDuel, wordCount);
  }
  if (updatedDuel.status === "completed") {
    return {
      completed: true,
      completeWeeklyGoalMilestone: shouldCompleteWeeklyGoalBoss(updatedDuel),
      completeSpacedRepetition: shouldCompleteSpacedRepetitionDuel(updatedDuel),
    };
  }
  return noLifecycleIntent;
}

// ===========================================
// Duel Answer
// ===========================================

export const answerDuel = mutation({
  args: {
    duelId: v.id("duels"),
    selectedAnswer: v.string(),
    questionIndex: v.number(),
  },
  handler: async (ctx, { duelId, selectedAnswer, questionIndex }) => {
    const { duel, playerRole, isChallenger } = await getDuelParticipant(ctx, duelId);

    validateActiveQuestion(
      duel,
      questionIndex,
      "STALE_ANSWER",
      "Stale answer: question has changed"
    );

    const answerPatch = buildAnswerPatch({
      duel,
      playerRole,
      isChallenger,
      selectedAnswer,
      questionIndex,
    });
    if (Object.keys(answerPatch).length > 0) {
      await ctx.db.patch(duelId, answerPatch);
    }

    return await finalizeAfterAnswer(ctx, duelId);
  },
});

export const timeoutAnswer = mutation({
  args: {
    duelId: v.id("duels"),
    questionIndex: v.number(),
  },
  handler: async (ctx, { duelId, questionIndex }) => {
    const { duel, playerRole, isChallenger } = await getDuelParticipant(ctx, duelId);

    validateActiveQuestion(
      duel,
      questionIndex,
      "STALE_TIMEOUT",
      "Stale timeout: question has changed"
    );

    // The word-style timeout patch only applies to word positions. Sentence
    // rounds handle their own timeout via `answerSentenceRound` with
    // `completed: false` — guard so a stale tab can't apply word HP rules to a
    // sentence position.
    requireWordDuelQuestion(duel, questionIndex);

    const timeoutPatch = buildTimeoutPatch({ duel, playerRole, isChallenger });
    if (Object.keys(timeoutPatch).length > 0) {
      await ctx.db.patch(duelId, timeoutPatch);
    }

    return await finalizeAfterAnswer(ctx, duelId);
  },
});

/**
 * Place a tile on a sentence position (build-and-confirm placement, the only
 * sentence model). The server alone tracks the tile sequence in
 * `duel.sentenceProgress`; placement is NOT validated per tap — tiles are
 * appended in any order and the whole sentence is verified later on Confirm.
 * Out-of-bounds / re-taps / over-fill / wrong-kind questions are rejected.
 */
export const tapSentenceTile = mutation({
  args: {
    duelId: v.id("duels"),
    questionIndex: v.number(),
    tileIndex: v.number(),
  },
  handler: async (ctx, { duelId, questionIndex, tileIndex }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    validateActiveQuestion(
      duel,
      questionIndex,
      "STALE_TAP",
      "Stale tap: question has changed"
    );

    const { patch } = appendSentenceTile({ duel, questionIndex, role: playerRole, tileIndex });
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(duelId, patch);
    }
  },
});

/**
 * Peel the most recently placed tile (build-and-confirm, last-only removal).
 * Free — never costs points. No-op when the board is empty / completed.
 */
export const removeLastSentenceTile = mutation({
  args: {
    duelId: v.id("duels"),
    questionIndex: v.number(),
  },
  handler: async (ctx, { duelId, questionIndex }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    validateActiveQuestion(
      duel,
      questionIndex,
      "STALE_TAP",
      "Stale removal: question has changed"
    );

    const { patch } = removeLastSentenceTileRule({ duel, questionIndex, role: playerRole });
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(duelId, patch);
    }
  },
});

/**
 * Clear the whole board (build-and-confirm Reset button). Free — never costs
 * points. No-op when the board is empty / completed.
 */
export const clearSentenceBoard = mutation({
  args: {
    duelId: v.id("duels"),
    questionIndex: v.number(),
  },
  handler: async (ctx, { duelId, questionIndex }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    validateActiveQuestion(
      duel,
      questionIndex,
      "STALE_TAP",
      "Stale reset: question has changed"
    );

    const { patch } = clearSentenceBoardRule({ duel, questionIndex, role: playerRole });
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(duelId, patch);
    }
  },
});

/**
 * Verify the whole built sentence (build-and-confirm validation point). Reads
 * the answer key server-side and returns ONLY a per-position correctness mask
 * — the correct words never leave the server. A correct Confirm flips
 * `completed` (the client then auto-submits via `answerSentenceRound`); a wrong
 * Confirm increments `failedConfirms`.
 */
export const confirmSentenceRound = mutation({
  args: {
    duelId: v.id("duels"),
    questionIndex: v.number(),
  },
  handler: async (ctx, { duelId, questionIndex }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    validateActiveQuestion(
      duel,
      questionIndex,
      "STALE_TAP",
      "Stale confirm: question has changed"
    );

    const { patch, result } = confirmSentenceRoundRule({
      duel,
      questionIndex,
      role: playerRole,
    });
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(duelId, patch);
    }
    return result;
  },
});

/**
 * Finalize a sentence round for the calling player. Reads `completed` and
 * `mistakes` from `duel.sentenceProgress` (server-authoritative) — the client
 * only signals whether this is a normal submit or a timeout. Advances the
 * round once both players have submitted (mirrors `answerDuel`).
 */
export const answerSentenceRound = mutation({
  args: {
    duelId: v.id("duels"),
    questionIndex: v.number(),
    timedOut: v.boolean(),
  },
  handler: async (ctx, { duelId, questionIndex, timedOut }) => {
    const { duel, playerRole, isChallenger } = await getDuelParticipant(ctx, duelId);

    validateActiveQuestion(
      duel,
      questionIndex,
      "STALE_ANSWER",
      "Stale submission: question has changed"
    );

    const question = getDuelQuestionOrThrow(duel, questionIndex);
    if (question.kind !== "sentence") {
      throw new ConvexError({
        code: "WRONG_QUESTION_KIND",
        message: "This duel position is a word round. Use answerDuel instead.",
      });
    }

    validateTimedOutFlag(timedOut);

    const answerPatch = buildSentenceAnswerPatch({
      duel,
      playerRole,
      isChallenger,
      timedOut,
      questionIndex,
    });
    if (Object.keys(answerPatch).length > 0) {
      await ctx.db.patch(duelId, answerPatch);
    }

    return await finalizeAfterAnswer(ctx, duelId);
  },
});

async function runWeeklyGoalMilestoneCompletion(
  ctx: MutationCtx,
  duel: Doc<"duels">
): Promise<{ completed: boolean }> {
  if (
    duel.status !== "completed" ||
    !duel.weeklyGoalId ||
    !duel.bossType ||
    !shouldCompleteWeeklyGoalBoss(duel)
  ) {
    return { completed: false };
  }

  const goal = await ctx.db.get(duel.weeklyGoalId);
  if (!goal) return { completed: false };

  if (duel.bossType === "mini") {
    await completeMiniBoss(ctx, goal);
  } else {
    await completeBigBoss(ctx, goal);
  }
  return { completed: true };
}

async function runSpacedRepetitionCompletion(
  ctx: MutationCtx,
  duel: Doc<"duels">
): Promise<{ completed: boolean }> {
  if (duel.status !== "completed" || !shouldCompleteSpacedRepetitionDuel(duel)) {
    return { completed: false };
  }

  await completeRepetitionDuel(ctx, duel, Date.now());
  return { completed: true };
}

// Public named lifecycle commands (kept for explicit retry/manual recovery).
// Default code path triggers them via the scheduler from the answer flow so
// completion does not depend on the client staying connected.
export const completeWeeklyGoalMilestoneDuel = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);
    return runWeeklyGoalMilestoneCompletion(ctx, duel);
  },
});

export const completeSpacedRepetitionDuel = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);
    return runSpacedRepetitionCompletion(ctx, duel);
  },
});

// Internal lifecycle commands invoked by the scheduler so completion is
// guaranteed even if the answering client closes the tab mid-finalization.
export const completeWeeklyGoalMilestoneDuelInternal = internalMutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const duel = await ctx.db.get(duelId);
    if (!duel) return { completed: false };
    return runWeeklyGoalMilestoneCompletion(ctx, duel);
  },
});

export const completeSpacedRepetitionDuelInternal = internalMutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const duel = await ctx.db.get(duelId);
    if (!duel) return { completed: false };
    return runSpacedRepetitionCompletion(ctx, duel);
  },
});

// ===========================================
// Countdown Control
// ===========================================

export const pauseCountdown = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    if (duel.countdownPausedBy) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Countdown already paused" });
    }

    await ctx.db.patch(duelId, {
      countdownPausedBy: playerRole,
      countdownUnpauseRequestedBy: undefined,
      countdownPausedAt: Date.now(),
    });
  },
});

export const requestUnpauseCountdown = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    if (!duel.countdownPausedBy) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Countdown is not paused" });
    }

    await ctx.db.patch(duelId, {
      countdownUnpauseRequestedBy: playerRole,
    });
  },
});

export const confirmUnpauseCountdown = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    const plan = planConfirmUnpauseCountdown(duel, Date.now());

    if (plan.kind === "noop") return;

    if (plan.kind === "clearImmediately") {
      await ctx.db.patch(duelId, {
        countdownPausedBy: undefined,
        countdownUnpauseRequestedBy: undefined,
        countdownPausedAt: undefined,
        questionStartTime: plan.questionStartTime,
      });
      return;
    }

    // Two-player branch: require a peer to have requested the unpause.
    if (!duel.countdownUnpauseRequestedBy) {
      return;
    }
    if (duel.countdownUnpauseRequestedBy === playerRole) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Cannot confirm your own unpause request" });
    }

    const pauseDuration = duel.countdownPausedAt ? Date.now() - duel.countdownPausedAt : 0;
    const newQuestionStartTime = duel.questionStartTime
      ? duel.questionStartTime + pauseDuration
      : undefined;

    await ctx.db.patch(duelId, {
      countdownPausedBy: undefined,
      countdownUnpauseRequestedBy: undefined,
      countdownPausedAt: undefined,
      questionStartTime: newQuestionStartTime,
    });
  },
});

export const skipCountdown = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    if (duel.countdownPausedBy) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Cannot skip while countdown is paused" });
    }

    const plan = planSkipCountdown(duel, playerRole);
    if (plan.alreadyRequested) {
      return { bothSkipped: false };
    }

    const patch: Partial<Doc<"duels">> = {
      countdownSkipRequestedBy: plan.skipRequestedBy,
    };

    // When both players skip, collapse the unspent transition time onto the
    // question anchor. The next question's timer is offset by the full fixed
    // transition (`getEffectiveQuestionStartTime`); without this, skipping early
    // makes the question appear immediately while its timer behaves as if the
    // whole countdown had elapsed, handing the skippers extra question time. The
    // `> 0` guard means an already-active question is never shortened.
    if (plan.bothSkipped && typeof duel.questionStartTime === "number") {
      const effectiveStart = getEffectiveQuestionStartTime(
        duel.questionStartTime,
        duel.currentWordIndex
      );
      const unspentTransitionMs = effectiveStart - Date.now();
      if (unspentTransitionMs > 0) {
        patch.questionStartTime = duel.questionStartTime - unspentTransitionMs;
      }
    }

    await ctx.db.patch(duelId, patch);

    return { bothSkipped: plan.bothSkipped };
  },
});
