import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
    createInitialWordStates,
    determineInitialLevelSeeded,
    determineLevel2ModeSeeded,
    initializeWordPoolsSeeded,
} from "./helpers/gameLogic";

// ===========================================
// Notification Type Definitions
// ===========================================

export type NotificationType =
    | "friend_request"
    | "weekly_plan_invitation"
    | "scheduled_duel"
    | "duel_challenge";

export type NotificationStatus = "pending" | "read" | "dismissed";

// ===========================================
// Queries
// ===========================================

/**
 * Get all pending/unread notifications for the current user, grouped by type
 */
export const getNotifications = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        // Get all non-dismissed notifications for this user
        const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_recipient", (q) =>
                q.eq("toUserId", user._id)
            )
            .collect();

        // Filter out dismissed notifications and enrich with sender info
        const activeNotifications = notifications.filter(n => n.status !== "dismissed");

        const enrichedNotifications = await Promise.all(
            activeNotifications.map(async (notification) => {
                const fromUser = await ctx.db.get(notification.fromUserId);
                return {
                    ...notification,
                    fromUser: fromUser ? {
                        nickname: fromUser.nickname,
                        discriminator: fromUser.discriminator,
                        imageUrl: fromUser.imageUrl,
                    } : null,
                };
            })
        );

        // Sort by createdAt descending (newest first)
        return enrichedNotifications.sort((a, b) => b.createdAt - a.createdAt);
    },
});

/**
 * Get total count of unread notifications for badge display
 */
export const getNotificationCount = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return 0;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return 0;
        }

        // Count pending notifications
        const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_recipient", (q) =>
                q.eq("toUserId", user._id).eq("status", "pending")
            )
            .collect();

        return notifications.length;
    },
});

/**
 * Get notifications filtered by specific type
 */
export const getNotificationsByType = query({
    args: {
        type: v.union(
            v.literal("friend_request"),
            v.literal("weekly_plan_invitation"),
            v.literal("scheduled_duel"),
            v.literal("duel_challenge")
        ),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return [];
        }

        const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_type", (q) =>
                q.eq("type", args.type).eq("toUserId", user._id)
            )
            .collect();

        // Filter out dismissed and enrich with sender info
        const activeNotifications = notifications.filter(n => n.status !== "dismissed");

        const enrichedNotifications = await Promise.all(
            activeNotifications.map(async (notification) => {
                const fromUser = await ctx.db.get(notification.fromUserId);
                return {
                    ...notification,
                    fromUser: fromUser ? {
                        nickname: fromUser.nickname,
                        discriminator: fromUser.discriminator,
                        imageUrl: fromUser.imageUrl,
                    } : null,
                };
            })
        );

        return enrichedNotifications.sort((a, b) => b.createdAt - a.createdAt);
    },
});

// ===========================================
// Mutations
// ===========================================

/**
 * Internal helper to create notifications (used by other modules)
 */
export const createNotification = internalMutation({
    args: {
        type: v.union(
            v.literal("friend_request"),
            v.literal("weekly_plan_invitation"),
            v.literal("scheduled_duel"),
            v.literal("duel_challenge")
        ),
        fromUserId: v.id("users"),
        toUserId: v.id("users"),
        payload: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const notificationId = await ctx.db.insert("notifications", {
            type: args.type,
            fromUserId: args.fromUserId,
            toUserId: args.toUserId,
            status: "pending",
            payload: args.payload,
            createdAt: Date.now(),
        });

        return notificationId;
    },
});

/**
 * Dismiss a notification (removes from list)
 */
