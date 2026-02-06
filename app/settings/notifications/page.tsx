"use client";

import { useRouter } from "next/navigation";
import { colors } from "@/lib/theme";
import { useNotificationSettings } from "./hooks/useNotificationSettings";
import { CategoryToggle } from "./components/CategoryToggle";
import { NotificationToggle } from "./components/NotificationToggle";
import { ReminderOffsetInput } from "./components/ReminderOffsetInput";

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { prefs, isLoading, updatePrefs } = useNotificationSettings();

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
            label="Immediate Duels"
            enabled={prefs.immediateDuelsEnabled}
            onChange={(v) => updatePrefs({ immediateDuelsEnabled: v })}
            data-testid="category-immediate-duels"
          >
            <NotificationToggle
              label="Challenge received"
              enabled={prefs.immediateDuelChallengeEnabled}
              disabled={!prefs.immediateDuelsEnabled}
              onChange={(v) => updatePrefs({ immediateDuelChallengeEnabled: v })}
            />
          </CategoryToggle>

          <CategoryToggle
            label="Scheduled Duels"
            enabled={prefs.scheduledDuelsEnabled}
            onChange={(v) => updatePrefs({ scheduledDuelsEnabled: v })}
            data-testid="category-scheduled-duels"
          >
            <NotificationToggle
              label="Proposal received"
              enabled={prefs.scheduledDuelProposalEnabled}
              disabled={!prefs.scheduledDuelsEnabled}
              onChange={(v) => updatePrefs({ scheduledDuelProposalEnabled: v })}
            />
            <NotificationToggle
              label="Duel accepted"
              enabled={prefs.scheduledDuelAcceptedEnabled}
              disabled={!prefs.scheduledDuelsEnabled}
              onChange={(v) => updatePrefs({ scheduledDuelAcceptedEnabled: v })}
            />
            <NotificationToggle
              label="Counter-proposal received"
              enabled={prefs.scheduledDuelCounterProposedEnabled}
              disabled={!prefs.scheduledDuelsEnabled}
              onChange={(v) => updatePrefs({ scheduledDuelCounterProposedEnabled: v })}
            />
            <NotificationToggle
              label="Duel declined"
              enabled={prefs.scheduledDuelDeclinedEnabled}
              disabled={!prefs.scheduledDuelsEnabled}
              onChange={(v) => updatePrefs({ scheduledDuelDeclinedEnabled: v })}
            />
            <NotificationToggle
              label="Duel canceled"
              enabled={prefs.scheduledDuelCanceledEnabled}
              disabled={!prefs.scheduledDuelsEnabled}
              onChange={(v) => updatePrefs({ scheduledDuelCanceledEnabled: v })}
            />
            <NotificationToggle
              label="Duel reminder"
              enabled={prefs.scheduledDuelReminderEnabled}
              disabled={!prefs.scheduledDuelsEnabled}
              onChange={(v) => updatePrefs({ scheduledDuelReminderEnabled: v })}
            />
            <ReminderOffsetInput
              label="Remind me before"
              valueMinutes={prefs.scheduledDuelReminderOffsetMinutes}
              disabled={!prefs.scheduledDuelsEnabled || !prefs.scheduledDuelReminderEnabled}
              onChange={(v) => updatePrefs({ scheduledDuelReminderOffsetMinutes: v })}
              data-testid="scheduled-duel-reminder-offset"
            />
          </CategoryToggle>

          <CategoryToggle
            label="Weekly Goals"
            enabled={prefs.weeklyGoalsEnabled}
            onChange={(v) => updatePrefs({ weeklyGoalsEnabled: v })}
            data-testid="category-weekly-goals"
          >
            <NotificationToggle
              label="Goal invite received"
              enabled={prefs.weeklyGoalInviteEnabled}
              disabled={!prefs.weeklyGoalsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalInviteEnabled: v })}
            />
            <NotificationToggle
              label="Goal invite accepted"
              enabled={prefs.weeklyGoalAcceptedEnabled}
              disabled={!prefs.weeklyGoalsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalAcceptedEnabled: v })}
            />
            <NotificationToggle
              label="Goal invite declined"
              enabled={prefs.weeklyGoalDeclinedEnabled}
              disabled={!prefs.weeklyGoalsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalDeclinedEnabled: v })}
            />
            <NotificationToggle
              label="Goal reminder 1"
              enabled={prefs.weeklyGoalReminder1Enabled}
              disabled={!prefs.weeklyGoalsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalReminder1Enabled: v })}
            />
            <ReminderOffsetInput
              label="First reminder before expiry"
              valueMinutes={prefs.weeklyGoalReminder1OffsetMinutes}
              disabled={!prefs.weeklyGoalsEnabled || !prefs.weeklyGoalReminder1Enabled}
              onChange={(v) => updatePrefs({ weeklyGoalReminder1OffsetMinutes: v })}
            />
            <NotificationToggle
              label="Goal reminder 2"
              enabled={prefs.weeklyGoalReminder2Enabled}
              disabled={!prefs.weeklyGoalsEnabled}
              onChange={(v) => updatePrefs({ weeklyGoalReminder2Enabled: v })}
            />
            <ReminderOffsetInput
              label="Second reminder before expiry"
              valueMinutes={prefs.weeklyGoalReminder2OffsetMinutes}
              disabled={!prefs.weeklyGoalsEnabled || !prefs.weeklyGoalReminder2Enabled}
              onChange={(v) => updatePrefs({ weeklyGoalReminder2OffsetMinutes: v })}
            />
          </CategoryToggle>
        </div>
      </div>
    </div>
  );
}
