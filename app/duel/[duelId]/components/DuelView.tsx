"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  TIMER_DANGER_THRESHOLD,
  TIMER_WARNING_THRESHOLD,
} from "@/lib/duelConstants";
import type { SabotageEffect } from "@/lib/sabotage/types";
import { SabotageRenderer } from "@/app/game/sabotage/SabotageRenderer";
import { CountdownControls } from "@/app/game/components/duel/CountdownControls";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";
import { type OptionContext } from "./AnswerOptionButton";
import { DuelAnswerGrid } from "./DuelAnswerGrid";
import { DuelFooter } from "./DuelFooter";
import { DuelRoundHeader } from "./DuelRoundHeader";
import { buildDuelViewStyles, getListenButtonStyle } from "./duelViewStyles";
import type { SabotagePhase } from "../hooks/useSabotageEffect";
import type { BossType } from "@/lib/limitedLives";
import type { DuelMode } from "@/lib/duelMode";
import type { HintReveal, HintType } from "@/lib/hintPool/types";

export interface DifficultyPillData {
  level: "easy" | "medium" | "hard";
  points: number;
}

export interface FrozenData {
  word: string;
  correctAnswer: string | null;
  shuffledAnswers: string[];
  selectedAnswer: string | null;
  opponentAnswer: string | null;
  wordIndex: number;
  hasNoneOption: boolean | null;
  difficulty: DifficultyPillData;
}

export interface DuelViewProps {
  status: string;
  duelMode: DuelMode;
  phase: "idle" | "answering" | "transition";
  /** True when there is no current word to play (waiting on the duel to complete). */
  isRoundOver: boolean;
  round: {
    wordsCount: number;
    index: number;
    word: string;
    sourceThemeName?: string | null;
    frozenData: FrozenData | null;
    difficulty: DifficultyPillData;
    duelDuration: number;
    hintReveal?: HintReveal;
  };
  timer: {
    questionTimer: number | null;
    questionTimerPausedAt?: number | null;
  };
  countdown: {
    value: number | null;
    pausedBy?: string;
    unpauseRequestedBy?: string;
    skipRequestedBy: string[];
    userRole: "challenger" | "opponent";
  };
  answers: {
    shuffledAnswers: string[];
    selectedAnswer: string | null;
    correctAnswer: string | null;
    hasNoneOption: boolean | null;
    eliminatedOptions: string[];
    opponentLastAnswer: string | null;
    isRevealing: boolean;
    typedText: string;
    revealComplete: boolean;
    hasAnswered: boolean;
    opponentHasAnswered: boolean;
    isLocked: boolean;
  };
  hints: {
    canRequestHint: boolean;
    iRequestedHint: boolean;
    theyRequestedHint: boolean;
    hintAccepted: boolean;
    canAcceptHint: boolean;
    isHintProvider: boolean;
    canEliminate: boolean;
    eliminatedOptionsCount: number;
    pool: {
      usedHints: HintType[];
      usedCount: number;
      totalCount: number;
      currentQuestionHintFired: boolean;
    };
  };
  sabotage: {
    activeSabotage: SabotageEffect | null;
    sabotagePhase: SabotagePhase;
    sabotagesRemaining: number;
    hasSentSabotageThisQuestion: boolean;
  };
  score: {
    myName: string;
    theirName: string;
    myScore: number;
    theirScore: number;
    bossType?: BossType;
    livesRemaining?: number;
    livesTotal?: number;
  };
  actions: {
    onPauseCountdown: () => void;
    onRequestUnpause: () => void;
    onConfirmUnpause: () => void;
    onSkipCountdown: () => void;
    onPlayAudio: () => void;
    onOptionClick: (answer: string, canEliminateThis: boolean, isEliminated: boolean) => void;
    onConfirmAnswer: () => void;
    onRequestHint: () => void;
    onAcceptHint: () => void;
    onFireHint: (hintType: HintType) => void;
    onSendSabotage: (effect: SabotageEffect) => void;
    onExit: () => void;
    onBackToHome: () => void;
  };
  audio: {
    isPlaying: boolean;
  };
}

