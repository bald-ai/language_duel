"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";

interface Friend {
  friendId: Id<"users">;
  nickname?: string;
  email: string;
  imageUrl?: string;
}

interface PartnerSelectorProps {
  friends: Friend[];
  selectedId: Id<"users"> | null;
  onSelect: (id: Id<"users">) => void;
}

export function PartnerSelector({
  friends,
  selectedId,
  onSelect,
}: PartnerSelectorProps) {
  if (friends.length === 0) {
    return (
      <div
        className="text-center p-6 border-2 rounded-2xl"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <p className="text-sm" style={{ color: colors.text.muted }}>
          No friends yet. Add friends first to create a goal together.
        </p>
      </div>
    );
  }

  return (
    <div
      className="border-2 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
    >
      <div
        className="px-4 py-2 border-b-2"
        style={{ borderColor: colors.primary.dark }}
      >
        <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: colors.text.muted }}>
          Select Partner
        </p>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {friends.map((friend, index) => {
          const isSelected = selectedId === friend.friendId;
          return (
            <button
              key={friend.friendId}
              onClick={() => onSelect(friend.friendId)}
              className="w-full text-left px-4 py-3 transition hover:brightness-110 flex items-center justify-between"
              style={{
                backgroundColor: isSelected ? `${colors.cta.DEFAULT}1A` : "transparent",
                borderBottom:
                  index < friends.length - 1
                    ? `1px solid ${colors.primary.dark}`
                    : undefined,
              }}
              data-testid={`goals-partner-${friend.friendId}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    backgroundColor: colors.primary.DEFAULT,
                    color: colors.text.DEFAULT,
                  }}
                >
                  {friend.nickname?.charAt(0).toUpperCase() ||
                    friend.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div
                    className="font-semibold text-sm truncate"
                    style={{
                      color: isSelected ? colors.cta.light : colors.text.DEFAULT,
                    }}
                  >
                    {friend.nickname || friend.email.split("@")[0]}
                  </div>
                  {friend.nickname && (
                    <div className="text-xs" style={{ color: colors.text.muted }}>
                      {friend.email}
                    </div>
                  )}
                </div>
              </div>
              {isSelected && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.cta.DEFAULT }}
                >
                  <svg className="w-3 h-3" fill="white" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
