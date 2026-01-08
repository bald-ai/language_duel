"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/theme";
import { useNotifications } from "../hooks/useNotifications";
import { useScheduledDuel } from "../hooks/useScheduledDuel";
import { NotificationItem } from "./NotificationItem";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { CounterProposeScheduledDuelModal } from "./CounterProposeScheduledDuelModal";

interface NotificationsTabProps {
    onClose: () => void;
}

/**
 * NotificationsTab - Display all notification types with actions
 * 
 * Features:
 * - Friend requests with accept/reject actions
 * - Weekly plan invitations with view/dismiss actions
 * - Scheduled duel proposals with accept/counter/decline actions
 * - Duel challenges with accept/decline actions
 * - Ready state management for accepted scheduled duels
 */
export function NotificationsTab({ onClose }: NotificationsTabProps) {
    const router = useRouter();
    const { notifications, isLoading, actions } = useNotifications();
    const { setReady, cancelReady, cancelScheduledDuel, scheduledDuels } = useScheduledDuel();
    const [counterDuelId, setCounterDuelId] = useState<Id<"scheduledDuels"> | null>(null);

    // Helper to get scheduled duel data from the list
    const getScheduledDuelData = (scheduledDuelId?: Id<"scheduledDuels">) => {
        if (!scheduledDuelId) return null;
        return scheduledDuels.find((d: { _id: Id<"scheduledDuels"> }) => d._id === scheduledDuelId) || null;
    };

    const handleAcceptFriendRequest = async (notificationId: Id<"notifications">) => {
        try {
            await actions.acceptFriendRequest(notificationId);
            toast.success("Friend request accepted!");
        } catch (_error) {
            toast.error("Failed to accept friend request");
        }
    };

    const handleRejectFriendRequest = async (notificationId: Id<"notifications">) => {
        try {
            await actions.rejectFriendRequest(notificationId);
            toast.success("Friend request rejected");
        } catch (_error) {
            toast.error("Failed to reject friend request");
        }
    };

    const handleAcceptDuelChallenge = async (notificationId: Id<"notifications">, challengeId?: Id<"challenges">, mode?: string) => {
        try {
            const result = await actions.acceptDuelChallenge(notificationId);
            toast.success("Challenge accepted!");
            onClose();
            // Navigate to duel page based on mode
            if (result?.challengeId) {
                const duelMode = mode || 'classic';
                const route = duelMode === 'classic'
                    ? `/classic-duel/${result.challengeId}`
                    : `/duel/${result.challengeId}`;
                router.push(route);
            }
        } catch (_error) {
            toast.error("Failed to accept challenge");
        }
    };

    const handleDeclineDuelChallenge = async (notificationId: Id<"notifications">) => {
        try {
            await actions.declineDuelChallenge(notificationId);
            toast.success("Challenge declined");
        } catch (_error) {
            toast.error("Failed to decline challenge");
        }
    };

    const handleViewWeeklyPlan = (_goalId?: Id<"weeklyGoals">) => {
        onClose();
        router.push("/goals");
    };

    const handleDismissWeeklyPlan = async (notificationId: Id<"notifications">) => {
        try {
            await actions.dismissWeeklyPlanInvitation(notificationId);
        } catch (_error) {
            toast.error("Failed to dismiss notification");
        }
    };

    const handleDismissNotification = async (notificationId: Id<"notifications">) => {
        try {
            await actions.dismissNotification(notificationId);
        } catch (_error) {
            toast.error("Failed to dismiss notification");
        }
    };

    // ========================================
    // Scheduled Duel Handlers
    // ========================================
    const handleAcceptScheduledDuel = async (scheduledDuelId?: Id<"scheduledDuels">) => {
        if (!scheduledDuelId) {
            toast.error("Invalid scheduled duel");
            return;
        }
        try {
            await actions.acceptScheduledDuel(scheduledDuelId);
            toast.success("Scheduled duel accepted! Get ready when it's time.");
        } catch (_error) {
            toast.error("Failed to accept scheduled duel");
        }
    };

    const handleCounterProposeScheduledDuel = (scheduledDuelId?: Id<"scheduledDuels">) => {
        if (!scheduledDuelId) {
            toast.error("Invalid scheduled duel");
            return;
        }
        setCounterDuelId(scheduledDuelId);
    };

    const handleDeclineScheduledDuel = async (scheduledDuelId?: Id<"scheduledDuels">) => {
        if (!scheduledDuelId) {
            toast.error("Invalid scheduled duel");
            return;
        }
        try {
            await actions.declineScheduledDuel(scheduledDuelId);
            toast.success("Scheduled duel cancelled");
        } catch (_error) {
            toast.error("Failed to decline scheduled duel");
        }
    };

    // ========================================
    // Ready State Handlers
    // ========================================
    const handleSetReady = async (scheduledDuelId?: Id<"scheduledDuels">) => {
        if (!scheduledDuelId) {
            toast.error("Invalid scheduled duel");
            return;
        }
        try {
            const result = await setReady(scheduledDuelId);
            if (result.bothReady) {
                toast.success("Both players ready! Starting duel...");
            } else {
                toast.success("You're ready! Waiting for opponent...");
            }
        } catch (_error) {
            toast.error("Failed to set ready status");
        }
    };

    const handleCancelReady = async (scheduledDuelId?: Id<"scheduledDuels">) => {
        if (!scheduledDuelId) {
            toast.error("Invalid scheduled duel");
            return;
        }
        try {
            await cancelReady(scheduledDuelId);
            toast.info("Ready status cancelled");
        } catch (_error) {
            toast.error("Failed to cancel ready status");
        }
    };

    const handleCancelScheduledDuel = async (scheduledDuelId?: Id<"scheduledDuels">) => {
        if (!scheduledDuelId) {
            toast.error("Invalid scheduled duel");
            return;
        }
        try {
            await cancelScheduledDuel(scheduledDuelId);
            toast.success("Scheduled duel cancelled");
        } catch (_error) {
            toast.error("Failed to cancel scheduled duel");
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
            >
                <BellOffIcon />
                <p className="mt-3 text-sm">No notifications</p>
                <p className="text-xs mt-1">You&apos;re all caught up!</p>
            </div>
        );
    }

    return (
        <div className="py-2">
            {notifications.map((notification) => {
                // Get scheduled duel data for ready states
                const scheduledDuelData = getScheduledDuelData(notification.payload?.scheduledDuelId);
                const isProposer = scheduledDuelData?.isProposer || false;

                return (
                    <NotificationItem
                        key={notification._id}
                        notification={notification}
                        onAcceptFriendRequest={() => handleAcceptFriendRequest(notification._id)}
                        onRejectFriendRequest={() => handleRejectFriendRequest(notification._id)}
                        onAcceptDuelChallenge={() => handleAcceptDuelChallenge(notification._id, notification.payload?.challengeId, notification.payload?.mode)}
                        onDeclineDuelChallenge={() => handleDeclineDuelChallenge(notification._id)}
                        onViewWeeklyPlan={() => handleViewWeeklyPlan(notification.payload?.goalId)}
                        onDismissWeeklyPlan={() => handleDismissWeeklyPlan(notification._id)}
                        onDismiss={() => handleDismissNotification(notification._id)}
                        onAcceptScheduledDuel={() => handleAcceptScheduledDuel(notification.payload?.scheduledDuelId)}
                        onCounterProposeScheduledDuel={() => handleCounterProposeScheduledDuel(notification.payload?.scheduledDuelId)}
                        onDeclineScheduledDuel={() => handleDeclineScheduledDuel(notification.payload?.scheduledDuelId)}
                        onCancelScheduledDuel={() => handleCancelScheduledDuel(notification.payload?.scheduledDuelId)}
                        // Ready state props
                        onSetReady={() => handleSetReady(notification.payload?.scheduledDuelId)}
                        onCancelReady={() => handleCancelReady(notification.payload?.scheduledDuelId)}
                        currentUserIsProposer={isProposer}
                        proposerReady={scheduledDuelData?.proposerReady}
                        recipientReady={scheduledDuelData?.recipientReady}
                    />
                );
            })}
            {counterDuelId && (
                <CounterProposeScheduledDuelModal
                    scheduledDuelId={counterDuelId}
                    onClose={() => setCounterDuelId(null)}
                />
            )}
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
