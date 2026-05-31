/**
 * PvE turn-by-turn (TbT) sentence-duel mutations. Two players share ONE sentence
 * board per question and alternate turns placing the next tile:
 *  - a correct tap places the tile and passes the turn;
 *  - a wrong tap places nothing and passes the turn;
 *  - finishing a sentence banks a SHARED point for both players and advances;
 *  - if the shared sentence clock runs out first, the sentence ends with no
 *    point and the duel advances.
 *
 * It is cooperative — there is no winner. The per-tap validation and the board
 * storage reuse the sentence machinery (`applySentenceTap` / `sentenceProgress`)
 * through a single shared row keyed by `TBT_BOARD_ROLE`; this file only owns the
 * turn pointer and the shared-score advance.
 *
 * Timing reuses the word/sentence-duel model: one shared budget per sentence,
 * anchored on `questionStartTime`. There is no per-turn clock and no scheduler —
 * either client fires `tbtQuestionTimeout` when the shared clock hits zero, and
 * the mutation self-verifies the window so stale/racing calls are ignored. An
 * abandoned duel simply parks (mirrors the normal sentence round and relay).
 */

import { mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getDuelParticipant } from "./helpers/auth";
import { assertDuelMode } from "./rules/duelModeGuards";
import { applySentenceTap } from "./rules/sentenceGameplayRules";
import { TBT_QUESTION_TIMEOUT_MS } from "../lib/duelConstants";
import { getEffectiveQuestionStartTime } from "../lib/duelTiming";
import {
  TBT_BOARD_ROLE,
  tbtOpener,
  otherRole,
  isTbtLastSentence,
  buildTbtAdvancePatch,
} from "../lib/duel/tbtEngine";

function assertActive(duel: Doc<"duels">) {
  if (duel.status !== "active") {
    throw new ConvexError({ code: "DUEL_NOT_ACTIVE", message: "Duel is not active" });
  }
}

/** Whose tap is expected next — falls back to the current sentence's opener. */
function currentTurnFor(duel: Doc<"duels">) {
  return duel.tbtTurn ?? tbtOpener(duel.currentWordIndex);
}

/** Whether the shared sentence clock has fully elapsed for the current sentence. */
function questionWindowElapsed(duel: Doc<"duels">, now: number): boolean {
  const effectiveStart = getEffectiveQuestionStartTime(
    duel.questionStartTime ?? now,
    duel.currentWordIndex
  );
  return now - effectiveStart >= TBT_QUESTION_TIMEOUT_MS;
}

/**
 * Place the next tile on the shared board, if it's the caller's turn. The
 * outcome is one of:
 *  - sentence finished → bank a shared point, advance (or complete inline);
 *  - correct-not-final OR wrong guess → pass the turn to the partner;
 *  - no-op tap (out of bounds / already-placed) → ignored, turn unchanged.
 * The shared sentence clock keeps running across turns — it is not per tap.
 */
export const tbtTap = mutation({
  args: { duelId: v.id("duels"), tileIndex: v.number() },
  handler: async (ctx, { duelId, tileIndex }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "tbt", "tbtTap");
    assertActive(duel);

    if (playerRole !== currentTurnFor(duel)) {
      throw new ConvexError({ code: "NOT_AUTHORIZED", message: "It's not your turn" });
    }

    const questionIndex = duel.currentWordIndex;
    const { patch: tapPatch, accepted } = applySentenceTap({
      duel,
      questionIndex,
      role: TBT_BOARD_ROLE,
      tileIndex,
    });

    // No-op tap (out of bounds / already-placed tile): ignore so a misclick
    // doesn't burn the turn.
    if (Object.keys(tapPatch).length === 0) return;

    const rowAfter = tapPatch.sentenceProgress?.find(
      (row) => row.questionIndex === questionIndex && row.role === TBT_BOARD_ROLE
    );
    const completed = rowAfter?.completed === true;
    const now = Date.now();

    if (completed) {
      // Sentence built — bank the shared point and advance (or complete inline
      // on the last sentence; cooperative, so no winnerRole).
      const advancePatch = buildTbtAdvancePatch(duel, now, { bankPoint: true });
      const finishing = isTbtLastSentence(duel);
      await ctx.db.patch(duelId, {
        ...tapPatch,
        ...advancePatch,
        ...(finishing ? { status: "completed" as const } : {}),
      });
      return;
    }

    // Correct-but-not-final OR a wrong guess: just pass the turn. The shared
    // sentence clock is untouched (it spans the whole sentence, not the turn).
    // A wrong pick lingers as a subtle marker so the partner sees what was
    // tried; a correct pick clears any prior marker (the placed green tile is
    // now the latest action).
    await ctx.db.patch(duelId, {
      ...tapPatch,
      tbtTurn: otherRole(playerRole),
      tbtLastWrongTileIndex: accepted ? undefined : tileIndex,
    });
  },
});

/**
 * Either client fires this when the shared sentence clock hits zero. Idempotent
 * and self-verifying: it advances only if the window has truly elapsed for the
 * CURRENT sentence, so stale calls (a peer already advanced) and racing
 * double-fires are ignored. Nothing is banked — the sentence wasn't finished.
 */
export const tbtQuestionTimeout = mutation({
  args: { duelId: v.id("duels"), questionIndex: v.number() },
  handler: async (ctx, { duelId, questionIndex }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "tbt", "tbtQuestionTimeout");
    if (duel.status !== "active") return;
    if (duel.currentWordIndex !== questionIndex) return; // a newer sentence already started

    const now = Date.now();
    if (!questionWindowElapsed(duel, now)) return; // clock hasn't actually run out

    const advancePatch = buildTbtAdvancePatch(duel, now, { bankPoint: false });
    const finishing = isTbtLastSentence(duel);
    await ctx.db.patch(duelId, {
      ...advancePatch,
      ...(finishing ? { status: "completed" as const } : {}),
    });
  },
});
