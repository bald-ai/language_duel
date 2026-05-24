"use client";

import dynamic from "next/dynamic";
import type { useChallengeLobby } from "./useChallengeLobby";

const ChallengeModal = dynamic(
  () => import("@/app/components/modals/ChallengeModal").then((mod) => mod.ChallengeModal),
  { loading: () => null }
);
const WaitingModal = dynamic(
  () => import("@/app/components/modals/WaitingModal").then((mod) => mod.WaitingModal),
  { loading: () => null }
);
const JoiningModal = dynamic(
  () => import("@/app/components/modals/JoiningModal").then((mod) => mod.JoiningModal),
  { loading: () => null }
);

interface ChallengeLobbyModalsProps {
  lobby: ReturnType<typeof useChallengeLobby>;
}

/**
 * Renders the challenge-lobby modal trio (create / waiting / joining) from a
 * single `useChallengeLobby()` instance. Both lobby consumers (the home page and
 * the friends list) share this, so the ~13-prop threading and the
 * `key`-remount-reset contract live in exactly one place.
 */
export function ChallengeLobbyModals({ lobby }: ChallengeLobbyModalsProps) {
  return (
    <>
      {lobby.showChallengeModal && (
        <ChallengeModal
          key={lobby.initialChallengeOpponentId ?? "challenge-modal"}
          users={lobby.users}
          viewer={lobby.viewer}
          themes={lobby.themes}
          pendingChallenges={lobby.pendingChallenges}
          isJoiningDuel={lobby.isJoiningDuel}
          isCreatingChallenge={lobby.isCreatingChallenge}
          onAcceptChallenge={lobby.handleAcceptChallenge}
          onDeclineChallenge={lobby.handleDeclineChallenge}
          onCreateChallenge={lobby.handleCreateChallenge}
          onClose={lobby.closeChallengeModal}
          onNavigateToThemes={lobby.navigateToThemes}
          initialOpponentId={lobby.initialChallengeOpponentId}
        />
      )}

      {lobby.showWaitingModal && (
        <WaitingModal
          isCancelling={lobby.isCancellingChallenge}
          onCancel={lobby.handleCancelWaiting}
        />
      )}

      {lobby.isJoiningDuel && <JoiningModal />}
    </>
  );
}
