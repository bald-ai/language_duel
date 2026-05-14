import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_EMAIL_TRIGGERS,
  NOTIFICATION_EMAIL_TRIGGER_CONTRACT,
  WEEKLY_GOAL_REMINDER_1_DEFAULT_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_2_DEFAULT_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_WINDOW_MS,
  isNotificationEnabled,
  shouldSendWeeklyGoalReminder,
  formatScheduledTimeForEmail,
} from "@/lib/notificationPreferences";

describe("notificationPreferences", () => {
  describe("DEFAULT_NOTIFICATION_PREFS", () => {
    it("has challenge invite email settings enabled by default", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.challengeInviteEmailsEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.challengeInviteEmailEnabled).toBe(true);
    });

    it("has the supported weekly goal email settings enabled by default", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalEmailsEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalInviteEmailEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalAcceptedEmailEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalLockedEmailEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalDailyReminderEmailEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalGracePeriodReminderEmailEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalDraftExpiringEmailEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1EmailEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2EmailEnabled).toBe(true);
    });

    it("has weekly goal reminder 1 offset at 72 hours (4320 minutes)", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1OffsetMinutes).toBe(
        WEEKLY_GOAL_REMINDER_1_DEFAULT_OFFSET_MINUTES
      );
    });

    it("has weekly goal reminder 2 offset at 24 hours (1440 minutes)", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes).toBe(
        WEEKLY_GOAL_REMINDER_2_DEFAULT_OFFSET_MINUTES
      );
    });

    it("keeps reminder timing bounds aligned with current behavior", () => {
      expect(WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES).toBe(1);
      expect(WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES).toBe(7 * 24 * 60);
      expect(WEEKLY_GOAL_REMINDER_WINDOW_MS).toBe(2 * 60 * 60 * 1000);
    });
  });

  describe("isNotificationEnabled trigger behavior", () => {
    it("trigger contract covers all supported email triggers", () => {
      expect(NOTIFICATION_EMAIL_TRIGGERS).toEqual([
        "immediate_challenge_invite",
        "weekly_goal_invite",
        "weekly_goal_locked",
        "weekly_goal_accepted",
        "weekly_goal_daily_reminder",
        "weekly_goal_draft_expiring",
        "weekly_goal_grace_period_reminder",
        "weekly_goal_reminder_1",
        "weekly_goal_reminder_2",
      ]);
    });

    it.each(NOTIFICATION_EMAIL_TRIGGERS)(
      "enables %s by default when both category and trigger are enabled",
      (trigger) => {
        expect(isNotificationEnabled(trigger, DEFAULT_NOTIFICATION_PREFS)).toBe(true);
      }
    );

    it("returns false for unsupported triggers", () => {
      expect(isNotificationEnabled("nonexistent_trigger" as never, DEFAULT_NOTIFICATION_PREFS)).toBe(
        false
      );
    });

    const categoryTestCases = [
      {
        category: "challengeInviteEmailsEnabled" as const,
        triggers: ["immediate_challenge_invite"] as const,
      },
      {
        category: "weeklyGoalEmailsEnabled" as const,
        triggers: [
          "weekly_goal_invite",
          "weekly_goal_locked",
          "weekly_goal_accepted",
          "weekly_goal_daily_reminder",
          "weekly_goal_draft_expiring",
          "weekly_goal_grace_period_reminder",
          "weekly_goal_reminder_1",
          "weekly_goal_reminder_2",
        ] as const,
      },
    ];

    it.each(categoryTestCases)(
      "disables all $category triggers when the category is off",
      ({ category, triggers }) => {
        const prefs = { ...DEFAULT_NOTIFICATION_PREFS, [category]: false };
        triggers.forEach((trigger) => {
          expect(isNotificationEnabled(trigger, prefs)).toBe(false);
        });
      }
    );

    const specificTriggerTestCases = NOTIFICATION_EMAIL_TRIGGERS.map((trigger) => ({
      trigger,
      pref: NOTIFICATION_EMAIL_TRIGGER_CONTRACT[trigger].trigger,
    }));

    it.each(specificTriggerTestCases)(
      "disables $trigger when $pref is false",
      ({ trigger, pref }) => {
        const prefs = { ...DEFAULT_NOTIFICATION_PREFS, [pref]: false };
        expect(isNotificationEnabled(trigger, prefs)).toBe(false);
      }
    );

    it("uses the grace period preference for expired delete reminders", () => {
      expect(isNotificationEnabled("weekly_goal_grace_period_reminder", DEFAULT_NOTIFICATION_PREFS)).toBe(
        true
      );
      expect(
        isNotificationEnabled("weekly_goal_grace_period_reminder", {
          ...DEFAULT_NOTIFICATION_PREFS,
          weeklyGoalDailyReminderEmailEnabled: false,
        })
      ).toBe(true);
      expect(
        isNotificationEnabled("weekly_goal_grace_period_reminder", {
          ...DEFAULT_NOTIFICATION_PREFS,
          weeklyGoalGracePeriodReminderEmailEnabled: false,
        })
      ).toBe(false);
    });
  });

  describe("shouldSendWeeklyGoalReminder", () => {
    const HOUR = 60 * 60 * 1000;

    it("returns true when within reminder window", () => {
      const now = Date.now();
      const goal = { endDate: now + 24 * HOUR, status: "locked", bossStatus: "unavailable" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(true);
    });

    it("returns true when a cron is delayed by the 2 hour window", () => {
      const now = Date.now();
      const goal = { endDate: now + 23 * HOUR, status: "locked", bossStatus: "unavailable" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60, WEEKLY_GOAL_REMINDER_WINDOW_MS)).toBe(true);
    });

    it("returns false when too early for reminder", () => {
      const now = Date.now();
      const goal = { endDate: now + 48 * HOUR, status: "locked", bossStatus: "unavailable" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(false);
    });

    it("returns false when goal is not locked", () => {
      const now = Date.now();
      const goal = { endDate: now + 20 * HOUR, status: "draft", bossStatus: "unavailable" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(false);
    });

    it("returns false when goal has no endDate", () => {
      const now = Date.now();
      const goal = { status: "locked", bossStatus: "unavailable" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(false);
    });

    it("returns false when already in grace period", () => {
      const now = Date.now();
      const goal = { endDate: now - 1 * HOUR, status: "locked", bossStatus: "unavailable" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(false);
    });

    it("returns false when the big boss is already defeated", () => {
      const now = Date.now();
      const goal = { endDate: now + 24 * HOUR, status: "locked", bossStatus: "defeated" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(false);
    });
  });

  describe("formatScheduledTimeForEmail", () => {
    it("formats timestamp in Europe/Prague timezone", () => {
      const timestamp = Date.UTC(2026, 1, 3, 15, 0, 0);
      const result = formatScheduledTimeForEmail(timestamp, "Europe/Prague");
      expect(result).toContain("16:00");
      expect(result).toContain("Feb");
      expect(result).toContain("3");
    });
  });
});
