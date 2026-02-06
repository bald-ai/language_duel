import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { isScheduledDuelPayload } from "./notificationPayloads";
import {
    createShuffledWordOrder,
    initializeWordPoolsSeeded,
    createInitialWordStates,
    determineInitialLevelSeeded,
    determineLevel2ModeSeeded,
} from "./helpers/gameLogic";

// ===========================================
// Type Definitions
// ===========================================

export type ScheduledDuelStatus =
    | "pending"
    | "accepted"
    | "counter_proposed"
    | "declined";

// ===========================================
// Queries
// ===========================================

/**
 * Get all scheduled duels for current user (as proposer or recipient)
 */
export const getScheduledDuels = query({
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
        const uniqueDuels = allDuels.filter(
            (duel, index, self) =>
                index === self.findIndex((d) => d._id === duel._id)
        );

        // Enrich with user and theme info
        const enrichedDuels = await Promise.all(
            uniqueDuels.map(async (duel) => {
                const proposer = await ctx.db.get(duel.proposerId);
                const recipient = await ctx.db.get(duel.recipientId);
                const theme = await ctx.db.get(duel.themeId);

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
                    theme: theme ? {
                        _id: theme._id,
                        name: theme.name,
                    } : null,
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
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            return null;
        }

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
        const theme = await ctx.db.get(duel.themeId);

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
            theme: theme ? {
                _id: theme._id,
                name: theme.name,
            } : null,
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
        themeId: v.id("themes"),
        scheduledTime: v.number(),
        mode: v.optional(v.union(v.literal("solo"), v.literal("classic"))),
        classicDifficultyPreset: v.optional(
            v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))
        ),
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

        // Validate theme exists
        const theme = await ctx.db.get(args.themeId);
        if (!theme) {
            throw new Error("Theme not found");
        }

        const now = Date.now();

        // Create scheduled duel
        const scheduledDuelId = await ctx.db.insert("scheduledDuels", {
            proposerId: user._id,
            recipientId: args.recipientId,
            themeId: args.themeId,
            scheduledTime: args.scheduledTime,
            status: "pending",
            mode: args.mode || "classic",
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
                themeId: args.themeId,
                themeName: theme.name,
                scheduledTime: args.scheduledTime,
                mode: args.mode || "classic",
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

        const theme = await ctx.db.get(scheduledDuel.themeId);
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
                themeId: scheduledDuel.themeId,
                themeName: theme?.name,
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
        newThemeId: v.optional(v.id("themes")),
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

        const scheduledDuel = await ctx.db.get(args.scheduledDuelId);
        if (!scheduledDuel) {
            throw new Error("Scheduled duel not found");
        }

        // Either party can counter-propose
        if (scheduledDuel.proposerId !== user._id && scheduledDuel.recipientId !== user._id) {
            throw new Error("Not authorized");
        }

        if (scheduledDuel.status === "declined" || scheduledDuel.status === "accepted") {
            throw new Error("Cannot counter-propose on this duel");
        }

        const updates: {
            status: "counter_proposed";
            updatedAt: number;
            scheduledTime?: number;
            themeId?: typeof scheduledDuel.themeId;
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

        if (args.newThemeId !== undefined) {
            const theme = await ctx.db.get(args.newThemeId);
            if (!theme) {
                throw new Error("Theme not found");
            }
            updates.themeId = args.newThemeId;
        }

        await ctx.db.patch(args.scheduledDuelId, updates);

        // Create notification for the other party
        const otherUserId = user._id === scheduledDuel.proposerId
            ? scheduledDuel.recipientId
            : scheduledDuel.proposerId;

        const theme = await ctx.db.get(updates.themeId || scheduledDuel.themeId);

        await ctx.db.insert("notifications", {
            type: "scheduled_duel",
            fromUserId: user._id,
            toUserId: otherUserId,
            status: "pending",
            payload: {
                scheduledDuelId: args.scheduledDuelId,
                themeId: updates.themeId || scheduledDuel.themeId,
                themeName: theme?.name,
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

        // Update status to declined (for accepted) or delete (for pending)
        if (scheduledDuel.status === "accepted") {
            await ctx.db.patch(args.scheduledDuelId, {
                status: "declined",
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
        const theme = await ctx.db.get(scheduledDuel.themeId);
        if (!theme) {
            throw new Error("Theme not found");
        }

        // Create duel using same logic as lobby.ts createDuel
        const wordOrder = createShuffledWordOrder(theme.words.length);
        const duelMode = scheduledDuel.mode || "classic";
        const now = Date.now();

        // Initialize seed for deterministic random
        let seed = now ^ 0xdeadbeef;
        const wordCount = theme.words.length;

        // Create the challenge based on mode
        let challengeId;

        if (duelMode === "classic") {
            challengeId = await ctx.db.insert("challenges", {
                challengerId: scheduledDuel.proposerId,
                opponentId: scheduledDuel.recipientId,
                themeId: scheduledDuel.themeId,
                currentWordIndex: 0,
                wordOrder,
                challengerAnswered: false,
                opponentAnswered: false,
                challengerScore: 0,
                opponentScore: 0,
                status: "accepted",
                mode: "classic",
                classicDifficultyPreset: scheduledDuel.classicDifficultyPreset || "easy",
                createdAt: now,
                questionStartTime: now,
                seed,
            });
        } else {
            // Solo mode - initialize word states and pools
            const challengerPoolsResult = initializeWordPoolsSeeded(wordCount, seed);
            seed = challengerPoolsResult.newSeed;

            const opponentPoolsResult = initializeWordPoolsSeeded(wordCount, seed);
            seed = opponentPoolsResult.newSeed;

            const wordStates = createInitialWordStates(wordCount);

            // Pick first question for each player
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const challengerFirstWord = challengerPoolsResult.activePool[
                Math.floor((seed / 0x7fffffff) * challengerPoolsResult.activePool.length)
            ];

            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const opponentFirstWord = opponentPoolsResult.activePool[
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

            challengeId = await ctx.db.insert("challenges", {
                challengerId: scheduledDuel.proposerId,
                opponentId: scheduledDuel.recipientId,
                themeId: scheduledDuel.themeId,
                currentWordIndex: 0,
                wordOrder,
                challengerAnswered: false,
                opponentAnswered: false,
                challengerScore: 0,
                opponentScore: 0,
                status: "challenging",
                mode: "solo",
                createdAt: now,
                questionStartTime: now,
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
export const expireScheduledDuel = internalMutation({
    args: {
        scheduledDuelId: v.id("scheduledDuels"),
    },
    handler: async (ctx, args) => {
        const scheduledDuel = await ctx.db.get(args.scheduledDuelId);
        if (!scheduledDuel) return;

        // Update status to declined
        await ctx.db.patch(args.scheduledDuelId, {
            status: "declined",
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
