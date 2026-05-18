import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { hasThemeAccess } from "../../lib/themeAccess";

type CtxWithDb = QueryCtx | MutationCtx;

export async function loadThemeWithViewerAccess(
  ctx: CtxWithDb,
  userId: Id<"users">,
  themeId: Id<"themes">
): Promise<Doc<"themes"> | null> {
  const theme = await ctx.db.get(themeId);
  if (!theme) return null;

  return await canViewTheme(ctx, userId, theme) ? theme : null;
}

export async function canViewTheme(
  ctx: CtxWithDb,
  userId: Id<"users">,
  theme: Doc<"themes">
): Promise<boolean> {
  const [
    challengesAsChallenger,
    challengesAsOpponent,
    duelsAsChallenger,
    duelsAsOpponent,
    soloPracticeSessions,
    goalsAsCreator,
    goalsAsPartner,
    friendshipsFromUser,
    friendshipsToUser,
  ] = await Promise.all([
    ctx.db
      .query("challenges")
      .withIndex("by_challenger", (q) => q.eq("challengerId", userId))
      .collect(),
    ctx.db
      .query("challenges")
      .withIndex("by_opponent", (q) => q.eq("opponentId", userId))
      .collect(),
    ctx.db
      .query("duels")
      .withIndex("by_challenger", (q) => q.eq("challengerId", userId))
      .collect(),
    ctx.db
      .query("duels")
      .withIndex("by_opponent", (q) => q.eq("opponentId", userId))
      .collect(),
    ctx.db
      .query("soloPracticeSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .collect(),
    ctx.db
      .query("weeklyGoals")
      .withIndex("by_partner", (q) => q.eq("partnerId", userId))
      .collect(),
    theme.ownerId
      ? ctx.db
          .query("friends")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .filter((q) => q.eq(q.field("friendId"), theme.ownerId!))
          .collect()
      : Promise.resolve([]),
    theme.ownerId
      ? ctx.db
          .query("friends")
          .withIndex("by_user", (q) => q.eq("userId", theme.ownerId!))
          .filter((q) => q.eq(q.field("friendId"), userId))
          .collect()
      : Promise.resolve([]),
  ]);

  return hasThemeAccess({
    userId,
    theme: {
      themeId: theme._id,
      ownerId: theme.ownerId,
      visibility: theme.visibility,
    },
    challenges: [...challengesAsChallenger, ...challengesAsOpponent].map((challenge) => ({
      challengerId: challenge.challengerId,
      opponentId: challenge.opponentId,
      themeIds: challenge.themeIds,
    })),
    duels: [...duelsAsChallenger, ...duelsAsOpponent].map((duel) => ({
      challengerId: duel.challengerId,
      opponentId: duel.opponentId,
      themeIds: duel.themeIds,
    })),
    soloPracticeSessions: soloPracticeSessions.map((session) => ({
      userId: session.userId,
      themeIds: session.themeIds,
    })),
    weeklyGoals: [...goalsAsCreator, ...goalsAsPartner].map((goal) => ({
      creatorId: goal.creatorId,
      partnerId: goal.partnerId,
      status: goal.status,
      themeIds: goal.themes.map((goalTheme) => goalTheme.themeId),
    })),
    friendships: [...friendshipsFromUser, ...friendshipsToUser].map((friendship) => ({
      userId: friendship.userId,
      friendId: friendship.friendId,
    })),
  });
}

export async function shouldListTheme(
  ctx: CtxWithDb,
  userId: Id<"users">,
  theme: Doc<"themes">,
  archivedThemeIds: Set<Id<"themes">>,
  archivedOnly: boolean | undefined
): Promise<boolean> {
  const isArchived = archivedThemeIds.has(theme._id);
  if (archivedOnly ? !isArchived : isArchived) {
    return false;
  }

  return await canViewTheme(ctx, userId, theme);
}
