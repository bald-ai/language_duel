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
