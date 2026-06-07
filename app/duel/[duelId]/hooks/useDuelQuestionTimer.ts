"use client";

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  QUESTION_TIMER_SECONDS,
  TIMER_UPDATE_INTERVAL_MS,
} from "@/lib/duelConstants";
import { clampTimerSeconds, getEffectiveQuestionStartTime } from "@/lib/duelTiming";

interface UseDuelQuestionTimerArgs {
  phase: "idle" | "answering" | "transition";
  duelStatus: string;
  duelId: Id<"duels">;
  questionStartTime?: number;
  questionTimerPausedAt?: number;
  currentItemIndex?: number;
  questionIndex: number;
  myAnswered: boolean;
  hasTimedOutRef: MutableRefObject<boolean>;
  onTimeout: (questionIndex: number) => Promise<void>;
}

export function useDuelQuestionTimer({
  phase,
  duelStatus,
  duelId,
  questionStartTime,
  questionTimerPausedAt,
  currentItemIndex,
  questionIndex,
  myAnswered,
  hasTimedOutRef,
  onTimeout,
}: UseDuelQuestionTimerArgs) {
  const [questionTimer, setQuestionTimer] = useState<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (phase !== "answering" || duelStatus !== "active" || !questionStartTime) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- timer state is synchronized to duel phase/status boundaries.
      setQuestionTimer(null);
      return;
    }

    const updateTimer = () => {
      const effectiveStartTime = getEffectiveQuestionStartTime(
        questionStartTime,
        currentItemIndex
      );
      const now = questionTimerPausedAt ?? Date.now();
      const elapsed = (now - effectiveStartTime) / 1000;
      const remaining = clampTimerSeconds(
        QUESTION_TIMER_SECONDS - elapsed,
        QUESTION_TIMER_SECONDS
      );
      setQuestionTimer(remaining);

      if (remaining <= 0 && !hasTimedOutRef.current) {
        hasTimedOutRef.current = true;

        if (!myAnswered) {
          onTimeout(questionIndex).catch(() => undefined);
        }
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, TIMER_UPDATE_INTERVAL_MS);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [
    phase,
    duelStatus,
    duelId,
    questionStartTime,
    questionTimerPausedAt,
    currentItemIndex,
    questionIndex,
    myAnswered,
    hasTimedOutRef,
    onTimeout,
  ]);

  return questionTimer;
}
