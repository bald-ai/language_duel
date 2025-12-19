import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";

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

    const requestsWithDetails: FriendRequestWithDetails[] = [];

    for (const request of requests) {
      const sender = await ctx.db.get(request.senderId);
      if (sender) {
        requestsWithDetails.push({
          requestId: request._id,
          senderId: sender._id,
          nickname: sender.nickname,
          discriminator: sender.discriminator,
          name: sender.name,
          email: sender.email,
          imageUrl: sender.imageUrl,
          createdAt: request.createdAt,
        });
      }
    }

    return requestsWithDetails;
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
      .withIndex("by_sender", (q) => q.eq("senderId", auth.user._id))
      .collect();

    const pendingRequests = requests.filter((r) => r.status === "pending");
    const requestsWithDetails: SentRequestWithDetails[] = [];

    for (const request of pendingRequests) {
      const receiver = await ctx.db.get(request.receiverId);
      if (receiver) {
        requestsWithDetails.push({
          requestId: request._id,
          senderId: auth.user._id, // Current user's id
          receiverId: receiver._id, // Receiver's id
          nickname: receiver.nickname,
          discriminator: receiver.discriminator,
          name: receiver.name,
          email: receiver.email,
          imageUrl: receiver.imageUrl,
          createdAt: request.createdAt,
        });
      }
    }

    return requestsWithDetails;
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

    const friendsWithDetails: FriendWithDetails[] = [];

    for (const friendship of friendships) {
      const friend = await ctx.db.get(friendship.friendId);
      if (friend) {
        friendsWithDetails.push({
          friendshipId: friendship._id,
          friendId: friend._id,
          nickname: friend.nickname,
          discriminator: friend.discriminator,
          name: friend.name,
          email: friend.email,
          imageUrl: friend.imageUrl,
          createdAt: friendship.createdAt,
        });
      }
    }

    return friendsWithDetails;
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
      .withIndex("by_sender", (q) => q.eq("senderId", auth.user._id))
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
      .withIndex("by_sender", (q) => q.eq("senderId", user._id))
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
    const requestId = await ctx.db.insert("friendRequests", {
      senderId: user._id,
      receiverId: args.receiverId,
      status: "pending",
      createdAt: Date.now(),
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
