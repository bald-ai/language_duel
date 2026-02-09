"use client";

import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Hook to manage notifications data and actions
 */
export function useNotifications() {
    const notifications = useQuery(api.notifications.getNotifications);
    const notificationCount = useQuery(api.notifications.getNotificationCount);

    // Mutations
    const dismissNotificationMutation = useMutation(api.notifications.dismissNotification);
    const markReadMutation = useMutation(api.notifications.markNotificationRead);
    const acceptFriendRequestMutation = useMutation(api.friends.acceptFriendRequestNotification);
    const rejectFriendRequestMutation = useMutation(api.friends.rejectFriendRequestNotification);
    const acceptDuelChallengeMutation = useMutation(api.lobby.acceptDuelChallenge);
    const declineDuelChallengeMutation = useMutation(api.lobby.declineDuelChallenge);
    const dismissWeeklyPlanMutation = useMutation(api.weeklyGoals.dismissWeeklyPlanInvitation);

    // Scheduled duel mutations
    const acceptScheduledDuelMutation = useMutation(api.scheduledDuels.acceptScheduledDuel);
    const counterProposeScheduledDuelMutation = useMutation(api.scheduledDuels.counterProposeScheduledDuel);
    const declineScheduledDuelMutation = useMutation(api.scheduledDuels.declineScheduledDuel);

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

    const acceptFriendRequest = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            await acceptFriendRequestMutation({ notificationId });
            return { success: true };
        } catch (error) {
            console.error("Failed to accept friend request:", error);
            throw error;
        }
    }, [acceptFriendRequestMutation]);

    const rejectFriendRequest = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            await rejectFriendRequestMutation({ notificationId });
            return { success: true };
        } catch (error) {
            console.error("Failed to reject friend request:", error);
            throw error;
        }
    }, [rejectFriendRequestMutation]);

    const acceptDuelChallenge = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            const result = await acceptDuelChallengeMutation({ notificationId });
            return result;
        } catch (error) {
            console.error("Failed to accept duel challenge:", error);
            throw error;
        }
    }, [acceptDuelChallengeMutation]);

    const declineDuelChallenge = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            await declineDuelChallengeMutation({ notificationId });
            return { success: true };
        } catch (error) {
            console.error("Failed to decline duel challenge:", error);
            throw error;
        }
    }, [declineDuelChallengeMutation]);

    const dismissWeeklyPlanInvitation = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            await dismissWeeklyPlanMutation({ notificationId });
            return { success: true };
        } catch (error) {
            console.error("Failed to dismiss weekly plan invitation:", error);
            throw error;
        }
    }, [dismissWeeklyPlanMutation]);

    const acceptScheduledDuel = useCallback(async (scheduledDuelId: Id<"scheduledDuels">) => {
        try {
            await acceptScheduledDuelMutation({ scheduledDuelId });
            return { success: true };
        } catch (error) {
            console.error("Failed to accept scheduled duel:", error);
            throw error;
        }
    }, [acceptScheduledDuelMutation]);

    const counterProposeScheduledDuel = useCallback(async (
        scheduledDuelId: Id<"scheduledDuels">,
        data: { newScheduledTime?: number; newThemeId?: Id<"themes"> }
    ) => {
        try {
            await counterProposeScheduledDuelMutation({
                scheduledDuelId,
                newScheduledTime: data.newScheduledTime,
                newThemeId: data.newThemeId,
            });
            return { success: true };
        } catch (error) {
            console.error("Failed to counter-propose scheduled duel:", error);
            throw error;
        }
    }, [counterProposeScheduledDuelMutation]);

    const declineScheduledDuel = useCallback(async (scheduledDuelId: Id<"scheduledDuels">) => {
        try {
            await declineScheduledDuelMutation({ scheduledDuelId });
            return { success: true };
        } catch (error) {
            console.error("Failed to decline scheduled duel:", error);
            throw error;
        }
    }, [declineScheduledDuelMutation]);

    return {
        // Data
        notifications: notifications ?? [],
        notificationCount: notificationCount ?? 0,
        isLoading: notifications === undefined,

        // Actions
        actions: {
            dismissNotification,
            markAsRead,
            acceptFriendRequest,
            rejectFriendRequest,
            acceptDuelChallenge,
            declineDuelChallenge,
            dismissWeeklyPlanInvitation,
            acceptScheduledDuel,
            counterProposeScheduledDuel,
            declineScheduledDuel,
        },
    };
}

export default useNotifications;
