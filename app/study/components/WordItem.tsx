"use client";

import { memo, useMemo } from "react";
import type { WordEntry } from "@/lib/types";
import { LetterGroups } from "@/app/solo/learn/[sessionId]/components/LetterGroups";
import { ResetIcon, EyeIcon, EyeSlashIcon, SpeakerIcon } from "@/app/components/icons";
import { LETTERS_PER_HINT } from "@/app/game/constants";
import { colors } from "@/lib/theme";
import { stripIrr } from "@/lib/stringUtils";

interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

interface WordItemProps {
  word: WordEntry;
  hintState: HintState;
  isTTSPlaying: boolean;
  isTTSDisabled: boolean;
  onRevealLetter: (position: number) => void;
  onRevealFullWord: () => void;
  onReset: () => void;
  onPlayTTS: () => void;
  dataTestIdBase?: string;
}

const arePositionsEqual = (left: number[], right: number[]) => {
  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }

  return true;
};

const areWordsEqual = (left: WordEntry, right: WordEntry) => {
  if (left === right) {
    return true;
  }

  if (left.word !== right.word || left.answer !== right.answer) {
    return false;
  }

  if (left.wrongAnswers.length !== right.wrongAnswers.length) {
    return false;
  }

  for (let i = 0; i < left.wrongAnswers.length; i += 1) {
    if (left.wrongAnswers[i] !== right.wrongAnswers[i]) {
      return false;
    }
  }

  return true;
};

function WordItemComponent({
  word,
  hintState,
  isTTSPlaying,
  isTTSDisabled,
  onRevealLetter,
  onRevealFullWord,
  onReset,
  onPlayTTS,
  dataTestIdBase,
}: WordItemProps) {
  const { hintCount, revealedPositions } = hintState;
  const totalLetters = useMemo(
    () => stripIrr(word.answer).split("").filter((letter) => letter !== " ").length,
    [word.answer]
  );
  const maxHints = useMemo(() => Math.ceil(totalLetters / LETTERS_PER_HINT), [totalLetters]);
  const hintsRemaining = maxHints - hintCount;
  const hasHintsRemaining = hintsRemaining > 0;
  const isFullyRevealed = revealedPositions.length >= totalLetters;

  // Compute styles at render time so they update when palette changes
  const cardStyle = {
    backgroundColor: colors.background.DEFAULT,
    borderColor: colors.primary.dark,
  };

  const iconButtonStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    color: colors.text.DEFAULT,
  };

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

  const ttsButtonStyle = isTTSPlaying
    ? {
        backgroundColor: colors.secondary.DEFAULT,
        borderColor: colors.secondary.dark,
        color: colors.text.DEFAULT,
      }
    : isTTSDisabled
    ? {
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.neutral.dark,
        color: colors.text.muted,
      }
    : iconButtonStyle;

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border-2 p-4 transition"
      style={cardStyle}
      data-testid={dataTestIdBase}
    >
      {/* Word & Answer Section */}
      <div className="flex-1 min-w-0">
        <div className="text-lg font-medium mb-1" style={{ color: colors.text.DEFAULT }}>
          {word.word}
        </div>
        <LetterGroups
          answer={word.answer}
          revealedPositions={revealedPositions}
          hintsRemaining={hintsRemaining}
          onRevealLetter={onRevealLetter}
          dataTestIdPrefix={dataTestIdBase ? `${dataTestIdBase}-hint` : undefined}
        />
      </div>

      {/* Action buttons: horizontal row */}
      <div
        className="flex gap-2 justify-center pt-2 border-t"
        style={{ borderColor: colors.primary.dark }}
      >
        {/* Hints Remaining Indicator */}
        <div
          className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold"
          style={hintPillStyle}
        >
          {hasHintsRemaining ? hintsRemaining : "-"}
        </div>

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="w-9 h-9 rounded-lg border-2 flex items-center justify-center transition hover:brightness-110"
          style={iconButtonStyle}
          data-testid={dataTestIdBase ? `${dataTestIdBase}-reset` : undefined}
        >
          <ResetIcon className="w-4 h-4" />
        </button>

        {/* Reveal/Hide Word Button */}
        <button
          onClick={isFullyRevealed ? onReset : onRevealFullWord}
          className="w-9 h-9 rounded-lg border-2 flex items-center justify-center transition hover:brightness-110"
          style={iconButtonStyle}
          data-testid={dataTestIdBase ? `${dataTestIdBase}-reveal` : undefined}
        >
          {isFullyRevealed ? (
            <EyeSlashIcon className="w-4 h-4" />
          ) : (
            <EyeIcon className="w-4 h-4" />
          )}
        </button>

        {/* TTS Button */}
        <button
          onClick={onPlayTTS}
          disabled={isTTSDisabled}
          className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center transition ${
            isTTSDisabled ? "cursor-not-allowed" : "hover:brightness-110"
          }`}
          style={ttsButtonStyle}
          data-testid={dataTestIdBase ? `${dataTestIdBase}-tts` : undefined}
        >
          <SpeakerIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export const WordItem = memo(
  WordItemComponent,
  (prev, next) =>
    prev.isTTSPlaying === next.isTTSPlaying &&
    prev.isTTSDisabled === next.isTTSDisabled &&
    areWordsEqual(prev.word, next.word) &&
    prev.hintState.hintCount === next.hintState.hintCount &&
    arePositionsEqual(prev.hintState.revealedPositions, next.hintState.revealedPositions)
);
