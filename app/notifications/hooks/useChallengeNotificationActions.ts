"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useChallengeNotificationActions() {
  const acceptChallengeMutation = useMutation(api.challenges.acceptChallengeFromNotification);
  const declineChallengeMutation = useMutation(api.challenges.declineChallengeFromNotification);

  const acceptChallenge = useCallback(async (notificationId: Id<"notifications">) => {
    try {
      return await acceptChallengeMutation({ notificationId });
    } catch (error) {
      console.error("Failed to accept challenge:", error);
      throw error;
    }
  }, [acceptChallengeMutation]);

  const declineChallenge = useCallback(async (notificationId: Id<"notifications">) => {
    try {
      await declineChallengeMutation({ notificationId });
      return { success: true };
    } catch (error) {
      console.error("Failed to decline challenge:", error);
      throw error;
    }
  }, [declineChallengeMutation]);

  return { acceptChallenge, declineChallenge };
}
