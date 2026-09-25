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

/** Time bonus given to hint requester (in ms) */
export const HINT_TIME_BONUS_MS = 3000;

/** Bonus points awarded to hint provider when requester answers correctly */
export const HINT_PROVIDER_BONUS = 0.5;
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
