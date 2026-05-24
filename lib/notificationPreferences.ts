import {
  DEFAULT_NOTIFICATION_PREFS,
  WEEKLY_GOAL_REMINDER_1_DEFAULT_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_2_DEFAULT_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_WINDOW_MS,
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from "./notificationPreferencesDefaults";
import {
  NOTIFICATION_EMAIL_TRIGGERS,
  NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS,
  type NotificationEmailTrigger,
} from "./notifications/definitions";

export function isNotificationEnabled(
  trigger: NotificationEmailTrigger,
  prefs: NotificationPreferences
): boolean {
  const config = NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS[trigger];
  if (!config) return false;

  return prefs[config.category] === true && prefs[config.trigger] === true;
}

export function shouldSendWeeklyGoalReminder(
  goal: { endDate?: number; status: string; bigBossStatus?: string },
  now: number,
  reminderOffsetMinutes: number,
  windowMs = WEEKLY_GOAL_REMINDER_WINDOW_MS
): boolean {
  if (goal.status !== "locked") return false;
  if (goal.bigBossStatus === "defeated") return false;
  if (!goal.endDate) return false;
  if (goal.endDate <= now) return false;

  const offsetMs = reminderOffsetMinutes * 60 * 1000;
  const reminderTime = goal.endDate - offsetMs;
  return reminderTime <= now && reminderTime >= now - windowMs;
}

export { DEFAULT_NOTIFICATION_PREFS, type NotificationPreferences };
export { normalizeNotificationPreferences };
export {
  WEEKLY_GOAL_REMINDER_1_DEFAULT_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_2_DEFAULT_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_WINDOW_MS,
};
export {
  NOTIFICATION_EMAIL_TRIGGERS,
  NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS,
  type NotificationEmailTrigger,
};
export {
  formatScheduledTimeForEmail,
  getTimeZoneDateKey,
  getTimeZoneDateParts,
} from "./timeUtils";
