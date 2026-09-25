import type { WordEntry } from "@/lib/types";
import { normalizeForComparison } from "@/lib/stringUtils";
import { collectThemeIssues } from "./serverValidation";
import { collectSentenceRoundIssues, formatSentenceRoundIssue, type SentenceRoundIssue } from "./sentenceValidation";
import type { SentenceRoundInput } from "./sentenceTypes";

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

export interface ThemeWordIssueIndices {
  duplicateWrongAnswerIndices: Set<number>;
  wrongMatchingAnswerIndices: Set<number>;
}

export interface ThemeIssueAnalysis {
  duplicateWordIndices: Set<number>;
  wordIssues: Map<number, ThemeWordIssueIndices>;
  repairIssue: ThemeRepairIssue | null;
}

/**
 * Single source of truth for theme repair UI: scans the words **once** with
 * `collectThemeIssues` and projects the result into the shapes the UI needs —
 * the duplicate-word index set, a per-word map of wrong-answer issue indices,
 * and the highest-priority repair issue. All other helpers select from this.
 */
export function analyzeThemeIssues(words: WordEntry[]): ThemeIssueAnalysis {
  const duplicateWordIndices = new Set<number>();
  const wordIssues = new Map<number, ThemeWordIssueIndices>();
  let hasDuplicateWord = false;
  let wrongMatchesAnswer = false;
  let hasDuplicateWrongAnswers = false;

  const wordIssuesAt = (wordIndex: number): ThemeWordIssueIndices => {
    let entry = wordIssues.get(wordIndex);
    if (!entry) {
      entry = {
        duplicateWrongAnswerIndices: new Set<number>(),
        wrongMatchingAnswerIndices: new Set<number>(),
      };
      wordIssues.set(wordIndex, entry);
    }
    return entry;
  };

  for (const issue of collectThemeIssues(words)) {
    if (issue.type === "duplicate_word") {
      duplicateWordIndices.add(issue.firstWordIndex);
      duplicateWordIndices.add(issue.secondWordIndex);
      hasDuplicateWord = true;
    } else if (issue.type === "duplicate_wrong_answer") {
      const entry = wordIssuesAt(issue.wordIndex);
      entry.duplicateWrongAnswerIndices.add(issue.firstWrongIndex);
      entry.duplicateWrongAnswerIndices.add(issue.secondWrongIndex);
      hasDuplicateWrongAnswers = true;
    } else if (issue.type === "wrong_answer_matches_correct") {
      wordIssuesAt(issue.wordIndex).wrongMatchingAnswerIndices.add(issue.wrongIndex);
      wrongMatchesAnswer = true;
    }
  }

  return {
    duplicateWordIndices,
    wordIssues,
    repairIssue: getThemeRepairIssueForFlags({
      hasDuplicateWord,
      wrongMatchesAnswer,
      hasDuplicateWrongAnswers,
    }),
  };
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
  return analyzeThemeIssues(words).repairIssue;
}

export function getThemeSaveErrorMessage(words: WordEntry[]): string | null {
  if (words.length === 0) {
    return EMPTY_THEME_SAVE_MESSAGE;
  }

  return getThemeRepairIssueForWords(words)?.saveToastMessage ?? null;
}

/**
 * Check if a word already exists in the list (accent/case/whitespace-insensitive).
 */
export function isWordDuplicate(word: string, existingWords: WordEntry[]): boolean {
  const normalized = normalizeForComparison(word);
  if (normalized === "") return false;
  return existingWords.some(
    (existing) => normalizeForComparison(existing.word) === normalized
  );
}

// ============================================================================
// Sentence Theme Repair Analysis
// ============================================================================

export interface SentenceRoundIssueIndices {
  englishHasIssue: boolean;
  spanishHasIssue: boolean;
  distractorHasIssue: Set<number>;
  /** First issue message for this round, short form for the card. */
  issueMessage: string | null;
  isDuplicate: boolean;
}

export interface SentenceThemeIssueAnalysis {
  perRound: Map<number, SentenceRoundIssueIndices>;
  hasAnyIssues: boolean;
  themeIssueMessage: string | null;
}

