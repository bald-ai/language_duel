/**
 * Centralized game constants for the Language Duel application.
 * All magic numbers and game balance values should be defined here.
 */

// ===========================================
// Query Limits
// ===========================================
export const MAX_USERS_QUERY = 100;

/** Maximum number of matches returned by the user handle/nickname search */
export const MAX_USER_SEARCH_RESULTS = 20;

// ===========================================
// Timer Options (Learn Phase)
// ===========================================
export { TIMER_OPTIONS } from "../lib/constants";
export const DEFAULT_TIMER_DURATION = 300; // 5 minutes

export { SOLO_INFINITE_STUDY_SECONDS } from "../lib/soloLearnTimer";

// ===========================================
// Hint System
// ===========================================
/** Time bonus given to hint requester (in ms) */
export const HINT_TIME_BONUS_MS = 3000;

/** Maximum letter hints that can be provided */
export const MAX_LETTER_HINTS = 3;

/** Maximum wrong options that can be eliminated through the PvP hint workflow */
export { PVP_HINT_ELIMINATION_PICKS } from "../lib/hintPool/constants";

/** Maximum wrong options that can be eliminated (L2 multiple choice) */
export const MAX_ELIMINATED_OPTIONS_L2 = 2;

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

/** Stale pending-claim reclaim window for email idempotency (10 min) */
export const EMAIL_SEND_CLAIM_STALE_MS = 10 * 60 * 1000;

/** Delete accepted/rejected friend requests 7 days after creation */
export const RESOLVED_FRIEND_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ===========================================
// Weekly Goals
// ===========================================
export {
  DRAFT_EXPIRY_REMINDER_LEAD_MS,
  DRAFT_EXPIRY_REMINDER_WINDOW_MS,
  GRACE_PERIOD_MS,
  MIN_GOAL_DURATION_MS,
  WEEKLY_GOAL_DAILY_REMINDER_LOCAL_HOUR,
  WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE,
  WEEKLY_GOAL_DRAFT_TTL_MS,
} from "../lib/weeklyGoalTiming";
