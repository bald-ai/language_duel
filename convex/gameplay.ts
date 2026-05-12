/**
 * Gameplay mutations for answering questions, timer management, and countdown controls.
 */

import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getDuelParticipant } from "./helpers/auth";
import {
  HINT_PROVIDER_BONUS,
  TIMEOUT_ANSWER,
} from "./constants";
import { getSessionWords } from "./helpers/sessionWords";
import { completeWeeklyGoalBoss } from "./weeklyGoals";
import { completeRepetitionDuel } from "./weeklyGoalRepetitions";
import { forRole } from "../lib/duelRole";

// ===========================================
// Helper: Clear hint state on question advance
// ===========================================

function getHintClearFields(): Partial<Doc<"duels">> {
  return {
    hintRequestedBy: undefined,
    hintAccepted: undefined,
    eliminatedOptions: undefined,
    questionTimerPausedAt: undefined,
    questionTimerPausedBy: undefined,
    countdownPausedBy: undefined,
    countdownUnpauseRequestedBy: undefined,
    countdownPausedAt: undefined,
    countdownSkipRequestedBy: undefined,
  };
}

function getBossAttemptEndFields(): Partial<Doc<"duels">> {
  return {
    status: "completed",
    questionStartTime: undefined,
    questionTimerPausedAt: undefined,
    questionTimerPausedBy: undefined,
    ...getHintClearFields(),
  };
}

function isBossAttempt(duel: Doc<"duels">): boolean {
  return Boolean(duel.weeklyGoalId && duel.bossType);
}

function isLivesAttempt(duel: Doc<"duels">): boolean {
  return isBossAttempt(duel) || duel.sourceType === "spaced_repetition";
}

function hasBossLivesLeft(duel: Doc<"duels">): boolean {
  if (typeof duel.bossLivesRemaining === "number") {
    return duel.bossLivesRemaining > 0;
  }

  return duel.challengerPerfectRun === true && duel.opponentPerfectRun === true;
}

function getBossMissPatch(
  duel: Doc<"duels">,
  playerRole: "challenger" | "opponent"
): Partial<Doc<"duels">> {
  if (!isLivesAttempt(duel)) {
    return {};
  }

  const nextLives = typeof duel.bossLivesRemaining === "number"
    ? Math.max(0, duel.bossLivesRemaining - 1)
    : undefined;

  const patch: Partial<Doc<"duels">> = playerRole === "challenger"
    ? { challengerPerfectRun: false }
    : { opponentPerfectRun: false };

  if (nextLives === undefined) {
    return patch;
  }

  return {
    ...patch,
    bossLivesRemaining: nextLives,
    ...(nextLives === 0 ? getBossAttemptEndFields() : {}),
  };
}

function getDuelQuestionOrThrow(
  duel: Doc<"duels">,
  questionIndex = duel.currentWordIndex
) {
  const question = duel.duelQuestions?.[questionIndex];
  if (!question) {
    throw new Error("Duel question data is missing");
  }
  return question;
}

function getHintProviderBonusPatch(
  duel: Doc<"duels">
): Partial<Doc<"duels">> {
  if (
    duel.hintAccepted !== true ||
    !duel.hintRequestedBy ||
    (duel.eliminatedOptions?.length || 0) === 0
  ) {
    return {};
  }

  const currentQuestion = getDuelQuestionOrThrow(duel);
  const requesterLastAnswer = duel.hintRequestedBy === "challenger"
    ? duel.challengerLastAnswer
    : duel.opponentLastAnswer;

  if (requesterLastAnswer !== currentQuestion.correctOption) {
    return {};
  }

  if (duel.hintRequestedBy === "challenger") {
    return {
      opponentScore: (duel.opponentScore || 0) + HINT_PROVIDER_BONUS,
    };
  }

  return {
    challengerScore: (duel.challengerScore || 0) + HINT_PROVIDER_BONUS,
  };
}

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
      throw new Error("Duel is not active");
    }

    // Stale answer guard: validate questionIndex matches server state
    if (duel.currentWordIndex !== questionIndex) {
      throw new Error("Stale answer: question has changed");
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
      throw new Error("Duel is not active");
    }

    if (duel.currentWordIndex !== questionIndex) {
      throw new Error("Stale timeout: question has changed");
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
