/**
 * Challenge lobby mutations for creating, accepting, declining, and cancelling
 * person-to-person duel invites.
 */

import { query, mutation, internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  getAuthenticatedUserOrNull,
  getChallengeParticipant,
  getDuelParticipant,
} from "./helpers/auth";
import {
  buildChallengeInvite,
  buildDuelSession,
} from "./helpers/sessionCreation";
import {
  loadThemesByIds,
  summarizeSessionWords,
} from "./helpers/sessionWords";
import { loadWeeklyGoalSessionThemesByThemeIds } from "./helpers/weeklyGoalSnapshots";
import { isChallengeInvitePayload } from "./notificationPayloads";
import { CHALLENGE_INVITE_TTL_MS } from "./constants";
import { isCreatedAtExpired } from "../lib/cleanupExpiry";
import { buildSessionWords, summarizeThemes } from "../lib/sessionWords";
import { calculateBossStartingLives } from "../lib/bossLives";

type CtxWithDb = QueryCtx | MutationCtx;

async function buildDuelWordsForChallenge(
  ctx: CtxWithDb,
  challenge: Doc<"challenges">
) {
  const themes = challenge.weeklyGoalId
    ? await loadWeeklyGoalSessionThemesByThemeIds(ctx, { _id: challenge.weeklyGoalId }, challenge.themeIds)
    : await loadThemesByIds(ctx, challenge.themeIds);

  const sessionWords = buildSessionWords(themes);
  if (sessionWords.length === 0) {
    throw new Error("Challenge has no playable words");
  }
  return sessionWords;
}

async function insertDuelSessionForChallenge(
  ctx: MutationCtx,
  challenge: Doc<"challenges">,
  now: number
): Promise<Id<"duels">> {
  const sessionWords = await buildDuelWordsForChallenge(ctx, challenge);
  const livesTotal = challenge.sourceType === "boss"
    ? await resolveBossLives(ctx, challenge)
    : challenge.sourceType === "spaced_repetition"
      ? await resolveSpacedRepetitionLives(ctx, challenge)
      : undefined;

  return await ctx.db.insert("duels", buildDuelSession({
    challengeId: challenge._id,
    challengerId: challenge.challengerId,
    opponentId: challenge.opponentId,
    sessionWords,
    sourceType: challenge.sourceType,
    weeklyGoalId: challenge.weeklyGoalId,
    bossType: challenge.bossType,
    spacedRepetitionStep: challenge.spacedRepetitionStep,
    bossLivesTotal: livesTotal,
    bossLivesRemaining: livesTotal,
    duelDifficultyPreset: challenge.duelDifficultyPreset,
    createdAt: now,
  }));
}

async function resolveBossLives(
  ctx: CtxWithDb,
  challenge: Doc<"challenges">
): Promise<number | undefined> {
  if (!challenge.weeklyGoalId || !challenge.bossType) return undefined;
  const goal = await ctx.db.get(challenge.weeklyGoalId);
  if (!goal) return undefined;
  return calculateBossStartingLives({
    bossType: challenge.bossType,
    themeCount: challenge.themeIds.length,
    miniBossDefeated: goal.miniBossStatus === "defeated",
  });
}

async function resolveSpacedRepetitionLives(
  ctx: CtxWithDb,
  challenge: Doc<"challenges">
): Promise<number | undefined> {
  if (!challenge.weeklyGoalId) return undefined;
  const goal = await ctx.db.get(challenge.weeklyGoalId);
  return goal ? goal.themes.length + 1 : undefined;
}

export const createChallenge = mutation({
  args: {
    opponentId: v.id("users"),
    themeIds: v.array(v.id("themes")),
    duelDifficultyPreset: v.optional(
      v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard")
      )
    ),
  },
  handler: async (ctx, { opponentId, themeIds, duelDifficultyPreset }) => {
    const { user: challenger } = await getAuthenticatedUser(ctx);

    const opponent = await ctx.db.get(opponentId);
    if (!opponent) throw new Error("Opponent not found");

    const orderedThemeIds = Array.from(new Set(themeIds));
    if (orderedThemeIds.length === 0) {
      throw new Error("Select at least one theme");
    }
    const themes: Array<Doc<"themes"> | null> = await Promise.all(
      orderedThemeIds.map((selectedThemeId) =>
        ctx.runQuery(api.themes.getTheme, { themeId: selectedThemeId })
      )
    );
    if (themes.some((theme) => !theme)) {
      throw new Error("One or more themes were not found or are not accessible");
    }
    const resolvedThemes: Doc<"themes">[] = themes.filter(
      (theme): theme is Doc<"themes"> => theme !== null
    );

    const now = Date.now();
    const challengeId = await ctx.db.insert("challenges", buildChallengeInvite({
      challengerId: challenger._id,
      opponentId,
      themeIds: orderedThemeIds,
      sourceType: "normal",
      duelDifficultyPreset,
      createdAt: now,
    }));

    const themeSummary = summarizeThemes(resolvedThemes);

    await ctx.db.insert("notifications", {
      type: "challenge_invite",
      fromUserId: challenger._id,
      toUserId: opponentId,
      status: "pending",
      payload: {
        challengeId,
        themeName: themeSummary,
        duelDifficultyPreset,
      },
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
      trigger: "immediate_challenge_invite",
      toUserId: opponentId,
      fromUserId: challenger._id,
      challengeId,
    });

    return challengeId;
  },
});

