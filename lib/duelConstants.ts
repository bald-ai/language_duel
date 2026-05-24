/**
 * Constants for duel game mechanics.
 */

// Timer durations
export const QUESTION_TIMER_SECONDS = 21;
export const TRANSITION_COUNTDOWN_SECONDS = 5;

// Timer display thresholds
export const TIMER_WARNING_THRESHOLD = 8;  // Yellow zone
export const TIMER_DANGER_THRESHOLD = 4;   // Red zone + pulse

// Type reveal animation for "None of the above"
export const TYPE_REVEAL_DELAY_MS = 300;
export const TYPE_REVEAL_INTERVAL_MS = 50;

// Timer update frequency
export const TIMER_UPDATE_INTERVAL_MS = 100;

// ===========================================
// Relay Duel
// ===========================================

/** Flat points awarded per correct relay answer (decisions #10/#11). */
export const RELAY_QUESTION_POINTS = 1;

/** Answer-phase countdown for relay; the only timed phase (decision #7). */
export const RELAY_ANSWER_TIMEOUT_SECONDS = 21;
export const RELAY_ANSWER_TIMEOUT_MS = RELAY_ANSWER_TIMEOUT_SECONDS * 1000;

/** Each player's hard-upgrade tokens = ceil(poolSize / divisor) (decision #13). */
export const RELAY_HARD_BUDGET_DIVISOR = 10;

