/**
 * Centralized game constants for the Language Duel application.
 * All magic numbers and game balance values should be defined here.
 */

// ===========================================
// Query Limits
// ===========================================
export const MAX_USERS_QUERY = 100;

// ===========================================
// Timer Options (Learn Phase)
// ===========================================
/** Available timer durations in seconds: 1, 2, 3, 4, 5, 7, 10, 15 minutes */
export const TIMER_OPTIONS = [60, 120, 180, 240, 300, 420, 600, 900] as const;
export const DEFAULT_TIMER_DURATION = 300; // 5 minutes

/**
 * Solo learn "no time limit" — same sentinel as `SOLO_INFINITE_STUDY_SECONDS` in
 * `lib/soloLearnTimer.ts` (keep values in sync).
 */
export const SOLO_INFINITE_STUDY_SECONDS = 999_999_999;

// ===========================================
// Level Probabilities (solo practice) [NOT ACTIVE] — not currently used in app, kept for future revisit.
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

/** Maximum wrong options that can be eliminated in a duel */
export const MAX_ELIMINATED_OPTIONS_DUEL = 2;

/** Maximum wrong options that can be eliminated (L2 multiple choice) */
export const MAX_ELIMINATED_OPTIONS_L2 = 2;

// ===========================================
// Sabotage System
// ===========================================
export const SABOTAGE_EFFECTS = ["sticky", "bounce", "trampoline", "reverse"] as const;
export type SabotageEffect = (typeof SABOTAGE_EFFECTS)[number];

// ===========================================
// Scoring (Duel Mode)
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
// Difficulty Distribution Ratios (Duel Mode)
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
/** Special marker for timeout answers */
export const TIMEOUT_ANSWER = "__TIMEOUT__";

// ===========================================
// Nickname & Discriminator System
// ===========================================
/** Minimum discriminator value (inclusive) */
export const DISCRIMINATOR_MIN = 1000;

/** Maximum discriminator value (inclusive) */
export const DISCRIMINATOR_MAX = 9999;

// ===========================================
// Notification Cleanup TTLs
// ===========================================
/** Expire unanswered challenge invite notifications after 60 minutes */
export const CHALLENGE_INVITE_TTL_MS = 60 * 60 * 1000;

/** Expire pending friend requests after 7 days */
export const FRIEND_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Delete dismissed notifications 7 days after creation */
export const DISMISSED_NOTIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Delete email notification log rows 30 days after send time */
export const EMAIL_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Delete accepted/rejected friend requests 7 days after creation */
export const RESOLVED_FRIEND_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ===========================================
// Theme Validation
// ===========================================
export const MIN_THEME_WORDS = 1;

// ===========================================
// Weekly Goals
// ===========================================
export {
  GRACE_PERIOD_MS,
  MIN_GOAL_DURATION_MS,
  WEEKLY_GOAL_DAILY_REMINDER_LOCAL_HOUR,
  WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE,
  WEEKLY_GOAL_DRAFT_TTL_MS,
} from "../lib/weeklyGoalTiming";
