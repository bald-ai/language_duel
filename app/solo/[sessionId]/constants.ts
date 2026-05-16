/**
 * Solo Practice Configuration Constants
 * Centralized game mechanics tuning values
 */

export {
  LEVEL_UP_CHANCE,
  LEVEL2_TYPING_CHANCE,
  LEVEL1_REVERSE_CHANCE,
  SOLO_CORRECT_ADVANCE_DELAY_MS,
  SOLO_INCORRECT_ADVANCE_DELAY_MS,
} from "@/lib/soloPracticeRuntime";

/** Accuracy threshold colors */
export const ACCURACY_THRESHOLDS = {
  HIGH: 70,    // Green
  MEDIUM: 50,  // Yellow
  // Below MEDIUM = Red
} as const;
