/**
 * Solo Challenge Configuration Constants
 * Centralized game mechanics tuning values
 */

/** Initial pool size as ratio of total words (0.4 = 40%) */
export const INITIAL_POOL_RATIO = 0.4;

/** Threshold for pool expansion - when this % of active pool has answered L2+ */
export const POOL_EXPANSION_THRESHOLD = 0.65;

/** Number of words to add when expanding the pool */
export const POOL_EXPANSION_COUNT = 2;

/** Probability of staying at current level vs advancing (0.66 = 66% stay, 34% advance) */
export const LEVEL_UP_CHANCE = 0.66;

/** Probability of Level 2 being typing mode vs multiple choice */
export const LEVEL2_TYPING_CHANCE = 0.5;

/** Delay after correct answer before next question (ms) */
export const CORRECT_FEEDBACK_DELAY = 1500;

/** Delay after incorrect answer before next question (ms) */
export const INCORRECT_FEEDBACK_DELAY = 2500;

/** Accuracy threshold colors */
export const ACCURACY_THRESHOLDS = {
  HIGH: 70,    // Green
  MEDIUM: 50,  // Yellow
  // Below MEDIUM = Red
} as const;

/** Level indicator styling */
export const LEVEL_COLORS: Record<0 | 1 | 2 | 3, string> = {
  0: "text-gray-300 bg-gray-500/20 border-gray-500",
  1: "text-green-400 bg-green-500/20 border-green-500",
  2: "text-yellow-400 bg-yellow-500/20 border-yellow-500",
  3: "text-red-400 bg-red-500/20 border-red-500",
};

