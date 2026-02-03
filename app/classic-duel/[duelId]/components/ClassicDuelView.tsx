"use client";

import type { CSSProperties } from "react";
import { stripIrr } from "@/lib/stringUtils";
import { colors } from "@/lib/theme";
import {
  TIMER_DANGER_THRESHOLD,
  TIMER_WARNING_THRESHOLD,
  TIMER_DISPLAY_MAX,
} from "@/lib/duelConstants";
import type { SabotageEffect } from "@/lib/sabotage/types";
import {
  BUTTON_WIDTH,
  BUTTON_HEIGHT,
  TRAMPOLINE_BUTTON_WIDTH,
  TRAMPOLINE_BUTTON_HEIGHT,
  TRAMPOLINE_FLY_SCALE,
  BOUNCE_FLY_SCALE,
} from "@/lib/sabotage/constants";
import { SabotageRenderer } from "@/app/game/sabotage/SabotageRenderer";
import { useReverseAnswers } from "@/app/game/sabotage/hooks/useReverseAnswers";
import { useBounceOptions } from "@/app/game/sabotage/hooks/useBounceOptions";
import { useTrampolineOptions } from "@/app/game/sabotage/hooks/useTrampolineOptions";
import { reverseText } from "@/app/game/sabotage/utils/textTransforms";
import { CountdownControls } from "@/app/game/components/duel/CountdownControls";
import { FinalResultsPanel } from "@/app/game/components/duel/FinalResultsPanel";
import { HintSystemUI } from "@/app/game/components/duel/HintSystemUI";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";
import { AnswerOptionButton, computeOptionState, type OptionContext } from "./AnswerOptionButton";
import { SabotageSystemUI } from "./SabotageSystemUI";
import type { SabotagePhase } from "../hooks/useSabotageEffect";

export interface DifficultyPillData {
  level: "easy" | "medium" | "hard";
  points: number;
}

export interface FrozenData {
  word: string;
  correctAnswer: string;
  shuffledAnswers: string[];
  selectedAnswer: string | null;
  opponentAnswer: string | null;
  wordIndex: number;
  hasNoneOption: boolean;
  difficulty: DifficultyPillData;
}

export interface ClassicDuelViewProps {
  activeSabotage: SabotageEffect | null;
  sabotagePhase: SabotagePhase;
  status: string;
  phase: "idle" | "answering" | "transition";
  wordsCount: number;
  index: number;
  word: string;
  frozenData: FrozenData | null;
  difficulty: DifficultyPillData;
  questionTimer: number | null;
  questionTimerPausedAt?: number | null;
  countdown: number | null;
  countdownPausedBy?: string;
  countdownUnpauseRequestedBy?: string;
  countdownSkipRequestedBy: string[];
  userRole: "challenger" | "opponent";
  onPauseCountdown: () => void;
  onRequestUnpause: () => void;
  onConfirmUnpause: () => void;
  onSkipCountdown: () => void;
  isPlayingAudio: boolean;
  onPlayAudio: () => void;
  shuffledAnswers: string[];
  selectedAnswer: string | null;
  correctAnswer: string;
  hasNoneOption: boolean;
  eliminatedOptions: string[];
  canEliminate: boolean;
  opponentLastAnswer: string | null;
  onOptionClick: (answer: string, canEliminateThis: boolean, isEliminated: boolean) => void;
  isRevealing: boolean;
  typedText: string;
  revealComplete: boolean;
  onConfirmAnswer: () => void;
  canRequestHint: boolean;
  iRequestedHint: boolean;
  theyRequestedHint: boolean;
  hintAccepted: boolean;
  canAcceptHint: boolean;
  isHintProvider: boolean;
  hasAnswered: boolean;
  eliminatedOptionsCount: number;
  onRequestHint: () => void;
  onAcceptHint: () => void;
  sabotagesRemaining: number;
  isOutgoingSabotageActive: boolean;
  opponentHasAnswered: boolean;
  isLocked: boolean;
  onSendSabotage: (effect: SabotageEffect) => void;
  myName: string;
  theirName: string;
  myScore: number;
  theirScore: number;
  onExit: () => void;
  duelDuration: number;
  onBackToHome: () => void;
}

