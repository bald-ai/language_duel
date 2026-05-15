// Notification Panel Constants

export {
    NOTIFICATION_TYPES,
    type NotificationType,
} from "@/lib/notifications/definitions";

export const PANEL_TABS = {
    FRIENDS: "friends",
    NOTIFICATIONS: "notifications",
} as const;

export type PanelTab = typeof PANEL_TABS[keyof typeof PANEL_TABS];

// Friend context menu actions
export const FRIEND_ACTIONS = {
    REMOVE_FRIEND: "remove_friend",
} as const;

export type FriendAction = typeof FRIEND_ACTIONS[keyof typeof FRIEND_ACTIONS];
