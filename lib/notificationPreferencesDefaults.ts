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

export function normalizeNotificationPreferences(
  prefs: Partial<NotificationPreferences> | null | undefined
): NotificationPreferences {
  return {
    challengeInviteEmailsEnabled:
      prefs?.challengeInviteEmailsEnabled ??
      DEFAULT_NOTIFICATION_PREFS.challengeInviteEmailsEnabled,
    challengeInviteEmailEnabled:
      prefs?.challengeInviteEmailEnabled ??
      DEFAULT_NOTIFICATION_PREFS.challengeInviteEmailEnabled,
    weeklyGoalEmailsEnabled:
      prefs?.weeklyGoalEmailsEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalEmailsEnabled,
    weeklyGoalInviteEmailEnabled:
      prefs?.weeklyGoalInviteEmailEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalInviteEmailEnabled,
    weeklyGoalAcceptedEmailEnabled:
      prefs?.weeklyGoalAcceptedEmailEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalAcceptedEmailEnabled,
    weeklyGoalLockedEmailEnabled:
      prefs?.weeklyGoalLockedEmailEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalLockedEmailEnabled,
    weeklyGoalDailyReminderEmailEnabled:
      prefs?.weeklyGoalDailyReminderEmailEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalDailyReminderEmailEnabled,
    weeklyGoalGracePeriodReminderEmailEnabled:
      prefs?.weeklyGoalGracePeriodReminderEmailEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalGracePeriodReminderEmailEnabled,
    weeklyGoalDraftExpiringEmailEnabled:
      prefs?.weeklyGoalDraftExpiringEmailEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalDraftExpiringEmailEnabled,
    weeklyGoalReminder1EmailEnabled:
      prefs?.weeklyGoalReminder1EmailEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1EmailEnabled,
    weeklyGoalReminder1OffsetMinutes:
      prefs?.weeklyGoalReminder1OffsetMinutes ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1OffsetMinutes,
    weeklyGoalReminder2EmailEnabled:
      prefs?.weeklyGoalReminder2EmailEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2EmailEnabled,
    weeklyGoalReminder2OffsetMinutes:
      prefs?.weeklyGoalReminder2OffsetMinutes ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes,
  };
}
