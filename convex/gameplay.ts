/**
 * Gameplay mutations for answering questions, timer management, and countdown controls.
 */

import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  getDuelParticipant,
  hasPlayerAnswered,
  isDuelChallenging,
  isDuelLearning,
} from "./helpers/auth";
import {
  updateWordStateAfterAnswerSeeded,
  shouldExpandPool,
  expandPoolSeeded,
  pickNextQuestionSeeded,
  updatePlayerStats,
  type WordState,
} from "./helpers/gameLogic";
import { buildSoloInitState } from "./helpers/duelInitialization";
import {
  HINT_PROVIDER_BONUS,
  TIMER_OPTIONS,
  DEFAULT_TIMER_DURATION,
  TIMEOUT_ANSWER,
} from "./constants";
import { getChallengeSessionWords } from "./helpers/sessionWords";
import { completeWeeklyGoalBoss } from "./weeklyGoals";

// ===========================================
// Helper: Clear hint state on question advance
// ===========================================

function getHintClearFields(): Record<string, undefined> {
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

function getSoloHintClearFields(): Record<string, undefined> {
  return {
    soloHintRequestedBy: undefined,
    soloHintAccepted: undefined,
    soloHintRequesterState: undefined,
    soloHintRevealedPositions: undefined,
    soloHintType: undefined,
    soloHintL2RequestedBy: undefined,
    soloHintL2Accepted: undefined,
    soloHintL2WordIndex: undefined,
    soloHintL2Options: undefined,
    soloHintL2EliminatedOptions: undefined,
    soloHintL2Type: undefined,
  };
}

function getBossAttemptEndFields(): Partial<Doc<"challenges">> {
  return {
    status: "completed",
    questionStartTime: undefined,
    questionTimerPausedAt: undefined,
    questionTimerPausedBy: undefined,
    ...getHintClearFields(),
  };
}

function isBossAttempt(duel: Doc<"challenges">): boolean {
  return Boolean(duel.weeklyGoalId && duel.bossType);
}

function hasBossLivesLeft(duel: Doc<"challenges">): boolean {
  if (typeof duel.bossLivesRemaining === "number") {
    return duel.bossLivesRemaining > 0;
  }

  return duel.challengerPerfectRun === true && duel.opponentPerfectRun === true;
}

function getBossMissPatch(
  duel: Doc<"challenges">,
  playerRole: "challenger" | "opponent"
): Partial<Doc<"challenges">> {
  if (!isBossAttempt(duel)) {
    return {};
  }

  const nextLives = typeof duel.bossLivesRemaining === "number"
    ? Math.max(0, duel.bossLivesRemaining - 1)
    : undefined;

  const patch: Partial<Doc<"challenges">> = playerRole === "challenger"
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

function getClassicQuestionOrThrow(
  duel: Doc<"challenges">,
  questionIndex = duel.currentWordIndex
) {
  const question = duel.classicQuestions?.[questionIndex];
  if (!question) {
    throw new Error("Classic question data is missing");
  }
  return question;
}

function getChallengeSeedOrThrow(duel: Doc<"challenges">): number {
  if (!Number.isFinite(duel.seed)) {
    throw new Error("Challenge is missing seed");
  }
  return duel.seed;
}

function getHintProviderBonusPatch(
  duel: Doc<"challenges">
): Partial<Doc<"challenges">> {
  if (
    duel.hintAccepted !== true ||
    !duel.hintRequestedBy ||
    (duel.eliminatedOptions?.length || 0) === 0
  ) {
    return {};
  }

  const currentQuestion = getClassicQuestionOrThrow(duel);
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

async function advanceClassicDuelIfBothAnswered(
  ctx: MutationCtx,
  duelId: Id<"challenges">,
  duel: Doc<"challenges">,
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
// Classic Mode Answer
// ===========================================

export const answerDuel = mutation({
  args: {
    duelId: v.id("challenges"),
    selectedAnswer: v.string(),
    questionIndex: v.number(),
  },
  handler: async (ctx, { duelId, selectedAnswer, questionIndex }) => {
    const { duel, playerRole, isChallenger } = await getDuelParticipant(ctx, duelId);

    // Mode guard: this mutation is for classic mode only
    if (duel.mode !== "classic") {
      throw new Error("Not a classic duel");
    }

    // Check if challenge is active
    const status = duel.status;
    if (status !== "accepted") {
      throw new Error("Challenge is not active");
    }

    // Stale answer guard: validate questionIndex matches server state
    if (duel.currentWordIndex !== questionIndex) {
      throw new Error("Stale answer: question has changed");
    }

    const sessionWords = getChallengeSessionWords(duel);
    const wordCount = sessionWords.length;
    const currentQuestion = getClassicQuestionOrThrow(duel, questionIndex);
    const isCorrect = selectedAnswer === currentQuestion.correctOption;

    // Mark as answered and update scores
    const myAnswered = hasPlayerAnswered(duel, playerRole);
    if (!myAnswered) {
      const myScore = isChallenger ? duel.challengerScore || 0 : duel.opponentScore || 0;
      const newMyScore = isCorrect ? myScore + currentQuestion.points : myScore;

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
    if (updatedDuel && updatedDuel.status === "accepted") {
      await advanceClassicDuelIfBothAnswered(ctx, duelId, updatedDuel, wordCount);
    }
  },
});

export const timeoutAnswer = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole, isChallenger } = await getDuelParticipant(ctx, duelId);

    // Mode guard: this mutation is for classic mode only
    if (duel.mode !== "classic") {
      throw new Error("Not a classic duel");
    }

    const status = duel.status;
    if (status !== "accepted") {
      throw new Error("Challenge is not active");
    }

    // Mark as answered with 0 points (timeout)
    const myAnswered = hasPlayerAnswered(duel, playerRole);
    if (!myAnswered) {
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
    if (updatedDuel && updatedDuel.status === "accepted") {
      const sessionWords = getChallengeSessionWords(updatedDuel);
      await advanceClassicDuelIfBothAnswered(ctx, duelId, updatedDuel, sessionWords.length);
    }
  },
});

// ===========================================
// Countdown Control (Classic Mode)
// ===========================================

export const pauseCountdown = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    // Mode guard: classic mode only
    if (duel.mode !== "classic") {
      throw new Error("Not a classic duel");
    }

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
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    // Mode guard: classic mode only
    if (duel.mode !== "classic") {
      throw new Error("Not a classic duel");
    }

    if (!duel.countdownPausedBy) {
      throw new Error("Countdown is not paused");
    }

    await ctx.db.patch(duelId, {
      countdownUnpauseRequestedBy: playerRole,
    });
  },
});

