/**
 * Shared Game Constants
 * Constants used across multiple game features (duel, solo, learn phases)
 */

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
