"use client";

import { formatDuration } from "@/lib/stringUtils";
import { ExitButton } from "@/app/components/ExitButton";
import { WordCard } from "./WordCard";

interface Word {
  word: string;
  answer: string;
}

interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

interface LearnGridViewProps {
  themeName: string;
  challengerName: string | undefined;
  opponentName: string | undefined;
  words: Word[];
  duelId: string;
  timeRemaining: number | null;
  timerColor: string;
  isRevealed: boolean;
  playingWordIndex: number | null;
  getHintState: (wordKey: string) => HintState;
  onToggleRevealed: () => void;
  onResetAll: () => void;
  onRevealLetter: (wordKey: string, position: number) => void;
  onRevealFullWord: (wordKey: string, answer: string) => void;
  onResetWord: (wordKey: string) => void;
  onPlayTTS: (index: number, answer: string) => void;
  onSkip: () => void;
  onExit: () => Promise<void>;
}

/**
 * Learning grid view for the duel learn page.
 * Shows the word list with timer and controls.
 */
export function LearnGridView({
  themeName,
  challengerName,
  opponentName,
  words,
  duelId,
  timeRemaining,
  timerColor,
  isRevealed,
  playingWordIndex,
  getHintState,
  onToggleRevealed,
  onResetAll,
  onRevealLetter,
  onRevealFullWord,
  onResetWord,
  onPlayTTS,
  onSkip,
  onExit,
}: LearnGridViewProps) {
  return (
    <main className="min-h-screen bg-gray-900 flex flex-col">
      <ExitButton onExit={onExit} />

      {/* Header with Timer */}
      <header className="flex-shrink-0 pt-6 pb-4 px-4">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-xl font-bold text-gray-300 mb-2">{themeName}</h1>
          <p className="text-gray-500 text-sm mb-2">
            {challengerName} vs {opponentName}
          </p>

          {/* Large Timer */}
          <div className={`text-6xl font-bold ${timerColor} transition-colors`}>
            {timeRemaining !== null ? formatDuration(timeRemaining) : "--:--"}
          </div>

          {/* Mode Toggle and Reset */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={onToggleRevealed}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isRevealed
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {isRevealed ? "Revealed" : "Testing"}
            </button>
            {!isRevealed && (
              <button
                onClick={onResetAll}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Reset All
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Words List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="max-w-md mx-auto space-y-3">
          {words.map((word, index) => {
            const wordKey = `${duelId}-${index}`;
            const state = getHintState(wordKey);
            const totalLetters = word.answer.split("").filter((l) => l !== " ").length;
            const maxHints = Math.ceil(totalLetters / 3);
            const hintsRemaining = maxHints - state.hintCount;

            return (
              <WordCard
                key={index}
                word={word}
                isRevealed={isRevealed}
                revealedPositions={state.revealedPositions}
                hintsRemaining={hintsRemaining}
                onRevealLetter={(pos) => onRevealLetter(wordKey, pos)}
                onRevealFullWord={() => onRevealFullWord(wordKey, word.answer)}
                onResetWord={() => onResetWord(wordKey)}
                isTTSPlaying={playingWordIndex === index}
                isTTSDisabled={playingWordIndex !== null}
                onPlayTTS={() => onPlayTTS(index, word.answer)}
              />
            );
          })}
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={onSkip}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg transition-colors"
          >
            Skip to Challenge →
          </button>
        </div>
      </div>
    </main>
  );
}

