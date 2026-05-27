"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Doc } from "@/convex/_generated/dataModel";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { forRole } from "@/lib/duelRole";
import { isSelfDuel } from "@/lib/duel/selfDuel";
import { MAX_SABOTAGES } from "@/lib/sabotage/constants";
import type { DuelViewProps } from "../components/DuelView";
import { deriveHintFlags, deriveScoreNames } from "./duelViewModelHelpers";
import {
  requireWordQuestion,
  requireWordSessionItem,
  type ViewerSafeDuelQuestion,
} from "./duelSessionTypes";
import { useDuelActions } from "./useDuelActions";
import { useDuelPhaseState } from "./useDuelPhaseState";
import { useDuelQuestionTimer } from "./useDuelQuestionTimer";
import { useHintPool } from "./useHintPool";
import { useOutgoingSabotageStatus } from "./useOutgoingSabotageStatus";
import { useSabotageEffect } from "./useSabotageEffect";

export type DuelPlayerSummary = Pick<
  Doc<"users">,
  "_id" | "name" | "nickname" | "discriminator" | "imageUrl"
>;

export interface DuelSessionViewModelArgs {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
}

/**
 * Assembles the full `DuelViewProps` for a duel. The caller (the page) owns the
 * sign-in / membership gating, so this hook always has a valid signed-in viewer
 * who is a participant. It resolves the "displayed question" (the live word, or
 * the frozen snapshot during the transition) exactly once and hands DuelView a
 * ready-to-render set of nested prop groups — no second prop shape, no cast.
 */
