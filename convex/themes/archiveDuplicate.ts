import { THEME_NAME_MAX_LENGTH } from "../../lib/themes/constants";
import {
  normalizeThemeDescription,
  normalizeThemeName,
  normalizeThemeWords,
} from "../../lib/themes/serverValidation";
import { normalizeSentenceRounds } from "../../lib/themes/sentenceValidation";
import type { SentenceRoundInput } from "../../lib/themes/sentenceTypes";
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

export function buildDuplicateWordThemePayload(theme: {
  name: string;
  description: string;
  words: ThemeWordWithTts[];
}) {
  // Word duplicates drop the source TTS storage IDs — duplicates are a new
  // theme and should re-record (or skip) their own audio.
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

export function buildDuplicateSentenceThemePayload(theme: {
  name: string;
  description: string;
  sentenceRounds: SentenceRoundInput[];
}) {
  const duplicatedRounds = theme.sentenceRounds.map((round) => ({
    englishPrompt: round.englishPrompt,
    spanishSentence: round.spanishSentence,
    wordMeanings: round.wordMeanings ? [...round.wordMeanings] : undefined,
    freeWordPositions: round.freeWordPositions ? [...round.freeWordPositions] : undefined,
    distractors: [...round.distractors],
  }));

  return {
    name: normalizeThemeName(buildDuplicateThemeName(theme.name)),
    description: normalizeThemeDescription(theme.description),
    sentenceRounds: normalizeSentenceRounds(duplicatedRounds),
  };
}
