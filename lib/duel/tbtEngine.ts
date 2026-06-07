/**
 * Pure PvE turn-by-turn (TbT) sentence rules. Two players share ONE sentence
 * board per question and alternate turns placing the next tile. Finishing a
 * sentence banks a SHARED point for both players — it is cooperative, there is
 * no winner.
 *
 * This layer is intentionally thin. The actual per-tap validation and board
 * storage reuse the sentence machinery (`applySentenceTap` / `sentenceProgress`)
 * via a single shared row keyed by `TBT_BOARD_ROLE`. Here we only own the turn
 * pointer (`tbtTurn`) and the shared-score advance.
 *
 * Timing is NOT owned here: the pair gets one shared per-sentence budget,
 * anchored on `questionStartTime` exactly like the word/sentence duels (so the
 * same pause/transition handling applies). There is no per-turn clock.
 *
 * Indices below are positions into `duelQuestions` — the same basis as
 * `currentItemIndex`.
 */

import type { Doc } from "../../convex/_generated/dataModel";
import type { DuelRole } from "../duelRole";

/**
 * Both players write to a single shared sentence-progress row. We always use the
 * "challenger" slot as that shared board, so `applySentenceTap` reads and writes
 * the same row regardless of who tapped.
 */
export const TBT_BOARD_ROLE: DuelRole = "challenger";

export interface TbtInitialState {
  tbtTurn: DuelRole;
}

export function otherRole(role: DuelRole): DuelRole {
  return role === "challenger" ? "opponent" : "challenger";
}

/**
 * Who opens a given sentence. Alternating openers keeps it fair: even-indexed
 * sentences open with the challenger, odd-indexed with the opponent.
 */
export function tbtOpener(questionIndex: number): DuelRole {
  return questionIndex % 2 === 0 ? "challenger" : "opponent";
}

/** TbT fields set once at duel creation. The opener of sentence 0 goes first.
 * The shared sentence clock rides on `questionStartTime` (set generally at
 * creation), so there is no separate turn clock to stamp here. */
export function buildInitialTbtState(): TbtInitialState {
  return {
    tbtTurn: tbtOpener(0),
  };
}

/** Whether the current sentence is the last one in the deck. */
export function isTbtLastSentence(
  duel: Pick<Doc<"duels">, "currentItemIndex" | "duelQuestions">
): boolean {
  const total = requireTbtQuestionCount(duel);
  return duel.currentItemIndex + 1 >= total;
}

function requireTbtQuestionCount(
  duel: Pick<Doc<"duels">, "duelQuestions">
): number {
  if (!duel.duelQuestions || duel.duelQuestions.length === 0) {
    throw new Error("Tag Team duel question data is missing");
  }
  return duel.duelQuestions.length;
}

/**
 * The current sentence is over — either it was just completed (`bankPoint`) or
 * the shared clock ran out (`bankPoint` false, nothing banked). Advance to the
 * next sentence, handing the turn to its opener and re-anchoring the shared
 * clock on `now`. When the last sentence is over, clamp the index and clear the
 * turn pointer; the caller marks the duel completed inline (TbT is
 * normal-source-only — no lifecycle scheduler, mirroring relay's inline
 * completion).
 */
export function buildTbtAdvancePatch(
  duel: Pick<
    Doc<"duels">,
    "currentItemIndex" | "duelQuestions" | "challengerScore" | "opponentScore"
  >,
  now: number,
  opts: { bankPoint: boolean }
): Partial<Doc<"duels">> {
  const total = requireTbtQuestionCount(duel);

  const patch: Partial<Doc<"duels">> = {
    // Reset the SHARED between-sentence countdown so each transition starts
    // fresh (mirrors `getHintClearFields` on a normal round advance). Without
    // this a prior "both skipped" / pause would carry into the next reveal and
    // collapse it instantly.
    countdownPausedBy: undefined,
    countdownPausedAt: undefined,
    countdownUnpauseRequestedBy: undefined,
    countdownSkipRequestedBy: undefined,
    // The "last wrong pick" marker is per-sentence — drop it on advance.
    tbtLastWrongTileIndex: undefined,
  };

  // A finished sentence banks a SHARED point (+1 to BOTH). A timed-out sentence
  // banks nothing — cooperative, you only score what you actually build.
  if (opts.bankPoint) {
    patch.challengerScore = duel.challengerScore + 1;
    patch.opponentScore = duel.opponentScore + 1;
  }

  if (isTbtLastSentence(duel)) {
    patch.currentItemIndex = Math.max(0, total - 1);
    patch.tbtTurn = undefined;
    patch.questionStartTime = undefined;
    return patch;
  }

  const nextIndex = duel.currentItemIndex + 1;
  patch.currentItemIndex = nextIndex;
  patch.tbtTurn = tbtOpener(nextIndex);
  // Re-anchor the shared clock. `getEffectiveQuestionStartTime` adds the fixed
  // transition offset for non-first sentences, so the 90s only starts ticking
  // once the between-sentence reveal ends.
  patch.questionStartTime = now;
  return patch;
}
