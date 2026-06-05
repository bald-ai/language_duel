"use client";

import { memo, useMemo } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { cssVarColors as cssColors } from "@/app/components/themeCssVars";
import { EyeIcon, EyeSlashIcon, SpeakerIcon } from "@/app/components/icons";
import { tokenizeSpanishSentence } from "@/lib/themes/sentenceValidation";
import { ConfidenceSlider, type ConfidenceLevel } from "./ConfidenceSlider";
import type { SessionSentenceItem } from "@/lib/sessionItems";

interface SentenceStudyCardProps {
  sentence: SessionSentenceItem;
  confidence: ConfidenceLevel;
  maxConfidenceLevel: ConfidenceLevel;
  onConfidenceChange: (value: ConfidenceLevel) => void;
  position: number;
  showThemeLabel: boolean;
  /** Token indices the learner has revealed so far. */
  revealedPositions: number[];
  onRevealToken: (tokenIndex: number) => void;
  onRevealAll: (allPositions: number[]) => void;
  onHide: () => void;
  isTTSPlaying: boolean;
  isTTSDisabled: boolean;
  onPlayTTS: () => void;
  dataTestIdBase?: string;
}

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

// TEMPORARY: sentence TTS generation is currently failing in production, so the
// study-card Listen button is force-disabled (greyed out) for now. Flip this back
// to `true` once /api/tts reliably synthesizes full sentences again.
const SENTENCE_TTS_ENABLED = false;

export const SentenceStudyCard = memo(function SentenceStudyCard({
  sentence,
  confidence,
  maxConfidenceLevel,
  onConfidenceChange,
  position,
  showThemeLabel,
  revealedPositions,
  onRevealToken,
  onRevealAll,
  onHide,
  isTTSPlaying,
  isTTSDisabled,
  onPlayTTS,
  dataTestIdBase,
}: SentenceStudyCardProps) {
  const colors = useAppearanceColors();

  const tokens = useMemo(
    () => tokenizeSpanishSentence(sentence.spanishSentence),
    [sentence.spanishSentence]
  );
  const allPositions = useMemo(() => tokens.map((_, i) => i), [tokens]);

  const revealedSet = useMemo(() => new Set(revealedPositions), [revealedPositions]);
  const hintsRemaining = Math.max(0, tokens.length - revealedSet.size);
  const isFullyRevealed = tokens.length > 0 && revealedSet.size >= tokens.length;
  const handleRevealToggle = isFullyRevealed ? onHide : () => onRevealAll(allPositions);

  // TEMPORARY: while sentence TTS is unavailable, the button stays disabled
  // regardless of playback state. Remove the `!SENTENCE_TTS_ENABLED` guards when
  // re-enabling.
  const ttsDisabled = !SENTENCE_TTS_ENABLED || isTTSDisabled;
  const ttsStyle = !SENTENCE_TTS_ENABLED
    ? disabledButtonStyleConst
    : isTTSPlaying
      ? playingButtonStyleConst
      : isTTSDisabled
        ? disabledButtonStyleConst
        : iconButtonStyleConst;

  const hiddenTokenStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.neutral.dark,
    color: colors.text.muted,
  };
  const shownTokenStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    color: colors.text.DEFAULT,
  };

  return (
    <div
      className="relative rounded-2xl border-2 p-4 transition"
      style={cardStyleBase}
      data-testid={dataTestIdBase}
    >
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

      <div className="flex flex-col gap-3">
        <div className="min-w-0 text-center">
          {showThemeLabel && (
            <div
              className="mb-2 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: colors.text.muted }}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-theme` : undefined}
            >
              {sentence.themeName}
            </div>
          )}
          <div
            className="px-8 text-base font-semibold leading-snug"
            style={{ color: colors.text.DEFAULT }}
            data-testid={dataTestIdBase ? `${dataTestIdBase}-english` : undefined}
          >
            {sentence.englishPrompt}
          </div>

          <div
            className="mt-3 flex min-h-[34px] flex-wrap items-center justify-center gap-1.5"
            onMouseDown={(event) => event.stopPropagation()}
            data-testid={dataTestIdBase ? `${dataTestIdBase}-spanish` : undefined}
          >
            {tokens.map((token, index) =>
              revealedSet.has(index) ? (
                <span
                  key={index}
                  className="rounded-[10px] border-2 px-2.5 py-1.5 text-[15px] font-semibold leading-none"
                  style={shownTokenStyle}
                  data-testid={
                    dataTestIdBase ? `${dataTestIdBase}-token-${index}` : undefined
                  }
                >
                  {token}
                </span>
              ) : (
                <button
                  key={index}
                  type="button"
                  onClick={() => onRevealToken(index)}
                  aria-label={`Reveal word ${index + 1}`}
                  className="min-w-[54px] rounded-[10px] border-2 px-2.5 py-1.5 text-[15px] font-semibold leading-none tracking-[2px] transition hover:brightness-105"
                  style={hiddenTokenStyle}
                  data-testid={
                    dataTestIdBase ? `${dataTestIdBase}-token-${index}` : undefined
                  }
                >
                  •••
                </button>
              )
            )}
          </div>
        </div>

        <div
          className="flex flex-col items-center gap-1.5 border-t pt-2"
          style={{ borderColor: colors.primary.dark }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: colors.text.muted }}
          >
            Confidence
          </span>
          <ConfidenceSlider
            value={confidence}
            onChange={onConfidenceChange}
            maxLevel={maxConfidenceLevel}
            dataTestIdPrefix={dataTestIdBase ? `${dataTestIdBase}-confidence` : undefined}
          />
        </div>

        <div className="flex justify-center gap-2">
          <div className="flex flex-col items-center gap-0.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums"
              style={hintsRemaining > 0 ? hintCounterActiveStyle : hintCounterEmptyStyle}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-hints-remaining` : undefined}
            >
              {hintsRemaining}
            </div>
            <span
              className="text-[9px] font-semibold uppercase leading-none tracking-wide"
              style={{ color: colors.text.muted }}
            >
              Hints
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={handleRevealToggle}
              aria-label={isFullyRevealed ? "Hide sentence" : "Reveal sentence"}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-2 transition hover:brightness-110"
              style={iconButtonStyleConst}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-reveal` : undefined}
            >
              {isFullyRevealed ? (
                <EyeSlashIcon className="h-4 w-4" />
              ) : (
                <EyeIcon className="h-4 w-4" />
              )}
            </button>
            <span
              className="text-[9px] font-semibold uppercase leading-none tracking-wide"
              style={{ color: colors.text.muted }}
            >
              {isFullyRevealed ? "Hide" : "Reveal"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={ttsDisabled ? undefined : onPlayTTS}
              disabled={ttsDisabled}
              aria-label="Listen"
              title={
                SENTENCE_TTS_ENABLED ? undefined : "Sentence audio is temporarily unavailable"
              }
              className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 transition ${
                ttsDisabled ? "cursor-not-allowed" : "cursor-pointer hover:brightness-110"
              }`}
              style={ttsStyle}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-tts` : undefined}
            >
              <SpeakerIcon className="h-4 w-4" />
            </button>
            <span
              className="text-[9px] font-semibold uppercase leading-none tracking-wide"
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

SentenceStudyCard.displayName = "SentenceStudyCard";
