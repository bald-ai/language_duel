import type { WordEntry } from "@/lib/types";
import { normalizeForComparison } from "@/lib/stringUtils";

/**
 * Accent-aware normalization used by theme validation.
 */
export function relaxedNormalize(str: string): string {
  return normalizeForComparison(str);
}

/**
 * Check if a word entry has duplicate wrong answers.
 */
export function hasDuplicateWrongAnswersInWord(word: WordEntry): boolean {
  const normalizedWrongs = word.wrongAnswers.map((wa) => relaxedNormalize(wa));
  const uniqueWrongs = new Set(normalizedWrongs);
  return uniqueWrongs.size !== word.wrongAnswers.length;
}

/**
 * Check if any wrong answer matches the correct answer.
 */
export function doesWrongAnswerMatchCorrect(word: WordEntry): boolean {
  const normalizedAnswer = relaxedNormalize(word.answer);
  return word.wrongAnswers.some((wa) => relaxedNormalize(wa) === normalizedAnswer);
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
 * Check if a theme has duplicate words.
 */
export function checkThemeForDuplicateWords(words: WordEntry[]): boolean {
  const wordSet = new Set<string>();
  for (const word of words) {
    const lowerWord = relaxedNormalize(word.word);
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
    const lowerWord = relaxedNormalize(word.word);
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
 * Check if a word already exists in the list.
 */
export function isWordDuplicate(word: string, existingWords: WordEntry[]): boolean {
  const normalizedWord = relaxedNormalize(word);
  return existingWords.some((w) => relaxedNormalize(w.word) === normalizedWord);
}
