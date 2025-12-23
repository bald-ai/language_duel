"use client";

import type { Id } from "@/convex/_generated/dataModel";
import type { FriendWithDetails } from "@/convex/friends";
import { colors } from "@/lib/theme";
import { Avatar } from "@/app/components/Avatar";

interface FriendsListProps {
  friends: FriendWithDetails[];
  removingId: Id<"users"> | null;
  onRemove: (friendId: Id<"users">) => void;
}

export function FriendsList({ friends, removingId, onRemove }: FriendsListProps) {
  if (friends.length === 0) {
    return (
      <div className="text-center py-12">
        <p style={{ color: colors.text.muted }}>No friends yet</p>
        <p className="text-sm mt-2" style={{ color: colors.neutral.dark }}>
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
            className="rounded-xl p-4 flex items-center gap-4 border-2"
            style={{
              backgroundColor: `${colors.primary.dark}40`,
              borderColor: colors.primary.dark,
            }}
          >
            <Avatar
              src={friend.imageUrl}
              name={friend.nickname || friend.email}
              size={48}
              borderColor={colors.neutral.DEFAULT}
            />

            <div className="flex-1 min-w-0">
              <p className="font-bold truncate" style={{ color: colors.text.DEFAULT }}>
                {displayName}
              </p>
              {friend.nickname && (
                <p className="text-sm truncate" style={{ color: colors.text.muted }}>
                  {friend.email}
                </p>
              )}
            </div>

            <button
              onClick={() => onRemove(friend.friendId)}
              disabled={isRemoving}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: `${colors.cta.dark}30`,
                color: colors.cta.light,
              }}
            >
              {isRemoving ? "..." : "Remove"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
