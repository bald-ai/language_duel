// Notification Panel Constants

export const PANEL_TABS = {
    FRIENDS: "friends",
    NOTIFICATIONS: "notifications",
} as const;

export type PanelTab = typeof PANEL_TABS[keyof typeof PANEL_TABS];

export const NOTIFICATION_TYPES = {
    FRIEND_REQUEST: "friend_request",
    WEEKLY_GOAL_INVITATION: "weekly_goal_invitation",
    WEEKLY_GOAL_DRAFT_EXPIRING: "weekly_goal_draft_expiring",
    CHALLENGE_INVITE: "challenge_invite",
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// Friend context menu actions
export const FRIEND_ACTIONS = {
    REMOVE_FRIEND: "remove_friend",
} as const;

export type FriendAction = typeof FRIEND_ACTIONS[keyof typeof FRIEND_ACTIONS];
