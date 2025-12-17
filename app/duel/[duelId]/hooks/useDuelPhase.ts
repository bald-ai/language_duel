"use client";

import { useState, useRef, useEffect } from "react";
import { calculateDifficultyDistribution, getDifficultyForIndex } from "@/lib/difficultyUtils";
import { shuffleAnswersForQuestion } from "@/lib/answerShuffle";
import type { WordEntry } from "@/lib/types";
import { TRANSITION_COUNTDOWN_SECONDS } from "@/lib/duelConstants";

export type DuelPhase = 'idle' | 'answering' | 'transition';

export interface FrozenQuestionData {
  word: string;
  correctAnswer: string;
  shuffledAnswers: string[];
  selectedAnswer: string | null;
  opponentAnswer: string | null;
  wordIndex: number;
  hasNoneOption: boolean;
  difficulty: { level: "easy" | "medium" | "hard"; points: number };
}

interface UseDuelPhaseParams {
  currentWordIndex: number | undefined;
  words: WordEntry[];
  wordOrder: number[] | undefined;
  viewerIsChallenger: boolean;
  opponentLastAnswer: string | undefined;
  challengerLastAnswer: string | undefined;
  isLocked: boolean;
  duelStatus: string | undefined;
  countdownPausedBy: string | undefined;
}

interface UseDuelPhaseResult {
  phase: DuelPhase;
  frozenData: FrozenQuestionData | null;
  countdown: number | null;
  lockedAnswerRef: React.MutableRefObject<string | null>;
  hasTimedOutRef: React.MutableRefObject<boolean>;
  // Type reveal animation state
  isRevealing: boolean;
  typedText: string;
  revealComplete: boolean;
  // Actions
  resetForNextQuestion: () => void;
  setLockedAnswer: (answer: string | null) => void;
  setHasTimedOut: (value: boolean) => void;
}

/**
 * Manages the phase-based state machine for duel question flow.
 * Phases: idle → answering → transition → answering → ...
 */
export function useDuelPhase({
  currentWordIndex,
  words,
  wordOrder,
  viewerIsChallenger,
  opponentLastAnswer,
  challengerLastAnswer,
  isLocked,
  duelStatus,
  countdownPausedBy,
}: UseDuelPhaseParams): UseDuelPhaseResult {
  const [phase, setPhase] = useState<DuelPhase>('idle');
  const [frozenData, setFrozenData] = useState<FrozenQuestionData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const activeQuestionIndexRef = useRef<number | null>(null);
  const lockedAnswerRef = useRef<string | null>(null);
  const hasTimedOutRef = useRef(false);
  
  // Type reveal effect state
  const [isRevealing, setIsRevealing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [revealComplete, setRevealComplete] = useState(false);
  
  // Unified transition effect - handles all question phase changes
  useEffect(() => {
    if (currentWordIndex === undefined || !words.length) return;
    
    // Initial load - start answering phase
    if (activeQuestionIndexRef.current === null) {
      activeQuestionIndexRef.current = currentWordIndex;
      setPhase('answering');
      return;
    }
    
    // No change in question index
    if (activeQuestionIndexRef.current === currentWordIndex) return;
    
    // Question changed! Determine if we should show transition
    const prevIndex = activeQuestionIndexRef.current;
    const shouldShowTransition = isLocked || lockedAnswerRef.current || hasTimedOutRef.current;
    
    if (shouldShowTransition) {
      // Get PREVIOUS word data (before the index changed)
      const prevActualIndex = wordOrder ? wordOrder[prevIndex] : prevIndex;
      const prevWord = words[prevActualIndex] || { word: "", answer: "", wrongAnswers: [] };
      
      // Determine previous difficulty using dynamic distribution
      const prevDistribution = calculateDifficultyDistribution(words.length);
      const prevDifficultyData = getDifficultyForIndex(prevIndex, prevDistribution);
      const prevDifficulty = {
        level: prevDifficultyData.level,
        points: prevDifficultyData.points,
        wrongCount: prevDifficultyData.wrongCount,
      };
      
      // Use shared utility for consistent shuffling
      const { answers: prevShuffled, hasNoneOption: prevHasNone } = shuffleAnswersForQuestion(
        prevWord,
        prevIndex,
        { level: prevDifficulty.level, wrongCount: prevDifficulty.wrongCount }
      );
      
      // Get opponent's answer from duel data
      const lastAnswer = viewerIsChallenger 
        ? opponentLastAnswer 
        : challengerLastAnswer;
      
      // Enter transition phase with frozen data
      setPhase('transition');
      setFrozenData({
        word: prevWord.word,
        correctAnswer: prevWord.answer,
        shuffledAnswers: prevShuffled,
        selectedAnswer: lockedAnswerRef.current,
        opponentAnswer: lastAnswer || null,
        wordIndex: prevIndex,
        hasNoneOption: prevHasNone,
        difficulty: prevDifficulty,
      });
      
      // Only start countdown if duel is not completed (more questions to come)
      const isLastQuestion = prevIndex >= words.length - 1;
      if (!isLastQuestion) {
        setCountdown(TRANSITION_COUNTDOWN_SECONDS);
      }
    } else {
      // No answer was locked, go straight to next question
      setPhase('answering');
    }
    
    // Update the tracked index
    activeQuestionIndexRef.current = currentWordIndex;
  }, [currentWordIndex, words, wordOrder, viewerIsChallenger, opponentLastAnswer, challengerLastAnswer, isLocked]);
  
  // Countdown timer - respects pause state from server
  useEffect(() => {
    if (countdown === null || phase !== 'transition') return;
    // Don't tick if paused
    if (countdownPausedBy) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished - transition to answering phase
      if (duelStatus !== "completed") {
        setPhase('answering');
        setFrozenData(null);
        // Reset refs for next question
        lockedAnswerRef.current = null;
        hasTimedOutRef.current = false;
        // Reset reveal state for next question
        setIsRevealing(false);
        setTypedText("");
        setRevealComplete(false);
      }
      setCountdown(null);
    }
  }, [countdown, duelStatus, phase, countdownPausedBy]);

  // Type reveal effect for "None of the above" correct answer
  useEffect(() => {
    if (!frozenData || !frozenData.hasNoneOption) {
      return;
    }
    
    const startDelay = setTimeout(() => {
      setIsRevealing(true);
    }, 300);
    
    return () => clearTimeout(startDelay);
  }, [frozenData]);

  // Typing animation effect
  useEffect(() => {
    if (!isRevealing || !frozenData) return;
    
    const correctAnswer = frozenData.correctAnswer;
    setTypedText("");
    setRevealComplete(false);
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < correctAnswer.length) {
        setTypedText(correctAnswer.slice(0, i + 1));
        i++;
      } else {
        setRevealComplete(true);
        clearInterval(interval);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [isRevealing, frozenData]);
  
  const resetForNextQuestion = () => {
    lockedAnswerRef.current = null;
    hasTimedOutRef.current = false;
    setIsRevealing(false);
    setTypedText("");
    setRevealComplete(false);
  };
  
  const setLockedAnswer = (answer: string | null) => {
    lockedAnswerRef.current = answer;
  };
  
  const setHasTimedOut = (value: boolean) => {
    hasTimedOutRef.current = value;
  };
  
  return {
    phase,
    frozenData,
    countdown,
    lockedAnswerRef,
    hasTimedOutRef,
    isRevealing,
    typedText,
    revealComplete,
    resetForNextQuestion,
    setLockedAnswer,
    setHasTimedOut,
  };
}

