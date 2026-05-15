import type { NotificationPreferences } from "../notificationPreferencesDefaults";

export const NOTIFICATION_DEFINITIONS = {
  friend_request: {
    type: "friend_request",
    payloadKind: "friend_request",
    label: "Friend request",
    category: "friends",
    dismissible: true,
  },
  weekly_goal_invitation: {
    type: "weekly_goal_invitation",
    payloadKind: "weekly_goal",
    label: "Weekly goal",
    category: "weekly_goals",
    dismissible: true,
  },
  weekly_goal_draft_expiring: {
    type: "weekly_goal_draft_expiring",
    payloadKind: "weekly_goal",
    label: "Weekly goal draft expiry",
    category: "weekly_goals",
    dismissible: true,
  },
  challenge_invite: {
    type: "challenge_invite",
    payloadKind: "challenge_invite",
    label: "Challenge invite",
    category: "challenges",
    dismissible: true,
  },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_DEFINITIONS;

export const NOTIFICATION_TYPES = Object.fromEntries(
  Object.keys(NOTIFICATION_DEFINITIONS).map((type) => [type.toUpperCase(), type])
) as {
  FRIEND_REQUEST: "friend_request";
  WEEKLY_GOAL_INVITATION: "weekly_goal_invitation";
  WEEKLY_GOAL_DRAFT_EXPIRING: "weekly_goal_draft_expiring";
  CHALLENGE_INVITE: "challenge_invite";
};

export const NOTIFICATION_TYPE_VALUES = Object.keys(
  NOTIFICATION_DEFINITIONS
) as NotificationType[];

export const DISMISSABLE_NOTIFICATION_TYPES = NOTIFICATION_TYPE_VALUES.filter(
  (type) => NOTIFICATION_DEFINITIONS[type].dismissible
);

type BooleanPreferenceKey = {
  [K in keyof NotificationPreferences]: NotificationPreferences[K] extends boolean ? K : never;
}[keyof NotificationPreferences];

export type NotificationEmailTriggerConfig = {
  category: BooleanPreferenceKey;
  trigger: BooleanPreferenceKey;
  label: string;
  reminderOffset?: {
    field: "weeklyGoalReminder1OffsetMinutes" | "weeklyGoalReminder2OffsetMinutes";
    label: string;
  };
};

export const NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS = {
  immediate_challenge_invite: {
    category: "challengeInviteEmailsEnabled",
    trigger: "challengeInviteEmailEnabled",
    label: "Challenge invite email",
  },
  weekly_goal_invite: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalInviteEmailEnabled",
    label: "Goal invite received",
  },
  weekly_goal_locked: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalLockedEmailEnabled",
    label: "Partner locked goal",
  },
  weekly_goal_accepted: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalAcceptedEmailEnabled",
    label: "Goal invite accepted",
  },
  weekly_goal_daily_reminder: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalDailyReminderEmailEnabled",
    label: "Daily goal countdown email",
  },
  weekly_goal_draft_expiring: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalDraftExpiringEmailEnabled",
    label: "Draft expiry warning",
  },
  weekly_goal_grace_period_reminder: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalGracePeriodReminderEmailEnabled",
    label: "Grace period warning",
  },
  weekly_goal_reminder_1: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalReminder1EmailEnabled",
    label: "Goal reminder 1",
    reminderOffset: {
      field: "weeklyGoalReminder1OffsetMinutes",
      label: "First reminder before expiry",
    },
  },
  weekly_goal_reminder_2: {
    category: "weeklyGoalEmailsEnabled",
    trigger: "weeklyGoalReminder2EmailEnabled",
    label: "Goal reminder 2",
    reminderOffset: {
      field: "weeklyGoalReminder2OffsetMinutes",
      label: "Second reminder before expiry",
    },
  },
} as const satisfies Record<string, NotificationEmailTriggerConfig>;

export type NotificationEmailTrigger = keyof typeof NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS;

export const NOTIFICATION_EMAIL_TRIGGERS = Object.keys(
  NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS
) as NotificationEmailTrigger[];
