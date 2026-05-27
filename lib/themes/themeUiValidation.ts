import type { WordEntry } from "@/lib/types";
import { normalizeForComparison } from "@/lib/stringUtils";
import { collectThemeIssues } from "./serverValidation";
import { collectSentenceRoundIssues, formatSentenceRoundIssue } from "./sentenceValidation";
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

export function getDuplicateWrongAnswerIndices(word: WordEntry): Set<number> {
  return analyzeThemeIssues([word]).wordIssues.get(0)?.duplicateWrongAnswerIndices ?? new Set();
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
  return analyzeThemeIssues([word]).wordIssues.get(0)?.wrongMatchingAnswerIndices ?? new Set();
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
  return [...analyzeThemeIssues(words).wordIssues.values()].some(
    (issues) => issues.duplicateWrongAnswerIndices.size > 0
  );
}

/**
 * Check if a theme has any wrong answers that match the correct answer.
 */
export function checkThemeForWrongMatchingAnswer(words: WordEntry[]): boolean {
  return [...analyzeThemeIssues(words).wordIssues.values()].some(
    (issues) => issues.wrongMatchingAnswerIndices.size > 0
  );
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
 * Check if a theme has duplicate words.
 */
export function checkThemeForDuplicateWords(words: WordEntry[]): boolean {
  return analyzeThemeIssues(words).duplicateWordIndices.size > 0;
}

/**
 * Get indices of duplicate words in theme.
 */
export function getDuplicateWordIndices(words: WordEntry[]): Set<number> {
  return analyzeThemeIssues(words).duplicateWordIndices;
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

const SENTENCE_THEME_REPAIR_PRIORITY = [
  {
    matcher: (type: string) => type === "duplicate_round",
    cardMessage: "Duplicate sentence",
  },
  {
    matcher: (type: string) =>
      type === "distractor_matches_correct" || type === "distractor_duplicate",
    cardMessage: "Distractor issue",
  },
  {
    matcher: (type: string) =>
      type === "spanish_forbidden_punctuation" ||
      type === "spanish_too_few_tokens" ||
      type === "spanish_too_many_tokens" ||
      type === "spanish_token_too_long",
    cardMessage: "Spanish sentence issue",
  },
  {
    matcher: (type: string) =>
      type === "english_empty" || type === "english_too_long",
    cardMessage: "English prompt issue",
  },
  {
    matcher: (type: string) =>
      type === "distractor_count" ||
      type === "distractor_empty" ||
      type === "distractor_too_long" ||
      type === "distractor_has_space",
    cardMessage: "Distractor field issue",
  },
  {
    matcher: (type: string) => type === "spanish_empty",
    cardMessage: "Spanish sentence missing",
  },
] as const;

function cardMessageForIssueType(type: string): string {
  const entry = SENTENCE_THEME_REPAIR_PRIORITY.find((definition) => definition.matcher(type));
  return entry?.cardMessage ?? "Issue";
}

export function analyzeSentenceThemeIssues(
  rounds: SentenceRoundInput[]
): SentenceThemeIssueAnalysis {
  const perRound = new Map<number, SentenceRoundIssueIndices>();
  const ensureSlot = (roundIndex: number): SentenceRoundIssueIndices => {
    let slot = perRound.get(roundIndex);
    if (!slot) {
      slot = {
        englishHasIssue: false,
        spanishHasIssue: false,
        distractorHasIssue: new Set<number>(),
        issueMessage: null,
        isDuplicate: false,
      };
      perRound.set(roundIndex, slot);
    }
    return slot;
  };

  const issues = collectSentenceRoundIssues(rounds);
  for (const issue of issues) {
    const setIssueMessage = (roundIndex: number) => {
      const slot = ensureSlot(roundIndex);
      if (slot.issueMessage === null) {
        slot.issueMessage = cardMessageForIssueType(issue.type);
      }
    };

    if (issue.type === "english_empty" || issue.type === "english_too_long") {
      ensureSlot(issue.roundIndex).englishHasIssue = true;
      setIssueMessage(issue.roundIndex);
    } else if (
      issue.type === "spanish_empty" ||
      issue.type === "spanish_too_few_tokens" ||
      issue.type === "spanish_too_many_tokens" ||
      issue.type === "spanish_forbidden_punctuation" ||
      issue.type === "spanish_token_too_long"
    ) {
      ensureSlot(issue.roundIndex).spanishHasIssue = true;
      setIssueMessage(issue.roundIndex);
    } else if (
      issue.type === "distractor_empty" ||
      issue.type === "distractor_too_long" ||
      issue.type === "distractor_has_space"
    ) {
      ensureSlot(issue.roundIndex).distractorHasIssue.add(issue.distractorIndex);
      setIssueMessage(issue.roundIndex);
    } else if (issue.type === "distractor_duplicate") {
      const slot = ensureSlot(issue.roundIndex);
      slot.distractorHasIssue.add(issue.firstDistractorIndex);
      slot.distractorHasIssue.add(issue.secondDistractorIndex);
      setIssueMessage(issue.roundIndex);
    } else if (issue.type === "distractor_matches_correct") {
      ensureSlot(issue.roundIndex).distractorHasIssue.add(issue.distractorIndex);
      setIssueMessage(issue.roundIndex);
    } else if (issue.type === "distractor_count") {
      const slot = ensureSlot(issue.roundIndex);
      // Highlight every present distractor on count issues so the user sees
      // exactly which slots need fixing (3 expected, may be 0-2 or 4+ in error).
      for (let i = 0; i < issue.actualCount; i++) {
        slot.distractorHasIssue.add(i);
      }
      setIssueMessage(issue.roundIndex);
    } else if (issue.type === "duplicate_round") {
      ensureSlot(issue.firstRoundIndex).isDuplicate = true;
      ensureSlot(issue.secondRoundIndex).isDuplicate = true;
      ensureSlot(issue.firstRoundIndex).spanishHasIssue = true;
      ensureSlot(issue.secondRoundIndex).spanishHasIssue = true;
      setIssueMessage(issue.firstRoundIndex);
      setIssueMessage(issue.secondRoundIndex);
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
