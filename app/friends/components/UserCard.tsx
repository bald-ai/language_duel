"use client";

import type { Id } from "@/convex/_generated/dataModel";

interface UserCardProps {
  userId: Id<"users">;
  nickname?: string;
  discriminator?: number;
  email: string;
  imageUrl?: string;
  isFriend?: boolean;
  isPending?: boolean;
  isSending?: boolean;
  onAddFriend: (userId: Id<"users">) => void;
}

export function UserCard({
  userId,
  nickname,
  discriminator,
  email,
  imageUrl,
  isFriend,
  isPending,
  isSending,
  onAddFriend,
}: UserCardProps) {
  const displayName = nickname && discriminator
    ? `${nickname}#${discriminator}`
    : email;

  return (
    <div className="bg-gray-800/50 border-2 border-gray-700 rounded-xl p-4 flex items-center gap-4">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="w-12 h-12 rounded-full border-2 border-gray-600"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
          <span className="text-gray-400 text-lg font-bold">
            {(nickname || email)[0].toUpperCase()}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-bold text-white truncate">{displayName}</p>
        {nickname && (
          <p className="text-sm text-gray-500 truncate">{email}</p>
        )}
      </div>

      <div className="shrink-0">
        {isFriend ? (
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium">
            Friends
          </span>
        ) : isPending ? (
          <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium">
            Pending
          </span>
        ) : (
          <button
            onClick={() => onAddFriend(userId)}
            disabled={isSending}
            className="px-3 py-1 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? "Sending..." : "+ Add"}
          </button>
        )}
      </div>
    </div>
  );
}

