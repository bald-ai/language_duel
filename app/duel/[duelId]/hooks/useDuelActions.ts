"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { SabotageEffect } from "@/lib/sabotage/types";
import { useDuelAudio } from "./useDuelAudio";
import { getErrorMessage, isExpectedDuelRaceError } from "./useDuelRaceErrors";

type SessionWord = Doc<"duels">["sessionWords"][number] & {
  ttsStorageId?: Id<"_storage">;
  themeId: Id<"themes">;
};

export type DuelActionsArgs = {
  duelId: Id<"duels">;
  setIsLocked: (value: boolean) => void;
  lockedAnswerRef: React.MutableRefObject<string | null>;
};

export type DuelActions = {
  isPlayingAudio: boolean;
  stopDuelAndGoHome: () => Promise<void>;
  goHome: () => void;
  pauseCountdown: () => void;
  requestUnpauseCountdown: () => void;
  confirmUnpauseCountdown: () => void;
  skipCountdown: () => void;
  submitAnswer: (selectedAnswer: string, questionIndex: number) => Promise<void>;
  submitTimeoutAnswer: (questionIndex: number) => Promise<void>;
  requestHint: () => Promise<void>;
  acceptHint: () => Promise<void>;
  eliminateOption: (option: string) => Promise<void>;
  sendSabotage: (effect: SabotageEffect) => Promise<void>;
  playWordAudio: (word: SessionWord | undefined) => void;
};

/**
 * All write-side handlers for a duel session.
 * No render-state lives here. Callers compose these into UI props.
 */
export function useDuelActions({
  duelId,
  setIsLocked,
  lockedAnswerRef,
}: DuelActionsArgs): DuelActions {
  const router = useRouter();
  const { isPlayingAudio, playAudio } = useDuelAudio();

  const answer = useMutation(api.gameplay.answerDuel);
  const stopDuel = useMutation(api.duels.stopDuel);
  const requestHintMutation = useMutation(api.hints.requestHint);
  const acceptHintMutation = useMutation(api.hints.acceptHint);
  const eliminateOptionMutation = useMutation(api.hints.eliminateOption);
  const timeoutAnswerMutation = useMutation(api.gameplay.timeoutAnswer);
  const sendSabotageMutation = useMutation(api.sabotage.sendSabotage);
  const pauseCountdownMutation = useMutation(api.gameplay.pauseCountdown);
  const requestUnpauseMutation = useMutation(api.gameplay.requestUnpauseCountdown);
  const confirmUnpauseMutation = useMutation(api.gameplay.confirmUnpauseCountdown);
  const skipCountdownMutation = useMutation(api.gameplay.skipCountdown);

  const stopDuelAndGoHome = useCallback(async () => {
    try {
      await stopDuel({ duelId });
      router.push("/");
    } catch (error) {
      console.error("Failed to stop duel:", error);
      toast.error(getErrorMessage(error, "Failed to stop duel"));
    }
  }, [stopDuel, duelId, router]);

  const goHome = useCallback(() => {
    router.push("/");
  }, [router]);

  const submitAnswer = useCallback(
    async (selectedAnswer: string, questionIndex: number) => {
      lockedAnswerRef.current = selectedAnswer;
      setIsLocked(true);
      try {
        await answer({ duelId, selectedAnswer, questionIndex });
      } catch (error) {
        if (isExpectedDuelRaceError(error)) {
          return;
        }
        console.error("Failed to submit answer:", error);
        toast.error(getErrorMessage(error, "Failed to submit answer"));
        setIsLocked(false);
        lockedAnswerRef.current = null;
      }
    },
    [answer, duelId, setIsLocked, lockedAnswerRef]
  );

  const submitTimeoutAnswer = useCallback(
    async (questionIndex: number) => {
      try {
        await timeoutAnswerMutation({ duelId, questionIndex });
      } catch (error) {
        if (!isExpectedDuelRaceError(error)) {
          console.error("Failed to submit timeout answer:", error);
        }
      }
    },
    [duelId, timeoutAnswerMutation]
  );

  const requestHint = useCallback(async () => {
    try {
      await requestHintMutation({ duelId });
    } catch (error) {
      console.error("Failed to request hint:", error);
      toast.error(getErrorMessage(error, "Failed to request hint"));
    }
  }, [requestHintMutation, duelId]);

  const acceptHint = useCallback(async () => {
    try {
      await acceptHintMutation({ duelId });
    } catch (error) {
      console.error("Failed to accept hint:", error);
      toast.error(getErrorMessage(error, "Failed to accept hint"));
    }
  }, [acceptHintMutation, duelId]);

  const eliminateOption = useCallback(
    async (option: string) => {
      try {
        await eliminateOptionMutation({ duelId, option });
      } catch (error) {
        console.error("Failed to eliminate option:", error);
        toast.error(getErrorMessage(error, "Failed to eliminate option"));
      }
    },
    [eliminateOptionMutation, duelId]
  );

  const sendSabotage = useCallback(
    async (effect: SabotageEffect) => {
      try {
        await sendSabotageMutation({ duelId, effect });
      } catch (error) {
        console.error("Failed to send sabotage:", error);
        toast.error(getErrorMessage(error, "Failed to send sabotage"));
      }
    },
    [sendSabotageMutation, duelId]
  );

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

  const playWordAudio = useCallback(
    (word: SessionWord | undefined) => {
      const correctAnswer = word?.answer;
      if (!word || !correctAnswer || correctAnswer === "done") return;
      playAudio(
        `duel-answer-${correctAnswer}`,
        correctAnswer,
        word.ttsStorageId,
        String(word.themeId)
      );
    },
    [playAudio]
  );

  return {
    isPlayingAudio,
    stopDuelAndGoHome,
    goHome,
    pauseCountdown,
    requestUnpauseCountdown,
    confirmUnpauseCountdown,
    skipCountdown,
    submitAnswer,
    submitTimeoutAnswer,
    requestHint,
    acceptHint,
    eliminateOption,
    sendSabotage,
    playWordAudio,
  };
}
