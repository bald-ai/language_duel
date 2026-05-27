/**
 * Authoring / generation constants for sentence themes. Kept separate from
 * word-theme constants so the two content types can drift independently.
 */

/** Spanish sentence: 2-8 space-separated tokens (decision: sentence shape). */
export const SENTENCE_MIN_TOKENS = 2;
export const SENTENCE_MAX_TOKENS = 8;

/** Every sentence round stores exactly 3 distractors (decision: round shape). */
export const SENTENCE_DISTRACTOR_COUNT = 3;

/** Generation: how many rounds the user can request per theme. */
export const SENTENCE_MIN_GENERATION_ROUND_COUNT = 5;
export const SENTENCE_MAX_GENERATION_ROUND_COUNT = 15;
export const DEFAULT_SENTENCE_GENERATION_ROUND_COUNT = 10;

/** Pick & Prune over-generates by 100% (matches `PICK_AND_PRUNE_WORD_COUNT`). */
export const SENTENCE_PICK_AND_PRUNE_ROUND_COUNT =
  DEFAULT_SENTENCE_GENERATION_ROUND_COUNT * 2;

/** Generate-more for an existing sentence theme. */
export const SENTENCE_GENERATE_MORE_ROUND_COUNT = 5;
export const SENTENCE_GENERATE_MORE_PICK_AND_PRUNE_ROUND_COUNT = 10;

/** Max round count per sentence theme (mirrors `THEME_MAX_WORD_COUNT`). */
export const SENTENCE_MIN_ROUND_COUNT = 1;
export const SENTENCE_MAX_ROUND_COUNT = 200;

/** Input length limits. */
export const SENTENCE_ENGLISH_PROMPT_MAX_LENGTH = 200;
export const SENTENCE_SPANISH_TOKEN_MAX_LENGTH = 32;
export const SENTENCE_DISTRACTOR_MAX_LENGTH = SENTENCE_SPANISH_TOKEN_MAX_LENGTH;

/**
 * Punctuation Spanish sentences may NOT contain in v1 (decision: round shape).
 * Periods, exclamation, and question marks are allowed because they attach to a
 * word token without breaking whitespace splitting.
 */
export const SENTENCE_FORBIDDEN_PUNCTUATION = [",", ";", '"', "'", "(", ")", "/"] as const;

/** Per-mode sentence timers (decision: timers and feedback). */
export const SENTENCE_PVP_TIMER_SECONDS = 30;
export const SENTENCE_RELAY_TIMER_SECONDS = 30;
export const SENTENCE_SELF_DUEL_TIMER_SECONDS = 30;
export const SENTENCE_PVE_TIMER_SECONDS = 45;

/** Sentence scoring (decision: sentence scoring matches word scale). */
export const SENTENCE_CLEAN_COMPLETION_POINTS = 2;
export const SENTENCE_MESSY_COMPLETION_POINTS = 1;
export const SENTENCE_TIMEOUT_POINTS = 0;
