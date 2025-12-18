"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

export function useFriendActions() {
  const sendRequestMutation = useMutation(api.friends.sendFriendRequest);
  const acceptRequestMutation = useMutation(api.friends.acceptFriendRequest);
  const rejectRequestMutation = useMutation(api.friends.rejectFriendRequest);
  const removeFriendMutation = useMutation(api.friends.removeFriend);

  const [sendingTo, setSendingTo] = useState<Id<"users"> | null>(null);
  const [acceptingId, setAcceptingId] = useState<Id<"friendRequests"> | null>(null);
  const [rejectingId, setRejectingId] = useState<Id<"friendRequests"> | null>(null);
  const [removingId, setRemovingId] = useState<Id<"users"> | null>(null);

  const sendRequest = useCallback(
    async (receiverId: Id<"users">) => {
      setSendingTo(receiverId);
      try {
        await sendRequestMutation({ receiverId });
        toast.success("Friend request sent!");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send request";
        toast.error(message);
        return false;
      } finally {
        setSendingTo(null);
      }
    },
    [sendRequestMutation]
  );

  const acceptRequest = useCallback(
    async (requestId: Id<"friendRequests">) => {
      setAcceptingId(requestId);
      try {
        await acceptRequestMutation({ requestId });
        toast.success("Friend request accepted!");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to accept request";
        toast.error(message);
        return false;
      } finally {
        setAcceptingId(null);
      }
    },
    [acceptRequestMutation]
  );

  const rejectRequest = useCallback(
    async (requestId: Id<"friendRequests">) => {
      setRejectingId(requestId);
      try {
        await rejectRequestMutation({ requestId });
        toast.success("Friend request rejected");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reject request";
        toast.error(message);
        return false;
      } finally {
        setRejectingId(null);
      }
    },
    [rejectRequestMutation]
  );

  const removeFriend = useCallback(
    async (friendId: Id<"users">) => {
      setRemovingId(friendId);
      try {
        await removeFriendMutation({ friendId });
        toast.success("Friend removed");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to remove friend";
        toast.error(message);
        return false;
      } finally {
        setRemovingId(null);
      }
    },
    [removeFriendMutation]
  );

  return {
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
    sendingTo,
    acceptingId,
    rejectingId,
    removingId,
  };
}

