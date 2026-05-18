"use client";

import { useRouter } from "next/navigation";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { useNotificationSettings } from "./hooks/useNotificationSettings";
import { CategoryToggle } from "./components/CategoryToggle";
import { NotificationToggle } from "./components/NotificationToggle";
import { ReminderOffsetInput } from "./components/ReminderOffsetInput";
import {
  NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS,
  NOTIFICATION_EMAIL_TRIGGERS,
  type NotificationEmailTriggerConfig,
  type NotificationEmailTrigger,
} from "@/lib/notifications/definitions";
import type { NotificationPreferences } from "@/lib/notificationPreferences";

const CHALLENGE_EMAIL_TRIGGERS = NOTIFICATION_EMAIL_TRIGGERS.filter(
  (trigger) => NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS[trigger].category === "challengeInviteEmailsEnabled"
);
const WEEKLY_GOAL_EMAIL_TRIGGERS = NOTIFICATION_EMAIL_TRIGGERS.filter(
  (trigger) => NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS[trigger].category === "weeklyGoalEmailsEnabled"
);

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { prefs, isLoading, updatePrefs } = useNotificationSettings();
  const colors = useAppearanceColors();

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
            <EmailTriggerToggles
              triggers={CHALLENGE_EMAIL_TRIGGERS}
              prefs={prefs}
              updatePrefs={updatePrefs}
            />
          </CategoryToggle>

          <CategoryToggle
            label="Weekly Goals"
            enabled={prefs.weeklyGoalEmailsEnabled}
            onChange={(v) => updatePrefs({ weeklyGoalEmailsEnabled: v })}
            data-testid="category-weekly-goals"
          >
            <EmailTriggerToggles
              triggers={WEEKLY_GOAL_EMAIL_TRIGGERS}
              prefs={prefs}
              updatePrefs={updatePrefs}
            />
          </CategoryToggle>
        </div>
      </div>
    </div>
  );
}

type UpdatePrefs = (updates: Partial<NotificationPreferences>) => void;

function EmailTriggerToggles({
  triggers,
  prefs,
  updatePrefs,
}: {
  triggers: NotificationEmailTrigger[];
  prefs: NotificationPreferences;
  updatePrefs: UpdatePrefs;
}) {
  return triggers.map((trigger) => {
    const metadata: NotificationEmailTriggerConfig = NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS[trigger];
    const reminderOffset = metadata.reminderOffset;
    return (
      <div key={trigger}>
        <NotificationToggle
          label={metadata.label}
          enabled={prefs[metadata.trigger]}
          disabled={!prefs[metadata.category]}
          onChange={(value) => updatePrefs({ [metadata.trigger]: value })}
        />
        {reminderOffset ? (
          <ReminderOffsetInput
            label={reminderOffset.label}
            valueMinutes={prefs[reminderOffset.field]}
            disabled={!prefs[metadata.category] || !prefs[metadata.trigger]}
            onChange={(value) => updatePrefs({ [reminderOffset.field]: value })}
          />
        ) : null}
      </div>
    );
  });
}
