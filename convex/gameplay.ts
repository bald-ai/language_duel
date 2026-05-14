/**
 * Gameplay mutations for answering questions, timer management, and countdown controls.
 */

import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getDuelParticipant } from "./helpers/auth";
import {
  TIMEOUT_ANSWER,
} from "./constants";
import { getSessionWords } from "./helpers/sessionWords";
import { completeWeeklyGoalBoss } from "./weeklyGoals";
import { completeRepetitionDuel } from "./weeklyGoalRepetitions";
import { forRole } from "../lib/duelRole";
import {
  getBossMissPatch,
  getDuelQuestionOrThrow,
  getHintClearFields,
  getHintProviderBonusPatch,
  hasBossLivesLeft,
  isBossAttempt,
} from "./rules/duelScoringRules";

async function advanceDuelIfBothAnswered(
  ctx: MutationCtx,
  duelId: Id<"duels">,
  duel: Doc<"duels">,
  wordCount: number
): Promise<void> {
  if (!duel.challengerAnswered || !duel.opponentAnswered) {
    return;
  }

  const nextWordIndex = duel.currentWordIndex + 1;
  const hintProviderBonusPatch = getHintProviderBonusPatch(duel);

  if (nextWordIndex >= wordCount) {
    const bossWasDefeated = isBossAttempt(duel) && hasBossLivesLeft(duel);

    await ctx.db.patch(duelId, {
      ...hintProviderBonusPatch,
      status: "completed",
      currentWordIndex: nextWordIndex,
      challengerAnswered: false,
      opponentAnswered: false,
      questionStartTime: undefined,
      ...getHintClearFields(),
    });

    if (duel.weeklyGoalId && duel.bossType && bossWasDefeated) {
      const goal = await ctx.db.get(duel.weeklyGoalId);

      if (goal) {
        await completeWeeklyGoalBoss(ctx, goal, duel.bossType);
      }
    }
    if (duel.sourceType === "spaced_repetition") {
      await completeRepetitionDuel(ctx, duel, Date.now());
    }
    return;
  }

  await ctx.db.patch(duelId, {
    ...hintProviderBonusPatch,
    currentWordIndex: nextWordIndex,
    challengerAnswered: false,
    opponentAnswered: false,
    questionStartTime: Date.now(),
    ...getHintClearFields(),
  });
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

    if (duel.status !== "active") {
      throw new ConvexError({
        code: "DUEL_NOT_ACTIVE",
        message: "Duel is not active",
      });
    }

    // Stale answer guard: validate questionIndex matches server state
    if (duel.currentWordIndex !== questionIndex) {
      throw new ConvexError({
        code: "STALE_ANSWER",
        message: "Stale answer: question has changed",
      });
    }

    const sessionWords = getSessionWords(duel);
    const wordCount = sessionWords.length;
    const currentQuestion = getDuelQuestionOrThrow(duel, questionIndex);
    const isCorrect = selectedAnswer === currentQuestion.correctOption;
    const roleView = forRole(duel, playerRole);

    // Mark as answered and update scores
    if (!roleView.myAnswered) {
      const newMyScore = isCorrect
        ? roleView.myScore + currentQuestion.points
        : roleView.myScore;

      if (isChallenger) {
        await ctx.db.patch(duelId, {
          challengerAnswered: true,
          challengerScore: newMyScore,
          challengerLastAnswer: selectedAnswer,
          ...(!isCorrect ? getBossMissPatch(duel, "challenger") : {}),
        });
      } else {
        await ctx.db.patch(duelId, {
          opponentAnswered: true,
          opponentScore: newMyScore,
          opponentLastAnswer: selectedAnswer,
          ...(!isCorrect ? getBossMissPatch(duel, "opponent") : {}),
        });
      }
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

    if (duel.status !== "active") {
      throw new ConvexError({
        code: "DUEL_NOT_ACTIVE",
        message: "Duel is not active",
      });
    }

    if (duel.currentWordIndex !== questionIndex) {
      throw new ConvexError({
        code: "STALE_TIMEOUT",
        message: "Stale timeout: question has changed",
      });
    }

    const roleView = forRole(duel, playerRole);

    // Mark as answered with 0 points (timeout)
    if (!roleView.myAnswered) {
      if (isChallenger) {
        await ctx.db.patch(duelId, {
          challengerAnswered: true,
          challengerLastAnswer: TIMEOUT_ANSWER,
          ...getBossMissPatch(duel, "challenger"),
        });
      } else {
        await ctx.db.patch(duelId, {
          opponentAnswered: true,
          opponentLastAnswer: TIMEOUT_ANSWER,
          ...getBossMissPatch(duel, "opponent"),
        });
      }
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
