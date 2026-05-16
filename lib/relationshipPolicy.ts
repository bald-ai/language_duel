import type { Id } from "../convex/_generated/dataModel";

export type FriendshipPair = {
  userId: Id<"users">;
  friendId: Id<"users">;
};

export function areUsersFriends(
  userId: Id<"users">,
  targetUserId: Id<"users">,
  friendships: FriendshipPair[]
): boolean {
  return friendships.some(
    (friendship) =>
      (friendship.userId === userId && friendship.friendId === targetUserId) ||
      (friendship.userId === targetUserId && friendship.friendId === userId)
  );
}

export function canCreateNormalChallenge(
  challengerId: Id<"users">,
  opponentId: Id<"users">,
  friendships: FriendshipPair[]
): boolean {
  if (challengerId === opponentId) {
    return false;
  }

  return areUsersFriends(challengerId, opponentId, friendships);
}
