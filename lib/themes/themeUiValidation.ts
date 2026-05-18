import type { WordEntry } from "@/lib/types";
import { collectThemeIssues, type ThemeValidationIssue } from "./serverValidation";

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

function getThemeRepairIssues(words: WordEntry[]): ThemeValidationIssue[] {
  return collectThemeIssues(words).filter((issue) =>
    issue.type === "duplicate_word" ||
    issue.type === "wrong_answer_matches_correct" ||
    issue.type === "duplicate_wrong_answer"
  );
}

export function getDuplicateWrongAnswerIndices(word: WordEntry): Set<number> {
  const duplicateIndices = new Set<number>();
  collectThemeIssues([word]).forEach((issue) => {
    if (issue.type === "duplicate_wrong_answer") {
      duplicateIndices.add(issue.firstWrongIndex);
      duplicateIndices.add(issue.secondWrongIndex);
    }
  });
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
  const matchingIndices = new Set<number>();
  collectThemeIssues([word]).forEach((issue) => {
    if (issue.type === "wrong_answer_matches_correct") {
      matchingIndices.add(issue.wrongIndex);
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
  return getThemeRepairIssues(words).some((issue) => issue.type === "duplicate_wrong_answer");
}

/**
 * Check if a theme has any wrong answers that match the correct answer.
 */
export function checkThemeForWrongMatchingAnswer(words: WordEntry[]): boolean {
  return getThemeRepairIssues(words).some((issue) => issue.type === "wrong_answer_matches_correct");
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
  return getThemeRepairIssues(words).some((issue) => issue.type === "duplicate_word");
}

/**
 * Get indices of duplicate words in theme.
 */
export function getDuplicateWordIndices(words: WordEntry[]): Set<number> {
  const duplicateIndices = new Set<number>();
  collectThemeIssues(words).forEach((issue) => {
    if (issue.type === "duplicate_word") {
      duplicateIndices.add(issue.firstWordIndex);
      duplicateIndices.add(issue.secondWordIndex);
    }
  });
  return duplicateIndices;
}

/**
 * Check if a word already exists in the list.
 */
export function isWordDuplicate(word: string, existingWords: WordEntry[]): boolean {
  // The extra fields only make the temporary word valid for collectThemeIssues;
  // duplicate-word detection only reads the word value.
  const candidate: WordEntry = {
    word,
    answer: "candidate",
    wrongAnswers: ["first", "second", "third"],
  };
  return collectThemeIssues([candidate, ...existingWords]).some(
    (issue) =>
      issue.type === "duplicate_word" &&
      issue.firstWordIndex === 0 &&
      issue.secondWordIndex > 0
  );
}
