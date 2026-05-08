export type NotificationPreferences = {
  challengeInvitesEnabled: boolean;
  challengeInviteEmailEnabled: boolean;

  weeklyGoalsEnabled: boolean;
  weeklyGoalInviteEnabled: boolean;
  weeklyGoalAcceptedEnabled: boolean;
  weeklyGoalLockedEnabled: boolean;
  weeklyGoalDailyReminderEnabled: boolean;
  weeklyGoalGracePeriodReminderEnabled: boolean;
  weeklyGoalDraftExpiringEnabled: boolean;
  weeklyGoalReminder1Enabled: boolean;
  weeklyGoalReminder1OffsetMinutes: number;
  weeklyGoalReminder2Enabled: boolean;
  weeklyGoalReminder2OffsetMinutes: number;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  challengeInvitesEnabled: true,
  challengeInviteEmailEnabled: true,

  weeklyGoalsEnabled: true,
  weeklyGoalInviteEnabled: true,
  weeklyGoalAcceptedEnabled: true,
  weeklyGoalLockedEnabled: true,
  weeklyGoalDailyReminderEnabled: true,
  weeklyGoalGracePeriodReminderEnabled: true,
  weeklyGoalDraftExpiringEnabled: true,
  weeklyGoalReminder1Enabled: true,
  weeklyGoalReminder1OffsetMinutes: 4320,
  weeklyGoalReminder2Enabled: true,
  weeklyGoalReminder2OffsetMinutes: 1440,
};
