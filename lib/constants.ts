/**
 * Timer options for learn phase (in seconds)
 * 1, 2, 3, 4, 5, 7, 10, 15 minutes
 */
export const TIMER_OPTIONS = [60, 120, 180, 240, 300, 420, 600, 900] as const;

export type TimerOption = typeof TIMER_OPTIONS[number];

/**
 * Probability that hard mode questions use "None of the above" as the correct answer
 */
export const HARD_MODE_NONE_CHANCE = 0.5;

/**
 * UI Feedback Durations (in milliseconds)
 */
export const HINT_BANNER_DURATION_MS = 3000;
export const FEEDBACK_SHORT_MS = 1500;
export const FEEDBACK_LONG_MS = 2500;
