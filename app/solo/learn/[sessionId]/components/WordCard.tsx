"use client";

import { memo, useMemo } from "react";
import { ConfidenceSlider } from "./ConfidenceSlider";
import { LetterGroups } from "./LetterGroups";
import { ResetIcon, EyeIcon, SpeakerIcon } from "@/app/components/icons";
import { colors } from "@/lib/theme";

interface WordCardProps {
  word: {
    word: string;
    answer: string;
  };
  isRevealed: boolean;
  confidence: number;
  onConfidenceChange: (value: number) => void;
  // Hint mode props
  revealedPositions: number[];
  hintsRemaining: number;
  onRevealLetter: (position: number) => void;
  onRevealFullWord: () => void;
  onResetWord: () => void;
  // TTS props
  isTTSPlaying: boolean;
  isTTSDisabled: boolean;
  onPlayTTS: () => void;
  // Drag props
  isDragging?: boolean;
  isFloating?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  refCallback?: (el: HTMLDivElement | null) => void;
}

// Memoized static styles to avoid recreation on each render
const cardStyleBase = {
  backgroundColor: colors.background.DEFAULT,
  borderColor: colors.primary.dark,
} as const;

const floatingStyleAdditions = {
  borderColor: colors.primary.light,
  boxShadow: `0 22px 50px ${colors.primary.glow}`,
} as const;

const iconButtonStyleConst = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
} as const;

const disabledButtonStyleConst = {
  backgroundColor: colors.background.DEFAULT,
  borderColor: colors.neutral.dark,
  color: colors.text.muted,
} as const;

const playingButtonStyleConst = {
  backgroundColor: colors.secondary.DEFAULT,
  borderColor: colors.secondary.dark,
  color: colors.text.DEFAULT,
} as const;

const hintPillActiveStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
} as const;

const hintPillInactiveStyle = {
  backgroundColor: colors.background.DEFAULT,
  borderColor: colors.neutral.dark,
  color: colors.text.muted,
} as const;

export const WordCard = memo(function WordCard({
  word,
  isRevealed,
  confidence,
  onConfidenceChange,
  revealedPositions,
  hintsRemaining,
  onRevealLetter,
  onRevealFullWord,
  onResetWord,
  isTTSPlaying,
  isTTSDisabled,
  onPlayTTS,
  isDragging = false,
  isFloating = false,
  onMouseDown,
  style,
  refCallback,
}: WordCardProps) {
  // Memoize computed styles to avoid recreation
  const computedStyle = useMemo(() => ({
    ...style,
    ...cardStyleBase,
    ...(isFloating ? floatingStyleAdditions : null),
  }), [style, isFloating]);

  const hintPillStyle = hintsRemaining > 0 ? hintPillActiveStyle : hintPillInactiveStyle;

  const ttsButtonStyle = isTTSPlaying
    ? playingButtonStyleConst
    : isTTSDisabled
    ? disabledButtonStyleConst
    : iconButtonStyleConst;

  const baseClasses = `rounded-2xl border-2 ${
    isRevealed ? "py-3 px-2.5" : "p-4"
  } select-none backdrop-blur-sm transition-all`;

  const cursorClasses = isFloating ? "" : "cursor-grab active:cursor-grabbing";
  const visibilityClasses = isDragging ? "opacity-0" : "";

  return (
    <div
      ref={refCallback}
      onMouseDown={onMouseDown}
      style={computedStyle}
      className={`${baseClasses} ${cursorClasses} ${visibilityClasses}`}
    >
      <div className="flex items-stretch justify-between">
        {/* Word & Answer Section */}
        <div className="flex-1">
          <div
            className={`font-medium ${
              isRevealed ? "text-base mb-0.5 leading-tight" : "text-lg mb-1"
            }`}
            style={{ color: colors.text.DEFAULT }}
          >
            {word.word}
          </div>

          {/* Answer - revealed or letter slots */}
          {isRevealed ? (
            <div
              className="font-bold text-base leading-tight"
              style={{ color: colors.secondary.light }}
            >
              {word.answer}
            </div>
          ) : (
            <div onMouseDown={(e) => e.stopPropagation()}>
              <LetterGroups
                answer={word.answer}
                revealedPositions={revealedPositions}
                hintsRemaining={hintsRemaining}
                onRevealLetter={onRevealLetter}
              />
            </div>
          )}
        </div>

        {/* Buttons Section */}
        <div className={`flex items-center ${isRevealed ? "gap-1.5 ml-3" : "gap-2 ml-4"}`}>
          {/* Confidence Slider */}
          <ConfidenceSlider
            value={confidence}
            onChange={onConfidenceChange}
            compact={!isRevealed}
            readOnly={isFloating}
          />

          {isRevealed ? (
            // Revealed mode: just TTS button
            <button
              onClick={onPlayTTS}
              disabled={isTTSDisabled}
              className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition ${
                isTTSDisabled ? "cursor-not-allowed" : "hover:brightness-110"
              }`}
              style={ttsButtonStyle}
            >
              <SpeakerIcon className="w-6 h-6" />
            </button>
          ) : (
            // Testing mode: 2x2 grid of buttons
            <div className="grid grid-cols-2 gap-1.5">
              {/* Hints Remaining */}
              <div
                className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                style={hintPillStyle}
              >
                {hintsRemaining > 0 ? hintsRemaining : "-"}
              </div>

              {/* Reset Button */}
              <button
                onClick={onResetWord}
                className="w-9 h-9 rounded-lg border-2 flex items-center justify-center transition hover:brightness-110"
                style={iconButtonStyleConst}
              >
                <ResetIcon className="w-4 h-4" />
              </button>

              {/* Reveal Full Word Button */}
              <button
                onClick={onRevealFullWord}
                className="w-9 h-9 rounded-lg border-2 flex items-center justify-center transition hover:brightness-110"
                style={iconButtonStyleConst}
              >
                <EyeIcon className="w-4 h-4" />
              </button>

              {/* TTS Button */}
              <button
                onClick={onPlayTTS}
                disabled={isTTSDisabled}
                className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center transition ${
                  isTTSDisabled ? "cursor-not-allowed" : "hover:brightness-110"
                }`}
                style={ttsButtonStyle}
              >
                <SpeakerIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Custom comparison function for React.memo to prevent unnecessary re-renders
WordCard.displayName = "WordCard";
