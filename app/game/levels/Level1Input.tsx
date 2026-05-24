"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { JSX } from "react";
import { buildLetterSlots, groupSlotsByWord, normalizeForComparison, stripIrr } from "@/lib/stringUtils";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { AUTO_COMPLETE_DELAY_MS, CURSOR_MOVE_DELAY_MS } from "./constants";
import type { Level1Props } from "./types";

const LETTER_INPUT_REGEX = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/;

/**
 * Level 1 - Guided typing with letter slots (solo study).
 * Auto-completes once every letter is correct.
 */
export function Level1Input({
  answer,
  onCorrect,
  onSkip,
  dataTestIdBase,
}: Level1Props) {
  const colors = useAppearanceColors();
  const [typedLetters, setTypedLetters] = useState<string[]>([]);
  const [revealedPositions, setRevealedPositions] = useState<Set<number>>(new Set());
  const [cursorPosition, setCursorPosition] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [inputBuffer, setInputBuffer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanAnswer = useMemo(() => stripIrr(answer), [answer]);

  const letterSlots = useMemo(() => buildLetterSlots(cleanAnswer), [cleanAnswer]);

  // Check if answer is all filled and correct
  const isAnswerCorrect = letterSlots.every((slot, idx) => {
    const typedChar = normalizeForComparison(typedLetters[idx] || "");
    const expectedChar = normalizeForComparison(slot.char);
    return typedChar === expectedChar;
  }) && typedLetters.length >= letterSlots.length;

  // Auto-complete (no manual confirm needed)
  useEffect(() => {
    if (hasCompleted) return;

    const checkCompletion = () => {
      if (isAnswerCorrect) {
        setHasCompleted(true);
        onCorrect(cleanAnswer);
      }
    };

    const timeout = setTimeout(checkCompletion, AUTO_COMPLETE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [typedLetters, letterSlots, isAnswerCorrect, onCorrect, hasCompleted, cleanAnswer]);

  const handleBackspace = () => {
    if (letterSlots.length === 0) return;

    const currentIndex = Math.min(Math.max(cursorPosition, 0), letterSlots.length - 1);
    const currentChar = typedLetters[currentIndex] || "";

    // First backspace clears current highlighted slot.
    if (currentChar) {
      const newTyped = [...typedLetters];
      while (newTyped.length <= currentIndex) newTyped.push("");
      newTyped[currentIndex] = "";
      setTypedLetters(newTyped);
      return;
    }

    // Repeated backspace walks left and clears in reverse order.
    if (currentIndex > 0) {
      const previousIndex = currentIndex - 1;
      const newTyped = [...typedLetters];
      while (newTyped.length <= previousIndex) newTyped.push("");
      newTyped[previousIndex] = "";
      setTypedLetters(newTyped);
      setCursorPosition(previousIndex);
    }
  };

  const handleTextEntry = (rawText: string) => {
    if (!rawText) return;

    const nextTyped = [...typedLetters];
    let nextCursor = cursorPosition;
    let hasChanges = false;

    for (const char of Array.from(rawText)) {
      if (!LETTER_INPUT_REGEX.test(char)) continue;
      if (nextCursor >= letterSlots.length) break;

      while (nextTyped.length <= nextCursor) nextTyped.push("");
      nextTyped[nextCursor] = char;
      nextCursor = Math.min(nextCursor + 1, letterSlots.length - 1);
      hasChanges = true;
    }

    if (!hasChanges) return;

    setTypedLetters(nextTyped);
    setCursorPosition(nextCursor);
  };

  const handleBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const nativeEvent = e.nativeEvent as InputEvent;

    if (nativeEvent.inputType === "deleteContentBackward") {
      e.preventDefault();
      handleBackspace();
      setInputBuffer("");
      return;
    }

    if (nativeEvent.data) {
      e.preventDefault();
      handleTextEntry(nativeEvent.data);
      setInputBuffer("");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    if (!nextValue) {
      setInputBuffer("");
      return;
    }

    handleTextEntry(nextValue);
    setInputBuffer("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      handleBackspace();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (cursorPosition > 0) setCursorPosition(cursorPosition - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (cursorPosition < letterSlots.length - 1) setCursorPosition(cursorPosition + 1);
    }
  };

  // Click/double-click on a slot to position the cursor there.
  const handleSlotDoubleClick = (slotIndex: number) => {
    setCursorPosition(slotIndex);
    inputRef.current?.focus();
  };

  const revealHint = (slotIndex: number) => {
    const newRevealed = new Set(revealedPositions);
    newRevealed.add(slotIndex);
    const newTyped = [...typedLetters];
    while (newTyped.length <= slotIndex) newTyped.push("");
    newTyped[slotIndex] = letterSlots[slotIndex].char;
    setRevealedPositions(newRevealed);
    setTypedLetters(newTyped);

    // Move cursor to the next still-unfilled slot.
    let nextUnfilled = -1;
    for (let i = 0; i < letterSlots.length; i++) {
      const isRevealed = newRevealed.has(i);
      const hasTyped = newTyped[i] && newTyped[i].toLowerCase() === letterSlots[i].char;
      if (!isRevealed && !hasTyped) {
        nextUnfilled = i;
        break;
      }
    }
    if (nextUnfilled !== -1) {
      setTimeout(() => setCursorPosition(nextUnfilled), CURSOR_MOVE_DELAY_MS);
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const renderSlots = () => {
    const elements: JSX.Element[] = [];
    let slotIdx = 0;

    groupSlotsByWord(letterSlots).forEach((wordSlots, wordIdx) => {
      if (wordIdx > 0) {
        elements.push(
          <div key={`space-${wordIdx}`} className="w-8 flex items-end justify-center pb-2">
            <span className="text-lg" style={{ color: colors.neutral.dark }}>•</span>
          </div>
        );
      }

      const tiles = wordSlots.map((slot) => {
        const currentSlotIdx = slotIdx;
        slotIdx += 1;

        const typedChar = typedLetters[currentSlotIdx] || "";
        const isRevealed = revealedPositions.has(currentSlotIdx);
        const hasTypedChar = typedChar.length > 0;
        const isCorrect = normalizeForComparison(typedChar) === normalizeForComparison(slot.char);
        const isCursor = cursorPosition === currentSlotIdx;

        const letterStyle = {
          color: colors.text.DEFAULT,
          fontFamily: "system-ui, -apple-system, sans-serif",
        };

        const incorrectUnderlineColor = "#DC2626";
        const underlineColor = hasTypedChar
          ? (isCorrect ? colors.status.success.DEFAULT : incorrectUnderlineColor)
          : colors.primary.dark;

        const hintButtonStyle = {
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          color: colors.text.DEFAULT,
        };

        const selectedLetterBoxStyle = isCursor
          ? {
            backgroundColor: `${colors.secondary.DEFAULT}1A`,
            borderColor: colors.secondary.DEFAULT,
            boxShadow: `0 0 0 1px ${colors.secondary.DEFAULT}33`,
          }
          : {
            backgroundColor: "transparent",
            borderColor: "transparent",
            boxShadow: "none",
          };

        return (
          <div key={currentSlotIdx} className="flex flex-col items-center">
            <button
              onClick={(e) => { e.stopPropagation(); revealHint(currentSlotIdx); }}
              disabled={isRevealed}
              className={`text-[10px] px-1.5 py-0.5 rounded mb-1 transition border-2 uppercase tracking-widest font-bold ${isRevealed ? "cursor-not-allowed" : "hover:brightness-110"
                }`}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-letter-${currentSlotIdx}-hint` : undefined}
              style={hintButtonStyle}
            >
              H
            </button>
            <div
              onClick={() => handleSlotDoubleClick(currentSlotIdx)}
              onDoubleClick={() => handleSlotDoubleClick(currentSlotIdx)}
              className="w-8 h-10 flex items-center justify-center border-b-[3px] cursor-text"
              data-testid={dataTestIdBase ? `${dataTestIdBase}-letter-${currentSlotIdx}-slot` : undefined}
              style={{ borderColor: underlineColor }}
            >
              <div
                className="w-7 h-7 rounded-md border flex items-center justify-center transition"
                data-testid={dataTestIdBase ? `${dataTestIdBase}-letter-${currentSlotIdx}-box` : undefined}
                style={selectedLetterBoxStyle}
              >
                <span className="text-xl font-bold" style={letterStyle}>
                  {isRevealed ? slot.char.toUpperCase() : typedChar.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        );
      });

      elements.push(<div key={`word-${wordIdx}`} className="flex gap-1">{tiles}</div>);
    });

    return elements;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className="flex flex-wrap gap-4 justify-center items-end p-4 cursor-text min-h-[120px] rounded-2xl border-2 backdrop-blur-sm"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
          boxShadow: `0 16px 40px ${colors.primary.glow}`,
        }}
      >
        {renderSlots()}
        <input
          ref={inputRef}
          type="text"
          value={inputBuffer}
          className="absolute opacity-0 pointer-events-none"
          onBeforeInput={handleBeforeInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
      </div>

      {/* Don't Know button */}
      <button
        onClick={onSkip}
        className="px-4 py-2 rounded-xl border-2 text-sm font-bold uppercase tracking-widest transition hover:brightness-110"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          color: colors.text.DEFAULT,
        }}
        data-testid={dataTestIdBase ? `${dataTestIdBase}-skip` : undefined}
      >
        Don&apos;t Know
      </button>
    </div>
  );
}
