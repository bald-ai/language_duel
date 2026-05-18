"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Doc } from "@/convex/_generated/dataModel";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { forRole } from "@/lib/duelRole";
import type { DuelViewProps } from "../components/DuelView";
import { buildDuelViewProps, deriveHintFlags } from "./buildDuelViewProps";
import { useDuelActions } from "./useDuelActions";
import { useDuelDuration } from "./useDuelDuration";
import { useDuelPhaseState } from "./useDuelPhaseState";
import { useDuelQuestionTimer } from "./useDuelQuestionTimer";
import { useOutgoingSabotageStatus } from "./useOutgoingSabotageStatus";
import { useSabotageEffect } from "./useSabotageEffect";

export type DuelPlayerSummary = Pick<
  Doc<"users">,
  "_id" | "name" | "nickname" | "discriminator" | "imageUrl"
>;

type ViewerSafeDuelQuestion = NonNullable<Doc<"duels">["duelQuestions"]>[number] & {
  correctOption?: string;
  answerRevealedToViewer?: boolean;
};

export interface DuelSessionViewModelArgs {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
}

export type DuelSessionViewModel =
  | { state: "signin" }
  | { state: "forbidden" }
  | { state: "ready"; viewProps: DuelViewProps };

export function useDuelSessionViewModel({
  duel,
  challenger,
  opponent,
  viewerRole,
}: DuelSessionViewModelArgs): DuelSessionViewModel {
  const router = useRouter();
  const { user } = useUser();

  const words = duel.sessionWords;
  const wordOrder = duel.wordOrder;
  const isCompleted = duel.status === "completed";
  const rawIndex = duel.currentWordIndex ?? 0;
  const index = isCompleted && words.length > 0 ? words.length - 1 : rawIndex;
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

  const phaseState = useDuelPhaseState({
    duel,
    index,
    theirLastAnswer: theirLastAnswer ?? null,
  });
  const {
    phase,
    frozenData,
    countdown,
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
  } = phaseState;

  const { activeSabotage, sabotagePhase } = useSabotageEffect({
    mySabotage,
    phase,
    isLocked,
  });
  const { duelDuration } = useDuelDuration(duel.status, phase);

  const actions = useDuelActions({
    duelId: duel._id,
    setIsLocked,
    lockedAnswerRef,
  });

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
    onTimeout: actions.submitTimeoutAnswer,
  });

  useEffect(() => {
    if (duel.status === "stopped") {
      router.push("/");
    }
  }, [duel.status, router]);

  const actualWordIndex = wordOrder ? wordOrder[index] : index;
  const currentQuestion = duel.duelQuestions![index] as ViewerSafeDuelQuestion;
  const currentWord = useMemo(
    () =>
      words[actualWordIndex] || { word: "done", answer: "done", wrongAnswers: [] },
    [words, actualWordIndex]
  );

  const sourceThemeName = useMemo(() => {
    const hasMultipleThemes =
      new Set(words.map((sessionWord) => String(sessionWord.themeId))).size > 1;
    if (!hasMultipleThemes) return null;
    const visibleWordIndex = frozenData
      ? wordOrder
        ? wordOrder[frozenData.wordIndex]
        : frozenData.wordIndex
      : actualWordIndex;
    const visibleWord = words[visibleWordIndex];
    const themeName = (visibleWord as { themeName?: string } | undefined)?.themeName;
    return typeof themeName === "string" ? themeName : null;
  }, [words, frozenData, wordOrder, actualWordIndex]);

  const isOutgoingSabotageActive = useOutgoingSabotageStatus({
    outgoingSabotage: theirSabotage,
    questionStartTime:
      typeof duel.questionStartTime === "number"
        ? duel.questionStartTime
        : undefined,
  });

  if (!user) {
    return { state: "signin" };
  }

  const isChallenger = viewerRole === "challenger";
  const isOpponent = viewerRole === "opponent";

  if (!isChallenger && !isOpponent) {
    return { state: "forbidden" };
  }

  const hasAnswered = getHasAnsweredForIndex(index, myAnswered);
  const eliminatedOptions = duel.eliminatedOptions || [];
  const answerRevealedToViewer = currentQuestion.answerRevealedToViewer === true;
  const currentCorrectAnswer = answerRevealedToViewer ? currentWord.answer : null;
  const hasNoneOption = answerRevealedToViewer
    ? currentQuestion.correctOption === NONE_OF_ABOVE
    : null;

  const hints = deriveHintFlags({
    hasAnswered,
    opponentHasAnswered: theirAnswered,
    hintRequestedBy: duel.hintRequestedBy,
    hintAccepted: duel.hintAccepted,
    eliminatedOptions,
    myRole: viewerRole,
    theirRole,
  });

  const handleConfirmAnswer = () => {
    if (!selectedAnswer) return;
    void actions.submitAnswer(selectedAnswer, index);
  };

  const handleOptionClick = (
    ans: string,
    canEliminateThis: boolean,
    isEliminated: boolean
  ) => {
    if (phase !== "answering") return;
    if (canEliminateThis) {
      void actions.eliminateOption(ans);
    } else if (!hasAnswered && !isLocked && !isEliminated) {
      setSelectedAnswer(ans, index);
    }
  };

  const handlePlayAudio = () => {
    const activeWord = frozenData
      ? words[wordOrder ? wordOrder[frozenData.wordIndex] : frozenData.wordIndex]
      : currentWord;
    actions.playWordAudio(activeWord);
  };

  return {
    state: "ready",
    viewProps: buildDuelViewProps({
      duel,
      viewerRole,
      isChallenger,
      challenger,
      opponent,
      index,
      word: currentWord.word,
      sourceThemeName,
      frozenData,
      difficulty: {
        level: currentQuestion.difficulty,
        points: currentQuestion.points,
      },
      duelDuration,
      questionTimer,
      countdownValue: countdown,
      phase,
      shuffledAnswers: currentQuestion.options,
      selectedAnswer,
      currentCorrectAnswer,
      hasNoneOption,
      eliminatedOptions,
      opponentLastAnswer: theirLastAnswer ?? null,
      isRevealing,
      typedText,
      revealComplete,
      hasAnswered,
      opponentHasAnswered: theirAnswered,
      isLocked,
      activeSabotage,
      sabotagePhase,
      isOutgoingSabotageActive,
      myScore,
      theirScore,
      mySabotagesUsed,
      hints,
      isPlayingAudio: actions.isPlayingAudio,
      callbacks: {
        onPauseCountdown: actions.pauseCountdown,
        onRequestUnpause: actions.requestUnpauseCountdown,
        onConfirmUnpause: actions.confirmUnpauseCountdown,
        onSkipCountdown: actions.skipCountdown,
        onPlayAudio: handlePlayAudio,
        onOptionClick: handleOptionClick,
        onConfirmAnswer: handleConfirmAnswer,
        onRequestHint: () => void actions.requestHint(),
        onAcceptHint: () => void actions.acceptHint(),
        onSendSabotage: (effect) => void actions.sendSabotage(effect),
        onExit: () => void actions.stopDuelAndGoHome(),
        onBackToHome: actions.goHome,
      },
    }),
  };
}
