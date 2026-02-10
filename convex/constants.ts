/**
 * Centralized game constants for the Language Duel application.
 * All magic numbers and game balance values should be defined here.
 */

// ===========================================
// Query Limits
// ===========================================
export const MAX_USERS_QUERY = 100;
export const MAX_THEMES_QUERY = 100;

// ===========================================
// Timer Options (Learn Phase)
// ===========================================
/** Available timer durations in seconds: 1, 2, 3, 4, 5, 7, 10, 15 minutes */
export const TIMER_OPTIONS = [60, 120, 180, 240, 300, 420, 600, 900] as const;
export const DEFAULT_TIMER_DURATION = 300; // 5 minutes

// ===========================================
// Pool & Progression Settings
// ===========================================
/** Percentage of words to include in initial active pool */
export const INITIAL_POOL_RATIO = 0.4;

/** Threshold to trigger pool expansion (% of active pool with L2+ answered) */
export const POOL_EXPANSION_THRESHOLD = 0.65;

/** Number of words to add when expanding pool */
export const POOL_EXPANSION_SIZE = 2;

// ===========================================
// Level Probabilities (solo-style duel mode) [NOT ACTIVE] — not currently used in app, kept for future revisit.
// ===========================================
/** Probability of starting at Level 1 (vs Level 2) */
export const LEVEL_1_START_PROBABILITY = 0.66;

/** Probability of getting Level 2 typing mode (vs multiple choice) */
export const LEVEL_2_TYPING_PROBABILITY = 0.5;

/** After L1 correct: probability of going to L2 (vs L3) */
export const L1_TO_L2_PROBABILITY = 0.66;

/** After L2 correct: probability of staying at L2 (vs going to L3) when picking next question */
export const L2_STAY_PROBABILITY = 0.66;

// ===========================================
// Hint System
// ===========================================
/** Time bonus given to hint requester (in ms) */
export const HINT_TIME_BONUS_MS = 3000;

/** Maximum letter hints that can be provided */
export const MAX_LETTER_HINTS = 3;

/** Maximum wrong options that can be eliminated (classic mode) */
export const MAX_ELIMINATED_OPTIONS_CLASSIC = 2;

/** Maximum wrong options that can be eliminated (L2 multiple choice) */
export const MAX_ELIMINATED_OPTIONS_L2 = 2;

// ===========================================
// Sabotage System
// ===========================================
export const SABOTAGE_EFFECTS = ["sticky", "bounce", "trampoline", "reverse"] as const;
export type SabotageEffect = (typeof SABOTAGE_EFFECTS)[number];

/** Maximum sabotages each player can use per duel */
export const MAX_SABOTAGES_PER_DUEL = 5;

/** Duration of "sticky" sabotage effect (ms) */
export const SABOTAGE_STICKY_DURATION_MS = 7000;

/** Fallback duration for sabotages when questionStartTime is unavailable (ms) */
export const SABOTAGE_FALLBACK_DURATION_MS = 25000;

// ===========================================
// Scoring (Classic Mode)
// ===========================================
/** Points for easy difficulty questions */
export const POINTS_EASY = 1;

/** Points for medium difficulty questions */
export const POINTS_MEDIUM = 1.5;

/** Points for hard difficulty questions */
export const POINTS_HARD = 2;

/** Bonus points awarded to hint provider when requester answers correctly */
export const HINT_PROVIDER_BONUS = 0.5;

// ===========================================
// Difficulty Distribution Ratios (Classic Mode)
// ===========================================
/** Target ratio for easy difficulty: 40% Easy, 30% Medium, 30% Hard */
export const DIFFICULTY_RATIO_EASY = 0.4;
export const DIFFICULTY_RATIO_MEDIUM = 0.3;
export const DIFFICULTY_RATIO_HARD = 0.3;

// ===========================================
// PRNG Constants
// ===========================================
/** LCG multiplier for deterministic random */
export const LCG_MULTIPLIER = 1103515245;
/** LCG increment for deterministic random */
export const LCG_INCREMENT = 12345;
/** LCG modulus mask */
export const LCG_MODULUS = 0x7fffffff;
/** Prime used for question index seeding */
export const QUESTION_INDEX_PRIME = 7919;
/** XOR mask for seed initialization */
export const SEED_XOR_MASK = 0xdeadbeef;

// ===========================================
// Magic String Constants
// ===========================================
/** Text for "None of the above" answer option in hard mode */
export const NONE_OF_THE_ABOVE = "None of the above";

/** Special marker for timeout answers */
export const TIMEOUT_ANSWER = "__TIMEOUT__";

// ===========================================
// Nickname & Discriminator System
// ===========================================
/** Minimum discriminator value (inclusive) */
export const DISCRIMINATOR_MIN = 1000;

/** Maximum discriminator value (inclusive) */
export const DISCRIMINATOR_MAX = 9999;

/** Maximum friend requests a user can have */
export const MAX_FRIEND_REQUESTS = 100;

/** Default nickname for new users */
export const DEFAULT_NICKNAME = "NewPlayer";

