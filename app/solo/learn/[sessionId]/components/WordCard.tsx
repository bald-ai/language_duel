"use client";

import { memo, useMemo } from "react";
import { ConfidenceSlider, type ConfidenceLevel } from "./ConfidenceSlider";
import { LetterGroups } from "./LetterGroups";
import { EyeIcon, EyeSlashIcon, SpeakerIcon } from "@/app/components/icons";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { revealablePositions } from "@/lib/stringUtils";

import { cssVarColors as cssColors } from "@/app/components/themeCssVars";
interface WordCardProps {
  word: {
    word: string;
    answer: string;
  };
  confidence: ConfidenceLevel;
  onConfidenceChange: (value: ConfidenceLevel) => void;
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
  /** 1-based position in the word list, shown as a corner badge. */
  position?: number;
  dataTestIdBase?: string;
}

// Static styles built from CSS-variable colors (resolved live by the browser)
const cardStyleBase = {
  backgroundColor: cssColors.background.DEFAULT,
  borderColor: cssColors.primary.dark,
} as const;

const iconButtonStyleConst = {
  backgroundColor: cssColors.background.elevated,
  borderColor: cssColors.primary.dark,
  color: cssColors.text.DEFAULT,
} as const;

const disabledButtonStyleConst = {
  backgroundColor: cssColors.background.DEFAULT,
  borderColor: cssColors.neutral.dark,
  color: cssColors.text.muted,
} as const;

const playingButtonStyleConst = {
  backgroundColor: cssColors.secondary.DEFAULT,
  borderColor: cssColors.secondary.dark,
  color: cssColors.text.DEFAULT,
} as const;

// Hint counter is informational, not a button - dimmer + lower contrast than icon buttons
const hintCounterActiveStyle = {
  backgroundColor: cssColors.background.DEFAULT,
  borderColor: cssColors.primary.dark,
  color: cssColors.text.DEFAULT,
} as const;

const hintCounterEmptyStyle = {
  backgroundColor: cssColors.background.DEFAULT,
  borderColor: cssColors.neutral.dark,
  color: cssColors.text.muted,
} as const;

export const WordCard = memo(function WordCard({
  word,
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
  position,
  dataTestIdBase,
}: WordCardProps) {
  const colors = useAppearanceColors();

  const revealableIndices = useMemo(() => revealablePositions(word.answer), [word.answer]);
  const isFullyRevealed = revealableIndices.every((idx) => revealedPositions.includes(idx));
  const handleRevealToggle = isFullyRevealed ? onResetWord : onRevealFullWord;

  const revealedTTSStyle = isTTSPlaying
    ? playingButtonStyleConst
    : isTTSDisabled
    ? disabledButtonStyleConst
    : iconButtonStyleConst;

  const baseClasses = "relative rounded-2xl border-2 p-4 transition";

  return (
    <div
      style={cardStyleBase}
      className={baseClasses}
      data-testid={dataTestIdBase}
    >
      {typeof position === "number" ? (
        <div
          className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          aria-hidden="true"
          data-testid={dataTestIdBase ? `${dataTestIdBase}-position` : undefined}
        >
          {position}
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
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
            dataTestIdPrefix={dataTestIdBase ? `${dataTestIdBase}-confidence` : undefined}
          />
        </div>

        <div className="flex gap-2 justify-center">
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
    </div>
  );
});

// Custom comparison function for React.memo to prevent unnecessary re-renders
WordCard.displayName = "WordCard";
