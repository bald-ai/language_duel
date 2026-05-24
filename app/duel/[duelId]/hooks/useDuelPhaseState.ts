"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { TRANSITION_COUNTDOWN_SECONDS } from "@/lib/duelConstants";
import { useDuelCountdown } from "./useDuelCountdown";
import { useDuelTypeReveal } from "./useDuelTypeReveal";
import { useIndexedAnswerLock } from "./useIndexedAnswerLock";
import type { ViewerSafeDuelQuestion } from "./duelSessionTypes";
import type { FrozenData } from "../components/DuelView";

export type DuelPhase = "idle" | "answering" | "transition";

export type DuelPhaseStateArgs = {
  duel: Doc<"duels">;
  index: number;
  theirLastAnswer: string | null | undefined;
};

export type DuelPhaseState = {
  phase: DuelPhase;
  frozenData: FrozenData | null;
  countdown: number | null;
  duelDuration: number;
  isRevealing: boolean;
  typedText: string;
  revealComplete: boolean;
  selectedAnswer: string | null;
  isLocked: boolean;
  hasTimedOutRef: React.MutableRefObject<boolean>;
  lockedAnswerRef: React.MutableRefObject<string | null>;
  setSelectedAnswer: (value: string | null, expectedIndex?: number) => void;
  setIsLocked: (value: boolean) => void;
  getHasAnsweredForIndex: (questionIndex: number, hasAnsweredRaw: boolean) => boolean;
};

/**
 * Owns the answer phase machine for a duel: the visible question index,
 * the per-question answer lock, the freeze-on-reveal transition, and the
 * countdown that gates the next question. Pure presentation state — no
 * mutations are issued from here.
 */
export function useDuelPhaseState({
  duel,
  index,
  theirLastAnswer,
}: DuelPhaseStateArgs): DuelPhaseState {
  const [phase, setPhase] = useState<DuelPhase>("idle");
  const [frozenData, setFrozenData] = useState<FrozenData | null>(null);
  const [duelDuration, setDuelDuration] = useState(0);

  const hasTimedOutRef = useRef(false);
  const duelStartTimeRef = useRef<number | null>(null);
  const activeQuestionIndexRef = useRef<number | null>(null);
  const lockedAnswerRef = useRef<string | null>(null);

  const {
    setSelectedAnswer,
    setIsLocked,
    getSelectedAnswerForIndex,
    getIsLockedForIndex,
    getHasAnsweredForIndex,
  } = useIndexedAnswerLock(() => activeQuestionIndexRef.current);

  const selectedAnswer = getSelectedAnswerForIndex(index);
  const isLocked = getIsLockedForIndex(index);

  const words = duel.sessionWords;
  const wordOrder = duel.wordOrder;
  const currentWordIndex = duel.currentWordIndex;

  const { isRevealing, typedText, revealComplete, resetTypeReveal } =
    useDuelTypeReveal(frozenData);

  const handleTransitionCountdownComplete = useCallback(() => {
    setPhase("answering");
    setFrozenData(null);
    setSelectedAnswer(null);
    setIsLocked(false);
    lockedAnswerRef.current = null;
    hasTimedOutRef.current = false;
    resetTypeReveal();
  }, [resetTypeReveal, setIsLocked, setSelectedAnswer]);

  const { countdown, setCountdown } = useDuelCountdown({
    phase,
    duelStatus: duel.status,
    countdownPausedBy: duel.countdownPausedBy,
    countdownSkipRequestedBy: duel.countdownSkipRequestedBy ?? [],
    onCountdownComplete: handleTransitionCountdownComplete,
  });

  useEffect(() => {
    if (currentWordIndex === undefined || !words.length) return;

    if (activeQuestionIndexRef.current === null) {
      activeQuestionIndexRef.current = currentWordIndex;
      setPhase("answering");
      return;
    }

    if (activeQuestionIndexRef.current === currentWordIndex) return;

    const prevIndex = activeQuestionIndexRef.current;
    const shouldShowTransition =
      isLocked || lockedAnswerRef.current || hasTimedOutRef.current;

    if (shouldShowTransition) {
      const prevActualIndex = wordOrder[prevIndex];
      const prevWord = words[prevActualIndex] || {
        word: "",
        answer: "",
        wrongAnswers: [],
      };
      const prevQuestion = duel.duelQuestions![prevIndex] as ViewerSafeDuelQuestion;
      const prevCorrectOption = prevQuestion.correctOption ?? null;

      setPhase("transition");
      setFrozenData({
        word: prevWord.word,
        correctAnswer:
          prevQuestion.answerRevealedToViewer === true ? prevWord.answer : null,
        shuffledAnswers: prevQuestion.options,
        selectedAnswer: lockedAnswerRef.current,
        opponentAnswer: theirLastAnswer || null,
        wordIndex: prevIndex,
        hasNoneOption:
          prevCorrectOption === null
            ? null
            : prevCorrectOption === NONE_OF_ABOVE,
        difficulty: {
          level: prevQuestion.difficulty,
          points: prevQuestion.points,
        },
      });

      const isLastQuestion = prevIndex >= words.length - 1;
      if (!isLastQuestion) {
        setCountdown(TRANSITION_COUNTDOWN_SECONDS);
      }
    } else {
      setPhase("answering");
      setSelectedAnswer(null);
      setIsLocked(false);
      lockedAnswerRef.current = null;
      hasTimedOutRef.current = false;
    }

    activeQuestionIndexRef.current = currentWordIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setIsLocked/setSelectedAnswer are stable useCallback refs
  }, [currentWordIndex, words, wordOrder, theirLastAnswer, isLocked, duel.duelQuestions]);

  useEffect(() => {
    const eliminated = duel.eliminatedOptions || [];
    if (selectedAnswer && eliminated.includes(selectedAnswer)) {
      setSelectedAnswer(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedAnswer is a stable useCallback ref
  }, [duel.eliminatedOptions, selectedAnswer]);

  // Single phase-edge detector for the feature: the first transition into the
  // "answering" phase both clears the timeout guard and stamps the duel start
  // time used to report the total play duration when the duel completes.
  const prevPhaseRef = useRef<DuelPhase | null>(null);
  useEffect(() => {
    const wasNotAnswering = prevPhaseRef.current !== "answering";
    const isNowAnswering = phase === "answering";
    prevPhaseRef.current = phase;

    if (wasNotAnswering && isNowAnswering) {
      hasTimedOutRef.current = false;
      if (duelStartTimeRef.current === null) {
        duelStartTimeRef.current = Date.now();
      }
    }
  }, [phase]);

  useEffect(() => {
    if (duel.status === "completed" && duelStartTimeRef.current !== null) {
      setDuelDuration(Math.floor((Date.now() - duelStartTimeRef.current) / 1000));
    }
  }, [duel.status]);

  return {
    phase,
    frozenData,
    countdown,
    duelDuration,
    isRevealing,
    typedText,
    revealComplete,
    selectedAnswer,
    isLocked,
    hasTimedOutRef,
    lockedAnswerRef,
    setSelectedAnswer,
    setIsLocked,
    getHasAnsweredForIndex,
  };
}
