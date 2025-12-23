"use client";

import { memo } from "react";
import { ResetIcon, EyeIcon, SpeakerIcon } from "@/app/components/icons";
import { stripIrr } from "@/lib/stringUtils";
import { colors } from "@/lib/theme";

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
export const WordCard = memo(function WordCard({
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
  const cleanAnswer = stripIrr(word.answer);
  const letters = cleanAnswer.split("");

  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
    >
      <div className="flex items-center justify-between">
        {/* Word & Answer Section */}
        <div className="flex-1">
          <div className="text-lg font-medium mb-1" style={{ color: colors.text.DEFAULT }}>
            {word.word}
          </div>

          {/* Answer - revealed or letter slots */}
          {isRevealed ? (
            <div className="text-lg font-bold" style={{ color: colors.status.success.light }}>
              {cleanAnswer}
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
                    className={`w-5 h-6 flex items-end justify-center border-b-2 ${
                      !revealedPositions.includes(idx) && hintsRemaining > 0
                        ? "cursor-pointer hover:brightness-110"
                        : ""
                    }`}
                    style={{ borderColor: colors.neutral.dark }}
                  >
                    {revealedPositions.includes(idx) && (
                      <span className="text-base font-bold" style={{ color: colors.status.success.light }}>
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
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                style={{
                  borderColor: hintsRemaining > 0 ? colors.neutral.dark : colors.primary.dark,
                  color: hintsRemaining > 0 ? colors.text.muted : colors.neutral.dark,
                }}
              >
                {hintsRemaining > 0 ? hintsRemaining : "–"}
              </div>

              <button
                onClick={onResetWord}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition border-2 hover:brightness-110"
                style={{
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.primary.dark,
                  color: colors.text.muted,
                }}
              >
                <ResetIcon />
              </button>

              <button
                onClick={onRevealFullWord}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition border-2 hover:brightness-110"
                style={{
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.primary.dark,
                  color: colors.text.muted,
                }}
              >
                <EyeIcon />
              </button>
            </>
          )}

          {/* TTS Button */}
          <button
            onClick={onPlayTTS}
            disabled={isTTSDisabled}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition border-2 ${
              isTTSDisabled ? "cursor-not-allowed" : "hover:brightness-110"
            }`}
            style={
              isTTSPlaying
                ? {
                    backgroundColor: colors.status.success.DEFAULT,
                    borderColor: colors.status.success.dark,
                    color: colors.text.DEFAULT,
                  }
                : isTTSDisabled
                ? {
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.neutral.dark,
                    color: colors.text.muted,
                  }
                : {
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.primary.dark,
                    color: colors.text.muted,
                  }
            }
          >
            <SpeakerIcon />
          </button>
        </div>
      </div>
    </div>
  );
});

WordCard.displayName = "WordCard";
