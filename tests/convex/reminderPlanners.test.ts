import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  planDailyReminderEmail,
  planDraftExpiryDecision,
  planFixedReminderEmails,
  planGracePeriodReminderEmail,
} from "@/convex/emails/reminderPlanners";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPreferences";

function buildGoal(overrides: Partial<{ endDate?: number; status: string; bigBossStatus?: string }> = {}) {
  return {
    _id: "goal_1" as Id<"weeklyGoals">,
    creatorId: "user_1" as Id<"users">,
    partnerId: "user_2" as Id<"users">,
    endDate: Date.now() + 24 * 60 * 60 * 1000,
    status: "locked",
    bigBossStatus: "unavailable",
    ...overrides,
  };
}

describe("reminder planners", () => {
  it("plans fixed reminders using current offsets", () => {
    const now = Date.now();
    const goal = buildGoal({ endDate: now + 24 * 60 * 60 * 1000 });

    const planned = planFixedReminderEmails({
      goal,
      toUserId: "user_1" as Id<"users">,
      now,
      prefs: {
        ...DEFAULT_NOTIFICATION_PREFS,
        weeklyGoalReminder1OffsetMinutes: 24 * 60,
      },
    });

    expect(planned).toEqual([
      {
        trigger: "weekly_goal_reminder_1",
        toUserId: "user_1",
        weeklyGoalId: "goal_1",
        reminderOffsetMinutes: 24 * 60,
      },
      {
        trigger: "weekly_goal_reminder_2",
        toUserId: "user_1",
        weeklyGoalId: "goal_1",
        reminderOffsetMinutes: 24 * 60,
      },
    ]);
  });

  it("returns no fixed reminders before any reminder window opens", () => {
    const now = Date.now();
    // Goal ends in 10 days; the default reminders (3 days / 1 day before end)
    // have not come due yet, so timing alone excludes them.
    const planned = planFixedReminderEmails({
      goal: buildGoal({ endDate: now + 10 * 24 * 60 * 60 * 1000 }),
      toUserId: "user_1" as Id<"users">,
      now,
      prefs: DEFAULT_NOTIFICATION_PREFS,
    });

    expect(planned).toEqual([]);
  });

  it("plans daily and grace-period reminder descriptors", () => {
    const goal = buildGoal();

    expect(
      planDailyReminderEmail({
        goal,
        toUserId: "user_1" as Id<"users">,
        dedupeKey: "2026-05-13",
      })
    ).toEqual({
      trigger: "weekly_goal_daily_reminder",
      toUserId: "user_1",
      weeklyGoalId: "goal_1",
      dedupeKey: "2026-05-13",
    });

    expect(
      planGracePeriodReminderEmail({
        goal,
        toUserId: "user_1" as Id<"users">,
        dedupeKey: "2026-05-13",
      })
    ).toEqual({
      trigger: "weekly_goal_grace_period_reminder",
      toUserId: "user_1",
      weeklyGoalId: "goal_1",
      dedupeKey: "2026-05-13",
    });
  });

  it("draft-expiry creates in-app and plans email unless already sent", () => {
    expect(
      planDraftExpiryDecision({
        alreadySent: false,
      })
    ).toEqual({
      shouldCreateInAppNotification: true,
      shouldSendEmail: true,
    });

    expect(
      planDraftExpiryDecision({
        alreadySent: true,
      })
    ).toEqual({
      shouldCreateInAppNotification: false,
      shouldSendEmail: false,
    });
  });
});
