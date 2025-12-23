"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ClassicDifficultyPreset } from "@/lib/difficultyUtils";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

export type ModalState = "none" | "duel" | "solo" | "soloStyleDuel" | "waiting";

export interface CreateDuelOptions {
  opponentId: Id<"users">;
  themeId: Id<"themes">;
  mode: "solo" | "classic";
  classicDifficultyPreset?: ClassicDifficultyPreset;
}

// ============================================================================
// useDuelData - Query hook for fetching duel-related data
// ============================================================================

export function useDuelData() {
  const users = useQuery(api.users.getUsers);
  const themes = useQuery(api.themes.getThemes, {});
  const pendingDuels = useQuery(api.duel.getPendingDuels);

  // Filter pending duels by mode
  const pendingClassicDuels = pendingDuels?.filter(
    (d) => d.challenge.mode === "classic" || !d.challenge.mode
  );
  const pendingSoloStyleDuels = pendingDuels?.filter(
    (d) => d.challenge.mode === "solo"
  );

  return {
    users: users || [],
    themes: themes || [],
    pendingDuels,
    pendingClassicDuels,
    pendingSoloStyleDuels,
    pendingCount: pendingDuels?.length || 0,
    pendingClassicCount: pendingClassicDuels?.length || 0,
    pendingSoloStyleCount: pendingSoloStyleDuels?.length || 0,
  };
}

// ============================================================================
// useDuelModals - Modal state management with single state variable
// ============================================================================

export function useDuelModals() {
  const [modalState, setModalState] = useState<ModalState>("none");

  const openDuelModal = useCallback(() => setModalState("duel"), []);
  const openSoloModal = useCallback(() => setModalState("solo"), []);
  const openSoloStyleDuelModal = useCallback(() => setModalState("soloStyleDuel"), []);
  const openWaitingModal = useCallback(() => setModalState("waiting"), []);

  const closeModal = useCallback(() => {
    setModalState("none");
  }, []);

  return {
    modalState,
    showDuelModal: modalState === "duel",
    showSoloModal: modalState === "solo",
    showSoloStyleDuelModal: modalState === "soloStyleDuel",
    showWaitingModal: modalState === "waiting",
    openDuelModal,
    openSoloModal,
    openSoloStyleDuelModal,
    openWaitingModal,
    closeModal,
  };
}

// ============================================================================
// useDuelActions - Mutation hooks for duel operations
// ============================================================================

interface UseDuelActionsOptions {
  onDuelCreated: (duelId: Id<"challenges">) => void;
  onWaitingCancelled: () => void;
}

export function useDuelActions({ onDuelCreated, onWaitingCancelled }: UseDuelActionsOptions) {
  const router = useRouter();

  const createDuelMutation = useMutation(api.duel.createDuel);
  const acceptDuelMutation = useMutation(api.duel.acceptDuel);
  const rejectDuelMutation = useMutation(api.duel.rejectDuel);
  const cancelPendingDuelMutation = useMutation(api.duel.cancelPendingDuel);

  const [isCreatingDuel, setIsCreatingDuel] = useState(false);
  const [isJoiningDuel, setIsJoiningDuel] = useState(false);
  const [isCancellingDuel, setIsCancellingDuel] = useState(false);
  const [waitingDuelId, setWaitingDuelId] = useState<Id<"challenges"> | null>(null);

  const handleCreateDuel = useCallback(
    async (options: CreateDuelOptions) => {
      setIsCreatingDuel(true);
      try {
        const duelId = await createDuelMutation({
          opponentId: options.opponentId,
          themeId: options.themeId,
          mode: options.mode,
          classicDifficultyPreset: options.classicDifficultyPreset,
        });
        setWaitingDuelId(duelId);
        onDuelCreated(duelId);
        toast.success("Duel invite sent!");
      } catch (error) {
        console.error("Failed to create duel:", error);
        toast.error("Failed to create duel. Please try again.");
      } finally {
        setIsCreatingDuel(false);
      }
    },
    [createDuelMutation, onDuelCreated]
  );

  const handleAcceptDuel = useCallback(
    async (duelId: Id<"challenges">) => {
      setIsJoiningDuel(true);
      try {
        await acceptDuelMutation({ duelId });
        router.push(`/duel/${duelId}`);
      } catch (error) {
        console.error("Failed to accept duel:", error);
        toast.error("Failed to accept duel. Please try again.");
      } finally {
        setIsJoiningDuel(false);
      }
    },
    [acceptDuelMutation, router]
  );

  const handleRejectDuel = useCallback(
    async (duelId: Id<"challenges">) => {
      try {
        await rejectDuelMutation({ duelId });
        toast.success("Duel rejected");
      } catch (error) {
        console.error("Failed to reject duel:", error);
        toast.error("Failed to reject duel. Please try again.");
      }
    },
    [rejectDuelMutation]
  );

  const handleCancelWaiting = useCallback(async () => {
    if (!waitingDuelId) {
      onWaitingCancelled();
      return;
    }

    setIsCancellingDuel(true);
    try {
      await cancelPendingDuelMutation({ duelId: waitingDuelId });
      toast.success("Duel invite cancelled");
    } catch (error) {
      console.error("Failed to cancel duel:", error);
      toast.error("Failed to cancel duel");
    } finally {
      setIsCancellingDuel(false);
      setWaitingDuelId(null);
      onWaitingCancelled();
    }
  }, [waitingDuelId, cancelPendingDuelMutation, onWaitingCancelled]);

  return {
    waitingDuelId,
    isCreatingDuel,
    isJoiningDuel,
    isCancellingDuel,
    handleCreateDuel,
    handleAcceptDuel,
    handleRejectDuel,
    handleCancelWaiting,
  };
}

