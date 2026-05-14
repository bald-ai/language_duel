"use client";

import { useRouter } from "next/navigation";
import { useThemeColors } from "@/app/components/ThemeProvider";
import { useNotificationSettings } from "./hooks/useNotificationSettings";
import { CategoryToggle } from "./components/CategoryToggle";
import { NotificationToggle } from "./components/NotificationToggle";
import { ReminderOffsetInput } from "./components/ReminderOffsetInput";

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { prefs, isLoading, updatePrefs } = useNotificationSettings();
  const colors = useThemeColors();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.background.DEFAULT }}
      >
        <div style={{ color: colors.text.muted }} className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-6"
      style={{ backgroundColor: colors.background.DEFAULT }}
    >
      <div className="max-w-md mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/settings")}
            className="p-2 rounded-lg border-2 transition-colors hover:opacity-80"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
            }}
            data-testid="notifications-back"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke={colors.text.muted}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1
            className="text-2xl font-bold uppercase tracking-wide"
            style={{ color: colors.text.DEFAULT }}
          >
            Notification Settings
          </h1>
        </header>

        <div
          className="rounded-2xl border-2 p-4"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
          }}
        >
          <CategoryToggle
            label="Challenge Invites"
            enabled={prefs.challengeInviteEmailsEnabled}
            onChange={(v) => updatePrefs({ challengeInviteEmailsEnabled: v })}
            data-testid="category-challenge-invites"
          >
            <NotificationToggle
              label="Challenge invite email"
              enabled={prefs.challengeInviteEmailEnabled}
              disabled={!prefs.challengeInviteEmailsEnabled}
              onChange={(v) => updatePrefs({ challengeInviteEmailEnabled: v })}
            />
          </CategoryToggle>

          <CategoryToggle
            label="Weekly Goals"
            enabled={prefs.weeklyGoalEmailsEnabled}
            onChange={(v) => updatePrefs({ weeklyGoalEmailsEnabled: v })}
            data-testid="category-weekly-goals"
          >
            <NotificationToggle
              label="Goal invite received"
              enabled={prefs.weeklyGoalInviteEmailEnabled}
              disabled={!prefs.weeklyGoalEmailsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalInviteEmailEnabled: v })}
            />
            <NotificationToggle
              label="Goal invite accepted"
              enabled={prefs.weeklyGoalAcceptedEmailEnabled}
              disabled={!prefs.weeklyGoalEmailsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalAcceptedEmailEnabled: v })}
            />
            <NotificationToggle
              label="Partner locked goal"
              enabled={prefs.weeklyGoalLockedEmailEnabled}
              disabled={!prefs.weeklyGoalEmailsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalLockedEmailEnabled: v })}
            />
            <NotificationToggle
              label="Daily goal countdown email"
              enabled={prefs.weeklyGoalDailyReminderEmailEnabled}
              disabled={!prefs.weeklyGoalEmailsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalDailyReminderEmailEnabled: v })}
            />
            <NotificationToggle
              label="Grace period warning"
              enabled={prefs.weeklyGoalGracePeriodReminderEmailEnabled}
              disabled={!prefs.weeklyGoalEmailsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalGracePeriodReminderEmailEnabled: v })}
            />
            <NotificationToggle
              label="Draft expiry warning"
              enabled={prefs.weeklyGoalDraftExpiringEmailEnabled}
              disabled={!prefs.weeklyGoalEmailsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalDraftExpiringEmailEnabled: v })}
            />
            <NotificationToggle
              label="Goal reminder 1"
              enabled={prefs.weeklyGoalReminder1EmailEnabled}
              disabled={!prefs.weeklyGoalEmailsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalReminder1EmailEnabled: v })}
            />
            <ReminderOffsetInput
              label="First reminder before expiry"
              valueMinutes={prefs.weeklyGoalReminder1OffsetMinutes}
              disabled={!prefs.weeklyGoalEmailsEnabled || !prefs.weeklyGoalReminder1EmailEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalReminder1OffsetMinutes: v })}
            />
            <NotificationToggle
              label="Goal reminder 2"
              enabled={prefs.weeklyGoalReminder2EmailEnabled}
              disabled={!prefs.weeklyGoalEmailsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalReminder2EmailEnabled: v })}
            />
            <ReminderOffsetInput
              label="Second reminder before expiry"
              valueMinutes={prefs.weeklyGoalReminder2OffsetMinutes}
              disabled={!prefs.weeklyGoalEmailsEnabled || !prefs.weeklyGoalReminder2EmailEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalReminder2OffsetMinutes: v })}
            />
          </CategoryToggle>
        </div>
      </div>
    </div>
  );
}
