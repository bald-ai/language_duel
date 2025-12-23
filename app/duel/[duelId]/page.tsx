"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState, useMemo, useCallback } from "react";
import { calculateDifficultyDistribution, getDifficultyForIndex } from "@/lib/difficultyUtils";
import { shuffleAnswersForQuestion } from "@/lib/answerShuffle";
import SoloStyleChallenge from "./SoloStyleChallenge";
import { DuelGameUI } from "./components";
import { useDuelPhase, useQuestionTimer } from "./hooks";
import { useTTS } from "@/app/game/hooks";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

export default function DuelPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const duelId = params.duelId as string;
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // TTS audio playback
  const { isPlaying: isPlayingAudio, playTTS } = useTTS();

  const duelData = useQuery(api.duel.getDuel, { duelId: duelId as Id<"challenges"> });

  // Get theme for this duel
  const theme = useQuery(
    api.themes.getTheme,
    duelData?.duel?.themeId ? { themeId: duelData.duel.themeId } : "skip"
  );
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

  // Redirect effects for different modes/statuses
  useEffect(() => {
    if (duel?.mode === "classic") {
      router.push(`/classic-duel/${duelId}`);
    }
  }, [duel?.mode, duelId, router]);

  useEffect(() => {
    if (duel?.status === "learning") {
      router.push(`/duel/learn/${duelId}`);
    }
  }, [duel?.status, duelId, router]);

  const wordOrder = duel?.wordOrder;
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

  // Reset UI state when transitioning to new question
  // This effect synchronizes local UI state with server-driven phase transitions
  useEffect(() => {
    if (phase === "answering") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing with server state
      setSelectedAnswer(null);
      setIsLocked(false);
    }
  }, [phase]);

  // Monitor duel status for real-time updates
  useEffect(() => {
    if (duelData) {
      const status = duelData.duel.status;
      if (status === "stopped" || status === "rejected") {
        router.push("/");
      }
    }
  }, [duelData, router]);

  // Clear selected answer if it becomes eliminated
  // This effect synchronizes local selection with server-driven elimination
  const currentEliminatedOptions = duelData?.duel?.eliminatedOptions;
  useEffect(() => {
    if (selectedAnswer && currentEliminatedOptions?.includes(selectedAnswer)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing with server state
      setSelectedAnswer(null);
    }
  }, [currentEliminatedOptions, selectedAnswer]);

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
    viewerIsChallenger,
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
    const correctAnswer = frozenData ? frozenData.correctAnswer : currentWord.answer;
    if (!correctAnswer || correctAnswer === "done") return;
    playTTS(`answer-${correctAnswer}`, correctAnswer);
  }, [frozenData, currentWord.answer, playTTS]);

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

  const renderMessage = (
    message: string,
    tone: "default" | "warning" | "danger" = "default",
    showSpinner = false
  ) => {
    const toneStyles = {
      default: {
        borderColor: colors.primary.dark,
        boxShadow: `0 18px 45px ${colors.primary.glow}`,
        textColor: colors.text.DEFAULT,
      },
      warning: {
        borderColor: colors.status.warning.DEFAULT,
        boxShadow: `0 18px 45px ${colors.status.warning.DEFAULT}33`,
        textColor: colors.status.warning.light,
      },
      danger: {
        borderColor: colors.status.danger.DEFAULT,
        boxShadow: `0 18px 45px ${colors.status.danger.DEFAULT}33`,
        textColor: colors.status.danger.light,
      },
    };
    const style = toneStyles[tone];

    return (
      <ThemedPage>
        <div className="relative z-10 flex-1 flex items-center justify-center px-6">
          <div
            className="rounded-2xl border-2 p-6 text-center backdrop-blur-sm"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: style.borderColor,
              boxShadow: style.boxShadow,
            }}
          >
            {showSpinner && (
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3"
                style={{ borderColor: colors.cta.light }}
              />
            )}
            <p className="text-base font-semibold" style={{ color: style.textColor }}>
              {message}
            </p>
          </div>
        </div>
      </ThemedPage>
    );
  };

  // Early returns AFTER all hooks
  if (!user) return renderMessage("Sign in first.", "warning");
  if (duelData === undefined) return renderMessage("Loading duel...", "default", true);
  if (duelData === null) return renderMessage("You're not part of this duel", "danger");
  if (!theme) return renderMessage("Loading theme...", "default", true);

  // Redirect classic mode duels to classic-duel route (handled by useEffect)
  if (duel?.mode === "classic") {
    return renderMessage("Redirecting to classic duel...");
  }

  // Check duel status
  const status = duel?.status;
  if (status === "pending") {
    return renderMessage("Duel not yet accepted...", "warning");
  }
  if (status === "rejected") {
    return renderMessage("Duel was rejected", "danger");
  }
  if (status === "stopped") {
    return renderMessage("Duel was stopped", "danger");
  }
  if (status === "learning") {
    return renderMessage("Redirecting to learn phase...");
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
  if (!duel) return renderMessage("Loading duel...", "default", true);

  // Check if current user is challenger or opponent
  const isChallenger = viewerIsChallenger;
  const isOpponent = viewerRole === "opponent";

  if (!isChallenger && !isOpponent) {
    return renderMessage("You're not part of this duel", "danger");
  }

  const hasAnswered =
    (isChallenger && !!duel.challengerAnswered) || (isOpponent && !!duel.opponentAnswered);
  const opponentHasAnswered =
    (isChallenger && duel.opponentAnswered) || (isOpponent && duel.challengerAnswered);

  // Hint system state
  const myRole = isChallenger ? "challenger" : "opponent";
  const theirRole = isChallenger ? "opponent" : "challenger";
  const hintRequestedBy = duel.hintRequestedBy;
  const hintAccepted = duel.hintAccepted;
  const eliminatedOptions = duel.eliminatedOptions || [];

  // Hint UI states
  const canRequestHint = !hasAnswered && opponentHasAnswered && !hintRequestedBy;
  const iRequestedHint = hintRequestedBy === myRole;
  const theyRequestedHint = hintRequestedBy === theirRole;
  const canAcceptHint = hasAnswered && theyRequestedHint && !hintAccepted;
  const isHintProvider = hasAnswered && theyRequestedHint && !!hintAccepted;
  const canEliminate = isHintProvider && eliminatedOptions.length < 2;

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
