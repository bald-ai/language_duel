/**
 * Hint system mutations for duels.
 */

import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import {
  getDuelParticipant,
  getOtherRole,
  hasPlayerAnswered,
} from "./helpers/auth";
import {
  HINT_TIME_BONUS_MS,
} from "./constants";
import { PVP_HINT_ELIMINATION_PICKS } from "../lib/hints/constants";
import { assertDuelMode } from "./rules/duelModeGuards";

// ===========================================
// Duel Hint System
// ===========================================

export const requestHint = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "pvp", "requestHint");
    const otherRole = getOtherRole(playerRole);

    if (duel.status !== "active") {
      throw new ConvexError({ code: "DUEL_NOT_ACTIVE", message: "Duel is not active" });
    }

    const hasAnswered = hasPlayerAnswered(duel, playerRole);
    const opponentHasAnswered = hasPlayerAnswered(duel, otherRole);

    // Can only request hint if: you haven't answered, opponent has answered, no hint already requested
    if (hasAnswered) throw new ConvexError({ code: "INVALID_STATE", message: "You already answered" });
    if (!opponentHasAnswered) throw new ConvexError({ code: "OPPONENT_NOT_ANSWERED", message: "Opponent hasn't answered yet" });
    if (duel.hintRequestedBy) throw new ConvexError({ code: "HINT_ALREADY_REQUESTED", message: "Hint already requested" });

    await ctx.db.patch(duelId, { hintRequestedBy: playerRole });
  },
});

export const acceptHint = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "pvp", "acceptHint");
    const otherRole = getOtherRole(playerRole);

    if (duel.status !== "active") {
      throw new ConvexError({ code: "DUEL_NOT_ACTIVE", message: "Duel is not active" });
    }

    // Can only accept hint if: you have answered and the OTHER player requested a hint
    const hasAnswered = hasPlayerAnswered(duel, playerRole);
    if (!hasAnswered) throw new ConvexError({ code: "INVALID_STATE", message: "You haven't answered yet" });

    // Check that the other player requested a hint
    if (duel.hintRequestedBy !== otherRole) throw new ConvexError({ code: "INVALID_STATE", message: "No hint request from opponent" });
    if (duel.hintAccepted) throw new ConvexError({ code: "INVALID_STATE", message: "Hint already accepted" });

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
    assertDuelMode(duel, "pvp", "eliminateOption");
    const otherRole = getOtherRole(playerRole);

    if (duel.status !== "active") {
      throw new ConvexError({ code: "DUEL_NOT_ACTIVE", message: "Duel is not active" });
    }

    // Hint provider is the one who DIDN'T request the hint
    if (duel.hintRequestedBy !== otherRole) throw new ConvexError({ code: "INVALID_STATE", message: "You are not the hint provider" });
    if (!duel.hintAccepted) throw new ConvexError({ code: "HINT_NOT_ACCEPTED", message: "Hint not accepted yet" });

    const currentQuestion = duel.duelQuestions?.[duel.currentWordIndex];
    if (!currentQuestion) {
      throw new ConvexError({ code: "INTERNAL_ERROR", message: "Duel question data is missing" });
    }

    if (!currentQuestion.options.includes(option)) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid option" });
    }

    if (option === currentQuestion.correctOption) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Cannot eliminate the correct answer" });
    }

    const currentEliminated = duel.eliminatedOptions || [];
    if (currentEliminated.includes(option)) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Option already eliminated" });
    }
    if (currentEliminated.length >= PVP_HINT_ELIMINATION_PICKS) {
      throw new ConvexError({ code: "LIMIT_REACHED", message: `Maximum ${PVP_HINT_ELIMINATION_PICKS} options can be eliminated` });
    }

    const nextEliminated = [...currentEliminated, option];
    const update: Record<string, unknown> = {
      eliminatedOptions: nextEliminated,
    };

    // When both eliminations are provided, resume the question timer
    if (nextEliminated.length >= PVP_HINT_ELIMINATION_PICKS) {
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
