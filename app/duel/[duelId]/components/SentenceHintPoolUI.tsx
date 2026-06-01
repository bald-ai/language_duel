"use client";

import { memo } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import type { SentenceHintType } from "@/lib/sentenceGameplay/hints";

const SENTENCE_HINT_BUTTONS: Array<{
  type: SentenceHintType;
  label: string;
  emoji: string;
  testId: string;
}> = [
  {
    // Freeze is the dedicated time hint: the universal +10s plus a further +20s
    // = +30s total (see lib/sentenceGameplay/hints.ts). The label is the total.
    type: "freeze_time",
    label: "Freeze (+30s)",
    emoji: "⏱️",
    testId: "sentence-hint-freeze-time",
  },
  {
    type: "remove_distractor",
    label: "Remove distractors",
    emoji: "✂️",
    testId: "sentence-hint-remove-distractor",
  },
  {
    type: "reveal_tiles",
    label: "Reveal 2 tiles",
    emoji: "✨",
    testId: "sentence-hint-reveal-tiles",
  },
];

interface SentenceHintPoolUIProps {
  usedHints: SentenceHintType[];
  usedCount: number;
  totalCount: number;
  currentQuestionHintFired: boolean;
  onFireHint: (type: SentenceHintType) => void;
}

/**
 * The PvE cooperative hint pool shown in the sentence board footer: one button
 * per hint, a used/total counter, and the shared one-per-question gate. Mirrors
 * the word `HintPoolUI` chrome so the two pools feel identical.
 */
export const SentenceHintPoolUI = memo(function SentenceHintPoolUI({
  usedHints,
  usedCount,
  totalCount,
  currentQuestionHintFired,
  onFireHint,
}: SentenceHintPoolUIProps) {
  const colors = useAppearanceColors();
  const containerStyle = {
    borderColor: colors.primary.dark,
    backgroundColor: `${colors.background.DEFAULT}CC`,
  };
  const disabledButtonStyle = {
    borderColor: colors.neutral.dark,
    backgroundColor: colors.background.DEFAULT,
    color: colors.text.muted,
  };
  const enabledButtonStyle = {
    borderColor: colors.secondary.dark,
    backgroundColor: colors.background.elevated,
    color: colors.text.DEFAULT,
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="text-sm font-medium uppercase tracking-wider opacity-80"
        style={{ color: colors.text.DEFAULT }}
      >
        Hint pool{" "}
        <span className="tabular-nums" style={{ color: colors.text.DEFAULT }}>
          {usedCount}/{totalCount}
        </span>
      </div>

      <div
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-2xl border backdrop-blur-md shadow-xl"
        style={containerStyle}
      >
        {SENTENCE_HINT_BUTTONS.map((hint) => {
          const disabled =
            usedHints.includes(hint.type) ||
            currentQuestionHintFired ||
            usedCount >= totalCount;

          return (
            <button
              key={hint.type}
              type="button"
              onClick={() => onFireHint(hint.type)}
              disabled={disabled}
              className={`h-11 w-11 rounded-xl border-2 flex items-center justify-center text-xl transition-all ${
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "hover:brightness-110 active:scale-95"
              }`}
              style={disabled ? disabledButtonStyle : enabledButtonStyle}
              title={hint.label}
              data-testid={hint.testId}
            >
              {hint.emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
});
