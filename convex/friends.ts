import { mutation, query, internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { isUserOnline, loadUsersById } from "./helpers/users";
import {
  createFriendRequestNotification,
  dismissFriendRequestNotifications,
  isFriendRequestPayload,
  requireCallerOwnedNotificationPayload,
} from "./notificationHelpers";
import { closeVisibleGoalsBetweenParticipants } from "./weeklyGoals";
import {
  FRIEND_REQUEST_TTL_MS,
  RESOLVED_FRIEND_REQUEST_TTL_MS,
} from "./constants";
import { isCreatedAtExpired } from "../lib/cleanupExpiry";
import { isResolvedFriendRequestPastRetention } from "../lib/cleanupRetention";

// Friend with user details
export type FriendWithDetails = {
  friendshipId: Id<"friends">;
  friendId: Id<"users">;
  nickname?: string;
  discriminator?: number;
  name?: string;
  email: string;
  imageUrl?: string;
  createdAt: number;
  isOnline: boolean;
  lastSeenAt?: number;
};

// Sent friend request with receiver details
export type SentRequestWithDetails = {
  requestId: Id<"friendRequests">;
  senderId: Id<"users">; // Current user's id
  receiverId: Id<"users">; // Receiver's id
  nickname?: string;
  discriminator?: number;
  name?: string;
  email: string;
  imageUrl?: string;
  createdAt: number;
};

type FriendRequestAction = "accepted" | "rejected";

export type RelationshipMap = {
  friendIds: Set<string>;
  pendingFriendRequestUserIds: Set<string>;
};

export async function getRelationshipMapForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<RelationshipMap> {
  const friends = await ctx.db
    .query("friends")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const friendIds = new Set(friends.map((friendship) => friendship.friendId.toString()));

  const sentRequests = await ctx.db
    .query("friendRequests")
    .withIndex("by_sender", (q) => q.eq("senderId", userId))
    .collect();
  const pendingSentIds = sentRequests
    .filter((request) => request.status === "pending")
    .map((request) => request.receiverId.toString());

  const receivedRequests = await ctx.db
    .query("friendRequests")
    .withIndex("by_receiver", (q) => q.eq("receiverId", userId).eq("status", "pending"))
    .collect();
  const pendingReceivedIds = receivedRequests.map((request) => request.senderId.toString());

  return {
    friendIds,
    pendingFriendRequestUserIds: new Set([...pendingSentIds, ...pendingReceivedIds]),
  };
}

async function resolvePendingFriendRequestForReceiver(
  ctx: MutationCtx,
  requestId: Id<"friendRequests">,
  receiverId: Id<"users">,
  action: FriendRequestAction
) {
  const request = await ctx.db.get(requestId);
  if (!request) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Friend request not found" });
  }

  if (request.receiverId !== receiverId) {
    throw new ConvexError({
      code: "NOT_AUTHORIZED",
      message: `Cannot ${action === "accepted" ? "accept" : "reject"} this friend request`,
    });
  }

  if (request.status !== "pending") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Friend request is no longer pending" });
  }

  await ctx.db.patch(requestId, { status: action });
  await dismissFriendRequestNotifications(ctx, receiverId, requestId);

  return request;
}

async function acceptFriendRequestCore(
  ctx: MutationCtx,
  requestId: Id<"friendRequests">,
  receiverId: Id<"users">
) {
  const request = await resolvePendingFriendRequestForReceiver(
    ctx,
    requestId,
    receiverId,
    "accepted"
  );

  const now = Date.now();
  await ctx.db.insert("friends", {
    userId: receiverId,
    friendId: request.senderId,
    createdAt: now,
  });
  await ctx.db.insert("friends", {
    userId: request.senderId,
    friendId: receiverId,
    createdAt: now,
  });
}

async function rejectFriendRequestCore(
  ctx: MutationCtx,
  requestId: Id<"friendRequests">,
  receiverId: Id<"users">
) {
  await resolvePendingFriendRequestForReceiver(ctx, requestId, receiverId, "rejected");
}

