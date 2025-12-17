"use client";

import { useMemo } from "react";
import type { JSX } from "react";
import { normalizeAccents } from "@/lib/stringUtils";

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
            <span className="text-gray-600">•</span>
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

      let letterColor = "text-gray-400";
      if (isHintRevealed) letterColor = "text-purple-400"; // Hint we provided
      else if (isRequesterRevealed) letterColor = "text-white"; // Already revealed by requester
      else if (typedChar) letterColor = isCorrect ? "text-green-400" : "text-red-400";

      currentWordSlots.push(
        <div key={slotIdx} className="flex flex-col items-center">
          <button
            onClick={() => canClick && onProvideHint(slotIdx)}
            disabled={!canClick}
            className={`text-xs px-1.5 py-0.5 rounded mb-1 ${
              isHintRevealed
                ? "bg-purple-600 text-white"
                : isRequesterRevealed
                  ? "bg-gray-600 text-gray-500"
                  : canClick
                    ? "bg-purple-700 text-purple-200 hover:bg-purple-600 cursor-pointer"
                    : "bg-gray-700 text-gray-500"
            }`}
          >
            {isHintRevealed ? "✓" : "H"}
          </button>
          <div
            className={`w-8 h-10 flex items-center justify-center border-b-2 ${
              canClick ? "border-purple-500 cursor-pointer" : "border-gray-500"
            }`}
            onClick={() => canClick && onProvideHint(slotIdx)}
          >
            <span className={`text-xl font-bold ${letterColor}`}>
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
      <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full border-2 border-purple-500">
        <div className="text-center mb-4">
          <div className="text-purple-400 text-sm font-medium mb-1">
            🆘 {requesterName} needs help!
          </div>
          <div className="text-3xl font-bold text-white mb-2">{word}</div>
          <div className="text-sm text-gray-400">Click on letters to reveal (up to 3)</div>
        </div>

        <div className="flex flex-wrap gap-4 justify-center items-end p-4 bg-gray-900 rounded-lg min-h-[120px] mb-4">
          {renderSlots()}
        </div>

        <div className="flex justify-center items-center gap-4">
          <div className="text-purple-400 font-medium">Hints remaining: {hintsRemaining}/3</div>
        </div>

        <button
          onClick={onDismiss}
          className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
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
      <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full border-2 border-purple-500">
        <div className="text-center mb-4">
          <div className="text-purple-400 text-sm font-medium mb-1">
            🆘 {requesterName} needs help!
          </div>
          <div className="text-3xl font-bold text-white mb-2">{word}</div>
          <div className="text-sm text-gray-400">Click on 2 wrong options to eliminate them</div>
        </div>

        <div className="grid grid-cols-1 gap-3 w-full mb-4">
          {options.map((option, idx) => {
            const isCorrect = option === answer;
            const isEliminated = eliminatedOptions.includes(option);
            const canEliminate = !isCorrect && !isEliminated && eliminationsRemaining > 0;

            let buttonClass = "border-gray-600 bg-gray-800";
            if (isCorrect) {
              buttonClass = "border-green-500 bg-green-500/20 text-green-400 cursor-not-allowed";
            } else if (isEliminated) {
              buttonClass = "border-red-500 bg-red-500/20 text-red-400 line-through opacity-50";
            } else if (canEliminate) {
              buttonClass =
                "border-gray-600 bg-gray-800 hover:border-red-500 hover:bg-red-500/10 cursor-pointer";
            } else {
              buttonClass = "border-gray-600 bg-gray-800 opacity-50 cursor-not-allowed";
            }

            return (
              <button
                key={idx}
                onClick={() => canEliminate && onEliminateOption(option)}
                disabled={!canEliminate}
                className={`p-4 rounded-lg border-2 text-lg font-medium transition-all ${buttonClass}`}
              >
                {isCorrect && <span className="mr-2">✓</span>}
                {isEliminated && <span className="mr-2">✗</span>}
                {option}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center items-center gap-4">
          <div className="text-purple-400 font-medium">
            Eliminations remaining: {eliminationsRemaining}/2
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
        >
          Minimize (continue your game)
        </button>
      </div>
    </div>
  );
}

