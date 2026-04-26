"use client";

import { memo, useMemo } from "react";
import { ConfidenceSlider } from "./ConfidenceSlider";
import { LetterGroups } from "./LetterGroups";
import { EyeIcon, EyeSlashIcon, SpeakerIcon } from "@/app/components/icons";
import { colors } from "@/lib/theme";
import { stripIrr } from "@/lib/stringUtils";

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
  dataTestIdBase?: string;
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

// Hint counter is informational, not a button - dimmer + lower contrast than icon buttons
const hintCounterActiveStyle = {
  backgroundColor: colors.background.DEFAULT,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
} as const;

const hintCounterEmptyStyle = {
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
  dataTestIdBase,
}: WordCardProps) {
  // Memoize computed styles to avoid recreation
  const computedStyle = useMemo(() => ({
    ...style,
    ...cardStyleBase,
    ...(isFloating ? floatingStyleAdditions : null),
  }), [style, isFloating]);

  const revealablePositions = useMemo(
    () =>
      stripIrr(word.answer)
        .split("")
        .map((char, idx) => (char !== " " ? idx : -1))
        .filter((idx) => idx !== -1),
    [word.answer]
  );
  const isFullyRevealed = revealablePositions.every((idx) => revealedPositions.includes(idx));
  const handleRevealToggle = isFullyRevealed ? onResetWord : onRevealFullWord;

  const revealedTTSStyle = isTTSPlaying
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
      data-testid={dataTestIdBase}
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
                style={{ color: colors.text.DEFAULT, fontFamily: "system-ui, -apple-system, sans-serif" }}
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
              style={revealedTTSStyle}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-tts` : undefined}
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
              dataTestIdPrefix={dataTestIdBase ? `${dataTestIdBase}-confidence` : undefined}
            />
          </div>
        </div>
      ) : (
        // Testing mode: stacked layout
        <div className="flex flex-col gap-3">
          {/* Top row: Word info and letter groups */}
          <div className="flex-1 min-w-0">
            <div
              className="font-medium text-lg mb-1 text-center"
              style={{ color: colors.text.DEFAULT }}
            >
              {word.word}
            </div>
            <div className="flex justify-center" onMouseDown={(e) => e.stopPropagation()}>
              <LetterGroups
                answer={word.answer}
                revealedPositions={revealedPositions}
                hintsRemaining={hintsRemaining}
                onRevealLetter={onRevealLetter}
                dataTestIdPrefix={dataTestIdBase ? `${dataTestIdBase}-hint` : undefined}
              />
            </div>
          </div>

          {/* Confidence section: label above keeps the slider truly centered */}
          <div
            className="flex flex-col items-center gap-1.5 pt-2 border-t"
            style={{ borderColor: colors.primary.dark }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span
              className="text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: colors.text.muted }}
            >
              Confidence
            </span>
            <ConfidenceSlider
              value={confidence}
              onChange={onConfidenceChange}
              readOnly={isFloating}
              dataTestIdPrefix={dataTestIdBase ? `${dataTestIdBase}-confidence` : undefined}
            />
          </div>

          {/* Action row: original sizes, centered, with tiny labels under each */}
          <div className="flex gap-2 justify-center">
            {/* Hints Remaining - circle (info shape) with label so it doesn't read as a button */}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold tabular-nums"
                style={hintsRemaining > 0 ? hintCounterActiveStyle : hintCounterEmptyStyle}
                data-testid={dataTestIdBase ? `${dataTestIdBase}-hints-remaining` : undefined}
              >
                {hintsRemaining > 0 ? hintsRemaining : 0}
              </div>
              <span
                className="text-[9px] uppercase tracking-wide font-semibold leading-none"
                style={{ color: colors.text.muted }}
              >
                Hints
              </span>
            </div>

            {/* Reveal/Hide Button */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={handleRevealToggle}
                aria-label={isFullyRevealed ? "Hide answer" : "Reveal answer"}
                className="w-9 h-9 rounded-lg border-2 flex items-center justify-center transition hover:brightness-110 cursor-pointer"
                style={iconButtonStyleConst}
                data-testid={dataTestIdBase ? `${dataTestIdBase}-reveal` : undefined}
              >
                {isFullyRevealed ? (
                  <EyeSlashIcon className="w-4 h-4" />
                ) : (
                  <EyeIcon className="w-4 h-4" />
                )}
              </button>
              <span
                className="text-[9px] uppercase tracking-wide font-semibold leading-none"
                style={{ color: colors.text.muted }}
              >
                {isFullyRevealed ? "Hide" : "Reveal"}
              </span>
            </div>

            {/* TTS Button */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={onPlayTTS}
                disabled={isTTSDisabled}
                aria-label="Listen"
                className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center transition ${
                  isTTSDisabled ? "cursor-not-allowed" : "cursor-pointer hover:brightness-110"
                }`}
                style={revealedTTSStyle}
                data-testid={dataTestIdBase ? `${dataTestIdBase}-tts` : undefined}
              >
                <SpeakerIcon className="w-4 h-4" />
              </button>
              <span
                className="text-[9px] uppercase tracking-wide font-semibold leading-none"
                style={{ color: colors.text.muted }}
              >
                Listen
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// Custom comparison function for React.memo to prevent unnecessary re-renders
WordCard.displayName = "WordCard";
