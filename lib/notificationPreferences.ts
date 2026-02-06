import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPreferences,
} from "./notificationPreferencesDefaults";

export const NOTIFICATION_TRIGGERS = [
  "immediate_duel_challenge",
  "scheduled_duel_proposal",
  "scheduled_duel_accepted",
  "scheduled_duel_counter_proposed",
  "scheduled_duel_declined",
  "scheduled_duel_canceled",
  "scheduled_duel_reminder",
  "weekly_goal_invite",
  "weekly_goal_accepted",
  "weekly_goal_declined",
  "weekly_goal_reminder_1",
  "weekly_goal_reminder_2",
] as const;

export type NotificationTrigger = (typeof NOTIFICATION_TRIGGERS)[number];

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
    scheduled_duel_accepted: {
      category: "scheduledDuelsEnabled",
      trigger: "scheduledDuelAcceptedEnabled",
    },
    scheduled_duel_counter_proposed: {
      category: "scheduledDuelsEnabled",
      trigger: "scheduledDuelCounterProposedEnabled",
    },
    scheduled_duel_declined: {
      category: "scheduledDuelsEnabled",
      trigger: "scheduledDuelDeclinedEnabled",
    },
    scheduled_duel_canceled: {
      category: "scheduledDuelsEnabled",
      trigger: "scheduledDuelCanceledEnabled",
    },
    scheduled_duel_reminder: {
      category: "scheduledDuelsEnabled",
      trigger: "scheduledDuelReminderEnabled",
    },
    weekly_goal_invite: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalInviteEnabled",
    },
    weekly_goal_accepted: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalAcceptedEnabled",
    },
    weekly_goal_declined: {
      category: "weeklyGoalsEnabled",
      trigger: "weeklyGoalDeclinedEnabled",
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
  goal: { expiresAt?: number; status: string },
  now: number,
  reminderOffsetMinutes: number,
  windowMs = 60 * 60 * 1000
): boolean {
  if (goal.status !== "active") return false;
  if (!goal.expiresAt) return false;
  if (goal.expiresAt <= now) return false;

  const offsetMs = reminderOffsetMinutes * 60 * 1000;
  const reminderTime = goal.expiresAt - offsetMs;
  return reminderTime <= now && reminderTime >= now - windowMs;
}

export function formatScheduledTime(timestamp: number, timezone: string): string {
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

export { DEFAULT_NOTIFICATION_PREFS, type NotificationPreferences };