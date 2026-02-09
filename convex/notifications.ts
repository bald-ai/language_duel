import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { notificationPayloadValidator, notificationTypeValidator } from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";

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

type NotificationDoc = Doc<"notifications">;
type UserDoc = Doc<"users">;

const buildUserSummary = (user: UserDoc | null) => {
    if (!user) return null;
    return {
        nickname: user.nickname,
        discriminator: user.discriminator,
        imageUrl: user.imageUrl,
    };
};

async function enrichNotificationsWithSender(
    ctx: { db: { get: (id: Id<"users">) => Promise<UserDoc | null> } },
    notifications: NotificationDoc[]
) {
    const uniqueFromUserIds = Array.from(new Set(notifications.map((n) => n.fromUserId)));
    const users = await Promise.all(uniqueFromUserIds.map((id) => ctx.db.get(id)));
    const usersById = new Map<Id<"users">, UserDoc | null>();
    uniqueFromUserIds.forEach((id, index) => {
        usersById.set(id, users[index] ?? null);
    });

    return notifications.map((notification) => {
        const fromUser = usersById.get(notification.fromUserId) ?? null;
        return {
            ...notification,
            fromUser: buildUserSummary(fromUser),
        };
    });
}

/**
 * Get all pending/unread notifications for the current user, grouped by type
 */
export const getNotifications = query({
    args: {},
    handler: async (ctx) => {
        const auth = await getAuthenticatedUserOrNull(ctx);
        if (!auth) return [];

        const pendingNotifications = await ctx.db
            .query("notifications")
            .withIndex("by_recipient", (q) =>
                q.eq("toUserId", auth.user._id).eq("status", "pending")
            )
            .collect();

        const readNotifications = await ctx.db
            .query("notifications")
            .withIndex("by_recipient", (q) =>
                q.eq("toUserId", auth.user._id).eq("status", "read")
            )
            .collect();

        const activeNotifications = [...pendingNotifications, ...readNotifications];
        const enrichedNotifications = await enrichNotificationsWithSender(ctx, activeNotifications);

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
        const auth = await getAuthenticatedUserOrNull(ctx);
        if (!auth) return 0;

        // Count pending notifications
        const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_recipient", (q) =>
                q.eq("toUserId", auth.user._id).eq("status", "pending")
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
        type: notificationTypeValidator,
    },
    handler: async (ctx, args) => {
        const auth = await getAuthenticatedUserOrNull(ctx);
        if (!auth) return [];

        const pendingNotifications = await ctx.db
            .query("notifications")
            .withIndex("by_type_status", (q) =>
                q.eq("type", args.type).eq("toUserId", auth.user._id).eq("status", "pending")
            )
            .collect();

        const readNotifications = await ctx.db
            .query("notifications")
            .withIndex("by_type_status", (q) =>
                q.eq("type", args.type).eq("toUserId", auth.user._id).eq("status", "read")
            )
            .collect();

        const activeNotifications = [...pendingNotifications, ...readNotifications];
        const enrichedNotifications = await enrichNotificationsWithSender(ctx, activeNotifications);

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
        type: notificationTypeValidator,
        fromUserId: v.id("users"),
        toUserId: v.id("users"),
        payload: v.optional(notificationPayloadValidator),
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
        const { user } = await getAuthenticatedUser(ctx);

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
        const { user } = await getAuthenticatedUser(ctx);

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
