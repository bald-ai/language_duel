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

  const baseClasses = "rounded-2xl border-2 p-4 select-none transition";

  const cursorClasses = isFloating ? "" : "cursor-grab active:cursor-grabbing";
  const visibilityClasses = isDragging ? "opacity-0" : "";

  return (
    <div
      ref={refCallback}
      onMouseDown={onMouseDown}
      style={computedStyle}
      className={`${baseClasses} ${cursorClasses} ${visibilityClasses}`}
    >
      {isRevealed ? (
        // Revealed mode: stacked layout to keep the full answer visible
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            {/* Word & Answer Section */}
            <div className="flex-1 min-w-0">
              <div
                className="font-medium text-base mb-1 leading-tight"
                style={{ color: colors.text.DEFAULT }}
              >
                {word.word}
              </div>
              <div
                className="font-bold text-lg leading-snug break-words"
                style={{ color: colors.secondary.light }}
              >
                {word.answer}
              </div>
            </div>

            {/* TTS Button */}
            <button
              onClick={onPlayTTS}
              disabled={isTTSDisabled}
              className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 transition ${
                isTTSDisabled ? "cursor-not-allowed" : "hover:brightness-110"
              }`}
              style={ttsButtonStyle}
            >
              <SpeakerIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Confidence Segmented Control */}
          <div
            className="flex justify-center pt-2 border-t"
            style={{ borderColor: colors.primary.dark }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ConfidenceSlider
              value={confidence}
              onChange={onConfidenceChange}
              readOnly={isFloating}
            />
          </div>
        </div>
      ) : (
        // Testing mode: stacked layout
        <div className="flex flex-col gap-3">
          {/* Top row: Word info and letter groups */}
          <div className="flex-1 min-w-0">
            <div
              className="font-medium text-lg mb-1"
              style={{ color: colors.text.DEFAULT }}
            >
              {word.word}
            </div>
            <div onMouseDown={(e) => e.stopPropagation()}>
              <LetterGroups
                answer={word.answer}
                revealedPositions={revealedPositions}
                hintsRemaining={hintsRemaining}
                onRevealLetter={onRevealLetter}
              />
            </div>
          </div>

          {/* Confidence segmented control */}
          <div
            className="flex justify-center pt-2 border-t"
            style={{ borderColor: colors.primary.dark }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ConfidenceSlider
              value={confidence}
              onChange={onConfidenceChange}
              readOnly={isFloating}
            />
          </div>

          {/* Action buttons: horizontal row */}
          <div className="flex gap-2 justify-center">
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
        </div>
      )}
    </div>
  );
});

// Custom comparison function for React.memo to prevent unnecessary re-renders
WordCard.displayName = "WordCard";
