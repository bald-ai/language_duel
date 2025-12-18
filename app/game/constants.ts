/**
 * Shared Game Constants
 * Constants used across multiple game features (duel, solo, learn phases)
 */

// =============================================================================
// LEVEL STYLING
// =============================================================================

/** Level indicator styling - used for colored badges showing current difficulty level */
export const LEVEL_COLORS: Record<0 | 1 | 2 | 3, string> = {
  0: "text-gray-300 bg-gray-500/20 border-gray-500",
  1: "text-green-400 bg-green-500/20 border-green-500",
  2: "text-yellow-400 bg-yellow-500/20 border-yellow-500",
  3: "text-red-400 bg-red-500/20 border-red-500",
};

// =============================================================================
// TIMER COLOR THRESHOLDS
// =============================================================================

/** Timer shows green when more than 50% time remaining */
export const TIMER_GREEN_THRESHOLD = 0.5;

/** Timer shows yellow when more than 17% time remaining (otherwise red) */
export const TIMER_YELLOW_THRESHOLD = 0.17;

// =============================================================================
// HINT SYSTEM CONSTANTS
// =============================================================================

/** Number of letters revealed per hint in testing/learn mode */
export const LETTERS_PER_HINT = 3;

/** Maximum number of letter hints that can be provided in L1 */
export const MAX_L1_LETTER_HINTS = 3;

/** Maximum number of options that can be eliminated in L2 multiple choice */
export const MAX_L2_ELIMINATIONS = 2;

