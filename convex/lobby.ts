/**
 * Lobby mutations for duel creation, acceptance, rejection, and cancellation.
 */

import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  getAuthenticatedUserOrNull,
  getDuelParticipant,
} from "./helpers/auth";
import {
  createShuffledWordOrder,
  initializeWordPoolsSeeded,
  createInitialWordStates,
  determineInitialLevelSeeded,
  determineLevel2ModeSeeded,
} from "./helpers/gameLogic";

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

    // Verify theme exists
    const theme = await ctx.db.get(themeId);
    if (!theme) throw new Error("Theme not found");

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
    let seed = Date.now() ^ 0xdeadbeef;

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
      const challengerPoolsResult = initializeWordPoolsSeeded(wordCount, seed);
      seed = challengerPoolsResult.newSeed;

      const opponentPoolsResult = initializeWordPoolsSeeded(wordCount, seed);
      seed = opponentPoolsResult.newSeed;

      const wordStates = createInitialWordStates(wordCount);

      // Pick first question for each player using seeded PRNG
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

      await ctx.db.patch(duelId, {
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

    // Delete the associated duel_challenge notification
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_type", (q) =>
        q.eq("type", "duel_challenge").eq("toUserId", duel.opponentId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    for (const notification of notifications) {
      const payload = notification.payload as
        | { challengeId: typeof duelId }
        | undefined;
      if (payload?.challengeId === duelId) {
        await ctx.db.delete(notification._id);
      }
    }
  },
});
