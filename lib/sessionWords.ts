/**
 * Session item plumbing: themes flatten into a mixed `SessionItem[]` (word and
 * sentence variants) that the deck shuffles into one playable order. Word items
 * preserve the historical flat fields so reads after a `kind === "word"` narrow
 * keep working unchanged.
 */

import type { Id } from "./types";
import type { SentenceRoundInput, ThemeContentType } from "./themes/sentenceTypes";
import { resolveThemeContentType } from "./themes/themeContent";

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
  distractors: string[];
  themeId: Id<"themes">;
  themeName: string;
}

export type SessionItem = SessionWordItem | SessionSentenceItem;

/**
 * Legacy alias: pre-sentence code treated `SessionWordEntry` as the flat row
 * shape. Now an alias for the discriminated `SessionWordItem` variant. New code
 * should prefer `SessionItem` (mixed) or `SessionWordItem` (word-only).
 */
export type SessionWordEntry = SessionWordItem;

export interface SessionThemeInput {
  _id: Id<"themes">;
  name: string;
  contentType?: ThemeContentType;
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
  if (resolveThemeContentType(theme) === "sentence") {
    const rounds = theme.sentenceRounds ?? [];
    return rounds.map((round): SessionSentenceItem => ({
      kind: "sentence",
      englishPrompt: round.englishPrompt,
      spanishSentence: round.spanishSentence,
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

/**
 * Back-compat alias for code that still talks about "session words". Returns
 * the mixed discriminated array — callers are responsible for branching on
 * `item.kind`. Kept under the historical name so 25+ call sites continue to
 * compile while the rename rolls through the codebase.
 */
export const buildSessionWords = buildSessionItems;

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
