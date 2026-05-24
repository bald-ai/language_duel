/** Expire draft weekly goals after 7 days. */
export const WEEKLY_GOAL_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Keep grace-period weekly goals visible for 48 hours before deleting them. */
export const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

/**
 * Daily weekly-goal countdown reminder timing.
 * Chosen from the user request on 2026-04-19:
 * current Brno time minus 10 hours => 12:00 local hour.
 */
export const WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE = "Europe/Prague";
export const WEEKLY_GOAL_DAILY_REMINDER_LOCAL_HOUR = 12;

export const MIN_GOAL_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Daily reminder window for drafts nearing expiry. The cron reminds about a
 * draft when its TTL is between (lead − window) and lead away — i.e. ~1 day
 * before expiry, within a 2h catch window so each draft is reminded once.
 */
export const DRAFT_EXPIRY_REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;
export const DRAFT_EXPIRY_REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;
