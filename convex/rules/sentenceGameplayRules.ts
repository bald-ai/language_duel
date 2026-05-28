/**
 * Pure server-side rules for sentence rounds. Mirrors `duelGameplayRules.ts`'s
 * shape: pure functions return `Partial<Doc<"duels">>` patches that the mutation
 * layer applies.
 *
 * Authority model (v2): the server alone tracks tile sequence + mistakes per
 * (questionIndex, role) in `duel.sentenceProgress`. Each tap is its own
 * mutation (`tapSentenceTile`); `answerSentenceRound` only finalizes — it
 * derives `completed`/`mistakes` from server state, never from client input.
 * PvE shared-board taps and PvP sabotages remain out of scope.
 */

import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  SENTENCE_CLEAN_COMPLETION_POINTS,
  SENTENCE_MESSY_COMPLETION_POINTS,
  SENTENCE_TIMEOUT_POINTS,
} from "../../lib/themes/sentenceConstants";
import {
  getBossAttemptEndFields,
  isBossAttempt,
  isLivesAttempt,
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

/**
 * Read the server-tracked submission for finalization. Returns the
 * `{completed, mistakes}` the scorer should use. If the player has no progress
 * row yet (never tapped), treats it as a timeout with 0 mistakes.
 */
export function readServerSubmission(
  duel: Pick<Doc<"duels">, "sentenceProgress">,
  questionIndex: number,
  role: PlayerRole,
  timedOut: boolean
): SentenceRoundSubmission {
  const entry = findSentenceProgress(duel, questionIndex, role);
  if (!entry) return { completed: false, mistakes: 0 };
  if (timedOut && !entry.completed) {
    return { completed: false, mistakes: entry.mistakes };
  }
  return { completed: entry.completed, mistakes: entry.mistakes };
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

export interface SentenceRoundSubmission {
  completed: boolean;
  /** Wrong tile taps the player accumulated this round. Must be >= 0. */
  mistakes: number;
}

export function scoreSentenceSubmission(submission: SentenceRoundSubmission): number {
  if (!submission.completed) return SENTENCE_TIMEOUT_POINTS;
  return submission.mistakes === 0
    ? SENTENCE_CLEAN_COMPLETION_POINTS
    : SENTENCE_MESSY_COMPLETION_POINTS;
}

/**
 * Deduct one HP per wrong tile on lives-tracked attempts (boss / SR), and end
 * the boss attempt inline when lives hit 0 — mirrors `getLimitedLivesMissPatch`
 * for word rounds (1 HP per wrong tap, no extra HP on timeout). A timeout with
 * zero wrong taps costs zero HP, matching the word rule that a timeout is at
 * most one HP loss (not additive on top of wrong-answer HP).
 */
function getSentenceLivesPatch(
  duel: Doc<"duels">,
  playerRole: PlayerRole,
  submission: SentenceRoundSubmission
): Partial<Doc<"duels">> {
  if (!isLivesAttempt(duel)) return {};
  const livesLost = Math.max(0, submission.mistakes);
  if (livesLost === 0) return {};

  const startingLives = typeof duel.livesRemaining === "number" ? duel.livesRemaining : undefined;
  const nextLives = startingLives === undefined
    ? undefined
    : Math.max(0, startingLives - livesLost);

  const flagPatch: Partial<Doc<"duels">> = playerRole === "challenger"
    ? { challengerPerfectRun: false }
    : { opponentPerfectRun: false };

  if (nextLives === undefined) return flagPatch;

  return {
    ...flagPatch,
    livesRemaining: nextLives,
    ...(nextLives === 0 ? getBossAttemptEndFields() : {}),
  };
}

/**
 * Build the patch that records a player's sentence-round submission. Reads
 * server-tracked tile sequence + mistakes — client input is not trusted. The
 * progress row is marked `finalized` so further taps are rejected.
 */
export function buildSentenceAnswerPatch(params: {
  duel: Doc<"duels">;
  playerRole: PlayerRole;
  isChallenger: boolean;
  timedOut: boolean;
  questionIndex: number;
}): Partial<Doc<"duels">> {
  const { duel, playerRole, isChallenger, timedOut, questionIndex } = params;
  const alreadyAnswered = isChallenger
    ? duel.challengerAnswered
    : duel.opponentAnswered;
  if (alreadyAnswered) return {};

  const submission = readServerSubmission(duel, questionIndex, playerRole, timedOut);
  const earned = scoreSentenceSubmission(submission);
  const livesPatch = getSentenceLivesPatch(duel, playerRole, submission);
  const finalizePatch = finalizeSentenceProgress(duel, questionIndex, playerRole);
  const lastAnswerMarker = submission.completed
    ? `sentence:${submission.mistakes}`
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
