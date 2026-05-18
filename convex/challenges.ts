/**
 * Challenge lobby mutations for creating, accepting, declining, and cancelling
 * person-to-person duel invites.
 */

import { query, mutation, internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import {
  getAuthenticatedUser,
  getAuthenticatedUserOrNull,
  getChallengeParticipant,
} from "./helpers/auth";
import {
  buildChallengeInvite,
  buildDuelSession,
} from "./helpers/sessionCreation";
import {
  loadThemesByIds,
} from "./helpers/sessionWords";
import { loadWeeklyGoalSessionThemesByThemeIds } from "./helpers/weeklyGoalSnapshots";
import { loadThemeWithViewerAccess } from "./helpers/themeAccess";
import { areUsersFriendsInDb } from "./helpers/relationshipPolicy";
import {
  createChallengeInviteNotificationAndEmail,
  dismissChallengeInviteNotificationsByChallengeId,
  isChallengeInvitePayload,
  requireCallerOwnedNotificationPayload,
} from "./notificationHelpers";
import { CHALLENGE_INVITE_TTL_MS } from "./constants";
import { isCreatedAtExpired } from "../lib/cleanupExpiry";
import { buildSessionWords, summarizeThemes } from "../lib/sessionWords";
import { calculateStartingLives } from "../lib/limitedLives";
import { toUserSummary } from "./helpers/userSummary";

type CtxWithDb = QueryCtx | MutationCtx;

async function buildDuelWordsForChallenge(
  ctx: CtxWithDb,
  challenge: Doc<"challenges">
) {
  const themes = challenge.weeklyGoalId
    ? await loadWeeklyGoalSessionThemesByThemeIds(
        ctx,
        await loadWeeklyGoalForSession(ctx, challenge.weeklyGoalId),
        challenge.themeIds
      )
    : await loadThemesByIds(ctx, challenge.themeIds);

  const sessionWords = buildSessionWords(themes);
  if (sessionWords.length === 0) {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Challenge has no playable words" });
  }
  return sessionWords;
}

async function loadWeeklyGoalForSession(
  ctx: CtxWithDb,
  weeklyGoalId: Id<"weeklyGoals">
): Promise<Doc<"weeklyGoals">> {
  const goal = await ctx.db.get(weeklyGoalId);
  if (!goal) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Weekly goal not found" });
  }
  return goal;
}

async function insertDuelSessionForChallenge(
  ctx: MutationCtx,
  challenge: Doc<"challenges">,
  now: number
): Promise<Id<"duels">> {
  const sessionWords = await buildDuelWordsForChallenge(ctx, challenge);
  const livesTotal = challenge.sourceType === "boss"
    ? await resolveBossChallengeLives(ctx, challenge)
    : challenge.sourceType === "spaced_repetition"
      ? await resolveSpacedRepetitionLives(ctx, challenge)
      : undefined;

  const baseSession = {
    challengeId: challenge._id,
    challengerId: challenge.challengerId,
    opponentId: challenge.opponentId,
    sessionWords,
    livesTotal: livesTotal,
    livesRemaining: livesTotal,
    duelDifficultyPreset: challenge.duelDifficultyPreset,
    createdAt: now,
  };

  if (challenge.sourceType === "boss") {
    if (!challenge.weeklyGoalId || !challenge.bossType) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Boss challenge is missing source fields" });
    }
    return await ctx.db.insert("duels", buildDuelSession({
      ...baseSession,
      sourceType: "boss",
      weeklyGoalId: challenge.weeklyGoalId,
      bossType: challenge.bossType,
    }));
  }

  if (challenge.sourceType === "spaced_repetition") {
    if (!challenge.weeklyGoalId || typeof challenge.spacedRepetitionStep !== "number") {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Spaced-repetition challenge is missing source fields" });
    }
    return await ctx.db.insert("duels", buildDuelSession({
      ...baseSession,
      sourceType: "spaced_repetition",
      weeklyGoalId: challenge.weeklyGoalId,
      spacedRepetitionStep: challenge.spacedRepetitionStep,
    }));
  }

  return await ctx.db.insert("duels", buildDuelSession({
    ...baseSession,
    sourceType: "normal",
  }));
}

async function acceptChallengeCore(
  ctx: MutationCtx,
  challenge: Doc<"challenges">,
  now: number
) {
  const duelId = await insertDuelSessionForChallenge(ctx, challenge, now);
  await ctx.db.patch(challenge._id, {
    status: "accepted",
    acceptedAt: now,
    resolvedAt: now,
    duelId,
  });
  await dismissChallengeInviteNotificationsByChallengeId(ctx, challenge._id, [challenge.opponentId]);
  return { duelId };
}

async function declineChallengeCore(
  ctx: MutationCtx,
  challenge: Doc<"challenges">,
  now: number
) {
  await ctx.db.patch(challenge._id, { status: "declined", resolvedAt: now });
  await dismissChallengeInviteNotificationsByChallengeId(ctx, challenge._id, [challenge.opponentId]);
}

function rejectExpiredChallenge(challenge: Doc<"challenges">, now: number) {
  if (!isCreatedAtExpired(challenge.createdAt, now, CHALLENGE_INVITE_TTL_MS)) return;
  throw new ConvexError({ code: "INVALID_STATE", message: "Challenge has expired" });
}

