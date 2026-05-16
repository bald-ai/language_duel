"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import type { SabotageEffect } from "@/lib/sabotage/types";
import {
  SABOTAGE_DURATION_MS,
  SABOTAGE_FALLBACK_DURATION_MS,
  MAX_SABOTAGES,
} from "@/lib/sabotage/constants";
import { getSabotageExpiryAt, isSabotageActive } from "@/lib/sabotage/active";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { forRole } from "@/lib/duelRole";
import {
  TYPE_REVEAL_DELAY_MS,
  TYPE_REVEAL_INTERVAL_MS,
} from "@/lib/duelConstants";
import { useSabotageEffect } from "./hooks/useSabotageEffect";
import { useDuelAudio } from "./hooks/useDuelAudio";
import { useDuelCountdown } from "./hooks/useDuelCountdown";
import { useDuelQuestionTimer } from "./hooks/useDuelQuestionTimer";
import { getErrorMessage, isExpectedDuelRaceError } from "./hooks/useDuelRaceErrors";
import { DuelView, type FrozenData } from "./components/DuelView";
import { colors } from "@/lib/theme";
import { formatVisibleUser } from "@/lib/userDisplay";
import { toast } from "sonner";

// Props interface
type DuelPlayerSummary = Pick<Doc<"users">, "_id" | "name" | "nickname" | "discriminator" | "imageUrl">;
type ViewerSafeDuelQuestion = NonNullable<Doc<"duels">["duelQuestions"]>[number] & {
  correctOption?: string;
  answerRevealedToViewer?: boolean;
};

interface DuelSessionProps {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
}

