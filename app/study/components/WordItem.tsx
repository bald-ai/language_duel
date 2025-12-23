"use client";

import type { WordEntry } from "@/lib/types";
import { HintState, HINT_RATIO } from "../hooks";
import { stripIrr } from "@/lib/stringUtils";
import { colors } from "@/lib/theme";

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
  const cleanAnswer = stripIrr(word.answer);
  const letters = cleanAnswer.split("");
  const totalLetters = letters.filter((l) => l !== " ").length;
  const maxHints = Math.ceil(totalLetters / HINT_RATIO);
  const hintsRemaining = maxHints - hintCount;
  const hasHintsRemaining = hintsRemaining > 0;

  const hintPillStyle = hasHintsRemaining
    ? {
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
        color: colors.text.DEFAULT,
      }
    : {
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.neutral.dark,
        color: colors.text.muted,
      };

  const iconButtonStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    color: colors.text.DEFAULT,
  };

  const playingButtonStyle = {
    backgroundColor: colors.secondary.DEFAULT,
    borderColor: colors.secondary.dark,
    color: colors.text.DEFAULT,
  };

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border-2 px-4 py-3 transition ${isRevealed ? "justify-center" : "justify-between"}`}
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
    >
      {/* Word and Answer Section */}
      <div className={`text-center ${isRevealed ? "" : "flex-1"}`}>
        <div className="text-lg font-medium mb-1" style={{ color: colors.text.DEFAULT }}>
          {word.word}
        </div>
        <div className="flex items-center justify-center">
          {isRevealed ? (
            <span className="text-lg font-bold" style={{ color: colors.secondary.light }}>
              {cleanAnswer.toUpperCase()}
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
                      !revealedPositions.includes(idx) && hasHintsRemaining && onRevealLetter(idx)
                    }
                    className={`w-5 h-6 flex items-end justify-center border-b-2 transition ${
                      !revealedPositions.includes(idx) && hasHintsRemaining
                        ? "cursor-pointer hover:brightness-110"
                        : ""
                    }`}
                    style={{ borderColor: colors.neutral.dark }}
                    title={
                      !revealedPositions.includes(idx) && hasHintsRemaining
                        ? "Click to reveal this letter"
                        : undefined
                    }
                  >
                    {revealedPositions.includes(idx) && (
                      <span className="text-lg font-bold" style={{ color: colors.text.DEFAULT }}>
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
            className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold"
            style={hintPillStyle}
            title={
              hasHintsRemaining
                ? "Hints remaining - click empty letter slots to reveal"
                : "No hints remaining"
            }
          >
            {hasHintsRemaining ? hintsRemaining : "–"}
          </div>

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="border-2 rounded-xl w-10 h-10 flex items-center justify-center transition hover:brightness-110"
            style={iconButtonStyle}
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
            className="border-2 rounded-xl w-10 h-10 flex items-center justify-center transition hover:brightness-110"
            style={iconButtonStyle}
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
            className={`border-2 rounded-xl w-10 h-10 flex items-center justify-center transition disabled:cursor-not-allowed ${
              isPlaying ? "" : "hover:brightness-110"
            }`}
            style={isPlaying ? playingButtonStyle : iconButtonStyle}
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
