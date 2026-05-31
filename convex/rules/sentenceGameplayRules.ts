/**
 * Pure server-side rules for sentence rounds. Mirrors `duelGameplayRules.ts`'s
 * shape: pure functions return `Partial<Doc<"duels">>` patches that the mutation
 * layer applies.
 *
 * Authority model: the server alone tracks the placed tile sequence per
 * (questionIndex, role) in `duel.sentenceProgress`. Every non-TbT sentence duel
 * uses the build-and-confirm model — tiles are appended in any order and the
 * whole sentence is verified on Confirm; `answerSentenceRound` finalizes off the
 * server-tracked `completed` / `failedConfirms`, never client input.
 *
 * `applySentenceTap` (per-tap validation) is retained ONLY for the cooperative
 * turn-by-turn (TbT) shared-board mode (`convex/tbtDuel.ts`); the SentenceRoundView
 * path (PvE / PvP / self-duel) is build-and-confirm exclusively.
 */

import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  SENTENCE_PVP_CLEAN_CONFIRM_POINTS,
  SENTENCE_PVP_SINGLE_FAIL_POINTS,
  SENTENCE_PVP_FLOOR_POINTS,
} from "../../lib/themes/sentenceConstants";
import {
  getLimitedLivesMissPatch,
  isBossAttempt,
} from "./duelScoringRules";
import { mirrorPatchForSelfDuel } from "./selfDuelMirror";
import type { PlayerRole } from "../helpers/auth";
import { TIMEOUT_ANSWER } from "../constants";
import { tokenizeSpanishSentence } from "../../lib/themes/sentenceValidation";
import { normalizeForComparison } from "../../lib/stringUtils";

export type SentenceProgressEntry = NonNullable<
  Doc<"duels">["sentenceProgress"]
>[number];

/** Look up the progress row for a (questionIndex, role), or undefined. */
export function findSentenceProgress(
  duel: Pick<Doc<"duels">, "sentenceProgress">,
  questionIndex: number,
  role: PlayerRole
): SentenceProgressEntry | undefined {
  return (duel.sentenceProgress ?? []).find(
    (entry) => entry.questionIndex === questionIndex && entry.role === role
  );
}

function replaceSentenceProgress(
  duel: Pick<Doc<"duels">, "sentenceProgress">,
  next: SentenceProgressEntry
): SentenceProgressEntry[] {
  const all = duel.sentenceProgress ?? [];
  const filtered = all.filter(
    (entry) =>
      !(entry.questionIndex === next.questionIndex && entry.role === next.role)
  );
  return [...filtered, next];
}

/**
 * Validate a tile tap against the server-tracked progress for this player and
 * position. Returns the patch — only the `sentenceProgress` array changes.
 *
 * Repeated-word rule (decision: validation): tiles are interchangeable by
 * normalized text. We reject re-taps of the same pool index, not re-uses of
 * the same word value.
 */
export function applySentenceTap(params: {
  duel: Doc<"duels">;
  questionIndex: number;
  role: PlayerRole;
  tileIndex: number;
}): { patch: Partial<Doc<"duels">>; accepted: boolean } {
  const { duel, questionIndex, role, tileIndex } = params;
  const question = duel.duelQuestions?.[questionIndex];
  if (!question || question.kind !== "sentence") {
    throw new ConvexError({
      code: "WRONG_QUESTION_KIND",
      message: "tapSentenceTile only applies to sentence positions",
    });
  }

  const existing = findSentenceProgress(duel, questionIndex, role);
  if (existing?.finalized) {
    // Already finalized — taps are ignored.
    return { patch: {}, accepted: false };
  }

  const current: SentenceProgressEntry = existing ?? {
    questionIndex,
    role,
    placedTileIndices: [],
    mistakes: 0,
    completed: false,
    finalized: false,
  };

  if (current.completed) {
    return { patch: {}, accepted: false };
  }
  if (tileIndex < 0 || tileIndex >= question.tilePool.length) {
    return { patch: {}, accepted: false };
  }
  if (current.placedTileIndices.includes(tileIndex)) {
    return { patch: {}, accepted: false };
  }

  const correctTokens = tokenizeSpanishSentence(question.spanishSentence);
  const expectedToken = correctTokens[current.placedTileIndices.length];
  if (expectedToken === undefined) {
    return { patch: {}, accepted: false };
  }

  const tappedTile = question.tilePool[tileIndex];
  const tappedNormalized = normalizeForComparison(tappedTile);
  const expectedNormalized = normalizeForComparison(expectedToken);

  let next: SentenceProgressEntry;
  let accepted: boolean;
  if (tappedNormalized !== expectedNormalized) {
    next = { ...current, mistakes: current.mistakes + 1 };
    accepted = false;
  } else {
    const nextPlaced = [...current.placedTileIndices, tileIndex];
    const completed = nextPlaced.length === correctTokens.length;
    next = { ...current, placedTileIndices: nextPlaced, completed };
    accepted = true;
  }

  return {
    patch: { sentenceProgress: replaceSentenceProgress(duel, next) },
    accepted,
  };
}

