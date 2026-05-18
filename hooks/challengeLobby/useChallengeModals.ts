import { useCallback, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { ModalState } from "./types";

export function useChallengeModals() {
  const [modalState, setModalState] = useState<ModalState>("none");
  const [initialChallengeOpponentId, setInitialChallengeOpponentId] = useState<Id<"users"> | null>(null);

  const openSoloPracticeModal = useCallback(() => setModalState("soloPractice"), []);
  const openChallengeModal = useCallback((initialOpponentId?: Id<"users">) => {
    setInitialChallengeOpponentId(initialOpponentId ?? null);
    setModalState("challenge");
  }, []);
  const openWaitingModal = useCallback(() => setModalState("waiting"), []);
  const closeModal = useCallback(() => {
    setInitialChallengeOpponentId(null);
    setModalState("none");
  }, []);

  return {
    modalState,
    showSoloPracticeModal: modalState === "soloPractice",
    showChallengeModal: modalState === "challenge",
    showWaitingModal: modalState === "waiting",
    initialChallengeOpponentId,
    openSoloPracticeModal,
    openChallengeModal,
    openWaitingModal,
    closeModal,
  };
}
