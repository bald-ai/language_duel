"use client";

import type { Id } from "@/convex/_generated/dataModel";
import type { FriendWithDetails } from "@/convex/friends";
import { colors } from "@/lib/theme";
import { Avatar } from "@/app/components/Avatar";

interface FriendFilterModalProps {
  isOpen: boolean;
  friends: FriendWithDetails[];
  onSelectFriend: (friendId: Id<"users">) => void;
  onShowAll: () => void;
  onShowMyThemes: () => void;
  onClose: () => void;
}

export function FriendFilterModal({
  isOpen,
  friends,
  onSelectFriend,
  onShowAll,
  onShowMyThemes,
  onClose,
}: FriendFilterModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      data-testid="theme-friend-filter-modal"
    >
      <div
        className="border-2 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col backdrop-blur-sm"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 20px 60px ${colors.primary.glow}`,
        }}
      >
        {/* Header */}
        <div
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: colors.primary.dark }}
        >
          <h2 className="title-font text-lg font-bold" style={{ color: colors.text.DEFAULT }}>
            Filter Themes
          </h2>
          <button
            onClick={onClose}
            className="p-1 transition hover:brightness-110"
            style={{ color: colors.text.muted }}
            data-testid="theme-friend-filter-close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Show All Option */}
          <button
            onClick={onShowAll}
            className="w-full p-4 mb-3 border-2 rounded-xl text-left transition hover:brightness-110"
            style={{
              backgroundColor: `${colors.primary.DEFAULT}1A`,
              borderColor: `${colors.primary.DEFAULT}66`,
            }}
            data-testid="theme-filter-all"
          >
            <span className="font-bold" style={{ color: colors.text.DEFAULT }}>
              Show All Themes
            </span>
            <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
              View your themes and all friends&apos; shared themes
            </p>
          </button>

          {/* My Themes Only Option */}
          <button
            onClick={onShowMyThemes}
            className="w-full p-4 mb-3 border-2 rounded-xl text-left transition hover:brightness-110"
            style={{
              backgroundColor: `${colors.secondary.DEFAULT}1A`,
              borderColor: `${colors.secondary.DEFAULT}66`,
            }}
            data-testid="theme-filter-mine"
          >
            <span className="font-bold" style={{ color: colors.secondary.light }}>
              My Themes Only
            </span>
            <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
              View only themes you created
            </p>
          </button>

          {friends.length === 0 ? (
            <div className="text-center py-8">
              <p style={{ color: colors.text.muted }}>No friends yet</p>
              <p className="text-sm mt-1" style={{ color: colors.neutral.dark }}>
                Add friends to filter by their shared themes
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm mb-2 px-1" style={{ color: colors.text.muted }}>
                Friends&apos; themes:
              </p>
              {friends.map((friend) => {
                const displayName = friend.nickname && friend.discriminator
                  ? `${friend.nickname}#${friend.discriminator}`
                  : friend.email;

                return (
                  <button
                    key={friend.friendId}
                    onClick={() => onSelectFriend(friend.friendId)}
                    className="w-full p-3 border-2 rounded-xl flex items-center gap-3 transition hover:brightness-110"
                    style={{
                      backgroundColor: colors.background.DEFAULT,
                      borderColor: colors.primary.dark,
                    }}
                    data-testid={`theme-filter-friend-${friend.friendId}`}
                  >
                    <Avatar
                      src={friend.imageUrl}
                      name={friend.nickname || friend.email}
                      size={40}
                      borderColor={colors.primary.dark}
                    />
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate" style={{ color: colors.text.DEFAULT }}>
                        {displayName}
                      </p>
                      {friend.nickname && (
                        <p className="text-sm truncate" style={{ color: colors.text.muted }}>
                          {friend.email}
                        </p>
                      )}
                    </div>
                    <svg
                      className="w-5 h-5"
                      style={{ color: colors.text.muted }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
