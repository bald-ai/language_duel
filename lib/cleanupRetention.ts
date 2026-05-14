export const DISMISSABLE_NOTIFICATION_TYPES = [
  "friend_request",
  "weekly_goal_invitation",
  "weekly_goal_draft_expiring",
  "challenge_invite",
] as const;

const RESOLVED_FRIEND_REQUEST_STATUSES = ["accepted", "rejected"] as const;

export function isTimestampPastRetention(
  timestamp: number,
  now: number,
  ttlMs: number
): boolean {
  return timestamp <= now - ttlMs;
}

export function isDismissedNotificationPastRetention(
  notification: { status: string; createdAt: number },
  now: number,
  ttlMs: number
): boolean {
  return (
    notification.status === "dismissed" &&
    isTimestampPastRetention(notification.createdAt, now, ttlMs)
  );
}

export function isResolvedFriendRequestPastRetention(
  request: { status: string; createdAt: number },
  now: number,
  ttlMs: number
): boolean {
  return (
    RESOLVED_FRIEND_REQUEST_STATUSES.includes(
      request.status as (typeof RESOLVED_FRIEND_REQUEST_STATUSES)[number]
    ) &&
    isTimestampPastRetention(request.createdAt, now, ttlMs)
  );
}

export function isEmailLogPastRetention(
  log: { sentAt: number },
  now: number,
  ttlMs: number
): boolean {
  return isTimestampPastRetention(log.sentAt, now, ttlMs);
}
