export type NotificationPreferences = {
  immediateDuelsEnabled: boolean;
  immediateDuelChallengeEnabled: boolean;

  scheduledDuelsEnabled: boolean;
  scheduledDuelProposalEnabled: boolean;
  scheduledDuelReminderEnabled: boolean;
  scheduledDuelReminderOffsetMinutes: number;

  weeklyGoalsEnabled: boolean;
  weeklyGoalInviteEnabled: boolean;
  weeklyGoalAcceptedEnabled: boolean;
  weeklyGoalLockedEnabled: boolean;
  weeklyGoalReminder1Enabled: boolean;
  weeklyGoalReminder1OffsetMinutes: number;
  weeklyGoalReminder2Enabled: boolean;
  weeklyGoalReminder2OffsetMinutes: number;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  immediateDuelsEnabled: true,
  immediateDuelChallengeEnabled: true,

  scheduledDuelsEnabled: true,
  scheduledDuelProposalEnabled: true,
  scheduledDuelReminderEnabled: true,
  scheduledDuelReminderOffsetMinutes: 15,

  weeklyGoalsEnabled: true,
  weeklyGoalInviteEnabled: true,
  weeklyGoalAcceptedEnabled: true,
  weeklyGoalLockedEnabled: true,
  weeklyGoalReminder1Enabled: true,
  weeklyGoalReminder1OffsetMinutes: 4320,
  weeklyGoalReminder2Enabled: true,
  weeklyGoalReminder2OffsetMinutes: 1440,
};
