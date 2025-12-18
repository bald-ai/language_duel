"use client";

import type { Id } from "@/convex/_generated/dataModel";
import type { FriendWithDetails } from "@/convex/friends";

interface FriendsListProps {
  friends: FriendWithDetails[];
  removingId: Id<"users"> | null;
  onRemove: (friendId: Id<"users">) => void;
}

export function FriendsList({ friends, removingId, onRemove }: FriendsListProps) {
  if (friends.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No friends yet</p>
        <p className="text-gray-600 text-sm mt-2">
          Search for users to add them as friends
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {friends.map((friend) => {
        const displayName = friend.nickname && friend.discriminator
          ? `${friend.nickname}#${friend.discriminator}`
          : friend.email;

        const isRemoving = removingId === friend.friendId;

        return (
          <div
            key={friend.friendshipId}
            className="bg-gray-800/50 border-2 border-gray-700 rounded-xl p-4 flex items-center gap-4"
          >
            {friend.imageUrl ? (
              <img
                src={friend.imageUrl}
                alt=""
                className="w-12 h-12 rounded-full border-2 border-amber-500/50"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-700 border-2 border-amber-500/50 flex items-center justify-center">
                <span className="text-amber-400 text-lg font-bold">
                  {(friend.nickname || friend.email)[0].toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{displayName}</p>
              {friend.nickname && (
                <p className="text-sm text-gray-500 truncate">{friend.email}</p>
              )}
            </div>

            <button
              onClick={() => onRemove(friend.friendId)}
              disabled={isRemoving}
              className="px-3 py-1 bg-red-500/15 text-red-200 rounded-lg text-sm font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRemoving ? "..." : "Remove"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

