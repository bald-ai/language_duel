import type { WordEntry } from "../types";
import { stripIrr } from "../stringUtils";
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

type ThemeWordInput = Pick<WordEntry, "word" | "answer" | "wrongAnswers" | "ttsStorageId">;

function normalizeValue(value: string): string {
  return value.trim();
}

function normalizeComparableValue(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
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

function validateWrongAnswers(
  wrongAnswers: string[],
  answer: string,
  wordIndex: number
): string[] {
  if (
    wrongAnswers.length < THEME_MIN_WRONG_ANSWER_COUNT ||
    wrongAnswers.length > THEME_MAX_WRONG_ANSWER_COUNT
  ) {
    throw new Error(
      `Word ${wordIndex + 1}: wrong answers must contain ${THEME_MIN_WRONG_ANSWER_COUNT}-${THEME_MAX_WRONG_ANSWER_COUNT} items`
    );
  }

  const normalizedWrongAnswers = wrongAnswers.map((wrongAnswer, wrongIndex) =>
    ensureLength({
      value: wrongAnswer,
      field: `Word ${wordIndex + 1}: wrong answer ${wrongIndex + 1}`,
      min: 1,
      max: THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
    })
  );

  const normalizedWrongSet = new Set(
    normalizedWrongAnswers.map((wrongAnswer) => normalizeComparableValue(wrongAnswer))
  );
  if (normalizedWrongSet.size !== normalizedWrongAnswers.length) {
    throw new Error(`Word ${wordIndex + 1}: wrong answers must be unique`);
  }

  const normalizedAnswer = normalizeComparableValue(stripIrr(answer));
  const hasAnswerMatch = normalizedWrongAnswers.some(
    (wrongAnswer) => normalizeComparableValue(stripIrr(wrongAnswer)) === normalizedAnswer
  );
  if (hasAnswerMatch) {
    throw new Error(`Word ${wordIndex + 1}: wrong answers must not match the correct answer`);
  }

  return normalizedWrongAnswers;
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

  const seenWords = new Set<string>();

  return words.map((word, index) => {
    const normalizedWord = ensureLength({
      value: word.word,
      field: `Word ${index + 1}: word`,
      min: 1,
      max: THEME_WORD_INPUT_MAX_LENGTH,
    });
    const normalizedAnswer = ensureLength({
      value: word.answer,
      field: `Word ${index + 1}: answer`,
      min: 1,
      max: THEME_ANSWER_INPUT_MAX_LENGTH,
    });
    const normalizedWrongAnswers = validateWrongAnswers(
      word.wrongAnswers,
      normalizedAnswer,
      index
    );

    const comparableWord = normalizeComparableValue(normalizedWord);
    if (seenWords.has(comparableWord)) {
      throw new Error(`Duplicate word found: "${normalizedWord}"`);
    }
    seenWords.add(comparableWord);

    return {
      ...word,
      word: normalizedWord,
      answer: normalizedAnswer,
      wrongAnswers: normalizedWrongAnswers,
    };
  });
}

export function normalizeSaveRequestId(saveRequestId: string): string {
  return ensureLength({
    value: saveRequestId,
    field: "saveRequestId",
    min: 1,
    max: THEME_SAVE_REQUEST_ID_MAX_LENGTH,
  });
}