// ===========================================================================
// Build-and-confirm model (PvP)
//
// Placement does NOT validate per tap — tiles are appended in any order. The
// whole sentence is verified only on Confirm (`confirmSentenceRound`), which is
// the one place the answer key is read. Removal is last-only; Reset clears the
// board. None of these change `failedConfirms` except a failed Confirm.
// ===========================================================================

function emptySentenceEntry(
  questionIndex: number,
  role: PlayerRole
): SentenceProgressEntry {
  return {
    questionIndex,
    role,
    placedTileIndices: [],
    mistakes: 0,
    completed: false,
    finalized: false,
    failedConfirms: 0,
  };
}

function requireSentenceQuestion(duel: Doc<"duels">, questionIndex: number) {
  const question = duel.duelQuestions?.[questionIndex];
  if (!question || question.kind !== "sentence") {
    throw new ConvexError({
      code: "WRONG_QUESTION_KIND",
      message: "This duel position is not a sentence round",
    });
  }
  return question;
}

/**
 * Append a tile to the board with NO validation (build-and-confirm placement).
 * Rejects re-taps of an already-placed index, out-of-bounds indices, and taps
 * once the board already holds the full sentence length (you peel back to
 * change earlier choices). Never touches `mistakes` / `failedConfirms`;
 * completion is decided only by Confirm.
 */
export function appendSentenceTile(params: {
  duel: Doc<"duels">;
  questionIndex: number;
  role: PlayerRole;
  tileIndex: number;
}): { patch: Partial<Doc<"duels">>; accepted: boolean } {
  const { duel, questionIndex, role, tileIndex } = params;
  const question = requireSentenceQuestion(duel, questionIndex);

  const existing = findSentenceProgress(duel, questionIndex, role);
  if (existing?.finalized) return { patch: {}, accepted: false };

  const current = existing ?? emptySentenceEntry(questionIndex, role);
  if (current.completed) return { patch: {}, accepted: false };
  if (tileIndex < 0 || tileIndex >= question.tilePool.length) {
    return { patch: {}, accepted: false };
  }
  if (current.placedTileIndices.includes(tileIndex)) {
    return { patch: {}, accepted: false };
  }

  // Cap the board at the target sentence length — the player fills exactly N
  // slots and peels back to swap a choice, rather than over-filling.
  const targetLength = tokenizeSpanishSentence(question.spanishSentence).length;
  if (current.placedTileIndices.length >= targetLength) {
    return { patch: {}, accepted: false };
  }

  const next: SentenceProgressEntry = {
    ...current,
    placedTileIndices: [...current.placedTileIndices, tileIndex],
  };
  return {
    patch: { sentenceProgress: replaceSentenceProgress(duel, next) },
    accepted: true,
  };
}

/** Peel the most recently placed tile (last-only removal). No-op when empty,
 * completed, or finalized. Never costs points. */
export function removeLastSentenceTile(params: {
  duel: Doc<"duels">;
  questionIndex: number;
  role: PlayerRole;
}): { patch: Partial<Doc<"duels">> } {
  const { duel, questionIndex, role } = params;
  requireSentenceQuestion(duel, questionIndex);

  const existing = findSentenceProgress(duel, questionIndex, role);
  if (!existing || existing.finalized || existing.completed) return { patch: {} };
  if (existing.placedTileIndices.length === 0) return { patch: {} };

  const next: SentenceProgressEntry = {
    ...existing,
    placedTileIndices: existing.placedTileIndices.slice(0, -1),
  };
  return { patch: { sentenceProgress: replaceSentenceProgress(duel, next) } };
}

/** Clear the whole board (the Reset button). Free — never costs points; keeps
 * the running `failedConfirms` count. No-op when completed or finalized. */
