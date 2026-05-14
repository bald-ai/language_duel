import type { NotificationPreferences } from "./notificationPreferencesDefaults";

type BooleanPreferenceKey = {
  [K in keyof NotificationPreferences]: NotificationPreferences[K] extends boolean ? K : never;
}[keyof NotificationPreferences];

type NotificationEmailTriggerConfig = {
  category: BooleanPreferenceKey;
  trigger: BooleanPreferenceKey;
};

export const NOTIFICATION_EMAIL_TRIGGER_CONTRACT = {
  immediate_challenge_invite: {
    category: "challengeInviteEmailsEnabled",
    trigger: "challengeInviteEmailEnabled",
  },
  weekly_goal_invite: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalInviteEmailEnabled",
  },
  weekly_goal_locked: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalLockedEmailEnabled",
  },
  weekly_goal_accepted: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalAcceptedEmailEnabled",
  },
  weekly_goal_daily_reminder: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalDailyReminderEmailEnabled",
  },
  weekly_goal_draft_expiring: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalDraftExpiringEmailEnabled",
  },
  weekly_goal_grace_period_reminder: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalGracePeriodReminderEmailEnabled",
  },
  weekly_goal_reminder_1: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalReminder1EmailEnabled",
  },
  weekly_goal_reminder_2: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalReminder2EmailEnabled",
  },
} as const satisfies Record<string, NotificationEmailTriggerConfig>;

export type NotificationTrigger = keyof typeof NOTIFICATION_EMAIL_TRIGGER_CONTRACT;

export const NOTIFICATION_EMAIL_TRIGGERS = Object.keys(
  NOTIFICATION_EMAIL_TRIGGER_CONTRACT
) as NotificationTrigger[];
