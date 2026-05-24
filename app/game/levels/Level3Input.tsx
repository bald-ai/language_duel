"use client";

import { useState, useMemo } from "react";
import { normalizeForComparison, stripIrr } from "@/lib/stringUtils";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { LevelActions } from "./components/LevelActions";
import type { Level3Props } from "./types";

/**
 * Level 3 - Pure text input (hardest level, solo study).
 */
export function Level3Input({
  answer,
  onCorrect,
  onWrong,
  onSkip,
  dataTestIdBase,
}: Level3Props) {
  const colors = useAppearanceColors();
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const cleanAnswer = useMemo(() => stripIrr(answer), [answer]);
  const normalizedCleanAnswer = useMemo(
    () => normalizeForComparison(cleanAnswer),
    [cleanAnswer]
  );
  const hasMultipleWords = cleanAnswer.split(" ").length > 1;

  const handleSubmit = () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;

    setSubmitted(true);
    if (normalizeForComparison(trimmedInput) === normalizedCleanAnswer) {
      onCorrect(trimmedInput);
    } else {
      onWrong(trimmedInput);
    }
  };

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
        onKeyDown={(e) => {
          if (e.key === "Enter" && !submitted && inputValue.trim()) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        disabled={submitted}
        className="w-full max-w-xs px-4 py-3 text-lg text-center border-2 focus:outline-none rounded-2xl"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          color: colors.text.DEFAULT,
        }}
        placeholder="Type your answer..."
        autoFocus
        data-testid={dataTestIdBase ? `${dataTestIdBase}-input` : undefined}
      />

      {/* Answer buttons — secondary left, primary (Confirm) right (LTR) */}
      {!submitted && (
        <LevelActions
          onSkip={onSkip}
          onConfirm={handleSubmit}
          confirmDisabled={!inputValue.trim()}
          dataTestIdBase={dataTestIdBase}
          confirmTestId="submit"
        />
      )}

      {/* Wrong answer feedback */}
      {submitted && normalizeForComparison(inputValue.trim()) !== normalizedCleanAnswer && (
        <div style={{ color: colors.status.danger.light }}>
          Wrong! The answer was: <span className="font-bold">{cleanAnswer}</span>
        </div>
      )}
    </div>
  );
}
