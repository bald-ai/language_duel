import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { isScheduledDuelPayload } from "./notificationPayloads";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import {
    buildChallengeBase,
    buildChallengeStartState,
} from "./helpers/challengeCreation";
import {
    getScheduledDuelThemes,
} from "./helpers/sessionWords";
import { TERMINAL_SCHEDULED_DUEL_TTL_MS } from "./constants";
import {
    isStartedScheduledDuelPastRetention,
    isTerminalScheduledDuelPastRetention,
} from "../lib/cleanupRetention";
import { summarizeThemes } from "../lib/sessionWords";

type ThemeRecord = Doc<"themes">;

// ===========================================
// Type Definitions
// ===========================================

export type ScheduledDuelStatus =
    | "pending"
    | "accepted"
    | "counter_proposed"
    | "declined"
    | "cancelled"
    | "expired";

// ===========================================
// Queries
// ===========================================

/**
 * Get all scheduled duels for current user (as proposer or recipient)
 */
export const getScheduledDuels = query({
    args: {},
    handler: async (ctx) => {
        const auth = await getAuthenticatedUserOrNull(ctx);
        if (!auth) {
            return [];
        }
        const user = auth.user;

        // Get duels where user is proposer
        const asProposer = await ctx.db
            .query("scheduledDuels")
            .withIndex("by_proposer", (q) => q.eq("proposerId", user._id))
            .collect();

        // Get duels where user is recipient
        const asRecipient = await ctx.db
            .query("scheduledDuels")
            .withIndex("by_recipient", (q) => q.eq("recipientId", user._id))
            .collect();

        // Combine and deduplicate
        const allDuels = [...asProposer, ...asRecipient];
        const uniqueDuels = Array.from(
            new Map(allDuels.map((duel) => [duel._id, duel])).values()
        );

        // Enrich with user and theme info
        const enrichedDuels = await Promise.all(
            uniqueDuels.map(async (duel) => {
                const proposer = await ctx.db.get(duel.proposerId);
                const recipient = await ctx.db.get(duel.recipientId);
                const themes = await getScheduledDuelThemes(ctx, duel);
                const themeSummary = summarizeThemes(themes);

                return {
                    ...duel,
                    proposer: proposer ? {
                        _id: proposer._id,
                        nickname: proposer.nickname,
                        discriminator: proposer.discriminator,
                        imageUrl: proposer.imageUrl,
                    } : null,
                    recipient: recipient ? {
                        _id: recipient._id,
                        nickname: recipient.nickname,
                        discriminator: recipient.discriminator,
                        imageUrl: recipient.imageUrl,
                    } : null,
                    theme: themes.length === 1 ? {
                        _id: themes[0]._id,
                        name: themes[0].name,
                    } : null,
                    themes: themes.map((theme) => ({
                        _id: theme._id,
                        name: theme.name,
                    })),
                    themeSummary,
                    isProposer: duel.proposerId === user._id,
                };
            })
        );

        // Sort by scheduled time ascending
        return enrichedDuels.sort((a, b) => a.scheduledTime - b.scheduledTime);
    },
});

/**
 * Get specific scheduled duel details
 */
export const getScheduledDuelById = query({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
    },
    handler: async (ctx, args) => {
        const auth = await getAuthenticatedUserOrNull(ctx);
        if (!auth) {
            return null;
        }
        const user = auth.user;

        const duel = await ctx.db.get(args.scheduledDuelId);
        if (!duel) {
            return null;
        }

        // Verify user is part of this duel
        if (duel.proposerId !== user._id && duel.recipientId !== user._id) {
            return null;
        }

        const proposer = await ctx.db.get(duel.proposerId);
        const recipient = await ctx.db.get(duel.recipientId);
        const themes = await getScheduledDuelThemes(ctx, duel);
        const themeSummary = summarizeThemes(themes);

        return {
            ...duel,
            proposer: proposer ? {
                _id: proposer._id,
                nickname: proposer.nickname,
                discriminator: proposer.discriminator,
                imageUrl: proposer.imageUrl,
            } : null,
            recipient: recipient ? {
                _id: recipient._id,
                nickname: recipient.nickname,
                discriminator: recipient.discriminator,
                imageUrl: recipient.imageUrl,
            } : null,
            theme: themes.length === 1 ? {
                _id: themes[0]._id,
                name: themes[0].name,
            } : null,
            themes: themes.map((theme) => ({
                _id: theme._id,
                name: theme.name,
            })),
            themeSummary,
            isProposer: duel.proposerId === user._id,
        };
    },
});

