"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SabotageEffect } from "@/lib/sabotage";
import {
  REVERSE_HOLD_MS,
  REVERSE_SCRAMBLE_MS,
  REVERSE_TICK_MS,
} from "@/lib/sabotage/constants";
import { reverseText, scrambleTextKeepSpaces } from "../utils/textTransforms";

interface UseReverseAnswersProps {
  activeSabotage: SabotageEffect | null;
  answers: string[];
}

interface UseReverseAnswersResult {
  reverseAnimatedAnswers: string[] | null;
  clearReverseAnimation: () => void;
}

export function useReverseAnswers({
  activeSabotage,
  answers,
}: UseReverseAnswersProps): UseReverseAnswersResult {
  const [reverseAnimatedAnswers, setReverseAnimatedAnswers] = useState<string[] | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearReverseAnimation = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
    setReverseAnimatedAnswers(null);
  }, []);

  useEffect(() => {
    if (activeSabotage !== "reverse") {
      // Use setTimeout to defer state updates and avoid cascading renders
      setTimeout(() => {
        timersRef.current.forEach((timer) => clearTimeout(timer));
        timersRef.current = [];
        setReverseAnimatedAnswers(null);
      }, 0);
      return;
    }

    if (!answers.length) {
      // Clear timers synchronously (safe), defer setState
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
      setTimeout(() => setReverseAnimatedAnswers(null), 0);
      return;
    }

    // Clear timers synchronously (safe), defer setState
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
    setTimeout(() => setReverseAnimatedAnswers([...answers]), 0);

    let scrambleStartedAt: number | null = null;
    const tick = () => {
      if (scrambleStartedAt === null) scrambleStartedAt = Date.now();
      const elapsed = Date.now() - scrambleStartedAt;
      if (elapsed >= REVERSE_SCRAMBLE_MS) {
        setReverseAnimatedAnswers(answers.map((ans) => reverseText(ans)));
        return;
      }

      setReverseAnimatedAnswers(answers.map((ans) => scrambleTextKeepSpaces(ans)));
      const t = setTimeout(tick, REVERSE_TICK_MS);
      timersRef.current.push(t);
    };

    const startScramble = setTimeout(tick, REVERSE_HOLD_MS);
    timersRef.current.push(startScramble);

    return () => clearReverseAnimation();
  }, [activeSabotage, answers, clearReverseAnimation]);

  return { reverseAnimatedAnswers, clearReverseAnimation };
}

