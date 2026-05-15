"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useWeeklyGoalNotificationActions() {
  const dismissWeeklyGoalMutation = useMutation(api.weeklyGoals.dismissWeeklyGoalInvitation);
  const archiveCompletedGoalThemesMutation = useMutation(api.weeklyGoals.archiveCompletedGoalThemesFromNotification);
  const declineWeeklyGoalMutation = useMutation(api.weeklyGoals.declineWeeklyGoalInvitation);

  const dismissWeeklyGoalInvitation = useCallback(async (notificationId: Id<"notifications">) => {
    try {
      await dismissWeeklyGoalMutation({ notificationId });
      return { success: true };
    } catch (error) {
      console.error("Failed to dismiss weekly goal invitation:", error);
      throw error;
    }
  }, [dismissWeeklyGoalMutation]);

  const declineWeeklyGoalInvitation = useCallback(async (notificationId: Id<"notifications">) => {
    try {
      await declineWeeklyGoalMutation({ notificationId });
      return { success: true };
    } catch (error) {
      console.error("Failed to decline weekly goal invitation:", error);
      throw error;
    }
  }, [declineWeeklyGoalMutation]);

  const archiveCompletedGoalThemes = useCallback(async (notificationId: Id<"notifications">) => {
    try {
      return await archiveCompletedGoalThemesMutation({ notificationId });
    } catch (error) {
      console.error("Failed to archive completed goal themes:", error);
      throw error;
    }
  }, [archiveCompletedGoalThemesMutation]);

  return {
    dismissWeeklyGoalInvitation,
    declineWeeklyGoalInvitation,
    archiveCompletedGoalThemes,
  };
}