/**
 * Get friend requests sent by current user
 */
export const getSentRequests = query({
  args: {},
  handler: async (ctx): Promise<SentRequestWithDetails[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    const requests = await ctx.db
      .query("friendRequests")
      .withIndex("by_sender_status", (q) => q.eq("senderId", auth.user._id).eq("status", "pending"))
      .collect();

    const receiversById = await loadUsersById(ctx, requests.map((request) => request.receiverId));

    return requests.flatMap((request) => {
      const receiver = receiversById.get(request.receiverId);
      if (!receiver) return [];
      return [{
        requestId: request._id,
        senderId: auth.user._id, // Current user's id
        receiverId: receiver._id, // Receiver's id
        nickname: receiver.nickname,
        discriminator: receiver.discriminator,
        name: receiver.name,
        email: receiver.email,
        imageUrl: receiver.imageUrl,
        createdAt: request.createdAt,
      }];
    });
  },
});

/**
 * Get accepted friends list with user details
 */
export const getFriends = query({
  args: {},
  handler: async (ctx): Promise<FriendWithDetails[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    const friendships = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", auth.user._id))
      .collect();

    const friendsById = await loadUsersById(ctx, friendships.map((friendship) => friendship.friendId));

    const friendsWithDetails = friendships.flatMap((friendship) => {
      const friend = friendsById.get(friendship.friendId);
      if (!friend) return [];
      return [{
        friendshipId: friendship._id,
        friendId: friend._id,
        nickname: friend.nickname,
        discriminator: friend.discriminator,
        name: friend.name,
        email: friend.email,
        imageUrl: friend.imageUrl,
        createdAt: friendship.createdAt,
        isOnline: isUserOnline(friend.lastSeenAt),
        lastSeenAt: friend.lastSeenAt,
      }];
    });

    // Sort: online users first, then offline by most recently seen
    return friendsWithDetails.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      // Both same status, sort by lastSeenAt descending
      return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
    });
  },
});

/**
 * Send a friend request to another user
 */
export const sendFriendRequest = mutation({
  args: {
    receiverId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Can't send request to self
    if (args.receiverId === user._id) {
      throw new ConvexError({ code: "CANNOT_SELF_TARGET", message: "Cannot send friend request to yourself" });
    }

    // Check receiver exists
    const receiver = await ctx.db.get(args.receiverId);
    if (!receiver) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    // Check if already friends
    const existingFriendship = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("friendId"), args.receiverId))
      .first();

    if (existingFriendship) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Already friends with this user" });
    }

    // Check for existing pending request (either direction)
    const existingSentRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_sender_status", (q) => q.eq("senderId", user._id).eq("status", "pending"))
      .filter((q) => q.and(
        q.eq(q.field("receiverId"), args.receiverId),
        q.eq(q.field("status"), "pending")
      ))
      .first();

    if (existingSentRequest) {
      throw new ConvexError({ code: "CONFLICT", message: "Friend request already sent" });
    }

    const existingReceivedRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_receiver", (q) => q.eq("receiverId", user._id).eq("status", "pending"))
      .filter((q) => q.eq(q.field("senderId"), args.receiverId))
      .first();

    if (existingReceivedRequest) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "This user has already sent you a friend request",
      });
    }

    // Create the friend request
    const now = Date.now();
    const requestId = await ctx.db.insert("friendRequests", {
      senderId: user._id,
      receiverId: args.receiverId,
      status: "pending",
      createdAt: now,
    });

    await createFriendRequestNotification(ctx, {
      senderId: user._id,
      receiverId: args.receiverId,
      friendRequestId: requestId,
      createdAt: now,
    });

    return { requestId };
  },
});

/**
 * Accept a friend request
 */
