"use client";

import { useState, useMemo, useRef } from "react";
import type { JSX } from "react";
import { normalizeAccents, stripIrr } from "@/lib/stringUtils";
import { generateAnagramLetters } from "@/lib/prng";
import type { Level2TypingProps } from "./types";

/**
 * Level 2 - Typing Input with dashes hint
 * Works for both solo study and duel modes
 * In duel mode: supports anagram hint feature
 */
export function Level2TypingInput({
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
}: Level2TypingProps) {
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [anagramLetters, setAnagramLetters] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [anagramNonce, setAnagramNonce] = useState(0);
  const [anagramResult, setAnagramResult] = useState<"correct" | "wrong" | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  // Determine if we're in duel mode (explicit prop or inferred from hint system)
  const isDuelMode = mode === "duel" || (mode === undefined && (canRequestHint !== undefined || hintRequested !== undefined));
  const hintIsAnagram = hintAccepted && hintType === "anagram";

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

  const anagramBase = useMemo(
    () => (hintIsAnagram ? generateAnagramLetters(cleanAnswer, 0) : []),
    [cleanAnswer, hintIsAnagram]
  );

  const effectiveAnagramLetters = anagramLetters.length ? anagramLetters : anagramBase;

  const handleSubmit = () => {
    setSubmitted(true);
    setAnagramResult(null);
    if (normalizeAccents(inputValue) === normalizeAccents(answer)) {
      onCorrect(inputValue);
    } else {
      onWrong(inputValue);
    }
  };

  const handleSubmitAnagram = () => {
    const reconstructed = cleanAnswer.split("");
    effectiveAnagramLetters.forEach((char, idx) => {
      const slot = letterSlots[idx];
      if (slot) {
        reconstructed[slot.originalIndex] = char || "";
      }
    });
    const candidate = reconstructed.join("");
    const isCorrect = normalizeAccents(candidate) === normalizeAccents(cleanAnswer);
    setSubmitted(true);
    setAnagramResult(isCorrect ? "correct" : "wrong");
    if (isCorrect) {
      onCorrect(candidate);
    } else {
      onWrong(candidate);
    }
  };

  const handleDragStart = (idx: number) => {
    if (submitted) return;
    dragIndexRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (idx: number) => {
    if (submitted) return;
    const from = dragIndexRef.current;
    if (from === null || from === idx) return;
    setAnagramLetters((prev) => {
      const base = prev.length ? prev : effectiveAnagramLetters;
      const next = [...base];
      [next[from], next[idx]] = [next[idx], next[from]];
      return next;
    });
    dragIndexRef.current = null;
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
  };

  const handleShuffleAnagram = () => {
    if (submitted) return;
    setAnagramNonce((n) => {
      const next = n + 1;
      setAnagramLetters(generateAnagramLetters(cleanAnswer, next));
      return next;
    });
  };

  const words = cleanAnswer.split(" ");
  const hasMultipleWords = words.length > 1;

  // Render dashes grouped by words
  const renderDashes = () => {
    return words.map((word, wordIdx) => (
      <span key={wordIdx} className="inline-flex gap-1">
        {word.split("").map((_, charIdx) => (
          <span key={charIdx} className="text-gray-400">_</span>
        ))}
        {wordIdx < words.length - 1 && <span className="mx-3 text-gray-600">•</span>}
      </span>
    ));
  };

  // Render anagram tiles (duel mode with anagram hint)
  const renderAnagramTiles = () => {
    if (anagramLetters.length !== letterSlots.length) {
      return <div className="text-gray-400 text-sm">Preparing anagram...</div>;
    }

    const elements: JSX.Element[] = [];
    let currentWord: JSX.Element[] = [];
    let lastIdx = -1;

    letterSlots.forEach((slot, idx) => {
      const isNewWord = lastIdx >= 0 && slot.originalIndex > lastIdx + 1;
      if (isNewWord && currentWord.length > 0) {
        elements.push(
          <div key={`word-${elements.length}`} className="flex gap-2">
            {currentWord}
          </div>
        );
        currentWord = [];
      }

      currentWord.push(
        <div
          key={`slot-${idx}`}
          draggable={!submitted}
          onDragStart={() => handleDragStart(idx)}
          onDragOver={handleDragOver}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(idx);
          }}
          onDragEnd={handleDragEnd}
          className={`w-12 h-14 flex items-center justify-center rounded-lg border-2 bg-gray-800 text-white text-xl font-bold select-none ${
            submitted ? "opacity-70" : "hover:border-blue-500 cursor-move"
          }`}
        >
          {anagramLetters[idx]?.toUpperCase()}
        </div>
      );
      lastIdx = slot.originalIndex;
    });

    if (currentWord.length > 0) {
      elements.push(
        <div key={`word-${elements.length}`} className="flex gap-2">
          {currentWord}
        </div>
      );
    }

    return elements;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {hintIsAnagram ? (
        <>
          {/* Anagram mode (duel only) */}
          <div className="text-sm text-purple-300 text-center">
            Anagram hint: drag letters to rearrange them into the answer.
          </div>
          <div className="text-2xl font-mono tracking-widest flex flex-wrap justify-center">
            {renderDashes()}
          </div>
          <div className="flex flex-wrap gap-3 justify-center w-full">
            {renderAnagramTiles()}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleShuffleAnagram}
              disabled={submitted}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm disabled:opacity-50"
            >
              Shuffle again
            </button>
            <button
              onClick={handleSubmitAnagram}
              disabled={submitted}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium"
            >
              Submit
            </button>
            <button
              onClick={onSkip}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm"
            >
              Don&apos;t Know
            </button>
          </div>
          {submitted && anagramResult === "wrong" && (
            <div className="text-red-400">
              Wrong! The answer was: <span className="font-bold">{cleanAnswer}</span>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Standard typing mode */}
          <div className="text-2xl font-mono tracking-widest flex flex-wrap justify-center">
            {renderDashes()}
          </div>
          <div className="text-sm text-gray-500">
            ({cleanAnswer.length} characters{hasMultipleWords ? " including spaces" : ""})
          </div>
          {hasMultipleWords && (
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
            placeholder="Type your answer..."
            autoFocus
          />
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
          {submitted && normalizeAccents(inputValue) !== normalizeAccents(cleanAnswer) && (
            <div className="text-red-400">
              Wrong! The answer was: <span className="font-bold">{cleanAnswer}</span>
            </div>
          )}
        </>
      )}
      
      {/* Hint System UI - Duel mode only */}
      {isDuelMode && !hintIsAnagram && (
        <div className="flex flex-col items-center gap-2">
          {canRequestHint && !hintRequested && !submitted && (
            <button
              onClick={onRequestHint}
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
    </div>
  );
}

