import type { WordEntry } from "../types";
import { normalizeForComparison } from "../stringUtils";
import {
  THEME_ANSWER_INPUT_MAX_LENGTH,
  THEME_DESCRIPTION_MAX_LENGTH,
  THEME_MAX_WORD_COUNT,
  THEME_MAX_WRONG_ANSWER_COUNT,
  THEME_MIN_WORD_COUNT,
  THEME_MIN_WRONG_ANSWER_COUNT,
  THEME_NAME_MAX_LENGTH,
  THEME_NAME_MIN_LENGTH,
  THEME_SAVE_REQUEST_ID_MAX_LENGTH,
  THEME_WORD_INPUT_MAX_LENGTH,
  THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
} from "./constants";

export type ThemeWordInput = Pick<WordEntry, "word" | "answer" | "wrongAnswers" | "ttsStorageId">;

export type ThemeValidationIssue =
  | { type: "word_empty"; wordIndex: number }
  | { type: "word_too_long"; wordIndex: number }
  | { type: "answer_empty"; wordIndex: number }
  | { type: "answer_too_long"; wordIndex: number }
  | { type: "wrong_answer_empty"; wordIndex: number; wrongIndex: number }
  | { type: "wrong_answer_too_long"; wordIndex: number; wrongIndex: number }
  | {
      type: "wrong_answer_count";
      wordIndex: number;
    }
  | {
      type: "wrong_answer_matches_correct";
      wordIndex: number;
      wrongIndex: number;
      wrongAnswer: string;
      answer: string;
    }
  | {
      type: "duplicate_wrong_answer";
      wordIndex: number;
      firstWrongIndex: number;
      secondWrongIndex: number;
      firstWrongAnswer: string;
      secondWrongAnswer: string;
    }
  | {
      type: "duplicate_word";
      firstWordIndex: number;
      secondWordIndex: number;
      firstWord: string;
      secondWord: string;
    };

export function formatThemeValidationIssue(
  issue: ThemeValidationIssue,
  options?: { wordLabel?: string }
): string {
  const wordLabel = options?.wordLabel;
  const labelFor = (index: number) => wordLabel ?? `Word ${index + 1}`;

  if (issue.type === "word_empty") {
    return `${labelFor(issue.wordIndex)}: word must be at least 1 character`;
  }
  if (issue.type === "word_too_long") {
    return `${labelFor(issue.wordIndex)}: word must be at most ${THEME_WORD_INPUT_MAX_LENGTH} characters`;
  }
  if (issue.type === "answer_empty") {
    return `${labelFor(issue.wordIndex)}: answer must be at least 1 character`;
  }
  if (issue.type === "answer_too_long") {
    return `${labelFor(issue.wordIndex)}: answer must be at most ${THEME_ANSWER_INPUT_MAX_LENGTH} characters`;
  }
  if (issue.type === "wrong_answer_empty") {
    return `${labelFor(issue.wordIndex)}: wrong answer ${issue.wrongIndex + 1} must be at least 1 character`;
  }
  if (issue.type === "wrong_answer_too_long") {
    return `${labelFor(issue.wordIndex)}: wrong answer ${issue.wrongIndex + 1} must be at most ${THEME_WRONG_ANSWER_INPUT_MAX_LENGTH} characters`;
  }
  if (issue.type === "wrong_answer_count") {
    return THEME_MIN_WRONG_ANSWER_COUNT === THEME_MAX_WRONG_ANSWER_COUNT
      ? `${labelFor(issue.wordIndex)}: wrong answers must contain exactly ${THEME_MAX_WRONG_ANSWER_COUNT} items`
      : `${labelFor(issue.wordIndex)}: wrong answers must contain ${THEME_MIN_WRONG_ANSWER_COUNT}-${THEME_MAX_WRONG_ANSWER_COUNT} items`;
  }
  if (issue.type === "wrong_answer_matches_correct") {
    return `${labelFor(issue.wordIndex)}: wrong answer "${issue.wrongAnswer}" matches the correct answer "${issue.answer}" after normalization.`;
  }
  if (issue.type === "duplicate_wrong_answer") {
    return `${labelFor(issue.wordIndex)}: wrong answers "${issue.firstWrongAnswer}" and "${issue.secondWrongAnswer}" are duplicates after normalization.`;
  }
  return `Words ${issue.firstWordIndex + 1} and ${issue.secondWordIndex + 1}: "${issue.firstWord}" and "${issue.secondWord}" are duplicates after normalization.`;
}

/**
 * Non-throwing scan of theme word payload. Does not validate overall word count
 * (generation word count is validated at the request layer / JSON schema).
 */