export const dismissNotification = mutation({
    args: {
        notificationId: v.id("notifications"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        const notification = await ctx.db.get(args.notificationId);
        if (!notification) {
            throw new Error("Notification not found");
        }

        if (notification.toUserId !== user._id) {
            throw new Error("Not authorized to dismiss this notification");
        }

        await ctx.db.patch(args.notificationId, {
            status: "dismissed",
        });
    },
});

/**
 * Mark notification as read without dismissing
 */
export const markNotificationRead = mutation({
    args: {
        notificationId: v.id("notifications"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        const notification = await ctx.db.get(args.notificationId);
        if (!notification) {
            throw new Error("Notification not found");
        }

        if (notification.toUserId !== user._id) {
            throw new Error("Not authorized to modify this notification");
        }

        await ctx.db.patch(args.notificationId, {
            status: "read",
        });
    },
});

/**
 * Accept friend request and dismiss notification
 */
export const acceptFriendRequestNotification = mutation({
    args: {
        notificationId: v.id("notifications"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

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

        // Get the friend request ID from payload
        const friendRequestId = notification.payload?.friendRequestId as Id<"friendRequests"> | undefined;
        if (!friendRequestId) {
            throw new Error("Friend request ID not found in notification");
        }

        const friendRequest = await ctx.db.get(friendRequestId);
        if (!friendRequest) {
            throw new Error("Friend request not found");
        }

        if (friendRequest.status !== "pending") {
            throw new Error("Friend request is no longer pending");
        }

        // Accept the friend request
        await ctx.db.patch(friendRequestId, {
            status: "accepted",
        });

        // Create bidirectional friendship
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

        // Dismiss the notification
        await ctx.db.patch(args.notificationId, {
            status: "dismissed",
        });

        return { success: true };
    },
});

/**
 * Reject friend request and dismiss notification
 */
export const rejectFriendRequestNotification = mutation({
    args: {
        notificationId: v.id("notifications"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

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

        // Get the friend request ID from payload
        const friendRequestId = notification.payload?.friendRequestId as Id<"friendRequests"> | undefined;
        if (!friendRequestId) {
            throw new Error("Friend request ID not found in notification");
        }

        const friendRequest = await ctx.db.get(friendRequestId);
        if (!friendRequest) {
            throw new Error("Friend request not found");
        }

        // Reject the friend request
        await ctx.db.patch(friendRequestId, {
            status: "rejected",
        });

        // Dismiss the notification
        await ctx.db.patch(args.notificationId, {
            status: "dismissed",
        });

        return { success: true };
    },
});

/**
 * Accept duel challenge and dismiss notification
 */
export const acceptDuelChallenge = mutation({
    args: {
        notificationId: v.id("notifications"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        const notification = await ctx.db.get(args.notificationId);
        if (!notification) {
            throw new Error("Notification not found");
        }

        if (notification.toUserId !== user._id) {
            throw new Error("Not authorized");
        }

        if (notification.type !== "duel_challenge") {
            throw new Error("Invalid notification type");
        }

        // Get challenge ID from payload
        const challengeId = notification.payload?.challengeId as Id<"challenges"> | undefined;
        if (!challengeId) {
            throw new Error("Challenge ID not found in notification");
        }

        const challenge = await ctx.db.get(challengeId);
        if (!challenge) {
            throw new Error("Challenge not found");
        }

        if (challenge.status !== "pending") {
            throw new Error("Challenge is no longer pending");
        }

        // Accept the challenge with the same initialization as lobby.acceptDuel
        const theme = await ctx.db.get(challenge.themeId);
        if (!theme) {
            throw new Error("Theme not found");
        }

        const wordCount = theme.words.length;
        let seed = Date.now() ^ 0xdeadbeef;

        if (challenge.mode === "classic") {
            await ctx.db.patch(challengeId, {
                status: "accepted",
                questionStartTime: Date.now(),
                seed,
            });
        } else {
            const challengerPoolsResult = initializeWordPoolsSeeded(wordCount, seed);
            seed = challengerPoolsResult.newSeed;

            const opponentPoolsResult = initializeWordPoolsSeeded(wordCount, seed);
            seed = opponentPoolsResult.newSeed;

            const wordStates = createInitialWordStates(wordCount);

            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const challengerFirstWord =
                challengerPoolsResult.activePool[
                    Math.floor((seed / 0x7fffffff) * challengerPoolsResult.activePool.length)
                ];

            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const opponentFirstWord =
                opponentPoolsResult.activePool[
                    Math.floor((seed / 0x7fffffff) * opponentPoolsResult.activePool.length)
                ];

            const challengerLevel = determineInitialLevelSeeded(seed);
            seed = challengerLevel.newSeed;

            const challengerL2Mode = determineLevel2ModeSeeded(seed);
            seed = challengerL2Mode.newSeed;

            const opponentLevel = determineInitialLevelSeeded(seed);
            seed = opponentLevel.newSeed;

            const opponentL2Mode = determineLevel2ModeSeeded(seed);
            seed = opponentL2Mode.newSeed;

            await ctx.db.patch(challengeId, {
                status: "challenging",
                questionStartTime: Date.now(),
                seed,
                // Challenger state
                challengerWordStates: wordStates,
                challengerActivePool: challengerPoolsResult.activePool,
                challengerRemainingPool: challengerPoolsResult.remainingPool,
                challengerCurrentWordIndex: challengerFirstWord,
                challengerCurrentLevel: challengerLevel.level,
                challengerLevel2Mode: challengerL2Mode.mode,
                challengerCompleted: false,
                challengerStats: { questionsAnswered: 0, correctAnswers: 0 },
                // Opponent state
                opponentWordStates: [...wordStates],
                opponentActivePool: opponentPoolsResult.activePool,
                opponentRemainingPool: opponentPoolsResult.remainingPool,
                opponentCurrentWordIndex: opponentFirstWord,
                opponentCurrentLevel: opponentLevel.level,
                opponentLevel2Mode: opponentL2Mode.mode,
                opponentCompleted: false,
                opponentStats: { questionsAnswered: 0, correctAnswers: 0 },
            });
        }

        // Dismiss the notification
        await ctx.db.patch(args.notificationId, {
            status: "dismissed",
        });

        return { success: true, challengeId };
    },
});

/**
 * Decline duel challenge and dismiss notification
 */
export const declineDuelChallenge = mutation({
    args: {
        notificationId: v.id("notifications"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        const notification = await ctx.db.get(args.notificationId);
        if (!notification) {
            throw new Error("Notification not found");
        }

        if (notification.toUserId !== user._id) {
            throw new Error("Not authorized");
        }

        if (notification.type !== "duel_challenge") {
            throw new Error("Invalid notification type");
        }

        // Get challenge ID from payload
        const challengeId = notification.payload?.challengeId as Id<"challenges"> | undefined;
        if (!challengeId) {
            throw new Error("Challenge ID not found in notification");
        }

        const challenge = await ctx.db.get(challengeId);
        if (!challenge) {
            throw new Error("Challenge not found");
        }

        // Reject the challenge
        await ctx.db.patch(challengeId, {
            status: "rejected",
        });

        // Dismiss the notification
        await ctx.db.patch(args.notificationId, {
            status: "dismissed",
        });

        return { success: true };
    },
});

/**
 * Dismiss weekly plan invitation without action
 */
export const dismissWeeklyPlanInvitation = mutation({
    args: {
        notificationId: v.id("notifications"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            throw new Error("User not found");
        }

        const notification = await ctx.db.get(args.notificationId);
        if (!notification) {
            throw new Error("Notification not found");
        }

        if (notification.toUserId !== user._id) {
            throw new Error("Not authorized");
        }

        if (notification.type !== "weekly_plan_invitation") {
            throw new Error("Invalid notification type");
        }

        // Just dismiss the notification
        await ctx.db.patch(args.notificationId, {
            status: "dismissed",
        });

        return { success: true };
    },
});
