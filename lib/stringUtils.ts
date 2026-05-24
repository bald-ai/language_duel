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
 * Indices of the non-space characters in an answer (after stripping the (Irr)
 * marker). These are the positions a learner can reveal one letter at a time;
 * spaces are skipped because they are shown for free.
 */
export const revealablePositions = (answer: string): number[] =>
  stripIrr(answer)
    .split("")
    .map((char, idx) => (char !== " " ? idx : -1))
    .filter((idx) => idx !== -1);

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

export interface LetterSlot {
  char: string;
  originalIndex: number;
}

/**
 * Build typeable letter slots from a cleaned answer, skipping spaces and
 * keeping each kept letter's original index within the answer.
 */
export const buildLetterSlots = (cleanAnswer: string): LetterSlot[] => {
  const slots: LetterSlot[] = [];
  cleanAnswer.split("").forEach((char, idx) => {
    if (char !== " ") {
      slots.push({ char: char.toLowerCase(), originalIndex: idx });
    }
  });
  return slots;
};

/**
 * Bucket letter slots into per-word groups. A word boundary is a gap of more
 * than one in the slots' original indices (i.e. one or more skipped spaces).
 * Pure so the grouping is unit-testable without React.
 */
export const groupSlotsByWord = (slots: LetterSlot[]): LetterSlot[][] => {
  const words: LetterSlot[][] = [];
  let current: LetterSlot[] = [];
  let lastOriginalIndex = -1;
  slots.forEach((slot) => {
    if (lastOriginalIndex !== -1 && slot.originalIndex - lastOriginalIndex > 1 && current.length > 0) {
      words.push(current);
      current = [];
    }
    current.push(slot);
    lastOriginalIndex = slot.originalIndex;
  });
  if (current.length > 0) words.push(current);
  return words;
};
