import type { Doc } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getDuelParticipant } from "./helpers/auth";
import { hintTypeValidator, sentenceHintTypeValidator } from "./schema";
import { assertDuelMode } from "./rules/duelModeGuards";
import { canFireHint, resolveEffect } from "../lib/hintPool/rules";
import { resolveSentenceHint } from "../lib/sentenceGameplay/hints";
import { hashSeed } from "../lib/prng";

export const fireHint = mutation({
  args: {
    duelId: v.id("duels"),
    hintType: hintTypeValidator,
  },
  handler: async (ctx, { duelId, hintType }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "pve", "fireHint");

    requireHintAvailable(duel, duel.hintPoolUsed, hintType);

    if (
      !canFireHint(duel.hintPoolUsed, hintType, duel.currentQuestionHintFired)
    ) {
      throw new ConvexError({
        code: "QUESTION_HINT_ALREADY_FIRED",
        message: "Only one hint can be used per question",
      });
    }

    const currentQuestion = requireHintQuestion(duel);
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
      (option) => !existingEliminated.includes(option),
    );
    const hintSeed = hashSeed(
      `${duel.seed}:${duel.currentItemIndex}:${hintType}`,
    );
    const effect = resolveEffect(
      hintType,
      {
        options: visibleOptions,
        correctOption: currentQuestion.correctOption,
      },
      hintSeed,
    );
    const nextEliminatedOptions = Array.from(
      new Set([...existingEliminated, ...effect.eliminatedOptions]),
    );
    const currentStart =
      typeof duel.questionStartTime === "number"
        ? duel.questionStartTime
        : Date.now();

    await ctx.db.patch(duelId, {
      hintPoolUsed: [...duel.hintPoolUsed, hintType],
      currentQuestionHintFired: true,
      currentQuestionHintReveal: effect.reveal,
      eliminatedOptions: nextEliminatedOptions,
      questionStartTime: currentStart + effect.timerBonusSeconds * 1000,
    });
  },
});

/**
 * PvE sentence hint pool — the cooperative counterpart to PvP sabotages on the
 * build-and-confirm sentence board. Mirrors `fireHint`: PvE-only, one shared
 * pool per duel (`sentenceHintPoolUsed`), one hint per question
 * (`currentQuestionHintFired`, shared with the word pool — safe because a round
 * is one kind only). The effect hits both players' boards via the shared
 * per-question fields; there is no consent step and no self-duel mirror (the
 * fields are not role-specific).
 */
export const fireSentenceHint = mutation({
  args: {
    duelId: v.id("duels"),
    hintType: sentenceHintTypeValidator,
  },
  handler: async (ctx, { duelId, hintType }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "pve", "fireSentenceHint");

    requireHintAvailable(duel, duel.sentenceHintPoolUsed, hintType);

    if (duel.currentQuestionHintFired) {
      throw new ConvexError({
        code: "QUESTION_HINT_ALREADY_FIRED",
        message: "Only one hint can be used per question",
      });
    }

    const currentQuestion = requireHintQuestion(duel);
    if (currentQuestion.kind !== "sentence") {
      throw new ConvexError({
        code: "HINT_NOT_AVAILABLE",
        message: "Sentence hints are only available on sentence rounds",
      });
    }

    const existingEliminated = duel.currentQuestionEliminatedTileIndices ?? [];
    const hintSeed = hashSeed(
      `${duel.seed}:${duel.currentItemIndex}:${hintType}`,
    );
    const effect = resolveSentenceHint(hintType, {
      tilePool: currentQuestion.tilePool,
      spanishSentence: currentQuestion.spanishSentence,
      alreadyEliminated: existingEliminated,
      seed: hintSeed,
    });

    // The bonus field is the single source of truth for the timer clamp — do NOT
    // also push `questionStartTime` or the bonus would double-count (Issue S4).
    await ctx.db.patch(duelId, {
      sentenceHintPoolUsed: [...duel.sentenceHintPoolUsed, hintType],
      currentQuestionHintFired: true,
      currentQuestionEliminatedTileIndices: Array.from(
        new Set([...existingEliminated, ...effect.eliminatedTileIndices]),
      ),
      currentQuestionRevealedTiles: effect.revealedTiles.length
        ? effect.revealedTiles
        : duel.currentQuestionRevealedTiles,
      currentQuestionTimerBonusSeconds:
        (duel.currentQuestionTimerBonusSeconds ?? 0) + effect.timerBonusSeconds,
    });
  },
});

function requireHintAvailable(
  duel: Doc<"duels">,
  used: readonly string[],
  hintType: string,
) {
  if (duel.status !== "active") {
    throw new ConvexError({
      code: "DUEL_NOT_ACTIVE",
      message: "Duel is not active",
    });
  }
  if (used.includes(hintType)) {
    throw new ConvexError({
      code: "HINT_ALREADY_USED",
      message: "This hint has already been used",
    });
  }
}

function requireHintQuestion(duel: Doc<"duels">) {
  const question = duel.duelQuestions?.[duel.currentItemIndex];
  if (!question) {
    throw new ConvexError({
      code: "INTERNAL_ERROR",
      message: "Duel question data is missing",
    });
  }
  return question;
}