export function useDuelSessionViewModel({
  duel,
  challenger,
  opponent,
  viewerRole,
}: DuelSessionViewModelArgs): DuelViewProps {
  const router = useRouter();

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
  } = phaseState;

  const { activeSabotage, sabotagePhase } = useSabotageEffect({
    mySabotage,
    phase,
    isLocked,
  });

  const actions = useDuelActions({
    duelId: duel._id,
    setIsLocked,
    lockedAnswerRef,
  });
  const hintPool = useHintPool({
    duelId: duel._id,
    usedHints: duel.hintPoolUsed,
    currentQuestionHintFired: duel.currentQuestionHintFired,
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

  const actualWordIndex = wordOrder[index];
  // The standard view-model is word-only; the page already routes sentence
  // positions to a dedicated SentenceRoundView, so this narrow is the place we
  // assert "we should only be here for word positions".
  const currentQuestion = requireWordQuestion(
    duel.duelQuestions![index] as ViewerSafeDuelQuestion
  );
  const rawCurrentSessionItem = words[actualWordIndex];
  const currentSessionWord = rawCurrentSessionItem
    ? requireWordSessionItem(rawCurrentSessionItem)
    : null;
  // No current word means the server has advanced past the last question and we
  // are waiting for the duel to flip to "completed".
  const isRoundOver = !currentSessionWord;

  const isChallenger = viewerRole === "challenger";
  const isPve = duel.duelMode === "pve";

  const hasAnswered = getHasAnsweredForIndex(index, myAnswered);
  const eliminatedOptions = duel.eliminatedOptions || [];
  const answerRevealedToViewer = currentQuestion.answerRevealedToViewer === true;
  const liveCorrectAnswer = answerRevealedToViewer
    ? currentSessionWord?.answer ?? null
    : null;
  const liveHasNoneOption = answerRevealedToViewer
    ? currentQuestion.correctOption === NONE_OF_ABOVE
    : null;

  // The question currently on screen: the frozen snapshot during the transition,
  // otherwise the live question. Resolved once, here, instead of branching at
  // every use site in the view.
  const displayedWord = frozenData ? frozenData.word : currentSessionWord?.word ?? "";
  const displayedIndex = frozenData ? frozenData.wordIndex : index;
  const displayedAnswers = frozenData ? frozenData.shuffledAnswers : currentQuestion.options;
  const displayedSelected = frozenData ? frozenData.selectedAnswer : selectedAnswer;
  const displayedCorrect = frozenData ? frozenData.correctAnswer : liveCorrectAnswer;
  const displayedHasNone = frozenData ? frozenData.hasNoneOption : liveHasNoneOption;
  const displayedDifficulty = frozenData
    ? frozenData.difficulty
    : { level: currentQuestion.difficulty, points: currentQuestion.points };
  const displayedOpponentAnswer = frozenData
    ? frozenData.opponentAnswer
    : theirLastAnswer ?? null;

  const sourceThemeName = useMemo(() => {
    const hasMultipleThemes =
      new Set(words.map((sessionWord) => String(sessionWord.themeId))).size > 1;
    if (!hasMultipleThemes) return null;
    const visibleWordIndex = wordOrder[displayedIndex];
    const visibleWord = words[visibleWordIndex];
    const themeName = (visibleWord as { themeName?: string } | undefined)?.themeName;
    return typeof themeName === "string" ? themeName : null;
  }, [words, wordOrder, displayedIndex]);

  const isOutgoingSabotageActive = useOutgoingSabotageStatus({
    outgoingSabotage: theirSabotage,
    questionStartTime:
      typeof duel.questionStartTime === "number"
        ? duel.questionStartTime
        : undefined,
  });

  const hints = deriveHintFlags({
    isPve,
    hasAnswered,
    opponentHasAnswered: theirAnswered,
    hintRequestedBy: duel.hintRequestedBy,
    hintAccepted: duel.hintAccepted,
    eliminatedOptions,
    myRole: viewerRole,
    theirRole,
  });
  const { myName, theirName } = deriveScoreNames(isChallenger, challenger, opponent);

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
    const activeWord = words[wordOrder[displayedIndex]];
    actions.playWordAudio(activeWord);
  };

  return {
    status: duel.status,
    duelMode: duel.duelMode,
    phase,
    isRoundOver,
    round: {
      wordsCount: words.length,
      index: displayedIndex,
      word: displayedWord,
      sourceThemeName,
      frozenData,
      difficulty: displayedDifficulty,
      duelDuration,
      hintReveal: duel.currentQuestionHintReveal,
    },
    timer: {
      questionTimer,
      questionTimerPausedAt: duel.questionTimerPausedAt,
    },
    countdown: {
      value: countdown,
      pausedBy: duel.countdownPausedBy,
      unpauseRequestedBy: duel.countdownUnpauseRequestedBy,
      skipRequestedBy: duel.countdownSkipRequestedBy || [],
      userRole: viewerRole,
    },
    answers: {
      shuffledAnswers: displayedAnswers,
      selectedAnswer: displayedSelected,
      correctAnswer: displayedCorrect,
      hasNoneOption: displayedHasNone,
      eliminatedOptions,
      opponentLastAnswer: displayedOpponentAnswer,
      isRevealing,
      typedText,
      revealComplete,
      hasAnswered,
      opponentHasAnswered: theirAnswered,
      isLocked,
    },
    hints: {
      ...hints,
      eliminatedOptionsCount: eliminatedOptions.length,
      pool: {
        usedHints: hintPool.usedHints,
        usedCount: hintPool.usedCount,
        totalCount: hintPool.totalCount,
        currentQuestionHintFired: hintPool.currentQuestionHintFired,
      },
    },
    sabotage: {
      activeSabotage,
      sabotagePhase,
      sabotagesRemaining: MAX_SABOTAGES - mySabotagesUsed,
      isOutgoingSabotageActive,
    },
    score: {
      myName,
      theirName,
      myScore,
      theirScore,
      bossType: duel.bossType,
      livesRemaining: duel.livesRemaining,
      livesTotal: duel.livesTotal,
    },
    actions: {
      onPauseCountdown: actions.pauseCountdown,
      onRequestUnpause: isSelfDuel(duel)
        ? actions.confirmUnpauseCountdown
        : actions.requestUnpauseCountdown,
      onConfirmUnpause: actions.confirmUnpauseCountdown,
      onSkipCountdown: actions.skipCountdown,
      onPlayAudio: handlePlayAudio,
      onOptionClick: handleOptionClick,
      onConfirmAnswer: handleConfirmAnswer,
      onRequestHint: () => void actions.requestHint(),
      onAcceptHint: () => void actions.acceptHint(),
      onFireHint: (hintType) => void hintPool.fireHint(hintType),
      onSendSabotage: (effect) => void actions.sendSabotage(effect),
      onExit: () => void actions.stopDuelAndGoHome(),
      onBackToHome: actions.goHome,
    },
    audio: { isPlaying: actions.isPlayingAudio },
  };
}
