/**
 * Session item plumbing: themes flatten into a mixed `SessionItem[]` (word and
 * sentence variants) that the deck shuffles into one playable order. Word items
 * preserve the historical flat fields so reads after a `kind === "word"` narrow
 * keep working unchanged.
 */

import type { Id } from "./types";
import type { SentenceRoundInput, ThemeContentType } from "./themes/sentenceTypes";
import { isSentenceTheme } from "./themes/themeContent";
import {
  normalizeSentenceFreeWordPositions,
  normalizeSentenceWordMeanings,
} from "./themes/sentenceValidation";

export interface SessionWordItem {
  kind: "word";
  word: string;
  answer: string;
  wrongAnswers: string[];
  ttsStorageId?: Id<"_storage">;
  themeId: Id<"themes">;
  themeName: string;
}

export interface SessionSentenceItem {
  kind: "sentence";
  englishPrompt: string;
  spanishSentence: string;
  wordMeanings: string[];
  freeWordPositions: number[];
  distractors: string[];
  themeId: Id<"themes">;
  themeName: string;
}

export type SessionItem = SessionWordItem | SessionSentenceItem;

export interface SessionThemeInput {
  _id: Id<"themes">;
  name: string;
  contentType: ThemeContentType;
  words?: Array<{
    word: string;
    answer: string;
    wrongAnswers: string[];
    ttsStorageId?: Id<"_storage">;
  }>;
  sentenceRounds?: SentenceRoundInput[];
}

/** Flatten one theme into its session items. Word and sentence themes diverge here. */
export function buildSessionItemsForTheme(theme: SessionThemeInput): SessionItem[] {
  if (isSentenceTheme(theme)) {
    const rounds = theme.sentenceRounds ?? [];
    return rounds.map((round): SessionSentenceItem => ({
      kind: "sentence",
      englishPrompt: round.englishPrompt,
      spanishSentence: round.spanishSentence,
      wordMeanings: normalizeSentenceWordMeanings(
        round.spanishSentence,
        round.wordMeanings
      ),
      freeWordPositions: normalizeSentenceFreeWordPositions(
        round.spanishSentence,
        round.freeWordPositions
      ),
      distractors: [...round.distractors],
      themeId: theme._id,
      themeName: theme.name,
    }));
  }
  const words = theme.words ?? [];
  return words.map((word): SessionWordItem => ({
    kind: "word",
    word: word.word,
    answer: word.answer,
    wrongAnswers: word.wrongAnswers,
    ttsStorageId: word.ttsStorageId,
    themeId: theme._id,
    themeName: theme.name,
  }));
}

/** Mixed-content deck: flatten every selected theme and concatenate. */
export function buildSessionItems(themes: SessionThemeInput[]): SessionItem[] {
  return themes.flatMap(buildSessionItemsForTheme);
}

export function getUniqueThemeIds(
  sessionItems: Array<Pick<SessionItem, "themeId">>
): Id<"themes">[] {
  const seen = new Set<string>();
  const themeIds: Id<"themes">[] = [];

  for (const item of sessionItems) {
    const key = String(item.themeId);
    if (seen.has(key)) continue;
    seen.add(key);
    themeIds.push(item.themeId);
  }

  return themeIds;
}

export function summarizeThemeNames(themeNames: string[]): string {
  if (themeNames.length === 0) return "Theme";
  if (themeNames.length === 1) return themeNames[0];
  return `${themeNames.length} themes`;
}

export function summarizeThemes(themes: Array<Pick<SessionThemeInput, "name">>): string {
  return summarizeThemeNames(themes.map((theme) => theme.name));
}

export function isSessionWordItem(item: SessionItem): item is SessionWordItem {
  return item.kind === "word";
}

export function isSessionSentenceItem(item: SessionItem): item is SessionSentenceItem {
  return item.kind === "sentence";
}
