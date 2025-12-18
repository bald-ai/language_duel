"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { JSX } from "react";
import { normalizeAccents, stripIrr } from "@/lib/stringUtils";
import { AUTO_COMPLETE_DELAY_MS, CURSOR_MOVE_DELAY_MS } from "./constants";
import type { Level1Props } from "./types";

/**
 * Level 1 - Guided Typing with letter slots
 * Works for both solo study and duel modes
 * In solo mode: auto-completes when all letters are correct
 * In duel mode: requires manual confirm, supports hint system
 */
export function Level1Input({
  answer,
  onCorrect,
  onSkip,
  mode,
  // Hint system props (optional - for duel mode)
  canRequestHint,
  hintRequested,
  hintAccepted,
  hintType,
  hintRevealedPositions,
  onRequestHint,
  onCancelHint,
  onUpdateHintState,
}: Level1Props) {
  const [typedLetters, setTypedLetters] = useState<string[]>([]);
  const [revealedPositions, setRevealedPositions] = useState<Set<number>>(new Set());
  const [cursorPosition, setCursorPosition] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if we're in duel mode (explicit prop or inferred from hint system)
  const isDuelMode = mode === "duel" || (mode === undefined && (canRequestHint !== undefined || hintRequested !== undefined));

  const cleanAnswer = useMemo(() => stripIrr(answer), [answer]);

  const letterSlots = useMemo(() => {
    const slots: { char: string; originalIndex: number }[] = [];
    cleanAnswer.split("").forEach((char, idx) => {
      if (char !== " ") {
        slots.push({ char: char.toLowerCase(), originalIndex: idx });
      }
    });
    return slots;
  }, [cleanAnswer]);

  // Check if answer is all filled and correct
  const isAnswerCorrect = letterSlots.every((slot, idx) => {
    const typedChar = normalizeAccents(typedLetters[idx] || "");
    const expectedChar = normalizeAccents(slot.char);
    return typedChar === expectedChar;
  }) && typedLetters.length >= letterSlots.length;

  // Auto-complete for solo mode (no manual confirm needed)
  useEffect(() => {
    if (isDuelMode || hasCompleted) return;
    
    const checkCompletion = () => {
      if (isAnswerCorrect) {
        setHasCompleted(true);
        onCorrect(cleanAnswer);
      }
    };
    
    const timeout = setTimeout(checkCompletion, AUTO_COMPLETE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [typedLetters, letterSlots, isAnswerCorrect, onCorrect, hasCompleted, isDuelMode, cleanAnswer]);

  // Manual confirm handler (duel mode)
  const handleConfirm = () => {
    if (hasCompleted) return;
    if (isAnswerCorrect) {
      setHasCompleted(true);
      onCorrect(cleanAnswer);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDuelMode && e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      if (cursorPosition > 0) {
        const newTyped = [...typedLetters];
        newTyped.splice(cursorPosition - 1, 1);
        setTypedLetters(newTyped);
        setCursorPosition(cursorPosition - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (cursorPosition > 0) setCursorPosition(cursorPosition - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (cursorPosition < typedLetters.length) setCursorPosition(cursorPosition + 1);
    } else if (e.key.length === 1 && /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/.test(e.key)) {
      e.preventDefault();
      if (cursorPosition < letterSlots.length) {
        const newTyped = [...typedLetters];
        if (cursorPosition < newTyped.length) {
          newTyped[cursorPosition] = e.key;
        } else {
          newTyped.push(e.key);
        }
        setTypedLetters(newTyped);
        setCursorPosition(Math.min(cursorPosition + 1, letterSlots.length));
      }
    }
  };

  // Handle double-click on slot to position cursor (solo mode)
  const handleSlotDoubleClick = (slotIndex: number) => {
    setCursorPosition(slotIndex);
    inputRef.current?.focus();
  };

  const revealHint = (slotIndex: number) => {
    setRevealedPositions((prev) => new Set([...prev, slotIndex]));
    setTypedLetters((prev) => {
      const newTyped = [...prev];
      while (newTyped.length <= slotIndex) newTyped.push("");
      newTyped[slotIndex] = letterSlots[slotIndex].char;
      return newTyped;
    });

    // Solo mode: move cursor to next unfilled position
    if (!isDuelMode) {
      setTimeout(() => {
        setTypedLetters((currentTyped) => {
          setRevealedPositions((currentRevealed) => {
            let nextUnfilled = -1;
            for (let i = 0; i < letterSlots.length; i++) {
              const isRevealed = currentRevealed.has(i);
              const hasTyped = currentTyped[i] && currentTyped[i].toLowerCase() === letterSlots[i].char;
              if (!isRevealed && !hasTyped) {
                nextUnfilled = i;
                break;
              }
            }
            if (nextUnfilled !== -1) {
              setCursorPosition(nextUnfilled);
            }
            return currentRevealed;
          });
          return currentTyped;
        });
      }, CURSOR_MOVE_DELAY_MS);
    }
  };

  // Apply hints received from opponent (duel mode only)
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!isDuelMode) return;
    if (hintRevealedPositions && hintRevealedPositions.length > 0) {
      hintRevealedPositions.forEach((pos) => {
        if (!revealedPositions.has(pos)) {
          setRevealedPositions((prev) => new Set([...prev, pos]));
          setTypedLetters((prev) => {
            const newTyped = [...prev];
            while (newTyped.length <= pos) newTyped.push("");
            newTyped[pos] = letterSlots[pos]?.char || "";
            return newTyped;
          });
        }
      });
    }
  }, [hintRevealedPositions, letterSlots, isDuelMode]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Sync hint state when typing changes (duel mode)
  useEffect(() => {
    if (hintRequested && onUpdateHintState) {
      onUpdateHintState(typedLetters, Array.from(revealedPositions));
    }
  }, [typedLetters, revealedPositions, hintRequested, onUpdateHintState]);

  // Handle requesting hint
  const handleRequestHint = () => {
    if (onRequestHint) {
      onRequestHint(typedLetters, Array.from(revealedPositions));
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const renderSlots = () => {
    const elements: JSX.Element[] = [];
    let currentWordSlots: JSX.Element[] = [];
    let lastOriginalIndex = -1;

    letterSlots.forEach((slot, slotIdx) => {
      if (lastOriginalIndex !== -1 && slot.originalIndex - lastOriginalIndex > 1) {
        if (currentWordSlots.length > 0) {
          elements.push(<div key={`word-${elements.length}`} className="flex gap-1">{currentWordSlots}</div>);
          currentWordSlots = [];
        }
        elements.push(
          <div key={`space-${slotIdx}`} className="w-8 flex items-end justify-center pb-2">
            <span className="text-gray-600 text-lg">•</span>
          </div>
        );
      }

      const typedChar = typedLetters[slotIdx] || "";
      const isRevealed = revealedPositions.has(slotIdx);
      const isCorrect = normalizeAccents(typedChar) === normalizeAccents(slot.char);
      const isCursor = cursorPosition === slotIdx;

      let letterColor = "text-gray-400";
      if (isRevealed) letterColor = "text-white";
      else if (typedChar) letterColor = isCorrect ? "text-green-400" : "text-red-400";

      currentWordSlots.push(
        <div key={slotIdx} className="flex flex-col items-center">
          <button
            onClick={(e) => { e.stopPropagation(); revealHint(slotIdx); }}
            disabled={isRevealed}
            className={`text-xs px-1.5 py-0.5 rounded mb-1 transition-colors ${
              isRevealed
                ? "bg-gray-600 text-gray-500 cursor-not-allowed"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            H
          </button>
          <div
            onDoubleClick={() => handleSlotDoubleClick(slotIdx)}
            className={`w-8 h-10 flex items-center justify-center border-b-2 ${
              isCursor ? "border-blue-400" : "border-gray-500"
            } cursor-text`}
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
      elements.push(<div key={`word-${elements.length}`} className="flex gap-1">{currentWordSlots}</div>);
    }
    return elements;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className="flex flex-wrap gap-4 justify-center items-end p-4 bg-gray-800 rounded-lg cursor-text min-h-[120px]"
      >
        {renderSlots()}
        <input
          ref={inputRef}
          type="text"
          className="absolute opacity-0 pointer-events-none"
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
      
      {/* Hint System UI - Duel mode only */}
      {isDuelMode && (
        <div className="flex flex-col items-center gap-2">
          {/* Help button - request hint */}
          {canRequestHint && !hintRequested && (
            <button
              onClick={handleRequestHint}
              className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-base font-medium flex items-center gap-2"
            >
              <span>🆘</span> Ask for Help
            </button>
          )}
          
          {/* Waiting for hint acceptance */}
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
          
          {/* Hint accepted - receiving hints (only for letters type) */}
          {hintRequested && hintAccepted && hintType === "letters" && (
            <div className="flex flex-col items-center gap-2 text-purple-400 text-sm">
              <div>🎯 Opponent is giving you hints ({hintRevealedPositions?.length || 0}/3)</div>
              {onRequestHint && (
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
      )}
      
      {/* Manual Confirm Button - Duel mode only */}
      {isDuelMode && (
        <button
          onClick={handleConfirm}
          disabled={!isAnswerCorrect || hasCompleted}
          className={`px-6 py-3 rounded-lg text-lg font-bold transition-colors ${
            isAnswerCorrect && !hasCompleted
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          ✓ Confirm Answer
        </button>
      )}
      
      {/* Don't Know button */}
      <button
        onClick={onSkip}
        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm font-medium transition-colors"
      >
        Don&apos;t Know
      </button>
    </div>
  );
}