export function clearSentenceBoard(params: {
  duel: Doc<"duels">;
  questionIndex: number;
  role: PlayerRole;
}): { patch: Partial<Doc<"duels">> } {
  const { duel, questionIndex, role } = params;
  requireSentenceQuestion(duel, questionIndex);

  const existing = findSentenceProgress(duel, questionIndex, role);
  if (!existing || existing.finalized || existing.completed) return { patch: {} };
  if (existing.placedTileIndices.length === 0) return { patch: {} };

  const next: SentenceProgressEntry = { ...existing, placedTileIndices: [] };
  return { patch: { sentenceProgress: replaceSentenceProgress(duel, next) } };
}

export interface SentenceConfirmResult {
  /** Per-position correctness, one entry per placed tile. Never reveals the
   * expected words — only which slots match. */
  correctnessMask: boolean[];
  completed: boolean;
  failedConfirms: number;
}

/**
 * Verify the whole built sentence (the build-and-confirm validation point).
 * Comparison is strictly POSITIONAL — slot `i`'s tile text vs the expected
 * token `i` — never a membership/multiset check, so duplicate words ("the cat
 * the dog") are colored by position (see plan R6). The answer key is read here
 * server-side and never sent to the client; only the boolean mask leaves.
 *
 * Correct (all slots match AND length === target) → sets `completed: true`.
 * Wrong → increments `failedConfirms`; the player keeps editing. An empty
 * board is a no-op (Confirm is disabled client-side when empty).
 */
export function confirmSentenceRound(params: {
  duel: Doc<"duels">;
  questionIndex: number;
  role: PlayerRole;
}): { patch: Partial<Doc<"duels">>; result: SentenceConfirmResult } {
  const { duel, questionIndex, role } = params;
  const question = requireSentenceQuestion(duel, questionIndex);

  const existing = findSentenceProgress(duel, questionIndex, role);
  const current = existing ?? emptySentenceEntry(questionIndex, role);
  const failedConfirms = current.failedConfirms ?? 0;

  // Finalized or already-correct rounds are idempotent: re-derive the mask from
  // the current board without changing state.
  const correctTokens = tokenizeSpanishSentence(question.spanishSentence);
  const correctnessMask = current.placedTileIndices.map((tileIndex, position) => {
    const expected = correctTokens[position];
    if (expected === undefined) return false;
    const placed = question.tilePool[tileIndex];
    if (placed === undefined) return false;
    return normalizeForComparison(placed) === normalizeForComparison(expected);
  });

  if (current.finalized || current.completed) {
    return {
      patch: {},
      result: { correctnessMask, completed: current.completed, failedConfirms },
    };
  }

  // Empty board → no penalty, no state change.
  if (current.placedTileIndices.length === 0) {
    return {
      patch: {},
      result: { correctnessMask: [], completed: false, failedConfirms },
    };
  }

  const allMatch =
    current.placedTileIndices.length === correctTokens.length &&
    correctnessMask.every(Boolean);

  if (allMatch) {
    const next: SentenceProgressEntry = { ...current, completed: true };
    return {
      patch: { sentenceProgress: replaceSentenceProgress(duel, next) },
      result: { correctnessMask, completed: true, failedConfirms },
    };
  }

  // Penalty-stacking guard: re-confirming the exact same wrong board (a
  // double-click or repeated tap) must not increment failedConfirms again.
  // Only a board that differs from the last failed Confirm counts as a new try.
  const lastFailed = current.lastFailedConfirmTileIndices;
  const sameAsLastFailed =
    lastFailed !== undefined &&
    lastFailed.length === current.placedTileIndices.length &&
    lastFailed.every((value, i) => value === current.placedTileIndices[i]);

  if (sameAsLastFailed) {
    return {
      patch: {},
      result: { correctnessMask, completed: false, failedConfirms },
    };
  }

  const nextFailedConfirms = failedConfirms + 1;
  const next: SentenceProgressEntry = {
    ...current,
    failedConfirms: nextFailedConfirms,
    lastFailedConfirmTileIndices: [...current.placedTileIndices],
  };
  return {
    patch: { sentenceProgress: replaceSentenceProgress(duel, next) },
    result: {
      correctnessMask,
      completed: false,
      failedConfirms: nextFailedConfirms,
    },
  };
}

