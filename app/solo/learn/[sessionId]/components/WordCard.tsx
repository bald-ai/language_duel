"use client";

import { ConfidenceSlider } from "./ConfidenceSlider";
import { LetterGroups } from "./LetterGroups";
import { ResetIcon, EyeIcon, SpeakerIcon } from "@/app/components/icons";

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

export function WordCard({
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
  const baseClasses = `bg-gray-800 rounded-xl ${
    isRevealed ? "py-3 px-2.5" : "p-4"
  } select-none`;

  const borderClasses = isFloating
    ? "border-2 border-blue-500 shadow-2xl shadow-blue-500/20"
    : "border border-gray-700";

  const cursorClasses = isFloating ? "" : "cursor-grab active:cursor-grabbing";
  const visibilityClasses = isDragging ? "opacity-0" : "";

  return (
    <div
      ref={refCallback}
      onMouseDown={onMouseDown}
      style={style}
      className={`${baseClasses} ${borderClasses} ${cursorClasses} ${visibilityClasses}`}
    >
      <div className="flex items-stretch justify-between">
        {/* Word & Answer Section */}
        <div className="flex-1">
          <div
            className={`font-medium text-white ${
              isRevealed ? "text-base mb-0.5 leading-tight" : "text-lg mb-1"
            }`}
          >
            {word.word}
          </div>

          {/* Answer - revealed or letter slots */}
          {isRevealed ? (
            <div className="font-bold text-green-400 text-base leading-tight">
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
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isTTSPlaying
                  ? "bg-green-500 text-white"
                  : isTTSDisabled
                  ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <SpeakerIcon className="w-6 h-6" />
            </button>
          ) : (
            // Testing mode: 2x2 grid of buttons
            <div className="grid grid-cols-2 gap-1.5">
              {/* Hints Remaining */}
              <div
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                  hintsRemaining > 0
                    ? "border-gray-500 text-gray-400"
                    : "border-gray-700 text-gray-600"
                }`}
              >
                {hintsRemaining > 0 ? hintsRemaining : "–"}
              </div>

              {/* Reset Button */}
              <button
                onClick={onResetWord}
                className="w-9 h-9 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center justify-center transition-colors"
              >
                <ResetIcon className="w-4 h-4" />
              </button>

              {/* Reveal Full Word Button */}
              <button
                onClick={onRevealFullWord}
                className="w-9 h-9 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center justify-center transition-colors"
              >
                <EyeIcon className="w-4 h-4" />
              </button>

              {/* TTS Button */}
              <button
                onClick={onPlayTTS}
                disabled={isTTSDisabled}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  isTTSPlaying
                    ? "bg-green-500 text-white"
                    : isTTSDisabled
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <SpeakerIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

