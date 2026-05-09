"use client";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/theme";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

interface NotificationsTabProps {
    onClose: () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const hasGoalId = (
    payload: unknown
): payload is { goalId: Id<"weeklyGoals"> } =>
    isRecord(payload) && "goalId" in payload;

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

/**
 * NotificationsTab - Display all notification types with actions
 * 
 * Features:
 * - Friend requests with accept/reject actions
 * - Weekly plan invitations with view/decline actions
 * - Challenge invites with accept/decline actions
 */
export function NotificationsTab({ onClose }: NotificationsTabProps) {
    const router = useRouter();
    const { notifications, isLoading, actions } = useNotifications();

    const handleAcceptFriendRequest = async (notificationId: Id<"notifications">) => {
        try {
            await actions.acceptFriendRequest(notificationId);
            toast.success("Friend request accepted!");
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to accept friend request"));
        }
    };

    const handleRejectFriendRequest = async (notificationId: Id<"notifications">) => {
        try {
            await actions.rejectFriendRequest(notificationId);
            toast.success("Friend request rejected");
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to reject friend request"));
        }
    };

    const handleAcceptChallenge = async (notificationId: Id<"notifications">) => {
        try {
            const result = await actions.acceptChallenge(notificationId);
            toast.success("Challenge accepted!");
            onClose();
            if (result?.duelId) {
                router.push(`/duel/${result.duelId}`);
            }
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to accept challenge"));
        }
    };

    const handleDeclineChallenge = async (notificationId: Id<"notifications">) => {
        try {
            await actions.declineChallenge(notificationId);
            toast.success("Challenge declined");
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to decline challenge"));
        }
    };

    const handleViewWeeklyPlan = (_goalId?: Id<"weeklyGoals">) => {
        onClose();
        router.push("/goals");
    };

    const handleDismissWeeklyPlan = async (notificationId: Id<"notifications">) => {
        try {
            await actions.dismissWeeklyPlanInvitation(notificationId);
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to dismiss notification"));
        }
    };

    const handleArchiveCompletedGoalThemes = async (notificationId: Id<"notifications">) => {
        try {
            const result = await actions.archiveCompletedGoalThemes(notificationId);
            if (result.archivedCount === 0) {
                toast.success("Themes already archived");
            } else if (result.archivedCount === 1) {
                toast.success("Archived 1 theme");
            } else {
                toast.success(`Archived ${result.archivedCount} themes`);
            }
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to archive themes"));
        }
    };

    const handleDeclineWeeklyPlanInvitation = async (notificationId: Id<"notifications">) => {
        try {
            await actions.declineWeeklyPlanInvitation(notificationId);
            toast.success("Weekly goal invitation declined");
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to decline weekly goal invitation"));
        }
    };

    const handleDismissNotification = async (notificationId: Id<"notifications">) => {
        try {
            await actions.dismissNotification(notificationId);
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to dismiss notification"));
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div
                    className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: colors.primary.DEFAULT }}
                />
            </div>
        );
    }

    if (notifications.length === 0) {
        return (
            <div
                className="flex flex-col items-center justify-center py-12 px-4 text-center"
                style={{ color: colors.text.muted }}
                data-testid="notifications-empty-state"
            >
                <BellOffIcon />
                <p className="mt-3 text-sm">No notifications</p>
                <p className="text-xs mt-1">You&apos;re all caught up!</p>
            </div>
        );
    }

    return (
        <div className="py-2" data-testid="notifications-tab">
            {notifications.map((notification) => {
                const payload = notification.payload;
                const goalId = hasGoalId(payload) ? payload.goalId : undefined;

                return (
                    <NotificationItem
                        key={notification._id}
                        notification={notification}
                        onAcceptFriendRequest={() => handleAcceptFriendRequest(notification._id)}
                        onRejectFriendRequest={() => handleRejectFriendRequest(notification._id)}
                        onAcceptChallenge={() => handleAcceptChallenge(notification._id)}
                        onDeclineChallenge={() => handleDeclineChallenge(notification._id)}
                        onViewWeeklyPlan={() => handleViewWeeklyPlan(goalId)}
                        onDismissWeeklyPlan={() => handleDismissWeeklyPlan(notification._id)}
                        onArchiveCompletedGoalThemes={() => handleArchiveCompletedGoalThemes(notification._id)}
                        onDeclineWeeklyPlan={() => handleDeclineWeeklyPlanInvitation(notification._id)}
                        onDismiss={() => handleDismissNotification(notification._id)}
                    />
                );
            })}
        </div>
    );
}

function BellOffIcon() {
    return (
        <svg
            className="w-12 h-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke={colors.neutral.light}
            strokeWidth={1.5}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.143 17.082a24.248 24.248 0 003.714.257c1.274 0 2.517-.114 3.714-.257m-7.428 0a24.248 24.248 0 01-3.518-.54m11.946.54a24.248 24.248 0 003.518-.54m-18 0a6.002 6.002 0 001.393-3.292A41.45 41.45 0 0112 3a41.45 41.45 0 017.857 10.29 6.002 6.002 0 001.393 3.292m0 0a3 3 0 01-2.25.999H5a3 3 0 01-2.25-.999m18 0L3 17.082"
            />
        </svg>
    );
}

export default NotificationsTab;
