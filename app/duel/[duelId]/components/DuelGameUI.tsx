"use client";

import { AnswerButton } from "./AnswerButton";
import { DifficultyPill } from "./DifficultyPill";
import { SuccessRateDisplay } from "./SuccessRateDisplay";
import {
  Scoreboard,
  CountdownControls,
  HintSystemUI,
  FinalResultsPanel,
} from "@/app/game/components/duel";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";
import {
  TIMER_DISPLAY_MAX,
  TIMER_WARNING_THRESHOLD,
  TIMER_DANGER_THRESHOLD,
} from "@/lib/duelConstants";
import type { DuelPhase, FrozenQuestionData } from "../hooks";
import type { DifficultyInfo, DifficultyDistribution } from "@/lib/difficultyUtils";
import type { Doc } from "@/convex/_generated/dataModel";

interface DuelGameUIProps {
  // Duel data
  duel: Doc<"challenges">;
  challenger: Pick<Doc<"users">, "_id" | "name" | "imageUrl"> | null;
  opponent: Pick<Doc<"users">, "_id" | "name" | "imageUrl"> | null;
  words: Array<{ word: string; answer: string; wrongAnswers: string[] }>;
  
  // Current question state
  word: string;
  currentWord: { word: string; answer: string; wrongAnswers: string[] };
  index: number;
  shuffledAnswers: string[];
  hasNoneOption: boolean;
  difficulty: DifficultyInfo;
  difficultyDistribution: DifficultyDistribution;
  
  // UI state
  selectedAnswer: string | null;
  setSelectedAnswer: (answer: string | null) => void;
  isLocked: boolean;
  
  // Phase state
  phase: DuelPhase;
  frozenData: FrozenQuestionData | null;
  countdown: number | null;
  isRevealing: boolean;
  typedText: string;
  revealComplete: boolean;
  questionTimer: number | null;
  
  // Pause state
  countdownPausedBy: string | undefined;
  countdownUnpauseRequestedBy: string | undefined;
  
  // Role info
  isChallenger: boolean;
  viewerRole: "challenger" | "opponent";
  
  // Answer state
  hasAnswered: boolean;
  opponentHasAnswered: boolean;
  
  // Hint system
  canRequestHint: boolean;
  iRequestedHint: boolean;
  theyRequestedHint: boolean;
  hintAccepted: boolean | undefined;
  canAcceptHint: boolean;
  isHintProvider: boolean;
  canEliminate: boolean;
  eliminatedOptions: string[];
  
  // TTS
  showListenButton: boolean;
  isPlayingAudio: boolean;
  
  // Handlers
  onStopDuel: () => Promise<void>;
  onConfirmAnswer: () => Promise<void>;
  onRequestHint: () => Promise<void>;
  onAcceptHint: () => Promise<void>;
  onEliminateOption: (option: string) => Promise<void>;
  onPlayAudio: () => void;
  onPauseCountdown: () => void;
  onRequestUnpause: () => void;
  onConfirmUnpause: () => void;
  onBackToHome: () => void;
}

