/**
 * Gameplay mutations for answering questions, timer management, and countdown controls.
 */

import { mutation, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getDuelParticipant } from "./helpers/auth";
import { getSessionWords } from "./helpers/sessionWords";
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
      return await advanceDuelIfBothAnswered(ctx, duelId, updatedDuel, wordCount);
    }
    if (updatedDuel && updatedDuel.status === "completed") {
      return {
        completed: true,
        completeWeeklyGoalMilestone: shouldCompleteWeeklyGoalBoss(updatedDuel),
        completeSpacedRepetition: shouldCompleteSpacedRepetitionDuel(updatedDuel),
      };
    }
    return noLifecycleIntent;
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
      return await advanceDuelIfBothAnswered(ctx, duelId, updatedDuel, sessionWords.length);
    }
    if (updatedDuel && updatedDuel.status === "completed") {
      return {
        completed: true,
        completeWeeklyGoalMilestone: shouldCompleteWeeklyGoalBoss(updatedDuel),
        completeSpacedRepetition: shouldCompleteSpacedRepetitionDuel(updatedDuel),
      };
    }
    return noLifecycleIntent;
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

    // Idempotency: if the request was already confirmed (or cleared), just no-op.
    if (!duel.countdownUnpauseRequestedBy) {
      return;
    }

    if (duel.countdownUnpauseRequestedBy === playerRole) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Cannot confirm your own unpause request" });
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
      throw new ConvexError({ code: "INVALID_STATE", message: "Cannot skip while countdown is paused" });
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
