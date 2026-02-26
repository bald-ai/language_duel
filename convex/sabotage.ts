/**
 * Sabotage system mutations.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getDuelParticipant, isDuelActive } from "./helpers/auth";
import {
  MAX_SABOTAGES_PER_DUEL,
  SABOTAGE_STICKY_DURATION_MS,
  SABOTAGE_FALLBACK_DURATION_MS,
} from "./constants";

/**
 * Check if a sabotage effect is currently active.
 */
function isSabotageActive(params: {
  sabotage?: { effect: string; timestamp: number };
  now: number;
  questionStartTime?: number;
}): boolean {
  const { sabotage, now, questionStartTime } = params;
  if (!sabotage) return false;

  if (sabotage.effect === "sticky") {
    return now - sabotage.timestamp < SABOTAGE_STICKY_DURATION_MS;
  }

  if (
    sabotage.effect === "bounce" ||
    sabotage.effect === "trampoline" ||
    sabotage.effect === "reverse"
  ) {
    if (typeof questionStartTime === "number") {
      return sabotage.timestamp >= questionStartTime;
    }
    return now - sabotage.timestamp < SABOTAGE_FALLBACK_DURATION_MS;
  }

  return false;
}

export const sendSabotage = mutation({
  args: {
    duelId: v.id("challenges"),
    effect: v.union(
      v.literal("sticky"),
      v.literal("bounce"),
      v.literal("trampoline"),
      v.literal("reverse")
    ),
  },
  handler: async (ctx, { duelId, effect }) => {
    const { duel, isChallenger } = await getDuelParticipant(ctx, duelId);

    if (!isDuelActive(duel)) {
      throw new Error("Challenge is not active");
    }

    // Check sabotage usage limit
    const sabotagesUsed = isChallenger
      ? duel.challengerSabotagesUsed || 0
      : duel.opponentSabotagesUsed || 0;

    if (sabotagesUsed >= MAX_SABOTAGES_PER_DUEL) {
      throw new Error("No sabotages remaining");
    }

    // Check if target already has an active sabotage
    const now = Date.now();
    const targetSabotage = isChallenger
      ? duel.opponentSabotage
      : duel.challengerSabotage;

    const targetHasAnswered = isChallenger
      ? duel.opponentAnswered
      : duel.challengerAnswered;

    if (targetHasAnswered) {
      throw new Error("Opponent has already answered this question");
    }

    if (
      isSabotageActive({
        sabotage: targetSabotage,
        now,
        questionStartTime:
          typeof duel.questionStartTime === "number"
            ? duel.questionStartTime
            : undefined,
      })
    ) {
      throw new Error("A sabotage is already active");
    }

    // Send sabotage to the OTHER player
    if (isChallenger) {
      await ctx.db.patch(duelId, {
        opponentSabotage: { effect, timestamp: now },
        challengerSabotagesUsed: sabotagesUsed + 1,
      });
    } else {
      await ctx.db.patch(duelId, {
        challengerSabotage: { effect, timestamp: now },
        opponentSabotagesUsed: sabotagesUsed + 1,
      });
    }
  },
});
