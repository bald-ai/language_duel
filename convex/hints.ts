/**
 * Hint system mutations for duels.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getDuelParticipant,
  getOtherRole,
  hasPlayerAnswered,
} from "./helpers/auth";
import {
  HINT_TIME_BONUS_MS,
  MAX_ELIMINATED_OPTIONS_DUEL,
} from "./constants";

// ===========================================
// Duel Hint System
// ===========================================

export const requestHint = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const otherRole = getOtherRole(playerRole);

    if (duel.status !== "active") {
      throw new Error("Duel is not active");
    }

    const hasAnswered = hasPlayerAnswered(duel, playerRole);
    const opponentHasAnswered = hasPlayerAnswered(duel, otherRole);

    // Can only request hint if: you haven't answered, opponent has answered, no hint already requested
    if (hasAnswered) throw new Error("You already answered");
    if (!opponentHasAnswered) throw new Error("Opponent hasn't answered yet");
    if (duel.hintRequestedBy) throw new Error("Hint already requested");

    await ctx.db.patch(duelId, { hintRequestedBy: playerRole });
  },
});

export const acceptHint = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const otherRole = getOtherRole(playerRole);

    if (duel.status !== "active") {
      throw new Error("Duel is not active");
    }

    // Can only accept hint if: you have answered and the OTHER player requested a hint
    const hasAnswered = hasPlayerAnswered(duel, playerRole);
    if (!hasAnswered) throw new Error("You haven't answered yet");

    // Check that the other player requested a hint
    if (duel.hintRequestedBy !== otherRole) throw new Error("No hint request from opponent");
    if (duel.hintAccepted) throw new Error("Hint already accepted");

    const now = Date.now();
    const currentStart =
      typeof duel.questionStartTime === "number" ? duel.questionStartTime : now;
    // Add time bonus by shifting start time forward
    const bumpedStart = currentStart + HINT_TIME_BONUS_MS;

    await ctx.db.patch(duelId, {
      hintAccepted: true,
      eliminatedOptions: [],
      // Pause the question timer while hint is being provided
      questionTimerPausedAt: now,
      questionTimerPausedBy: playerRole,
      // Give requester time bonus
      questionStartTime: bumpedStart,
    });
  },
});

export const eliminateOption = mutation({
  args: {
    duelId: v.id("duels"),
    option: v.string(),
  },
  handler: async (ctx, { duelId, option }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const otherRole = getOtherRole(playerRole);

    if (duel.status !== "active") {
      throw new Error("Duel is not active");
    }

    // Hint provider is the one who DIDN'T request the hint
    if (duel.hintRequestedBy !== otherRole) throw new Error("You are not the hint provider");
    if (!duel.hintAccepted) throw new Error("Hint not accepted yet");

    const currentQuestion = duel.duelQuestions?.[duel.currentWordIndex];
    if (!currentQuestion) {
      throw new Error("Duel question data is missing");
    }

    if (!currentQuestion.options.includes(option)) {
      throw new Error("Invalid option");
    }

    if (option === currentQuestion.correctOption) {
      throw new Error("Cannot eliminate the correct answer");
    }

    const currentEliminated = duel.eliminatedOptions || [];
    if (currentEliminated.includes(option)) {
      throw new Error("Option already eliminated");
    }
    if (currentEliminated.length >= MAX_ELIMINATED_OPTIONS_DUEL) {
      throw new Error(`Maximum ${MAX_ELIMINATED_OPTIONS_DUEL} options can be eliminated`);
    }

    const nextEliminated = [...currentEliminated, option];
    const update: Record<string, unknown> = {
      eliminatedOptions: nextEliminated,
    };

    // When both eliminations are provided, resume the question timer
    if (nextEliminated.length >= MAX_ELIMINATED_OPTIONS_DUEL) {
      const pausedAt =
        typeof duel.questionTimerPausedAt === "number" ? duel.questionTimerPausedAt : undefined;
      const pauseDuration = pausedAt ? Date.now() - pausedAt : 0;
      if (typeof duel.questionStartTime === "number") {
        update.questionStartTime = duel.questionStartTime + pauseDuration;
      }
      update.questionTimerPausedAt = undefined;
      update.questionTimerPausedBy = undefined;
    }

    await ctx.db.patch(duelId, update);
  },
});
