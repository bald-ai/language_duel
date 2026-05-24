"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SabotageEffect } from "@/lib/sabotage/types";
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
}

export function useReverseAnswers({
  activeSabotage,
  answers,
}: UseReverseAnswersProps): UseReverseAnswersResult {
  const [reverseAnimatedAnswers, setReverseAnimatedAnswers] = useState<string[] | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  // Single helper for tearing down scheduled scramble timers (previously
  // duplicated across three branches).
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    clearTimers();

    // All state updates run inside timer callbacks, never synchronously in the
    // effect body (react-hooks/set-state-in-effect).
    if (activeSabotage !== "reverse" || !answers.length) {
      const reset = setTimeout(() => setReverseAnimatedAnswers(null), 0);
      timersRef.current.push(reset);
      return clearTimers;
    }

    // Hold the answers as-is, then scramble for a bit, then settle on the fully
    // reversed text.
    const paint = setTimeout(() => setReverseAnimatedAnswers([...answers]), 0);
    timersRef.current.push(paint);

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

    return clearTimers;
  }, [activeSabotage, answers, clearTimers]);

  return { reverseAnimatedAnswers };
}
