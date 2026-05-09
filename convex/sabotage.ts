/**
 * Sabotage system mutations.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getDuelParticipant, isDuelActive } from "./helpers/auth";
import { forRole } from "../lib/duelRole";
import { isSabotageActive } from "../lib/sabotage/active";
import { MAX_SABOTAGES } from "../lib/sabotage/constants";

export const sendSabotage = mutation({
  args: {
    duelId: v.id("duels"),
    effect: v.union(
      v.literal("sticky"),
      v.literal("bounce"),
      v.literal("trampoline"),
      v.literal("reverse")
    ),
  },
  handler: async (ctx, { duelId, effect }) => {
    const { duel, playerRole, isChallenger } = await getDuelParticipant(ctx, duelId);

    if (!isDuelActive(duel)) {
      throw new Error("Duel is not active");
    }

    const roleView = forRole(duel, playerRole);
    const sabotagesUsed = roleView.mySabotagesUsed;

    if (sabotagesUsed >= MAX_SABOTAGES) {
      throw new Error("No sabotages remaining");
    }

    // Check if target already has an active sabotage
    const now = Date.now();

    if (roleView.theirAnswered) {
      throw new Error("Opponent has already answered this question");
    }

    if (
      isSabotageActive({
        sabotage: roleView.theirSabotage,
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
