"use client";

import { useState, useMemo, useRef, useEffect, type CSSProperties } from "react";
import { hashSeed, seededShuffle } from "@/lib/prng";
import { DONT_KNOW_REVEAL_MS } from "./constants";
import { stripIrr } from "@/lib/stringUtils";
import { buttonStyles, colors } from "@/lib/theme";
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
  dataTestIdBase,
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

  const isDuelMode = mode === "duel";

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

          let buttonClass = "border-2 font-medium transition-all";
          let buttonStyle: CSSProperties = {
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          };

          if (isEliminated && !showResult) {
            buttonClass += " line-through cursor-not-allowed opacity-50";
            buttonStyle = {
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.neutral.dark,
              color: colors.text.muted,
            };
          } else if (showResult) {
            if (isCorrect) {
              buttonStyle = {
                backgroundColor: `${colors.status.success.DEFAULT}26`,
                borderColor: colors.status.success.DEFAULT,
                color: colors.status.success.light,
              };
            } else if (isSelected && !isCorrect) {
              buttonStyle = {
                backgroundColor: `${colors.status.danger.DEFAULT}26`,
                borderColor: colors.status.danger.DEFAULT,
                color: colors.status.danger.light,
              };
            } else {
              buttonClass += " opacity-50";
              buttonStyle = {
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.muted,
              };
            }
          } else if (isSelected) {
            buttonStyle = {
              backgroundColor: `${colors.secondary.DEFAULT}26`,
              borderColor: colors.secondary.DEFAULT,
              color: colors.secondary.light,
            };
          }

          if (!submitted && !isEliminated) {
            buttonClass += " hover:brightness-110 cursor-pointer";
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionClick(idx)}
              disabled={submitted || isEliminated}
              className={`${isDuelMode ? "p-4 rounded-lg text-lg" : "p-4 rounded-2xl text-base sm:text-lg"} ${buttonClass}`}
              style={buttonStyle}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-option-${idx}` : undefined}
            >
              {isDuelMode && (
                <span className="mr-2" style={{ color: colors.text.muted }}>
                  {idx + 1}.
                </span>
              )}
              {stripIrr(option)}
            </button>
          );
        })}
      </div>

      {/* Navigation hint */}
      {!isDuelMode && (
        <div className="text-xs" style={{ color: colors.text.muted }}>
          Up and down to navigate, Enter to confirm
        </div>
      )}

      {/* Submit buttons */}
      {!submitted && (
        <div className="flex gap-3">
          {!isDuelMode && (
            <button
              onClick={handleSubmit}
              disabled={selectedIndex === null}
              className={actionButtonClassName}
              style={primaryActionStyle}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-confirm` : undefined}
            >
              Confirm
            </button>
          )}
          <button
            onClick={isDuelMode ? handleDontKnow : onSkip}
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
            data-testid={dataTestIdBase ? `${dataTestIdBase}-skip` : undefined}
          >
            Don&apos;t Know
          </button>
        </div>
      )}

      {/* Wrong answer feedback */}
      {submitted && selectedAnswer !== answer && (
        <div
          className="text-center mt-2"
          style={{ color: colors.text.muted }}
        >
          Correct answer:{" "}
          <span
            className="font-bold"
            style={{ color: colors.status.success.light }}
          >
            {stripIrr(answer)}
          </span>
        </div>
      )}

      {/* Hint System UI - Duel mode only */}
      {isDuelMode && !submitted && (
        <div className="flex flex-col items-center gap-2">
          {canRequestHint && !hintRequested && (
            <button
              onClick={handleRequestHint}
              className="px-5 py-3 rounded-lg text-base font-medium flex items-center gap-2 border-2 transition hover:brightness-110"
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
                  onClick={handleRequestHint}
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
              onClick={handleRequestHint}
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
    </div>
  );
}
