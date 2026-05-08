"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DuelDifficultyPreset } from "@/lib/difficultyUtils";
import type { SoloMode } from "@/lib/soloNavigation";
import { toast } from "sonner";
import { useSoloPracticeLauncher } from "./useSoloPracticeLauncher";

export type ModalState = "none" | "soloPractice" | "challenge" | "waiting";

export interface CreateChallengeOptions {
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  duelDifficultyPreset?: DuelDifficultyPreset;
}

export function useChallengeData(shouldLoad: boolean) {
  const users = useQuery(api.users.getUsers, shouldLoad ? {} : "skip");
  const themes = useQuery(api.themes.getThemes, shouldLoad ? {} : "skip");
  const pendingChallenges = useQuery(api.lobby.getPendingChallenges, shouldLoad ? {} : "skip");

  return {
    users,
    themes,
    pendingChallenges,
    pendingCount: pendingChallenges?.length || 0,
  };
}

export function useChallengeModals() {
  const [modalState, setModalState] = useState<ModalState>("none");

  const openSoloPracticeModal = useCallback(() => setModalState("soloPractice"), []);
  const openChallengeModal = useCallback(() => setModalState("challenge"), []);
  const openWaitingModal = useCallback(() => setModalState("waiting"), []);
  const closeModal = useCallback(() => setModalState("none"), []);

  return {
    modalState,
    showSoloPracticeModal: modalState === "soloPractice",
    showChallengeModal: modalState === "challenge",
    showWaitingModal: modalState === "waiting",
    openSoloPracticeModal,
    openChallengeModal,
    openWaitingModal,
    closeModal,
  };
}

interface UseChallengeActionsOptions {
  onChallengeCreated: (challengeId: Id<"challenges">) => void;
  onWaitingCancelled: () => void;
}

export function useChallengeActions({
  onChallengeCreated,
  onWaitingCancelled,
}: UseChallengeActionsOptions) {
  const createChallengeMutation = useMutation(api.lobby.createChallenge);
  const acceptChallengeMutation = useMutation(api.lobby.acceptChallenge);
  const declineChallengeMutation = useMutation(api.lobby.declineChallenge);
  const cancelChallengeMutation = useMutation(api.lobby.cancelChallenge);

  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [isCancellingChallenge, setIsCancellingChallenge] = useState(false);
  const [waitingChallengeId, setWaitingChallengeId] = useState<Id<"challenges"> | null>(null);

  const handleCreateChallenge = useCallback(
    async (options: CreateChallengeOptions) => {
      setIsCreatingChallenge(true);
      try {
        const challengeId = await createChallengeMutation({
          opponentId: options.opponentId,
          themeIds: options.themeIds,
          duelDifficultyPreset: options.duelDifficultyPreset,
        });
        setWaitingChallengeId(challengeId);
        onChallengeCreated(challengeId);
        toast.success("Challenge sent!");
      } catch (error) {
        console.error("Failed to create challenge:", error);
        toast.error("Failed to send challenge. Please try again.");
      } finally {
        setIsCreatingChallenge(false);
      }
    },
    [createChallengeMutation, onChallengeCreated]
  );

  const handleAcceptChallenge = useCallback(
    async (challengeId: Id<"challenges">) => acceptChallengeMutation({ challengeId }),
    [acceptChallengeMutation]
  );

  const handleDeclineChallenge = useCallback(
    async (challengeId: Id<"challenges">) => {
      try {
        await declineChallengeMutation({ challengeId });
        toast.success("Challenge declined");
      } catch (error) {
        console.error("Failed to decline challenge:", error);
        toast.error("Failed to decline challenge. Please try again.");
      }
    },
    [declineChallengeMutation]
  );

  const handleCancelWaiting = useCallback(async () => {
    if (!waitingChallengeId) {
      onWaitingCancelled();
      return;
    }

    setIsCancellingChallenge(true);
    try {
      await cancelChallengeMutation({ challengeId: waitingChallengeId });
      toast.success("Challenge cancelled");
    } catch (error) {
      console.error("Failed to cancel challenge:", error);
      toast.error("Failed to cancel challenge");
    } finally {
      setIsCancellingChallenge(false);
      setWaitingChallengeId(null);
      onWaitingCancelled();
    }
  }, [waitingChallengeId, cancelChallengeMutation, onWaitingCancelled]);

  return {
    waitingChallengeId,
    isCreatingChallenge,
    isCancellingChallenge,
    handleCreateChallenge,
    handleAcceptChallenge,
    handleDeclineChallenge,
    handleCancelWaiting,
  };
}

interface UseChallengeStatusWatcherOptions {
  waitingChallengeId: Id<"challenges"> | null;
  onAccepted: () => void;
  onDeclined: () => void;
}

export function useChallengeStatusWatcher({
  waitingChallengeId,
  onAccepted,
  onDeclined,
}: UseChallengeStatusWatcherOptions) {
  const router = useRouter();
  const waitingChallenge = useQuery(
    api.lobby.getChallenge,
    waitingChallengeId ? { challengeId: waitingChallengeId } : "skip"
  );

  useEffect(() => {
    const challenge = waitingChallenge?.challenge;
    if (!challenge) return;

    if (challenge.status === "accepted" && challenge.duelId) {
      router.push(`/duel/${challenge.duelId}`);
      onAccepted();
    } else if (challenge.status === "declined" || challenge.status === "cancelled") {
      onDeclined();
      if (challenge.status === "declined") {
        toast.error("Your challenge was declined");
      }
    }
  }, [waitingChallenge, router, onAccepted, onDeclined]);
}

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

  const handleContinueSoloPractice = useSoloPracticeLauncher(modals.closeModal);

  const navigateToThemes = useCallback(() => {
    modals.closeModal();
    router.push("/themes");
  }, [router, modals]);

  const openSoloPracticeModal = useCallback(() => {
    setHasRequestedChallengeData(true);
    modals.openSoloPracticeModal();
  }, [modals]);

  const openChallengeModal = useCallback(() => {
    setHasRequestedChallengeData(true);
    modals.openChallengeModal();
  }, [modals]);

  return {
    users: data.users,
    themes: data.themes,
    pendingChallenges: data.pendingChallenges,
    pendingCount: data.pendingCount,

    showSoloPracticeModal: modals.showSoloPracticeModal,
    showChallengeModal: modals.showChallengeModal,
    showWaitingModal: modals.showWaitingModal,
    isJoiningDuel,

    isCreatingChallenge: actions.isCreatingChallenge,
    isCancellingChallenge: actions.isCancellingChallenge,

    openSoloPracticeModal,
    closeSoloPracticeModal: modals.closeModal,
    openChallengeModal,
    closeChallengeModal: modals.closeModal,

    handleCreateChallenge: actions.handleCreateChallenge,
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
