"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { getRelativeTime } from "@/lib/timeUtils";
import { formatVisibleUser } from "@/lib/userDisplay";
import { NOTIFICATION_TYPES } from "../constants";
import type { Id } from "@/convex/_generated/dataModel";
import { DUEL_MODE_LABELS, type DuelMode } from "@/lib/duelMode";

interface NotificationData {
    _id: Id<"notifications">;
    type: string;
    fromUser: {
        name?: string;
        nickname?: string;
        discriminator?: number;
        imageUrl?: string;
    } | null;
    payload?: {
        challengeId?: Id<"challenges">;
        goalId?: Id<"weeklyGoals">;
        friendRequestId?: Id<"friendRequests">;
        themeName?: string;
        duelDifficultyPreset?: "easy" | "medium" | "hard";
        duelMode?: DuelMode;
        themeCount?: number;
        event?:
            | "invite"
            | "declined"
            | "partner_locked"
            | "goal_unlocked"
            | "goal_activated"
            | "goal_completed"
            | "goal_completed_solo"
            | "draft_expiring";
    };
    createdAt: number;
    status: string;
}

interface NotificationItemProps {
    notification: NotificationData;
    onAcceptFriendRequest: () => void;
    onRejectFriendRequest: () => void;
    onAcceptChallenge: () => void;
    onDeclineChallenge: () => void;
    onViewWeeklyGoal: () => void;
    onDeclineWeeklyGoal: () => void;
    onDismissWeeklyGoal: () => void;
    onArchiveCompletedGoalThemes: () => void;
    onDismiss: () => void;
}

/**
 * NotificationItem - Individual notification card
 * 
 * Features:
 * - Icon based on notification type
 * - User avatar/name
 * - Relative timestamp
 * - Action buttons per notification type
 */
