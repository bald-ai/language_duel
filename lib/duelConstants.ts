/**
 * Constants for duel game mechanics.
 */

// Timer durations
export const QUESTION_TIMER_SECONDS = 21;
export const TRANSITION_COUNTDOWN_SECONDS = 5;

// Timer display thresholds (derived from QUESTION_TIMER_SECONDS)
export const TIMER_DISPLAY_MAX = QUESTION_TIMER_SECONDS - 1; // 20 (hide extra second)
export const TIMER_WARNING_THRESHOLD = 8;  // Yellow zone
export const TIMER_DANGER_THRESHOLD = 4;   // Red zone + pulse

// Type reveal animation for "None of the above"
export const TYPE_REVEAL_DELAY_MS = 300;
export const TYPE_REVEAL_INTERVAL_MS = 50;

// Timer update frequency
export const TIMER_UPDATE_INTERVAL_MS = 100;

