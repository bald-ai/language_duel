"use client";

import { ResetIcon, EyeIcon, SpeakerIcon } from "@/app/components/icons";

interface Word {
  word: string;
  answer: string;
}

interface WordCardProps {
  word: Word;
  isRevealed: boolean;
  revealedPositions: number[];
  hintsRemaining: number;
  onRevealLetter: (position: number) => void;
  onRevealFullWord: () => void;
  onResetWord: () => void;
  isTTSPlaying: boolean;
  isTTSDisabled: boolean;
  onPlayTTS: () => void;
}

/**
 * Individual word card component for the learn grid.
 * Shows the word and answer (revealed or as letter slots) with action buttons.
 */
export function WordCard({
  word,
  isRevealed,
  revealedPositions,
  hintsRemaining,
  onRevealLetter,
  onRevealFullWord,
  onResetWord,
  isTTSPlaying,
  isTTSDisabled,
  onPlayTTS,
}: WordCardProps) {
  const letters = word.answer.split("");

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between">
        {/* Word & Answer Section */}
        <div className="flex-1">
          <div className="text-lg font-medium text-white mb-1">
            {word.word}
          </div>

          {/* Answer - revealed or letter slots */}
          {isRevealed ? (
            <div className="text-lg font-bold text-green-400">
              {word.answer}
            </div>
          ) : (
            <div className="flex gap-1 flex-wrap">
              {letters.map((letter, idx) =>
                letter === " " ? (
                  <div key={idx} className="w-2" />
                ) : (
                  <div
                    key={idx}
                    onClick={() =>
                      !revealedPositions.includes(idx) &&
                      hintsRemaining > 0 &&
                      onRevealLetter(idx)
                    }
                    className={`w-5 h-6 flex items-end justify-center border-b-2 border-gray-500 ${
                      !revealedPositions.includes(idx) && hintsRemaining > 0
                        ? "cursor-pointer hover:border-green-500"
                        : ""
                    }`}
                  >
                    {revealedPositions.includes(idx) && (
                      <span className="text-base font-bold text-green-400">
                        {letter.toUpperCase()}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Buttons Section */}
        <div className="flex gap-2 items-center ml-4">
          {/* Testing mode buttons */}
          {!isRevealed && (
            <>
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                  hintsRemaining > 0
                    ? "border-gray-500 text-gray-400"
                    : "border-gray-700 text-gray-600"
                }`}
              >
                {hintsRemaining > 0 ? hintsRemaining : "–"}
              </div>

              <button
                onClick={onResetWord}
                className="w-10 h-10 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center justify-center transition-colors"
              >
                <ResetIcon />
              </button>

              <button
                onClick={onRevealFullWord}
                className="w-10 h-10 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center justify-center transition-colors"
              >
                <EyeIcon />
              </button>
            </>
          )}

          {/* TTS Button */}
          <button
            onClick={onPlayTTS}
            disabled={isTTSDisabled}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isTTSPlaying
                ? "bg-green-500 text-white"
                : isTTSDisabled
                ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <SpeakerIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

