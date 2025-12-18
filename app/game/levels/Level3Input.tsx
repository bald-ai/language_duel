"use client";

import { useState, useMemo, useEffect } from "react";
import { normalizeAccents, stripIrr } from "@/lib/stringUtils";
import { generateAnagramLetters, buildAnagramWithSpaces } from "@/lib/prng";
import { useTTS } from "@/app/game/hooks/useTTS";
import { DUEL_CORRECT_DELAY_MS, NAVIGATE_ENABLE_DELAY_MS } from "./constants";
import type { Level3Props, HintProps } from "./types";

interface Level3ExtendedProps extends Level3Props, HintProps {
  onRequestHint?: () => void;
  mode?: "solo" | "duel";
}

/**
 * Level 3 - Pure text input (hardest level)
 * Works for both solo study and duel modes
 * Solo mode: TTS option on correct answer
 * Duel mode: hint system with anagram support
 */
export function Level3Input({
  answer,
  onCorrect,
  onWrong,
  onSkip,
  mode,
  // Hint system props (optional - for duel mode)
  canRequestHint,
  hintRequested,
  hintAccepted,
  hintType,
  onRequestHint,
  onCancelHint,
}: Level3ExtendedProps) {
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  
  // Solo mode TTS state - using shared hook
  const { isPlaying: isPlayingAudio, playTTS } = useTTS();
  const [selectedOption, setSelectedOption] = useState<"listen" | "continue">("continue");
  const [canNavigate, setCanNavigate] = useState(false);

  // Determine if we're in duel mode (explicit prop or inferred from hint system)
  const isDuelMode = mode === "duel" || (mode === undefined && (canRequestHint !== undefined || hintRequested !== undefined));
  
  const cleanAnswer = useMemo(() => stripIrr(answer), [answer]);
  const hasMultipleWords = cleanAnswer.split(" ").length > 1;
  const showAnagramHint = hintAccepted && hintType === "anagram";
  
  const anagramHint = useMemo(() => {
    if (!showAnagramHint) return "";
    const shuffled = generateAnagramLetters(cleanAnswer);
    return buildAnagramWithSpaces(cleanAnswer, shuffled);
  }, [cleanAnswer, showAnagramHint]);

  const handleSubmit = () => {
    setSubmitted(true);
    if (normalizeAccents(inputValue) === normalizeAccents(cleanAnswer)) {
      setIsCorrectAnswer(true);
      if (isDuelMode) {
        // Duel mode: auto-continue after delay
        setTimeout(() => onCorrect(inputValue), DUEL_CORRECT_DELAY_MS);
      } else {
        // Solo mode: enable keyboard navigation for listen/continue
        setTimeout(() => setCanNavigate(true), NAVIGATE_ENABLE_DELAY_MS);
      }
    } else {
      onWrong(inputValue);
    }
  };

  // Play TTS for the answer (solo mode)
  const handlePlayAudio = () => {
    if (isPlayingAudio) return;
    playTTS(`level3-${cleanAnswer}`, cleanAnswer);
  };

  const handleContinue = () => {
    onCorrect(cleanAnswer);
  };

  // Keyboard navigation for Listen/Continue selection (solo mode)
  useEffect(() => {
    if (isDuelMode) return;
    const shouldListen = isCorrectAnswer && !isPlayingAudio && canNavigate;
    if (!shouldListen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedOption((prev) => (prev === "listen" ? "continue" : "listen"));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedOption === "listen") {
          handlePlayAudio();
        } else {
          handleContinue();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex flex-col items-center gap-4">
      {hasMultipleWords && !submitted && (
        <div className="text-xs text-yellow-500/80">
          Include spaces between words
        </div>
      )}
      
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !submitted && handleSubmit()}
        disabled={submitted}
        className="w-full max-w-xs px-4 py-3 text-lg text-center bg-gray-800 border-2 border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none"
        placeholder={showAnagramHint ? `Anagram: ${anagramHint}` : "Type your answer..."}
        autoFocus
      />
      
      {/* Anagram hint display (duel mode) */}
      {showAnagramHint && (
        <div className="text-sm text-purple-300">Hint (anagram): {anagramHint}</div>
      )}
      
      {/* Hint System UI - Duel mode only */}
      {isDuelMode && (
        <div className="flex flex-col items-center gap-2">
          {canRequestHint && !hintRequested && !submitted && (
            <button
              onClick={onRequestHint}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <span>🆘</span> Ask for Help
            </button>
          )}
          
          {hintRequested && !hintAccepted && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-purple-400 text-sm animate-pulse">
                Waiting for opponent to help...
              </div>
              {onRequestHint && (
                <button
                  onClick={onRequestHint}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
                >
                  Request another hint
                </button>
              )}
              <button
                onClick={onCancelHint}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded text-xs"
              >
                Cancel
              </button>
            </div>
          )}

          {hintRequested && hintAccepted && onRequestHint && (
            <button
              onClick={onRequestHint}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
            >
              Request another hint
            </button>
          )}
        </div>
      )}
      
      {/* Submit buttons */}
      {!submitted && (
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            Submit
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Don&apos;t Know
          </button>
        </div>
      )}
      
      {/* Correct answer feedback */}
      {submitted && isCorrectAnswer && (
        isDuelMode ? (
          // Duel mode: simple correct message
          <div className="text-green-400 text-xl font-bold">✓ Correct!</div>
        ) : (
          // Solo mode: Listen/Continue options
          <div className="flex flex-col items-center gap-3">
            <div className="text-green-400 text-xl font-bold">✓ Correct!</div>
            <div className="flex gap-3">
              <button
                onClick={handlePlayAudio}
                disabled={isPlayingAudio}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                  isPlayingAudio
                    ? 'border-green-500 bg-green-500/20 text-green-400 cursor-not-allowed'
                    : selectedOption === "listen"
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                }`}
              >
                <span className="text-xl">{isPlayingAudio ? '🔊' : '🔈'}</span>
                <span>{isPlayingAudio ? 'Playing...' : 'Listen'}</span>
              </button>
              <button
                onClick={handleContinue}
                disabled={isPlayingAudio}
                className={`px-4 py-2 rounded-lg border-2 font-medium transition-all disabled:opacity-50 ${
                  selectedOption === "continue"
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                }`}
              >
                Continue →
              </button>
            </div>
            <div className="text-xs text-gray-500">← → to select, Enter to confirm</div>
          </div>
        )
      )}
      
      {/* Wrong answer feedback */}
      {submitted && !isCorrectAnswer && (
        <div className="text-red-400">
          Wrong! The answer was: <span className="font-bold">{cleanAnswer}</span>
        </div>
      )}
    </div>
  );
}

