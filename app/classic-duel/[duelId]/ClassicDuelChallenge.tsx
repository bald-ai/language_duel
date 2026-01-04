"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { stripIrr } from "@/lib/stringUtils";
import {
  calculateClassicDifficultyDistribution,
  getDifficultyForIndex,
  type ClassicDifficultyPreset,
} from "@/lib/difficultyUtils";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  type SabotageEffect,
  SABOTAGE_DURATION_MS,
  MAX_SABOTAGES,
  SabotageRenderer,
  useReverseAnswers,
  useBounceOptions,
  useTrampolineOptions,
  reverseText,
  BUTTON_WIDTH,
  BUTTON_HEIGHT,
  TRAMPOLINE_BUTTON_WIDTH,
  TRAMPOLINE_BUTTON_HEIGHT,
  TRAMPOLINE_FLY_SCALE,
  BOUNCE_FLY_SCALE,
} from "@/app/game/sabotage";
import { shuffleAnswersForQuestion } from "@/lib/answerShuffle";
import type { WordEntry } from "@/lib/types";
import {
  QUESTION_TIMER_SECONDS,
  TRANSITION_COUNTDOWN_SECONDS,
  TYPE_REVEAL_DELAY_MS,
  TYPE_REVEAL_INTERVAL_MS,
  TIMER_UPDATE_INTERVAL_MS,
  TIMER_DISPLAY_MAX,
  TIMER_WARNING_THRESHOLD,
  TIMER_DANGER_THRESHOLD,
} from "@/lib/duelConstants";
import {
  AnswerOptionButton,
  computeOptionState,
  type OptionContext,
  SabotageSystemUI,
} from "./components";
import { useSabotageEffect } from "./hooks";
import {
  Scoreboard,
  CountdownControls,
  HintSystemUI,
  FinalResultsPanel,
} from "@/app/game/components/duel";
import { getResponseErrorMessage } from "@/lib/api/errors";
import { colors } from "@/lib/theme";

// Props interface
interface ClassicDuelChallengeProps {
  duel: Doc<"challenges">;
  theme: Doc<"themes">;
  challenger: Pick<Doc<"users">, "_id" | "name" | "imageUrl"> | null;
  opponent: Pick<Doc<"users">, "_id" | "name" | "imageUrl"> | null;
  viewerRole: "challenger" | "opponent";
}

