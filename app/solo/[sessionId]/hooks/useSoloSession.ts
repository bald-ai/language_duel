"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  answerSoloLevel0GotIt,
  answerSoloLevel0NotYet,
  answerSoloQuestionCorrect,
  answerSoloQuestionIncorrect,
  initializeSoloSession,
  initialSoloSessionState,
  selectNextSoloQuestion,
  SOLO_CORRECT_ADVANCE_DELAY_MS,
  SOLO_INCORRECT_ADVANCE_DELAY_MS,
  type SoloMasteryLevel,
  type SoloSessionState,
} from "@/lib/soloPracticeRuntime";
import type { SessionWordEntry } from "@/lib/sessionWords";
import { getDirectionalCopy } from "../translationDirection";

type SessionState = SoloSessionState;

interface UseSoloSessionParams {
  words: SessionWordEntry[] | undefined;
  initialConfidenceByWordIndex: Record<number, SoloMasteryLevel> | null;
}

interface UseSoloSessionResult {
  session: SessionState;
  showFeedback: boolean;
  feedbackCorrect: boolean;
  feedbackAnswer: string | null;
  elapsedTime: number;
  // Actions
  handleCorrect: () => void;
  handleIncorrect: () => void;
  handleLevel0GotIt: () => void;
  handleLevel0NotYet: () => void;
  // Derived
  currentWord: SessionWordEntry | null;
  masteredCount: number;
}

/**
 * Manages the solo practice session state machine.
 * Handles word pool management, mastery progression, and question selection.
 */
export function useSoloSession({
  words,
  initialConfidenceByWordIndex,
}: UseSoloSessionParams): UseSoloSessionResult {
  const [session, setSession] = useState<SessionState>(initialSoloSessionState);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackAnswer, setFeedbackAnswer] = useState<string | null>(null);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const clearAutoAdvanceTimeout = useCallback(() => {
    if (autoAdvanceTimeoutRef.current !== null) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, []);

  // Advance to the next question, clearing any in-flight feedback. Shared by the
  // auto-advance timeout and the immediate Level-0 handlers so timed and
  // immediate advances can never drift apart.
  const advanceToNextQuestion = useCallback(() => {
    setSession((prev) => selectNextSoloQuestion(prev, Math.random));
    setShowFeedback(false);
    setFeedbackAnswer(null);
  }, []);

  const scheduleAutoAdvance = useCallback(
    (delayMs: number) => {
      clearAutoAdvanceTimeout();
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        autoAdvanceTimeoutRef.current = null;
        advanceToNextQuestion();
      }, delayMs);
    },
    [clearAutoAdvanceTimeout, advanceToNextQuestion]
  );

  useEffect(() => clearAutoAdvanceTimeout, [clearAutoAdvanceTimeout]);

  // Initialize session when words load. The setState pair is deferred via
  // queueMicrotask because this project's react-hooks/set-state-in-effect lint
  // rule forbids synchronous setState in an effect body; a microtask callback is
  // the supported escape hatch.
  useEffect(() => {
    if (words && words.length > 0 && !session.initialized) {
      const newSession = initializeSoloSession({
        wordCount: words.length,
        initialConfidenceByWordIndex,
        random: Math.random,
      });
      queueMicrotask(() => {
        setSession(newSession);
        setStartTime(Date.now());
      });
    }
  }, [words, session.initialized, initialConfidenceByWordIndex]);

  // Live elapsed timer update
  useEffect(() => {
    if (!startTime || session.completed) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, session.completed]);

  /**
   * Selects the next question, handling pool expansion when needed.
   */
  const selectNextQuestion = useCallback(() => {
    clearAutoAdvanceTimeout();
    advanceToNextQuestion();
  }, [clearAutoAdvanceTimeout, advanceToNextQuestion]);

  /**
   * Handle correct answer - progress mastery and auto-advance.
   */
  const handleCorrect = useCallback(() => {
    if (
      session.currentWordIndex === null ||
      !session.wordStates.has(session.currentWordIndex)
    ) {
      return;
    }

    setFeedbackCorrect(true);
    setShowFeedback(true);
    setFeedbackAnswer(null);

    setSession((prev) => answerSoloQuestionCorrect(prev, Math.random));
    scheduleAutoAdvance(SOLO_CORRECT_ADVANCE_DELAY_MS);
  }, [scheduleAutoAdvance, session.currentWordIndex, session.wordStates]);

  /**
   * Handle incorrect answer - drop mastery by 1, show correct answer.
   */
  const handleIncorrect = useCallback(() => {
    if (!words || session.currentWordIndex === null) return;

    const currentWord = words[session.currentWordIndex];
    if (!currentWord || !session.wordStates.has(session.currentWordIndex)) return;

    setFeedbackCorrect(false);
    setShowFeedback(true);
    setFeedbackAnswer(
      getDirectionalCopy(currentWord, session.translationDirection).feedbackAnswer
    );

    setSession(answerSoloQuestionIncorrect);
    scheduleAutoAdvance(SOLO_INCORRECT_ADVANCE_DELAY_MS);
  }, [
    scheduleAutoAdvance,
    words,
    session.currentWordIndex,
    session.translationDirection,
    session.wordStates,
  ]);

  /**
   * Level 0: User indicates they know the word.
   */
  const handleLevel0GotIt = useCallback(() => {
    setSession(answerSoloLevel0GotIt);
    selectNextQuestion();
  }, [selectNextQuestion]);

  /**
   * Level 0: User indicates they don't know the word yet.
   */
  const handleLevel0NotYet = useCallback(() => {
    setSession(answerSoloLevel0NotYet);
    selectNextQuestion();
  }, [selectNextQuestion]);

  // Derived values
  const currentWord = useMemo(() => {
    if (!words || session.currentWordIndex === null) return null;
    return words[session.currentWordIndex];
  }, [words, session.currentWordIndex]);

  const masteredCount = useMemo(() => {
    return Array.from(session.wordStates.values()).filter((ws) => ws.completedLevel3).length;
  }, [session.wordStates]);

  return {
    session,
    showFeedback,
    feedbackCorrect,
    feedbackAnswer,
    elapsedTime,
    handleCorrect,
    handleIncorrect,
    handleLevel0GotIt,
    handleLevel0NotYet,
    currentWord,
    masteredCount,
  };
}