export function DuelGameUI({
  duel,
  challenger,
  opponent,
  words,
  word,
  currentWord,
  index,
  shuffledAnswers,
  hasNoneOption,
  difficulty,
  difficultyDistribution,
  selectedAnswer,
  setSelectedAnswer,
  isLocked,
  phase,
  frozenData,
  countdown,
  isRevealing,
  typedText,
  revealComplete,
  questionTimer,
  countdownPausedBy,
  countdownUnpauseRequestedBy,
  isChallenger,
  hasAnswered,
  canRequestHint,
  iRequestedHint,
  theyRequestedHint,
  hintAccepted,
  canAcceptHint,
  isHintProvider,
  canEliminate,
  eliminatedOptions,
  showListenButton,
  isPlayingAudio,
  onStopDuel,
  onConfirmAnswer,
  onRequestHint,
  onAcceptHint,
  onEliminateOption,
  onPlayAudio,
  onPauseCountdown,
  onRequestUnpause,
  onConfirmUnpause,
  onBackToHome,
}: DuelGameUIProps) {
  const status = duel.status;
  
  // Scores
  const challengerScore = duel.challengerScore || 0;
  const opponentScore = duel.opponentScore || 0;
  const myScore = isChallenger ? challengerScore : opponentScore;
  const theirScore = isChallenger ? opponentScore : challengerScore;
  const myName = (isChallenger ? challenger?.name : opponent?.name) || "You";
  const theirName = (isChallenger ? opponent?.name : challenger?.name) || "Opponent";

  const timerColor =
    questionTimer !== null && questionTimer <= TIMER_DANGER_THRESHOLD
      ? colors.status.danger.light
      : questionTimer !== null && questionTimer <= TIMER_WARNING_THRESHOLD
        ? colors.status.warning.light
        : colors.text.DEFAULT;

  const secondaryButtonStyle = {
    backgroundColor: colors.secondary.DEFAULT,
    borderColor: colors.secondary.dark,
    color: colors.text.DEFAULT,
  };
  const ctaButtonStyle = {
    backgroundColor: colors.cta.DEFAULT,
    borderColor: colors.cta.dark,
    color: colors.text.DEFAULT,
  };
  const mutedButtonStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.neutral.dark,
    color: colors.text.muted,
  };

  const exitButtonStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.status.danger.DEFAULT,
    color: colors.status.danger.light,
  };

  return (
    <ThemedPage>
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 p-4">
        {/* Exit Button - hide when completed */}
        {status !== "completed" && (
          <button
            onClick={onStopDuel}
            className="absolute top-4 right-4 font-bold py-2 px-4 rounded border-2 text-xs uppercase tracking-widest transition hover:brightness-110"
            style={exitButtonStyle}
          >
            Exit Duel
          </button>
        )}
        
        <Scoreboard
          myName={myName}
          theirName={theirName}
          myScore={myScore}
          theirScore={theirScore}
        />

        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 title-font" style={{ color: colors.text.DEFAULT }}>
            Language Duel
          </h1>
          <div className="mb-4">
            <div className="text-sm" style={{ color: colors.text.muted }}>
              {challenger?.name || "Challenger"} vs {opponent?.name || "Opponent"}
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-lg mb-2" style={{ color: colors.text.DEFAULT }}>
            Word #{(frozenData ? frozenData.wordIndex : index) + 1} of {words.length}
          </div>
          
          {/* Success rate stats for both players */}
          <SuccessRateDisplay
            questionsAnswered={frozenData ? frozenData.wordIndex : index}
            myScore={myScore}
            theirScore={theirScore}
            myName={myName}
            theirName={theirName}
            difficultyDistribution={difficultyDistribution}
          />
          
          {/* Difficulty indicator */}
          <div className="mb-2">
            <DifficultyPill
              level={(frozenData ? frozenData.difficulty : difficulty).level}
              points={(frozenData ? frozenData.difficulty : difficulty).points}
            />
          </div>
          
          {/* Question Timer - hide the extra 1 second buffer */}
          {questionTimer !== null && phase === "answering" && (
            <div className="mb-3">
              <div
                className={`text-4xl font-bold tabular-nums ${questionTimer <= TIMER_DANGER_THRESHOLD ? "animate-pulse" : ""}`}
                style={{ color: timerColor }}
              >
                {Math.max(0, Math.min(TIMER_DISPLAY_MAX, Math.ceil(questionTimer - 1)))}
              </div>
              <div className="text-xs mt-1" style={{ color: colors.text.muted }}>
                seconds remaining
              </div>
            </div>
          )}
          <div className="text-3xl font-bold mb-6" style={{ color: colors.text.DEFAULT }}>
            {frozenData ? frozenData.word : word}
          </div>
        </div>

        {/* Countdown indicator with pause/unpause controls */}
        {countdown !== null && frozenData && (
          <CountdownControls
            countdown={countdown}
            countdownPausedBy={countdownPausedBy}
            countdownUnpauseRequestedBy={countdownUnpauseRequestedBy}
            userRole={isChallenger ? "challenger" : "opponent"}
            onPause={onPauseCountdown}
            onRequestUnpause={onRequestUnpause}
            onConfirmUnpause={onConfirmUnpause}
          />
        )}

        {/* TTS Listen button - show when player has locked in their answer or during transition */}
        {showListenButton && (
          <button
            onClick={onPlayAudio}
            disabled={isPlayingAudio}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all mb-2 border-2 ${
              isPlayingAudio ? "cursor-not-allowed" : "hover:brightness-110"
            }`}
            style={isPlayingAudio ? {
              backgroundColor: colors.status.success.DEFAULT,
              borderColor: colors.status.success.dark,
              color: colors.text.DEFAULT,
            } : secondaryButtonStyle}
          >
            <span className="text-xl">{isPlayingAudio ? "🔊" : "🔈"}</span>
            <span>{isPlayingAudio ? "Playing..." : "Listen"}</span>
          </button>
        )}

        {/* Answer Options */}
        {(frozenData ? frozenData.word : word) !== "done" && (
          <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-4">
            {(frozenData ? frozenData.shuffledAnswers : shuffledAnswers).map((ans, i) => {
              const displaySelectedAnswer = frozenData ? frozenData.selectedAnswer : selectedAnswer;
              const displayCorrectAnswer = frozenData ? frozenData.correctAnswer : currentWord.answer;
              const displayHasNone = frozenData ? frozenData.hasNoneOption : hasNoneOption;
              const isShowingFeedback = !!(hasAnswered || isLocked || frozenData || status === "completed");
              const isEliminated = eliminatedOptions.includes(ans);
              const isWrongAnswer = ans === "None of the above" ? !displayHasNone : ans !== displayCorrectAnswer;
              const canEliminateThis = canEliminate && isWrongAnswer && !isEliminated;

              const handleClick = () => {
                if (phase !== "answering") return;
                if (canEliminateThis) {
                  onEliminateOption(ans);
                } else if (!hasAnswered && !isLocked && !isEliminated) {
                  setSelectedAnswer(ans);
                }
              };

              const opponentLastAnswer = isChallenger ? duel?.opponentLastAnswer : duel?.challengerLastAnswer;
              const opponentPickedThis = frozenData
                ? frozenData.opponentAnswer === ans
                : status === "completed" && opponentLastAnswer === ans;

              return (
                <AnswerButton
                  key={i}
                  answer={ans}
                  selectedAnswer={displaySelectedAnswer}
                  correctAnswer={displayCorrectAnswer}
                  hasNoneOption={displayHasNone}
                  isShowingFeedback={isShowingFeedback}
                  isEliminated={isEliminated}
                  canEliminate={!!canEliminate}
                  opponentPickedThis={opponentPickedThis}
                  isRevealing={isRevealing && !!frozenData}
                  typedText={typedText}
                  revealComplete={revealComplete}
                  disabled={(isShowingFeedback && !canEliminateThis) || isEliminated}
                  onClick={handleClick}
                />
              );
            })}
          </div>
        )}

        {/* Confirm Button */}
        {!hasAnswered && phase === "answering" && word !== "done" && (
          <button
            className={`rounded-lg px-8 py-3 font-bold text-lg transition border-2 ${
              !selectedAnswer || isLocked ? "cursor-not-allowed opacity-60" : "hover:brightness-110"
            }`}
            style={!selectedAnswer || isLocked ? mutedButtonStyle : ctaButtonStyle}
            disabled={!selectedAnswer || isLocked}
            onClick={onConfirmAnswer}
          >
            {isLocked ? "Submitting..." : "Confirm Answer"}
          </button>
        )}

        {/* Hint System UI */}
        {phase === "answering" && word !== "done" && (
          <HintSystemUI
            canRequestHint={canRequestHint}
            iRequestedHint={iRequestedHint}
            theyRequestedHint={theyRequestedHint}
            hintAccepted={!!hintAccepted}
            canAcceptHint={canAcceptHint}
            isHintProvider={isHintProvider}
            hasAnswered={hasAnswered}
            eliminatedOptionsCount={eliminatedOptions.length}
            onRequestHint={onRequestHint}
            onAcceptHint={onAcceptHint}
          />
        )}

        {/* Waiting message */}
        {hasAnswered && phase === "answering" && word !== "done" && !theyRequestedHint && (
          <div className="font-medium animate-pulse" style={{ color: colors.status.warning.light }}>
            Waiting for opponent to answer...
          </div>
        )}

        {/* Final Results Panel - shown when duel is completed */}
        {status === "completed" && (
          <FinalResultsPanel
            myName={myName}
            theirName={theirName}
            myScore={myScore}
            theirScore={theirScore}
            onBackToHome={onBackToHome}
          />
        )}
      </main>
    </ThemedPage>
  );
}