export default function ClassicDuelChallenge({
  duel,
  theme,
  challenger,
  opponent,
  viewerRole,
}: ClassicDuelChallengeProps) {
  const router = useRouter();
  const { user } = useUser();
  const viewerIsChallenger = viewerRole === "challenger";
  
  const [selectedAnswerRaw, setSelectedAnswerRaw] = useState<string | null>(null);
  // Track which question index the selectedAnswer belongs to
  const selectedAnswerIndexRef = useRef<number | null>(null);
  const setSelectedAnswer = useCallback((val: string | null, forIndex?: number) => {
    selectedAnswerIndexRef.current = val === null ? null : (forIndex ?? activeQuestionIndexRef.current);
    setSelectedAnswerRaw(val);
  }, []);
  const [isLockedRaw, setIsLockedRaw] = useState(false);
  // Track which question index isLocked belongs to (same pattern as selectedAnswer)
  const isLockedIndexRef = useRef<number | null>(null);
  const setIsLocked = useCallback((val: boolean) => {
    isLockedIndexRef.current = val ? activeQuestionIndexRef.current : null;
    setIsLockedRaw(val);
  }, []);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [frozenData, setFrozenData] = useState<{
    word: string;
    correctAnswer: string;
    shuffledAnswers: string[];
    selectedAnswer: string | null;
    opponentAnswer: string | null;
    wordIndex: number;
    hasNoneOption: boolean;
    difficulty: { level: "easy" | "medium" | "hard"; points: number };
  } | null>(null);

  // Type reveal effect state for "None of the above" correct answer
  const [isRevealing, setIsRevealing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [revealComplete, setRevealComplete] = useState(false);

  // TTS audio playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);


  // Mutations
  const answer = useMutation(api.duel.answerDuel);
  const stopDuel = useMutation(api.duel.stopDuel);
  const requestHint = useMutation(api.duel.requestHint);
  const acceptHint = useMutation(api.duel.acceptHint);
  const eliminateOption = useMutation(api.duel.eliminateOption);
  const timeoutAnswer = useMutation(api.duel.timeoutAnswer);
  const sendSabotage = useMutation(api.duel.sendSabotage);
  const pauseCountdown = useMutation(api.duel.pauseCountdown);
  const requestUnpauseCountdown = useMutation(api.duel.requestUnpauseCountdown);
  const confirmUnpauseCountdown = useMutation(api.duel.confirmUnpauseCountdown);
  const skipCountdown = useMutation(api.duel.skipCountdown);
  
  // Question timer state
  const [questionTimer, setQuestionTimer] = useState<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTimedOutRef = useRef(false);

  // Duel start time tracking for total duration
  const duelStartTimeRef = useRef<number | null>(null);
  const [duelDuration, setDuelDuration] = useState<number>(0);
  
  // Phase-based state machine for question flow
  const [phase, setPhase] = useState<'idle' | 'answering' | 'transition'>('idle');
  const activeQuestionIndexRef = useRef<number | null>(null);
  const lockedAnswerRef = useRef<string | null>(null);
  
  // Extract values
  const wordOrder = duel.wordOrder;
  // Memoize words to avoid creating new array reference on every render
  const words = useMemo(() => theme.words || [], [theme.words]);
  const isCompleted = duel.status === "completed";
  const rawIndex = duel.currentWordIndex ?? 0;
  const index = isCompleted && words.length > 0 ? words.length - 1 : rawIndex;
  // Computed selectedAnswer that's only valid for the current question (prevents race condition)
  const selectedAnswer = (selectedAnswerIndexRef.current === index) ? selectedAnswerRaw : null;
  // Computed isLocked that's only valid for the current question (prevents race condition)
  const isLocked = (isLockedIndexRef.current === index) ? isLockedRaw : false;
  
  // Sabotage effect management (extracted to hook)
  const mySabotage = viewerIsChallenger ? duel.challengerSabotage : duel.opponentSabotage;
  const { activeSabotage, sabotagePhase } = useSabotageEffect({
    mySabotage,
    phase,
    isLocked,
  });
  
  const actualWordIndex = wordOrder ? wordOrder[index] : index;
  // Memoize currentWord to avoid creating new object reference on every render
  const currentWord = useMemo(
    () => words[actualWordIndex] || { word: "done", answer: "done", wrongAnswers: [] },
    [words, actualWordIndex]
  );
  const word = currentWord.word;
  
  // Calculate dynamic difficulty distribution
  const classicPreset = (duel.classicDifficultyPreset ?? "easy") as ClassicDifficultyPreset;
  const difficultyDistribution = useMemo(() => 
    calculateClassicDifficultyDistribution(words.length, classicPreset), 
    [words.length, classicPreset]
  );

  const currentWordIndex = duel.currentWordIndex;
  
  // Unified transition effect
  useEffect(() => {
    if (currentWordIndex === undefined || !words.length) return;
    
    if (activeQuestionIndexRef.current === null) {
      activeQuestionIndexRef.current = currentWordIndex;
      setPhase('answering');
      return;
    }
    
    if (activeQuestionIndexRef.current === currentWordIndex) return;
    
    const prevIndex = activeQuestionIndexRef.current;
    const shouldShowTransition = isLocked || lockedAnswerRef.current || hasTimedOutRef.current;
    
    if (shouldShowTransition) {
      const prevActualIndex = wordOrder ? wordOrder[prevIndex] : prevIndex;
      const prevWord = words[prevActualIndex] || { word: "", answer: "", wrongAnswers: [] };
      
      const prevDistribution = calculateClassicDifficultyDistribution(words.length, classicPreset);
      const prevDifficultyData = getDifficultyForIndex(prevIndex, prevDistribution);
      const prevDifficulty = {
        level: prevDifficultyData.level,
        points: prevDifficultyData.points,
        wrongCount: prevDifficultyData.wrongCount,
      };
      
      // Use shared shuffle utility for deterministic answer order
      const { answers: prevShuffled, hasNoneOption: prevHasNone } = shuffleAnswersForQuestion(
        prevWord as WordEntry,
        prevIndex,
        prevDifficulty
      );
      
      const opponentLastAnswer = viewerIsChallenger 
        ? duel.opponentLastAnswer 
        : duel.challengerLastAnswer;
      
      setPhase('transition');
      setFrozenData({
        word: prevWord.word,
        correctAnswer: prevWord.answer,
        shuffledAnswers: prevShuffled,
        selectedAnswer: lockedAnswerRef.current,
        opponentAnswer: opponentLastAnswer || null,
        wordIndex: prevIndex,
        hasNoneOption: prevHasNone,
        difficulty: prevDifficulty,
      });
      
      const isLastQuestion = prevIndex >= words.length - 1;
      if (!isLastQuestion) {
        setCountdown(5);
      }
    } else {
      setPhase('answering');
      setSelectedAnswer(null);
      setIsLocked(false);
      lockedAnswerRef.current = null;
      hasTimedOutRef.current = false;
    }
    
    activeQuestionIndexRef.current = currentWordIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setIsLocked/setSelectedAnswer are stable useCallback refs
  }, [currentWordIndex, words, wordOrder, viewerIsChallenger, duel.opponentLastAnswer, duel.challengerLastAnswer, isLocked, classicPreset]);
  
  // Countdown timer
  const countdownPausedBy = duel.countdownPausedBy;
  const countdownUnpauseRequestedBy = duel.countdownUnpauseRequestedBy;
  // Memoize to avoid new array reference on every render
  const countdownSkipRequestedBy = useMemo(
    () => duel.countdownSkipRequestedBy || [],
    [duel.countdownSkipRequestedBy]
  );
  const prevCountdownPausedByRef = useRef<string | undefined>(countdownPausedBy);
  
  // Detect when unpause is confirmed (countdownPausedBy goes from truthy to undefined)
  // Reset countdown to 1 second when this happens
  useEffect(() => {
    const wasPaused = prevCountdownPausedByRef.current;
    const isNowUnpaused = !countdownPausedBy;
    
    if (wasPaused && isNowUnpaused && countdown !== null && phase === 'transition') {
      // Unpause confirmed - reset countdown to 1 second
      setCountdown(1);
    }
    
    prevCountdownPausedByRef.current = countdownPausedBy;
  }, [countdownPausedBy, countdown, phase]);
  
  useEffect(() => {
    if (countdown === null || phase !== 'transition') return;
    if (countdownPausedBy) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      if (duel.status !== "completed") {
        setPhase('answering');
        setFrozenData(null);
        setSelectedAnswer(null);
        setIsLocked(false);
        lockedAnswerRef.current = null;
        hasTimedOutRef.current = false;
        setIsRevealing(false);
        setTypedText("");
        setRevealComplete(false);
      }
      setCountdown(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setIsLocked/setSelectedAnswer are stable useCallback refs
  }, [countdown, duel.status, countdownPausedBy, phase]);

  // Detect when both players have skipped - immediately proceed to next question
  useEffect(() => {
    if (countdown === null || phase !== 'transition') return;
    if (countdownSkipRequestedBy.includes("challenger") && countdownSkipRequestedBy.includes("opponent")) {
      // Both players skipped - immediately go to 0
      setCountdown(0);
    }
  }, [countdownSkipRequestedBy, countdown, phase]);

  // Type reveal effect
  useEffect(() => {
    if (!frozenData || !frozenData.hasNoneOption) return;
    const startDelay = setTimeout(() => setIsRevealing(true), TYPE_REVEAL_DELAY_MS);
    return () => clearTimeout(startDelay);
  }, [frozenData]);

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
    }, TYPE_REVEAL_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, [isRevealing, frozenData]);

  // Monitor status for redirects
  useEffect(() => {
    const status = duel.status;
    if (status === "stopped" || status === "rejected") {
      router.push('/');
    }
  }, [duel.status, router]);

  // Clear selected if eliminated
  useEffect(() => {
    const eliminated = duel.eliminatedOptions || [];
    if (selectedAnswer && eliminated.includes(selectedAnswer)) {
      setSelectedAnswer(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSelectedAnswer is a stable useCallback ref
  }, [duel.eliminatedOptions, selectedAnswer]);

  // Question timer - synced from server questionStartTime; can be paused during hints
  const prevPhaseRef = useRef<typeof phase | null>(null);

  // Reset timeout flag ONLY when transitioning into 'answering' phase
  useEffect(() => {
    const wasNotAnswering = prevPhaseRef.current !== 'answering';
    const isNowAnswering = phase === 'answering';
    prevPhaseRef.current = phase;
    
    if (wasNotAnswering && isNowAnswering) {
      hasTimedOutRef.current = false;
      
      // Capture duel start time on first question
      if (duelStartTimeRef.current === null) {
        duelStartTimeRef.current = Date.now();
      }
    }
  }, [phase]);

  // Calculate duel duration when completed
  useEffect(() => {
    if (duel.status === "completed" && duelStartTimeRef.current !== null) {
      const duration = Math.floor((Date.now() - duelStartTimeRef.current) / 1000);
      setDuelDuration(duration);
    }
  }, [duel.status]);
  
  // Timer countdown effect (uses server start time; freezes when paused)
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    const status = duel.status;
    const questionStartTime = duel.questionStartTime;
    
    if (phase !== 'answering' || status !== "accepted" || !questionStartTime) {
      setQuestionTimer(null);
      return;
    }
    
    const updateTimer = () => {
      const isFirstQuestion = (duel.currentWordIndex ?? 0) === 0;
      const transitionOffset = isFirstQuestion ? 0 : TRANSITION_COUNTDOWN_SECONDS * 1000;
      const effectiveStartTime = questionStartTime + transitionOffset;
      const now = duel.questionTimerPausedAt ?? Date.now();
      const elapsed = (now - effectiveStartTime) / 1000;
      const remaining = Math.max(0, QUESTION_TIMER_SECONDS - elapsed);
      setQuestionTimer(remaining);
      
      if (remaining <= 0 && !hasTimedOutRef.current) {
        hasTimedOutRef.current = true;
        const hasAnswered = viewerIsChallenger 
          ? duel.challengerAnswered 
          : duel.opponentAnswered;
        
        if (!hasAnswered && duel._id) {
          timeoutAnswer({ duelId: duel._id }).catch(console.error);
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
    duel.status,
    duel._id,
    duel.questionStartTime,
    duel.questionTimerPausedAt,
    duel.currentWordIndex,
    duel.challengerAnswered,
    duel.opponentAnswered,
    viewerIsChallenger,
    timeoutAnswer,
  ]);

  // Difficulty
  const difficulty = useMemo(() => 
    getDifficultyForIndex(index, difficultyDistribution),
    [index, difficultyDistribution]
  );

  // Shuffle answers using shared utility for deterministic order
  const { shuffledAnswers, hasNoneOption } = useMemo(() => {
    if (word === "done" || !currentWord.wrongAnswers?.length) {
      return { shuffledAnswers: [], hasNoneOption: false };
    }
    
    const { answers, hasNoneOption: hasNone } = shuffleAnswersForQuestion(
      currentWord as WordEntry,
      index,
      difficulty
    );
    
    return { shuffledAnswers: answers, hasNoneOption: hasNone };
  }, [currentWord, word, index, difficulty]);

  // Reverse sabotage animation: scramble then settle into reversed text
  const displayAnswersForReverse = frozenData ? frozenData.shuffledAnswers : shuffledAnswers;
  const { reverseAnimatedAnswers } = useReverseAnswers({
    activeSabotage,
    answers: displayAnswersForReverse,
  });

  // Bounce sabotage animation
  const optionCount = displayAnswersForReverse.length;
  const { bouncingOptions } = useBounceOptions({
    activeSabotage,
    optionCount,
  });

  // Trampoline sabotage animation
  const { trampolineOptions } = useTrampolineOptions({
    activeSabotage,
    optionCount,
  });

  // Check role (needed for useMemo below)
  const isChallenger = viewerIsChallenger;
  const isOpponent = viewerRole === "opponent";
  const outgoingSabotage = isChallenger ? duel.opponentSabotage : duel.challengerSabotage;
  
  // Memoized sabotage active check - updates when sabotage or question changes
  // MUST be called before any early returns to follow React Hook rules
  const isOutgoingSabotageActive = useMemo(() => {
    if (!outgoingSabotage) return false;
    
    // For sticky, check if within duration of last sabotage
    // Note: This won't auto-expire but will update on next state change
    if (outgoingSabotage.effect === "sticky") {
      const now = Date.now();
      return now - outgoingSabotage.timestamp < SABOTAGE_DURATION_MS;
    }
    
    // For bounce/trampoline/reverse, active if sent during current question
    if (
      outgoingSabotage.effect === "bounce" ||
      outgoingSabotage.effect === "trampoline" ||
      outgoingSabotage.effect === "reverse"
    ) {
      return typeof duel.questionStartTime === "number"
        ? outgoingSabotage.timestamp >= duel.questionStartTime
        : true; // Assume active if no question start time
    }
    
    return false;
  }, [outgoingSabotage, duel.questionStartTime]);

  // All useCallback hooks MUST be defined before any early returns (React rules of hooks)
  const handleStopDuel = useCallback(async () => {
    try {
      await stopDuel({ duelId: duel._id });
      router.push('/');
    } catch (error) {
      console.error("Failed to stop duel:", error);
    }
  }, [stopDuel, duel._id, router]);

  const handleConfirmAnswer = useCallback(async () => {
    if (!selectedAnswer) return;
    lockedAnswerRef.current = selectedAnswer;
    setIsLocked(true);
    try {
      await answer({ duelId: duel._id, selectedAnswer, questionIndex: index });
    } catch (error) {
      console.error("Failed to submit answer:", error);
      setIsLocked(false);
      lockedAnswerRef.current = null;
    }
  }, [selectedAnswer, answer, duel._id, index, setIsLocked]);

  const handleRequestHint = useCallback(async () => {
    try {
      await requestHint({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to request hint:", error);
    }
  }, [requestHint, duel._id]);

  const handleAcceptHint = useCallback(async () => {
    try {
      await acceptHint({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to accept hint:", error);
    }
  }, [acceptHint, duel._id]);

  const handleEliminateOption = useCallback(async (option: string) => {
    try {
      await eliminateOption({ duelId: duel._id, option });
    } catch (error) {
      console.error("Failed to eliminate option:", error);
    }
  }, [eliminateOption, duel._id]);

  const handleSendSabotage = useCallback(async (effect: SabotageEffect) => {
    try {
      await sendSabotage({ duelId: duel._id, effect });
    } catch (error) {
      console.error("Failed to send sabotage:", error);
    }
  }, [sendSabotage, duel._id]);

  const handlePlayAudio = useCallback(async () => {
    const correctAnswer = frozenData ? frozenData.correctAnswer : currentWord.answer;
    if (isPlayingAudio || !correctAnswer || correctAnswer === "done") return;
    
    setIsPlayingAudio(true);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: correctAnswer }),
      });
      
      if (!response.ok) {
        const message = await getResponseErrorMessage(response);
        throw new Error(message);
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Cleanup previous audio
      if (audioRef.current) audioRef.current.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      
      audioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlayingAudio(false);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };
      
      audio.onerror = () => {
        setIsPlayingAudio(false);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };
      
      await audio.play();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to play audio";
      toast.error(message);
      setIsPlayingAudio(false);
    }
  }, [isPlayingAudio, frozenData, currentWord.answer]);

  // Early returns AFTER all hooks are defined
  if (!user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.background.DEFAULT, color: colors.text.DEFAULT }}
      >
        Sign in first.
      </div>
    );
  }

  const status = duel.status;
  
  if (!isChallenger && !isOpponent) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.background.DEFAULT, color: colors.text.DEFAULT }}
      >
        You&apos;re not part of this duel
      </div>
    );
  }

  // Raw hasAnswered from server (may be stale during question transitions)
  const hasAnsweredRaw = (isChallenger && duel.challengerAnswered) || 
                     (isOpponent && duel.opponentAnswered);
  // Computed hasAnswered that's only valid for the current question (prevents race condition)
  // We already set isLockedIndexRef when user confirms answer, so hasAnswered should only be true
  // if the lock was set for the current question
  const hasAnswered = hasAnsweredRaw && (isLockedIndexRef.current === index);
  const opponentHasAnswered = (isChallenger && duel.opponentAnswered) || 
                              (isOpponent && duel.challengerAnswered);

  // Hint system state
  const myRole = isChallenger ? "challenger" : "opponent";
  const theirRole = isChallenger ? "opponent" : "challenger";
  const hintRequestedBy = duel.hintRequestedBy;
  const hintAccepted = duel.hintAccepted;
  const eliminatedOptions = duel.eliminatedOptions || [];
  
  const canRequestHint = !hasAnswered && opponentHasAnswered && !hintRequestedBy;
  const iRequestedHint = hintRequestedBy === myRole;
  const theyRequestedHint = hintRequestedBy === theirRole;
  const canAcceptHint = hasAnswered && theyRequestedHint && !hintAccepted;
  const isHintProvider = hasAnswered && theyRequestedHint && !!hintAccepted;
  const canEliminate = isHintProvider && eliminatedOptions.length < 2;

  const inTransition = phase === 'transition' && !!frozenData;
  const showListenButton = (hasAnswered || isLocked || inTransition) && ((frozenData?.word ?? word) !== 'done');

  // Scores
  const challengerScore = duel.challengerScore || 0;
  const opponentScore = duel.opponentScore || 0;
  const myScore = isChallenger ? challengerScore : opponentScore;
  const theirScore = isChallenger ? opponentScore : challengerScore;
  const myName = (isChallenger ? challenger?.name : opponent?.name) || "You";
  const theirName = (isChallenger ? opponent?.name : challenger?.name) || "Opponent";

  const mySabotagesUsed = isChallenger 
    ? (duel.challengerSabotagesUsed || 0) 
    : (duel.opponentSabotagesUsed || 0);
  const sabotagesRemaining = MAX_SABOTAGES - mySabotagesUsed;

  // Shared context for answer option buttons
  const displayAnswers = frozenData ? frozenData.shuffledAnswers : shuffledAnswers;
  const displaySelectedAnswer = frozenData ? frozenData.selectedAnswer : selectedAnswer;
  const displayCorrectAnswer = frozenData ? frozenData.correctAnswer : currentWord.answer;
  const displayHasNone = frozenData ? frozenData.hasNoneOption : hasNoneOption;
  const isShowingFeedback = hasAnswered || isLocked || !!frozenData || status === "completed";
  const opponentLastAnswer = isChallenger ? duel.opponentLastAnswer : duel.challengerLastAnswer;

  const optionContext: OptionContext = {
    answer: "", // Will be set per-option
    selectedAnswer: displaySelectedAnswer,
    correctAnswer: displayCorrectAnswer,
    hasNoneOption: displayHasNone,
    isShowingFeedback,
    eliminatedOptions,
    canEliminate,
    opponentLastAnswer: opponentLastAnswer || null,
    status,
    frozenData: frozenData ? { opponentAnswer: frozenData.opponentAnswer } : null,
  };

  const handleOptionClick = (ans: string, canEliminateThis: boolean, isEliminated: boolean) => {
    if (phase !== 'answering') return;
    if (canEliminateThis) {
      handleEliminateOption(ans);
    } else if (!hasAnswered && !isLocked && !isEliminated) {
      setSelectedAnswer(ans, index);
    }
  };

  // Pre-compute difficulty pill JSX
  const currentDifficulty = frozenData ? frozenData.difficulty : difficulty;
  const levelStyles = {
    easy: {
      color: colors.status.success.light,
      backgroundColor: `${colors.status.success.DEFAULT}33`,
      borderColor: colors.status.success.DEFAULT,
    },
    medium: {
      color: colors.status.warning.light,
      backgroundColor: `${colors.status.warning.DEFAULT}33`,
      borderColor: colors.status.warning.DEFAULT,
    },
    hard: {
      color: colors.status.danger.light,
      backgroundColor: `${colors.status.danger.DEFAULT}33`,
      borderColor: colors.status.danger.DEFAULT,
    },
  };
  const difficultyPill = (
    <span
      className="inline-block px-3 py-1 rounded-full border text-sm font-medium"
      style={levelStyles[currentDifficulty.level]}
    >
      {currentDifficulty.level.toUpperCase()} (+{currentDifficulty.points === 1 ? "1" : currentDifficulty.points} pts)
    </span>
  );

  // User role for countdown controls
  const userRole = isChallenger ? "challenger" : "opponent";

  const timerIsDanger = questionTimer !== null && questionTimer <= TIMER_DANGER_THRESHOLD;
  const timerIsWarning = questionTimer !== null && questionTimer <= TIMER_WARNING_THRESHOLD;
  const timerColor = timerIsDanger
    ? colors.status.danger.light
    : timerIsWarning
      ? colors.status.warning.light
      : colors.text.DEFAULT;

  const gameContainerStyle = {
    "--classic-bg": colors.background.DEFAULT,
    "--classic-bg-elevated": `${colors.background.elevated}80`,
    borderColor: colors.primary.dark,
  } as React.CSSProperties;

  const subtleBorderStyle = { borderColor: `${colors.primary.dark}80` };
  const mutedTextStyle = { color: colors.text.muted };

  const exitButtonStyle = {
    backgroundColor: colors.status.danger.DEFAULT,
    color: colors.text.inverse,
  };

  const listenButtonStyle = isPlayingAudio
    ? {
        backgroundColor: colors.status.success.DEFAULT,
        borderColor: colors.status.success.dark,
        color: colors.text.DEFAULT,
      }
    : {
        backgroundColor: colors.secondary.DEFAULT,
        borderColor: colors.secondary.dark,
        color: colors.text.DEFAULT,
      };

  const confirmDisabled = !selectedAnswer || isLocked;
  const confirmButtonStyle = confirmDisabled
    ? {
        backgroundColor: colors.background.elevated,
        borderBottomColor: colors.neutral.dark,
        color: colors.text.muted,
      }
    : {
        backgroundColor: colors.cta.DEFAULT,
        borderBottomColor: colors.cta.dark,
        color: colors.text.DEFAULT,
      };

  const waitingMessageStyle = {
    color: colors.status.warning.light,
    backgroundColor: `${colors.background.DEFAULT}99`,
    borderColor: `${colors.status.warning.DEFAULT}4D`,
  };

  return (
      <main
        className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8"
        style={{ color: colors.text.DEFAULT }}
      >
        <SabotageRenderer effect={activeSabotage} phase={sabotagePhase} />
        
        {/* Game Container - full screen on mobile, centered card on desktop */}
        <div
          className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] bg-[var(--classic-bg)] md:bg-[var(--classic-bg-elevated)]"
          style={gameContainerStyle}
        >
        
        {/* Header: Scoreboard + Exit */}
        <header
          className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 pt-[max(0.75rem,var(--sat))] md:pt-4 border-b"
          style={subtleBorderStyle}
        >
          <Scoreboard
            myName={myName}
            theirName={theirName}
            myScore={myScore}
            theirScore={theirScore}
          />
          
          {status !== "completed" && (
            <button
              onClick={handleStopDuel}
              className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
              style={exitButtonStyle}
            >
              Exit Duel
            </button>
          )}
        </header>

        {/* Main game content - scrollable middle section */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
          {/* Word progress and difficulty */}
          <div className="text-center mb-3">
            <div className="text-sm mb-1" style={mutedTextStyle}>
              Word #{(frozenData ? frozenData.wordIndex : index) + 1} of {words.length}
            </div>
            <div>{difficultyPill}</div>
          </div>

          {/* The word to translate */}
          <div className="text-2xl md:text-3xl font-bold mb-4 text-center">
            {frozenData ? frozenData.word : word}
          </div>
          
          {/* Reversed indicator */}
          {phase === "answering" && activeSabotage === "reverse" && (
            <div
              className="mb-2 text-sm font-medium tracking-wide"
              style={{ color: colors.secondary.light }}
            >
              🔄 REVERSED
            </div>
          )}

          {/* Timer OR Countdown controls */}
          <div className="mb-4 text-center">
            {/* Timer during answering phase */}
            {questionTimer !== null && phase === 'answering' && (
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`text-4xl font-bold tabular-nums ${timerIsDanger ? "animate-pulse" : ""}`}
                  style={{ color: timerColor }}
                >
                  {Math.max(0, Math.min(TIMER_DISPLAY_MAX, Math.ceil(questionTimer - 1)))}
                </span>
                <span className="text-xs" style={mutedTextStyle}>
                  sec
                  {duel.questionTimerPausedAt && (
                    <span className="block" style={{ color: colors.secondary.light }}>
                      Paused
                    </span>
                  )}
                </span>
              </div>
            )}
            
            {/* Countdown controls during transition */}
            {countdown !== null && frozenData && (
              <CountdownControls
                countdown={countdown}
                countdownPausedBy={countdownPausedBy}
                countdownUnpauseRequestedBy={countdownUnpauseRequestedBy}
                userRole={userRole}
                onPause={() => pauseCountdown({ duelId: duel._id }).catch(console.error)}
                onRequestUnpause={() => requestUnpauseCountdown({ duelId: duel._id }).catch(console.error)}
                onConfirmUnpause={() => confirmUnpauseCountdown({ duelId: duel._id }).catch(console.error)}
                countdownSkipRequestedBy={countdownSkipRequestedBy}
                onSkip={() => skipCountdown({ duelId: duel._id }).catch(console.error)}
              />
            )}
          </div>

          {/* TTS Listen button */}
        {showListenButton && (
          <button
            onClick={handlePlayAudio}
            disabled={isPlayingAudio}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all border-2 shadow-lg active:scale-95 mb-5 text-sm ${
              isPlayingAudio ? "cursor-not-allowed" : "hover:brightness-110"
            }`}
            style={listenButtonStyle}
          >
            <span className="text-lg">{isPlayingAudio ? '🔊' : '🔈'}</span>
            <span>{isPlayingAudio ? 'Playing...' : 'Listen'}</span>
          </button>
        )}

        {/* Answer Options - always render container for stable layout */}
        {(frozenData ? frozenData.word : word) !== "done" && (
          <>
            {/* Normal grid layout - use visibility instead of unmounting to prevent layout shift */}
            <div 
              className={`grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md ${
                (activeSabotage === 'bounce' || activeSabotage === 'trampoline') ? 'invisible' : ''
              }`}
            >
            {displayAnswers.map((ans, i) => {
              const state = computeOptionState(ans, { ...optionContext, answer: ans });
              const cleanAns = stripIrr(ans);
              const displayedAnswer =
                activeSabotage === "reverse"
                  ? reverseAnimatedAnswers?.[i] ?? reverseText(cleanAns)
                  : cleanAns;
              
              return (
                <AnswerOptionButton
                  key={i}
                  answer={ans}
                  displayText={displayedAnswer}
                  state={state}
                  onClick={() => handleOptionClick(ans, state.canEliminateThis, state.isEliminated)}
                  showTypeReveal={isRevealing && !!frozenData}
                  typedText={typedText}
                  revealComplete={revealComplete}
                  hasNoneOption={displayHasNone}
                  isShowingFeedback={isShowingFeedback}
                />
              );
            })}
            </div>

            {/* Bouncing options when bounce sabotage is active */}
          {activeSabotage === 'bounce' && bouncingOptions.length > 0 && (
            <div className="fixed inset-0 z-50 pointer-events-none">
              {displayAnswers.map((ans, i) => {
                const bouncePos = bouncingOptions[i];
                if (!bouncePos) return null;

                const state = computeOptionState(ans, { ...optionContext, answer: ans });
                const cleanAns = stripIrr(ans);
                
                return (
                  <AnswerOptionButton
                    key={i}
                    answer={ans}
                    displayText={cleanAns}
                    state={state}
                    onClick={() => handleOptionClick(ans, state.canEliminateThis, state.isEliminated)}
                    hasNoneOption={displayHasNone}
                    isShowingFeedback={isShowingFeedback}
                    isFlying
                    style={{
                      position: 'absolute',
                      left: bouncePos.x,
                      top: bouncePos.y,
                      width: BUTTON_WIDTH,
                      height: BUTTON_HEIGHT,
                      pointerEvents: 'auto',
                      transform: `scale(${BOUNCE_FLY_SCALE})`,
                      transformOrigin: 'top left',
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Trampoline options when trampoline sabotage is active */}
          {activeSabotage === 'trampoline' && trampolineOptions.length > 0 && (
            <div className="fixed inset-0 z-50 pointer-events-none">
              {displayAnswers.map((ans, i) => {
                const trampPos = trampolineOptions[i];
                if (!trampPos) return null;

                const state = computeOptionState(ans, { ...optionContext, answer: ans });
                const cleanAns = stripIrr(ans);

                return (
                  <AnswerOptionButton
                    key={i}
                    answer={ans}
                    displayText={cleanAns}
                    state={state}
                    onClick={() => handleOptionClick(ans, state.canEliminateThis, state.isEliminated)}
                    hasNoneOption={displayHasNone}
                    isShowingFeedback={isShowingFeedback}
                    isFlying
                    style={{
                      position: 'absolute',
                      left: trampPos.x + trampPos.shakeOffset.x,
                      top: trampPos.y + trampPos.shakeOffset.y,
                      width: TRAMPOLINE_BUTTON_WIDTH,
                      height: TRAMPOLINE_BUTTON_HEIGHT,
                      pointerEvents: 'auto',
                      transform: trampPos.phase === 'flying' ? `scale(${TRAMPOLINE_FLY_SCALE})` : 'scale(1)',
                      transformOrigin: 'top left',
                    }}
                  />
                );
              })}
            </div>
          )}
          </>
        )}
        </div>

        {/* Footer: Confirm + Sabotage - always visible */}
        <footer
          className="flex-shrink-0 flex flex-col items-center gap-2 w-full px-4 py-3 pb-[max(0.75rem,var(--sab))] md:pb-4 border-t"
          style={subtleBorderStyle}
        >
        {/* Confirm Button */}
        {!hasAnswered && phase === 'answering' && word !== "done" && (
          <button
            className="w-full rounded-xl px-6 sm:px-10 py-2.5 sm:py-3 font-bold text-base sm:text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 hover:brightness-110"
            style={confirmButtonStyle}
            disabled={confirmDisabled}
            onClick={handleConfirmAnswer}
          >
            Confirm Answer
          </button>
        )}

        {/* Hint System UI */}
        {phase === 'answering' && word !== "done" && (
          <HintSystemUI
            canRequestHint={canRequestHint}
            iRequestedHint={iRequestedHint}
            theyRequestedHint={theyRequestedHint}
            hintAccepted={!!hintAccepted}
            canAcceptHint={canAcceptHint}
            isHintProvider={isHintProvider}
            hasAnswered={hasAnswered}
            eliminatedOptionsCount={eliminatedOptions.length}
            onRequestHint={handleRequestHint}
            onAcceptHint={handleAcceptHint}
            requestHintText="Begging for help!"
            acceptHintText="Bafoon is begging"
          />
        )}

        {/* Sabotage System UI */}
        <SabotageSystemUI
          status={status}
          phase={phase}
          word={word}
          sabotagesRemaining={sabotagesRemaining}
          isLocked={isLocked}
          hasAnswered={hasAnswered}
          isOutgoingSabotageActive={isOutgoingSabotageActive}
          opponentHasAnswered={opponentHasAnswered}
          onSendSabotage={handleSendSabotage}
        />

        {/* Waiting message */}
        {hasAnswered && phase === 'answering' && word !== "done" && !theyRequestedHint && (
          <div
            className="font-medium animate-pulse px-3 sm:px-4 py-1 rounded-full backdrop-blur-sm border text-sm sm:text-base"
            style={waitingMessageStyle}
          >
            Waiting for opponent...
          </div>
        )}

        {/* Final Results - shown at end, no separate screen */}
        {status === "completed" && (
          <FinalResultsPanel
            myName={myName}
            theirName={theirName}
            myScore={myScore}
            theirScore={theirScore}
            onBackToHome={() => router.push('/')}
            duelDuration={duelDuration}
          />
        )}
        </footer>
      </div>
      </main>
  );
}
