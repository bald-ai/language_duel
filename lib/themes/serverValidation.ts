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
      wrongAnswer: string;
      answer: string;
    }
  | {
      type: "duplicate_wrong_answer";
      wordIndex: number;
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

function normalizeValue(value: string): string {
  return value.trim();
}

function normalizeComparableValue(value: string): string {
  return normalizeForComparison(value);
}

export function formatThemeValidationIssue(issue: ThemeValidationIssue): string {
  if (issue.type === "word_empty") {
    return `Word ${issue.wordIndex + 1}: word must be at least 1 character`;
  }
  if (issue.type === "word_too_long") {
    return `Word ${issue.wordIndex + 1}: word must be at most ${THEME_WORD_INPUT_MAX_LENGTH} characters`;
  }
  if (issue.type === "answer_empty") {
    return `Word ${issue.wordIndex + 1}: answer must be at least 1 character`;
  }
  if (issue.type === "answer_too_long") {
    return `Word ${issue.wordIndex + 1}: answer must be at most ${THEME_ANSWER_INPUT_MAX_LENGTH} characters`;
  }
  if (issue.type === "wrong_answer_empty") {
    return `Word ${issue.wordIndex + 1}: wrong answer ${issue.wrongIndex + 1} must be at least 1 character`;
  }
  if (issue.type === "wrong_answer_too_long") {
    return `Word ${issue.wordIndex + 1}: wrong answer ${issue.wrongIndex + 1} must be at most ${THEME_WRONG_ANSWER_INPUT_MAX_LENGTH} characters`;
  }
  if (issue.type === "wrong_answer_count") {
    return `Word ${issue.wordIndex + 1}: wrong answers must contain ${THEME_MIN_WRONG_ANSWER_COUNT}-${THEME_MAX_WRONG_ANSWER_COUNT} items`;
  }
  if (issue.type === "wrong_answer_matches_correct") {
    return `Word ${issue.wordIndex + 1}: wrong answer "${issue.wrongAnswer}" matches the correct answer "${issue.answer}" after normalization.`;
  }
  if (issue.type === "duplicate_wrong_answer") {
    return `Word ${issue.wordIndex + 1}: wrong answers "${issue.firstWrongAnswer}" and "${issue.secondWrongAnswer}" are duplicates after normalization.`;
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
    const trimmedWord = normalizeValue(rawWord);
    if (trimmedWord.length < 1) {
      issues.push({ type: "word_empty", wordIndex });
    } else if (trimmedWord.length > THEME_WORD_INPUT_MAX_LENGTH) {
      issues.push({ type: "word_too_long", wordIndex });
    }

    const rawAnswer = typeof word.answer === "string" ? word.answer : "";
    const trimmedAnswer = normalizeValue(rawAnswer);
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
      const trimmedWrong = normalizeValue(rawWrong);
      if (trimmedWrong.length < 1) {
        issues.push({ type: "wrong_answer_empty", wordIndex, wrongIndex });
      } else if (trimmedWrong.length > THEME_WRONG_ANSWER_INPUT_MAX_LENGTH) {
        issues.push({ type: "wrong_answer_too_long", wordIndex, wrongIndex });
      }
    });

    const comparableAnswer = normalizeComparableValue(trimmedAnswer);
    const seenWrongAnswers = new Map<string, string>();

    wrongAnswers.forEach((wrongAnswer) => {
      const wrongStr = typeof wrongAnswer === "string" ? wrongAnswer : "";
      const trimmedWrong = normalizeValue(wrongStr);
      const comparableWrongAnswer = normalizeComparableValue(wrongStr);

      if (trimmedWrong !== "") {
        const existingWrongAnswer = seenWrongAnswers.get(comparableWrongAnswer);

        if (existingWrongAnswer) {
          issues.push({
            type: "duplicate_wrong_answer",
            wordIndex,
            firstWrongAnswer: existingWrongAnswer,
            secondWrongAnswer: wrongStr,
          });
        } else {
          seenWrongAnswers.set(comparableWrongAnswer, wrongStr);
        }
      }

      if (trimmedWrong !== "" && comparableWrongAnswer === comparableAnswer && comparableAnswer !== "") {
        issues.push({
          type: "wrong_answer_matches_correct",
          wordIndex,
          wrongAnswer: wrongStr,
          answer: rawAnswer,
        });
      }
    });

    if (trimmedWord !== "") {
      const comparableWord = normalizeComparableValue(rawWord);
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
  return collectThemeIssues(words).map(formatThemeValidationIssue);
}

function ensureLength(params: {
  value: string;
  field: string;
  min?: number;
  max: number;
}): string {
  const normalized = normalizeValue(params.value);
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
    throw new Error(issues.map(formatThemeValidationIssue).join("\n"));
  }

  return words.map((word) => ({
    ...word,
    word: normalizeValue(word.word),
    answer: normalizeValue(word.answer),
    wrongAnswers: word.wrongAnswers.map((w) => normalizeValue(typeof w === "string" ? w : "")),
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
