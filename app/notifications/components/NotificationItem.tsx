"use client";

import { NOTIFICATION_TYPES } from "../constants";
import {
  ChallengeInviteCard,
  DraftExpiringCard,
  FriendRequestCard,
  GenericNotificationCard,
  WeeklyGoalCard,
} from "./NotificationCards";
import type { NotificationCardProps } from "./notificationCardModel";

/**
 * Dispatches a notification to its per-type card. The discriminated payload
 * union is enforced inside each card; this is just the type → card lookup.
 */
export function NotificationItem({ notification, actions }: NotificationCardProps) {
  switch (notification.type) {
    case NOTIFICATION_TYPES.FRIEND_REQUEST:
      return <FriendRequestCard notification={notification} actions={actions} />;
    case NOTIFICATION_TYPES.WEEKLY_GOAL_INVITATION:
      return <WeeklyGoalCard notification={notification} actions={actions} />;
    case NOTIFICATION_TYPES.WEEKLY_GOAL_DRAFT_EXPIRING:
      return <DraftExpiringCard notification={notification} actions={actions} />;
    case NOTIFICATION_TYPES.CHALLENGE_INVITE:
      return <ChallengeInviteCard notification={notification} actions={actions} />;
    default:
      return <GenericNotificationCard notification={notification} actions={actions} />;
  }
}
