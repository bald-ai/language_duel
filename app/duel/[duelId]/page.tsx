"use client";

import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo, useCallback } from "react";
import { calculateDifficultyDistribution, getDifficultyForIndex } from "@/lib/difficultyUtils";
import { shuffleAnswersForQuestion } from "@/lib/answerShuffle";
import { DuelGameUI } from "./components/DuelGameUI";
import { DuelStatusMessage } from "./components/DuelStatusMessage";
import { useDuelAnswerEffects } from "./hooks/useDuelAnswerEffects";
import { useDuelHintState } from "./hooks/useDuelHintState";
import { useDuelPageEffects } from "./hooks/useDuelPageEffects";
import { useDuelPhase } from "./hooks/useDuelPhase";
import { useQuestionTimer } from "./hooks/useQuestionTimer";
import { useTTS } from "@/app/game/hooks";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

const SoloStyleChallenge = dynamic(() => import("./SoloStyleChallenge"), { loading: () => null });

export default function DuelPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const duelId = typeof params.duelId === "string" ? params.duelId : "";
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // TTS audio playback
  const { isPlaying: isPlayingAudio, playTTS } = useTTS();

  const duelData = useQuery(api.duel.getDuel, duelId ? { duelId: duelId as Id<"challenges"> } : "skip");
  const answer = useMutation(api.duel.answerDuel);
  const stopDuel = useMutation(api.duel.stopDuel);
  const requestHint = useMutation(api.duel.requestHint);
  const acceptHint = useMutation(api.duel.acceptHint);
  const eliminateOption = useMutation(api.duel.eliminateOption);
  const timeoutAnswer = useMutation(api.duel.timeoutAnswer);
  const pauseCountdown = useMutation(api.duel.pauseCountdown);
  const requestUnpauseCountdown = useMutation(api.duel.requestUnpauseCountdown);
  const confirmUnpauseCountdown = useMutation(api.duel.confirmUnpauseCountdown);

  // Extract values safely for hooks (before any returns)
  const duel = duelData?.duel;
  const challenger = duelData?.challenger;
  const opponent = duelData?.opponent;
  const viewerRole = duelData?.viewerRole as "challenger" | "opponent" | undefined;
  const viewerIsChallenger = viewerRole === "challenger";
  const {
    isChallenger,
    isOpponent,
    hasAnswered,
    opponentHasAnswered,
    hintAccepted,
    eliminatedOptions,
    canRequestHint,
    iRequestedHint,
    theyRequestedHint,
    canAcceptHint,
    isHintProvider,
    canEliminate,
  } = useDuelHintState({ duel, viewerRole });

  useDuelPageEffects({
    duelId,
    duel,
    duelData,
    router,
  });

  const wordOrder = duel?.wordOrder;
  const theme = duelData?.theme ?? null;
  const words = useMemo(() => theme?.words ?? [], [theme?.words]);

  // When completed, show the last word; otherwise show current word
  const isCompleted = duel?.status === "completed";
  const rawIndex = duel?.currentWordIndex ?? 0;
  const index = isCompleted && words.length > 0 ? words.length - 1 : rawIndex;

  // Use shuffled word order if available, otherwise fall back to sequential
  const actualWordIndex = wordOrder ? wordOrder[index] : index;
  const currentWord = useMemo(
    () => words[actualWordIndex] || { word: "done", answer: "done", wrongAnswers: [] },
    [words, actualWordIndex]
  );
  const word = currentWord.word;

  // Calculate dynamic difficulty distribution based on total word count
  const difficultyDistribution = useMemo(
    () => calculateDifficultyDistribution(words.length),
    [words.length]
  );

  // Track word index from server for transition detection
  const currentWordIndex = duel?.currentWordIndex;
  const countdownPausedBy = duel?.countdownPausedBy;
  const countdownUnpauseRequestedBy = duel?.countdownUnpauseRequestedBy;

  // Use the extracted phase management hook
  const {
    phase,
    frozenData,
    countdown,
    hasTimedOutRef,
    isRevealing,
    typedText,
    revealComplete,
    setLockedAnswer,
    setHasTimedOut,
  } = useDuelPhase({
    currentWordIndex,
    words,
    wordOrder,
    viewerIsChallenger,
    opponentLastAnswer: duel?.opponentLastAnswer,
    challengerLastAnswer: duel?.challengerLastAnswer,
    isLocked,
    duelStatus: duel?.status,
    countdownPausedBy,
  });

  useDuelAnswerEffects({
    phase,
    eliminatedOptions,
    selectedAnswer,
    setSelectedAnswer,
    setIsLocked,
  });

  // Determine if user has answered (for timer hook - needs to be computed before hook call)
  const challengerAnswered = duel?.challengerAnswered ?? false;
  const opponentAnswered = duel?.opponentAnswered ?? false;
  const hasAnsweredForTimer = viewerIsChallenger ? challengerAnswered : opponentAnswered;

  // Question timer - extracted to hook
  const { questionTimer } = useQuestionTimer({
    phase,
    questionStartTime: duel?.questionStartTime,
    questionTimerPausedAt: duel?.questionTimerPausedAt,
    currentWordIndex: duel?.currentWordIndex,
    duelStatus: duel?.status,
    duelId: duel?._id,
    hasAnswered: hasAnsweredForTimer,
    timeoutAnswer,
    hasTimedOutRef,
    setHasTimedOut,
  });

  // Difficulty scaling based on question index using dynamic distribution
  const difficulty = useMemo(
    () => getDifficultyForIndex(index, difficultyDistribution),
    [index, difficultyDistribution]
  );

  // Shuffle answers with difficulty-based option selection (MUST be before any returns)
  const { shuffledAnswers, hasNoneOption } = useMemo(() => {
    if (word === "done" || !currentWord.wrongAnswers?.length) {
      return { shuffledAnswers: [], hasNoneOption: false };
    }

    const { answers, hasNoneOption: hasNone } = shuffleAnswersForQuestion(currentWord, index, {
      level: difficulty.level,
      wrongCount: difficulty.wrongCount,
    });

    return { shuffledAnswers: answers, hasNoneOption: hasNone };
  }, [currentWord, word, index, difficulty.level, difficulty.wrongCount]);

  // Handlers (defined before early returns so they can be passed to DuelGameUI)
  const handleStopDuel = useCallback(async () => {
    if (!duel) return;
    try {
      await stopDuel({ duelId: duel._id });
      router.push("/");
    } catch (error) {
      console.error("Failed to stop duel:", error);
      toast.error("Failed to stop duel");
    }
  }, [duel, stopDuel, router]);

  const handleConfirmAnswer = useCallback(async () => {
    if (!selectedAnswer || !duel) return;
    setLockedAnswer(selectedAnswer);
    setIsLocked(true);
    try {
      await answer({
        duelId: duel._id,
        selectedAnswer,
        questionIndex: index,
      });
    } catch (error) {
      console.error("Failed to submit answer:", error);
      toast.error("Failed to submit answer");
      setIsLocked(false);
      setLockedAnswer(null);
    }
  }, [selectedAnswer, duel, answer, index, setLockedAnswer]);

  const handleRequestHint = useCallback(async () => {
    if (!duel) return;
    try {
      await requestHint({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to request hint:", error);
      toast.error("Failed to request hint");
    }
  }, [duel, requestHint]);

  const handleAcceptHint = useCallback(async () => {
    if (!duel) return;
    try {
      await acceptHint({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to accept hint:", error);
      toast.error("Failed to accept hint");
    }
  }, [duel, acceptHint]);

  const handleEliminateOption = useCallback(
    async (option: string) => {
      if (!duel) return;
      try {
        await eliminateOption({ duelId: duel._id, option });
      } catch (error) {
        console.error("Failed to eliminate option:", error);
        toast.error("Failed to eliminate option");
      }
    },
    [duel, eliminateOption]
  );

  const handlePlayAudio = useCallback(() => {
    const activeWord = frozenData
      ? words[wordOrder ? wordOrder[frozenData.wordIndex] : frozenData.wordIndex]
      : currentWord;
    const correctAnswer = activeWord?.answer;
    if (!correctAnswer || correctAnswer === "done") return;
    playTTS(`duel-answer-${correctAnswer}`, correctAnswer, {
      storageId: activeWord?.ttsStorageId,
    });
  }, [currentWord, frozenData, playTTS, wordOrder, words]);

  const handlePauseCountdown = useCallback(() => {
    if (!duel) return;
    pauseCountdown({ duelId: duel._id }).catch(console.error);
  }, [duel, pauseCountdown]);

  const handleRequestUnpause = useCallback(() => {
    if (!duel) return;
    requestUnpauseCountdown({ duelId: duel._id }).catch(console.error);
  }, [duel, requestUnpauseCountdown]);

  const handleConfirmUnpause = useCallback(() => {
    if (!duel) return;
    confirmUnpauseCountdown({ duelId: duel._id }).catch(console.error);
  }, [duel, confirmUnpauseCountdown]);

  const handleBackToHome = useCallback(() => {
    router.push("/");
  }, [router]);

  // Early returns AFTER all hooks
  if (!user) return <DuelStatusMessage message="Sign in first." tone="warning" />;
  if (!duelId) return <DuelStatusMessage message="Invalid duel link." tone="danger" />;
  if (duelData === undefined)
    return <DuelStatusMessage message="Loading duel..." showSpinner />;
  if (duelData === null)
    return <DuelStatusMessage message="You're not part of this duel" tone="danger" />;
  if (!theme) return <DuelStatusMessage message="Loading theme..." showSpinner />;

  // Redirect classic mode duels to classic-duel route (handled by useEffect)
  if (duel?.mode === "classic") {
    return <DuelStatusMessage message="Redirecting to classic duel..." />;
  }

  // Check duel status
  const status = duel?.status;
  if (status === "pending") {
    return <DuelStatusMessage message="Duel not yet accepted..." tone="warning" />;
  }
  if (status === "rejected") {
    return <DuelStatusMessage message="Duel was rejected" tone="danger" />;
  }
  if (status === "stopped") {
    return <DuelStatusMessage message="Duel was stopped" tone="danger" />;
  }
  if (status === "learning") {
    return <DuelStatusMessage message="Redirecting to learn phase..." />;
  }
  // Handle new solo-style "challenging" status
  if (status === "challenging" && duel) {
    return (
      <SoloStyleChallenge
        duel={duel}
        theme={theme}
        challenger={challenger ?? null}
        opponent={opponent ?? null}
        viewerRole={viewerRole ?? "challenger"}
      />
    );
  }
  // For completed status with solo-style data, use SoloStyleChallenge
  if (status === "completed" && duel?.challengerWordStates) {
    return (
      <SoloStyleChallenge
        duel={duel}
        theme={theme}
        challenger={challenger ?? null}
        opponent={opponent ?? null}
        viewerRole={viewerRole ?? "challenger"}
      />
    );
  }

  // At this point, duel is guaranteed to exist
  if (!duel) return <DuelStatusMessage message="Loading duel..." showSpinner />;

  if (!isChallenger && !isOpponent) {
    return <DuelStatusMessage message="You're not part of this duel" tone="danger" />;
  }

  // TTS button visibility - show during transition phase (including when paused)
  const inTransition = phase === "transition" && !!frozenData;
  const showListenButton =
    (hasAnswered || isLocked || inTransition) && (frozenData?.word ?? word) !== "done";

  return (
    <DuelGameUI
      duel={duel}
      challenger={challenger ?? null}
      opponent={opponent ?? null}
      words={words}
      word={word}
      currentWord={currentWord}
      index={index}
      shuffledAnswers={shuffledAnswers}
      hasNoneOption={hasNoneOption}
      difficulty={difficulty}
      difficultyDistribution={difficultyDistribution}
      selectedAnswer={selectedAnswer}
      setSelectedAnswer={setSelectedAnswer}
      isLocked={isLocked}
      phase={phase}
      frozenData={frozenData}
      countdown={countdown}
      isRevealing={isRevealing}
      typedText={typedText}
      revealComplete={revealComplete}
      questionTimer={questionTimer}
      countdownPausedBy={countdownPausedBy ?? undefined}
      countdownUnpauseRequestedBy={countdownUnpauseRequestedBy ?? undefined}
      isChallenger={isChallenger}
      viewerRole={viewerRole ?? "challenger"}
      hasAnswered={hasAnswered}
      opponentHasAnswered={!!opponentHasAnswered}
      canRequestHint={canRequestHint}
      iRequestedHint={iRequestedHint}
      theyRequestedHint={theyRequestedHint}
      hintAccepted={hintAccepted}
      canAcceptHint={canAcceptHint}
      isHintProvider={isHintProvider}
      canEliminate={canEliminate}
      eliminatedOptions={eliminatedOptions}
      showListenButton={showListenButton}
      isPlayingAudio={isPlayingAudio}
      onStopDuel={handleStopDuel}
      onConfirmAnswer={handleConfirmAnswer}
      onRequestHint={handleRequestHint}
      onAcceptHint={handleAcceptHint}
      onEliminateOption={handleEliminateOption}
      onPlayAudio={handlePlayAudio}
      onPauseCountdown={handlePauseCountdown}
      onRequestUnpause={handleRequestUnpause}
      onConfirmUnpause={handleConfirmUnpause}
      onBackToHome={handleBackToHome}
    />
  );
}
