import { getDifficultyForIndex } from "./difficultyUtils";
import type { DifficultyDistribution } from "./difficultyUtils";

/**
 * Calculate the maximum possible score for a given number of questions.
 * Sums up the points available for each question based on difficulty.
 */
export function calculateMaxScore(
  questionCount: number,
  distribution: DifficultyDistribution
): number {
  let total = 0;
  for (let i = 0; i < questionCount; i++) {
    const diff = getDifficultyForIndex(i, distribution);
    total += diff.points;
  }
  return total;
}

/**
 * Calculate success rate as a percentage.
 * Returns 0 if maxScore is 0 to avoid division by zero.
 */
export function calculateSuccessRate(
  score: number,
  maxScore: number
): number {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 100);
}

/**
 * Calculate accuracy as a percentage.
 * Returns 0 if total is 0 to avoid division by zero.
 */
export function calculateAccuracy(
  correct: number,
  total: number
): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