export const acceptFriendRequest = mutation({
  args: {
    requestId: v.id("friendRequests"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    await acceptFriendRequestCore(ctx, args.requestId, user._id);

    return { success: true };
  },
});

/**
 * Reject a friend request
 */
export const rejectFriendRequest = mutation({
  args: {
    requestId: v.id("friendRequests"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    await rejectFriendRequestCore(ctx, args.requestId, user._id);

    return { success: true };
  },
});

/**
 * Remove a friend (unfriend)
 */
export const removeFriend = mutation({
  args: {
    friendId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Find and delete both directions of friendship
    const friendshipsFromUser = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const outgoingFriendship =
      friendshipsFromUser.find((friendship) => friendship.friendId === args.friendId) ?? null;

    const friendshipsToUser = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", args.friendId))
      .collect();
    const incomingFriendship =
      friendshipsToUser.find((friendship) => friendship.friendId === user._id) ?? null;

    if (!outgoingFriendship && !incomingFriendship) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Friendship not found" });
    }

    const closedGoalCount = await closeVisibleGoalsBetweenParticipants(
      ctx,
      user._id,
      args.friendId
    );

    if (outgoingFriendship) await ctx.db.delete(outgoingFriendship._id);
    if (incomingFriendship) await ctx.db.delete(incomingFriendship._id);

    return { success: true, closedGoalCount };
  },
});

/**
 * Auto-reject stale pending friend requests and dismiss related notifications.
 */
export const cleanupExpiredFriendRequests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - FRIEND_REQUEST_TTL_MS;
    const requests = await ctx.db
      .query("friendRequests")
      .withIndex("by_status_createdAt", (q) =>
        q.eq("status", "pending").lt("createdAt", cutoff)
      )
      .collect();
    const expiredPendingRequestIds = new Set<string>();

    for (const request of requests) {
      if (!isCreatedAtExpired(request.createdAt, now, FRIEND_REQUEST_TTL_MS)) continue;

      await ctx.db.patch(request._id, { status: "rejected" });
      expiredPendingRequestIds.add(String(request._id));
    }

    if (expiredPendingRequestIds.size === 0) return;

    const expiredPendingNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status_createdAt", (q) =>
        q.eq("type", "friend_request").eq("status", "pending").lt("createdAt", cutoff)
      )
      .collect();

    const expiredReadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status_createdAt", (q) =>
        q.eq("type", "friend_request").eq("status", "read").lt("createdAt", cutoff)
      )
      .collect();

    const notifications = [...expiredPendingNotifications, ...expiredReadNotifications];
    for (const notification of notifications) {
      if (!isFriendRequestPayload(notification.payload)) continue;
      if (!expiredPendingRequestIds.has(String(notification.payload.friendRequestId))) continue;

      await ctx.db.patch(notification._id, { status: "dismissed" });
    }
  },
});

export const cleanupResolvedFriendRequests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - RESOLVED_FRIEND_REQUEST_TTL_MS;
    let deletedCount = 0;

    for (const status of ["accepted", "rejected"] as const) {
      const requests = await ctx.db
        .query("friendRequests")
        .withIndex("by_status_createdAt", (q) =>
          q.eq("status", status).lt("createdAt", cutoff)
        )
        .collect();

      for (const request of requests) {
        if (
          !isResolvedFriendRequestPastRetention(
            request,
            now,
            RESOLVED_FRIEND_REQUEST_TTL_MS
          )
        ) {
          continue;
        }

        await ctx.db.delete(request._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});

export const acceptFriendRequestNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const { payload } = await requireCallerOwnedNotificationPayload(ctx, {
      notificationId: args.notificationId,
      userId: user._id,
      type: "friend_request",
      payloadGuard: isFriendRequestPayload,
      missingPayloadMessage: "Friend request ID not found in notification",
    });
    await acceptFriendRequestCore(ctx, payload.friendRequestId, user._id);

    return { success: true };
  },
});

export const rejectFriendRequestNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const { payload } = await requireCallerOwnedNotificationPayload(ctx, {
      notificationId: args.notificationId,
      userId: user._id,
      type: "friend_request",
      payloadGuard: isFriendRequestPayload,
      missingPayloadMessage: "Friend request ID not found in notification",
    });
    await rejectFriendRequestCore(ctx, payload.friendRequestId, user._id);

    return { success: true };
  },
});
