/**
 * Calculates difficulty distribution based on word count.
 * Equal thirds for each difficulty, remainder goes to easy.
 * 
 * Examples:
 * - 20 words: 8 easy / 6 medium / 6 hard
 * - 10 words: 4 easy / 3 medium / 3 hard
 * - 15 words: 7 easy / 4 medium / 4 hard
 */
export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
  easyEnd: number;    // First index after easy (exclusive)
  mediumEnd: number;  // First index after medium (exclusive)
  total: number;
}

export type ClassicDifficultyPreset =
  | "easy_only"
  | "easy_medium"
  | "progressive"
  | "medium_hard"
  | "hard_only";

function calculateProgressiveClassicDistribution(wordCount: number): DifficultyDistribution {
  const baseEasy = Math.floor(wordCount * 0.4);
  const baseMedium = Math.floor(wordCount * 0.3);
  const baseHard = Math.floor(wordCount * 0.3);

  const assigned = baseEasy + baseMedium + baseHard;
  const remainder = wordCount - assigned;

  let easy = baseEasy;
  let medium = baseMedium;
  let hard = baseHard;

  if (remainder >= 1) easy++;
  if (remainder >= 2) medium++;
  if (remainder >= 3) hard++;
  if (remainder >= 4) easy++;
  if (remainder >= 5) medium++;
  if (remainder >= 6) hard++;

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

/**
 * Get difficulty level for a specific question index
 */
export function getDifficultyForIndex(index: number, distribution: DifficultyDistribution): {
  level: "easy" | "medium" | "hard";
  points: number;
  wrongCount: number;
  optionCount: number;
} {
  if (index < distribution.easyEnd) {
    return { level: "easy", points: 1, wrongCount: 3, optionCount: 4 };
  }
  if (index < distribution.mediumEnd) {
    return { level: "medium", points: 1.5, wrongCount: 4, optionCount: 5 };
  }
  return { level: "hard", points: 2, wrongCount: 4, optionCount: 5 };
}

/**
 * Get points for correct answer at a specific question index
 */
export function getPointsForIndex(index: number, distribution: DifficultyDistribution): number {
  return getDifficultyForIndex(index, distribution).points;
}

/**
 * Check if a question index is in hard mode
 */
export function isHardMode(index: number, distribution: DifficultyDistribution): boolean {
  return index >= distribution.mediumEnd;
}
