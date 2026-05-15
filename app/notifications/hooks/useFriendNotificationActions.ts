"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useFriendNotificationActions() {
  const acceptFriendRequestMutation = useMutation(api.friends.acceptFriendRequestNotification);
  const rejectFriendRequestMutation = useMutation(api.friends.rejectFriendRequestNotification);

  const acceptFriendRequest = useCallback(async (notificationId: Id<"notifications">) => {
    try {
      await acceptFriendRequestMutation({ notificationId });
      return { success: true };
    } catch (error) {
      console.error("Failed to accept friend request:", error);
      throw error;
    }
  }, [acceptFriendRequestMutation]);

  const rejectFriendRequest = useCallback(async (notificationId: Id<"notifications">) => {
    try {
      await rejectFriendRequestMutation({ notificationId });
      return { success: true };
    } catch (error) {
      console.error("Failed to reject friend request:", error);
      throw error;
    }
  }, [rejectFriendRequestMutation]);

  return { acceptFriendRequest, rejectFriendRequest };
}
