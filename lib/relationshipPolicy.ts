import type { Id } from "./types";

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
