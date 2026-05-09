/**
 * Solo Practice Configuration Constants
 * Centralized game mechanics tuning values
 */

/** Probability of staying at current level vs advancing (0.66 = 66% stay, 34% advance) */
export const LEVEL_UP_CHANCE = 0.66;

/** Probability of Level 2 being typing mode vs multiple choice */
export const LEVEL2_TYPING_CHANCE = 0.5;

/** Probability of Level 1 switching to reverse translation */
export const LEVEL1_REVERSE_CHANCE = 0.5;

/** Delay after correct answers before moving to the next question */
export const SOLO_CORRECT_ADVANCE_DELAY_MS = 750;

/** Delay after wrong answers before moving to the next question */
export const SOLO_INCORRECT_ADVANCE_DELAY_MS = 2250;

/** Accuracy threshold colors */
export const ACCURACY_THRESHOLDS = {
  HIGH: 70,    // Green
  MEDIUM: 50,  // Yellow
  // Below MEDIUM = Red
} as const;