export function collectThemeIssues(words: ThemeWordInput[]): ThemeValidationIssue[] {
  const issues: ThemeValidationIssue[] = [];
  const seenWords = new Map<string, { index: number; word: string }>();

  words.forEach((word, wordIndex) => {
    const rawWord = typeof word.word === "string" ? word.word : "";
    const trimmedWord = rawWord.trim();
    if (trimmedWord.length < 1) {
      issues.push({ type: "word_empty", wordIndex });
    } else if (trimmedWord.length > THEME_WORD_INPUT_MAX_LENGTH) {
      issues.push({ type: "word_too_long", wordIndex });
    }

    const rawAnswer = typeof word.answer === "string" ? word.answer : "";
    const trimmedAnswer = rawAnswer.trim();
    if (trimmedAnswer.length < 1) {
      issues.push({ type: "answer_empty", wordIndex });
    } else if (trimmedAnswer.length > THEME_ANSWER_INPUT_MAX_LENGTH) {
      issues.push({ type: "answer_too_long", wordIndex });
    }

    const wrongAnswers = Array.isArray(word.wrongAnswers) ? word.wrongAnswers : [];
    if (
      wrongAnswers.length < THEME_MIN_WRONG_ANSWER_COUNT ||
      wrongAnswers.length > THEME_MAX_WRONG_ANSWER_COUNT
    ) {
      issues.push({ type: "wrong_answer_count", wordIndex });
    }

    wrongAnswers.forEach((wrongAnswer, wrongIndex) => {
      const rawWrong = typeof wrongAnswer === "string" ? wrongAnswer : "";
      const trimmedWrong = rawWrong.trim();
      if (trimmedWrong.length < 1) {
        issues.push({ type: "wrong_answer_empty", wordIndex, wrongIndex });
      } else if (trimmedWrong.length > THEME_WRONG_ANSWER_INPUT_MAX_LENGTH) {
        issues.push({ type: "wrong_answer_too_long", wordIndex, wrongIndex });
      }
    });

    const comparableAnswer = normalizeForComparison(trimmedAnswer);
    const seenWrongAnswers = new Map<string, { index: number; value: string }>();

    wrongAnswers.forEach((wrongAnswer, wrongIndex) => {
      const wrongStr = typeof wrongAnswer === "string" ? wrongAnswer : "";
      const trimmedWrong = wrongStr.trim();
      const comparableWrongAnswer = normalizeForComparison(wrongStr);

      if (trimmedWrong !== "") {
        const existingWrongAnswer = seenWrongAnswers.get(comparableWrongAnswer);

        if (existingWrongAnswer) {
          issues.push({
            type: "duplicate_wrong_answer",
            wordIndex,
            firstWrongIndex: existingWrongAnswer.index,
            secondWrongIndex: wrongIndex,
            firstWrongAnswer: existingWrongAnswer.value,
            secondWrongAnswer: wrongStr,
          });
        } else {
          seenWrongAnswers.set(comparableWrongAnswer, { index: wrongIndex, value: wrongStr });
        }
      }

      if (trimmedWrong !== "" && comparableWrongAnswer === comparableAnswer && comparableAnswer !== "") {
        issues.push({
          type: "wrong_answer_matches_correct",
          wordIndex,
          wrongIndex,
          wrongAnswer: wrongStr,
          answer: rawAnswer,
        });
      }
    });

    if (trimmedWord !== "") {
      const comparableWord = normalizeForComparison(rawWord);
      const existingWord = seenWords.get(comparableWord);
      if (existingWord) {
        issues.push({
          type: "duplicate_word",
          firstWordIndex: existingWord.index,
          secondWordIndex: wordIndex,
          firstWord: existingWord.word,
          secondWord: rawWord,
        });
      } else {
        seenWords.set(comparableWord, { index: wordIndex, word: rawWord });
      }
    }
  });

  return issues;
}

export function describeThemeValidationIssues(words: ThemeWordInput[]): string[] {
  return collectThemeIssues(words).map((issue) => formatThemeValidationIssue(issue));
}

function ensureLength(params: {
  value: string;
  field: string;
  min?: number;
  max: number;
}): string {
  const normalized = params.value.trim();
  const { min = 0, max, field } = params;
  if (normalized.length < min) {
    throw new Error(`${field} must be at least ${min} character${min === 1 ? "" : "s"}`);
  }
  if (normalized.length > max) {
    throw new Error(`${field} must be at most ${max} characters`);
  }
  return normalized;
}

export function normalizeThemeName(name: string): string {
  const trimmed = ensureLength({
    value: name,
    field: "Theme name",
    min: THEME_NAME_MIN_LENGTH,
    max: THEME_NAME_MAX_LENGTH,
  });
  return trimmed.toUpperCase();
}

export function normalizeThemeDescription(description: string): string {
  return ensureLength({
    value: description,
    field: "Theme description",
    min: 1,
    max: THEME_DESCRIPTION_MAX_LENGTH,
  });
}

export function normalizeThemeWords(words: ThemeWordInput[]): ThemeWordInput[] {
  if (words.length < THEME_MIN_WORD_COUNT || words.length > THEME_MAX_WORD_COUNT) {
    throw new Error(
      `Theme must contain ${THEME_MIN_WORD_COUNT}-${THEME_MAX_WORD_COUNT} words`
    );
  }

  const issues = collectThemeIssues(words);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => formatThemeValidationIssue(issue)).join("\n"));
  }

  return words.map((word) => ({
    ...word,
    word: word.word.trim(),
    answer: word.answer.trim(),
    wrongAnswers: word.wrongAnswers.map((w) => (typeof w === "string" ? w : "").trim()),
  }));
}

export function normalizeSaveRequestId(saveRequestId: string): string {
  return ensureLength({
    value: saveRequestId,
    field: "saveRequestId",
    min: 1,
    max: THEME_SAVE_REQUEST_ID_MAX_LENGTH,
  });
}
