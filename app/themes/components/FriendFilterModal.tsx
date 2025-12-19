"use client";

/* eslint-disable @next/next/no-img-element */
import type { Id } from "@/convex/_generated/dataModel";
import type { FriendWithDetails } from "@/convex/friends";

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-300">Filter Themes</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
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
            className="w-full p-4 mb-3 bg-amber-600/20 border-2 border-amber-500/30 rounded-xl text-left hover:bg-amber-600/30 transition-colors"
          >
            <span className="font-bold text-amber-400">Show All Themes</span>
            <p className="text-sm text-gray-500 mt-1">
              View your themes and all friends&apos; shared themes
            </p>
          </button>

          {/* My Themes Only Option */}
          <button
            onClick={onShowMyThemes}
            className="w-full p-4 mb-3 bg-blue-600/20 border-2 border-blue-500/30 rounded-xl text-left hover:bg-blue-600/30 transition-colors"
          >
            <span className="font-bold text-blue-400">My Themes Only</span>
            <p className="text-sm text-gray-500 mt-1">
              View only themes you created
            </p>
          </button>

          {friends.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No friends yet</p>
              <p className="text-sm text-gray-600 mt-1">
                Add friends to filter by their shared themes
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-2 px-1">Friends&apos; themes:</p>
              {friends.map((friend) => {
                const displayName = friend.nickname && friend.discriminator
                  ? `${friend.nickname}#${friend.discriminator}`
                  : friend.email;

                return (
                  <button
                    key={friend.friendId}
                    onClick={() => onSelectFriend(friend.friendId)}
                    className="w-full p-3 bg-gray-800/50 border-2 border-gray-700 rounded-xl flex items-center gap-3 hover:bg-gray-700/50 hover:border-gray-600 transition-colors"
                  >
                    {friend.imageUrl ? (
                      <img
                        src={friend.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-full border-2 border-gray-600"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
                        <span className="text-gray-400 font-bold">
                          {(friend.nickname || friend.email)[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-white truncate">{displayName}</p>
                      {friend.nickname && (
                        <p className="text-sm text-gray-500 truncate">{friend.email}</p>
                      )}
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-500"
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
