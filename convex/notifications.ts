import { ConvexError, v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { toUserSummary } from "./helpers/userSummary";
import { DISMISSED_NOTIFICATION_TTL_MS } from "./constants";
import {
    DISMISSABLE_NOTIFICATION_TYPES,
    isDismissedNotificationPastRetention,
} from "../lib/cleanupRetention";

// ===========================================
// Queries
// ===========================================

type NotificationDoc = Doc<"notifications">;
type UserDoc = Doc<"users">;

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
            fromUser: toUserSummary(fromUser),
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

        const [pendingNotifications, readNotifications] = await Promise.all([
            ctx.db
                .query("notifications")
                .withIndex("by_recipient", (q) =>
                    q.eq("toUserId", auth.user._id).eq("status", "pending")
                )
                .collect(),
            ctx.db
                .query("notifications")
                .withIndex("by_recipient", (q) =>
                    q.eq("toUserId", auth.user._id).eq("status", "read")
                )
                .collect(),
        ]);

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

// ===========================================
// Mutations
// ===========================================

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
            throw new ConvexError({ code: "NOT_FOUND", message: "Notification not found" });
        }

        if (notification.toUserId !== user._id) {
            throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized to dismiss this notification" });
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
            throw new ConvexError({ code: "NOT_FOUND", message: "Notification not found" });
        }

        if (notification.toUserId !== user._id) {
            throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized to modify this notification" });
        }

        await ctx.db.patch(args.notificationId, {
            status: "read",
        });
    },
});

export const cleanupDismissedNotifications = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const cutoff = now - DISMISSED_NOTIFICATION_TTL_MS;
        let deletedCount = 0;

        for (const type of DISMISSABLE_NOTIFICATION_TYPES) {
            const notifications = await ctx.db
                .query("notifications")
                .withIndex("by_type_status_createdAt", (q) =>
                    q.eq("type", type).eq("status", "dismissed").lt("createdAt", cutoff)
                )
                .collect();

            for (const notification of notifications) {
                if (
                    !isDismissedNotificationPastRetention(
                        notification,
                        now,
                        DISMISSED_NOTIFICATION_TTL_MS
                    )
                ) {
                    continue;
                }

                await ctx.db.delete(notification._id);
                deletedCount++;
            }
        }

        return { deletedCount };
    },
});
