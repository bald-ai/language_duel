import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_PREFS, normalizeNotificationPreferences } from "@/lib/notificationPreferencesDefaults";

describe("notification preference normalization", () => {
  it.each([null, undefined, {}])("defaults absent preferences (%s)", prefs => {
    expect(normalizeNotificationPreferences(prefs)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(normalizeNotificationPreferences(prefs)).not.toBe(DEFAULT_NOTIFICATION_PREFS);
  });
  it("preserves every explicit opt-out and defaults only absent preferences", () => {
    const disabled = {
      challengeInviteEmailsEnabled: false, challengeInviteEmailEnabled: false,
      weeklyGoalEmailsEnabled: false, weeklyGoalInviteEmailEnabled: false,
      weeklyGoalAcceptedEmailEnabled: false, weeklyGoalLockedEmailEnabled: false,
      weeklyGoalDailyReminderEmailEnabled: false, weeklyGoalGracePeriodReminderEmailEnabled: false,
      weeklyGoalDraftExpiringEmailEnabled: false, weeklyGoalReminder1EmailEnabled: false,
      weeklyGoalReminder2EmailEnabled: false,
    };
    expect(normalizeNotificationPreferences(disabled)).toEqual({
      ...disabled, weeklyGoalReminder1OffsetMinutes: 4320, weeklyGoalReminder2OffsetMinutes: 1440,
    });
    expect(normalizeNotificationPreferences({ weeklyGoalEmailsEnabled: false })).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS, weeklyGoalEmailsEnabled: false,
    });
  });
  it.each([1, 10080, 1.5, 60])("accepts valid reminder offset %s", value => {
    const result = normalizeNotificationPreferences({ weeklyGoalReminder1OffsetMinutes: value, weeklyGoalReminder2OffsetMinutes: value });
    expect(result.weeklyGoalReminder1OffsetMinutes).toBe(value);
    expect(result.weeklyGoalReminder2OffsetMinutes).toBe(value);
  });
  it.each([0, -1, 10081, NaN, Infinity, -Infinity, undefined])("defaults invalid reminder offset %s", value => {
    const result = normalizeNotificationPreferences({ weeklyGoalReminder1OffsetMinutes: value, weeklyGoalReminder2OffsetMinutes: value });
    expect(result.weeklyGoalReminder1OffsetMinutes).toBe(4320);
    expect(result.weeklyGoalReminder2OffsetMinutes).toBe(1440);
  });
});
