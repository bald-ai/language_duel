/**
 * Calculates difficulty distribution based on word count.
 * Equal thirds for each difficulty, remainder goes to easy.
 *
 * Examples:
 * - 20 words: 8 easy / 6 medium / 6 hard
 * - 10 words: 4 easy / 3 medium / 3 hard
 * - 15 words: 7 easy / 4 medium / 4 hard
 */

// ============================================================================
// Difficulty Configuration Constants
// ============================================================================

/** Points awarded per difficulty level */
export const DIFFICULTY_POINTS = {
  easy: 1,
  medium: 1.5,
  hard: 2,
} as const;

/** Number of wrong answer options per difficulty level */
export const DIFFICULTY_WRONG_COUNT = {
  easy: 3,
  medium: 4,
  hard: 4,
} as const;

/** Total number of answer options (correct + wrong) per difficulty level */
export const DIFFICULTY_OPTION_COUNT = {
  easy: 4,
  medium: 5,
  hard: 5,
} as const;

/** Progressive distribution ratios (40/30/30 split) */
export const PROGRESSIVE_RATIOS = {
  easy: 0.4,
  medium: 0.3,
  hard: 0.3,
} as const;

// ============================================================================
// Types
// ============================================================================

import type { DifficultyLevel, DifficultyInfo } from "./types";
export type { DifficultyLevel, DifficultyInfo };

export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
  easyEnd: number; // First index after easy (exclusive)
  mediumEnd: number; // First index after medium (exclusive)
  total: number;
}

export type ClassicDifficultyPreset =
  | "easy_only"
  | "easy_medium"
  | "progressive"
  | "medium_hard"
  | "hard_only";

// ============================================================================
// Distribution Calculators
// ============================================================================

function calculateProgressiveClassicDistribution(wordCount: number): DifficultyDistribution {
  const baseEasy = Math.floor(wordCount * PROGRESSIVE_RATIOS.easy);
  const baseMedium = Math.floor(wordCount * PROGRESSIVE_RATIOS.medium);
  const baseHard = Math.floor(wordCount * PROGRESSIVE_RATIOS.hard);

  const assigned = baseEasy + baseMedium + baseHard;
  const remainder = wordCount - assigned;

  // Distribute remainder in round-robin: easy -> medium -> hard
  const distribution = [baseEasy, baseMedium, baseHard];
  for (let i = 0; i < remainder; i++) {
    distribution[i % 3]++;
  }

  const [easy, medium, hard] = distribution;

  return {
    easy,
    medium,
    hard,
    easyEnd: easy,
    mediumEnd: easy + medium,
    total: wordCount,
  };
}

export function calculateClassicDifficultyDistribution(
  wordCount: number,
  preset: ClassicDifficultyPreset = "progressive"
): DifficultyDistribution {
  if (wordCount <= 0) {
    return { easy: 0, medium: 0, hard: 0, easyEnd: 0, mediumEnd: 0, total: 0 };
  }

  switch (preset) {
    case "easy_only": {
      const easy = wordCount;
      return { easy, medium: 0, hard: 0, easyEnd: easy, mediumEnd: easy, total: wordCount };
    }
    case "easy_medium": {
      const easy = Math.ceil(wordCount / 2);
      const medium = wordCount - easy;
      return { easy, medium, hard: 0, easyEnd: easy, mediumEnd: easy + medium, total: wordCount };
    }
    case "medium_hard": {
      const medium = Math.ceil(wordCount / 2);
      const hard = wordCount - medium;
      return { easy: 0, medium, hard, easyEnd: 0, mediumEnd: medium, total: wordCount };
    }
    case "hard_only": {
      const hard = wordCount;
      return { easy: 0, medium: 0, hard, easyEnd: 0, mediumEnd: 0, total: wordCount };
    }
    case "progressive":
    default:
      return calculateProgressiveClassicDistribution(wordCount);
  }
}

// Backwards-compatible helper for non-classic flows.
export function calculateDifficultyDistribution(wordCount: number): DifficultyDistribution {
  return calculateClassicDifficultyDistribution(wordCount, "progressive");
}

// ============================================================================
// Index-based Difficulty Lookup
// ============================================================================

/**
 * Get difficulty level for a specific question index
 */
export function getDifficultyForIndex(
  index: number,
  distribution: DifficultyDistribution
): DifficultyInfo {
  if (index < distribution.easyEnd) {
    return {
      level: "easy",
      points: DIFFICULTY_POINTS.easy,
      wrongCount: DIFFICULTY_WRONG_COUNT.easy,
      optionCount: DIFFICULTY_OPTION_COUNT.easy,
    };
  }
  if (index < distribution.mediumEnd) {
    return {
      level: "medium",
      points: DIFFICULTY_POINTS.medium,
      wrongCount: DIFFICULTY_WRONG_COUNT.medium,
      optionCount: DIFFICULTY_OPTION_COUNT.medium,
    };
  }
  return {
    level: "hard",
    points: DIFFICULTY_POINTS.hard,
    wrongCount: DIFFICULTY_WRONG_COUNT.hard,
    optionCount: DIFFICULTY_OPTION_COUNT.hard,
  };
}
