import { useCallback, useEffect, useState } from "react";
import type { FrozenData } from "../components/DuelView";
import {
  TYPE_REVEAL_DELAY_MS,
  TYPE_REVEAL_INTERVAL_MS,
} from "@/lib/duelConstants";

export function useDuelTypeReveal(frozenData: FrozenData | null) {
  const [isRevealing, setIsRevealing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [revealComplete, setRevealComplete] = useState(false);

  useEffect(() => {
    if (!frozenData || !frozenData.hasNoneOption) return;
    const startDelay = setTimeout(() => setIsRevealing(true), TYPE_REVEAL_DELAY_MS);
    return () => clearTimeout(startDelay);
  }, [frozenData]);

  useEffect(() => {
    if (!isRevealing || !frozenData) return;

    const correctAnswer = frozenData.correctAnswer;
    if (correctAnswer === null) return;

    let i = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      setTypedText("");
      setRevealComplete(false);
      interval = setInterval(() => {
        if (i < correctAnswer.length) {
          setTypedText(correctAnswer.slice(0, i + 1));
          i += 1;
        } else {
          setRevealComplete(true);
          if (interval) clearInterval(interval);
        }
      }, TYPE_REVEAL_INTERVAL_MS);
    }, 0);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [isRevealing, frozenData]);

  const resetTypeReveal = useCallback(() => {
    setIsRevealing(false);
    setTypedText("");
    setRevealComplete(false);
  }, []);

  return {
    isRevealing,
    typedText,
    revealComplete,
    resetTypeReveal,
  };
}