async function resolveBossChallengeLives(
  ctx: CtxWithDb,
  challenge: Doc<"challenges">
): Promise<number | undefined> {
  if (!challenge.weeklyGoalId || !challenge.bossType) return undefined;
  const goal = await ctx.db.get(challenge.weeklyGoalId);
  if (!goal) return undefined;
  return calculateStartingLives({
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

    if (opponentId === challenger._id) {
      throw new ConvexError({ code: "CANNOT_SELF_TARGET", message: "Cannot challenge yourself" });
    }

    const opponent = await ctx.db.get(opponentId);
    if (!opponent) throw new ConvexError({ code: "NOT_FOUND", message: "Opponent not found" });

    const areFriends = await areUsersFriendsInDb(ctx, challenger._id, opponentId);
    if (!areFriends) {
      throw new ConvexError({ code: "NOT_AUTHORIZED", message: "You can only challenge friends" });
    }

    const orderedThemeIds = Array.from(new Set(themeIds));
    if (orderedThemeIds.length === 0) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Select at least one theme" });
    }
    const themes: Array<Doc<"themes"> | null> = await Promise.all(
      orderedThemeIds.map((selectedThemeId) =>
        loadThemeWithViewerAccess(ctx, challenger._id, selectedThemeId)
      )
    );
    if (themes.some((theme) => !theme)) {
      throw new ConvexError({ code: "NOT_FOUND", message: "One or more themes were not found or are not accessible" });
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

    await createChallengeInviteNotificationAndEmail(ctx, {
      challengerId: challenger._id,
      opponentId,
      challengeId,
      themeName: themeSummary,
      duelDifficultyPreset,
      createdAt: now,
    });

    return challengeId;
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
      challenger: toUserSummary(challengersById.get(challenge.challengerId) ?? null),
    }));
  },
});

export const acceptChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const { challenge, isOpponent } = await getChallengeParticipant(ctx, challengeId);

    if (!isOpponent) {
      throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Only opponent can accept challenge" });
    }
    if (challenge.status !== "pending") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Challenge is not pending" });
    }

    const now = Date.now();
    rejectExpiredChallenge(challenge, now);
    const { duelId } = await acceptChallengeCore(ctx, challenge, now);
    return { duelId };
  },
});

export const declineChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const { challenge, isOpponent } = await getChallengeParticipant(ctx, challengeId);

    if (!isOpponent) {
      throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Only opponent can decline challenge" });
    }
    if (challenge.status !== "pending") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Challenge is not pending" });
    }

    await declineChallengeCore(ctx, challenge, Date.now());
  },
});

export const cancelChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const { challenge, isChallenger } = await getChallengeParticipant(ctx, challengeId);

    if (!isChallenger) {
      throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Only challenger can cancel a pending challenge" });
    }
    if (challenge.status !== "pending") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Can only cancel pending challenges" });
    }

    await ctx.db.patch(challengeId, { status: "cancelled", resolvedAt: Date.now() });
    await dismissChallengeInviteNotificationsByChallengeId(ctx, challengeId, [challenge.opponentId]);
  },
});

export const acceptChallengeFromNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const { payload } = await requireCallerOwnedNotificationPayload(ctx, {
      notificationId: args.notificationId,
      userId: user._id,
      type: "challenge_invite",
      payloadGuard: isChallengeInvitePayload,
      missingPayloadMessage: "Challenge ID not found in notification",
    });

    const challenge = await ctx.db.get(payload.challengeId);
    if (!challenge) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Challenge not found" });
    }
    if (challenge.status !== "pending") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Challenge is no longer pending" });
    }
    if (challenge.opponentId !== user._id) {
      throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
    }

    const now = Date.now();
    rejectExpiredChallenge(challenge, now);
    const { duelId } = await acceptChallengeCore(ctx, challenge, now);

    return { success: true, duelId };
  },
});

export const declineChallengeFromNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthenticatedUser(ctx);

    const { payload } = await requireCallerOwnedNotificationPayload(ctx, {
      notificationId: args.notificationId,
      userId: user._id,
      type: "challenge_invite",
      payloadGuard: isChallengeInvitePayload,
      missingPayloadMessage: "Challenge ID not found in notification",
    });

    const challenge = await ctx.db.get(payload.challengeId);
    if (!challenge) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Challenge not found" });
    }
    if (challenge.status !== "pending") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Challenge is no longer pending" });
    }
    if (challenge.opponentId !== user._id) {
      throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
    }

    await declineChallengeCore(ctx, challenge, Date.now());

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

    const expiredChallenges = await ctx.db
      .query("challenges")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    for (const challenge of expiredChallenges) {
      if (!isCreatedAtExpired(challenge.createdAt, now, CHALLENGE_INVITE_TTL_MS)) continue;

      await ctx.db.patch(challenge._id, { status: "cancelled", resolvedAt: now });
      await dismissChallengeInviteNotificationsByChallengeId(ctx, challenge._id, [challenge.opponentId]);
    }
  },
});
