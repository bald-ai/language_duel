"use client";

import { useMemo } from "react";
import type { JSX } from "react";
import { normalizeAccents } from "@/lib/stringUtils";
import { colors } from "@/lib/theme";

// HintGiverView - Shown to opponent when they accept hint request
interface HintGiverViewProps {
  word: string;
  answer: string;
  typedLetters: string[];
  requesterRevealedPositions: number[];
  hintRevealedPositions: number[];
  hintsRemaining: number;
  onProvideHint: (position: number) => void;
  requesterName: string;
  onDismiss: () => void;
}

export function HintGiverView({
  word,
  answer,
  typedLetters,
  requesterRevealedPositions,
  hintRevealedPositions,
  hintsRemaining,
  onProvideHint,
  requesterName,
  onDismiss,
}: HintGiverViewProps) {
  const letterSlots = useMemo(() => {
    const slots: { char: string; originalIndex: number }[] = [];
    answer.split("").forEach((char, idx) => {
      if (char !== " ") {
        slots.push({ char: char.toLowerCase(), originalIndex: idx });
      }
    });
    return slots;
  }, [answer]);

  const renderSlots = () => {
    const elements: JSX.Element[] = [];
    let currentWordSlots: JSX.Element[] = [];
    let lastOriginalIndex = -1;

    letterSlots.forEach((slot, slotIdx) => {
      if (lastOriginalIndex !== -1 && slot.originalIndex - lastOriginalIndex > 1) {
        if (currentWordSlots.length > 0) {
          elements.push(
            <div key={`word-${elements.length}`} className="flex gap-1">
              {currentWordSlots}
            </div>
          );
          currentWordSlots = [];
        }
        elements.push(
          <div key={`space-${slotIdx}`} className="w-6 flex items-end justify-center pb-2">
            <span style={{ color: colors.neutral.dark }}>•</span>
          </div>
        );
      }

      const typedChar = typedLetters[slotIdx] || "";
      const isRequesterRevealed = requesterRevealedPositions.includes(slotIdx);
      const isHintRevealed = hintRevealedPositions.includes(slotIdx);
      const isRevealed = isRequesterRevealed || isHintRevealed;
      const isCorrect = normalizeAccents(typedChar) === normalizeAccents(slot.char);

      // Can click to reveal if: not already revealed and hints remaining
      const canClick = !isRevealed && hintsRemaining > 0;

      let letterColor = colors.text.muted;
      if (isHintRevealed) letterColor = colors.secondary.light; // Hint we provided
      else if (isRequesterRevealed) letterColor = colors.text.DEFAULT; // Already revealed by requester
      else if (typedChar) letterColor = isCorrect ? colors.status.success.light : colors.status.danger.light;

      const hintButtonStyle = isHintRevealed
        ? {
            backgroundColor: colors.secondary.DEFAULT,
            borderColor: colors.secondary.dark,
            color: colors.text.DEFAULT,
          }
        : isRequesterRevealed
          ? {
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.neutral.dark,
              color: colors.text.muted,
            }
          : canClick
            ? {
                backgroundColor: `${colors.secondary.DEFAULT}26`,
                borderColor: colors.secondary.DEFAULT,
                color: colors.secondary.light,
              }
            : {
                backgroundColor: colors.background.elevated,
                borderColor: colors.neutral.dark,
                color: colors.text.muted,
              };

      currentWordSlots.push(
        <div key={slotIdx} className="flex flex-col items-center">
          <button
            onClick={() => canClick && onProvideHint(slotIdx)}
            disabled={!canClick}
            className={`text-xs px-1.5 py-0.5 rounded mb-1 border-2 transition ${
              canClick ? "cursor-pointer hover:brightness-110" : ""
            }`}
            style={hintButtonStyle}
          >
            {isHintRevealed ? "✓" : "H"}
          </button>
          <div
            className={`w-8 h-10 flex items-center justify-center border-b-2 ${
              canClick ? "cursor-pointer" : ""
            }`}
            style={{ borderColor: canClick ? colors.secondary.DEFAULT : colors.neutral.dark }}
            onClick={() => canClick && onProvideHint(slotIdx)}
          >
            <span className="text-xl font-bold" style={{ color: letterColor }}>
              {isRevealed ? slot.char.toUpperCase() : typedChar.toUpperCase()}
            </span>
          </div>
        </div>
      );
      lastOriginalIndex = slot.originalIndex;
    });

    if (currentWordSlots.length > 0) {
      elements.push(
        <div key={`word-${elements.length}`} className="flex gap-1">
          {currentWordSlots}
        </div>
      );
    }
    return elements;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div
        className="rounded-xl p-6 max-w-lg w-full border-2"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.secondary.dark,
          boxShadow: `0 20px 50px ${colors.secondary.DEFAULT}33`,
        }}
      >
        <div className="text-center mb-4">
          <div className="text-sm font-medium mb-1" style={{ color: colors.secondary.light }}>
            🆘 {requesterName} needs help!
          </div>
          <div className="text-3xl font-bold mb-2" style={{ color: colors.text.DEFAULT }}>
            {word}
          </div>
          <div className="text-sm" style={{ color: colors.text.muted }}>
            Click on letters to reveal (up to 3)
          </div>
        </div>

        <div
          className="flex flex-wrap gap-4 justify-center items-end p-4 rounded-lg min-h-[120px] mb-4"
          style={{ backgroundColor: colors.background.DEFAULT }}
        >
          {renderSlots()}
        </div>

        <div className="flex justify-center items-center gap-4">
          <div className="font-medium" style={{ color: colors.secondary.light }}>
            Hints remaining: {hintsRemaining}/3
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="w-full mt-4 px-4 py-2 rounded-lg text-sm border-2 transition hover:brightness-110"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.muted,
          }}
        >
          Minimize (continue your game)
        </button>
      </div>
    </div>
  );
}

