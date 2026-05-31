/**
 * Pure types + resolver for the cooperative PvE sentence hint pool. Mirrors the
 * word hint pool (`lib/hintPool/rules.ts`) but its effects are shaped for the
 * build-and-confirm tile board: tile-index eliminations and per-slot reveals
 * instead of option strings.
 *
 * No React, no Convex — the `fireSentenceHint` mutation calls `resolveSentenceHint`
 * with the server-side answer key, and the board renders the resulting effect.
 *
 * Three hints (decision: PvE sentence tools):
 *  1. freeze_time      → +30s (the universal +10s plus a dedicated +20s)
 *  2. remove_distractor → grey out every decoy tile (+10s)
 *  3. reveal_tiles      → mark 2 correct slots + the tiles that fill them (+10s)
 */

import { seededShuffle } from "../prng";
import { normalizeForComparison } from "../stringUtils";
import { tokenizeSpanishSentence } from "../themes/sentenceValidation";

export const SENTENCE_HINT_TYPES = [
  "freeze_time",
  "remove_distractor",
  "reveal_tiles",
] as const;
export type SentenceHintType = (typeof SENTENCE_HINT_TYPES)[number];

// Every sentence hint grants this universal time bump (mirrors the word pool's
// +5, scaled up for the longer 60s sentence round). Decision Q5.
export const SENTENCE_HINT_UNIVERSAL_TIMER_BONUS_SECONDS = 10;
// The freeze hint adds this ON TOP of the universal bump → 10 + 20 = 30s total.
export const SENTENCE_HINT_FREEZE_EXTRA_SECONDS = 20;
// reveal_tiles marks at most this many slots (clamped to tokenCount − 1 so a
// short sentence is never fully solved). Decision Q9 allows any slot, incl. 1.
export const SENTENCE_HINT_REVEAL_COUNT = 2;
export const SENTENCE_HINT_POOL_SIZE = SENTENCE_HINT_TYPES.length; // 3

/**
 * A revealed slot. Keyed by POSITION (slot), not a single tile: repeated words
 * make several pool tiles equally valid for one slot, so `tileIndices` lists
 * every pool tile whose normalized text fills this slot.
 */
export type SentenceTileReveal = { position: number; tileIndices: number[] };

export type SentenceHintEffect = {
  type: SentenceHintType;
  /** 30 for freeze_time, else the universal 10. */
  timerBonusSeconds: number;
  /** remove_distractor: every decoy pool index (minus already-eliminated). */
  eliminatedTileIndices: number[];
  /** reveal_tiles: the marked slots and the pool indices that fill each. */
  revealedTiles: SentenceTileReveal[];
};

/**
 * Map each correct-token position → the set of pool indices that fill it, using
 * the SAME tokenize + normalizeForComparison as `confirmSentenceRound`, so a
 * "valid tile for slot" matches exactly what Confirm accepts. Pool indices whose
 * normalized text fills no slot are distractors.
 */
export function buildTileSolution(
  tilePool: string[],
  spanishSentence: string
): {
  /** index = slot, value = all valid pool indices for that slot. */
  positionToTileIndices: number[][];
  distractorTileIndices: number[];
} {
  const correctTokens = tokenizeSpanishSentence(spanishSentence);
  const normalizedPool = tilePool.map((tile) => normalizeForComparison(tile));

  const positionToTileIndices = correctTokens.map((token) => {
    const target = normalizeForComparison(token);
    const matches: number[] = [];
    normalizedPool.forEach((normalized, index) => {
      if (normalized === target) matches.push(index);
    });
    return matches;
  });

  const correctNormalized = new Set(
    correctTokens.map((token) => normalizeForComparison(token))
  );
  const distractorTileIndices: number[] = [];
  normalizedPool.forEach((normalized, index) => {
    if (!correctNormalized.has(normalized)) distractorTileIndices.push(index);
  });

  return { positionToTileIndices, distractorTileIndices };
}

/**
 * Resolve one fired hint into a concrete effect. Pure + deterministic: the same
 * `seed` always picks the same reveal slots, so both co-op players see identical
 * marks and a re-fire is stable.
 *
 * Every hint grants the universal +10s bump (Q5); freeze_time stacks +20s more.
 */
export function resolveSentenceHint(
  type: SentenceHintType,
  args: {
    tilePool: string[];
    spanishSentence: string;
    alreadyEliminated: number[];
    seed: number;
  }
): SentenceHintEffect {
  const base: SentenceHintEffect = {
    type,
    timerBonusSeconds: SENTENCE_HINT_UNIVERSAL_TIMER_BONUS_SECONDS,
    eliminatedTileIndices: [],
    revealedTiles: [],
  };

  if (type === "freeze_time") {
    return {
      ...base,
      timerBonusSeconds:
        SENTENCE_HINT_UNIVERSAL_TIMER_BONUS_SECONDS +
        SENTENCE_HINT_FREEZE_EXTRA_SECONDS,
    };
  }

  const { positionToTileIndices, distractorTileIndices } = buildTileSolution(
    args.tilePool,
    args.spanishSentence
  );

  if (type === "remove_distractor") {
    const alreadyEliminated = new Set(args.alreadyEliminated);
    return {
      ...base,
      eliminatedTileIndices: distractorTileIndices.filter(
        (index) => !alreadyEliminated.has(index)
      ),
    };
  }

  // reveal_tiles: pick `min(REVEAL_COUNT, tokenCount − 1)` seeded slots so a
  // short sentence is never fully solved, then carry each slot's valid tiles.
  const tokenCount = positionToTileIndices.length;
  const revealCount = Math.min(
    SENTENCE_HINT_REVEAL_COUNT,
    Math.max(0, tokenCount - 1)
  );
  const allPositions = positionToTileIndices.map((_, position) => position);
  const chosenPositions = seededShuffle(allPositions, args.seed)
    .slice(0, revealCount)
    .sort((a, b) => a - b);

  return {
    ...base,
    revealedTiles: chosenPositions.map((position) => ({
      position,
      tileIndices: positionToTileIndices[position],
    })),
  };
}
