"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";
import { Avatar } from "@/app/components/Avatar";

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
    <div 
      className="rounded-xl p-4 flex items-center gap-4 border-2"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.light,
      }}
    >
      <Avatar
        src={imageUrl}
        name={nickname || email}
        size={48}
        borderColor={colors.primary.dark}
      />

      <div className="flex-1 min-w-0">
        <p className="font-bold truncate" style={{ color: colors.text.DEFAULT }}>
          {displayName}
        </p>
        {nickname && (
          <p className="text-sm truncate" style={{ color: colors.text.muted }}>
            {email}
          </p>
        )}
      </div>

      <div className="shrink-0">
        {isFriend ? (
          <span 
            className="px-3 py-1.5 rounded-lg text-sm font-medium border"
            style={{
              backgroundColor: "transparent",
              borderColor: colors.status.success.DEFAULT,
              color: colors.status.success.DEFAULT,
            }}
          >
            Friends
          </span>
        ) : isPending ? (
          <span 
            className="px-3 py-1.5 rounded-lg text-sm font-medium border"
            style={{
              backgroundColor: "transparent",
              borderColor: colors.text.muted,
              color: colors.text.muted,
            }}
          >
            Pending
          </span>
        ) : (
          <button
            onClick={() => onAddFriend(userId)}
            disabled={isSending}
            className="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: colors.primary.DEFAULT,
              color: "white",
            }}
          >
            {isSending ? "..." : "+ Add"}
          </button>
        )}
      </div>
    </div>
  );
}
