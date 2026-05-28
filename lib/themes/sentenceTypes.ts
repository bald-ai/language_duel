/**
 * Pure types for sentence themes. Sentence themes are the second theme content
 * type alongside word themes (see `wordTypes.ts`). A sentence round is the
 * editable source the user authors: an English prompt, the canonical Spanish
 * sentence, and 3 single-word distractors. Gameplay tokenizes the Spanish
 * sentence on whitespace to build the tile pool.
 */

/**
 * The editable source for one sentence round. Stored on `themes.sentenceRounds`
 * for sentence themes and on the weekly-goal snapshot. Not the gameplay-ready
 * shape — see `lib/sentenceGameplay/types.ts` for the play-time view.
 */
export interface SentenceRoundInput {
  englishPrompt: string;
  spanishSentence: string;
  distractors: string[];
}

/** Two theme content types: word themes and sentence themes. */
export const THEME_CONTENT_TYPES = ["word", "sentence"] as const;
export type ThemeContentType = (typeof THEME_CONTENT_TYPES)[number];

export function isThemeContentType(value: unknown): value is ThemeContentType {
  return (
    typeof value === "string" &&
    (THEME_CONTENT_TYPES as readonly string[]).includes(value)
  );
}
