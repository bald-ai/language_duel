import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  isNotificationEnabled,
  shouldSendScheduledDuelReminder,
  shouldSendWeeklyGoalReminder,
  formatScheduledTime,
} from "@/lib/notificationPreferences";

describe("notificationPreferences", () => {
  describe("DEFAULT_NOTIFICATION_PREFS", () => {
    it("has all immediate duel settings enabled by default", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.immediateDuelsEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.immediateDuelChallengeEnabled).toBe(true);
    });

    it("has all scheduled duel settings enabled by default", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.scheduledDuelsEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.scheduledDuelProposalEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.scheduledDuelAcceptedEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.scheduledDuelCounterProposedEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.scheduledDuelDeclinedEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.scheduledDuelCanceledEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.scheduledDuelReminderEnabled).toBe(true);
    });

    it("has scheduled duel reminder offset at 15 minutes", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.scheduledDuelReminderOffsetMinutes).toBe(15);
    });

    it("has all weekly goal settings enabled by default", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalsEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalInviteEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalAcceptedEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalLockedEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalDeclinedEnabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1Enabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2Enabled).toBe(true);
    });

    it("has weekly goal reminder 1 offset at 72 hours (4320 minutes)", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1OffsetMinutes).toBe(4320);
    });

    it("has weekly goal reminder 2 offset at 24 hours (1440 minutes)", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes).toBe(1440);
    });

    it("has all expected keys", () => {
      const keys = Object.keys(DEFAULT_NOTIFICATION_PREFS);
      expect(keys).toHaveLength(20);
      expect(keys).toContain("immediateDuelsEnabled");
      expect(keys).toContain("scheduledDuelsEnabled");
      expect(keys).toContain("weeklyGoalsEnabled");
    });
  });

  describe("offset validation boundaries", () => {
    const MIN_OFFSET = 1;
    const MAX_OFFSET = 7 * 24 * 60;

    it("MIN_OFFSET is 1 minute", () => {
      expect(MIN_OFFSET).toBe(1);
    });

    it("MAX_OFFSET is 7 days in minutes (10080)", () => {
      expect(MAX_OFFSET).toBe(10080);
    });

    it("default offsets are within valid range", () => {
      expect(DEFAULT_NOTIFICATION_PREFS.scheduledDuelReminderOffsetMinutes).toBeGreaterThanOrEqual(MIN_OFFSET);
      expect(DEFAULT_NOTIFICATION_PREFS.scheduledDuelReminderOffsetMinutes).toBeLessThanOrEqual(MAX_OFFSET);
      
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1OffsetMinutes).toBeGreaterThanOrEqual(MIN_OFFSET);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1OffsetMinutes).toBeLessThanOrEqual(MAX_OFFSET);
      
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes).toBeGreaterThanOrEqual(MIN_OFFSET);
      expect(DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes).toBeLessThanOrEqual(MAX_OFFSET);
    });
  });

  describe("isNotificationEnabled", () => {
    it("returns false when category is disabled", () => {
      const prefs = { ...DEFAULT_NOTIFICATION_PREFS, scheduledDuelsEnabled: false };
      expect(isNotificationEnabled("scheduled_duel_proposal", prefs)).toBe(false);
    });

    it("returns true when category enabled and trigger enabled", () => {
      const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
      expect(isNotificationEnabled("scheduled_duel_proposal", prefs)).toBe(true);
    });

    it("returns false when category enabled but trigger disabled", () => {
      const prefs = {
        ...DEFAULT_NOTIFICATION_PREFS,
        scheduledDuelsEnabled: true,
        scheduledDuelProposalEnabled: false,
      };
      expect(isNotificationEnabled("scheduled_duel_proposal", prefs)).toBe(false);
    });
  });

  describe("shouldSendScheduledDuelReminder", () => {
    const MINUTE = 60 * 1000;

    it("returns true when within reminder window", () => {
      const now = Date.now();
      const duel = { scheduledTime: now + 10 * MINUTE, status: "accepted" };
      expect(shouldSendScheduledDuelReminder(duel, now, 15)).toBe(true);
    });

    it("returns false when too early for reminder", () => {
      const now = Date.now();
      const duel = { scheduledTime: now + 60 * MINUTE, status: "accepted" };
      expect(shouldSendScheduledDuelReminder(duel, now, 15)).toBe(false);
    });

    it("returns false when duel already started", () => {
      const now = Date.now();
      const duel = { scheduledTime: now + 10 * MINUTE, status: "accepted", startedDuelId: "123" };
      expect(shouldSendScheduledDuelReminder(duel, now, 15)).toBe(false);
    });

    it("returns false when duel is declined", () => {
      const now = Date.now();
      const duel = { scheduledTime: now + 10 * MINUTE, status: "declined" };
      expect(shouldSendScheduledDuelReminder(duel, now, 15)).toBe(false);
    });

    it("returns false when past scheduled time", () => {
      const now = Date.now();
      const duel = { scheduledTime: now - 5 * MINUTE, status: "accepted" };
      expect(shouldSendScheduledDuelReminder(duel, now, 15)).toBe(false);
    });
  });

  describe("shouldSendWeeklyGoalReminder", () => {
    const HOUR = 60 * 60 * 1000;

    it("returns true when within reminder window", () => {
      const now = Date.now();
      const goal = { expiresAt: now + 24 * HOUR, status: "active" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(true);
    });

    it("returns false when too early for reminder", () => {
      const now = Date.now();
      const goal = { expiresAt: now + 48 * HOUR, status: "active" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(false);
    });

    it("returns false when goal is not active", () => {
      const now = Date.now();
      const goal = { expiresAt: now + 20 * HOUR, status: "editing" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(false);
    });

    it("returns false when goal has no expiresAt", () => {
      const now = Date.now();
      const goal = { status: "active" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(false);
    });

    it("returns false when already expired", () => {
      const now = Date.now();
      const goal = { expiresAt: now - 1 * HOUR, status: "active" };
      expect(shouldSendWeeklyGoalReminder(goal, now, 24 * 60)).toBe(false);
    });
  });

  describe("formatScheduledTime", () => {
    it("formats timestamp in Europe/Bratislava timezone", () => {
      const timestamp = Date.UTC(2026, 1, 3, 15, 0, 0);
      const result = formatScheduledTime(timestamp, "Europe/Bratislava");
      expect(result).toContain("16:00");
      expect(result).toContain("Feb");
      expect(result).toContain("3");
    });
  });
});
