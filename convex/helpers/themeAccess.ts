import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { hasThemeAccess } from "../../lib/themeAccess";
import { loadFriendshipsBetweenUsers } from "./relationshipPolicy";

type CtxWithDb = QueryCtx | MutationCtx;

export async function loadThemeWithViewerAccess(
  ctx: CtxWithDb,
  userId: Id<"users">,
  themeId: Id<"themes">
): Promise<Doc<"themes"> | null> {
  return createThemeAccessLoader(ctx, userId)(themeId);
}

/** Cache only within one query/mutation, so multiple themes share access reads. */
export function createThemeAccessLoader(ctx: CtxWithDb, userId: Id<"users">) {
  let history: ReturnType<typeof loadThemeAccessHistory> | undefined;
  const friendshipsByOwner = new Map<Id<"users">, ReturnType<typeof loadFriendshipsBetweenUsers>>();
  return async (themeId: Id<"themes">): Promise<Doc<"themes"> | null> => {
    const theme = await ctx.db.get(themeId);
    if (!theme || theme.ownerId === userId) return theme;
    history ??= loadThemeAccessHistory(ctx, userId);
    const access = {
      userId,
      theme: { themeId: theme._id, ownerId: theme.ownerId, visibility: theme.visibility },
      ...await history,
    };
    if (hasThemeAccess({ ...access, friendships: [] })) return theme;
    if (theme.visibility !== "shared" || !theme.ownerId) return null;
    let friendships = friendshipsByOwner.get(theme.ownerId);
    if (!friendships) {
      friendships = loadFriendshipsBetweenUsers(ctx, userId, theme.ownerId);
      friendshipsByOwner.set(theme.ownerId, friendships);
    }
    return hasThemeAccess({ ...access, friendships: await friendships }) ? theme : null;
  };
}

async function loadThemeAccessHistory(ctx: CtxWithDb, userId: Id<"users">) {
  const [
    challengesAsChallenger,
    challengesAsOpponent,
    duelsAsChallenger,
    duelsAsOpponent,
    soloPracticeSessions,
    goalsAsCreator,
    goalsAsPartner,
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
  ]);

  return {
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
  };
}
