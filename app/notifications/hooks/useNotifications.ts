"use client";

import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useChallengeNotificationActions } from "./useChallengeNotificationActions";
import { useFriendNotificationActions } from "./useFriendNotificationActions";
import { useWeeklyGoalNotificationActions } from "./useWeeklyGoalNotificationActions";

/**
 * Hook to manage notifications data and actions
 */
export function useNotifications() {
    const notifications = useQuery(api.notifications.getNotifications);
    const notificationCount = useQuery(api.notifications.getNotificationCount);

    // Mutations
    const dismissNotificationMutation = useMutation(api.notifications.dismissNotification);
    const markReadMutation = useMutation(api.notifications.markNotificationRead);
    const friendActions = useFriendNotificationActions();
    const challengeActions = useChallengeNotificationActions();
    const weeklyGoalActions = useWeeklyGoalNotificationActions();

    const dismissNotification = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            await dismissNotificationMutation({ notificationId });
        } catch (error) {
            console.error("Failed to dismiss notification:", error);
            throw error;
        }
    }, [dismissNotificationMutation]);

    const markAsRead = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            await markReadMutation({ notificationId });
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
            throw error;
        }
    }, [markReadMutation]);

    return {
        // Data
        notifications: notifications ?? [],
        notificationCount: notificationCount ?? 0,
        isLoading: notifications === undefined,

        // Actions
        actions: {
            dismissNotification,
            markAsRead,
            ...friendActions,
            ...challengeActions,
            ...weeklyGoalActions,
        },
    };
}

export default useNotifications;
