"use client";

import type { ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatVisibleUser } from "@/lib/userDisplay";
import { DUEL_MODE_LABELS, type DuelMode } from "@/lib/duelMode";
import {
  isChallengeInvitePayload,
  isWeeklyGoalPayload,
} from "@/convex/notificationPayloads";
import {
  ActionButton,
  NotificationActions,
  NotificationCardShell,
} from "./NotificationCardShell";
import { BellIcon, CalendarIcon, SwordIcon, UserPlusIcon } from "./notificationIcons";
import { themeCountLabel, type NotificationCardProps } from "./notificationCardModel";

export function FriendRequestCard({ notification, actions }: NotificationCardProps) {
  const userName = formatVisibleUser(notification.fromUser);
  const id = notification._id;
  return (
    <NotificationCardShell
      notificationId={id}
      icon={<UserPlusIcon />}
      createdAt={notification.createdAt}
      message={`${userName} wants to add you as a friend`}
      actions={
        <NotificationActions>
          <ActionButton onClick={() => actions.acceptFriendRequest(id)} variant="accept" dataTestId={`notification-${id}-accept-friend`}>
            Accept
          </ActionButton>
          <ActionButton onClick={() => actions.rejectFriendRequest(id)} variant="reject" dataTestId={`notification-${id}-reject-friend`}>
            Reject
          </ActionButton>
        </NotificationActions>
      }
    />
  );
}

export function ChallengeInviteCard({ notification, actions }: NotificationCardProps) {
  const userName = formatVisibleUser(notification.fromUser);
  const id = notification._id;
  const payload = isChallengeInvitePayload(notification.payload) ? notification.payload : undefined;
  const themeName = payload?.themeName || "Theme";
  return (
    <NotificationCardShell
      notificationId={id}
      icon={<SwordIcon />}
      createdAt={notification.createdAt}
      message={
        <>
          {userName} challenged you: <span className="font-semibold">{themeName}</span>
          <ChallengeInviteChips difficulty={payload?.duelDifficultyPreset} duelMode={payload?.duelMode} />
        </>
      }
      actions={
        <NotificationActions>
          <ActionButton onClick={() => actions.acceptChallenge(id)} variant="accept" dataTestId={`notification-${id}-accept-challenge`}>
            Accept
          </ActionButton>
          <ActionButton onClick={() => actions.declineChallenge(id)} variant="reject" dataTestId={`notification-${id}-decline-challenge`}>
            Decline
          </ActionButton>
        </NotificationActions>
      }
    />
  );
}

function weeklyGoalContent(
  notification: NotificationCardProps["notification"],
  actions: NotificationCardProps["actions"]
): { message: ReactNode; actions: ReactNode } {
  const userName = formatVisibleUser(notification.fromUser);
  const id = notification._id;
  const payload = isWeeklyGoalPayload(notification.payload) ? notification.payload : undefined;
  const event = payload?.event;
  const archiveLabel = `Archive ${themeCountLabel(payload?.themeCount ?? 0)}`;

  const viewButton = (
    <ActionButton onClick={() => actions.viewWeeklyGoal()} variant="accept" dataTestId={`notification-${id}-view-weekly-goal`}>
      View
    </ActionButton>
  );
  const dismissButton = (label: string) => (
    <ActionButton onClick={() => actions.dismissWeeklyGoal(id)} variant="dismiss" dataTestId={`notification-${id}-dismiss-weekly-goal`}>
      {label}
    </ActionButton>
  );
  const archiveButton = (
    <ActionButton onClick={() => actions.archiveCompletedGoalThemes(id)} variant="secondary" dataTestId={`notification-${id}-archive-completed-goal-themes`}>
      {archiveLabel}
    </ActionButton>
  );

  if (event === "partner_locked") {
    return {
      message: `${userName} locked their weekly goal. Your turn.`,
      actions: <NotificationActions>{viewButton}{dismissButton("Dismiss")}</NotificationActions>,
    };
  }
  if (event === "goal_unlocked") {
    return {
      message: `${userName} changed the weekly goal, so your lock was removed. Review it and lock again.`,
      actions: <NotificationActions>{viewButton}{dismissButton("Dismiss")}</NotificationActions>,
    };
  }
  if (event === "goal_activated") {
    return {
      message: `${userName} locked the weekly goal. It is now ready to play.`,
      actions: <NotificationActions>{viewButton}{dismissButton("Dismiss")}</NotificationActions>,
    };
  }
  if (event === "goal_completed") {
    return {
      message: `You and ${userName} defeated the weekly goal. Nice work. Want to clean up your theme list?`,
      actions: (
        <NotificationActions>
          <ActionButton onClick={() => actions.dismissWeeklyGoal(id)} variant="accept" dataTestId={`notification-${id}-dismiss-weekly-goal`}>
            Nice
          </ActionButton>
          {archiveButton}
        </NotificationActions>
      ),
    };
  }
  if (event === "goal_completed_solo") {
    return {
      message: "You defeated your weekly goal.",
      actions: (
        <NotificationActions>
          {viewButton}
          {archiveButton}
          {dismissButton("Dismiss")}
        </NotificationActions>
      ),
    };
  }
  if (event === "declined") {
    return {
      message: `${userName} declined your weekly goal invitation`,
      actions: <NotificationActions>{dismissButton("OK")}</NotificationActions>,
    };
  }
  return {
    message: `${userName} invited you to a weekly goal`,
    actions: (
      <NotificationActions>
        {viewButton}
        <ActionButton onClick={() => actions.declineWeeklyGoal(id)} variant="reject" dataTestId={`notification-${id}-decline-weekly-goal`}>
          Decline
        </ActionButton>
      </NotificationActions>
    ),
  };
}

export function WeeklyGoalCard({ notification, actions }: NotificationCardProps) {
  const content = weeklyGoalContent(notification, actions);
  return (
    <NotificationCardShell
      notificationId={notification._id}
      icon={<CalendarIcon />}
      createdAt={notification.createdAt}
      message={content.message}
      actions={content.actions}
    />
  );
}

export function DraftExpiringCard({ notification, actions }: NotificationCardProps) {
  const id = notification._id;
  return (
    <NotificationCardShell
      notificationId={id}
      icon={<CalendarIcon />}
      createdAt={notification.createdAt}
      message="Your weekly goal draft expires in 24 hours. Lock it or it will be removed."
      actions={
        <NotificationActions>
          <ActionButton onClick={() => actions.viewWeeklyGoal()} variant="accept" dataTestId={`notification-${id}-view-weekly-goal`}>
            View
          </ActionButton>
          <ActionButton onClick={() => actions.dismiss(id)} variant="dismiss" dataTestId={`notification-${id}-dismiss`}>
            Dismiss
          </ActionButton>
        </NotificationActions>
      }
    />
  );
}

export function GenericNotificationCard({ notification, actions }: NotificationCardProps) {
  const id = notification._id;
  return (
    <NotificationCardShell
      notificationId={id}
      icon={<BellIcon />}
      createdAt={notification.createdAt}
      message="You have a notification"
      actions={
        <NotificationActions>
          <ActionButton onClick={() => actions.dismiss(id)} variant="dismiss" dataTestId={`notification-${id}-dismiss`}>
            Dismiss
          </ActionButton>
        </NotificationActions>
      }
    />
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
