"use client";

import { memo } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import type { HintType } from "@/lib/hintPool/types";

const HINT_BUTTONS: Array<{
  type: HintType;
  label: string;
  emoji: string;
  testId: string;
}> = [
  {
    type: "fifty_fifty",
    label: "50/50",
    emoji: "✂️",
    testId: "duel-hint-fifty-fifty",
  },
  {
    type: "plus_ten_seconds",
    label: "+15 Seconds",
    emoji: "⏰",
    testId: "duel-hint-plus-ten",
  },
  {
    type: "anagram",
    label: "Anagram",
    emoji: "🔀",
    testId: "duel-hint-anagram",
  },
  {
    type: "letter_count",
    label: "Letter Count",
    emoji: "🔢",
    testId: "duel-hint-letter-count",
  },
];

interface HintPoolUIProps {
  usedHints: HintType[];
  usedCount: number;
  totalCount: number;
  currentQuestionHintFired: boolean;
  onFireHint: (type: HintType) => void;
}

export const HintPoolUI = memo(function HintPoolUI({
  usedHints,
  usedCount,
  totalCount,
  currentQuestionHintFired,
  onFireHint,
}: HintPoolUIProps) {
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
        {HINT_BUTTONS.map((hint) => {
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
