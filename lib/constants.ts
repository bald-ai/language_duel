/**
 * Timer options for learn phase (in seconds)
 * 1, 2, 3, 4, 5, 7, 10, 15 minutes
 */
export const TIMER_OPTIONS = [60, 120, 180, 240, 300, 420, 600, 900] as const;

/**
 * Solo practice word pool settings.
 */
export const INITIAL_POOL_RATIO = 0.4;
export const POOL_EXPANSION_THRESHOLD = 0.65;
export const POOL_EXPANSION_SIZE = 2;

/**
 * Probability that hard mode questions use "None of the above" as the correct answer
 */
export const HARD_MODE_NONE_CHANCE = 0.5;
