/**
 * Constants for the Learn Phase page
 */

export const DEFAULT_DURATION = 300; // 5 minutes default

/**
 * Timer options for solo study mode (in seconds)
 * 5, 10, 15 minutes
 */
export const SOLO_TIMER_OPTIONS = [300, 600, 900] as const;

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

