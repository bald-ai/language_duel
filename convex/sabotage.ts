/**
 * Sabotage system mutations.
 */

import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getDuelParticipant, isDuelActive } from "./helpers/auth";
import { forRole } from "../lib/duelRole";
import { MAX_SABOTAGES } from "../lib/sabotage/constants";
import { assertDuelMode } from "./rules/duelModeGuards";
import { sabotageEffectValidator } from "./schema";

export const sendSabotage = mutation({
  args: {
    duelId: v.id("duels"),
    effect: sabotageEffectValidator,
  },
  handler: async (ctx, { duelId, effect }) => {
    const { duel, playerRole, isChallenger } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "pvp", "sendSabotage");

    if (!isDuelActive(duel)) {
      throw new ConvexError({ code: "DUEL_NOT_ACTIVE", message: "Duel is not active" });
    }

    // A sabotage only has meaning against a live question. Movement effects are
    // bound to the in-flight question, so with no question started there is
    // nothing to target. Enforce the contract explicitly instead of silently
    // allowing a no-op send that could overwrite an existing effect.
    if (typeof duel.questionStartTime !== "number") {
      throw new ConvexError({ code: "INVALID_STATE", message: "No active question to sabotage" });
    }

    // Sabotages don't apply to sentence rounds in v1 (plan decision: mixed
    // session behavior). Reject the mutation early so a malformed effect can't
    // target a sentence tile-builder board.
    const currentQuestion = duel.duelQuestions?.[duel.currentWordIndex];
    if (currentQuestion?.kind === "sentence") {
      throw new ConvexError({
        code: "SABOTAGE_NOT_AVAILABLE",
        message: "Sabotages don't apply to sentence rounds",
      });
    }

    const roleView = forRole(duel, playerRole);
    const sabotagesUsed = roleView.mySabotagesUsed;

    if (sabotagesUsed >= MAX_SABOTAGES) {
      throw new ConvexError({ code: "NO_SABOTAGES_LEFT", message: "No sabotages remaining" });
    }

    const now = Date.now();

    if (roleView.theirAnswered) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Opponent has already answered this question" });
    }

    // One sabotage per question per player. `theirSabotage` is the sabotage
    // I've sent to my opponent; if its timestamp is at/after the current
    // question's start, I've already sabotaged this question.
    const myOutgoingSabotage = roleView.theirSabotage;
    if (myOutgoingSabotage && myOutgoingSabotage.timestamp >= duel.questionStartTime) {
      throw new ConvexError({
        code: "SABOTAGE_ALREADY_SENT_THIS_QUESTION",
        message: "You've already used a sabotage on this question",
      });
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
