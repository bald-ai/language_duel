import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getDuelParticipant } from "./helpers/auth";
import { hintTypeValidator } from "./schema";
import { assertDuelMode } from "./rules/duelModeGuards";
import { canFireHint, resolveEffect } from "../lib/hintPool/rules";
import { hashSeed } from "../lib/prng";

export const fireHint = mutation({
  args: {
    duelId: v.id("duels"),
    hintType: hintTypeValidator,
  },
  handler: async (ctx, { duelId, hintType }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "pve", "fireHint");

    if (duel.status !== "active") {
      throw new ConvexError({ code: "DUEL_NOT_ACTIVE", message: "Duel is not active" });
    }

    if (duel.hintPoolUsed.includes(hintType)) {
      throw new ConvexError({ code: "HINT_ALREADY_USED", message: "This hint has already been used" });
    }

    if (!canFireHint(duel.hintPoolUsed, hintType, duel.currentQuestionHintFired)) {
      throw new ConvexError({ code: "QUESTION_HINT_ALREADY_FIRED", message: "Only one hint can be used per question" });
    }

    const currentQuestion = duel.duelQuestions?.[duel.currentWordIndex];
    if (!currentQuestion) {
      throw new ConvexError({ code: "INTERNAL_ERROR", message: "Duel question data is missing" });
    }
    // PvE hints don't apply to sentence rounds in v1 (plan: mixed session
    // behavior). Bail out cleanly rather than fight a missing `options` field.
    if (currentQuestion.kind !== "word") {
      throw new ConvexError({
        code: "HINT_NOT_AVAILABLE",
        message: "Hints are not available on sentence rounds",
      });
    }

    const existingEliminated = duel.eliminatedOptions ?? [];
    const visibleOptions = currentQuestion.options.filter(
      (option) => !existingEliminated.includes(option)
    );
    const hintSeed = hashSeed(`${duel.seed}:${duel.currentWordIndex}:${hintType}`);
    const effect = resolveEffect(
      hintType,
      {
        options: visibleOptions,
        correctOption: currentQuestion.correctOption,
      },
      hintSeed
    );
    const nextEliminatedOptions = Array.from(
      new Set([...existingEliminated, ...effect.eliminatedOptions])
    );
    const currentStart =
      typeof duel.questionStartTime === "number" ? duel.questionStartTime : Date.now();

    await ctx.db.patch(duelId, {
      hintPoolUsed: [...duel.hintPoolUsed, hintType],
      currentQuestionHintFired: true,
      currentQuestionHintReveal: effect.reveal,
      eliminatedOptions: nextEliminatedOptions,
      questionStartTime: currentStart + effect.timerBonusSeconds * 1000,
    });
  },
});