// ===========================================
// Mutations
// ===========================================

/**
 * Propose a scheduled duel to a friend
 */
export const proposeScheduledDuel = mutation({
    args: {
        recipientId: v.id("users"),
        themeIds: v.array(v.id("themes")),
        scheduledTime: v.number(),
        mode: v.union(v.literal("solo"), v.literal("classic")),
        classicDifficultyPreset: v.optional(
            v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))
        ),
    },
    handler: async (
        ctx,
        args
    ): Promise<{ success: true; scheduledDuelId: Id<"scheduledDuels"> }> => {
        const { user } = await getAuthenticatedUser(ctx);

        // Validate scheduled time is in the future
        if (args.scheduledTime <= Date.now()) {
            throw new Error("Scheduled time must be in the future");
        }

        // Validate recipient exists and is a friend
        const recipient = await ctx.db.get(args.recipientId);
        if (!recipient) {
            throw new Error("Recipient not found");
        }

        // Check friendship
        const friendship = await ctx.db
            .query("friends")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .filter((q) => q.eq(q.field("friendId"), args.recipientId))
            .unique();

        if (!friendship) {
            throw new Error("Recipient is not a friend");
        }

        // Validate theme exists and proposer can access it
        const uniqueThemeIds = Array.from(new Set(args.themeIds));
        if (uniqueThemeIds.length === 0) {
            throw new Error("Select at least one theme");
        }
        const themes: Array<ThemeRecord | null> = await Promise.all(
            uniqueThemeIds.map((themeId) =>
                ctx.runQuery(api.themes.getTheme, {
                    themeId,
                })
            )
        );
        if (themes.some((theme) => !theme)) {
            throw new Error("One or more themes were not found or are not accessible");
        }
        const resolvedThemes: ThemeRecord[] = themes.filter(
            (theme): theme is ThemeRecord => theme !== null
        );
        const themeSummary: string = summarizeThemes(resolvedThemes);

        const now = Date.now();

        // Create scheduled duel
        const scheduledDuelId: Id<"scheduledDuels"> = await ctx.db.insert("scheduledDuels", {
            proposerId: user._id,
            recipientId: args.recipientId,
            themeIds: resolvedThemes.map((theme) => theme._id),
            scheduledTime: args.scheduledTime,
            status: "pending",
            mode: args.mode,
            classicDifficultyPreset: args.classicDifficultyPreset,
            createdAt: now,
            updatedAt: now,
        });

        // Create notification for recipient
        await ctx.db.insert("notifications", {
            type: "scheduled_duel",
            fromUserId: user._id,
            toUserId: args.recipientId,
            status: "pending",
            payload: {
                scheduledDuelId,
                themeId: resolvedThemes.length === 1 ? resolvedThemes[0]._id : undefined,
                themeName: themeSummary,
                scheduledTime: args.scheduledTime,
                mode: args.mode,
            },
            createdAt: now,
        });

        await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
            trigger: "scheduled_duel_proposal",
            toUserId: args.recipientId,
            fromUserId: user._id,
            scheduledDuelId,
        });

        return { success: true, scheduledDuelId };
    },
});

/**
 * Accept a scheduled duel proposal
 */
