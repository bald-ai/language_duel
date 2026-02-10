"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  calculateClassicDifficultyDistribution,
  getDifficultyForIndex,
  type ClassicDifficultyPreset,
} from "@/lib/difficultyUtils";
import type { Doc } from "@/convex/_generated/dataModel";
import type { SabotageEffect } from "@/lib/sabotage/types";
import { SABOTAGE_DURATION_MS, MAX_SABOTAGES } from "@/lib/sabotage/constants";
import { shuffleAnswersForQuestion } from "@/lib/answerShuffle";
import type { WordEntry } from "@/lib/types";
import {
  QUESTION_TIMER_SECONDS,
  TRANSITION_COUNTDOWN_SECONDS,
  TYPE_REVEAL_DELAY_MS,
  TYPE_REVEAL_INTERVAL_MS,
  TIMER_UPDATE_INTERVAL_MS,
} from "@/lib/duelConstants";
import { useSabotageEffect } from "./hooks/useSabotageEffect";
import { useClassicDuelAudio } from "./hooks/useClassicDuelAudio";
import { ClassicDuelView, type FrozenData } from "./components/ClassicDuelView";
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
  const { isPlayingAudio, playAudio } = useClassicDuelAudio();

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
  const [frozenData, setFrozenData] = useState<FrozenData | null>(null);

  // Type reveal effect state for "None of the above" correct answer
  const [isRevealing, setIsRevealing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [revealComplete, setRevealComplete] = useState(false);

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
      const prevDifficultyForShuffle = {
        level: prevDifficultyData.level,
        wrongCount: prevDifficultyData.wrongCount,
      };

      // Use shared shuffle utility for deterministic answer order
      const { answers: prevShuffled, hasNoneOption: prevHasNone } = shuffleAnswersForQuestion(
        prevWord as WordEntry,
        prevIndex,
        prevDifficultyForShuffle
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
        difficulty: {
          level: prevDifficultyData.level,
          points: prevDifficultyData.points,
        },
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

  const handlePlayAudio = useCallback(() => {
    const activeWord = frozenData
      ? words[wordOrder ? wordOrder[frozenData.wordIndex] : frozenData.wordIndex]
      : currentWord;
    const correctAnswer = activeWord?.answer;
    if (!correctAnswer || correctAnswer === "done") return;
    playAudio(`classic-answer-${correctAnswer}`, correctAnswer, activeWord.ttsStorageId);
  }, [currentWord, frozenData, playAudio, wordOrder, words]);

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
  const opponentLastAnswer = isChallenger ? duel.opponentLastAnswer : duel.challengerLastAnswer;

  const handleOptionClick = (ans: string, canEliminateThis: boolean, isEliminated: boolean) => {
    if (phase !== 'answering') return;
    if (canEliminateThis) {
      handleEliminateOption(ans);
    } else if (!hasAnswered && !isLocked && !isEliminated) {
      setSelectedAnswer(ans, index);
    }
  };
  const userRole = isChallenger ? "challenger" : "opponent";
  const difficultyForView = { level: difficulty.level, points: difficulty.points };

  return (
    <ClassicDuelView
      activeSabotage={activeSabotage}
      sabotagePhase={sabotagePhase}
      status={status}
      phase={phase}
      wordsCount={words.length}
      index={index}
      word={word}
      frozenData={frozenData}
      difficulty={difficultyForView}
      questionTimer={questionTimer}
      questionTimerPausedAt={duel.questionTimerPausedAt}
      countdown={countdown}
      countdownPausedBy={countdownPausedBy}
      countdownUnpauseRequestedBy={countdownUnpauseRequestedBy}
      countdownSkipRequestedBy={countdownSkipRequestedBy}
      userRole={userRole}
      onPauseCountdown={() => pauseCountdown({ duelId: duel._id }).catch(console.error)}
      onRequestUnpause={() => requestUnpauseCountdown({ duelId: duel._id }).catch(console.error)}
      onConfirmUnpause={() => confirmUnpauseCountdown({ duelId: duel._id }).catch(console.error)}
      onSkipCountdown={() => skipCountdown({ duelId: duel._id }).catch(console.error)}
      isPlayingAudio={isPlayingAudio}
      onPlayAudio={handlePlayAudio}
      shuffledAnswers={shuffledAnswers}
      selectedAnswer={selectedAnswer}
      correctAnswer={currentWord.answer}
      hasNoneOption={hasNoneOption}
      eliminatedOptions={eliminatedOptions}
      canEliminate={canEliminate}
      opponentLastAnswer={opponentLastAnswer || null}
      onOptionClick={handleOptionClick}
      isRevealing={isRevealing}
      typedText={typedText}
      revealComplete={revealComplete}
      onConfirmAnswer={handleConfirmAnswer}
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
      sabotagesRemaining={sabotagesRemaining}
      isOutgoingSabotageActive={isOutgoingSabotageActive}
      opponentHasAnswered={opponentHasAnswered}
      isLocked={isLocked}
      onSendSabotage={handleSendSabotage}
      myName={myName}
      theirName={theirName}
      myScore={myScore}
      theirScore={theirScore}
      onExit={handleStopDuel}
      duelDuration={duelDuration}
      onBackToHome={() => router.push("/")}
    />
  );
}
