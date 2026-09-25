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

