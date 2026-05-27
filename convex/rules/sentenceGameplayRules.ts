/**
 * Pure server-side rules for sentence rounds. Mirrors `duelGameplayRules.ts`'s
 * shape: pure functions return `Partial<Doc<"duels">>` patches that the mutation
 * layer applies.
 *
 * Scope (v1): each player builds their own sentence locally and submits a
 * final result `{ completed, mistakes }`. The server scores per the
 * clean-vs-mistakes tier and advances the round once both players have
 * submitted. PvE shared-board taps and PvP sabotages are out of scope here.
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
 * Deduct one HP per wrong tile on lives-tracked attempts (boss / SR), and
 * end the boss attempt inline when lives hit 0 — exactly like
 * `getLimitedLivesMissPatch` for word rounds, but scaled by mistake count
 * (plan: "if a word wrong choice loses 1 HP, a sentence wrong tile loses 1
 * HP"). A failed sentence (timeout / abandon) costs one extra HP for the
 * round itself, so a clean-but-unfinished round still drops a life.
 */
function getSentenceLivesPatch(
  duel: Doc<"duels">,
  playerRole: PlayerRole,
  submission: SentenceRoundSubmission
): Partial<Doc<"duels">> {
  if (!isLivesAttempt(duel)) return {};
  const livesLost = Math.max(0, submission.mistakes) + (submission.completed ? 0 : 1);
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
 * Build the patch that records a player's sentence-round submission. Mirrors
 * `buildAnswerPatch` for words: stores the per-player answered flag, updates
 * score, records the last-answer marker, and reflects lives lost.
 */
export function buildSentenceAnswerPatch(params: {
  duel: Doc<"duels">;
  playerRole: PlayerRole;
  isChallenger: boolean;
  submission: SentenceRoundSubmission;
}): Partial<Doc<"duels">> {
  const { duel, playerRole, isChallenger, submission } = params;
  const alreadyAnswered = isChallenger
    ? duel.challengerAnswered
    : duel.opponentAnswered;
  if (alreadyAnswered) return {};

  const earned = scoreSentenceSubmission(submission);
  const livesPatch = getSentenceLivesPatch(duel, playerRole, submission);
  const lastAnswerMarker = submission.completed
    ? `sentence:${submission.mistakes}`
    : TIMEOUT_ANSWER;

  return mirrorPatchForSelfDuel(
    isChallenger
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
        },
    duel
  );
}

export function validateSentenceSubmission(submission: SentenceRoundSubmission) {
  if (typeof submission.completed !== "boolean") {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Sentence submission requires a boolean `completed`",
    });
  }
  if (
    typeof submission.mistakes !== "number" ||
    !Number.isInteger(submission.mistakes) ||
    submission.mistakes < 0
  ) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Sentence submission requires non-negative integer `mistakes`",
    });
  }
}

/**
 * Test seam: avoid importing the entire scoring rules barrel just to detect
 * boss completion in the answer flow. Re-export so the mutation layer doesn't
 * need both files.
 */
export { isBossAttempt };
