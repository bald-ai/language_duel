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
    const acceptChallengeMutation = useMutation(api.lobby.acceptChallengeFromNotification);
    const declineChallengeMutation = useMutation(api.lobby.declineChallengeFromNotification);
    const dismissWeeklyGoalMutation = useMutation(api.weeklyGoals.dismissWeeklyGoalInvitation);
    const archiveCompletedGoalThemesMutation = useMutation(api.weeklyGoals.archiveCompletedGoalThemesFromNotification);
    const declineWeeklyGoalMutation = useMutation(api.weeklyGoals.declineWeeklyGoalInvitation);

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

    const acceptChallenge = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            const result = await acceptChallengeMutation({ notificationId });
            return result;
        } catch (error) {
            console.error("Failed to accept challenge:", error);
            throw error;
        }
    }, [acceptChallengeMutation]);

    const declineChallenge = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            await declineChallengeMutation({ notificationId });
            return { success: true };
        } catch (error) {
            console.error("Failed to decline challenge:", error);
            throw error;
        }
    }, [declineChallengeMutation]);

    const dismissWeeklyGoalInvitation = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            await dismissWeeklyGoalMutation({ notificationId });
            return { success: true };
        } catch (error) {
            console.error("Failed to dismiss weekly goal invitation:", error);
            throw error;
        }
    }, [dismissWeeklyGoalMutation]);

    const declineWeeklyGoalInvitation = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            await declineWeeklyGoalMutation({ notificationId });
            return { success: true };
        } catch (error) {
            console.error("Failed to decline weekly goal invitation:", error);
            throw error;
        }
    }, [declineWeeklyGoalMutation]);

    const archiveCompletedGoalThemes = useCallback(async (notificationId: Id<"notifications">) => {
        try {
            return await archiveCompletedGoalThemesMutation({ notificationId });
        } catch (error) {
            console.error("Failed to archive completed goal themes:", error);
            throw error;
        }
    }, [archiveCompletedGoalThemesMutation]);

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
            acceptChallenge,
            declineChallenge,
            dismissWeeklyGoalInvitation,
            declineWeeklyGoalInvitation,
            archiveCompletedGoalThemes,
        },
    };
}

export default useNotifications;