export function NotificationItem({
    notification,
    onAcceptFriendRequest,
    onRejectFriendRequest,
    onAcceptChallenge,
    onDeclineChallenge,
    onViewWeeklyGoal,
    onDeclineWeeklyGoal,
    onDismissWeeklyGoal,
    onArchiveCompletedGoalThemes,
    onDismiss,
}: NotificationItemProps) {
  const colors = useAppearanceColors();
    const { type, fromUser, payload, createdAt } = notification;

    const getNotificationContent = () => {
        const userName = formatVisibleUser(fromUser);
        const themeName = payload?.themeName || "Theme";

        switch (type) {
            case NOTIFICATION_TYPES.FRIEND_REQUEST:
                return {
                    icon: <UserPlusIcon />,
                    message: `${userName} wants to add you as a friend`,
                    actions: (
                        <div className="flex gap-2 mt-3">
                            <ActionButton
                                onClick={onAcceptFriendRequest}
                                variant="accept"
                                dataTestId={`notification-${notification._id}-accept-friend`}
                            >
                                Accept
                            </ActionButton>
                            <ActionButton
                                onClick={onRejectFriendRequest}
                                variant="reject"
                                dataTestId={`notification-${notification._id}-reject-friend`}
                            >
                                Reject
                            </ActionButton>
                        </div>
                    ),
                };

            case NOTIFICATION_TYPES.WEEKLY_GOAL_INVITATION:
                if (payload?.event === "partner_locked") {
                    return {
                        icon: <CalendarIcon />,
                        message: `${userName} locked their weekly goal. Your turn.`,
                        actions: (
                            <div className="flex gap-2 mt-3">
                                <ActionButton
                                    onClick={onViewWeeklyGoal}
                                    variant="accept"
                                    dataTestId={`notification-${notification._id}-view-weekly-goal`}
                                >
                                    View
                                </ActionButton>
                                <ActionButton
                                    onClick={onDismissWeeklyGoal}
                                    variant="dismiss"
                                    dataTestId={`notification-${notification._id}-dismiss-weekly-goal`}
                                >
                                    Dismiss
                                </ActionButton>
                            </div>
                        ),
                    };
                }
                if (payload?.event === "goal_unlocked") {
                    return {
                        icon: <CalendarIcon />,
                        message: `${userName} changed the weekly goal, so your lock was removed. Review it and lock again.`,
                        actions: (
                            <div className="flex gap-2 mt-3">
                                <ActionButton
                                    onClick={onViewWeeklyGoal}
                                    variant="accept"
                                    dataTestId={`notification-${notification._id}-view-weekly-goal`}
                                >
                                    View
                                </ActionButton>
                                <ActionButton
                                    onClick={onDismissWeeklyGoal}
                                    variant="dismiss"
                                    dataTestId={`notification-${notification._id}-dismiss-weekly-goal`}
                                >
                                    Dismiss
                                </ActionButton>
                            </div>
                        ),
                    };
                }
	                if (payload?.event === "goal_activated") {
	                    return {
	                        icon: <CalendarIcon />,
	                        message: `${userName} locked the weekly goal. It is now ready to play.`,
                        actions: (
                            <div className="flex gap-2 mt-3">
                                <ActionButton
                                    onClick={onViewWeeklyGoal}
                                    variant="accept"
                                    dataTestId={`notification-${notification._id}-view-weekly-goal`}
                                >
                                    View
                                </ActionButton>
                                <ActionButton
                                    onClick={onDismissWeeklyGoal}
                                    variant="dismiss"
                                    dataTestId={`notification-${notification._id}-dismiss-weekly-goal`}
                                >
                                    Dismiss
                                </ActionButton>
                            </div>
                        ),
                    };
                }
                if (payload?.event === "goal_completed") {
                    const archiveThemeLabel =
                        payload.themeCount === 1
                            ? "Archive 1 theme"
                            : `Archive ${payload.themeCount || 0} themes`;

                    return {
                        icon: <CalendarIcon />,
                        message: `You and ${userName} defeated the weekly goal. Nice work. Want to clean up your theme list?`,
                        actions: (
                            <div className="flex gap-2 mt-3">
                                <ActionButton
                                    onClick={onDismissWeeklyGoal}
                                    variant="accept"
                                    dataTestId={`notification-${notification._id}-dismiss-weekly-goal`}
                                >
                                    Nice
                                </ActionButton>
                                <ActionButton
                                    onClick={onArchiveCompletedGoalThemes}
                                    variant="secondary"
                                    dataTestId={`notification-${notification._id}-archive-completed-goal-themes`}
                                >
                                    {archiveThemeLabel}
                                </ActionButton>
                            </div>
                        ),
                    };
                }
                if (payload?.event === "goal_completed_solo") {
                    const archiveThemeLabel =
                        payload.themeCount === 1
                            ? "Archive 1 theme"
                            : `Archive ${payload.themeCount || 0} themes`;

                    return {
                        icon: <CalendarIcon />,
                        message: "You defeated your weekly goal.",
                        actions: (
                            <div className="flex gap-2 mt-3">
                                <ActionButton
                                    onClick={onViewWeeklyGoal}
                                    variant="accept"
                                    dataTestId={`notification-${notification._id}-view-weekly-goal`}
                                >
                                    View
                                </ActionButton>
                                <ActionButton
                                    onClick={onArchiveCompletedGoalThemes}
                                    variant="secondary"
                                    dataTestId={`notification-${notification._id}-archive-completed-goal-themes`}
                                >
                                    {archiveThemeLabel}
                                </ActionButton>
                                <ActionButton
                                    onClick={onDismissWeeklyGoal}
                                    variant="dismiss"
                                    dataTestId={`notification-${notification._id}-dismiss-weekly-goal`}
                                >
                                    Dismiss
                                </ActionButton>
                            </div>
                        ),
                    };
                }
                if (payload?.event === "declined") {
                    return {
                        icon: <CalendarIcon />,
                        message: `${userName} declined your weekly goal invitation`,
                        actions: (
                            <div className="flex gap-2 mt-3">
                                <ActionButton
                                    onClick={onDismissWeeklyGoal}
                                    variant="dismiss"
                                    dataTestId={`notification-${notification._id}-dismiss-weekly-goal`}
                                >
                                    OK
                                </ActionButton>
                            </div>
                        ),
                    };
                }
                return {
                    icon: <CalendarIcon />,
                    message: `${userName} invited you to a weekly goal`,
                    actions: (
                        <div className="flex gap-2 mt-3">
                            <ActionButton
                                onClick={onViewWeeklyGoal}
                                variant="accept"
                                dataTestId={`notification-${notification._id}-view-weekly-goal`}
                            >
                                View
                            </ActionButton>
                            <ActionButton
                                onClick={onDeclineWeeklyGoal}
                                variant="reject"
                                dataTestId={`notification-${notification._id}-decline-weekly-goal`}
                            >
                                Decline
                            </ActionButton>
                        </div>
                    ),
                };

            case NOTIFICATION_TYPES.WEEKLY_GOAL_DRAFT_EXPIRING:
                return {
                    icon: <CalendarIcon />,
                    message: "Your weekly goal draft expires in 24 hours. Lock it or it will be removed.",
                    actions: (
                        <div className="flex gap-2 mt-3">
                            <ActionButton
                                onClick={onViewWeeklyGoal}
                                variant="accept"
                                dataTestId={`notification-${notification._id}-view-weekly-goal`}
                            >
                                View
                            </ActionButton>
                            <ActionButton
                                onClick={onDismiss}
                                variant="dismiss"
                                dataTestId={`notification-${notification._id}-dismiss`}
                            >
                                Dismiss
                            </ActionButton>
                        </div>
                    ),
                };

            case NOTIFICATION_TYPES.CHALLENGE_INVITE:
                return {
                    icon: <SwordIcon />,
                    message: (
                        <>
                            {userName} challenged you: <span className="font-semibold">{themeName}</span>
                            <ChallengeInviteChips
                                difficulty={payload?.duelDifficultyPreset}
                                duelMode={payload?.duelMode}
                            />
                        </>
                    ),
                    actions: (
                        <div className="flex gap-2 mt-3">
                            <ActionButton
                                onClick={onAcceptChallenge}
                                variant="accept"
                                dataTestId={`notification-${notification._id}-accept-challenge`}
                            >
                                Accept
                            </ActionButton>
                            <ActionButton
                                onClick={onDeclineChallenge}
                                variant="reject"
                                dataTestId={`notification-${notification._id}-decline-challenge`}
                            >
                                Decline
                            </ActionButton>
                        </div>
                    ),
                };

            default:
                return {
                    icon: <BellIcon />,
                    message: "You have a notification",
                    actions: (
                        <div className="flex gap-2 mt-3">
                            <ActionButton
                                onClick={onDismiss}
                                variant="dismiss"
                                dataTestId={`notification-${notification._id}-dismiss`}
                            >
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
            data-testid={`notification-item-${notification._id}`}
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
                    <div
                        className="text-sm leading-relaxed"
                        style={{ color: colors.text.DEFAULT }}
                    >
                        {content.message}
                    </div>

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
    variant: "accept" | "reject" | "dismiss" | "secondary";
    children: React.ReactNode;
    dataTestId?: string;
}

function ActionButton({ onClick, variant, children, dataTestId }: ActionButtonProps) {
  const colors = useAppearanceColors();
    const getStyles = () => {
        switch (variant) {
            case "accept":
                return {
                    backgroundColor: colors.cta.DEFAULT,
                    color: "white",
                };
            case "reject":
                return {
                    backgroundColor: colors.status.danger.light,
                    color: colors.status.danger.dark,
                };
            case "dismiss":
                return {
                    backgroundColor: colors.background.DEFAULT,
                    color: colors.text.muted,
                };
            case "secondary":
                return {
                    backgroundColor: colors.primary.light,
                    color: colors.primary.dark,
                };
        }
    };

    return (
        <button
            onClick={onClick}
            data-testid={dataTestId}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-transform active:scale-95"
            style={getStyles()}
        >
            {children}
        </button>
    );
}

function ChallengeInviteChips({
    difficulty,
    duelMode,
}: {
    difficulty?: "easy" | "medium" | "hard";
    duelMode?: DuelMode;
}) {
  const colors = useAppearanceColors();
  if (!difficulty && !duelMode) return null;

  return (
    <span className="mt-2 flex flex-wrap gap-1.5">
      {difficulty && (
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: `${colors.secondary.DEFAULT}22`,
            color: colors.secondary.dark,
          }}
        >
          {difficulty}
        </span>
      )}
      {duelMode && (
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: `${colors.cta.DEFAULT}22`,
            color: colors.cta.dark,
          }}
          data-testid="notification-challenge-mode"
        >
          {DUEL_MODE_LABELS[duelMode]}
        </span>
      )}
    </span>
  );
}

// Icons
function UserPlusIcon() {
  const colors = useAppearanceColors();
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.primary.DEFAULT} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
    );
}

function CalendarIcon() {
  const colors = useAppearanceColors();
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.cta.DEFAULT} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    );
}

function SwordIcon() {
  const colors = useAppearanceColors();
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
  const colors = useAppearanceColors();
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.neutral.DEFAULT} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
    );
}