export const acceptScheduledDuel = mutation({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
    },
    handler: async (ctx, args) => {
        const { user } = await getAuthenticatedUser(ctx);

        const scheduledDuel = await ctx.db.get(args.scheduledDuelId);
        if (!scheduledDuel) {
            throw new Error("Scheduled duel not found");
        }

        if (scheduledDuel.recipientId !== user._id) {
            throw new Error("Not authorized to accept this duel");
        }

        if (scheduledDuel.status !== "pending" && scheduledDuel.status !== "counter_proposed") {
            throw new Error("Duel is no longer pending");
        }

        const themes = await getScheduledDuelThemes(ctx, scheduledDuel);
        const themeSummary = summarizeThemes(themes);
        const now = Date.now();

        // Update status to accepted and initialize ready fields
        await ctx.db.patch(args.scheduledDuelId, {
            status: "accepted",
            updatedAt: now,
            proposerReady: false,
            recipientReady: false,
            proposerReadyAt: undefined,
            recipientReadyAt: undefined,
        });

        // Update recipient's notification payload to reflect accepted status
        const recipientNotifications = await ctx.db
            .query("notifications")
            .withIndex("by_type", (q) =>
                q.eq("type", "scheduled_duel").eq("toUserId", user._id)
            )
            .collect();

        for (const notification of recipientNotifications) {
            if (
                isScheduledDuelPayload(notification.payload) &&
                notification.payload.scheduledDuelId === args.scheduledDuelId
            ) {
                await ctx.db.patch(notification._id, {
                    status: "read", // Mark as read so it doesn't count as unread for accepter
                    payload: {
                        ...notification.payload,
                        scheduledDuelStatus: "accepted",
                    },
                });
            }
        }

        // Create notification for proposer so they see the accepted duel
        await ctx.db.insert("notifications", {
            type: "scheduled_duel",
            fromUserId: user._id,
            toUserId: scheduledDuel.proposerId,
            status: "pending",
            payload: {
                scheduledDuelId: args.scheduledDuelId,
                themeId: themes.length === 1 ? themes[0]._id : undefined,
                themeName: themeSummary,
                scheduledTime: scheduledDuel.scheduledTime,
                mode: scheduledDuel.mode,
                scheduledDuelStatus: "accepted",
            },
            createdAt: now,
        });

        await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
            trigger: "scheduled_duel_accepted",
            toUserId: scheduledDuel.proposerId,
            fromUserId: user._id,
            scheduledDuelId: args.scheduledDuelId,
        });

        return { success: true };
    },
});

/**
 * Counter-propose a scheduled duel with modified time/theme
 */
