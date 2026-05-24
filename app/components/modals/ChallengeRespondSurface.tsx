"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatVisibleUser } from "@/lib/userDisplay";
import type { PendingChallenge } from "@/hooks/challengeLobby/types";

interface ChallengeRespondSurfaceProps {
  pendingChallenges: PendingChallenge[] | undefined;
  isJoiningDuel: boolean;
  onAcceptChallenge: (challengeId: Id<"challenges">) => void;
  onDeclineChallenge: (challengeId: Id<"challenges">) => void;
}

// Incoming-challenge inbox embedded above the create form. This is a deliberate
// convenience surface; note that NotificationsTab has a second accept/decline UI
// wired to `notificationId` (vs this one's `challengeId`).
export function ChallengeRespondSurface({
  pendingChallenges,
  isJoiningDuel,
  onAcceptChallenge,
  onDeclineChallenge,
}: ChallengeRespondSurfaceProps) {
  const colors = useAppearanceColors();
  if (pendingChallenges === undefined) {
    return (
      <div
        className="p-4 border-2 rounded-2xl text-center"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <p className="text-sm" style={{ color: colors.text.muted }}>
          Checking for pending invites...
        </p>
      </div>
    );
  }

  if (pendingChallenges.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-widest font-emphasis" style={{ color: colors.text.muted }}>
        Incoming Challenges
      </p>
      {pendingChallenges.map(({ challenge, challenger }) => (
        <div
          key={challenge._id}
          className="p-3 border-2 rounded-xl"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-emphasis shrink-0"
                style={{
                  backgroundColor: `${colors.cta.DEFAULT}20`,
                  color: colors.cta.DEFAULT,
                }}
              >
                ⚔️
              </div>
              <div className="min-w-0">
                <p className="text-sm font-emphasis truncate" style={{ color: colors.text.DEFAULT }}>
                  {formatVisibleUser(challenger, "Unknown")}
                </p>
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  Challenge invite
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onAcceptChallenge(challenge._id)}
                disabled={isJoiningDuel}
                className="px-3 py-1.5 rounded-lg text-sm font-emphasis transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: colors.status.success.DEFAULT,
                  color: colors.background.DEFAULT,
                }}
                data-testid={`challenge-modal-accept-${challenge._id}`}
              >
                Accept
              </button>
              <button
                onClick={() => onDeclineChallenge(challenge._id)}
                disabled={isJoiningDuel}
                className="px-3 py-1.5 rounded-lg text-sm font-emphasis transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: `${colors.status.danger.DEFAULT}20`,
                  color: colors.status.danger.DEFAULT,
                }}
                data-testid={`challenge-modal-decline-${challenge._id}`}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
