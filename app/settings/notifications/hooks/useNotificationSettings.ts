"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useState } from "react";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPreferences } from "@/lib/notificationPreferences";

export function useNotificationSettings() {
  const prefs = useQuery(api.notificationPreferences.getMyNotificationPreferences);
  const setPrefs = useMutation(api.notificationPreferences.setMyNotificationPreferences);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePrefs = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!prefs) return;

      setIsUpdating(true);
      setError(null);

      try {
        const merged: NotificationPreferences = {
          immediateDuelsEnabled: updates.immediateDuelsEnabled ?? prefs.immediateDuelsEnabled,
          immediateDuelChallengeEnabled:
            updates.immediateDuelChallengeEnabled ?? prefs.immediateDuelChallengeEnabled,

          scheduledDuelsEnabled: updates.scheduledDuelsEnabled ?? prefs.scheduledDuelsEnabled,
          scheduledDuelProposalEnabled:
            updates.scheduledDuelProposalEnabled ?? prefs.scheduledDuelProposalEnabled,
          scheduledDuelAcceptedEnabled:
            updates.scheduledDuelAcceptedEnabled ?? prefs.scheduledDuelAcceptedEnabled,
          scheduledDuelCounterProposedEnabled:
            updates.scheduledDuelCounterProposedEnabled ?? prefs.scheduledDuelCounterProposedEnabled,
          scheduledDuelDeclinedEnabled:
            updates.scheduledDuelDeclinedEnabled ?? prefs.scheduledDuelDeclinedEnabled,
          scheduledDuelCanceledEnabled:
            updates.scheduledDuelCanceledEnabled ?? prefs.scheduledDuelCanceledEnabled,
          scheduledDuelReminderEnabled:
            updates.scheduledDuelReminderEnabled ?? prefs.scheduledDuelReminderEnabled,
          scheduledDuelReminderOffsetMinutes:
            updates.scheduledDuelReminderOffsetMinutes ?? prefs.scheduledDuelReminderOffsetMinutes,

          weeklyGoalsEnabled: updates.weeklyGoalsEnabled ?? prefs.weeklyGoalsEnabled,
          weeklyGoalInviteEnabled:
            updates.weeklyGoalInviteEnabled ?? prefs.weeklyGoalInviteEnabled,
          weeklyGoalAcceptedEnabled:
            updates.weeklyGoalAcceptedEnabled ?? prefs.weeklyGoalAcceptedEnabled,
          weeklyGoalDeclinedEnabled:
            updates.weeklyGoalDeclinedEnabled ?? prefs.weeklyGoalDeclinedEnabled,
          weeklyGoalReminder1Enabled:
            updates.weeklyGoalReminder1Enabled ?? prefs.weeklyGoalReminder1Enabled,
          weeklyGoalReminder1OffsetMinutes:
            updates.weeklyGoalReminder1OffsetMinutes ?? prefs.weeklyGoalReminder1OffsetMinutes,
          weeklyGoalReminder2Enabled:
            updates.weeklyGoalReminder2Enabled ?? prefs.weeklyGoalReminder2Enabled,
          weeklyGoalReminder2OffsetMinutes:
            updates.weeklyGoalReminder2OffsetMinutes ?? prefs.weeklyGoalReminder2OffsetMinutes,
        };

        await setPrefs(merged);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update preferences");
      } finally {
        setIsUpdating(false);
      }
    },
    [prefs, setPrefs]
  );

  return {
    prefs: prefs ?? { ...DEFAULT_NOTIFICATION_PREFS, isDefault: true },
    isLoading: prefs === undefined,
    isUpdating,
    error,
    updatePrefs,
    clearError: () => setError(null),
  };
}