export const counterProposeScheduledDuel = mutation({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
        newScheduledTime: v.optional(v.number()),
        newThemeIds: v.optional(v.array(v.id("themes"))),
    },
    handler: async (ctx, args) => {
        const { user } = await getAuthenticatedUser(ctx);

        const scheduledDuel = await ctx.db.get(args.scheduledDuelId);
        if (!scheduledDuel) {
            throw new Error("Scheduled duel not found");
        }

        // Either party can counter-propose
        if (scheduledDuel.proposerId !== user._id && scheduledDuel.recipientId !== user._id) {
            throw new Error("Not authorized");
        }

        if (scheduledDuel.status === "declined" || scheduledDuel.status === "accepted" || scheduledDuel.status === "cancelled" || scheduledDuel.status === "expired") {
            throw new Error("Cannot counter-propose on this duel");
        }

        const updates: {
            status: "counter_proposed";
            updatedAt: number;
            scheduledTime?: number;
            themeIds?: typeof scheduledDuel.themeIds;
            proposerId: typeof scheduledDuel.proposerId;
            recipientId: typeof scheduledDuel.recipientId;
        } = {
            status: "counter_proposed",
            updatedAt: Date.now(),
            // Swap proposer and recipient for counter-proposal
            proposerId: user._id,
            recipientId: user._id === scheduledDuel.proposerId
                ? scheduledDuel.recipientId
                : scheduledDuel.proposerId,
        };

        if (args.newScheduledTime !== undefined) {
            if (args.newScheduledTime <= Date.now()) {
                throw new Error("Scheduled time must be in the future");
            }
            updates.scheduledTime = args.newScheduledTime;
        }

        if (args.newThemeIds !== undefined) {
            const uniqueThemeIds = Array.from(new Set(args.newThemeIds));
            if (uniqueThemeIds.length === 0) {
                throw new Error("Select at least one theme");
            }
            const themes: Array<ThemeRecord | null> = await Promise.all(
                uniqueThemeIds.map((themeId) =>
                    ctx.runQuery(api.themes.getTheme, {
                        themeId,
                    })
                )
            );
            if (themes.some((theme) => !theme)) {
                throw new Error("One or more themes were not found or are not accessible");
            }
            updates.themeIds = themes
                .filter((theme): theme is ThemeRecord => theme !== null)
                .map((theme) => theme._id);
        }

        await ctx.db.patch(args.scheduledDuelId, updates);

        // Create notification for the other party
        const otherUserId = user._id === scheduledDuel.proposerId
            ? scheduledDuel.recipientId
            : scheduledDuel.proposerId;

        const themeIdsForNotification = updates.themeIds ?? scheduledDuel.themeIds;
        const themesForNotification = await Promise.all(
            themeIdsForNotification.map((themeId) => ctx.db.get(themeId))
        );
        const validThemes = themesForNotification.filter((theme): theme is ThemeRecord => theme !== null);
        const themeSummary = summarizeThemes(validThemes);

        await ctx.db.insert("notifications", {
            type: "scheduled_duel",
            fromUserId: user._id,
            toUserId: otherUserId,
            status: "pending",
            payload: {
                scheduledDuelId: args.scheduledDuelId,
                themeId: validThemes.length === 1 ? validThemes[0]._id : undefined,
                themeName: themeSummary,
                scheduledTime: updates.scheduledTime || scheduledDuel.scheduledTime,
                mode: scheduledDuel.mode,
                isCounterProposal: true,
            },
            createdAt: Date.now(),
        });

        await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
            trigger: "scheduled_duel_counter_proposed",
            toUserId: otherUserId,
            fromUserId: user._id,
            scheduledDuelId: args.scheduledDuelId,
        });

        // Dismiss old notification for current user
        const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_type", (q) =>
                q.eq("type", "scheduled_duel").eq("toUserId", user._id)
            )
            .collect();

        for (const notification of notifications) {
            if (
                isScheduledDuelPayload(notification.payload) &&
                notification.payload.scheduledDuelId === args.scheduledDuelId
            ) {
                await ctx.db.patch(notification._id, {
                    status: "dismissed",
                });
            }
        }

        return { success: true };
    },
});

/**
 * Decline a scheduled duel proposal
 */
export const declineScheduledDuel = mutation({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
    },
    handler: async (ctx, args) => {
        const { user } = await getAuthenticatedUser(ctx);

        const scheduledDuel = await ctx.db.get(args.scheduledDuelId);
        if (!scheduledDuel) {
            throw new Error("Scheduled duel not found");
        }

        if (scheduledDuel.recipientId !== user._id) {
            throw new Error("Not authorized to decline this duel");
        }

        // Update status to declined
        await ctx.db.patch(args.scheduledDuelId, {
            status: "declined",
            updatedAt: Date.now(),
        });

        // Dismiss related notification
        const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_type", (q) =>
                q.eq("type", "scheduled_duel").eq("toUserId", user._id)
            )
            .collect();

        for (const notification of notifications) {
            if (
                isScheduledDuelPayload(notification.payload) &&
                notification.payload.scheduledDuelId === args.scheduledDuelId
            ) {
                await ctx.db.patch(notification._id, {
                    status: "dismissed",
                });
            }
        }

        await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
            trigger: "scheduled_duel_declined",
            toUserId: scheduledDuel.proposerId,
            fromUserId: user._id,
            scheduledDuelId: args.scheduledDuelId,
        });

        return { success: true };
    },
});

/**
 * Cancel a scheduled duel - works for both proposer and recipient
 * For pending duels: only proposer can cancel
 * For accepted duels: either party can cancel
 */