export const confirmUnpauseCountdown = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    // Mode guard: classic mode only
    if (duel.mode !== "classic") {
      throw new Error("Not a classic duel");
    }

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
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    // Mode guard: classic mode only
    if (duel.mode !== "classic") {
      throw new Error("Not a classic duel");
    }

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

// ===========================================
// Solo-Style Timer Selection
// ===========================================

export const selectLearnTimer = mutation({
  args: {
    duelId: v.id("challenges"),
    duration: v.number(),
  },
  handler: async (ctx, { duelId, duration }) => {
    const { duel, isChallenger } = await getDuelParticipant(ctx, duelId);

    if (!isDuelLearning(duel)) throw new Error("Not in learning phase");
    if (!TIMER_OPTIONS.includes(duration as (typeof TIMER_OPTIONS)[number])) {
      throw new Error("Invalid timer duration");
    }

    const current = duel.learnTimerSelection || {};
    if (isChallenger && current.challengerConfirmed) throw new Error("Already confirmed");
    if (!isChallenger && current.opponentConfirmed) throw new Error("Already confirmed");

    const update = isChallenger
      ? { ...current, challengerSelection: duration }
      : { ...current, opponentSelection: duration };

    await ctx.db.patch(duelId, { learnTimerSelection: update });
  },
});

export const confirmLearnTimer = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, isChallenger } = await getDuelParticipant(ctx, duelId);

    if (!isDuelLearning(duel)) throw new Error("Not in learning phase");

    const current = duel.learnTimerSelection || {};
    const update = isChallenger
      ? { ...current, challengerConfirmed: true }
      : { ...current, opponentConfirmed: true };

    // Check if both confirmed
    const bothConfirmed =
      (isChallenger ? true : current.challengerConfirmed) &&
      (!isChallenger ? true : current.opponentConfirmed);

    if (bothConfirmed) {
      const challengerDuration = current.challengerSelection || DEFAULT_TIMER_DURATION;
      const opponentDuration = current.opponentSelection || DEFAULT_TIMER_DURATION;
      const confirmedDuration = Math.max(challengerDuration, opponentDuration);

      update.confirmedDuration = confirmedDuration;
      update.learnStartTime = Date.now();
    }

    await ctx.db.patch(duelId, { learnTimerSelection: update });
  },
});

