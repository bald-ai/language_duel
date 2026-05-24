"use client";

import { useState, useMemo } from "react";
import { normalizeForComparison, stripIrr } from "@/lib/stringUtils";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { LevelActions } from "./components/LevelActions";
import type { Level2TypingProps } from "./types";

/**
 * Level 2 - Typing Input with dashes hint (solo study).
 */
export function Level2TypingInput({
  answer,
  onCorrect,
  onWrong,
  onSkip,
  dataTestIdBase,
}: Level2TypingProps) {
  const colors = useAppearanceColors();
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const cleanAnswer = useMemo(() => stripIrr(answer), [answer]);
  const normalizedCleanAnswer = useMemo(
    () => normalizeForComparison(cleanAnswer),
    [cleanAnswer]
  );

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

  const words = cleanAnswer.split(" ");
  const hasMultipleWords = words.length > 1;
  const dashStyle = { color: colors.text.muted };
  const dotStyle = { color: colors.neutral.dark };

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

  return (
    <div className="flex flex-col items-center gap-4">
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
      {!submitted && (
        <LevelActions
          onSkip={onSkip}
          onConfirm={handleSubmit}
          confirmDisabled={!inputValue.trim()}
          dataTestIdBase={dataTestIdBase}
          confirmTestId="submit"
        />
      )}
      {submitted && normalizeForComparison(inputValue.trim()) !== normalizedCleanAnswer && (
        <div style={{ color: colors.status.danger.light }}>
          Wrong! The answer was: <span className="font-bold">{cleanAnswer}</span>
        </div>
      )}
    </div>
  );
}