/** Mark a progress row finalized so further taps are rejected. */
export function finalizeSentenceProgress(
  duel: Pick<Doc<"duels">, "sentenceProgress">,
  questionIndex: number,
  role: PlayerRole
): Partial<Doc<"duels">> {
  const existing = findSentenceProgress(duel, questionIndex, role);
  const base: SentenceProgressEntry = existing ?? {
    questionIndex,
    role,
    placedTileIndices: [],
    mistakes: 0,
    completed: false,
    finalized: false,
  };
  if (base.finalized) return {};
  return {
    sentenceProgress: replaceSentenceProgress(duel, { ...base, finalized: true }),
  };
}

export interface PvpSentenceSubmission {
  /** True only if a Confirm matched the whole sentence. */
  completed: boolean;
  /** Failed Confirm attempts this round (the correct Confirm is not counted). */
  failedConfirms: number;
}

/**
 * PvP build-and-confirm scoring ladder (decision: competitive scoring). Floor
 * is −1; positive points require a correct Confirm. See the table on
 * `SENTENCE_PVP_*` in `sentenceConstants.ts`.
 */
export function scorePvpSentenceSubmission(submission: PvpSentenceSubmission): number {
  const { completed, failedConfirms } = submission;
  if (completed) {
    if (failedConfirms === 0) return SENTENCE_PVP_CLEAN_CONFIRM_POINTS;
    if (failedConfirms === 1) return SENTENCE_PVP_SINGLE_FAIL_POINTS;
    return SENTENCE_PVP_FLOOR_POINTS;
  }
  // Timeout / never-correct: zero failed Confirms costs nothing, any failed
  // Confirm drops to the floor.
  return failedConfirms === 0
    ? SENTENCE_PVP_SINGLE_FAIL_POINTS
    : SENTENCE_PVP_FLOOR_POINTS;
}

/**
 * Build the patch that records a player's sentence-round submission. Reads the
 * server-tracked `completed` / `failedConfirms` — client input is not trusted.
 * The progress row is marked `finalized` so further taps are rejected.
 */
export function buildSentenceAnswerPatch(params: {
  duel: Doc<"duels">;
  playerRole: PlayerRole;
  isChallenger: boolean;
  // Part of the mutation contract (the client distinguishes a timeout submit
  // from a completion submit), but unused for scoring: build-and-confirm derives
  // completion from the server-tracked `completed` flag, which a timeout never
  // sets. Kept so `answerSentenceRound` can validate the client's input.
  timedOut: boolean;
  questionIndex: number;
}): Partial<Doc<"duels">> {
  const { duel, playerRole, isChallenger, questionIndex } = params;
  const alreadyAnswered = isChallenger
    ? duel.challengerAnswered
    : duel.opponentAnswered;
  if (alreadyAnswered) return {};

  const finalizePatch = finalizeSentenceProgress(duel, questionIndex, playerRole);

  // Build-and-confirm is the only sentence model (PvE / PvP / self unified).
  // Score off the failed-Confirm ladder: `completed` is set only by a correct
  // Confirm, so a timeout naturally lands on the not-completed rows. A boss / SR
  // attempt is lives-tracked, so an unsolved round costs one life (a correct
  // Confirm costs none); plain duels are not lives attempts, so that is a no-op.
  const entry = findSentenceProgress(duel, questionIndex, playerRole);
  const completed = entry?.completed ?? false;
  const failedConfirms = entry?.failedConfirms ?? 0;
  const earned = scorePvpSentenceSubmission({ completed, failedConfirms });
  const livesPatch = completed ? {} : getLimitedLivesMissPatch(duel, playerRole);
  const lastAnswerMarker = completed
    ? `sentence:confirms=${failedConfirms}`
    : TIMEOUT_ANSWER;

  return mirrorPatchForSelfDuel(
    {
      ...finalizePatch,
      ...(isChallenger
        ? {
            challengerAnswered: true,
            challengerScore: duel.challengerScore + earned,
            challengerLastAnswer: lastAnswerMarker,
            ...livesPatch,
          }
        : {
            opponentAnswered: true,
            opponentScore: duel.opponentScore + earned,
            opponentLastAnswer: lastAnswerMarker,
            ...livesPatch,
          }),
    },
    duel
  );
}

export function validateTimedOutFlag(timedOut: unknown) {
  if (typeof timedOut !== "boolean") {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "answerSentenceRound requires a boolean `timedOut`",
    });
  }
}

/**
 * Test seam: avoid importing the entire scoring rules barrel just to detect
 * boss completion in the answer flow. Re-export so the mutation layer doesn't
 * need both files.
 */
export { isBossAttempt };
