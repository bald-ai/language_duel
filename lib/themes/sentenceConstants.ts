/**
 * Authoring / generation constants for sentence themes. Kept separate from
 * word-theme constants so the two content types can drift independently.
 */

/** Spanish sentence: 2-8 space-separated tokens (decision: sentence shape). */
export const SENTENCE_MIN_TOKENS = 2;
export const SENTENCE_MAX_TOKENS = 8;

/** Every sentence round stores exactly 3 distractors (decision: round shape). */
export const SENTENCE_DISTRACTOR_COUNT = 3;

/**
 * Stand-in shown for a word meaning that hasn't been generated yet (manual
 * drafts, edited sentences, or a failed generation). Async refresh replaces it
 * with the real in-context meaning. A fixed sentinel — not the Spanish token —
 * so "is this still a placeholder?" stays reliable even when a word's real
 * meaning is spelled the same in both languages (e.g. "no", cognates).
 */
export const SENTENCE_WORD_MEANING_PLACEHOLDER = "placeholder";

/**
 * How many of a sentence's stored distractors actually appear on the board, by
 * duel difficulty (decision: sentence difficulty). Same trick word rounds use —
 * store a big wrong-answer pool, show a subset. Capped at
 * SENTENCE_DISTRACTOR_COUNT (we only store 3); going higher would require
 * regenerating sentence content. This is the single source of these 1/2/3
 * play-time values — no caller hardcodes them. When Relay gains sentences it
 * reuses this same table.
 */
export const SENTENCE_DISTRACTOR_COUNT_BY_LEVEL = {
  easy: 1,
  medium: 2,
  hard: 3,
} as const;

/** Generation: how many rounds the user can request per theme. */
export const SENTENCE_MIN_GENERATION_ROUND_COUNT = 5;
export const SENTENCE_MAX_GENERATION_ROUND_COUNT = 15;
export const DEFAULT_SENTENCE_GENERATION_ROUND_COUNT = 10;

/** Pick & Prune over-generates by 100% (matches `PICK_AND_PRUNE_WORD_COUNT`). */
export const SENTENCE_PICK_AND_PRUNE_ROUND_COUNT =
  DEFAULT_SENTENCE_GENERATION_ROUND_COUNT * 2;

/**
 * Generate-more for an existing sentence theme. Always over-generates so the
 * user can prune the appended rounds in the editor (same pattern as the
 * initial generation — no separate review screen).
 */
export const SENTENCE_GENERATE_MORE_PICK_AND_PRUNE_ROUND_COUNT = 10;

/** Max round count per sentence theme (mirrors `THEME_MAX_WORD_COUNT`). */
export const SENTENCE_MIN_ROUND_COUNT = 1;
// Double the generation max so a full Pick & Prune over-generated batch can be
// kept without trimming; this also bounds the async word-meaning refresh fan-out.
export const SENTENCE_MAX_ROUND_COUNT = SENTENCE_MAX_GENERATION_ROUND_COUNT * 2;

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

/**
 * Single sentence-round timer for the unified build-and-confirm board, used by
 * every non-relay mode (PvE / PvP / self-duel). 60s — the +30s freeze hint plus
 * build-and-confirm's free reset/peel make a longer base unnecessary (decision
 * Q3: the old per-tap PvE value of 90s is retired with the per-tap model).
 */
export const SENTENCE_TIMER_SECONDS = 60;
/** Relay serves sentence positions on its own turn clock (separate budget). */
export const SENTENCE_RELAY_TIMER_SECONDS = 60;

/**
 * Relay answer window for a sentence position, in ms. Lives here (next to the
 * seconds value) so the relay engine can import it without adding a
 * `duelConstants → sentenceConstants` cross-dependency. Word positions keep
 * `RELAY_ANSWER_TIMEOUT_MS`; sentence positions use this longer window.
 */
export const SENTENCE_RELAY_TIMEOUT_MS = SENTENCE_RELAY_TIMER_SECONDS * 1000;

/** Sentence scoring (decision: sentence scoring matches word scale). */
export const SENTENCE_CLEAN_COMPLETION_POINTS = 2;
export const SENTENCE_MESSY_COMPLETION_POINTS = 1;
export const SENTENCE_TIMEOUT_POINTS = 0;

/**
 * PvP build-and-confirm scoring ladder (decision: competitive scoring). A
 * "mistake" is one failed Confirm attempt. The floor is −1: no matter how many
 * failed Confirms, a round never costs more than one point.
 *
 *  | failedConfirms | correct Confirm | timeout / never correct |
 *  |----------------|-----------------|-------------------------|
 *  | 0              | +1              | 0                       |
 *  | 1              | 0               | −1                      |
 *  | ≥2             | −1              | −1                      |
 */
export const SENTENCE_PVP_CLEAN_CONFIRM_POINTS = 1;
export const SENTENCE_PVP_SINGLE_FAIL_POINTS = 0;
export const SENTENCE_PVP_FLOOR_POINTS = -1;
