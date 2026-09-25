export type NotificationPreferences = {
  challengeInviteEmailsEnabled: boolean;
  challengeInviteEmailEnabled: boolean;

  weeklyGoalEmailsEnabled: boolean;
  weeklyGoalInviteEmailEnabled: boolean;
  weeklyGoalAcceptedEmailEnabled: boolean;
  weeklyGoalLockedEmailEnabled: boolean;
  weeklyGoalDailyReminderEmailEnabled: boolean;
  weeklyGoalGracePeriodReminderEmailEnabled: boolean;
  weeklyGoalDraftExpiringEmailEnabled: boolean;
  weeklyGoalReminder1EmailEnabled: boolean;
  weeklyGoalReminder1OffsetMinutes: number;
  weeklyGoalReminder2EmailEnabled: boolean;
  weeklyGoalReminder2OffsetMinutes: number;
};

export const WEEKLY_GOAL_REMINDER_1_DEFAULT_OFFSET_MINUTES = 3 * 24 * 60;
export const WEEKLY_GOAL_REMINDER_2_DEFAULT_OFFSET_MINUTES = 24 * 60;
export const WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES = 1;
export const WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES = 7 * 24 * 60;
export const WEEKLY_GOAL_REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  challengeInviteEmailsEnabled: true,
  challengeInviteEmailEnabled: true,

  weeklyGoalEmailsEnabled: true,
  weeklyGoalInviteEmailEnabled: true,
  weeklyGoalAcceptedEmailEnabled: true,
  weeklyGoalLockedEmailEnabled: true,
  weeklyGoalDailyReminderEmailEnabled: true,
  weeklyGoalGracePeriodReminderEmailEnabled: true,
  weeklyGoalDraftExpiringEmailEnabled: true,
  weeklyGoalReminder1EmailEnabled: true,
  weeklyGoalReminder1OffsetMinutes: WEEKLY_GOAL_REMINDER_1_DEFAULT_OFFSET_MINUTES,
  weeklyGoalReminder2EmailEnabled: true,
  weeklyGoalReminder2OffsetMinutes: WEEKLY_GOAL_REMINDER_2_DEFAULT_OFFSET_MINUTES,
};

type BooleanPreferenceKey = {
  [Key in keyof NotificationPreferences]: NotificationPreferences[Key] extends boolean ? Key : never
}[keyof NotificationPreferences];

const BOOLEAN_PREFERENCE_KEYS = [
  "challengeInviteEmailsEnabled", "challengeInviteEmailEnabled",
  "weeklyGoalEmailsEnabled", "weeklyGoalInviteEmailEnabled",
  "weeklyGoalAcceptedEmailEnabled", "weeklyGoalLockedEmailEnabled",
  "weeklyGoalDailyReminderEmailEnabled", "weeklyGoalGracePeriodReminderEmailEnabled",
  "weeklyGoalDraftExpiringEmailEnabled", "weeklyGoalReminder1EmailEnabled",
  "weeklyGoalReminder2EmailEnabled",
] satisfies BooleanPreferenceKey[];

function normalizeReminderOffset(
  value: number | undefined,
  defaultValue: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES ||
    value > WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES
  ) {
    return defaultValue;
  }

  return value;
}

export function normalizeNotificationPreferences(
  prefs: Partial<NotificationPreferences> | null | undefined
): NotificationPreferences {
  const normalized = { ...DEFAULT_NOTIFICATION_PREFS };
  if (!prefs) return normalized;

  for (const key of BOOLEAN_PREFERENCE_KEYS) {
    normalized[key] = prefs[key] ?? DEFAULT_NOTIFICATION_PREFS[key];
  }
  normalized.weeklyGoalReminder1OffsetMinutes = normalizeReminderOffset(
    prefs.weeklyGoalReminder1OffsetMinutes,
    DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1OffsetMinutes
  );
  normalized.weeklyGoalReminder2OffsetMinutes = normalizeReminderOffset(
    prefs.weeklyGoalReminder2OffsetMinutes,
    DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes
  );
  return normalized;
}
