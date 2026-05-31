"use client";

import { useMutation } from "convex/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { isSelfDuel } from "@/lib/duel/selfDuel";
import { getErrorMessage } from "./useDuelRaceErrors";

export type DuelCountdownActions = {
  pauseCountdown: () => void;
  requestUnpauseCountdown: () => void;
  confirmUnpauseCountdown: () => void;
  /**
   * Self-duels have no opponent to confirm a resume, so a single click must
   * unpause outright. PvE/PvP still routes through the request → confirm
   * handshake. Both the word path and the cross-kind transition share this
   * mapping so their pause UX cannot drift.
   */
  requestUnpauseForControls: () => void;
  skipCountdown: () => void;
};

/**
 * Single source for the between-question countdown mutations (pause / unpause /
 * skip). The word answering screen and the cross-kind sentence transition both
 * consume this so they expose identical countdown control behavior.
 */
export function useDuelCountdownActions(
  duel: Pick<Doc<"duels">, "_id" | "challengerId" | "opponentId">
): DuelCountdownActions {
  const duelId = duel._id;
  const pauseCountdownMutation = useMutation(api.gameplay.pauseCountdown);
  const requestUnpauseMutation = useMutation(api.gameplay.requestUnpauseCountdown);
  const confirmUnpauseMutation = useMutation(api.gameplay.confirmUnpauseCountdown);
  const skipCountdownMutation = useMutation(api.gameplay.skipCountdown);

  const pauseCountdown = useCallback(() => {
    pauseCountdownMutation({ duelId }).catch((error) => {
      console.error("Failed to pause countdown:", error);
      toast.error(getErrorMessage(error, "Failed to pause countdown"));
    });
  }, [pauseCountdownMutation, duelId]);

  const requestUnpauseCountdown = useCallback(() => {
    requestUnpauseMutation({ duelId }).catch((error) => {
      console.error("Failed to request countdown resume:", error);
      toast.error(getErrorMessage(error, "Failed to request countdown resume"));
    });
  }, [requestUnpauseMutation, duelId]);

  const confirmUnpauseCountdown = useCallback(() => {
    confirmUnpauseMutation({ duelId }).catch((error) => {
      console.error("Failed to resume countdown:", error);
      toast.error(getErrorMessage(error, "Failed to resume countdown"));
    });
  }, [confirmUnpauseMutation, duelId]);

  const skipCountdown = useCallback(() => {
    skipCountdownMutation({ duelId }).catch((error) => {
      console.error("Failed to skip countdown:", error);
      toast.error(getErrorMessage(error, "Failed to skip countdown"));
    });
  }, [skipCountdownMutation, duelId]);

  const requestUnpauseForControls = isSelfDuel(duel)
    ? confirmUnpauseCountdown
    : requestUnpauseCountdown;

  return {
    pauseCountdown,
    requestUnpauseCountdown,
    confirmUnpauseCountdown,
    requestUnpauseForControls,
    skipCountdown,
  };
}
