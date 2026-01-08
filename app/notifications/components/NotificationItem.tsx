"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/theme";
import { getRelativeTime, formatScheduledTime } from "@/lib/timeUtils";
import { useCountdown } from "../hooks/useCountdown";
import { NOTIFICATION_TYPES } from "../constants";
import type { Id } from "@/convex/_generated/dataModel";

interface NotificationData {
    _id: Id<"notifications">;
    type: string;
    fromUser: {
        nickname?: string;
        discriminator?: number;
        imageUrl?: string;
    } | null;
    payload?: {
        challengeId?: Id<"challenges">;
        scheduledDuelId?: Id<"scheduledDuels">;
        goalId?: Id<"weeklyGoals">;
        friendRequestId?: Id<"friendRequests">;
        themeName?: string;
        scheduledTime?: number;
        mode?: string;
        isCounterProposal?: boolean;
        themeCount?: number;
        scheduledDuelStatus?: string;
        startedDuelId?: Id<"challenges">;
        proposerReady?: boolean;
        recipientReady?: boolean;
        isProposer?: boolean;
    };
    createdAt: number;
    status: string;
}

interface NotificationItemProps {
    notification: NotificationData;
    onAcceptFriendRequest: () => void;
    onRejectFriendRequest: () => void;
    onAcceptDuelChallenge: () => void;
    onDeclineDuelChallenge: () => void;
    onViewWeeklyPlan: () => void;
    onDismissWeeklyPlan: () => void;
    onDismiss: () => void;
    // Scheduled duel handlers
    onAcceptScheduledDuel: () => void;
    onCounterProposeScheduledDuel: () => void;
    onDeclineScheduledDuel: () => void;
    onCancelScheduledDuel?: () => void; // For cancelling accepted duels
    // Ready state handlers
    onSetReady?: () => void;
    onCancelReady?: () => void;
    // Current user info for ready state
    currentUserIsProposer?: boolean;
    proposerReady?: boolean;
    recipientReady?: boolean;
}

/**
 * NotificationItem - Individual notification card
 * 
 * Features:
 * - Icon based on notification type
 * - User avatar/name
 * - Relative timestamp
 * - Action buttons per notification type
 * - Countdown and ready state for accepted scheduled duels
 */
