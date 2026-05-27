/**
 * Helpers for narrowing a theme document by its `contentType` discriminator.
 * Themes can carry word content (`words`) or sentence content (`sentenceRounds`)
 * but not both. `contentType` is the source of truth; the unused content field
 * is omitted on persist.
 */

import type { SentenceRoundInput, ThemeContentType } from "./sentenceTypes";
import { DEFAULT_THEME_CONTENT_TYPE } from "./sentenceTypes";
import type { WordEntry } from "../types";

export interface ThemeContentShape {
  contentType?: ThemeContentType;
  words?: WordEntry[];
  sentenceRounds?: SentenceRoundInput[];
}

/** Returns the resolved content type, defaulting to "word" when absent. */
export function resolveThemeContentType(
  theme: { contentType?: ThemeContentType | null }
): ThemeContentType {
  return theme.contentType ?? DEFAULT_THEME_CONTENT_TYPE;
}

export function isSentenceTheme(theme: { contentType?: ThemeContentType | null }): boolean {
  return resolveThemeContentType(theme) === "sentence";
}

export function isWordTheme(theme: { contentType?: ThemeContentType | null }): boolean {
  return resolveThemeContentType(theme) === "word";
}

/** Total play item count for a theme (words or sentence rounds). */
export function getThemeItemCount(theme: ThemeContentShape): number {
  if (isSentenceTheme(theme)) {
    return theme.sentenceRounds?.length ?? 0;
  }
  return theme.words?.length ?? 0;
}

/** Singular/plural label for the content unit (word vs round). */
export function getThemeItemLabel(
  theme: ThemeContentShape,
  options: { plural?: boolean } = {}
): string {
  const plural = options.plural ?? false;
  if (isSentenceTheme(theme)) return plural ? "rounds" : "round";
  return plural ? "words" : "word";
}