export function ClassicDuelView({
  activeSabotage,
  sabotagePhase,
  status,
  phase,
  wordsCount,
  index,
  word,
  frozenData,
  difficulty,
  questionTimer,
  questionTimerPausedAt,
  countdown,
  countdownPausedBy,
  countdownUnpauseRequestedBy,
  countdownSkipRequestedBy,
  userRole,
  onPauseCountdown,
  onRequestUnpause,
  onConfirmUnpause,
  onSkipCountdown,
  isPlayingAudio,
  onPlayAudio,
  shuffledAnswers,
  selectedAnswer,
  correctAnswer,
  hasNoneOption,
  eliminatedOptions,
  canEliminate,
  opponentLastAnswer,
  onOptionClick,
  isRevealing,
  typedText,
  revealComplete,
  onConfirmAnswer,
  canRequestHint,
  iRequestedHint,
  theyRequestedHint,
  hintAccepted,
  canAcceptHint,
  isHintProvider,
  hasAnswered,
  eliminatedOptionsCount,
  onRequestHint,
  onAcceptHint,
  sabotagesRemaining,
  isOutgoingSabotageActive,
  opponentHasAnswered,
  isLocked,
  onSendSabotage,
  myName,
  theirName,
  myScore,
  theirScore,
  onExit,
  duelDuration,
  onBackToHome,
}: ClassicDuelViewProps) {
  const displayWord = frozenData ? frozenData.word : word;
  const displayIndex = frozenData ? frozenData.wordIndex : index;
  const displayAnswers = frozenData ? frozenData.shuffledAnswers : shuffledAnswers;
  const displaySelectedAnswer = frozenData ? frozenData.selectedAnswer : selectedAnswer;
  const displayCorrectAnswer = frozenData ? frozenData.correctAnswer : correctAnswer;
  const displayHasNone = frozenData ? frozenData.hasNoneOption : hasNoneOption;
  const isShowingFeedback = hasAnswered || isLocked || !!frozenData || status === "completed";

  const displayAnswersForReverse = displayAnswers;
  const { reverseAnimatedAnswers } = useReverseAnswers({
    activeSabotage,
    answers: displayAnswersForReverse,
  });

  const optionCount = displayAnswersForReverse.length;
  const { bouncingOptions } = useBounceOptions({
    activeSabotage,
    optionCount,
  });
  const { trampolineOptions } = useTrampolineOptions({
    activeSabotage,
    optionCount,
  });

  const optionContext: OptionContext = {
    answer: "",
    selectedAnswer: displaySelectedAnswer,
    correctAnswer: displayCorrectAnswer,
    hasNoneOption: displayHasNone,
    isShowingFeedback,
    eliminatedOptions,
    canEliminate,
    opponentLastAnswer,
    status,
    frozenData: frozenData ? { opponentAnswer: frozenData.opponentAnswer } : null,
  };

  const timerIsDanger = questionTimer !== null && questionTimer <= TIMER_DANGER_THRESHOLD;
  const timerIsWarning = questionTimer !== null && questionTimer <= TIMER_WARNING_THRESHOLD;
  const timerColor = timerIsDanger
    ? colors.status.danger.light
    : timerIsWarning
      ? colors.status.warning.light
      : colors.text.DEFAULT;

  const inTransition = phase === "transition" && !!frozenData;
  const showListenButton = (hasAnswered || isLocked || inTransition) && displayWord !== "done";
  const confirmDisabled = !selectedAnswer || isLocked;

  const gameContainerStyle = {
    "--classic-bg": `${colors.background.DEFAULT}E6`,
    "--classic-bg-elevated": `${colors.background.elevated}80`,
    borderColor: colors.primary.dark,
  } as CSSProperties;

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
              onClick={onExit}
              className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
              style={exitButtonStyle}
              data-testid="classic-duel-exit"
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
              Word #{displayIndex + 1} of {wordsCount}
            </div>
            <div>{difficultyPill}</div>
          </div>

          {/* The word to translate */}
          <div className="text-2xl md:text-3xl font-bold mb-4 text-center">
            {displayWord}
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
            {questionTimer !== null && phase === "answering" && (
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`text-4xl font-bold tabular-nums ${timerIsDanger ? "animate-pulse" : ""}`}
                  style={{ color: timerColor }}
                >
                  {Math.max(0, Math.min(TIMER_DISPLAY_MAX, Math.ceil(questionTimer - 1)))}
                </span>
                <span className="text-xs" style={mutedTextStyle}>
                  sec
                  {questionTimerPausedAt && (
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
                onPause={onPauseCountdown}
                onRequestUnpause={onRequestUnpause}
                onConfirmUnpause={onConfirmUnpause}
                countdownSkipRequestedBy={countdownSkipRequestedBy}
                onSkip={onSkipCountdown}
                dataTestIdBase="classic-duel-countdown"
              />
            )}
          </div>

          {/* TTS Listen button */}
          {showListenButton && (
            <button
              onClick={onPlayAudio}
              disabled={isPlayingAudio}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all border-2 shadow-lg active:scale-95 mb-5 text-sm ${isPlayingAudio ? "cursor-not-allowed" : "hover:brightness-110"
                }`}
              style={listenButtonStyle}
              data-testid="classic-duel-listen"
            >
              <span className="text-lg">{isPlayingAudio ? "🔊" : "🔈"}</span>
              <span>{isPlayingAudio ? "Playing..." : "Listen"}</span>
            </button>
          )}

          {/* Answer Options - always render container for stable layout */}
          {displayWord !== "done" && (
            <>
              {/* Normal grid layout - use visibility instead of unmounting to prevent layout shift */}
              <div
                className={`grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md ${(activeSabotage === "bounce" || activeSabotage === "trampoline") ? "invisible" : ""
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
                      onClick={() => onOptionClick(ans, state.canEliminateThis, state.isEliminated)}
                      showTypeReveal={isRevealing && !!frozenData}
                      typedText={typedText}
                      revealComplete={revealComplete}
                      hasNoneOption={displayHasNone}
                      isShowingFeedback={isShowingFeedback}
                      dataTestId={`classic-duel-answer-${i}`}
                    />
                  );
                })}
              </div>

              {/* Bouncing options when bounce sabotage is active */}
              {activeSabotage === "bounce" && bouncingOptions.length > 0 && (
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
                        onClick={() => onOptionClick(ans, state.canEliminateThis, state.isEliminated)}
                        hasNoneOption={displayHasNone}
                        isShowingFeedback={isShowingFeedback}
                        isFlying
                        dataTestId={`classic-duel-answer-${i}-fly`}
                        style={{
                          position: "absolute",
                          left: bouncePos.x,
                          top: bouncePos.y,
                          width: BUTTON_WIDTH,
                          height: BUTTON_HEIGHT,
                          pointerEvents: "auto",
                          transform: `scale(${BOUNCE_FLY_SCALE})`,
                          transformOrigin: "top left",
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Trampoline options when trampoline sabotage is active */}
              {activeSabotage === "trampoline" && trampolineOptions.length > 0 && (
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
                        onClick={() => onOptionClick(ans, state.canEliminateThis, state.isEliminated)}
                        hasNoneOption={displayHasNone}
                        isShowingFeedback={isShowingFeedback}
                        isFlying
                        dataTestId={`classic-duel-answer-${i}-fly`}
                        style={{
                          position: "absolute",
                          left: trampPos.x + trampPos.shakeOffset.x,
                          top: trampPos.y + trampPos.shakeOffset.y,
                          width: TRAMPOLINE_BUTTON_WIDTH,
                          height: TRAMPOLINE_BUTTON_HEIGHT,
                          pointerEvents: "auto",
                          transform: trampPos.phase === "flying" ? `scale(${TRAMPOLINE_FLY_SCALE})` : "scale(1)",
                          transformOrigin: "top left",
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
          {!hasAnswered && phase === "answering" && word !== "done" && (
            <button
              className="w-full rounded-xl px-6 sm:px-10 py-2.5 sm:py-3 font-bold text-base sm:text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 hover:brightness-110"
              style={confirmButtonStyle}
              disabled={confirmDisabled}
              onClick={onConfirmAnswer}
              data-testid="classic-duel-confirm"
            >
              Confirm Answer
            </button>
          )}

          {/* Hint System UI */}
          {phase === "answering" && word !== "done" && (
            <HintSystemUI
              canRequestHint={canRequestHint}
              iRequestedHint={iRequestedHint}
              theyRequestedHint={theyRequestedHint}
              hintAccepted={hintAccepted}
              canAcceptHint={canAcceptHint}
              isHintProvider={isHintProvider}
              hasAnswered={hasAnswered}
              eliminatedOptionsCount={eliminatedOptionsCount}
              onRequestHint={onRequestHint}
              onAcceptHint={onAcceptHint}
              requestHintText="Begging for help!"
              acceptHintText="Bafoon is begging"
              dataTestIdBase="classic-duel-hint"
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
            onSendSabotage={onSendSabotage}
            dataTestIdBase="classic-duel-sabotage"
          />

          {/* Waiting message */}
          {hasAnswered && phase === "answering" && word !== "done" && !theyRequestedHint && (
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
              onBackToHome={onBackToHome}
              duelDuration={duelDuration}
              dataTestIdBack="classic-duel-back-home"
            />
          )}
        </footer>
      </div>
    </main>
  );
}
