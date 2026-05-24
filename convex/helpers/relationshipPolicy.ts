import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { areUsersFriends } from "../../lib/relationshipPolicy";

type CtxWithDb = QueryCtx | MutationCtx;

/**
 * Load the (at most two) friendship rows between two users via the indexed pair
 * query — O(1) per direction rather than scanning a user's whole friend list.
 * Returns the full docs so callers that need to delete can use `_id`.
 */
export async function loadFriendshipDocsBetweenUsers(
  ctx: CtxWithDb,
  userId: Id<"users">,
  targetUserId: Id<"users">
): Promise<Doc<"friends">[]> {
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

  return [...fromUser, ...fromTarget];
}

export async function loadFriendshipsBetweenUsers(
  ctx: CtxWithDb,
  userId: Id<"users">,
  targetUserId: Id<"users">
) {
  const friendships = await loadFriendshipDocsBetweenUsers(ctx, userId, targetUserId);
  return friendships.map((friendship) => ({
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