export const getDuel = query({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const duel = await ctx.db.get(duelId);
    if (!duel) return null;

    const isChallenger = auth.user._id === duel.challengerId;
    const isOpponent = auth.user._id === duel.opponentId;
    if (!isChallenger && !isOpponent) return null;

    const [challenger, opponent] = await Promise.all([
      ctx.db.get(duel.challengerId),
      ctx.db.get(duel.opponentId),
    ]);
    const viewerRole = isChallenger ? "challenger" : "opponent";

    const themes = await loadThemesByIds(ctx, duel.themeIds);
    const theme = themes.length === 1 ? themes[0] : null;

    return {
      duel,
      theme,
      themes: themes.map((sessionTheme) => ({ _id: sessionTheme._id, name: sessionTheme.name })),
      themeSummary: summarizeSessionWords(duel.sessionWords),
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

export const getChallenge = query({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const challenge = await ctx.db.get(challengeId);
    if (!challenge) return null;
    if (challenge.challengerId !== auth.user._id && challenge.opponentId !== auth.user._id) {
      return null;
    }
    return { challenge };
  },
});

export const getPendingChallenges = query({
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

export const acceptChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const { challenge, isOpponent } = await getChallengeParticipant(ctx, challengeId);

    if (!isOpponent) {
      throw new Error("Only opponent can accept challenge");
    }
    if (challenge.status !== "pending") {
      throw new Error("Challenge is not pending");
    }

    const now = Date.now();
    const duelId = await insertDuelSessionForChallenge(ctx, challenge, now);
    await ctx.db.patch(challengeId, {
      status: "accepted",
      acceptedAt: now,
      resolvedAt: now,
      duelId,
    });
    return { duelId };
  },
});

export const declineChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const { challenge, isOpponent } = await getChallengeParticipant(ctx, challengeId);

    if (!isOpponent) {
      throw new Error("Only opponent can decline challenge");
    }
    if (challenge.status !== "pending") {
      throw new Error("Challenge is not pending");
    }

    await ctx.db.patch(challengeId, { status: "declined", resolvedAt: Date.now() });
  },
});

export const stopDuel = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);
    if (duel.status !== "active") return;
    await ctx.db.patch(duelId, { status: "stopped" });
  },
});

export const cancelChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const { challenge, isChallenger } = await getChallengeParticipant(ctx, challengeId);

    if (!isChallenger) {
      throw new Error("Only challenger can cancel a pending challenge");
    }
    if (challenge.status !== "pending") {
      throw new Error("Can only cancel pending challenges");
    }

    await ctx.db.patch(challengeId, { status: "cancelled", resolvedAt: Date.now() });

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_type", (q) =>
        q.eq("type", "challenge_invite").eq("toUserId", challenge.opponentId)
      )
      .collect();

    for (const notification of notifications) {
      if (
        (notification.status === "pending" || notification.status === "read") &&
        isChallengeInvitePayload(notification.payload) &&
        notification.payload.challengeId === challengeId
      ) {
        await ctx.db.patch(notification._id, { status: "dismissed" });
      }
    }
  },
});

export const acceptChallengeFromNotification = mutation({
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
    if (notification.type !== "challenge_invite") {
      throw new Error("Invalid notification type");
    }
    const payload = notification.payload;
    if (!isChallengeInvitePayload(payload)) {
      throw new Error("Challenge ID not found in notification");
    }

    const challenge = await ctx.db.get(payload.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }
    if (challenge.status !== "pending") {
      throw new Error("Challenge is no longer pending");
    }
    if (challenge.opponentId !== user._id) {
      throw new Error("Not authorized");
    }

    const now = Date.now();
    const duelId = await insertDuelSessionForChallenge(ctx, challenge, now);
    await ctx.db.patch(challenge._id, {
      status: "accepted",
      acceptedAt: now,
      resolvedAt: now,
      duelId,
    });

    await ctx.db.patch(args.notificationId, {
      status: "dismissed",
    });

    return { success: true, duelId };
  },
});

export const declineChallengeFromNotification = mutation({
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
    if (notification.type !== "challenge_invite") {
      throw new Error("Invalid notification type");
    }
    const payload = notification.payload;
    if (!isChallengeInvitePayload(payload)) {
      throw new Error("Challenge ID not found in notification");
    }

    const challenge = await ctx.db.get(payload.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }
    if (challenge.status !== "pending") {
      throw new Error("Challenge is no longer pending");
    }
    if (challenge.opponentId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(challenge._id, {
      status: "declined",
      resolvedAt: Date.now(),
    });

    await ctx.db.patch(args.notificationId, {
      status: "dismissed",
    });

    return { success: true };
  },
});

/**
 * Auto-dismiss stale challenge invite notifications and cancel unresolved challenges.
 */
export const cleanupExpiredChallengeInvites = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - CHALLENGE_INVITE_TTL_MS;

    const expiredPendingNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status_createdAt", (q) =>
        q.eq("type", "challenge_invite").eq("status", "pending").lt("createdAt", cutoff)
      )
      .collect();

    const expiredReadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_type_status_createdAt", (q) =>
        q.eq("type", "challenge_invite").eq("status", "read").lt("createdAt", cutoff)
      )
      .collect();

    const notifications = [...expiredPendingNotifications, ...expiredReadNotifications];
    const resolvedChallengeIds = new Set<string>();

    for (const notification of notifications) {
      if (!isCreatedAtExpired(notification.createdAt, now, CHALLENGE_INVITE_TTL_MS)) continue;
      if (!isChallengeInvitePayload(notification.payload)) continue;

      const challengeId = notification.payload.challengeId;
      const challengeKey = String(challengeId);

      if (!resolvedChallengeIds.has(challengeKey)) {
        const challenge = await ctx.db.get(challengeId);
        if (challenge?.status === "pending") {
          await ctx.db.patch(challengeId, { status: "cancelled", resolvedAt: now });
        }
        resolvedChallengeIds.add(challengeKey);
      }

      await ctx.db.patch(notification._id, { status: "dismissed" });
    }
  },
});
