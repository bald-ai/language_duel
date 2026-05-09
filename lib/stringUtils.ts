/**
 * String utility functions for text normalization.
 */

/**
 * Strips the (Irr) marker from verbs
 */
export const stripIrr = (str: string): string => {
  return str
    .replace(/\(irr\)$/i, "") // Strip (Irr) marker (case-insensitive)
    .trim();
};

/**
 * Shared normalization for answer-style comparisons.
 * Removes accents, lowercases, trims, and collapses internal whitespace.
 */
export const normalizeForComparison = (
  str: string,
  options?: { stripIrregularMarker?: boolean }
): string => {
  const baseValue = options?.stripIrregularMarker === false ? str : stripIrr(str);

  return baseValue
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
};

/**
 * Normalize accented characters for comparison.
 * Kept for existing answer-checking flows.
 */
export const normalizeAccents = (str: string): string => {
  return normalizeForComparison(str);
};
