"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useMemo, useState } from "react";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPreferences } from "@/lib/notificationPreferences";
import { toast } from "sonner";

function toNotificationPreferences(
  prefs: Partial<NotificationPreferences> | null | undefined
): NotificationPreferences {
  return {
    challengeInvitesEnabled:
      prefs?.challengeInvitesEnabled ?? DEFAULT_NOTIFICATION_PREFS.challengeInvitesEnabled,
    challengeInviteEmailEnabled:
      prefs?.challengeInviteEmailEnabled ?? DEFAULT_NOTIFICATION_PREFS.challengeInviteEmailEnabled,
    weeklyGoalsEnabled: prefs?.weeklyGoalsEnabled ?? DEFAULT_NOTIFICATION_PREFS.weeklyGoalsEnabled,
    weeklyGoalInviteEnabled:
      prefs?.weeklyGoalInviteEnabled ?? DEFAULT_NOTIFICATION_PREFS.weeklyGoalInviteEnabled,
    weeklyGoalAcceptedEnabled:
      prefs?.weeklyGoalAcceptedEnabled ?? DEFAULT_NOTIFICATION_PREFS.weeklyGoalAcceptedEnabled,
    weeklyGoalLockedEnabled:
      prefs?.weeklyGoalLockedEnabled ?? DEFAULT_NOTIFICATION_PREFS.weeklyGoalLockedEnabled,
    weeklyGoalDailyReminderEnabled:
      prefs?.weeklyGoalDailyReminderEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalDailyReminderEnabled,
    weeklyGoalGracePeriodReminderEnabled:
      prefs?.weeklyGoalGracePeriodReminderEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalGracePeriodReminderEnabled,
    weeklyGoalDraftExpiringEnabled:
      prefs?.weeklyGoalDraftExpiringEnabled ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalDraftExpiringEnabled,
    weeklyGoalReminder1Enabled:
      prefs?.weeklyGoalReminder1Enabled ?? DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1Enabled,
    weeklyGoalReminder1OffsetMinutes:
      prefs?.weeklyGoalReminder1OffsetMinutes ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder1OffsetMinutes,
    weeklyGoalReminder2Enabled:
      prefs?.weeklyGoalReminder2Enabled ?? DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2Enabled,
    weeklyGoalReminder2OffsetMinutes:
      prefs?.weeklyGoalReminder2OffsetMinutes ??
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes,
  };
}

export function useNotificationSettings() {
  const prefs = useQuery(api.notificationPreferences.getMyNotificationPreferences);
  const setPrefs = useMutation(api.notificationPreferences.updateNotificationPreferences);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentPrefs: NotificationPreferences = useMemo(
    () => toNotificationPreferences(prefs),
    [prefs]
  );

  const updatePrefs = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!prefs) return;

      setIsUpdating(true);
      setError(null);

      try {
        const merged: NotificationPreferences = { ...currentPrefs, ...updates };

        await setPrefs(merged);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update preferences";
        setError(message);
        toast.error(message);
      } finally {
        setIsUpdating(false);
      }
    },
    [currentPrefs, prefs, setPrefs]
  );

  return {
    prefs: currentPrefs,
    isLoading: prefs === undefined,
    isUpdating,
    error,
    updatePrefs,
    clearError: () => setError(null),
  };
}
