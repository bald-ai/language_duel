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

export function calculateDifficultyDistribution(wordCount: number): DifficultyDistribution {
  if (wordCount <= 0) {
    return { easy: 0, medium: 0, hard: 0, easyEnd: 0, mediumEnd: 0, total: 0 };
  }

  // Equal thirds, remainder goes to easy
  const base = Math.floor(wordCount / 3);
  const remainder = wordCount % 3;
  
  const easy = base + remainder;
  const medium = base;
  const hard = base;
  
  return {
    easy,
    medium,
    hard,
    easyEnd: easy,                    // Questions 0 to (easy-1) are easy
    mediumEnd: easy + medium,         // Questions easy to (easy+medium-1) are medium
    total: wordCount,
  };
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
