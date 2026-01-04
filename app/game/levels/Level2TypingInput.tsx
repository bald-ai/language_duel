"use client";

import { useState, useMemo, useRef } from "react";
import type { JSX } from "react";
import { normalizeAccents, stripIrr } from "@/lib/stringUtils";
import { generateAnagramLetters } from "@/lib/prng";
import { buttonStyles, colors } from "@/lib/theme";
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
  const dashStyle = { color: colors.text.muted };
  const dotStyle = { color: colors.neutral.dark };

  const actionButtonClassName =
    "bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-2 px-5 text-xs sm:text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

  const primaryActionStyle = {
    backgroundImage: `linear-gradient(to bottom, ${buttonStyles.primary.gradient.from}, ${buttonStyles.primary.gradient.to})`,
    borderTopColor: buttonStyles.primary.border.top,
    borderBottomColor: buttonStyles.primary.border.bottom,
    borderLeftColor: buttonStyles.primary.border.sides,
    borderRightColor: buttonStyles.primary.border.sides,
    color: colors.text.DEFAULT,
    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
  };

  const ghostActionStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    color: colors.text.DEFAULT,
    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
  };

  // Render dashes grouped by words
  const renderDashes = () => {
    return words.map((word, wordIdx) => (
      <span key={wordIdx} className="inline-flex gap-1">
        {word.split("").map((_, charIdx) => (
          <span key={charIdx} style={dashStyle}>_</span>
        ))}
        {wordIdx < words.length - 1 && (
          <span className="mx-3" style={dotStyle}>•</span>
        )}
      </span>
    ));
  };

  // Render anagram tiles (duel mode with anagram hint)
  const renderAnagramTiles = () => {
    if (anagramLetters.length !== letterSlots.length) {
      return <div className="text-sm" style={{ color: colors.text.muted }}>Preparing anagram...</div>;
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
          className={`w-12 h-14 flex items-center justify-center rounded-lg border-2 text-xl font-bold select-none transition ${
            submitted ? "opacity-70" : "cursor-move hover:brightness-110"
          }`}
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: submitted ? colors.neutral.dark : colors.primary.dark,
            color: colors.text.DEFAULT,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
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
          <div className="text-sm text-center" style={{ color: colors.secondary.light }}>
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
              className="px-4 py-2 rounded-lg text-sm border-2 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
                color: colors.text.muted,
              }}
            >
              Shuffle again
            </button>
            <button
              onClick={handleSubmitAnagram}
              disabled={submitted}
              className="px-6 py-2 rounded-lg font-medium border-2 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: colors.cta.DEFAULT,
                borderColor: colors.cta.dark,
                color: colors.text.DEFAULT,
              }}
            >
              Submit
            </button>
            <button
              onClick={onSkip}
              className="px-4 py-2 rounded-lg text-sm border-2 transition hover:brightness-110"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
                color: colors.text.muted,
              }}
            >
              Don&apos;t Know
            </button>
          </div>
          {submitted && anagramResult === "wrong" && (
            <div style={{ color: colors.status.danger.light }}>
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
          <div className="text-sm" style={{ color: colors.text.muted }}>
            ({cleanAnswer.length} characters{hasMultipleWords ? " including spaces" : ""})
          </div>
          {hasMultipleWords && (
            <div className="text-xs" style={{ color: colors.status.warning.light }}>
              Include spaces between words
            </div>
          )}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !submitted && handleSubmit()}
            disabled={submitted}
            className={`w-full max-w-xs px-4 py-3 text-lg text-center border-2 focus:outline-none ${
              isDuelMode ? "rounded-lg" : "rounded-2xl"
            }`}
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
            placeholder="Type your answer..."
            autoFocus
          />
          {!submitted && (
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim()}
                className={
                  isDuelMode
                    ? "px-6 py-2 rounded-lg font-medium border-2 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    : actionButtonClassName
                }
                style={
                  !isDuelMode
                    ? primaryActionStyle
                    : {
                        backgroundColor: colors.cta.DEFAULT,
                        borderColor: colors.cta.dark,
                        color: colors.text.DEFAULT,
                      }
                }
              >
                Submit
              </button>
              <button
                onClick={onSkip}
                className={
                  isDuelMode
                    ? "px-4 py-2 rounded-lg text-sm font-medium transition border-2 hover:brightness-110"
                    : "px-4 py-2 rounded-xl border-2 text-xs font-bold uppercase tracking-widest transition hover:brightness-110"
                }
                style={
                  !isDuelMode
                    ? ghostActionStyle
                    : {
                        backgroundColor: colors.background.elevated,
                        borderColor: colors.primary.dark,
                        color: colors.text.muted,
                      }
                }
              >
                Don&apos;t Know
              </button>
            </div>
          )}
          {submitted && normalizeAccents(inputValue) !== normalizeAccents(cleanAnswer) && (
            <div style={{ color: colors.status.danger.light }}>
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
              className="px-5 py-3 rounded-lg text-base font-medium flex items-center gap-2 border-2 transition hover:brightness-110"
              style={{
                backgroundColor: colors.secondary.DEFAULT,
                borderColor: colors.secondary.dark,
                color: colors.text.DEFAULT,
              }}
            >
              <span>🆘</span> Ask for Help
            </button>
          )}
          
          {hintRequested && !hintAccepted && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-sm animate-pulse" style={{ color: colors.secondary.light }}>
                Waiting for opponent to help...
              </div>
              {onRequestHint && (
                <button
                  onClick={onRequestHint}
                  className="px-3 py-1 rounded text-xs border-2 transition hover:brightness-110"
                  style={{
                    backgroundColor: colors.secondary.DEFAULT,
                    borderColor: colors.secondary.dark,
                    color: colors.text.DEFAULT,
                  }}
                >
                  Request another hint
                </button>
              )}
              <button
                onClick={onCancelHint}
                className="px-3 py-1 rounded text-xs border-2 transition hover:brightness-110"
                style={{
                  backgroundColor: colors.background.elevated,
                  borderColor: colors.primary.dark,
                  color: colors.text.muted,
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {hintRequested && hintAccepted && onRequestHint && (
            <button
              onClick={onRequestHint}
              className="px-3 py-1 rounded text-xs border-2 transition hover:brightness-110"
              style={{
                backgroundColor: colors.secondary.DEFAULT,
                borderColor: colors.secondary.dark,
                color: colors.text.DEFAULT,
              }}
            >
              Request another hint
            </button>
          )}
        </div>
      )}
    </div>
  );
}
