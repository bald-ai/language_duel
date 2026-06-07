/**
 * Pure shuffle helpers for building duel/session item order.
 * No database access; easily testable.
 */

/**
 * Fisher-Yates shuffle for an array (non-deterministic).
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Create a shuffled item-index order for a duel/session.
 */
export function createShuffledItemOrder(itemCount: number): number[] {
  const indices = Array.from({ length: itemCount }, (_, i) => i);
  return shuffleArray(indices);
}
