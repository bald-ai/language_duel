"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useMemo, useState } from "react";
import {
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notificationPreferences";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export function useNotificationSettings() {
  const prefs = useQuery(api.notificationPreferences.getMyNotificationPreferences);
  const setPrefs = useMutation(api.notificationPreferences.updateNotificationPreferences);
  const [isUpdating, setIsUpdating] = useState(false);
  const currentPrefs: NotificationPreferences = useMemo(
    () => normalizeNotificationPreferences(prefs),
    [prefs]
  );

  const updatePrefs = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!prefs) return;

      setIsUpdating(true);

      try {
        await setPrefs(updates);
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to update preferences"));
      } finally {
        setIsUpdating(false);
      }
    },
    [prefs, setPrefs]
  );

  return {
    prefs: currentPrefs,
    isLoading: prefs === undefined,
    isUpdating,
    updatePrefs,
  };
}
