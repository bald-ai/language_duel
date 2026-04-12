export const DISMISSABLE_NOTIFICATION_TYPES = [
  "friend_request",
  "weekly_plan_invitation",
  "scheduled_duel",
  "duel_challenge",
] as const;

const RESOLVED_FRIEND_REQUEST_STATUSES = ["accepted", "rejected"] as const;
const TERMINAL_SCHEDULED_DUEL_STATUSES = ["declined", "cancelled", "expired"] as const;

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

export function isScheduledDuelPastRetention(
  duel: { updatedAt: number },
  now: number,
  ttlMs: number
): boolean {
  return isTimestampPastRetention(duel.updatedAt, now, ttlMs);
}

export function isTerminalScheduledDuelStatus(status: string): boolean {
  return TERMINAL_SCHEDULED_DUEL_STATUSES.includes(
    status as (typeof TERMINAL_SCHEDULED_DUEL_STATUSES)[number]
  );
}

export function isTerminalScheduledDuelPastRetention(
  duel: { status: string; updatedAt: number },
  now: number,
  ttlMs: number
): boolean {
  return (
    isTerminalScheduledDuelStatus(duel.status) &&
    isScheduledDuelPastRetention(duel, now, ttlMs)
  );
}

export function isStartedScheduledDuelPastRetention(
  duel: { status: string; startedDuelId?: string; updatedAt: number },
  now: number,
  ttlMs: number
): boolean {
  return (
    duel.status === "accepted" &&
    typeof duel.startedDuelId === "string" &&
    isScheduledDuelPastRetention(duel, now, ttlMs)
  );
}
