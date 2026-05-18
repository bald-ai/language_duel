/**
 * Solo Practice Configuration Constants
 * Centralized game mechanics tuning values
 */

export {
  LEVEL_UP_PROBABILITY,
  LEVEL_2_TYPING_PROBABILITY,
  LEVEL_1_REVERSE_PROBABILITY,
  SOLO_CORRECT_ADVANCE_DELAY_MS,
  SOLO_INCORRECT_ADVANCE_DELAY_MS,
} from "@/lib/soloPracticeRuntime";

/** Accuracy threshold colors */
export const ACCURACY_THRESHOLDS = {
  HIGH: 70,    // Green
  MEDIUM: 50,  // Yellow
  // Below MEDIUM = Red
} as const;
