"use client";

import { useState, useEffect, useRef } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  QUESTION_TIMER_SECONDS,
  TRANSITION_COUNTDOWN_SECONDS,
  TIMER_UPDATE_INTERVAL_MS,
} from "@/lib/duelConstants";
import type { DuelPhase } from "./useDuelPhase";

export interface UseQuestionTimerParams {
  phase: DuelPhase;
  questionStartTime: number | undefined;
  questionTimerPausedAt: number | undefined;
  currentWordIndex: number | undefined;
  duelStatus: string | undefined;
  duelId: Id<"challenges"> | undefined;
  hasAnswered: boolean;
  viewerIsChallenger: boolean;
  timeoutAnswer: (args: { duelId: Id<"challenges"> }) => Promise<unknown>;
  // Refs to track timeout state across renders
  hasTimedOutRef: React.MutableRefObject<boolean>;
  setHasTimedOut: (value: boolean) => void;
}

export interface UseQuestionTimerResult {
  questionTimer: number | null;
}

/**
 * Manages the question timer, synced from server questionStartTime.
 * Handles auto-timeout when timer reaches zero.
 */
export function useQuestionTimer({
  phase,
  questionStartTime,
  questionTimerPausedAt,
  currentWordIndex,
  duelStatus,
  duelId,
  hasAnswered,
  viewerIsChallenger,
  timeoutAnswer,
  hasTimedOutRef,
  setHasTimedOut,
}: UseQuestionTimerParams): UseQuestionTimerResult {
  const [questionTimer, setQuestionTimer] = useState<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Only run timer during answering phase with active duel
    if (phase !== "answering" || !questionStartTime || duelStatus !== "accepted") {
      // Use setTimeout to defer state updates and avoid cascading renders
      setTimeout(() => setQuestionTimer(null), 0);
      return;
    }

    // Calculate remaining time based on server timestamp
    const updateTimer = () => {
      const isFirstQuestion = (currentWordIndex ?? 0) === 0;
      const transitionOffset = isFirstQuestion ? 0 : TRANSITION_COUNTDOWN_SECONDS * 1000;
      const effectiveStartTime = questionStartTime + transitionOffset;
      const now = questionTimerPausedAt ?? Date.now();
      const elapsed = (now - effectiveStartTime) / 1000;
      const remaining = Math.max(0, QUESTION_TIMER_SECONDS - elapsed);
      setQuestionTimer(remaining);

      // Check if time is up and player hasn't answered
      if (remaining <= 0 && !hasTimedOutRef.current) {
        setHasTimedOut(true);
        if (!hasAnswered && duelId) {
          timeoutAnswer({ duelId }).catch(console.error);
        }
      }
    };

    // Initial update
    updateTimer();

    // Update at regular interval for smooth countdown
    timerIntervalRef.current = setInterval(updateTimer, TIMER_UPDATE_INTERVAL_MS);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [
    phase,
    questionStartTime,
    questionTimerPausedAt,
    currentWordIndex,
    duelStatus,
    duelId,
    hasAnswered,
    viewerIsChallenger,
    timeoutAnswer,
    hasTimedOutRef,
    setHasTimedOut,
  ]);

  return { questionTimer };
}

