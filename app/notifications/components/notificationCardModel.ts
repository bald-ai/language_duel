import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// The notification shape exactly as the server query returns it (enriched with
// `fromUser` and the real discriminated `payload` union). Single-sourced so no
// card re-declares — or drifts from — the boundary.
export type EnrichedNotification =
  FunctionReturnType<typeof api.notifications.getNotifications>[number];

/**
 * Toast/router-wrapped handlers shared by the notification cards. Each card
 * pulls only the ones it needs; the wrappers are built once in NotificationsTab.
 */
export interface NotificationCardActions {
  acceptFriendRequest: (notificationId: Id<"notifications">) => void;
  rejectFriendRequest: (notificationId: Id<"notifications">) => void;
  acceptChallenge: (notificationId: Id<"notifications">) => void;
  declineChallenge: (notificationId: Id<"notifications">) => void;
  viewWeeklyGoal: () => void;
  declineWeeklyGoal: (notificationId: Id<"notifications">) => void;
  dismissWeeklyGoal: (notificationId: Id<"notifications">) => void;
  archiveCompletedGoalThemes: (notificationId: Id<"notifications">) => void;
  dismiss: (notificationId: Id<"notifications">) => void;
}

export interface NotificationCardProps {
  notification: EnrichedNotification;
  actions: NotificationCardActions;
}

export function themeCountLabel(count: number): string {
  return count === 1 ? "1 theme" : `${count} themes`;
}
