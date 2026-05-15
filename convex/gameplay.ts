/**
 * Gameplay mutations for answering questions, timer management, and countdown controls.
 */

import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getDuelParticipant } from "./helpers/auth";
import { getSessionWords } from "./helpers/sessionWords";
import { completeWeeklyGoalBoss } from "./weeklyGoals";
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

async function advanceDuelIfBothAnswered(
  ctx: MutationCtx,
  duelId: Id<"duels">,
  duel: Doc<"duels">,
  wordCount: number
): Promise<void> {
  if (!haveBothPlayersAnswered(duel)) {
    return;
  }

  const nextWordIndex = duel.currentWordIndex + 1;

  if (nextWordIndex >= wordCount) {
    const bossWasDefeated = shouldCompleteWeeklyGoalBoss(duel);

    await ctx.db.patch(duelId, buildFinalCompletionPatch(duel, nextWordIndex));

    if (duel.weeklyGoalId && duel.bossType && bossWasDefeated) {
      const goal = await ctx.db.get(duel.weeklyGoalId);

      if (goal) {
        await completeWeeklyGoalBoss(ctx, goal, duel.bossType);
      }
    }
    if (shouldCompleteSpacedRepetitionDuel(duel)) {
      await completeRepetitionDuel(ctx, duel, Date.now());
    }
    return;
  }

  await ctx.db.patch(duelId, buildNextRoundPatch(duel, nextWordIndex, Date.now()));
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

    const sessionWords = getSessionWords(duel);
    const wordCount = sessionWords.length;
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

    // Check if both answered, then advance
    const updatedDuel = await ctx.db.get(duelId);
    if (updatedDuel && updatedDuel.status === "active") {
      await advanceDuelIfBothAnswered(ctx, duelId, updatedDuel, wordCount);
    }
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

    const timeoutPatch = buildTimeoutPatch({ duel, playerRole, isChallenger });
    if (Object.keys(timeoutPatch).length > 0) {
      await ctx.db.patch(duelId, timeoutPatch);
    }

    // Check if both answered, then advance
    const updatedDuel = await ctx.db.get(duelId);
    if (updatedDuel && updatedDuel.status === "active") {
      const sessionWords = getSessionWords(updatedDuel);
      await advanceDuelIfBothAnswered(ctx, duelId, updatedDuel, sessionWords.length);
    }
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
      throw new Error("Countdown already paused");
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
      throw new Error("Countdown is not paused");
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

    // Idempotency: if the request was already confirmed (or cleared), just no-op.
    if (!duel.countdownUnpauseRequestedBy) {
      return;
    }

    if (duel.countdownUnpauseRequestedBy === playerRole) {
      throw new Error("Cannot confirm your own unpause request");
    }

    // Calculate pause duration and adjust questionStartTime
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
      throw new Error("Cannot skip while countdown is paused");
    }

    const currentSkips = duel.countdownSkipRequestedBy || [];

    if (currentSkips.includes(playerRole)) {
      return { bothSkipped: false };
    }

    const newSkips = [...currentSkips, playerRole] as ("challenger" | "opponent")[];
    const bothSkipped = newSkips.includes("challenger") && newSkips.includes("opponent");

    await ctx.db.patch(duelId, {
      countdownSkipRequestedBy: newSkips,
    });

    return { bothSkipped };
  },
});
