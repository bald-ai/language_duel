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
  timeoutAnswer,
  hasTimedOutRef,
  setHasTimedOut,
}: UseQuestionTimerParams): UseQuestionTimerResult {
  const [questionTimer, setQuestionTimer] = useState<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Store latest values in refs to avoid including them in dependencies
  // This prevents infinite loops when these values change frequently
  const timeoutAnswerRef = useRef(timeoutAnswer);
  const setHasTimedOutRef = useRef(setHasTimedOut);
  const hasAnsweredRef = useRef(hasAnswered);
  const duelIdRef = useRef(duelId);
  
  // Update refs when values change
  useEffect(() => {
    timeoutAnswerRef.current = timeoutAnswer;
    setHasTimedOutRef.current = setHasTimedOut;
    hasAnsweredRef.current = hasAnswered;
    duelIdRef.current = duelId;
  }, [timeoutAnswer, setHasTimedOut, hasAnswered, duelId]);

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
      // Use refs to access latest values without including them in dependencies
      if (remaining <= 0 && !hasTimedOutRef.current) {
        setHasTimedOutRef.current(true);
        if (!hasAnsweredRef.current && duelIdRef.current) {
          timeoutAnswerRef.current({ duelId: duelIdRef.current }).catch(console.error);
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
    hasTimedOutRef,
    // Note: duelId, hasAnswered, timeoutAnswer, setHasTimedOut are accessed via refs
    // to prevent infinite loops when these values change frequently
  ]);

  return { questionTimer };
}