const SENTENCE_ISSUE_MESSAGES: Record<SentenceRoundIssue["type"], string> = {
  duplicate_round: "Duplicate sentence",
  distractor_matches_correct: "Distractor issue",
  distractor_duplicate: "Distractor issue",
  spanish_forbidden_punctuation: "Spanish sentence issue",
  spanish_too_few_tokens: "Spanish sentence issue",
  spanish_too_many_tokens: "Spanish sentence issue",
  spanish_token_too_long: "Spanish sentence issue",
  english_empty: "English prompt issue",
  english_too_long: "English prompt issue",
  distractor_count: "Distractor field issue",
  distractor_empty: "Distractor field issue",
  distractor_too_long: "Distractor field issue",
  distractor_has_space: "Distractor field issue",
  spanish_empty: "Spanish sentence missing",
  word_meanings_missing: "Word meanings missing",
  word_meanings_count: "Word meanings must match the Spanish words",
  free_word_position_invalid: "Invalid free word position",
};

type SentenceIssueField = "english" | "spanish" | "distractor";

const SENTENCE_ISSUE_FIELDS: Record<Exclude<SentenceRoundIssue["type"], "duplicate_round">, SentenceIssueField> = {
  english_empty: "english",
  english_too_long: "english",
  spanish_empty: "spanish",
  spanish_too_few_tokens: "spanish",
  spanish_too_many_tokens: "spanish",
  spanish_forbidden_punctuation: "spanish",
  spanish_token_too_long: "spanish",
  word_meanings_missing: "spanish",
  word_meanings_count: "spanish",
  free_word_position_invalid: "spanish",
  distractor_empty: "distractor",
  distractor_too_long: "distractor",
  distractor_has_space: "distractor",
  distractor_matches_correct: "distractor",
  distractor_duplicate: "distractor",
  distractor_count: "distractor",
};

function affectedDistractorIndices(issue: SentenceRoundIssue): number[] {
  if ("distractorIndex" in issue) return [issue.distractorIndex];
  if (issue.type === "distractor_duplicate") {
    return [issue.firstDistractorIndex, issue.secondDistractorIndex];
  }
  if (issue.type === "distractor_count") {
    // A count error highlights every present field, including excess fields.
    return Array.from({ length: issue.actualCount }, (_, index) => index);
  }
  return [];
}

function applySentenceIssue(slot: SentenceRoundIssueIndices, issue: SentenceRoundIssue): void {
  const field = issue.type === "duplicate_round" ? "spanish" : SENTENCE_ISSUE_FIELDS[issue.type];
  if (field === "english") slot.englishHasIssue = true;
  if (field === "spanish") slot.spanishHasIssue = true;
  if (issue.type === "duplicate_round") slot.isDuplicate = true;
  for (const index of affectedDistractorIndices(issue)) slot.distractorHasIssue.add(index);
  // Collector order determines the first error shown on each card.
  if (slot.issueMessage === null) slot.issueMessage = SENTENCE_ISSUE_MESSAGES[issue.type];
}

export function analyzeSentenceThemeIssues(
  rounds: SentenceRoundInput[]
): SentenceThemeIssueAnalysis {
  const perRound = new Map<number, SentenceRoundIssueIndices>();
  const issues = collectSentenceRoundIssues(rounds);
  for (const issue of issues) {
    const indices = issue.type === "duplicate_round"
      ? [issue.firstRoundIndex, issue.secondRoundIndex]
      : [issue.roundIndex];
    for (const index of indices) {
      let slot = perRound.get(index);
      if (!slot) {
        slot = {
          englishHasIssue: false,
          spanishHasIssue: false,
          distractorHasIssue: new Set<number>(),
          issueMessage: null,
          isDuplicate: false,
        };
        perRound.set(index, slot);
      }
      applySentenceIssue(slot, issue);
    }
  }

  return {
    perRound,
    hasAnyIssues: issues.length > 0,
    themeIssueMessage: issues.length > 0 ? formatSentenceRoundIssue(issues[0]) : null,
  };
}

export function getSentenceThemeSaveErrorMessage(
  rounds: SentenceRoundInput[]
): string | null {
  if (rounds.length === 0) {
    return "Add at least one sentence before saving this theme.";
  }
  return analyzeSentenceThemeIssues(rounds).themeIssueMessage;
}
