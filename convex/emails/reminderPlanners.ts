import type { Id } from "../_generated/dataModel";
import {
  shouldSendWeeklyGoalReminder,
  type NotificationPreferences,
} from "../../lib/notificationPreferences";

type WeeklyGoalReminderGoal = {
  _id: Id<"weeklyGoals">;
  mode?: "solo" | "shared";
  creatorId: Id<"users">;
  partnerId?: Id<"users">;
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
}): DailyEmailSend {
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
}): GracePeriodEmailSend {
  return {
    trigger: "weekly_goal_grace_period_reminder",
    toUserId: args.toUserId,
    weeklyGoalId: args.goal._id,
    dedupeKey: args.dedupeKey,
  };
}

export function planDraftExpiryDecision(args: {
  alreadySent: boolean;
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
    shouldSendEmail: true,
  };
}
