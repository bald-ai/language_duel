import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPreferences,
} from "./notificationPreferencesDefaults";

const _NOTIFICATION_TRIGGERS = [
  "immediate_duel_challenge",
  "scheduled_duel_proposal",
  "scheduled_duel_reminder",
  "weekly_goal_invite",
  "weekly_goal_locked",
  "weekly_goal_accepted",
  "weekly_goal_daily_reminder",
  "weekly_goal_draft_expiring",
  "weekly_goal_expired_delete_reminder",
  "weekly_goal_reminder_1",
  "weekly_goal_reminder_2",
] as const;

export type NotificationTrigger = (typeof _NOTIFICATION_TRIGGERS)[number];

export function isNotificationEnabled(
  trigger: NotificationTrigger,
  prefs: NotificationPreferences
): boolean {
  const mapping: Record<
    NotificationTrigger,
    {
      category: keyof NotificationPreferences;
      trigger: keyof NotificationPreferences;
    }
  > = {
    immediate_duel_challenge: {
      category: "immediateDuelsEnabled",
      trigger: "immediateDuelChallengeEnabled",
    },
    scheduled_duel_proposal: {
      category: "scheduledDuelsEnabled",
      trigger: "scheduledDuelProposalEnabled",
    },
    scheduled_duel_reminder: {
      category: "scheduledDuelsEnabled",
      trigger: "scheduledDuelReminderEnabled",
    },
    weekly_goal_invite: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalInviteEnabled",
    },
    weekly_goal_locked: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalLockedEnabled",
    },
    weekly_goal_accepted: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalAcceptedEnabled",
    },
    weekly_goal_daily_reminder: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalDailyReminderEnabled",
    },
    weekly_goal_draft_expiring: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalDraftExpiringEnabled",
    },
    weekly_goal_expired_delete_reminder: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalDailyReminderEnabled",
    },
    weekly_goal_reminder_1: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalReminder1Enabled",
    },
    weekly_goal_reminder_2: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalReminder2Enabled",
    },
  };

  const config = mapping[trigger];
  if (!config) return false;

  return prefs[config.category] === true && prefs[config.trigger] === true;
}

export function shouldSendScheduledDuelReminder(
  duel: { scheduledTime: number; status: string; startedDuelId?: string },
  now: number,
  reminderOffsetMinutes: number,
  windowMs = 5 * 60 * 1000
): boolean {
  if (duel.status !== "accepted") return false;
  if (duel.startedDuelId) return false;
  if (duel.scheduledTime <= now) return false;

  const offsetMs = reminderOffsetMinutes * 60 * 1000;
  const reminderTime = duel.scheduledTime - offsetMs;
  return reminderTime <= now && reminderTime >= now - windowMs;
}

export function shouldSendWeeklyGoalReminder(
  goal: { endDate?: number; status: string; bossStatus?: string },
  now: number,
  reminderOffsetMinutes: number,
  windowMs = 60 * 60 * 1000
): boolean {
  if (goal.status !== "locked") return false;
  if (goal.bossStatus === "defeated") return false;
  if (!goal.endDate) return false;
  if (goal.endDate <= now) return false;

  const offsetMs = reminderOffsetMinutes * 60 * 1000;
  const reminderTime = goal.endDate - offsetMs;
  return reminderTime <= now && reminderTime >= now - windowMs;
}

export function formatScheduledTimeForEmail(timestamp: number, timezone: string): string {
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if ("formatToParts" in formatter) {
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) =>
      parts.find((part) => part.type === type)?.value;
    const month = getPart("month");
    const day = getPart("day");
    const year = getPart("year");
    const hour = getPart("hour");
    const minute = getPart("minute");

    if (month && day && year && hour && minute) {
      return `${month} ${day}, ${year} at ${hour}:${minute}`;
    }
  }

  return formatter.format(date);
}

type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function getTimeZoneDateParts(
  timestamp: number,
  timezone: string
): TimeZoneDateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(timestamp));
  const getNumber = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      throw new Error(`Missing ${type} while formatting date parts`);
    }
    return Number(value);
  };

  return {
    year: getNumber("year"),
    month: getNumber("month"),
    day: getNumber("day"),
    hour: getNumber("hour"),
    minute: getNumber("minute"),
  };
}

export function getTimeZoneDateKey(timestamp: number, timezone: string): string {
  const { year, month, day } = getTimeZoneDateParts(timestamp, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getDaysUntilInTimeZone(
  targetTimestamp: number,
  nowTimestamp: number,
  timezone: string
): number {
  const target = getTimeZoneDateParts(targetTimestamp, timezone);
  const now = getTimeZoneDateParts(nowTimestamp, timezone);
  const targetDay = Date.UTC(target.year, target.month - 1, target.day);
  const nowDay = Date.UTC(now.year, now.month - 1, now.day);
  return Math.max(0, Math.round((targetDay - nowDay) / (24 * 60 * 60 * 1000)));
}

export { DEFAULT_NOTIFICATION_PREFS, type NotificationPreferences };