export function DuelView({
  status,
  duelMode,
  phase,
  isRoundOver,
  round,
  timer,
  countdown,
  answers,
  hints,
  sabotage,
  score,
  actions,
  audio,
}: DuelViewProps) {
  const colors = useAppearanceColors();
  const styles = buildDuelViewStyles(colors);

  const canShowAnswerFeedback =
    answers.correctAnswer !== null && answers.hasNoneOption !== null;
  const isShowingFeedback =
    canShowAnswerFeedback &&
    (answers.hasAnswered || answers.isLocked || !!round.frozenData || status === "completed");
  const inTransition = phase === "transition" && !!round.frozenData;
  // There is an answer area to show whenever a question is on screen: the live
  // word (round not over) or the frozen snapshot during the transition.
  const showAnswerArea = !!round.frozenData || !isRoundOver;
  const showListenButton =
    canShowAnswerFeedback &&
    (answers.hasAnswered || answers.isLocked || inTransition) &&
    showAnswerArea;

  const timerIsDanger =
    timer.questionTimer !== null && timer.questionTimer <= TIMER_DANGER_THRESHOLD;
  const timerIsWarning =
    timer.questionTimer !== null && timer.questionTimer <= TIMER_WARNING_THRESHOLD;
  const timerColor = timerIsDanger
    ? colors.status.danger.light
    : timerIsWarning
      ? colors.status.warning.light
      : colors.text.DEFAULT;

  const optionContext: OptionContext = {
    answer: "",
    selectedAnswer: answers.selectedAnswer,
    correctAnswer: answers.correctAnswer,
    hasNoneOption: answers.hasNoneOption,
    isShowingFeedback,
    eliminatedOptions: answers.eliminatedOptions,
    canEliminate: hints.canEliminate,
    opponentAnswer: answers.opponentLastAnswer,
    showOpponentPick: !!round.frozenData || status === "completed",
  };

  return (
    <main
      className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8"
      style={{ color: colors.text.DEFAULT }}
    >
      <SabotageRenderer effect={sabotage.activeSabotage} phase={sabotage.sabotagePhase} />

      {/* Game Container - full screen on mobile, centered card on desktop */}
      <div
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] backdrop-blur-xl"
        style={styles.gameContainer}
      >
        {/* Header: Scoreboard + Exit */}
        <header
          className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 pt-[max(0.75rem,var(--sat))] md:pt-4 border-b"
          style={styles.subtleBorder}
        >
          <Scoreboard
            myName={score.myName}
            theirName={score.theirName}
            myScore={score.myScore}
            theirScore={score.theirScore}
            livesRemaining={score.livesRemaining}
          />

          {status !== "completed" && (
            <button
              onClick={actions.onExit}
              className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
              style={styles.exitButton}
              data-testid="duel-exit"
            >
              Exit Duel
            </button>
          )}
        </header>

        {/* Main game content - scrollable middle section */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
          <DuelRoundHeader
            wordsCount={round.wordsCount}
            index={round.index}
            word={round.word}
            sourceThemeName={round.sourceThemeName}
            difficulty={round.difficulty}
            hintReveal={round.hintReveal}
            phase={phase}
            colors={colors}
          />

          {/* Reversed indicator */}
          {phase === "answering" && sabotage.activeSabotage === "reverse" && (
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
            {timer.questionTimer !== null && phase === "answering" && (
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`text-4xl font-bold tabular-nums ${timerIsDanger ? "animate-pulse" : ""}`}
                  style={{ color: timerColor }}
                >
                  {Math.max(0, Math.ceil(timer.questionTimer - 1))}
                </span>
                <span className="text-xs" style={styles.mutedText}>
                  sec
                  {timer.questionTimerPausedAt && (
                    <span className="block" style={{ color: colors.secondary.light }}>
                      Paused
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Countdown controls during transition */}
            {countdown.value !== null && round.frozenData && (
              <CountdownControls
                countdown={countdown.value}
                countdownPausedBy={countdown.pausedBy}
                countdownUnpauseRequestedBy={countdown.unpauseRequestedBy}
                userRole={countdown.userRole}
                onPause={actions.onPauseCountdown}
                onRequestUnpause={actions.onRequestUnpause}
                onConfirmUnpause={actions.onConfirmUnpause}
                countdownSkipRequestedBy={countdown.skipRequestedBy}
                onSkip={actions.onSkipCountdown}
                dataTestIdBase="duel-countdown"
              />
            )}
          </div>

          {/* TTS Listen button */}
          {showListenButton && (
            <button
              onClick={actions.onPlayAudio}
              disabled={audio.isPlaying}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all border-2 shadow-lg active:scale-95 mb-5 text-sm ${audio.isPlaying ? "cursor-not-allowed" : "hover:brightness-110"
                }`}
              style={getListenButtonStyle(colors, audio.isPlaying)}
              data-testid="duel-listen"
            >
              <span className="text-lg">{audio.isPlaying ? "🔊" : "🔈"}</span>
              <span>{audio.isPlaying ? "Playing..." : "Listen"}</span>
            </button>
          )}

          {/* Answer Options */}
          {showAnswerArea && (
            <DuelAnswerGrid
              answers={answers.shuffledAnswers}
              optionContext={optionContext}
              activeSabotage={sabotage.activeSabotage}
              onOptionClick={actions.onOptionClick}
              showTypeReveal={answers.isRevealing && !!round.frozenData}
              typedText={answers.typedText}
              revealComplete={answers.revealComplete}
              hasNoneOption={answers.hasNoneOption === true}
              isShowingFeedback={isShowingFeedback}
            />
          )}
        </div>

        <DuelFooter
          status={status}
          duelMode={duelMode}
          phase={phase}
          isRoundOver={isRoundOver}
          answers={answers}
          hints={hints}
          sabotage={sabotage}
          score={score}
          actions={actions}
          duelDuration={round.duelDuration}
          colors={colors}
        />
      </div>
    </main>
  );
}
