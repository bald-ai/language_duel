import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { isUserOnline } from "./users";
import { isFriendRequestPayload } from "./notificationPayloads";
import { FRIEND_REQUEST_TTL_MS } from "./constants";
import { isCreatedAtExpired } from "../lib/cleanupExpiry";

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

// Friend request with sender details (for received requests)
export type FriendRequestWithDetails = {
  requestId: Id<"friendRequests">;
  senderId: Id<"users">;
  nickname?: string;
  discriminator?: number;
  name?: string;
  email: string;
  imageUrl?: string;
  createdAt: number;
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

type UserDoc = Doc<"users">;

async function loadUsersById(
  ctx: { db: { get: (id: Id<"users">) => Promise<UserDoc | null> } },
  userIds: Id<"users">[]
) {
  const uniqueIds = Array.from(new Set(userIds));
  const users = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
  const usersById = new Map<Id<"users">, UserDoc | null>();
  uniqueIds.forEach((id, index) => {
    usersById.set(id, users[index] ?? null);
  });
  return usersById;
}

/**
 * Get pending friend requests received by current user
 */
export const getFriendRequests = query({
  args: {},
  handler: async (ctx): Promise<FriendRequestWithDetails[]> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    const requests = await ctx.db
      .query("friendRequests")
      .withIndex("by_receiver", (q) => q.eq("receiverId", auth.user._id).eq("status", "pending"))
      .collect();

    const sendersById = await loadUsersById(ctx, requests.map((request) => request.senderId));

    return requests.flatMap((request) => {
      const sender = sendersById.get(request.senderId);
      if (!sender) return [];
      return [{
        requestId: request._id,
        senderId: sender._id,
        nickname: sender.nickname,
        discriminator: sender.discriminator,
        name: sender.name,
        email: sender.email,
        imageUrl: sender.imageUrl,
        createdAt: request.createdAt,
      }];
    });
  },
});

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
 * Check friendship status between current user and another user
 */
