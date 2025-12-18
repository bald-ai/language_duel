"use client";

import type { CurrentUser } from "@/convex/users";

interface ProfileCardProps {
  user: CurrentUser;
}

export function ProfileCard({ user }: ProfileCardProps) {
  const displayName = user.nickname && user.discriminator
    ? `${user.nickname}#${user.discriminator}`
    : user.email;

  return (
    <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-6">
      <div className="flex items-center gap-4">
        {user.imageUrl && (
          <img
            src={user.imageUrl}
            alt="Profile"
            className="w-16 h-16 rounded-full border-2 border-amber-500/50"
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-amber-400 truncate">{displayName}</h2>
          {user.name && (
            <p className="text-gray-400 text-sm truncate">{user.name}</p>
          )}
          <p className="text-gray-500 text-xs truncate">{user.email}</p>
        </div>
      </div>
    </div>
  );
}