export default function DuelSession({
  duel,
  challenger,
  opponent,
  viewerRole,
}: DuelSessionProps) {
  const router = useRouter();
  const { user } = useUser();
  const viewerIsChallenger = viewerRole === "challenger";
  const { isPlayingAudio, playAudio } = useDuelAudio();

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
  const [frozenData, setFrozenData] = useState<FrozenData | null>(null);
  const [sabotageNow, setSabotageNow] = useState(() => Date.now());

  // Type reveal effect state for "None of the above" correct answer
  const [isRevealing, setIsRevealing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [revealComplete, setRevealComplete] = useState(false);

  // Mutations
  const answer = useMutation(api.gameplay.answerDuel);
  const stopDuel = useMutation(api.duels.stopDuel);
  const requestHint = useMutation(api.hints.requestHint);
  const acceptHint = useMutation(api.hints.acceptHint);
  const eliminateOption = useMutation(api.hints.eliminateOption);
  const timeoutAnswer = useMutation(api.gameplay.timeoutAnswer);
  const sendSabotage = useMutation(api.sabotage.sendSabotage);
  const pauseCountdown = useMutation(api.gameplay.pauseCountdown);
  const requestUnpauseCountdown = useMutation(api.gameplay.requestUnpauseCountdown);
  const confirmUnpauseCountdown = useMutation(api.gameplay.confirmUnpauseCountdown);
  const skipCountdown = useMutation(api.gameplay.skipCountdown);

  const hasTimedOutRef = useRef(false);

  // Duel start time tracking for total duration
  const duelStartTimeRef = useRef<number | null>(null);
  const [duelDuration, setDuelDuration] = useState<number>(0);

  // Phase-based state machine for question flow
  const [phase, setPhase] = useState<"idle" | "answering" | "transition">("idle");
  const activeQuestionIndexRef = useRef<number | null>(null);
  const lockedAnswerRef = useRef<string | null>(null);

  // Extract values
  const wordOrder = duel.wordOrder;
  const words = duel.sessionWords;
  const isCompleted = duel.status === "completed";
  const rawIndex = duel.currentWordIndex ?? 0;
  const index = isCompleted && words.length > 0 ? words.length - 1 : rawIndex;
  // Computed selectedAnswer that's only valid for the current question (prevents race condition)
  const selectedAnswer = (selectedAnswerIndexRef.current === index) ? selectedAnswerRaw : null;
  // Computed isLocked that's only valid for the current question (prevents race condition)
  const isLocked = (isLockedIndexRef.current === index) ? isLockedRaw : false;
  const roleView = forRole(duel, viewerRole);
  const {
    myScore,
    theirScore,
    myAnswered,
    theirAnswered,
    mySabotage,
    theirSabotage,
    mySabotagesUsed,
    theirLastAnswer,
    theirRole,
  } = roleView;

  // Sabotage effect management (extracted to hook)
  const { activeSabotage, sabotagePhase } = useSabotageEffect({
    mySabotage,
    phase,
    isLocked,
  });

  const actualWordIndex = wordOrder ? wordOrder[index] : index;
  const currentQuestion = duel.duelQuestions![index] as ViewerSafeDuelQuestion;
  // Memoize currentWord to avoid creating new object reference on every render
  const currentWord = useMemo(
    () => words[actualWordIndex] || { word: "done", answer: "done", wrongAnswers: [] },
    [words, actualWordIndex]
  );
  const word = currentWord.word;
  const sourceThemeName = useMemo(() => {
    const hasMultipleThemes = new Set(words.map((sessionWord) => String(sessionWord.themeId))).size > 1;
    if (!hasMultipleThemes) return null;
    const visibleWordIndex = frozenData
      ? (wordOrder ? wordOrder[frozenData.wordIndex] : frozenData.wordIndex)
      : actualWordIndex;
    const visibleWord = words[visibleWordIndex];
    const themeName = (visibleWord as { themeName?: string } | undefined)?.themeName;
    return typeof themeName === "string" ? themeName : null;
  }, [words, frozenData, wordOrder, actualWordIndex]);

  const currentWordIndex = duel.currentWordIndex;

  // Unified transition effect
  useEffect(() => {
    if (currentWordIndex === undefined || !words.length) return;

    if (activeQuestionIndexRef.current === null) {
      activeQuestionIndexRef.current = currentWordIndex;
      setPhase("answering");
      return;
    }

    if (activeQuestionIndexRef.current === currentWordIndex) return;

    const prevIndex = activeQuestionIndexRef.current;
    const shouldShowTransition = isLocked || lockedAnswerRef.current || hasTimedOutRef.current;

    if (shouldShowTransition) {
      const prevActualIndex = wordOrder ? wordOrder[prevIndex] : prevIndex;
      const prevWord = words[prevActualIndex] || { word: "", answer: "", wrongAnswers: [] };
      const prevQuestion = duel.duelQuestions![prevIndex] as ViewerSafeDuelQuestion;
      const prevCorrectOption = prevQuestion.correctOption ?? null;

      setPhase("transition");
      setFrozenData({
        word: prevWord.word,
        correctAnswer: prevQuestion.answerRevealedToViewer === true ? prevWord.answer : null,
        shuffledAnswers: prevQuestion.options,
        selectedAnswer: lockedAnswerRef.current,
        opponentAnswer: theirLastAnswer || null,
        wordIndex: prevIndex,
        hasNoneOption: prevCorrectOption === null ? null : prevCorrectOption === NONE_OF_ABOVE,
        difficulty: {
          level: prevQuestion.difficulty,
          points: prevQuestion.points,
        },
      });

      const isLastQuestion = prevIndex >= words.length - 1;
      if (!isLastQuestion) {
        setCountdown(5);
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

  // Countdown timer
  const countdownPausedBy = duel.countdownPausedBy;
  const countdownUnpauseRequestedBy = duel.countdownUnpauseRequestedBy;
  // Memoize to avoid new array reference on every render
  const countdownSkipRequestedBy = useMemo(
    () => duel.countdownSkipRequestedBy || [],
    [duel.countdownSkipRequestedBy]
  );
  const handleTransitionCountdownComplete = useCallback(() => {
    setPhase("answering");
    setFrozenData(null);
    setSelectedAnswer(null);
    setIsLocked(false);
    lockedAnswerRef.current = null;
    hasTimedOutRef.current = false;
    setIsRevealing(false);
    setTypedText("");
    setRevealComplete(false);
  }, [setIsLocked, setSelectedAnswer]);

  const { countdown, setCountdown } = useDuelCountdown({
    phase,
    duelStatus: duel.status,
    countdownPausedBy,
    countdownSkipRequestedBy,
    onCountdownComplete: handleTransitionCountdownComplete,
  });

  // Type reveal effect
  useEffect(() => {
    if (!frozenData || !frozenData.hasNoneOption) return;
    const startDelay = setTimeout(() => setIsRevealing(true), TYPE_REVEAL_DELAY_MS);
    return () => clearTimeout(startDelay);
  }, [frozenData]);

  useEffect(() => {
    if (!isRevealing || !frozenData) return;

    const correctAnswer = frozenData.correctAnswer;
    if (correctAnswer === null) return;
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
    if (status === "stopped") {
      router.push("/");
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
    const wasNotAnswering = prevPhaseRef.current !== "answering";
    const isNowAnswering = phase === "answering";
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

  const handleTimeoutAnswer = useCallback(async (questionIndex: number) => {
    try {
      await timeoutAnswer({ duelId: duel._id, questionIndex });
    } catch (error) {
      if (!isExpectedDuelRaceError(error)) {
        console.error("Failed to submit timeout answer:", error);
      }
    }
  }, [duel._id, timeoutAnswer]);

  const questionTimer = useDuelQuestionTimer({
    phase,
    duelStatus: duel.status,
    duelId: duel._id,
    questionStartTime: duel.questionStartTime,
    questionTimerPausedAt: duel.questionTimerPausedAt,
    currentWordIndex: duel.currentWordIndex,
    questionIndex: index,
    myAnswered,
    hasTimedOutRef,
    onTimeout: handleTimeoutAnswer,
  });

  const difficulty = useMemo(
    () => ({
      level: currentQuestion.difficulty,
      points: currentQuestion.points,
    }),
    [currentQuestion.difficulty, currentQuestion.points]
  );
  const shuffledAnswers = currentQuestion.options;
  const answerRevealedToViewer = currentQuestion.answerRevealedToViewer === true;
  const currentCorrectAnswer = answerRevealedToViewer ? currentWord.answer : null;
  const hasNoneOption = answerRevealedToViewer
    ? currentQuestion.correctOption === NONE_OF_ABOVE
    : null;

  // Check role (needed for useMemo below)
  const isChallenger = viewerIsChallenger;
  const isOpponent = viewerRole === "opponent";
  const outgoingSabotage = theirSabotage;
  const outgoingSabotageEffect = outgoingSabotage?.effect;
  const outgoingSabotageTimestamp = outgoingSabotage?.timestamp;

  useEffect(() => {
    if (!outgoingSabotageEffect || typeof outgoingSabotageTimestamp !== "number") return;

    setSabotageNow(Date.now());

    const expiresAt = getSabotageExpiryAt({
      sabotage: { effect: outgoingSabotageEffect, timestamp: outgoingSabotageTimestamp },
      questionStartTime:
        typeof duel.questionStartTime === "number"
          ? duel.questionStartTime
          : undefined,
      sabotageDurationMs: SABOTAGE_DURATION_MS,
      sabotageFallbackDurationMs: SABOTAGE_FALLBACK_DURATION_MS,
    });

    if (expiresAt === null) return;

    const timer = setTimeout(
      () => setSabotageNow(Date.now()),
      Math.max(0, expiresAt - Date.now() + 50)
    );

    return () => clearTimeout(timer);
  }, [outgoingSabotageEffect, outgoingSabotageTimestamp, duel.questionStartTime]);

  // Memoized sabotage active check - updates when sabotage or question changes
  // MUST be called before any early returns to follow React Hook rules
  const isOutgoingSabotageActive = useMemo(
    () => isSabotageActive({
      sabotage: outgoingSabotage,
      now: sabotageNow,
      questionStartTime:
        typeof duel.questionStartTime === "number"
          ? duel.questionStartTime
          : undefined,
    }),
    [outgoingSabotage, sabotageNow, duel.questionStartTime]
  );

  // All useCallback hooks MUST be defined before any early returns (React rules of hooks)
  const handleStopDuel = useCallback(async () => {
    try {
      await stopDuel({ duelId: duel._id });
      router.push("/");
    } catch (error) {
      console.error("Failed to stop duel:", error);
      toast.error(getErrorMessage(error, "Failed to stop duel"));
    }
  }, [stopDuel, duel._id, router]);

  const handleConfirmAnswer = useCallback(async () => {
    if (!selectedAnswer) return;
    lockedAnswerRef.current = selectedAnswer;
    setIsLocked(true);
    try {
      await answer({ duelId: duel._id, selectedAnswer, questionIndex: index });
    } catch (error) {
      if (isExpectedDuelRaceError(error)) {
        return;
      }
      console.error("Failed to submit answer:", error);
      toast.error(getErrorMessage(error, "Failed to submit answer"));
      setIsLocked(false);
      lockedAnswerRef.current = null;
    }
  }, [selectedAnswer, answer, duel._id, index, setIsLocked]);

  const handleRequestHint = useCallback(async () => {
    try {
      await requestHint({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to request hint:", error);
      toast.error(getErrorMessage(error, "Failed to request hint"));
    }
  }, [requestHint, duel._id]);

  const handleAcceptHint = useCallback(async () => {
    try {
      await acceptHint({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to accept hint:", error);
      toast.error(getErrorMessage(error, "Failed to accept hint"));
    }
  }, [acceptHint, duel._id]);

  const handleEliminateOption = useCallback(async (option: string) => {
    try {
      await eliminateOption({ duelId: duel._id, option });
    } catch (error) {
      console.error("Failed to eliminate option:", error);
      toast.error(getErrorMessage(error, "Failed to eliminate option"));
    }
  }, [eliminateOption, duel._id]);

  const handleSendSabotage = useCallback(async (effect: SabotageEffect) => {
    try {
      await sendSabotage({ duelId: duel._id, effect });
    } catch (error) {
      console.error("Failed to send sabotage:", error);
      toast.error(getErrorMessage(error, "Failed to send sabotage"));
    }
  }, [sendSabotage, duel._id]);

  const handlePlayAudio = useCallback(() => {
    const activeWord = frozenData
      ? words[wordOrder ? wordOrder[frozenData.wordIndex] : frozenData.wordIndex]
      : currentWord;
    const correctAnswer = activeWord?.answer;
    if (!correctAnswer || correctAnswer === "done") return;
    playAudio(`duel-answer-${correctAnswer}`, correctAnswer, activeWord.ttsStorageId);
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
  const hasAnsweredRaw = myAnswered;
  // Computed hasAnswered that's only valid for the current question (prevents race condition)
  // We already set isLockedIndexRef when user confirms answer, so hasAnswered should only be true
  // if the lock was set for the current question
  const hasAnswered = hasAnsweredRaw && (isLockedIndexRef.current === index);
  const opponentHasAnswered = theirAnswered;

  // Hint system state
  const myRole = viewerRole;
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
  const myName = formatVisibleUser(isChallenger ? challenger : opponent, "You");
  const theirName = formatVisibleUser(isChallenger ? opponent : challenger, "Opponent");

  const sabotagesRemaining = MAX_SABOTAGES - mySabotagesUsed;
  const opponentLastAnswer = theirLastAnswer;

  const handleOptionClick = (ans: string, canEliminateThis: boolean, isEliminated: boolean) => {
    if (phase !== "answering") return;
    if (canEliminateThis) {
      handleEliminateOption(ans);
    } else if (!hasAnswered && !isLocked && !isEliminated) {
      setSelectedAnswer(ans, index);
    }
  };
  const userRole = viewerRole;
  const difficultyForView = { level: difficulty.level, points: difficulty.points };

  return (
    <DuelView
      status={status}
      phase={phase}
      round={{
        wordsCount: words.length,
        index,
        word,
        sourceThemeName,
        frozenData,
        difficulty: difficultyForView,
        duelDuration,
      }}
      timer={{
        questionTimer,
        questionTimerPausedAt: duel.questionTimerPausedAt,
      }}
      countdown={{
        value: countdown,
        pausedBy: countdownPausedBy,
        unpauseRequestedBy: countdownUnpauseRequestedBy,
        skipRequestedBy: countdownSkipRequestedBy,
        userRole,
      }}
      answers={{
        shuffledAnswers,
        selectedAnswer,
        correctAnswer: currentCorrectAnswer,
        hasNoneOption,
        eliminatedOptions,
        opponentLastAnswer: opponentLastAnswer || null,
        isRevealing,
        typedText,
        revealComplete,
        hasAnswered,
        opponentHasAnswered,
        isLocked,
      }}
      hints={{
        canRequestHint,
        iRequestedHint,
        theyRequestedHint,
        hintAccepted: !!hintAccepted,
        canAcceptHint,
        isHintProvider,
        canEliminate,
        eliminatedOptionsCount: eliminatedOptions.length,
      }}
      sabotage={{
        activeSabotage,
        sabotagePhase,
        sabotagesRemaining,
        isOutgoingSabotageActive,
      }}
      score={{
        myName,
        theirName,
        myScore,
        theirScore,
        bossType: duel.bossType,
        bossLivesRemaining: duel.bossLivesRemaining,
        bossLivesTotal: duel.bossLivesTotal,
      }}
      actions={{
        onPauseCountdown: () => pauseCountdown({ duelId: duel._id }).catch((error) => {
          console.error("Failed to pause countdown:", error);
          toast.error(getErrorMessage(error, "Failed to pause countdown"));
        }),
        onRequestUnpause: () => requestUnpauseCountdown({ duelId: duel._id }).catch((error) => {
          console.error("Failed to request countdown resume:", error);
          toast.error(getErrorMessage(error, "Failed to request countdown resume"));
        }),
        onConfirmUnpause: () => confirmUnpauseCountdown({ duelId: duel._id }).catch((error) => {
          console.error("Failed to resume countdown:", error);
          toast.error(getErrorMessage(error, "Failed to resume countdown"));
        }),
        onSkipCountdown: () => skipCountdown({ duelId: duel._id }).catch((error) => {
          console.error("Failed to skip countdown:", error);
          toast.error(getErrorMessage(error, "Failed to skip countdown"));
        }),
        onPlayAudio: handlePlayAudio,
        onOptionClick: handleOptionClick,
        onConfirmAnswer: handleConfirmAnswer,
        onRequestHint: handleRequestHint,
        onAcceptHint: handleAcceptHint,
        onSendSabotage: handleSendSabotage,
        onExit: handleStopDuel,
        onBackToHome: () => router.push("/"),
      }}
      audio={{ isPlaying: isPlayingAudio }}
    />
  );
}
