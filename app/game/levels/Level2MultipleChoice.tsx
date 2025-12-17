"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { hashSeed, seededShuffle } from "@/lib/prng";
import { DONT_KNOW_REVEAL_MS } from "./constants";
import type { Level2MultipleChoiceProps } from "./types";

/**
 * Level 2 - Multiple Choice
 * Works for both solo study and duel modes
 * Solo mode: select then confirm with keyboard navigation
 * Duel mode: immediate submit on click, supports eliminate hint
 */
export function Level2MultipleChoice({
  answer,
  wrongAnswers,
  onCorrect,
  onWrong,
  onSkip,
  mode,
  // Hint system props (optional - for duel mode)
  canRequestHint,
  hintRequested,
  hintAccepted,
  eliminatedOptions,
  onRequestHint,
  onCancelHint,
}: Level2MultipleChoiceProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if we're in duel mode (explicit prop or inferred from hint system)
  const isDuelMode = mode === "duel" || (mode === undefined && (canRequestHint !== undefined || hintRequested !== undefined));

  // Shuffle options: 4 wrong + 1 correct
  const options = useMemo(() => {
    const seed = hashSeed(`${answer}::${wrongAnswers.join("|")}`);
    const shuffledWrong = seededShuffle([...wrongAnswers], seed).slice(0, 4);
    return seededShuffle([answer, ...shuffledWrong], seed + 1);
  }, [answer, wrongAnswers]);

  const selectedAnswer = selectedIndex !== null ? options[selectedIndex] : null;

  // Use ref to track current selectedIndex for keyboard handler
  const selectedIndexRef = useRef(selectedIndex);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Handle option click - different behavior for solo vs duel
  const handleOptionClick = (idx: number) => {
    if (submitted) return;
    // Don't allow clicking eliminated options (duel mode)
    if (eliminatedOptions?.includes(options[idx])) return;

    if (isDuelMode) {
      // Duel mode: immediate submit
      const selectedOption = options[idx];
      setSelectedIndex(idx);
      setSubmitted(true);
      if (selectedOption === answer) {
        onCorrect(selectedOption);
      } else {
        onWrong(selectedOption);
      }
    } else {
      // Solo mode: just select
      setSelectedIndex(idx);
    }
  };

  // Handle submit (solo mode only)
  const handleSubmit = () => {
    if (submitted || selectedIndex === null) return;
    setSubmitted(true);
    if (selectedAnswer === answer) {
      onCorrect(selectedAnswer);
    } else {
      onWrong(selectedAnswer || "");
    }
  };

  // Handle "Don't Know" - show correct answer briefly then skip
  const handleDontKnow = () => {
    if (submitted) return;
    setSubmitted(true);
    const correctIdx = options.findIndex(opt => opt === answer);
    setSelectedIndex(correctIdx);
    setTimeout(() => {
      onSkip();
    }, DONT_KNOW_REVEAL_MS);
  };

  // Handle requesting hint (duel mode)
  const handleRequestHint = () => {
    if (onRequestHint) {
      onRequestHint(options);
    }
  };

  // Keyboard navigation (solo mode: arrows + enter, duel mode: number keys)
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (submitted) return;

      if (isDuelMode) {
        // Duel mode: number keys for quick select
        const numKey = parseInt(e.key);
        if (numKey >= 1 && numKey <= options.length) {
          e.preventDefault();
          if (eliminatedOptions?.includes(options[numKey - 1])) return;
          handleOptionClick(numKey - 1);
        }
      } else {
        // Solo mode: arrow navigation
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => ((prev ?? -1) + 1) % options.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => ((prev ?? 0) - 1 + options.length) % options.length);
        } else if (e.key === "Enter" && selectedIndexRef.current !== null) {
          e.preventDefault();
          const currentAnswer = options[selectedIndexRef.current];
          setSubmitted(true);
          setTimeout(() => {
            if (currentAnswer === answer) {
              onCorrect(currentAnswer);
            } else {
              onWrong(currentAnswer);
            }
          }, 0);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitted, options, answer, eliminatedOptions, isDuelMode]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Focus container on mount for keyboard events (solo mode)
  useEffect(() => {
    if (!isDuelMode) {
      containerRef.current?.focus();
    }
  }, [isDuelMode]);

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="flex flex-col items-center gap-4 w-full max-w-md outline-none"
    >
      <div className="grid grid-cols-1 gap-3 w-full">
        {options.map((option, idx) => {
          const isSelected = selectedIndex === idx;
          const isCorrect = option === answer;
          const showResult = submitted;
          const isEliminated = eliminatedOptions?.includes(option);

          let buttonClass = "border-gray-600 bg-gray-800 hover:border-gray-500 cursor-pointer";
          
          if (isEliminated && !showResult) {
            buttonClass = "border-gray-700 bg-gray-900 text-gray-600 line-through cursor-not-allowed opacity-50";
          } else if (showResult) {
            if (isCorrect) {
              buttonClass = "border-green-500 bg-green-500/20 text-green-400";
            } else if (isSelected && !isCorrect) {
              buttonClass = "border-red-500 bg-red-500/20 text-red-400";
            } else {
              buttonClass = "border-gray-600 bg-gray-800 opacity-50";
            }
          } else if (isSelected) {
            buttonClass = "border-blue-500 bg-blue-500/20 text-blue-400";
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionClick(idx)}
              disabled={submitted || isEliminated}
              className={`p-4 rounded-lg border-2 text-lg font-medium transition-all ${buttonClass}`}
            >
              {isDuelMode && <span className="text-gray-500 mr-2">{idx + 1}.</span>}
              {option}
            </button>
          );
        })}
      </div>

      {/* Navigation hint */}
      {!isDuelMode && (
        <div className="text-xs text-gray-500">↑↓ to navigate, Enter to confirm</div>
      )}

      {/* Submit buttons */}
      {!submitted && (
        <div className="flex gap-3">
          {!isDuelMode && (
            <button
              onClick={handleSubmit}
              disabled={selectedIndex === null}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              Confirm
            </button>
          )}
          <button
            onClick={isDuelMode ? handleDontKnow : onSkip}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Don&apos;t Know
          </button>
        </div>
      )}

      {/* Wrong answer feedback */}
      {submitted && selectedAnswer !== answer && (
        <div className="text-center text-gray-400 mt-2">
          Correct answer: <span className="font-bold text-green-400">{answer}</span>
        </div>
      )}

      {/* Hint System UI - Duel mode only */}
      {isDuelMode && !submitted && (
        <div className="flex flex-col items-center gap-2">
          {canRequestHint && !hintRequested && (
            <button
              onClick={handleRequestHint}
              className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-base font-medium flex items-center gap-2"
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
                  onClick={handleRequestHint}
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
              onClick={handleRequestHint}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
            >
              Request another hint
            </button>
          )}
        </div>
      )}
    </div>
  );
}