export const cancelScheduledDuel = mutation({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
    },
    handler: async (ctx, args) => {
        const { user } = await getAuthenticatedUser(ctx);

        const scheduledDuel = await ctx.db.get(args.scheduledDuelId);
        if (!scheduledDuel) {
            throw new Error("Scheduled duel not found");
        }

        const isProposer = scheduledDuel.proposerId === user._id;
        const isRecipient = scheduledDuel.recipientId === user._id;

        // Validate authorization based on status
        if (scheduledDuel.status === "accepted") {
            // Either party can cancel an accepted duel
            if (!isProposer && !isRecipient) {
                throw new Error("Not authorized to cancel this duel");
            }
            // Cannot cancel if duel has already started
            if (scheduledDuel.startedDuelId) {
                throw new Error("Cannot cancel a duel that has already started");
            }
        } else {
            // For pending/counter_proposed duels, only proposer can cancel
            if (!isProposer) {
                throw new Error("Not authorized to cancel this duel");
            }
        }

        // Update status to cancelled (for accepted) or delete (for pending)
        if (scheduledDuel.status === "accepted") {
            await ctx.db.patch(args.scheduledDuelId, {
                status: "cancelled",
                updatedAt: Date.now(),
            });
        } else {
            // Delete the scheduled duel for pending status
            await ctx.db.delete(args.scheduledDuelId);
        }

        // Dismiss related notifications for both users
        const allScheduledDuelNotifications = await ctx.db
            .query("notifications")
            .withIndex("by_type", (q) => q.eq("type", "scheduled_duel"))
            .collect();

        for (const notification of allScheduledDuelNotifications) {
            if (
                isScheduledDuelPayload(notification.payload) &&
                notification.payload.scheduledDuelId === args.scheduledDuelId
            ) {
                await ctx.db.patch(notification._id, {
                    status: "dismissed",
                });
            }
        }

        const otherUserId = isProposer ? scheduledDuel.recipientId : scheduledDuel.proposerId;
        if (scheduledDuel.status === "accepted") {
            await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
                trigger: "scheduled_duel_canceled",
                toUserId: otherUserId,
                fromUserId: user._id,
                scheduledDuelId: args.scheduledDuelId,
            });
        }

        return { success: true };
    },
});

// ===========================================
// Ready State Mutations
// ===========================================

/**
 * Set ready status for a scheduled duel
 */
export const setReadyForScheduledDuel = mutation({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
    },
    handler: async (ctx, args) => {
        const { user } = await getAuthenticatedUser(ctx);

        const scheduledDuel = await ctx.db.get(args.scheduledDuelId);
        if (!scheduledDuel) {
            throw new Error("Scheduled duel not found");
        }

        // Validate user is a participant
        const isProposer = scheduledDuel.proposerId === user._id;
        const isRecipient = scheduledDuel.recipientId === user._id;

        if (!isProposer && !isRecipient) {
            throw new Error("Not authorized");
        }

        if (scheduledDuel.status !== "accepted") {
            throw new Error("Duel must be accepted before setting ready");
        }

        // If duel already started, return early
        if (scheduledDuel.startedDuelId) {
            return { success: true, bothReady: true, startedDuelId: scheduledDuel.startedDuelId };
        }

        const now = Date.now();

        // Set ready for the appropriate player
        const updates: {
            proposerReady?: boolean;
            recipientReady?: boolean;
            proposerReadyAt?: number;
            recipientReadyAt?: number;
            updatedAt: number;
        } = { updatedAt: now };

        if (isProposer) {
            updates.proposerReady = true;
            updates.proposerReadyAt = now;
        } else {
            updates.recipientReady = true;
            updates.recipientReadyAt = now;
        }

        await ctx.db.patch(args.scheduledDuelId, updates);

        const opponentId = isProposer ? scheduledDuel.recipientId : scheduledDuel.proposerId;

        await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
            trigger: "scheduled_duel_ready",
            toUserId: opponentId,
            fromUserId: user._id,
            scheduledDuelId: args.scheduledDuelId,
        });

        // Check if both players are now ready
        const proposerReady = isProposer ? true : scheduledDuel.proposerReady;
        const recipientReady = isRecipient ? true : scheduledDuel.recipientReady;

        if (proposerReady && recipientReady) {
            // Start the duel synchronously using internal mutation
            const result: { success: boolean; challengeId: string } = await ctx.runMutation(internal.scheduledDuels.startScheduledDuel, {
                scheduledDuelId: args.scheduledDuelId,
            });

            return { success: true, bothReady: true, startedDuelId: result.challengeId };
        }

        return { success: true, bothReady: false };
    },
});

