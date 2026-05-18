"use client";

import type { CurrentUser } from "@/convex/users";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { Avatar } from "@/app/components/Avatar";
import { CreditsPanel } from "./CreditsPanel";
import { formatVisibleUser } from "@/lib/userDisplay";

interface ProfileCardProps {
  user: CurrentUser;
}

export function ProfileCard({ user }: ProfileCardProps) {
  const colors = useAppearanceColors();
  const displayName = formatVisibleUser(user);

  return (
    <div 
      className="rounded-2xl p-6 border-2"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar
          src={user.imageUrl}
          name={displayName}
          size={64}
          borderColor={colors.neutral.DEFAULT}
        />
        <div className="flex-1 min-w-0">
          <h2 
            className="text-2xl font-bold truncate"
            style={{ color: colors.text.DEFAULT }}
          >
            {displayName}
          </h2>
          {user.name && (
            <p className="text-sm truncate" style={{ color: colors.text.muted }}>
              {user.name}
            </p>
          )}
          <p className="text-xs truncate" style={{ color: colors.neutral.dark }}>
            {user.email}
          </p>
        </div>
      </div>

      <CreditsPanel
        llmCreditsRemaining={user.llmCreditsRemaining}
        ttsGenerationsRemaining={user.ttsGenerationsRemaining}
      />
    </div>
  );
}
