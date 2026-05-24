"use client";

import { useState, useMemo, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { hashSeed, seededShuffle } from "@/lib/prng";
import { stripIrr } from "@/lib/stringUtils";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { LevelActions } from "./components/LevelActions";
import type { Level2MultipleChoiceProps } from "./types";

/**
 * Level 2 - Multiple Choice (solo study).
 * Select with click or arrow keys, then confirm.
 */
export function Level2MultipleChoice({
  answer,
  wrongAnswers,
  onCorrect,
  onWrong,
  onSkip,
  dataTestIdBase,
}: Level2MultipleChoiceProps) {
  const colors = useAppearanceColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Shuffle options: 4 wrong + 1 correct
  const options = useMemo(() => {
    const seed = hashSeed(`${answer}::${wrongAnswers.join("|")}`);
    const shuffledWrong = seededShuffle([...wrongAnswers], seed).slice(0, 4);
    return seededShuffle([answer, ...shuffledWrong], seed + 1);
  }, [answer, wrongAnswers]);

  const selectedAnswer = selectedIndex !== null ? options[selectedIndex] : null;

  const handleOptionClick = (idx: number) => {
    if (submitted) return;
    setSelectedIndex(idx);
  };

  const handleSubmit = useCallback(() => {
    if (submitted || selectedIndex === null) return;
    setSubmitted(true);
    if (selectedAnswer === answer) {
      onCorrect(selectedAnswer);
    } else {
      onWrong(selectedAnswer || "");
    }
  }, [submitted, selectedIndex, selectedAnswer, answer, onCorrect, onWrong]);

  // Keyboard navigation: arrows to move, Enter to confirm.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (submitted) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => ((prev ?? -1) + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => ((prev ?? 0) - 1 + options.length) % options.length);
      } else if (e.key === "Enter" && selectedIndex !== null) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitted, options.length, selectedIndex, handleSubmit]);

  // Focus container on mount for keyboard events
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

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

          let buttonClass = "border-2 font-medium transition-all";
          let buttonStyle: CSSProperties = {
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          };

          if (showResult) {
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

          if (!submitted) {
            buttonClass += " hover:brightness-110 cursor-pointer";
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionClick(idx)}
              disabled={submitted}
              className={`p-4 rounded-2xl text-base sm:text-lg ${buttonClass}`}
              style={buttonStyle}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-option-${idx}` : undefined}
            >
              {stripIrr(option)}
            </button>
          );
        })}
      </div>

      {/* Navigation hint */}
      <div className="text-xs" style={{ color: colors.text.muted }}>
        Up and down to navigate, Enter to confirm
      </div>

      {/* Answer buttons — secondary left, primary (Confirm) right (LTR) */}
      {!submitted && (
        <LevelActions
          onSkip={onSkip}
          onConfirm={handleSubmit}
          confirmDisabled={selectedIndex === null}
          dataTestIdBase={dataTestIdBase}
        />
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
    </div>
  );
}