/**
 * Cancel ready status for a scheduled duel
 */
export const cancelReadyForScheduledDuel = mutation({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
    },
    handler: async (ctx, args) => {
        const { user } = await getAuthenticatedUser(ctx);

        const scheduledDuel = await ctx.db.get(args.scheduledDuelId);
        if (!scheduledDuel) {
            throw new Error("Scheduled duel not found");
        }

        // Validate user is a participant
        const isProposer = scheduledDuel.proposerId === user._id;
        const isRecipient = scheduledDuel.recipientId === user._id;

        if (!isProposer && !isRecipient) {
            throw new Error("Not authorized");
        }

        if (scheduledDuel.status !== "accepted") {
            throw new Error("Duel must be accepted");
        }

        // Cannot cancel ready if duel already started
        if (scheduledDuel.startedDuelId) {
            throw new Error("Duel has already started");
        }

        // Clear ready for the appropriate player
        if (isProposer) {
            await ctx.db.patch(args.scheduledDuelId, {
                proposerReady: false,
                proposerReadyAt: undefined,
                updatedAt: Date.now(),
            });
        } else {
            await ctx.db.patch(args.scheduledDuelId, {
                recipientReady: false,
                recipientReadyAt: undefined,
                updatedAt: Date.now(),
            });
        }

        return { success: true };
    },
});

// ===========================================
// Internal Mutations
// ===========================================

/**
 * Internal mutation to start a scheduled duel when both players are ready
 */
export const startScheduledDuel = internalMutation({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
    },
    handler: async (ctx, args) => {
        const scheduledDuel = await ctx.db.get(args.scheduledDuelId);
        if (!scheduledDuel) {
            throw new Error("Scheduled duel not found");
        }

        // Double-check both players are ready
        if (!scheduledDuel.proposerReady || !scheduledDuel.recipientReady) {
            throw new Error("Both players must be ready");
        }

        // Check if duel already started (prevent double-start race condition)
        if (scheduledDuel.startedDuelId) {
            return { success: true, challengeId: scheduledDuel.startedDuelId };
        }

        // Get theme for word count
        const now = Date.now();
        const themes = await getScheduledDuelThemes(ctx, scheduledDuel);
        if (themes.length === 0) {
            throw new Error("No themes found for scheduled duel");
        }
        const challengeBase = buildChallengeBase({
            challengerId: scheduledDuel.proposerId,
            opponentId: scheduledDuel.recipientId,
            themes,
            mode: scheduledDuel.mode,
            classicDifficultyPreset: scheduledDuel.classicDifficultyPreset,
            createdAt: now,
        });
        const startState = buildChallengeStartState({
            mode: challengeBase.mode,
            wordCount: challengeBase.sessionWords.length,
            now,
            seed: challengeBase.seed,
        });
        const duelMode = challengeBase.mode;

        const challengeId = await ctx.db.insert("challenges", {
            ...challengeBase,
            ...startState,
        });

        // Update scheduled duel with started duel ID
        await ctx.db.patch(args.scheduledDuelId, {
            startedDuelId: challengeId,
            updatedAt: now,
        });

        // Update notifications for both players with startedDuelId
        const allNotifications = await ctx.db
            .query("notifications")
            .withIndex("by_type", (q) => q.eq("type", "scheduled_duel"))
            .collect();

        for (const notification of allNotifications) {
            if (
                isScheduledDuelPayload(notification.payload) &&
                notification.payload.scheduledDuelId === args.scheduledDuelId
            ) {
                await ctx.db.patch(notification._id, {
                    payload: {
                        ...notification.payload,
                        startedDuelId: challengeId,
                        mode: duelMode, // Explicitly include mode for navigation
                    },
                });
            }
        }

        return { success: true, challengeId };
    },
});

