/**
 * Pure sentence-round helpers: building the seeded tile pool, assembling the
 * placed sequence, and validating a submitted sentence. No React, no Convex —
 * keeps the gameplay rules unit-testable.
 *
 * Repeated-word rule (decision: validation): when the correct sentence has a
 * repeated word, any identical available tile can satisfy the matching slot.
 * Matching is text-equivalence after normalization, not tile-index identity —
 * tiles with the same text are interchangeable.
 */

import { hashSeed, seededShuffle } from "../prng";
import { normalizeForComparison } from "../stringUtils";
import {
  normalizeSentenceFreeWordPositions,
  normalizeSentenceWordMeanings,
  tokenizeSpanishSentence,
} from "../themes/sentenceValidation";
import { SENTENCE_WORD_MEANING_PLACEHOLDER } from "../themes/sentenceConstants";
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
  wordMeanings?: string[];
  freeWordPositions?: number[];
  distractors: string[];
  /** Index into itemOrder — used as the seed namespace. */
  questionIndex: number;
  /**
   * How many of the stored decoys to actually show (decision: sentence
   * difficulty). Omitted → show every stored decoy, so non-difficulty callers
   * and the default tile shape stay unchanged. When set, the decoys are
   * seed-shuffled (same trick word rounds use) and the first N taken, clamped to
   * how many we store. Callers read N from SENTENCE_DISTRACTOR_COUNT_BY_LEVEL —
   * never a literal.
   */
  distractorCount?: number;
}): SentenceQuestionSnapshot {
  const correctTokens = tokenizeSpanishSentence(args.spanishSentence);
  const wordMeanings = normalizeSentenceWordMeanings(
    args.spanishSentence,
    args.wordMeanings
  );
  const freeWordPositionSet = new Set(
    normalizeSentenceFreeWordPositions(args.spanishSentence, args.freeWordPositions)
  );

  const shownDistractors =
    args.distractorCount === undefined
      ? args.distractors
      : seededShuffle(
          args.distractors,
          hashSeed(`sentence::${args.spanishSentence}::${args.questionIndex}::distractors`)
        ).slice(0, Math.min(Math.max(args.distractorCount, 0), args.distractors.length));

  const tiles = [
    ...correctTokens.map((text, tokenIndex) => {
      const meaning = wordMeanings[tokenIndex]?.trim();
      return {
        text,
        meaning:
          freeWordPositionSet.has(tokenIndex) &&
          meaning &&
          meaning !== SENTENCE_WORD_MEANING_PLACEHOLDER
            ? meaning
            : null,
      };
    }),
    ...shownDistractors.map((text) => ({ text, meaning: null })),
  ];
  const seed = hashSeed(`sentence::${args.spanishSentence}::${args.questionIndex}`);
  const shuffledTiles = seededShuffle(tiles, seed);
  return {
    kind: "sentence",
    englishPrompt: args.englishPrompt,
    spanishSentence: args.spanishSentence,
    tilePool: shuffledTiles.map((tile) => tile.text),
    tileMeanings: shuffledTiles.map((tile) => tile.meaning),
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