// ============================================================================
// useDuelStatusWatcher - Watch for duel status changes
// ============================================================================

interface UseDuelStatusWatcherOptions {
  waitingDuelId: Id<"challenges"> | null;
  onAccepted: () => void;
  onRejected: () => void;
}

export function useDuelStatusWatcher({
  waitingDuelId,
  onAccepted,
  onRejected,
}: UseDuelStatusWatcherOptions) {
  const router = useRouter();

  const waitingDuel = useQuery(
    api.duel.getDuel,
    waitingDuelId ? { duelId: waitingDuelId } : "skip"
  );

  useEffect(() => {
    if (waitingDuel) {
      const status = waitingDuel.duel.status;
      if (status === "challenging" || status === "accepted") {
        router.push(`/duel/${waitingDuelId}`);
        onAccepted();
      } else if (status === "rejected" || status === "stopped" || status === "cancelled") {
        onRejected();
        if (status === "rejected") {
          toast.error("Your duel invite was rejected");
        }
      }
    }
  }, [waitingDuel, waitingDuelId, router, onAccepted, onRejected]);
}

// ============================================================================
// useDuelLobby - Composed hook (maintains backward compatibility)
// ============================================================================

export function useDuelLobby() {
  const router = useRouter();
  const data = useDuelData();
  const modals = useDuelModals();

  const actions = useDuelActions({
    onDuelCreated: () => {
      modals.closeModal();
      modals.openWaitingModal();
    },
    onWaitingCancelled: modals.closeModal,
  });

  useDuelStatusWatcher({
    waitingDuelId: actions.waitingDuelId,
    onAccepted: modals.closeModal,
    onRejected: modals.closeModal,
  });

  const handleContinueSolo = useCallback(
    (themeId: Id<"themes">, mode: "challenge_only" | "learn_test") => {
      const sessionId = crypto.randomUUID();
      const base = mode === "challenge_only" ? `/solo/${sessionId}` : `/solo/learn/${sessionId}`;
      router.push(`${base}?themeId=${themeId}`);
      modals.closeModal();
    },
    [router, modals]
  );

  const navigateToThemes = useCallback(() => {
    modals.closeModal();
    router.push("/themes");
  }, [router, modals]);

  return {
    // Data
    users: data.users,
    themes: data.themes,
    pendingDuels: data.pendingDuels,
    pendingClassicDuels: data.pendingClassicDuels,
    pendingSoloStyleDuels: data.pendingSoloStyleDuels,
    pendingCount: data.pendingCount,
    pendingClassicCount: data.pendingClassicCount,
    pendingSoloStyleCount: data.pendingSoloStyleCount,

    // Modal states
    showDuelModal: modals.showDuelModal,
    showSoloModal: modals.showSoloModal,
    showSoloStyleDuelModal: modals.showSoloStyleDuelModal,
    showWaitingModal: modals.showWaitingModal,
    isJoiningDuel: actions.isJoiningDuel,

    // Loading states
    isCreatingDuel: actions.isCreatingDuel,
    isCancellingDuel: actions.isCancellingDuel,

    // Modal handlers
    openDuelModal: modals.openDuelModal,
    closeDuelModal: modals.closeModal,
    openSoloModal: modals.openSoloModal,
    closeSoloModal: modals.closeModal,
    openSoloStyleDuelModal: modals.openSoloStyleDuelModal,
    closeSoloStyleDuelModal: modals.closeModal,

    // Actions
    handleCreateDuel: actions.handleCreateDuel,
    handleAcceptDuel: actions.handleAcceptDuel,
    handleRejectDuel: actions.handleRejectDuel,
    handleCancelWaiting: actions.handleCancelWaiting,
    handleContinueSolo,
    navigateToThemes,
  };
}
