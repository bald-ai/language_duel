import { THEME_NAME_MAX_LENGTH } from "../../lib/themes/constants";
import {
  normalizeThemeDescription,
  normalizeThemeName,
  normalizeThemeWords,
} from "../../lib/themes/serverValidation";
import type { ThemeWordWithTts } from "./ttsPipeline";

const DUPLICATE_THEME_SUFFIX = "(DUPLICATE)";

export function buildDuplicateThemeName(originalName: string): string {
  const normalizedBaseName = originalName.trim().toUpperCase();
  if (
    normalizedBaseName.length + DUPLICATE_THEME_SUFFIX.length <=
    THEME_NAME_MAX_LENGTH
  ) {
    return `${normalizedBaseName}${DUPLICATE_THEME_SUFFIX}`;
  }

  const maxBaseLength = Math.max(
    1,
    THEME_NAME_MAX_LENGTH - DUPLICATE_THEME_SUFFIX.length
  );
  return `${normalizedBaseName.slice(0, maxBaseLength)}${DUPLICATE_THEME_SUFFIX}`;
}

export function buildDuplicateThemePayload(theme: {
  name: string;
  description: string;
  words: ThemeWordWithTts[];
}) {
  const duplicatedWords = theme.words.map((word) => ({
    word: word.word,
    answer: word.answer,
    wrongAnswers: [...word.wrongAnswers],
  }));

  return {
    name: normalizeThemeName(buildDuplicateThemeName(theme.name)),
    description: normalizeThemeDescription(theme.description),
    words: normalizeThemeWords(duplicatedWords),
  };
}