export function NotificationItem({
    notification,
    onAcceptFriendRequest,
    onRejectFriendRequest,
    onAcceptDuelChallenge,
    onDeclineDuelChallenge,
    onViewWeeklyPlan,
    onDismissWeeklyPlan,
    onDismiss,
    onAcceptScheduledDuel,
    onCounterProposeScheduledDuel,
    onDeclineScheduledDuel,
    onCancelScheduledDuel,
    onSetReady,
    onCancelReady,
    currentUserIsProposer,
    proposerReady,
    recipientReady,
}: NotificationItemProps) {
    const { type, fromUser, payload, createdAt } = notification;
    const router = useRouter();
    const onDismissRef = useRef(onDismiss);
    const navigationScheduledRef = useRef(false);
    const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        onDismissRef.current = onDismiss;
    }, [onDismiss]);

    // Countdown for scheduled duels
    const scheduledTime = payload?.scheduledTime || 0;
    const countdown = useCountdown(scheduledTime);

    // Determine if this is an accepted scheduled duel
    const isAcceptedScheduledDuel =
        type === NOTIFICATION_TYPES.SCHEDULED_DUEL &&
        payload?.scheduledDuelStatus === "accepted";

    // Determine ready states
    const currentUserReady = currentUserIsProposer ? proposerReady : recipientReady;
    const opponentReady = currentUserIsProposer ? recipientReady : proposerReady;
    const bothReady = proposerReady && recipientReady;

    // Duel started check
    const duelStarted = !!payload?.startedDuelId;

    // Auto-navigate when duel starts and dismiss notification
    useEffect(() => {
        if (!duelStarted || !payload?.startedDuelId || navigationScheduledRef.current) {
            return;
        }

        navigationScheduledRef.current = true;
        // Small delay to show "Joining..." state, then navigate and dismiss
        const mode = payload?.mode || "classic";
        const route = mode === "classic"
            ? `/classic-duel/${payload.startedDuelId}`
            : `/duel/${payload.startedDuelId}`;

        navigationTimerRef.current = setTimeout(() => {
            router.push(route);
            // Dismiss the notification so it doesn't linger
            onDismissRef.current();
        }, 1500);
    }, [duelStarted, payload?.startedDuelId, payload?.mode, router]);

    useEffect(() => {
        return () => {
            if (navigationTimerRef.current) {
                clearTimeout(navigationTimerRef.current);
                navigationTimerRef.current = null;
            }
        };
    }, []);

    const getNotificationContent = () => {
        const userName = fromUser?.nickname || 'Someone';

        switch (type) {
            case NOTIFICATION_TYPES.FRIEND_REQUEST:
                return {
                    icon: <UserPlusIcon />,
                    message: `${userName} wants to add you as a friend`,
                    actions: (
                        <div className="flex gap-2 mt-3">
                            <ActionButton onClick={onAcceptFriendRequest} variant="accept">
                                Accept
                            </ActionButton>
                            <ActionButton onClick={onRejectFriendRequest} variant="reject">
                                Reject
                            </ActionButton>
                        </div>
                    ),
                };

            case NOTIFICATION_TYPES.WEEKLY_PLAN_INVITATION:
                return {
                    icon: <CalendarIcon />,
                    message: `${userName} invited you to a weekly plan with ${payload?.themeCount || 0} theme${(payload?.themeCount || 0) !== 1 ? 's' : ''}`,
                    actions: (
                        <div className="flex gap-2 mt-3">
                            <ActionButton onClick={onViewWeeklyPlan} variant="accept">
                                View
                            </ActionButton>
                            <ActionButton onClick={onDismissWeeklyPlan} variant="dismiss">
                                Dismiss
                            </ActionButton>
                        </div>
                    ),
                };

            case NOTIFICATION_TYPES.SCHEDULED_DUEL:
                const isCounter = payload?.isCounterProposal;
                const formattedTime = payload?.scheduledTime
                    ? formatScheduledTime(payload.scheduledTime)
                    : 'soon';

                // Check if duel has started - show joining state with fallback dismiss
                if (duelStarted) {
                    return {
                        icon: <SwordIcon />,
                        message: `${payload?.themeName || 'Theme'} — Joining duel...`,
                        actions: (
                            <div className="flex items-center gap-2 mt-3">
                                <div
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium animate-pulse"
                                    style={{
                                        backgroundColor: `${colors.cta.DEFAULT}15`,
                                        color: colors.cta.DEFAULT
                                    }}
                                >
                                    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Joining...
                                </div>
                                <button
                                    onClick={onDismiss}
                                    className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                                    style={{ color: colors.text.muted }}
                                >
                                    ✕
                                </button>
                            </div>
                        ),
                    };
                }
                // Accepted state - improved UX with clear status/action separation
                if (isAcceptedScheduledDuel) {
                    const countdownText = countdown.isExpired
                        ? 'Ready to start!'
                        : `in ${countdown.formattedTime}`;

                    // Both ready - show starting state
                    if (bothReady) {
                        return {
                            icon: <ClockIcon />,
                            message: `Scheduled duel: ${payload?.themeName || 'Theme'}`,
                            actions: (
                                <div className="flex flex-col gap-2 mt-3">
                                    <div
                                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium animate-pulse"
                                        style={{
                                            backgroundColor: `${colors.cta.DEFAULT}15`,
                                            color: colors.cta.DEFAULT
                                        }}
                                    >
                                        <span>✓ You</span>
                                        <span>✓ {userName}</span>
                                        <span className="ml-1">— Starting...</span>
                                    </div>
                                </div>
                            ),
                        };
                    }

                    return {
                        icon: <ClockIcon />,
                        message: `Scheduled duel: ${payload?.themeName || 'Theme'} ${countdownText}`,
                        actions: (
                            <div className="flex flex-col gap-2 mt-3">
                                {/* Status row - who's ready */}
                                <div
                                    className="flex items-center gap-3 text-xs"
                                    style={{ color: colors.text.muted }}
                                >
                                    <span style={{ color: currentUserReady ? colors.cta.DEFAULT : colors.text.muted }}>
                                        {currentUserReady ? '✓ You' : '○ You'}
                                    </span>
                                    <span style={{ color: opponentReady ? colors.cta.DEFAULT : colors.text.muted }}>
                                        {opponentReady ? `✓ ${userName}` : `○ ${userName}`}
                                    </span>
                                </div>

                                {/* Action row - buttons */}
                                <div className="flex gap-2">
                                    {currentUserReady ? (
                                        <button
                                            onClick={onCancelReady || (() => { })}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                                            style={{
                                                backgroundColor: `${colors.cta.DEFAULT}15`,
                                                color: colors.cta.dark
                                            }}
                                        >
                                            Ready ✓ <span className="opacity-60 ml-1">undo</span>
                                        </button>
                                    ) : (
                                        onSetReady && (
                                            <ActionButton onClick={onSetReady} variant="accept">
                                                Ready Up
                                            </ActionButton>
                                        )
                                    )}
                                    <ActionButton
                                        onClick={onCancelScheduledDuel || onDeclineScheduledDuel}
                                        variant="reject"
                                    >
                                        Cancel
                                    </ActionButton>
                                </div>
                            </div>
                        ),
                    };
                }

                // Pending/counter-proposed state - show accept/counter/decline
                return {
                    icon: <ClockIcon />,
                    message: isCounter
                        ? `${userName} counter-proposed: ${payload?.themeName || 'a duel'} at ${formattedTime}`
                        : `${userName} proposes a duel: ${payload?.themeName || 'Theme'} at ${formattedTime}`,
                    actions: (
                        <div className="flex gap-2 mt-3">
                            <ActionButton onClick={onAcceptScheduledDuel} variant="accept">
                                Accept
                            </ActionButton>
                            <ActionButton onClick={onCounterProposeScheduledDuel} variant="secondary">
                                Counter
                            </ActionButton>
                            <ActionButton onClick={onDeclineScheduledDuel} variant="reject">
                                Decline
                            </ActionButton>
                        </div>
                    ),
                };

            case NOTIFICATION_TYPES.DUEL_CHALLENGE:
                return {
                    icon: <SwordIcon />,
                    message: `${userName} challenges you to a ${payload?.mode || 'classic'} duel: ${payload?.themeName || 'Theme'}`,
                    actions: (
                        <div className="flex gap-2 mt-3">
                            <ActionButton onClick={onAcceptDuelChallenge} variant="accept">
                                Accept
                            </ActionButton>
                            <ActionButton onClick={onDeclineDuelChallenge} variant="reject">
                                Decline
                            </ActionButton>
                        </div>
                    ),
                };

            default:
                return {
                    icon: <BellIcon />,
                    message: 'You have a notification',
                    actions: (
                        <div className="flex gap-2 mt-3">
                            <ActionButton onClick={onDismiss} variant="dismiss">
                                Dismiss
                            </ActionButton>
                        </div>
                    ),
                };
        }
    };

    const content = getNotificationContent();

    return (
        <div
            className="px-4 py-3 border-b last:border-b-0 animate-fade-in"
            style={{ borderColor: `${colors.neutral.light}20` }}
        >
            <div className="flex gap-3">
                {/* Icon */}
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${colors.primary.DEFAULT}15` }}
                >
                    {content.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p
                        className="text-sm leading-relaxed"
                        style={{ color: colors.text.DEFAULT }}
                    >
                        {content.message}
                    </p>

                    <p
                        className="text-xs mt-1"
                        style={{ color: colors.text.muted }}
                    >
                        {getRelativeTime(createdAt)}
                    </p>

                    {content.actions}
                </div>
            </div>
        </div>
    );
}

interface ActionButtonProps {
    onClick: () => void;
    variant: 'accept' | 'reject' | 'dismiss' | 'secondary';
    children: React.ReactNode;
}

function ActionButton({ onClick, variant, children }: ActionButtonProps) {
    const getStyles = () => {
        switch (variant) {
            case 'accept':
                return {
                    backgroundColor: colors.cta.DEFAULT,
                    color: 'white',
                };
            case 'reject':
                return {
                    backgroundColor: colors.status.danger.light,
                    color: colors.status.danger.dark,
                };
            case 'dismiss':
                return {
                    backgroundColor: colors.background.DEFAULT,
                    color: colors.text.muted,
                };
            case 'secondary':
                return {
                    backgroundColor: colors.primary.light,
                    color: colors.primary.dark,
                };
        }
    };

    return (
        <button
            onClick={onClick}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-transform active:scale-95"
            style={getStyles()}
        >
            {children}
        </button>
    );
}

// Icons
function UserPlusIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.primary.DEFAULT} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
    );
}

function CalendarIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.cta.DEFAULT} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.status.warning.DEFAULT} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

function SwordIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.status.danger.DEFAULT} strokeWidth={2}>
            <g transform="rotate(45 12 12)">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 16a3 3 0 0 0 6 0" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v2" />
            </g>
        </svg>
    );
}

function BellIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.neutral.DEFAULT} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
    );
}

export default NotificationItem;
