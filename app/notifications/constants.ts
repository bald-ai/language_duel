// Notification Panel Constants

export const PANEL_TABS = {
    FRIENDS: 'friends',
    NOTIFICATIONS: 'notifications',
} as const;

export type PanelTab = typeof PANEL_TABS[keyof typeof PANEL_TABS];

export const NOTIFICATION_TYPES = {
    FRIEND_REQUEST: 'friend_request',
    WEEKLY_PLAN_INVITATION: 'weekly_plan_invitation',
    SCHEDULED_DUEL: 'scheduled_duel',
    DUEL_CHALLENGE: 'duel_challenge',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// Time slot configuration for scheduled duels
export const TIME_SLOT_INTERVAL_MINUTES = 30;
export const MIN_HOURS_AHEAD = 0; // Can schedule from current time

// Friend context menu actions
export const FRIEND_ACTIONS = {
    SCHEDULE_DUEL: 'schedule_duel',
    REMOVE_FRIEND: 'remove_friend',
} as const;

export type FriendAction = typeof FRIEND_ACTIONS[keyof typeof FRIEND_ACTIONS];

// Ready state and scheduled duel timeout constants
export const READY_STATE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const SCHEDULED_DUEL_GRACE_PERIOD_MS = 60 * 60 * 1000; // 1 hour
