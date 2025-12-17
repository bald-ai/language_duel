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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 relative p-4">
      {/* Exit Button - hide when completed */}
      {status !== "completed" && (
        <button
          onClick={onStopDuel}
          className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
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
        <h1 className="text-2xl font-bold mb-2">Language Duel</h1>
        <div className="mb-4">
          <div className="text-sm text-gray-400">
            {challenger?.name || "Challenger"} vs {opponent?.name || "Opponent"}
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="text-lg mb-2">
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
              className={`text-4xl font-bold tabular-nums ${
                questionTimer <= TIMER_DANGER_THRESHOLD
                  ? "text-red-500 animate-pulse"
                  : questionTimer <= TIMER_WARNING_THRESHOLD
                    ? "text-yellow-400"
                    : "text-white"
              }`}
            >
              {Math.max(0, Math.min(TIMER_DISPLAY_MAX, Math.ceil(questionTimer - 1)))}
            </div>
            <div className="text-xs text-gray-400 mt-1">seconds remaining</div>
          </div>
        )}
        <div className="text-3xl font-bold mb-6">{frozenData ? frozenData.word : word}</div>
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
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all mb-2 ${
            isPlayingAudio
              ? "bg-green-600 text-white cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
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
          className="rounded-lg px-8 py-3 font-bold text-lg disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
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
        <div className="text-yellow-400 font-medium animate-pulse">
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
  );
}