/**
 * Auto cleanup scheduled duels - run as a cron job
 * - Clears expired ready states (30 min since readyAt)
 * - Cancels duels 1 hour after scheduled time if not started
 */
export const autoCleanupScheduledDuels = internalAction({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const READY_STATE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
        const GRACE_PERIOD_MS = 60 * 60 * 1000; // 1 hour

        // We need to use internal mutations from an action
        // Query all accepted scheduled duels
        const acceptedDuels = await ctx.runQuery(internal.scheduledDuels.getAcceptedScheduledDuels, {});

        for (const duel of acceptedDuels) {
            // Check if already started (has startedDuelId)
            if (duel.startedDuelId) {
                continue;
            }

            // Check if 1 hour past scheduled time - only cancel if neither player is ready
            if (now > duel.scheduledTime + GRACE_PERIOD_MS) {
                // Only expire if the duel hasn't started AND neither player has clicked Ready
                if (!duel.proposerReady && !duel.recipientReady) {
                    await ctx.runMutation(internal.scheduledDuels.expireScheduledDuel, {
                        scheduledDuelId: duel._id,
                    });
                }
                continue;
            }

            // Check ready state expiration
            let shouldClearProposerReady = false;
            let shouldClearRecipientReady = false;

            if (duel.proposerReady && duel.proposerReadyAt) {
                if (now > duel.proposerReadyAt + READY_STATE_TIMEOUT_MS) {
                    shouldClearProposerReady = true;
                }
            }

            if (duel.recipientReady && duel.recipientReadyAt) {
                if (now > duel.recipientReadyAt + READY_STATE_TIMEOUT_MS) {
                    shouldClearRecipientReady = true;
                }
            }

            if (shouldClearProposerReady || shouldClearRecipientReady) {
                await ctx.runMutation(internal.scheduledDuels.clearExpiredReadyStates, {
                    scheduledDuelId: duel._id,
                    clearProposer: shouldClearProposerReady,
                    clearRecipient: shouldClearRecipientReady,
                });
            }
        }
    },
});

/**
 * Get all accepted scheduled duels (internal query for cleanup action)
 */
export const getAcceptedScheduledDuels = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("scheduledDuels")
            .withIndex("by_status", (q) => q.eq("status", "accepted"))
            .collect();
    },
});

export const getUpcomingAcceptedDuels = internalQuery({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        return await ctx.db
            .query("scheduledDuels")
            .withIndex("by_status_scheduled_time", (q) =>
                q.eq("status", "accepted").gt("scheduledTime", now)
            )
            .collect();
    },
});

export const cleanupTerminalScheduledDuels = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        let deletedCount = 0;
        const duelIdsToDelete = new Set<Id<"scheduledDuels">>();

        for (const status of ["declined", "cancelled", "expired"] as const) {
            const duels = await ctx.db
                .query("scheduledDuels")
                .withIndex("by_status", (q) => q.eq("status", status))
                .collect();

            for (const duel of duels) {
                if (
                    !isTerminalScheduledDuelPastRetention(
                        duel,
                        now,
                        TERMINAL_SCHEDULED_DUEL_TTL_MS
                    )
                ) {
                    continue;
                }

                duelIdsToDelete.add(duel._id);
            }
        }

        const startedDuels = await ctx.db
            .query("scheduledDuels")
            .withIndex("by_status", (q) => q.eq("status", "accepted"))
            .collect();

        for (const duel of startedDuels) {
            if (
                !isStartedScheduledDuelPastRetention(
                    duel,
                    now,
                    TERMINAL_SCHEDULED_DUEL_TTL_MS
                )
            ) {
                continue;
            }

            duelIdsToDelete.add(duel._id);
        }

        for (const duelId of duelIdsToDelete) {
            await ctx.db.delete(duelId);
            deletedCount++;
        }

        return { deletedCount };
    },
});

