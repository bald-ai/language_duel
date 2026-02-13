/**
 * Lobby mutations for duel creation, acceptance, rejection, and cancellation.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  getAuthenticatedUserOrNull,
  getDuelParticipant,
} from "./helpers/auth";
import { createShuffledWordOrder } from "./helpers/gameLogic";
import { buildSoloInitState } from "./helpers/duelInitialization";
import { isDuelChallengePayload } from "./notificationPayloads";
import { DUEL_CHALLENGE_TTL_MS, SEED_XOR_MASK } from "./constants";
import { isCreatedAtExpired } from "../lib/cleanupExpiry";

export const createDuel = mutation({
  args: {
    opponentId: v.id("users"),
    themeId: v.id("themes"),
    mode: v.optional(v.union(v.literal("solo"), v.literal("classic"))),
    classicDifficultyPreset: v.optional(
      v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard")
      )
    ),
  },
  handler: async (ctx, { opponentId, themeId, mode, classicDifficultyPreset }) => {
    const { user: challenger } = await getAuthenticatedUser(ctx);

    // Verify opponent exists
    const opponent = await ctx.db.get(opponentId);
    if (!opponent) throw new Error("Opponent not found");

    // Verify theme exists and challenger has access to it
    const theme = await ctx.runQuery(api.themes.getTheme, { themeId });
    if (!theme) throw new Error("Theme not found or access denied");

    // Create shuffled word order
    const wordOrder = createShuffledWordOrder(theme.words.length);
    const duelMode = mode || "solo";
    const now = Date.now();

    const challengeId = await ctx.db.insert("challenges", {
      challengerId: challenger._id,
      opponentId,
      themeId,
      currentWordIndex: 0,
      wordOrder,
      challengerAnswered: false,
      opponentAnswered: false,
      challengerScore: 0,
      opponentScore: 0,
      status: "pending",
      mode: duelMode,
      classicDifficultyPreset:
        duelMode === "classic" ? classicDifficultyPreset || "easy" : undefined,
      createdAt: now,
    });

    // Create notification for the opponent
    await ctx.db.insert("notifications", {
      type: "duel_challenge",
      fromUserId: challenger._id,
      toUserId: opponentId,
      status: "pending",
      payload: {
        challengeId,
        themeName: theme.name,
        mode: duelMode,
        classicDifficultyPreset: duelMode === "classic" ? classicDifficultyPreset || "easy" : undefined,
      },
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
      trigger: "immediate_duel_challenge",
      toUserId: opponentId,
      fromUserId: challenger._id,
      challengeId,
    });

    return challengeId;
  },
});

export const getDuel = query({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const duel = await ctx.db.get(duelId);
    if (!duel) return null;

    // Verify caller is part of this duel
    const isChallenger = auth.user._id === duel.challengerId;
    const isOpponent = auth.user._id === duel.opponentId;
    if (!isChallenger && !isOpponent) return null;

    const [challenger, opponent] = await Promise.all([
      ctx.db.get(duel.challengerId),
      ctx.db.get(duel.opponentId),
    ]);
    const viewerRole = isChallenger ? "challenger" : "opponent";

    const theme = duel.themeId ? await ctx.db.get(duel.themeId) : null;

    // Return only safe user fields (no email, no clerkId)
    return {
      duel,
      theme,
      viewerRole,
      viewer: {
        _id: auth.user._id,
        name: auth.user.name,
        imageUrl: auth.user.imageUrl,
      },
      challenger: challenger
        ? {
          _id: challenger._id,
          name: challenger.name,
          imageUrl: challenger.imageUrl,
        }
        : null,
      opponent: opponent
        ? {
          _id: opponent._id,
          name: opponent.name,
          imageUrl: opponent.imageUrl,
        }
        : null,
    };
  },
});

export const getPendingDuels = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return [];

    const pendingChallenges = await ctx.db
      .query("challenges")
      .withIndex("by_opponent_status", (q) =>
        q.eq("opponentId", auth.user._id).eq("status", "pending")
      )
      .collect();

    const challengerIds = Array.from(
      new Set(pendingChallenges.map((challenge) => challenge.challengerId))
    );
    const challengers = await Promise.all(challengerIds.map((id) => ctx.db.get(id)));
    const challengersById = new Map(challengerIds.map((id, index) => [id, challengers[index] ?? null]));

    return pendingChallenges.map((challenge) => ({
      challenge,
      challenger: challengersById.get(challenge.challengerId) ?? null,
    }));
  },
});

export const acceptDuel = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, isOpponent } = await getDuelParticipant(ctx, duelId);

    // Only opponent can accept
    if (!isOpponent) {
      throw new Error("Only opponent can accept challenge");
    }

    // Guard: can only accept pending duels
    if (duel.status !== "pending") {
      throw new Error("Duel is not pending");
    }

    // Get theme for word count
    const theme = await ctx.db.get(duel.themeId);
    if (!theme) throw new Error("Theme not found");

    const wordCount = theme.words.length;

    // Initialize seed for deterministic random
    const seed = Date.now() ^ SEED_XOR_MASK;

    // Check if this is a classic mode duel
    if (duel.mode === "classic") {
      // Classic mode: set status to "accepted" and initialize timer
      await ctx.db.patch(duelId, {
        status: "accepted",
        questionStartTime: Date.now(),
        seed,
      });
    } else {
      // Solo mode: skip learning phase - go directly to challenging
      const soloState = buildSoloInitState(wordCount, seed);

      await ctx.db.patch(duelId, {
        status: "challenging",
        questionStartTime: Date.now(),
        ...soloState,
      });
    }
  },
});

export const rejectDuel = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, isOpponent } = await getDuelParticipant(ctx, duelId);

    // Only opponent can reject
    if (!isOpponent) {
      throw new Error("Only opponent can reject challenge");
    }

    // Guard: can only reject pending duels
    if (duel.status !== "pending") {
      throw new Error("Duel is not pending");
    }

    await ctx.db.patch(duelId, { status: "rejected" });
  },
});

export const stopDuel = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    // Just verify participant - both can stop
    await getDuelParticipant(ctx, duelId);
    await ctx.db.patch(duelId, { status: "stopped" });
  },
});

export const cancelPendingDuel = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, isChallenger } = await getDuelParticipant(ctx, duelId);

    // Only challenger can cancel a pending duel
    if (!isChallenger) {
      throw new Error("Only challenger can cancel a pending duel");
    }

    // Can only cancel if still pending
    if (duel.status !== "pending") {
      throw new Error("Can only cancel pending duels");
    }

    await ctx.db.patch(duelId, { status: "cancelled" });

    // Dismiss the associated duel_challenge notification
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_type", (q) =>
        q.eq("type", "duel_challenge").eq("toUserId", duel.opponentId)
      )
      .collect();

    for (const notification of notifications) {
      if (
        (notification.status === "pending" || notification.status === "read") &&
        isDuelChallengePayload(notification.payload) &&
        notification.payload.challengeId === duelId
      ) {
        await ctx.db.patch(notification._id, { status: "dismissed" });
      }
    }
  },
});

export const acceptDuelChallenge = mutation({
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

    if (notification.type !== "duel_challenge") {
      throw new Error("Invalid notification type");
    }

    const payload = notification.payload;
    if (!isDuelChallengePayload(payload)) {
      throw new Error("Challenge ID not found in notification");
    }
    const challengeId = payload.challengeId;

    const challenge = await ctx.db.get(challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    if (challenge.status !== "pending") {
      throw new Error("Challenge is no longer pending");
    }

    const theme = await ctx.db.get(challenge.themeId);
    if (!theme) {
      throw new Error("Theme not found");
    }

    const wordCount = theme.words.length;
    const seed = Date.now() ^ SEED_XOR_MASK;

    if (challenge.mode === "classic") {
      await ctx.db.patch(challengeId, {
        status: "accepted",
        questionStartTime: Date.now(),
        seed,
      });
    } else {
      const soloState = buildSoloInitState(wordCount, seed);

      await ctx.db.patch(challengeId, {
        status: "challenging",
        questionStartTime: Date.now(),
        ...soloState,
      });
    }

    await ctx.db.patch(args.notificationId, {
      status: "dismissed",
    });

    return { success: true, challengeId };
  },
});

export const declineDuelChallenge = mutation({
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

    if (notification.type !== "duel_challenge") {
      throw new Error("Invalid notification type");
    }

    const payload = notification.payload;
    if (!isDuelChallengePayload(payload)) {
      throw new Error("Challenge ID not found in notification");
    }
    const challengeId = payload.challengeId;

    const challenge = await ctx.db.get(challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    await ctx.db.patch(challengeId, {
      status: "rejected",
    });

    await ctx.db.patch(args.notificationId, {
      status: "dismissed",
    });

    return { success: true };
  },
});

/**
 * Auto-dismiss stale duel challenge notifications and cancel unresolved challenges.
 */
export const cleanupExpiredDuelChallenges = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - DUEL_CHALLENGE_TTL_MS;

    const expiredPendingNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status_createdAt", (q) =>
        q.eq("type", "duel_challenge").eq("status", "pending").lt("createdAt", cutoff)
      )
      .collect();

    const expiredReadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status_createdAt", (q) =>
        q.eq("type", "duel_challenge").eq("status", "read").lt("createdAt", cutoff)
      )
      .collect();

    const notifications = [...expiredPendingNotifications, ...expiredReadNotifications];
    const resolvedChallengeIds = new Set<string>();

    for (const notification of notifications) {
      if (!isCreatedAtExpired(notification.createdAt, now, DUEL_CHALLENGE_TTL_MS)) continue;
      if (!isDuelChallengePayload(notification.payload)) continue;

      const challengeId = notification.payload.challengeId;
      const challengeKey = String(challengeId);

      if (!resolvedChallengeIds.has(challengeKey)) {
        const challenge = await ctx.db.get(challengeId);
        if (challenge?.status === "pending") {
          await ctx.db.patch(challengeId, { status: "cancelled" });
        }
        resolvedChallengeIds.add(challengeKey);
      }

      await ctx.db.patch(notification._id, { status: "dismissed" });
    }
  },
});
