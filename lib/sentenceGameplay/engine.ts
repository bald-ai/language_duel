/**
 * Pure sentence-round engine. Handles tile placement, repeated correct words,
 * normalization (text-equivalence between tiles), and per-player completion.
 * No React, no Convex — keeps the gameplay rules unit-testable.
 *
 * Repeated-word rule (decision: validation): when the correct sentence has a
 * repeated word, any identical available tile can satisfy the next matching
 * slot. Matching is text-equivalence after normalization, not tile-index
 * identity — tiles with the same text are interchangeable.
 */

import { hashSeed, seededShuffle } from "../prng";
import { normalizeForComparison } from "../stringUtils";
import { tokenizeSpanishSentence } from "../themes/sentenceValidation";
import type {
  SentenceQuestionSnapshot,
  SentenceRoundResult,
} from "./types";

/**
 * Build the deterministic tile pool for a sentence round at session creation.
 * Mirrors `buildDuelQuestionSnapshot`'s seeded-PRNG style so the server can
 * pre-build a stable per-position snapshot.
 */
export function buildSentenceQuestionSnapshot(args: {
  englishPrompt: string;
  spanishSentence: string;
  distractors: string[];
  /** Index into wordOrder — used as the seed namespace. */
  questionIndex: number;
}): SentenceQuestionSnapshot {
  const correctTokens = tokenizeSpanishSentence(args.spanishSentence);
  const tiles = [...correctTokens, ...args.distractors];
  const seed = hashSeed(`sentence::${args.spanishSentence}::${args.questionIndex}`);
  return {
    kind: "sentence",
    englishPrompt: args.englishPrompt,
    spanishSentence: args.spanishSentence,
    tilePool: seededShuffle(tiles, seed),
  };
}

/**
 * Local play state for one sentence round on a single player's board. Used by
 * the client and (for self-duel / single-player modes) by tests.
 *
 * `placedTileIndices` are indices into the snapshot's `tilePool` — server uses
 * the same indexing to validate the submitted sequence.
 */
export interface SentenceRoundState {
  /** Indices into the snapshot tilePool that are currently placed in order. */
  placedTileIndices: number[];
  /** Wrong-tap count for this round. */
  mistakes: number;
  /** True once the sentence is fully built correctly. */
  completed: boolean;
}

export function createInitialSentenceRoundState(): SentenceRoundState {
  return { placedTileIndices: [], mistakes: 0, completed: false };
}

export interface TapTileOutcome {
  state: SentenceRoundState;
  /** Whether this tap was accepted (correct). */
  accepted: boolean;
}

/**
 * Apply a tile tap to a per-player board. Already-placed tiles, completed
 * rounds, and out-of-range indices are no-ops (returned unchanged, not
 * accepted). A wrong tap increments mistakes; a correct tap advances. When the
 * sentence is complete, `state.completed` flips true.
 */
export function tapSentenceTile(
  state: SentenceRoundState,
  snapshot: SentenceQuestionSnapshot,
  tileIndex: number
): TapTileOutcome {
  if (state.completed) return { state, accepted: false };
  if (tileIndex < 0 || tileIndex >= snapshot.tilePool.length) {
    return { state, accepted: false };
  }
  if (state.placedTileIndices.includes(tileIndex)) {
    return { state, accepted: false };
  }

  const correctTokens = tokenizeSpanishSentence(snapshot.spanishSentence);
  const expectedToken = correctTokens[state.placedTileIndices.length];
  if (expectedToken === undefined) {
    // Sentence was complete but completed flag wasn't set — shouldn't happen,
    // but guard against off-by-one regressions.
    return { state, accepted: false };
  }

  const tappedTile = snapshot.tilePool[tileIndex];
  const tappedNormalized = normalizeForComparison(tappedTile);
  const expectedNormalized = normalizeForComparison(expectedToken);

  if (tappedNormalized !== expectedNormalized) {
    return {
      state: { ...state, mistakes: state.mistakes + 1 },
      accepted: false,
    };
  }

  const nextPlaced = [...state.placedTileIndices, tileIndex];
  const completed = nextPlaced.length === correctTokens.length;
  return {
    state: { ...state, placedTileIndices: nextPlaced, completed },
    accepted: true,
  };
}

/**
 * The canonical Spanish sentence assembled from the placed tile indices.
 * Used at the client to display the in-progress build and on the server to
 * validate the final submission.
 */
export function buildAssembledSentence(
  snapshot: SentenceQuestionSnapshot,
  placedTileIndices: number[]
): string {
  return placedTileIndices
    .map((index) => snapshot.tilePool[index])
    .filter((tile): tile is string => tile !== undefined)
    .join(" ");
}

/**
 * Server-side validation: given the placed tile sequence the client submits,
 * does it equal the canonical sentence after normalization? Identical-text
 * tiles are interchangeable.
 */
export function isSubmittedSentenceCorrect(
  snapshot: SentenceQuestionSnapshot,
  placedTileIndices: number[]
): boolean {
  const correctTokens = tokenizeSpanishSentence(snapshot.spanishSentence);
  if (placedTileIndices.length !== correctTokens.length) return false;

  const placedTokens = placedTileIndices.map((index) => snapshot.tilePool[index]);
  if (placedTokens.some((token) => token === undefined)) return false;

  for (let position = 0; position < correctTokens.length; position++) {
    const placed = normalizeForComparison(placedTokens[position] as string);
    const expected = normalizeForComparison(correctTokens[position]);
    if (placed !== expected) return false;
  }
  return true;
}

/** Result -> points (decision: sentence scoring). */
export function pointsForSentenceResult(
  result: SentenceRoundResult,
  perfect: number,
  withMistakes: number,
  timeout: number
): number {
  if (!result.completed) return timeout;
  return result.mistakes === 0 ? perfect : withMistakes;
}