// L2HintGiverView - Shown to opponent when they accept L2 multiple choice hint request
interface L2HintGiverViewProps {
  word: string;
  answer: string;
  options: string[];
  eliminatedOptions: string[];
  onEliminateOption: (option: string) => void;
  requesterName: string;
  onDismiss: () => void;
}

export function L2HintGiverView({
  word,
  answer,
  options,
  eliminatedOptions,
  onEliminateOption,
  requesterName,
  onDismiss,
}: L2HintGiverViewProps) {
  const eliminationsRemaining = 2 - eliminatedOptions.length;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div
        className="rounded-xl p-6 max-w-lg w-full border-2"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.secondary.dark,
          boxShadow: `0 20px 50px ${colors.secondary.DEFAULT}33`,
        }}
      >
        <div className="text-center mb-4">
          <div className="text-sm font-medium mb-1" style={{ color: colors.secondary.light }}>
            🆘 {requesterName} needs help!
          </div>
          <div className="text-3xl font-bold mb-2" style={{ color: colors.text.DEFAULT }}>
            {word}
          </div>
          <div className="text-sm" style={{ color: colors.text.muted }}>
            Click on 2 wrong options to eliminate them
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 w-full mb-4">
          {options.map((option, idx) => {
            const isCorrect = option === answer;
            const isEliminated = eliminatedOptions.includes(option);
            const canEliminate = !isCorrect && !isEliminated && eliminationsRemaining > 0;

            let buttonClass = "p-4 rounded-lg border-2 text-lg font-medium transition-all";
            let buttonStyle = {
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            };
            if (isCorrect) {
              buttonClass += " cursor-not-allowed";
              buttonStyle = {
                backgroundColor: `${colors.status.success.DEFAULT}26`,
                borderColor: colors.status.success.DEFAULT,
                color: colors.status.success.light,
              };
            } else if (isEliminated) {
              buttonClass += " line-through opacity-50 cursor-not-allowed";
              buttonStyle = {
                backgroundColor: `${colors.status.danger.DEFAULT}26`,
                borderColor: colors.status.danger.DEFAULT,
                color: colors.status.danger.light,
              };
            } else if (canEliminate) {
              buttonClass += " cursor-pointer hover:brightness-110";
              buttonStyle = {
                backgroundColor: `${colors.status.warning.DEFAULT}1A`,
                borderColor: colors.status.warning.DEFAULT,
                color: colors.status.warning.light,
              };
            } else {
              buttonClass += " opacity-50 cursor-not-allowed";
              buttonStyle = {
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.neutral.dark,
                color: colors.text.muted,
              };
            }

            return (
              <button
                key={idx}
                onClick={() => canEliminate && onEliminateOption(option)}
                disabled={!canEliminate}
                className={buttonClass}
                style={buttonStyle}
              >
                {isCorrect && <span className="mr-2">✓</span>}
                {isEliminated && <span className="mr-2">✗</span>}
                {option}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center items-center gap-4">
          <div className="font-medium" style={{ color: colors.secondary.light }}>
            Eliminations remaining: {eliminationsRemaining}/2
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="w-full mt-4 px-4 py-2 rounded-lg text-sm border-2 transition hover:brightness-110"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.muted,
          }}
        >
          Minimize (continue your game)
        </button>
      </div>
    </div>
  );
}
