"use client";

import { formatDuration } from "@/lib/stringUtils";
import { ExitButton } from "@/app/components/ExitButton";
import { WordCard } from "./WordCard";
import { LETTERS_PER_HINT } from "@/app/game/constants";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";

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
    <ThemedPage>
      <main className="relative z-10 flex-1 flex flex-col">
        <ExitButton onExit={onExit} />

        {/* Header with Timer */}
        <header className="flex-shrink-0 pt-6 pb-4 px-4">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-xl font-bold mb-2 title-font" style={{ color: colors.text.DEFAULT }}>
              {themeName}
            </h1>
            <p className="text-sm mb-2" style={{ color: colors.text.muted }}>
              {challengerName} vs {opponentName}
            </p>

            {/* Large Timer */}
            <div className="text-6xl font-bold transition-colors" style={{ color: timerColor }}>
              {timeRemaining !== null ? formatDuration(timeRemaining) : "--:--"}
            </div>

            {/* Mode Toggle and Reset */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                onClick={onToggleRevealed}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition border-2 ${
                  isRevealed ? "hover:brightness-110" : ""
                }`}
                style={
                  isRevealed
                    ? {
                        backgroundColor: colors.primary.DEFAULT,
                        borderColor: colors.primary.dark,
                        color: colors.text.DEFAULT,
                      }
                    : {
                        backgroundColor: colors.background.elevated,
                        borderColor: colors.primary.dark,
                        color: colors.text.muted,
                      }
                }
              >
                {isRevealed ? "Revealed" : "Testing"}
              </button>
              {!isRevealed && (
                <button
                  onClick={onResetAll}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition border-2 hover:brightness-110"
                  style={{
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.primary.dark,
                    color: colors.text.muted,
                  }}
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
              const maxHints = Math.ceil(totalLetters / LETTERS_PER_HINT);
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
        <div
          className="fixed bottom-0 left-0 right-0 border-t p-4"
          style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}
        >
          <div className="max-w-md mx-auto">
            <button
              onClick={onSkip}
              className="w-full font-bold py-4 rounded-xl text-lg transition border-2 hover:brightness-110"
              style={{
                backgroundColor: colors.cta.DEFAULT,
                borderColor: colors.cta.dark,
                color: colors.text.DEFAULT,
              }}
            >
              Skip to Challenge →
            </button>
          </div>
        </div>
      </main>
    </ThemedPage>
  );
}
