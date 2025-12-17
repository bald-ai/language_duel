import type { WordEntry } from "@/lib/types";

/**
 * Check if a theme has duplicate wrong answers within any word.
 */
export function checkThemeForDuplicateWrongAnswers(words: WordEntry[]): boolean {
  for (const word of words) {
    const uniqueWrongs = new Set(word.wrongAnswers);
    if (uniqueWrongs.size !== word.wrongAnswers.length) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a theme has duplicate words (same English word appearing multiple times).
 */
export function checkThemeForDuplicateWords(words: WordEntry[]): boolean {
  const wordSet = new Set<string>();
  for (const word of words) {
    const lowerWord = word.word.toLowerCase().trim();
    if (wordSet.has(lowerWord)) {
      return true;
    }
    wordSet.add(lowerWord);
  }
  return false;
}

/**
 * Get indices of duplicate words in theme.
 */
export function getDuplicateWordIndices(words: WordEntry[]): Set<number> {
  const wordMap = new Map<string, number[]>();
  words.forEach((word, index) => {
    const lowerWord = word.word.toLowerCase().trim();
    if (!wordMap.has(lowerWord)) {
      wordMap.set(lowerWord, []);
    }
    wordMap.get(lowerWord)!.push(index);
  });

  const duplicateIndices = new Set<number>();
  for (const indices of wordMap.values()) {
    if (indices.length > 1) {
      indices.forEach((idx) => duplicateIndices.add(idx));
    }
  }
  return duplicateIndices;
}

/**
 * Check if a word already exists in the list (case-insensitive).
 */
export function isWordDuplicate(word: string, existingWords: WordEntry[]): boolean {
  const normalizedWord = word.toLowerCase().trim();
  return existingWords.some((w) => w.word.toLowerCase().trim() === normalizedWord);
}