export const getFriendshipStatus = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<"friends" | "pending_sent" | "pending_received" | "none"> => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return "none";

    // Check if already friends
    const friendship = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", auth.user._id))
      .filter((q) => q.eq(q.field("friendId"), args.userId))
      .first();

    if (friendship) return "friends";

    // Check for pending request sent by current user
    const sentRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_sender_status", (q) => q.eq("senderId", auth.user._id).eq("status", "pending"))
      .filter((q) => q.and(
        q.eq(q.field("receiverId"), args.userId),
        q.eq(q.field("status"), "pending")
      ))
      .first();

    if (sentRequest) return "pending_sent";

    // Check for pending request received from other user
    const receivedRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_receiver", (q) => q.eq("receiverId", auth.user._id).eq("status", "pending"))
      .filter((q) => q.eq(q.field("senderId"), args.userId))
      .first();

    if (receivedRequest) return "pending_received";

    return "none";
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
      throw new Error("Cannot send friend request to yourself");
    }

    // Check receiver exists
    const receiver = await ctx.db.get(args.receiverId);
    if (!receiver) {
      throw new Error("User not found");
    }

    // Check if already friends
    const existingFriendship = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("friendId"), args.receiverId))
      .first();

    if (existingFriendship) {
      throw new Error("Already friends with this user");
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
      throw new Error("Friend request already sent");
    }

    const existingReceivedRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_receiver", (q) => q.eq("receiverId", user._id).eq("status", "pending"))
      .filter((q) => q.eq(q.field("senderId"), args.receiverId))
      .first();

    if (existingReceivedRequest) {
      throw new Error("This user has already sent you a friend request");
    }

    // Create the friend request
    const now = Date.now();
    const requestId = await ctx.db.insert("friendRequests", {
      senderId: user._id,
      receiverId: args.receiverId,
      status: "pending",
      createdAt: now,
    });

    // Create notification for the receiver
    await ctx.db.insert("notifications", {
      type: "friend_request",
      fromUserId: user._id,
      toUserId: args.receiverId,
      status: "pending",
      payload: {
        friendRequestId: requestId,
      },
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

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Friend request not found");
    }

    if (request.receiverId !== user._id) {
      throw new Error("Cannot accept this friend request");
    }

    if (request.status !== "pending") {
      throw new Error("Friend request is no longer pending");
    }

    // Update request status
    await ctx.db.patch(args.requestId, { status: "accepted" });

    // Dismiss any related friend request notifications for this request
    const pendingNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status", (q) =>
        q.eq("type", "friend_request").eq("toUserId", user._id).eq("status", "pending")
      )
      .collect();

    const readNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status", (q) =>
        q.eq("type", "friend_request").eq("toUserId", user._id).eq("status", "read")
      )
      .collect();

    const notifications = [...pendingNotifications, ...readNotifications];

    for (const notification of notifications) {
      if (
        isFriendRequestPayload(notification.payload) &&
        notification.payload.friendRequestId === args.requestId
      ) {
        await ctx.db.patch(notification._id, { status: "dismissed" });
      }
    }

    // Create bidirectional friendship
    const now = Date.now();
    await ctx.db.insert("friends", {
      userId: user._id,
      friendId: request.senderId,
      createdAt: now,
    });
    await ctx.db.insert("friends", {
      userId: request.senderId,
      friendId: user._id,
      createdAt: now,
    });

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

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Friend request not found");
    }

    if (request.receiverId !== user._id) {
      throw new Error("Cannot reject this friend request");
    }

    if (request.status !== "pending") {
      throw new Error("Friend request is no longer pending");
    }

    // Update request status
    await ctx.db.patch(args.requestId, { status: "rejected" });

    // Dismiss any related friend request notifications for this request
    const pendingNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status", (q) =>
        q.eq("type", "friend_request").eq("toUserId", user._id).eq("status", "pending")
      )
      .collect();

    const readNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status", (q) =>
        q.eq("type", "friend_request").eq("toUserId", user._id).eq("status", "read")
      )
      .collect();

    const notifications = [...pendingNotifications, ...readNotifications];

    for (const notification of notifications) {
      if (
        isFriendRequestPayload(notification.payload) &&
        notification.payload.friendRequestId === args.requestId
      ) {
        await ctx.db.patch(notification._id, { status: "dismissed" });
      }
    }

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
    const friendship1 = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("friendId"), args.friendId))
      .first();

    const friendship2 = await ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", args.friendId))
      .filter((q) => q.eq(q.field("friendId"), user._id))
      .first();

    if (!friendship1 && !friendship2) {
      throw new Error("Friendship not found");
    }

    if (friendship1) await ctx.db.delete(friendship1._id);
    if (friendship2) await ctx.db.delete(friendship2._id);

    return { success: true };
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

export const acceptFriendRequestNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.toUserId !== user._id) {
      throw new Error("Not authorized");
    }

    if (notification.type !== "friend_request") {
      throw new Error("Invalid notification type");
    }

    const payload = notification.payload;
    if (!isFriendRequestPayload(payload)) {
      throw new Error("Friend request ID not found in notification");
    }
    const friendRequestId = payload.friendRequestId;

    const friendRequest = await ctx.db.get(friendRequestId);
    if (!friendRequest) {
      throw new Error("Friend request not found");
    }

    if (friendRequest.status !== "pending") {
      throw new Error("Friend request is no longer pending");
    }

    await ctx.db.patch(friendRequestId, {
      status: "accepted",
    });

    const now = Date.now();
    await ctx.db.insert("friends", {
      userId: friendRequest.senderId,
      friendId: friendRequest.receiverId,
      createdAt: now,
    });
    await ctx.db.insert("friends", {
      userId: friendRequest.receiverId,
      friendId: friendRequest.senderId,
      createdAt: now,
    });

    await ctx.db.patch(args.notificationId, {
      status: "dismissed",
    });

    return { success: true };
  },
});

export const rejectFriendRequestNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.toUserId !== user._id) {
      throw new Error("Not authorized");
    }

    if (notification.type !== "friend_request") {
      throw new Error("Invalid notification type");
    }

    const payload = notification.payload;
    if (!isFriendRequestPayload(payload)) {
      throw new Error("Friend request ID not found in notification");
    }
    const friendRequestId = payload.friendRequestId;

    const friendRequest = await ctx.db.get(friendRequestId);
    if (!friendRequest) {
      throw new Error("Friend request not found");
    }

    await ctx.db.patch(friendRequestId, {
      status: "rejected",
    });

    await ctx.db.patch(args.notificationId, {
      status: "dismissed",
    });

    return { success: true };
  },
});
