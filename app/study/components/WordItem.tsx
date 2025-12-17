"use client";

import type { WordEntry } from "@/lib/types";
import { HintState, HINT_RATIO } from "../hooks";

interface WordItemProps {
  word: WordEntry;
  isRevealed: boolean;
  hintState: HintState;
  isPlaying: boolean;
  onRevealLetter: (position: number) => void;
  onRevealFullWord: () => void;
  onReset: () => void;
  onPlayTTS: () => void;
}

export function WordItem({
  word,
  isRevealed,
  hintState,
  isPlaying,
  onRevealLetter,
  onRevealFullWord,
  onReset,
  onPlayTTS,
}: WordItemProps) {
  const { hintCount, revealedPositions } = hintState;
  const letters = word.answer.split("");
  const totalLetters = letters.filter((l) => l !== " ").length;
  const maxHints = Math.ceil(totalLetters / HINT_RATIO);
  const hintsRemaining = maxHints - hintCount;

  return (
    <div
      className={`flex items-center gap-4 ${isRevealed ? "justify-center" : "justify-between"}`}
    >
      {/* Word and Answer Section */}
      <div className={`text-center ${isRevealed ? "" : "flex-1"}`}>
        <div className="text-lg font-medium text-white mb-1">{word.word}</div>
        <div className="flex items-center justify-center">
          {isRevealed ? (
            <span className="text-lg font-bold text-green-400">
              {word.answer.toUpperCase()}
            </span>
          ) : (
            <div className="flex gap-1 flex-wrap justify-center">
              {letters.map((letter, idx) =>
                letter === " " ? (
                  <div key={idx} className="w-3" />
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
                    title={
                      !revealedPositions.includes(idx) && hintsRemaining > 0
                        ? "Click to reveal this letter"
                        : undefined
                    }
                  >
                    {revealedPositions.includes(idx) && (
                      <span className="text-lg font-bold text-white">
                        {letter.toUpperCase()}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Buttons Section - Hidden in revealed mode */}
      {!isRevealed && (
        <div className="flex gap-2 items-center">
          {/* Hints Remaining Indicator */}
          <div
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
              hintsRemaining > 0
                ? "border-gray-600 bg-gray-800 text-gray-200"
                : "border-gray-700 bg-gray-800/50 text-gray-500"
            }`}
            title={
              hintsRemaining > 0
                ? "Hints remaining - click empty letter slots to reveal"
                : "No hints remaining"
            }
          >
            {hintsRemaining > 0 ? hintsRemaining : "–"}
          </div>

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="bg-gray-700 border-2 border-gray-600 rounded-lg w-10 h-10 flex items-center justify-center text-white hover:bg-gray-600 transition-colors"
            title="Reset"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>

          {/* Reveal Full Word Button */}
          <button
            onClick={onRevealFullWord}
            className="bg-gray-700 border-2 border-gray-600 rounded-lg w-10 h-10 flex items-center justify-center text-white hover:bg-gray-600 transition-colors"
            title="Reveal full word"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>

          {/* TTS Button */}
          <button
            onClick={onPlayTTS}
            disabled={isPlaying}
            className={`border-2 rounded-lg w-10 h-10 flex items-center justify-center transition-colors ${
              isPlaying
                ? "bg-green-500 border-green-600 text-white"
                : "bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            }`}
            title="Listen"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

