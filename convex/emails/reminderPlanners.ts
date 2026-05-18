import type { Id } from "../_generated/dataModel";
import {
  isNotificationEnabled,
  shouldSendWeeklyGoalReminder,
  type NotificationPreferences,
} from "../../lib/notificationPreferences";

type WeeklyGoalReminderGoal = {
  _id: Id<"weeklyGoals">;
  creatorId: Id<"users">;
  partnerId: Id<"users">;
  status: string;
  bigBossStatus?: string;
  endDate?: number;
};

type ReminderEmailSend = {
  trigger: "weekly_goal_reminder_1" | "weekly_goal_reminder_2";
  toUserId: Id<"users">;
  weeklyGoalId: Id<"weeklyGoals">;
  reminderOffsetMinutes: number;
};

type DailyEmailSend = {
  trigger: "weekly_goal_daily_reminder";
  toUserId: Id<"users">;
  weeklyGoalId: Id<"weeklyGoals">;
  dedupeKey: string;
};

type GracePeriodEmailSend = {
  trigger: "weekly_goal_grace_period_reminder";
  toUserId: Id<"users">;
  weeklyGoalId: Id<"weeklyGoals">;
  dedupeKey: string;
};

export function planFixedReminderEmails(args: {
  goal: WeeklyGoalReminderGoal;
  toUserId: Id<"users">;
  now: number;
  prefs: NotificationPreferences;
}): ReminderEmailSend[] {
  const sends: ReminderEmailSend[] = [];

  if (
    isNotificationEnabled("weekly_goal_reminder_1", args.prefs) &&
    shouldSendWeeklyGoalReminder(
      args.goal,
      args.now,
      args.prefs.weeklyGoalReminder1OffsetMinutes
    )
  ) {
    sends.push({
      trigger: "weekly_goal_reminder_1",
      toUserId: args.toUserId,
      weeklyGoalId: args.goal._id,
      reminderOffsetMinutes: args.prefs.weeklyGoalReminder1OffsetMinutes,
    });
  }

  if (
    isNotificationEnabled("weekly_goal_reminder_2", args.prefs) &&
    shouldSendWeeklyGoalReminder(
      args.goal,
      args.now,
      args.prefs.weeklyGoalReminder2OffsetMinutes
    )
  ) {
    sends.push({
      trigger: "weekly_goal_reminder_2",
      toUserId: args.toUserId,
      weeklyGoalId: args.goal._id,
      reminderOffsetMinutes: args.prefs.weeklyGoalReminder2OffsetMinutes,
    });
  }

  return sends;
}

export function planDailyReminderEmail(args: {
  goal: WeeklyGoalReminderGoal;
  toUserId: Id<"users">;
  dedupeKey: string;
  prefs: NotificationPreferences;
}): DailyEmailSend | null {
  if (!isNotificationEnabled("weekly_goal_daily_reminder", args.prefs)) {
    return null;
  }

  return {
    trigger: "weekly_goal_daily_reminder",
    toUserId: args.toUserId,
    weeklyGoalId: args.goal._id,
    dedupeKey: args.dedupeKey,
  };
}

export function planGracePeriodReminderEmail(args: {
  goal: WeeklyGoalReminderGoal;
  toUserId: Id<"users">;
  dedupeKey: string;
  prefs: NotificationPreferences;
}): GracePeriodEmailSend | null {
  if (!isNotificationEnabled("weekly_goal_grace_period_reminder", args.prefs)) {
    return null;
  }

  return {
    trigger: "weekly_goal_grace_period_reminder",
    toUserId: args.toUserId,
    weeklyGoalId: args.goal._id,
    dedupeKey: args.dedupeKey,
  };
}

export function planDraftExpiryDecision(args: {
  alreadySent: boolean;
  prefs: NotificationPreferences;
}): {
  shouldCreateInAppNotification: boolean;
  shouldSendEmail: boolean;
} {
  if (args.alreadySent) {
    return {
      shouldCreateInAppNotification: false,
      shouldSendEmail: false,
    };
  }

  return {
    shouldCreateInAppNotification: true,
    shouldSendEmail: isNotificationEnabled("weekly_goal_draft_expiring", args.prefs),
  };
}
