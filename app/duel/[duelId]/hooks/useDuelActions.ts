"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { SabotageEffect } from "@/lib/sabotage/types";
import { useTTS } from "@/hooks/useTTS";
import { getErrorMessage, isExpectedDuelRaceError } from "./useDuelRaceErrors";
import { useDuelCountdownActions } from "./useDuelCountdownActions";

type SessionItem = Doc<"duels">["sessionItems"][number];
/** TTS only meaningfully applies to word items today (no TTS for sentences in v1). */
type SessionWord = Extract<SessionItem, { kind: "word" }>;

export type DuelActionsArgs = {
  duel: Pick<Doc<"duels">, "_id" | "challengerId" | "opponentId">;
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
  requestUnpauseForControls: () => void;
  skipCountdown: () => void;
  submitAnswer: (selectedAnswer: string, questionIndex: number) => Promise<void>;
  submitTimeoutAnswer: (questionIndex: number) => Promise<void>;
  requestHint: () => Promise<void>;
  acceptHint: () => Promise<void>;
  eliminateOption: (option: string) => Promise<void>;
  sendSabotage: (effect: SabotageEffect) => Promise<void>;
  playWordAudio: (item: SessionItem | undefined) => void;
};

/**
 * All write-side handlers for a duel session.
 * No render-state lives here. Callers compose these into UI props.
 */
export function useDuelActions({
  duel,
  setIsLocked,
  lockedAnswerRef,
}: DuelActionsArgs): DuelActions {
  const duelId = duel._id;
  const router = useRouter();
  const { isPlaying: isPlayingAudio, playTTS } = useTTS();

  const answer = useMutation(api.gameplay.answerDuel);
  const stopDuel = useMutation(api.duels.stopDuel);
  const requestHintMutation = useMutation(api.hints.requestHint);
  const acceptHintMutation = useMutation(api.hints.acceptHint);
  const eliminateOptionMutation = useMutation(api.hints.eliminateOption);
  const timeoutAnswerMutation = useMutation(api.gameplay.timeoutAnswer);
  const sendSabotageMutation = useMutation(api.sabotage.sendSabotage);
  const {
    pauseCountdown,
    requestUnpauseCountdown,
    confirmUnpauseCountdown,
    requestUnpauseForControls,
    skipCountdown,
  } = useDuelCountdownActions(duel);

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
          toast.error(getErrorMessage(error, "Could not record the timeout"));
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

  const playWordAudio = useCallback(
    (item: SessionItem | undefined) => {
      if (!item) return;
      // Sentence rounds don't carry TTS in v1, and the listen button only mounts
      // on word positions. Throw so any future routing bug that calls this on a
      // sentence position surfaces loudly instead of being a silent no-op.
      if (item.kind !== "word") {
        throw new Error(
          "playWordAudio called on a sentence session item — the listen button should not mount on sentence rounds."
        );
      }
      const word: SessionWord = item;
      const correctAnswer = word.answer;
      if (!correctAnswer || correctAnswer === "done") return;
      void playTTS(`duel-answer-${correctAnswer}`, correctAnswer, {
        storageId: word.ttsStorageId,
        themeId: String(word.themeId),
      });
    },
    [playTTS]
  );

  return {
    isPlayingAudio,
    stopDuelAndGoHome,
    goHome,
    pauseCountdown,
    requestUnpauseCountdown,
    confirmUnpauseCountdown,
    requestUnpauseForControls,
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
