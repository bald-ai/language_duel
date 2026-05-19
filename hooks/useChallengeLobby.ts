"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import type { SoloMode } from "@/lib/soloNavigation";
import { toast } from "sonner";
import { isSelfDuelSelection } from "@/lib/challengeLobby/isSelfDuelSelection";
import { useSoloPracticeLauncher } from "./useSoloPracticeLauncher";
import { useChallengeActions } from "./challengeLobby/useChallengeActions";
import { useChallengeData } from "./challengeLobby/useChallengeData";
import { useChallengeModals } from "./challengeLobby/useChallengeModals";
import { useChallengeStatusWatcher } from "./challengeLobby/useChallengeStatusWatcher";
import type { CreateChallengeOptions } from "./challengeLobby/types";

export type { CreateChallengeOptions, ModalState } from "./challengeLobby/types";
export { useChallengeActions } from "./challengeLobby/useChallengeActions";
export { useChallengeData } from "./challengeLobby/useChallengeData";
export { useChallengeModals } from "./challengeLobby/useChallengeModals";
export { useChallengeStatusWatcher } from "./challengeLobby/useChallengeStatusWatcher";

export function useChallengeLobby() {
  const router = useRouter();
  const modals = useChallengeModals();
  const [hasRequestedChallengeData, setHasRequestedChallengeData] = useState(false);
  const data = useChallengeData(hasRequestedChallengeData);

  const actions = useChallengeActions({
    onChallengeCreated: () => {
      modals.closeModal();
      modals.openWaitingModal();
    },
    onWaitingCancelled: modals.closeModal,
  });

  useChallengeStatusWatcher({
    waitingChallengeId: actions.waitingChallengeId,
    onAccepted: modals.closeModal,
    onDeclined: modals.closeModal,
  });

  const [isJoiningDuel, setIsJoiningDuel] = useState(false);

  const handleAcceptChallengeWithRouting = useCallback(
    async (challengeId: Id<"challenges">) => {
      setIsJoiningDuel(true);
      try {
        const result = await actions.handleAcceptChallenge(challengeId);
        router.push(`/duel/${result.duelId}`);
      } catch (error) {
        console.error("Failed to accept challenge:", error);
        toast.error("Failed to accept challenge. Please try again.");
      } finally {
        setIsJoiningDuel(false);
      }
    },
    [actions, router]
  );

  const viewer = data.viewer;
  const handleCreateChallengeOrSelfDuel = useCallback(
    async (options: CreateChallengeOptions) => {
      if (isSelfDuelSelection(viewer, options.opponentId)) {
        modals.closeModal();
        setIsJoiningDuel(true);
        try {
          const { duelId } = await actions.handleCreateSelfDuel({
            themeIds: options.themeIds,
            duelDifficultyPreset: options.duelDifficultyPreset,
          });
          router.push(`/duel/${duelId}`);
        } catch (error) {
          console.error("Failed to start self-duel:", error);
          toast.error("Failed to start duel. Please try again.");
        } finally {
          setIsJoiningDuel(false);
        }
        return;
      }

      await actions.handleCreateChallenge(options);
    },
    [actions, modals, router, viewer]
  );

  const handleContinueSoloPractice = useSoloPracticeLauncher(modals.closeModal);

  const navigateToThemes = useCallback(() => {
    modals.closeModal();
    router.push("/themes");
  }, [router, modals]);

  const openSoloPracticeModal = useCallback(() => {
    setHasRequestedChallengeData(true);
    modals.openSoloPracticeModal();
  }, [modals]);

  const openChallengeModal = useCallback((initialOpponentId?: Id<"users">) => {
    setHasRequestedChallengeData(true);
    modals.openChallengeModal(initialOpponentId);
  }, [modals]);

  return {
    users: data.users,
    themes: data.themes,
    pendingChallenges: data.pendingChallenges,
    pendingCount: data.pendingCount,
    viewer,

    showSoloPracticeModal: modals.showSoloPracticeModal,
    showChallengeModal: modals.showChallengeModal,
    showWaitingModal: modals.showWaitingModal,
    initialChallengeOpponentId: modals.initialChallengeOpponentId,
    isJoiningDuel,

    isCreatingChallenge: actions.isCreatingChallenge,
    isCancellingChallenge: actions.isCancellingChallenge,

    openSoloPracticeModal,
    closeSoloPracticeModal: modals.closeModal,
    openChallengeModal,
    closeChallengeModal: modals.closeModal,

    handleCreateChallenge: handleCreateChallengeOrSelfDuel,
    handleAcceptChallenge: handleAcceptChallengeWithRouting,
    handleDeclineChallenge: actions.handleDeclineChallenge,
    handleCancelWaiting: actions.handleCancelWaiting,
    handleContinueSoloPractice: (
      themeIds: Id<"themes">[],
      mode: SoloMode,
      durationSeconds?: number
    ) => handleContinueSoloPractice(themeIds, mode, durationSeconds),
    navigateToThemes,
  };
}
