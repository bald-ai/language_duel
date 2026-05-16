import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { areUsersFriends } from "../../lib/relationshipPolicy";

type CtxWithDb = QueryCtx | MutationCtx;

export async function loadFriendshipsBetweenUsers(
  ctx: CtxWithDb,
  userId: Id<"users">,
  targetUserId: Id<"users">
) {
  const [fromUser, fromTarget] = await Promise.all([
    ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("friendId"), targetUserId))
      .collect(),
    ctx.db
      .query("friends")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .filter((q) => q.eq(q.field("friendId"), userId))
      .collect(),
  ]);

  return [...fromUser, ...fromTarget].map((friendship) => ({
    userId: friendship.userId,
    friendId: friendship.friendId,
  }));
}

export async function areUsersFriendsInDb(
  ctx: CtxWithDb,
  userId: Id<"users">,
  targetUserId: Id<"users">
): Promise<boolean> {
  const friendships = await loadFriendshipsBetweenUsers(ctx, userId, targetUserId);
  return areUsersFriends(userId, targetUserId, friendships);
}