export const initializeDuelChallenge = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);

    if (!isDuelLearning(duel)) throw new Error("Not in learning phase");

    // Re-read to handle race conditions
    const freshDuel = await ctx.db.get(duelId);
    if (!freshDuel || freshDuel.status === "challenging") return;

    const sessionWords = getChallengeSessionWords(duel);
    const seed = getChallengeSeedOrThrow(duel);

    const soloState = buildSoloInitState(
      sessionWords.length,
      seed
    );

    await ctx.db.patch(duelId, {
      status: "challenging",
      ...soloState,
    });
  },
});

// ===========================================
// Solo-Style Answer Submission
// ===========================================

export const submitSoloAnswer = mutation({
  args: {
    duelId: v.id("challenges"),
    answer: v.string(),
    questionIndex: v.number(),
  },
  handler: async (ctx, { duelId, answer, questionIndex }) => {
    const { duel, isChallenger } = await getDuelParticipant(ctx, duelId);

    if (!isDuelChallenging(duel)) throw new Error("Not in challenging phase");

    // Get player-specific state
    const wordStates = (isChallenger ? duel.challengerWordStates : duel.opponentWordStates) as
      | WordState[]
      | undefined;
    const activePool = isChallenger ? duel.challengerActivePool : duel.opponentActivePool;
    const remainingPool = isChallenger ? duel.challengerRemainingPool : duel.opponentRemainingPool;
    const currentWordIndex = isChallenger
      ? duel.challengerCurrentWordIndex
      : duel.opponentCurrentWordIndex;
    const currentLevel = isChallenger
      ? duel.challengerCurrentLevel
      : duel.opponentCurrentLevel;
    const stats = isChallenger ? duel.challengerStats : duel.opponentStats;

    if (
      !wordStates ||
      !activePool ||
      currentWordIndex === undefined ||
      currentLevel === undefined ||
      !stats
    ) {
      throw new Error("Player state not initialized");
    }

    // Stale answer guard: validate questionIndex matches player's current word
    if (currentWordIndex !== questionIndex) {
      throw new Error("Stale answer: question has changed");
    }

    const sessionWords = getChallengeSessionWords(duel);
    const currentWord = sessionWords[currentWordIndex];
    if (!currentWord) throw new Error("Word not found");

    const isCorrect = answer === currentWord.answer;

    // Use the stored duel seed so solo progression stays deterministic.
    let seed = getChallengeSeedOrThrow(duel);

    // Find and update word state
    const newWordStates = [...wordStates];
    const wordStateIndex = newWordStates.findIndex((ws) => ws.wordIndex === currentWordIndex);
    if (wordStateIndex === -1) throw new Error("Word state not found");

    const wordStateResult = updateWordStateAfterAnswerSeeded(
      newWordStates[wordStateIndex],
      currentLevel,
      isCorrect,
      seed
    );
    newWordStates[wordStateIndex] = wordStateResult.wordState;
    seed = wordStateResult.newSeed;

    // Update stats
    const newStats = updatePlayerStats(stats, isCorrect);

    // Check pool expansion
    let newActivePool = [...activePool];
    let newRemainingPool = [...(remainingPool || [])];

    if (shouldExpandPool(newActivePool, newWordStates, newRemainingPool)) {
      const expanded = expandPoolSeeded(newActivePool, newRemainingPool, seed);
      newActivePool = expanded.newActivePool;
      newRemainingPool = expanded.newRemainingPool;
      seed = expanded.newSeed;
    }

    // Pick next question
    const nextResult = pickNextQuestionSeeded(newActivePool, newWordStates, currentWordIndex, seed);
    const next = nextResult.result;
    seed = nextResult.newSeed;

    // Build update object
    const update: Partial<Doc<"challenges">> = {
      ...getSoloHintClearFields(),
      seed,
    };

    if (isChallenger) {
      update.challengerWordStates = newWordStates;
      update.challengerActivePool = newActivePool;
      update.challengerRemainingPool = newRemainingPool;
      update.challengerCurrentWordIndex = next.wordIndex;
      update.challengerCurrentLevel = next.level;
      update.challengerLevel2Mode = next.level2Mode;
      update.challengerCompleted = next.isComplete;
      update.challengerStats = newStats;
    } else {
      update.opponentWordStates = newWordStates;
      update.opponentActivePool = newActivePool;
      update.opponentRemainingPool = newRemainingPool;
      update.opponentCurrentWordIndex = next.wordIndex;
      update.opponentCurrentLevel = next.level;
      update.opponentLevel2Mode = next.level2Mode;
      update.opponentCompleted = next.isComplete;
      update.opponentStats = newStats;
    }

    // Check if both players completed
    const otherCompleted = isChallenger ? duel.opponentCompleted : duel.challengerCompleted;
    if (next.isComplete && otherCompleted) {
      update.status = "completed";
    }

    await ctx.db.patch(duelId, update);
  },
});
