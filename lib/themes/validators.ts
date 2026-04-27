import type { WordEntry } from "@/lib/types";
import { normalizeForComparison } from "@/lib/stringUtils";

export type ThemeRepairIssueType =
  | "duplicate_word"
  | "wrong_answer_matches_correct"
  | "duplicate_wrong_answers";

interface ThemeRepairIssueDefinition {
  type: ThemeRepairIssueType;
  cardMessage: string;
  saveToastMessage: string;
}

export interface ThemeRepairIssue {
  type: ThemeRepairIssueType;
  cardMessage: string;
  saveToastMessage: string;
  priority: number;
}

export const EMPTY_THEME_SAVE_MESSAGE =
  "Add at least one word before saving this theme.";

const THEME_REPAIR_ISSUE_PRIORITY: readonly ThemeRepairIssueDefinition[] = [
  {
    type: "duplicate_word",
    cardMessage: "Duplicate word",
    saveToastMessage:
      "Cannot save: This theme has duplicate words. Please fix the highlighted word cards before saving.",
  },
  {
    type: "wrong_answer_matches_correct",
    cardMessage: "Wrong answer matches correct answer",
    saveToastMessage:
      "Cannot save: One or more wrong answers match the correct answer. Please fix the highlighted fields before saving.",
  },
  {
    type: "duplicate_wrong_answers",
    cardMessage: "Duplicate wrong answers",
    saveToastMessage:
      "Cannot save: This theme has duplicate wrong answers. Please fix the highlighted wrong answers before saving.",
  },
] as const;

/**
 * Accent-aware normalization used by theme validation.
 */
export function relaxedNormalize(str: string): string {
  return normalizeForComparison(str);
}

/**
 * Get indices of wrong answers that duplicate another wrong answer.
 */
export function getDuplicateWrongAnswerIndices(word: WordEntry): Set<number> {
  const wrongAnswerMap = new Map<string, number[]>();

  word.wrongAnswers.forEach((wrongAnswer, index) => {
    const normalizedWrongAnswer = relaxedNormalize(wrongAnswer);
    if (!wrongAnswerMap.has(normalizedWrongAnswer)) {
      wrongAnswerMap.set(normalizedWrongAnswer, []);
    }
    wrongAnswerMap.get(normalizedWrongAnswer)!.push(index);
  });

  const duplicateIndices = new Set<number>();
  for (const indices of wrongAnswerMap.values()) {
    if (indices.length > 1) {
      indices.forEach((index) => duplicateIndices.add(index));
    }
  }

  return duplicateIndices;
}

/**
 * Check if a word entry has duplicate wrong answers.
 */
export function hasDuplicateWrongAnswersInWord(word: WordEntry): boolean {
  return getDuplicateWrongAnswerIndices(word).size > 0;
}

/**
 * Get indices of wrong answers that match the correct answer.
 */
export function getWrongIndicesMatchingAnswer(word: WordEntry): Set<number> {
  const normalizedAnswer = relaxedNormalize(word.answer);
  const matchingIndices = new Set<number>();

  word.wrongAnswers.forEach((wrongAnswer, index) => {
    if (relaxedNormalize(wrongAnswer) === normalizedAnswer) {
      matchingIndices.add(index);
    }
  });

  return matchingIndices;
}

/**
 * Check if any wrong answer matches the correct answer.
 */
export function doesWrongAnswerMatchCorrect(word: WordEntry): boolean {
  return getWrongIndicesMatchingAnswer(word).size > 0;
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

export function getThemeRepairIssueForFlags(flags: {
  hasDuplicateWord: boolean;
  wrongMatchesAnswer: boolean;
  hasDuplicateWrongAnswers: boolean;
}): ThemeRepairIssue | null {
  const issue = THEME_REPAIR_ISSUE_PRIORITY.find((definition) => {
    if (definition.type === "duplicate_word") return flags.hasDuplicateWord;
    if (definition.type === "wrong_answer_matches_correct") return flags.wrongMatchesAnswer;
    return flags.hasDuplicateWrongAnswers;
  });

  if (!issue) return null;

  return {
    ...issue,
    priority: THEME_REPAIR_ISSUE_PRIORITY.indexOf(issue),
  };
}

export function getThemeRepairIssueForWords(words: WordEntry[]): ThemeRepairIssue | null {
  return getThemeRepairIssueForFlags({
    hasDuplicateWord: checkThemeForDuplicateWords(words),
    wrongMatchesAnswer: checkThemeForWrongMatchingAnswer(words),
    hasDuplicateWrongAnswers: checkThemeForDuplicateWrongAnswers(words),
  });
}

export function getThemeSaveErrorMessage(words: WordEntry[]): string | null {
  if (words.length === 0) {
    return EMPTY_THEME_SAVE_MESSAGE;
  }

  return getThemeRepairIssueForWords(words)?.saveToastMessage ?? null;
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
