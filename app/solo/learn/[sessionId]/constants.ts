/**
 * Constants for the Learn Phase page
 */

import {
  DEFAULT_SOLO_STUDY_DURATION,
  SOLO_INFINITE_STUDY_SECONDS,
  SOLO_TIMER_OPTIONS,
} from "@/lib/soloLearnTimer";

export { SOLO_INFINITE_STUDY_SECONDS, SOLO_TIMER_OPTIONS };

export const DEFAULT_DURATION = DEFAULT_SOLO_STUDY_DURATION;

// Layout gaps in pixels
export const LAYOUT = {
  GAP_REVEALED: 8,  // space-y-2
  GAP_TESTING: 12,  // space-y-3
} as const;

// Timer color thresholds (percentage of time remaining)
export const TIMER_THRESHOLDS = {
  GREEN: 0.5,   // > 50% remaining
  YELLOW: 0.17, // > 17% remaining
  // else RED
} as const;

