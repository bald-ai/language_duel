"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { DuelPhase } from "./useDuelPhase";

interface UseDuelAnswerEffectsParams {
  phase: DuelPhase;
  eliminatedOptions?: string[] | null;
  selectedAnswer: string | null;
  setSelectedAnswer: Dispatch<SetStateAction<string | null>>;
  setIsLocked: Dispatch<SetStateAction<boolean>>;
}

export function useDuelAnswerEffects({
  phase,
  eliminatedOptions,
  selectedAnswer,
  setSelectedAnswer,
  setIsLocked,
}: UseDuelAnswerEffectsParams) {
  useEffect(() => {
    if (phase === "answering") {
      setSelectedAnswer(null);
      setIsLocked(false);
    }
  }, [phase, setIsLocked, setSelectedAnswer]);

  useEffect(() => {
    if (selectedAnswer && eliminatedOptions?.includes(selectedAnswer)) {
      setSelectedAnswer(null);
    }
  }, [eliminatedOptions, selectedAnswer, setSelectedAnswer]);
}
