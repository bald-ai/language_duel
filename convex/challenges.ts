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
  challengeToDuelSourceFields,
} from "./helpers/sessionCreation";
import {
  loadThemesByIds,
} from "./helpers/sessionItems";
import { loadWeeklyGoalSessionThemesByThemeIds } from "./helpers/weeklyGoalSnapshots";
import { resolveAccessibleThemes } from "./helpers/resolveAccessibleThemes";
import { areUsersFriendsInDb } from "./helpers/relationshipPolicy";
import { SELF_DUEL_FORCED_MODE } from "../lib/duel/selfDuel";
import type { DuelDifficultyPreset } from "../lib/difficultyUtils";
import {
  createChallengeInviteNotificationAndEmail,
  dismissChallengeInviteNotificationsByChallengeId,
  isChallengeInvitePayload,
  requireCallerOwnedNotificationPayload,
} from "./notificationHelpers";
import { CHALLENGE_INVITE_TTL_MS } from "./constants";
import { duelModeValidator } from "./schema";
import { isSentenceTheme } from "../lib/themes/themeContent";
import { isCreatedAtExpired } from "../lib/cleanupExpiry";
import { buildSessionItems, summarizeThemes } from "../lib/sessionItems";
import { calculateStartingLives } from "../lib/limitedLives";
import { toUserSummary } from "./helpers/userSummary";
import { DUEL_MODE_LABELS } from "../lib/duelMode";

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

  const sessionItems = buildSessionItems(themes);
  if (sessionItems.length === 0) {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Challenge has no playable words" });
  }
  return sessionItems;
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
  const sessionItems = await buildDuelWordsForChallenge(ctx, challenge);
  const livesTotal = challenge.sourceType === "boss"
    ? await resolveBossChallengeLives(ctx, challenge)
    : challenge.sourceType === "spaced_repetition"
      ? await resolveSpacedRepetitionLives(ctx, challenge)
      : undefined;

  return await ctx.db.insert("duels", buildDuelSession({
    challengeId: challenge._id,
    challengerId: challenge.challengerId,
    opponentId: challenge.opponentId,
    sessionItems,
    livesTotal,
    livesRemaining: livesTotal,
    duelDifficultyPreset: challenge.duelDifficultyPreset,
    duelMode: challenge.duelMode,
    createdAt: now,
    ...challengeToDuelSourceFields(challenge),
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

/**
 * Shared guard for responding to a challenge invite (accept or decline): the
 * caller must be the invited opponent and the invite must still be pending.
 * Expiry is checked separately because only accept is gated on it — declining
 * an expired-but-pending invite should still dismiss it.
 */
function assertRespondableByOpponent(
  challenge: Doc<"challenges">,
  userId: Id<"users">
) {
  if (challenge.opponentId !== userId) {
    throw new ConvexError({
      code: "NOT_AUTHORIZED",
      message: "Only the invited opponent can respond to this challenge",
    });
  }
  if (challenge.status !== "pending") {
    throw new ConvexError({
      code: "INVALID_STATE",
      message: "Challenge is no longer pending",
    });
  }
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
    duelMode: duelModeValidator,
  },
  handler: async (ctx, { opponentId, themeIds, duelDifficultyPreset, duelMode }) => {
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

    const resolvedThemes = await resolveAccessibleThemes(ctx, challenger._id, themeIds);

    // TbT is a sentence-only mode (one shared tile board). Reject non-sentence
    // themes at challenge creation for a fast, clear error.
    if (duelMode === "tbt" && resolvedThemes.some((theme) => !isSentenceTheme(theme))) {
      throw new ConvexError({
        code: "TBT_REQUIRES_SENTENCES",
        message: `${DUEL_MODE_LABELS.tbt} duels require sentence themes`,
      });
    }

    const orderedThemeIds = resolvedThemes.map((theme) => theme._id);

    const now = Date.now();
    const challengeId = await ctx.db.insert("challenges", buildChallengeInvite({
      challengerId: challenger._id,
      opponentId,
      themeIds: orderedThemeIds,
      sourceType: "normal",
      duelDifficultyPreset,
      duelMode,
      createdAt: now,
    }));

    const themeSummary = summarizeThemes(resolvedThemes);

    await createChallengeInviteNotificationAndEmail(ctx, {
      challengerId: challenger._id,
      opponentId,
      challengeId,
      themeName: themeSummary,
      duelDifficultyPreset,
      duelMode,
      createdAt: now,
    });

    return challengeId;
  },
});

export const createSelfDuel = mutation({
  args: {
    themeIds: v.array(v.id("themes")),
    duelDifficultyPreset: v.optional(
      v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard")
      )
    ),
  },
  handler: async (ctx, { themeIds, duelDifficultyPreset }) => {
    const { user } = await getAuthenticatedUser(ctx);

    // Access and words come from the same load: pass resolveAccessibleThemes' result
    // straight to buildSessionItems so theme-access checks and word sourcing stay in sync.
    const themes = await resolveAccessibleThemes(ctx, user._id, themeIds);
    const sessionItems = buildSessionItems(themes);
    if (sessionItems.length === 0) {
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Self-duel has no playable words",
      });
    }

    const now = Date.now();
    const duelId = await ctx.db.insert(
      "duels",
      buildDuelSession({
        sourceType: "normal",
        challengeId: undefined,
        challengerId: user._id,
        opponentId: user._id,
        sessionItems,
        duelMode: SELF_DUEL_FORCED_MODE,
        duelDifficultyPreset: duelDifficultyPreset as DuelDifficultyPreset | undefined,
        createdAt: now,
      })
    );

    return { duelId };
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
    const { challenge, user } = await getChallengeParticipant(ctx, challengeId);
    assertRespondableByOpponent(challenge, user._id);

    const now = Date.now();
    rejectExpiredChallenge(challenge, now);
    const { duelId } = await acceptChallengeCore(ctx, challenge, now);
    return { duelId };
  },
});

export const declineChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const { challenge, user } = await getChallengeParticipant(ctx, challengeId);
    assertRespondableByOpponent(challenge, user._id);

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
    assertRespondableByOpponent(challenge, user._id);

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
    assertRespondableByOpponent(challenge, user._id);

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
