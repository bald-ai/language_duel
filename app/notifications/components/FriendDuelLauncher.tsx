"use client";

import type { ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ChallengeModal } from "@/app/components/modals/ChallengeModal";
import { JoiningModal } from "@/app/components/modals/JoiningModal";
import { WaitingModal } from "@/app/components/modals/WaitingModal";
import { useChallengeLobby } from "@/hooks/useChallengeLobby";

interface FriendDuelLauncherProps {
    children: (openChallenge: (friendId: Id<"users">) => void) => ReactNode;
}

export function FriendDuelLauncher({ children }: FriendDuelLauncherProps) {
    const lobby = useChallengeLobby();

    return (
        <>
            {children(lobby.openChallengeModal)}

            {lobby.showChallengeModal && (
                <ChallengeModal
                    key={lobby.initialChallengeOpponentId ?? "challenge-modal"}
                    users={lobby.users}
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