/**
 * Clear expired ready states (internal mutation for cleanup action)
 */
export const clearExpiredReadyStates = internalMutation({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
        clearProposer: v.boolean(),
        clearRecipient: v.boolean(),
    },
    handler: async (ctx, args) => {
        const updates: {
            proposerReady?: boolean;
            recipientReady?: boolean;
            proposerReadyAt?: undefined;
            recipientReadyAt?: undefined;
            updatedAt: number;
        } = { updatedAt: Date.now() };

        if (args.clearProposer) {
            updates.proposerReady = false;
            updates.proposerReadyAt = undefined;
        }

        if (args.clearRecipient) {
            updates.recipientReady = false;
            updates.recipientReadyAt = undefined;
        }

        await ctx.db.patch(args.scheduledDuelId, updates);
    },
});

/**
 * Expire a scheduled duel (internal mutation for cleanup action)
 */
/**
 * One-time migration: reclassify "declined" scheduled duels into proper statuses.
 * Uses emailNotificationLog to distinguish genuine declines from cancellations,
 * and falls back to scheduledTime for expirations.
 * Safe to run multiple times (idempotent). Delete after use.
 */
export const migrateDeclinedStatuses = internalMutation({
    args: {},
    handler: async (ctx) => {
        const declined = await ctx.db
            .query("scheduledDuels")
            .withIndex("by_status", (q) => q.eq("status", "declined"))
            .collect();

        if (declined.length === 0) return { migrated: 0 };

        const now = Date.now();
        let migrated = 0;

        for (const duel of declined) {
            // Check if there's a "scheduled_duel_canceled" email log → was a cancellation
            const cancelLog = await ctx.db
                .query("emailNotificationLog")
                .withIndex("by_user_trigger_scheduledDuel", (q) =>
                    q.eq("toUserId", duel.recipientId)
                     .eq("trigger", "scheduled_duel_canceled")
                     .eq("scheduledDuelId", duel._id)
                )
                .first();

            // Also check if proposer got the cancel email (canceller could be either party)
            const cancelLogProposer = !cancelLog
                ? await ctx.db
                    .query("emailNotificationLog")
                    .withIndex("by_user_trigger_scheduledDuel", (q) =>
                        q.eq("toUserId", duel.proposerId)
                             .eq("trigger", "scheduled_duel_canceled")
                             .eq("scheduledDuelId", duel._id)
                    )
                    .first()
                : null;

            if (cancelLog || cancelLogProposer) {
                await ctx.db.patch(duel._id, { status: "cancelled" });
                migrated++;
            } else if (duel.scheduledTime + 60 * 60 * 1000 < now) {
                // Past scheduled time + 1h grace = was expired by cron
                await ctx.db.patch(duel._id, { status: "expired" });
                migrated++;
            }
            // Otherwise: genuine decline, leave as "declined"
        }

        return { migrated, total: declined.length };
    },
});

export const expireScheduledDuel = internalMutation({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
    },
    handler: async (ctx, args) => {
        const scheduledDuel = await ctx.db.get(args.scheduledDuelId);
        if (!scheduledDuel) return;

        // Update status to expired
        await ctx.db.patch(args.scheduledDuelId, {
            status: "expired",
            updatedAt: Date.now(),
        });

        // Dismiss related notifications for both users
        const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_type_only", (q) => q.eq("type", "scheduled_duel"))
            .collect();

        for (const notification of notifications) {
            if (
                isScheduledDuelPayload(notification.payload) &&
                notification.payload.scheduledDuelId === args.scheduledDuelId
            ) {
                await ctx.db.patch(notification._id, {
                    status: "dismissed",
                });
            }
        }
    },
});
