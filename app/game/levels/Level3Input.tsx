"use client";

import { useState, useMemo, useEffect } from "react";
import { normalizeAccents, stripIrr } from "@/lib/stringUtils";
import { generateAnagramLetters, buildAnagramWithSpaces } from "@/lib/prng";
import { useTTS } from "@/app/game/hooks/useTTS";
import { DUEL_CORRECT_DELAY_MS, NAVIGATE_ENABLE_DELAY_MS } from "./constants";
import type { Level3Props, HintProps } from "./types";
import { buttonStyles, colors } from "@/lib/theme";

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
  dataTestIdBase,
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
        placeholder={showAnagramHint ? `Anagram: ${anagramHint}` : "Type your answer..."}
        autoFocus
        data-testid={dataTestIdBase ? `${dataTestIdBase}-input` : undefined}
      />
      
      {/* Anagram hint display (duel mode) */}
      {showAnagramHint && (
        <div className="text-sm" style={{ color: colors.secondary.light }}>
          Hint (anagram): {anagramHint}
        </div>
      )}
      
      {/* Hint System UI - Duel mode only */}
      {isDuelMode && (
        <div className="flex flex-col items-center gap-2">
          {canRequestHint && !hintRequested && !submitted && (
            <button
              onClick={onRequestHint}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border-2 transition hover:brightness-110"
              style={{
                backgroundColor: colors.secondary.DEFAULT,
                borderColor: colors.secondary.dark,
                color: colors.text.DEFAULT,
              }}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-hint-request` : undefined}
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
                  data-testid={dataTestIdBase ? `${dataTestIdBase}-hint-request-again` : undefined}
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
                data-testid={dataTestIdBase ? `${dataTestIdBase}-hint-cancel` : undefined}
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
              data-testid={dataTestIdBase ? `${dataTestIdBase}-hint-request-again` : undefined}
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
            className={
              isDuelMode
                ? "px-6 py-2 rounded-lg font-medium border-2 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                : "bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-2 px-5 text-xs sm:text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            }
            style={
              !isDuelMode
                ? {
                    backgroundImage: `linear-gradient(to bottom, ${buttonStyles.primary.gradient.from}, ${buttonStyles.primary.gradient.to})`,
                    borderTopColor: buttonStyles.primary.border.top,
                    borderBottomColor: buttonStyles.primary.border.bottom,
                    borderLeftColor: buttonStyles.primary.border.sides,
                    borderRightColor: buttonStyles.primary.border.sides,
                    color: colors.text.DEFAULT,
                    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }
                : {
                    backgroundColor: colors.cta.DEFAULT,
                    borderColor: colors.cta.dark,
                    color: colors.text.DEFAULT,
                  }
            }
            data-testid={dataTestIdBase ? `${dataTestIdBase}-submit` : undefined}
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
                ? {
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.primary.dark,
                    color: colors.text.DEFAULT,
                    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }
                : {
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.primary.dark,
                    color: colors.text.muted,
                  }
            }
            data-testid={dataTestIdBase ? `${dataTestIdBase}-skip` : undefined}
          >
            Don&apos;t Know
          </button>
        </div>
      )}
      
      {/* Correct answer feedback */}
      {submitted && isCorrectAnswer && (
        isDuelMode ? (
          // Duel mode: simple correct message
          <div className="text-xl font-bold" style={{ color: colors.status.success.light }}>
            ✓ Correct!
          </div>
        ) : (
          // Solo mode: Listen/Continue options
          <div className="flex flex-col items-center gap-3">
            <div className="text-xl font-bold" style={{ color: colors.status.success.DEFAULT }}>
              Correct
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePlayAudio}
                disabled={isPlayingAudio}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-semibold transition-all disabled:opacity-60"
                style={
                  isPlayingAudio
                    ? {
                        borderColor: colors.status.success.DEFAULT,
                        backgroundColor: `${colors.status.success.DEFAULT}26`,
                        color: colors.status.success.DEFAULT,
                      }
                    : selectedOption === "listen"
                    ? {
                        borderColor: colors.secondary.DEFAULT,
                        backgroundColor: `${colors.secondary.DEFAULT}26`,
                        color: colors.secondary.light,
                      }
                    : {
                        borderColor: colors.primary.dark,
                        backgroundColor: colors.background.DEFAULT,
                        color: colors.text.DEFAULT,
                      }
                }
                data-testid={dataTestIdBase ? `${dataTestIdBase}-listen` : undefined}
              >
                <span>{isPlayingAudio ? "Playing..." : "Listen"}</span>
              </button>
              <button
                onClick={handleContinue}
                disabled={isPlayingAudio}
                className="px-4 py-2 rounded-xl border-2 font-semibold transition-all disabled:opacity-50"
                style={
                  selectedOption === "continue"
                    ? {
                        borderColor: colors.primary.DEFAULT,
                        backgroundColor: `${colors.primary.DEFAULT}26`,
                        color: colors.text.DEFAULT,
                      }
                    : {
                        borderColor: colors.primary.dark,
                        backgroundColor: colors.background.DEFAULT,
                        color: colors.text.DEFAULT,
                      }
                }
                data-testid={dataTestIdBase ? `${dataTestIdBase}-continue` : undefined}
              >
                Continue
              </button>
            </div>
            <div className="text-xs" style={{ color: colors.text.muted }}>
              Left and right to select, Enter to confirm
            </div>
          </div>
        )
      )}
      
      {/* Wrong answer feedback */}
      {submitted && !isCorrectAnswer && (
        <div style={{ color: colors.status.danger.light }}>
          Wrong! The answer was: <span className="font-bold">{cleanAnswer}</span>
        </div>
      )}
    </div>
  );
}
