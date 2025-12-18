import type { WordEntry } from "@/lib/types";
import { stripIrr } from "@/lib/stringUtils";

/**
 * Simple normalization that preserves accents but handles casing and spacing.
 */
export function relaxedNormalize(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Check if a word entry has duplicate wrong answers (relaxed: accents matter).
 */
export function hasDuplicateWrongAnswersInWord(word: WordEntry): boolean {
  const normalizedWrongs = word.wrongAnswers.map((wa) => relaxedNormalize(wa));
  const uniqueWrongs = new Set(normalizedWrongs);
  return uniqueWrongs.size !== word.wrongAnswers.length;
}

/**
 * Check if any wrong answer matches the correct answer (relaxed: accents matter).
 * Also strips (Irr) markers before comparison to prevent indistinguishable options.
 */
export function doesWrongAnswerMatchCorrect(word: WordEntry): boolean {
  const normalizedAnswer = relaxedNormalize(stripIrr(word.answer));
  return word.wrongAnswers.some(
    (wa) => relaxedNormalize(stripIrr(wa)) === normalizedAnswer
  );
}

/**
 * Check if a theme has duplicate wrong answers within any word.
 */
export function checkThemeForDuplicateWrongAnswers(words: WordEntry[]): boolean {
  return words.some((word) => hasDuplicateWrongAnswersInWord(word));
}

/**
 * Check if a theme has any wrong answers that match the correct answer.
 */
export function checkThemeForWrongMatchingAnswer(words: WordEntry[]): boolean {
  return words.some((word) => doesWrongAnswerMatchCorrect(word));
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

